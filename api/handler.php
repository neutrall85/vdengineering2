<?php
/**
 * Единый обработчик форм
 * ООО "Волга-Днепр Инжиниринг"
 * Версия 2.1 (поддержка отклика на вакансию, разные письма клиентам)
 */

// Путь к secret_config.php (два уровня вверх от api/, затем private/)
require_once dirname(__DIR__, 2) . '/private/secret_config.php';

// ---- GET-эндпоинт для CSRF-токена ----
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'get_csrf') {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    header('Content-Type: application/json');
    echo json_encode(['csrf_token' => $_SESSION['csrf_token']]);
    exit;
}

// ---- Разрешаем только POST ----
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['success' => false, 'error' => 'Метод не разрешён']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// ---- Функция логирования ----
function writeLog($message, $level = 'INFO') {
    $dir = dirname(LOG_FILE);
    if (!is_dir($dir)) mkdir($dir, 0750, true);
    $clean = str_replace(["\r", "\n"], ' ', $message);
    file_put_contents(LOG_FILE, date('Y-m-d H:i:s') . " [$level] $clean" . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// ---- Получение реального IP ----
function getClientIp() {
    $headers = ['HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_FORWARDED', 'HTTP_FORWARDED_FOR', 'HTTP_FORWARDED'];
    foreach ($headers as $header) {
        if (isset($_SERVER[$header]) && $_SERVER[$header]) {
            $ips = explode(',', $_SERVER[$header]);
            $ip = trim($ips[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $ip;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

// ---- Rate limiting ----
function checkRateLimit($ip) {
    $rateFile = RATE_DIR . '.rate_' . hash('sha256', $ip);
    $now = time();
    $requests = file_exists($rateFile) ? json_decode(file_get_contents($rateFile), true) : [];
    $requests = array_filter($requests, function($ts) use ($now) {
        return $ts > $now - RATE_LIMIT_WINDOW;
    });
    if (count($requests) >= RATE_LIMIT_MAX) {
        $oldest = count($requests) ? min($requests) : 0;
        $resetIn = RATE_LIMIT_WINDOW - ($now - $oldest);
        return ['allowed' => false, 'reset' => max(0, $resetIn)];
    }
    $requests[] = $now;
    file_put_contents($rateFile, json_encode($requests), LOCK_EX);
    return ['allowed' => true, 'reset' => 0];
}

// ---- Валидация и санитизация ----
function sanitizeEmail($email) {
    $email = trim($email);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    return filter_var($email, FILTER_SANITIZE_EMAIL);
}

function sanitizePhone($phone) {
    $phone = preg_replace('/[^0-9+]/', '', $phone);
    $digits = preg_replace('/[^0-9]/', '', $phone);
    if (strlen($digits) < 10 || strlen($digits) > 15) return false;
    return $phone;
}

function sanitizeText($text, $maxLength) {
    $text = trim($text);
    if (mb_strlen($text) > $maxLength) return false;
    $text = strip_tags($text);
    $text = preg_replace('/\s+/', ' ', $text);
    return $text;
}

function isConsentChecked($value) {
    return ($value === 'on' || $value === 'true' || $value === '1');
}

// ---- Очистка имени файла ----
function sanitizeFileName($name) {
    $name = str_replace(["\r", "\n"], '', $name);
    $name = str_replace(
        ['\\', '/', ':', '*', '?', '"', '<', '>', '|', ';', '`', '~', '!', '@', '#', '$', '%', '^', '&', '(', ')', '[', ']', '{', '}', '+', '='],
        '_',
        $name
    );
    $name = preg_replace('/\.\.+/', '.', $name);
    $name = trim($name, " \t\0\x0B.");
    if (function_exists('mb_substr')) {
        $name = mb_substr($name, 0, 255);
    } else {
        $name = substr($name, 0, 255);
    }
    return $name ?: 'file';
}

// ---- Проверка магических чисел ----
function validateMagicBytes($filePath, $mime) {
    $handle = fopen($filePath, 'rb');
    if (!$handle) return false;
    $bytes = fread($handle, 16);
    fclose($handle);
    if ($mime === 'application/pdf') {
        return strpos($bytes, '%PDF') === 0;
    }
    if ($mime === 'application/zip' || strpos($mime, 'vnd.openxmlformats') !== false) {
        return substr($bytes, 0, 4) === "PK\x03\x04" || substr($bytes, 0, 4) === "PK\x05\x06";
    }
    return true;
}

// ---- Проверка макросов ----
function hasMacros($filePath, $mime) {
    if (strpos($mime, 'vnd.openxmlformats') === false) return false;
    $zip = new ZipArchive();
    if ($zip->open($filePath) === true) {
        $macroFiles = ['word/vbaProject.bin', 'xl/vbaProject.bin', 'ppt/vbaProject.bin'];
        foreach ($macroFiles as $macro) {
            if ($zip->locateName($macro) !== false) {
                $zip->close();
                return true;
            }
        }
        $zip->close();
    }
    return false;
}

// ---- Обработка загруженных файлов ----
function processUploadedFiles() {
    $uploaded = [];
    $totalSize = 0;
    $fileCount = 0;
    $errors = [];

    if (!isset($_FILES['fileAttachment']) || empty($_FILES['fileAttachment']['name'][0])) {
        return ['files' => [], 'errors' => []];
    }

    $names = $_FILES['fileAttachment']['name'];
    $tmpNames = $_FILES['fileAttachment']['tmp_name'];
    $sizes = $_FILES['fileAttachment']['size'];
    $errorCodes = $_FILES['fileAttachment']['error'];

    if (!is_array($names)) {
        $names = [$names];
        $tmpNames = [$tmpNames];
        $sizes = [$sizes];
        $errorCodes = [$errorCodes];
    }

    $count = count($names);
    if ($count > MAX_FILES) {
        $errors[] = 'Превышено максимальное количество файлов (' . MAX_FILES . ')';
        return ['files' => [], 'errors' => $errors];
    }

    foreach ($sizes as $size) $totalSize += $size;
    if ($totalSize > MAX_TOTAL_SIZE) {
        $errors[] = 'Общий размер файлов превышает лимит (' . (MAX_TOTAL_SIZE / 1024 / 1024) . ' MB)';
        return ['files' => [], 'errors' => $errors];
    }

    for ($i = 0; $i < $count; $i++) {
        $orig = $names[$i];
        $tmp = $tmpNames[$i];
        $size = $sizes[$i];
        $err = $errorCodes[$i];

        if ($err !== UPLOAD_ERR_OK) {
            $errors[] = "Ошибка загрузки файла: $orig (код $err)";
            continue;
        }

        $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
        $mime = mime_content_type($tmp);

        if (!in_array($ext, ALLOWED_EXTENSIONS) || !in_array($mime, ALLOWED_MIME_TYPES)) {
            $errors[] = "Недопустимый формат файла: $orig";
            continue;
        }

        if ($size > MAX_FILE_SIZE) {
            $errors[] = "Файл $orig превышает допустимый размер (" . (MAX_FILE_SIZE / 1024 / 1024) . " MB)";
            continue;
        }

        if (!validateMagicBytes($tmp, $mime)) {
            $errors[] = "Файл $orig повреждён или имеет неверную сигнатуру";
            continue;
        }

        if (hasMacros($tmp, $mime)) {
            $errors[] = "Файл $orig содержит макросы (запрещено)";
            continue;
        }

        $safeName = sanitizeFileName($orig);
        $newName = bin2hex(random_bytes(16)) . '.' . $ext;
        $dest = UPLOAD_DIR . $newName;

        if (move_uploaded_file($tmp, $dest)) {
            $uploaded[] = [
                'original' => $safeName,
                'saved'    => $newName,
                'path'     => $dest,
            ];
        } else {
            $errors[] = "Не удалось сохранить файл: $orig";
        }
    }

    if (!empty($errors)) {
        foreach ($uploaded as $f) {
            if (file_exists($f['path'])) unlink($f['path']);
        }
        return ['files' => [], 'errors' => $errors];
    }

    return ['files' => $uploaded, 'errors' => []];
}

// ---- ОСНОВНАЯ ЛОГИКА ----

// 1. Honeypot
if (!empty($_POST['website'])) {
    echo json_encode(['success' => true]);
    exit;
}

// 2. Rate limiting
$ip = getClientIp();
$rate = checkRateLimit($ip);
if (!$rate['allowed']) {
    http_response_code(429);
    echo json_encode(['success' => false, 'error' => 'Слишком много запросов. Попробуйте через ' . $rate['reset'] . ' сек.']);
    exit;
}

// 3. CSRF
$csrf = $_POST['csrf_token'] ?? '';
if (empty($csrf) || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $csrf)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Неверный CSRF токен']);
    exit;
}
unset($_SESSION['csrf_token']);

// 4. Определение типа формы и валидация полей
$formType = isset($_POST['companyName']) ? 'proposal' : 'application';
$data = [];
$errors = [];

$email = sanitizeEmail($_POST['email'] ?? '');
if (!$email) $errors[] = 'Некорректный email';
else $data['email'] = $email;

$phone = sanitizePhone($_POST['phone'] ?? '');
if (!$phone) $errors[] = 'Некорректный номер телефона';
else $data['phone'] = $phone;

if ($formType === 'proposal') {
    $fields = [
        'companyName'     => ['required' => true, 'max' => 255],
        'contactPerson'   => ['required' => true, 'max' => 255],
        'aircraftType'    => ['required' => true, 'max' => 255],
        'serviceType'     => ['required' => true, 'max' => 255],
        'taskDescription' => ['required' => true, 'max' => 5000],
        'extension'       => ['required' => false, 'max' => 10],
    ];
    foreach ($fields as $field => $rules) {
        $val = $_POST[$field] ?? '';
        $san = sanitizeText($val, $rules['max']);
        if ($rules['required'] && ($san === false || $san === '')) $errors[] = "Поле '$field' обязательно";
        elseif ($san === false) $errors[] = "Поле '$field' превышает максимальную длину";
        else $data[$field] = $san;
    }
    if (!isConsentChecked($_POST['privacyConsent'] ?? '')) $errors[] = 'Необходимо согласие с Политикой конфиденциальности';
    if (!isConsentChecked($_POST['personalDataConsent'] ?? '')) $errors[] = 'Необходимо согласие с Политикой обработки персональных данных';
    $data['privacyConsent'] = isConsentChecked($_POST['privacyConsent'] ?? '');
    $data['personalDataConsent'] = isConsentChecked($_POST['personalDataConsent'] ?? '');
} else {
    $fields = [
        'fullName' => ['required' => true, 'max' => 255],
        'about'    => ['required' => true, 'max' => 5000],
    ];
    foreach ($fields as $field => $rules) {
        $val = $_POST[$field] ?? '';
        $san = sanitizeText($val, $rules['max']);
        if ($rules['required'] && ($san === false || $san === '')) $errors[] = "Поле '$field' обязательно";
        elseif ($san === false) $errors[] = "Поле '$field' превышает максимальную длину";
        else $data[$field] = $san;
    }
    // Добавляем vacancy_id и vacancy_title, если есть
    $vacancyId = trim($_POST['vacancy_id'] ?? '');
    if (!empty($vacancyId)) {
        $data['vacancy_id'] = sanitizeText($vacancyId, 50);
    }
    $vacancyTitle = trim($_POST['vacancy_title'] ?? '');
    if (!empty($vacancyTitle)) {
        $data['vacancy_title'] = sanitizeText($vacancyTitle, 255);
    }
    if (!isConsentChecked($_POST['consent'] ?? '')) $errors[] = 'Необходимо согласие на обработку персональных данных';
    $data['consent'] = isConsentChecked($_POST['consent'] ?? '');
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => $errors]);
    exit;
}

// 5. Файлы
$fileResult = processUploadedFiles();
if (!empty($fileResult['errors'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => $fileResult['errors']]);
    exit;
}
$files = $fileResult['files'];

// 6. Формирование письма администраторам
$isVacancy = isset($data['vacancy_id']) && !empty($data['vacancy_id']);
$subject = ($formType === 'proposal') 
    ? 'Запрос коммерческого предложения' 
    : ($isVacancy ? 'Отклик на вакансию' : 'Заявка / отклик на вакансию');

$body = "Новое сообщение с сайта:\n\n";
$body .= "Тип: " . ($formType === 'proposal' ? 'КП' : ($isVacancy ? 'Отклик на вакансию' : 'Общая заявка')) . "\n";
$body .= "Дата: " . date('d.m.Y H:i:s') . "\n";
$body .= "IP: " . $ip . "\n\n";

foreach ($data as $key => $value) {
    if (in_array($key, ['privacyConsent', 'personalDataConsent', 'consent'])) continue;
    $body .= htmlspecialchars($key) . ": " . htmlspecialchars($value) . "\n";
}

if ($formType === 'proposal') {
    $body .= "\nСогласие на обработку ПД: " . ($data['privacyConsent'] ? 'Да' : 'Нет');
    $body .= "\nСогласие с политикой конфиденциальности: " . ($data['personalDataConsent'] ? 'Да' : 'Нет') . "\n";
} else {
    $body .= "\nСогласие на обработку ПД: " . ($data['consent'] ? 'Да' : 'Нет') . "\n";
}
if (!empty($files)) {
    $body .= "\nПрикреплённые файлы:\n";
    foreach ($files as $idx => $f) {
        $body .= "  " . ($idx+1) . ". " . $f['original'] . " (" . round(filesize($f['path'])/1024, 2) . " KB)\n";
    }
} else {
    $body .= "\nФайлы не прикреплены.\n";
}

// 7. Отправка через PHPMailer
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);
$adminSent = false;
try {
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = SMTP_AUTH;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = SMTP_SECURE;
    $mail->Port       = SMTP_PORT;
    $mail->SMTPOptions = [
        'ssl' => [
            'verify_peer'       => true,
            'verify_peer_name'  => true,
            'allow_self_signed' => false,
        ],
    ];
    $mail->setFrom(FROM_EMAIL, FROM_NAME);
    foreach (ADMIN_EMAILS as $email => $name) {
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $mail->addAddress($email, $name);
        }
    }
    if (!empty($data['email'])) {
        $mail->addReplyTo($data['email'], $data['contactPerson'] ?? $data['fullName'] ?? '');
    }
    $mail->Subject = $subject;
    $mail->Body    = $body;
    foreach ($files as $f) {
        if (file_exists($f['path'])) {
            $mail->addAttachment($f['path'], $f['original']);
        }
    }
    $mail->send();
    $adminSent = true;
    writeLog("Admin email sent successfully, IP: $ip");
} catch (Exception $e) {
    writeLog("Admin Mail error: " . $mail->ErrorInfo . ", IP: $ip", 'ERROR');
}

// 8. Подтверждение клиенту (разное для разных типов форм)
if ($adminSent && !empty($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    try {
        $mail->clearAddresses();
        $mail->clearAttachments();
        $mail->addAddress($data['email']);

        // ---- Определяем тип письма ----
        $isProposal = ($formType === 'proposal');
        $isVacancy  = isset($data['vacancy_id']) && !empty($data['vacancy_id']);
        $userName   = htmlspecialchars($data['contactPerson'] ?? $data['fullName'] ?? '');
        
        if ($isProposal) {
            // ---- Письмо для запроса КП ----
            $mail->Subject = 'Ваш запрос коммерческого предложения получен | Волга-Днепр Инжиниринг';
            $clientBody = "<h2>Запрос коммерческого предложения получен</h2>
<p>Уважаемый(ая) {$userName},</p>
<p>Благодарим вас за интерес к услугам компании «Волга-Днепр Инжиниринг».</p>
<p>Ваш запрос на подготовку коммерческого предложения успешно доставлен. Наши специалисты внимательно изучат ваши требования и свяжутся с вами в ближайшее рабочее время для уточнения деталей.</p>
<p>Если у вас есть дополнительные вопросы, вы можете ответить на это письмо.</p>
<p>С уважением,<br>Команда «Волга-Днепр Инжиниринг»</p>";
        } elseif ($isVacancy) {
            // ---- Письмо для отклика на вакансию ----
            $vacancyTitle = htmlspecialchars($data['vacancy_title'] ?? $data['vacancy_id'] ?? '');
            $mail->Subject = 'Ваш отклик на вакансию получен | Волга-Днепр Инжиниринг';
            $clientBody = "<h2>Отклик на вакансию получен</h2>
<p>Уважаемый(ая) {$userName},</p>
<p>Благодарим вас за отклик на вакансию" . ($vacancyTitle ? " «{$vacancyTitle}»" : '') . ".</p>
<p>Ваше резюме передано на рассмотрение отделу кадров. Мы свяжемся с вами в ближайшее время, если ваша кандидатура будет соответствовать нашим требованиям.</p>
<p>Если у вас есть дополнительные вопросы, вы можете ответить на это письмо.</p>
<p>С уважением,<br>Команда «Волга-Днепр Инжиниринг»</p>";
        } else {
            // ---- Письмо для общей заявки (без вакансии) ----
            $mail->Subject = 'Ваша заявка получена | Волга-Днепр Инжиниринг';
            $clientBody = "<h2>Заявка получена</h2>
<p>Уважаемый(ая) {$userName},</p>
<p>Благодарим вас за обращение в компанию «Волга-Днепр Инжиниринг».</p>
<p>Ваша заявка успешно доставлена и передана нашим специалистам. Мы свяжемся с вами в ближайшее рабочее время.</p>
<p>Если у вас есть дополнительные вопросы, вы можете ответить на это письмо.</p>
<p>С уважением,<br>Команда «Волга-Днепр Инжиниринг»</p>";
        }

        $mail->Body = $clientBody;
        $mail->AltBody = strip_tags($clientBody);
        $mail->send();
        writeLog("Client confirmation sent to " . $data['email'] . " (type: " . ($isProposal ? 'proposal' : ($isVacancy ? 'vacancy' : 'general')) . "), IP: $ip");
    } catch (Exception $e) {
        writeLog("Client Mail error: " . $mail->ErrorInfo . " for " . $data['email'] . ", IP: $ip", 'WARN');
    }
}

// 9. Удаление временных файлов
foreach ($files as $f) {
    if (file_exists($f['path'])) {
        unlink($f['path']);
        writeLog("Deleted temp file: " . $f['saved'] . ", IP: $ip");
    }
}

// 10. Ответ клиенту
if ($adminSent) {
    echo json_encode(['success' => true, 'message' => 'Заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Ошибка отправки письма. Попробуйте позже или свяжитесь с нами по телефону.']);
}