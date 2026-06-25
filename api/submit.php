<?php
// ============================================================
// ПРОДАКШН-ВЕРСИЯ – ошибки НЕ выводятся, логируются
// ООО "Волга-Днепр Инжиниринг"
// ============================================================

// 1. Базовая настройка PHP
ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 0);
ini_set('html_errors', 0);

// 2. Подключаем конфиги и логгер
require_once __DIR__ . '/Logger.php';
require_once __DIR__ . '/secret_config.php';
require_once __DIR__ . '/response_templates.php';

Logger::init(LOG_DIR);

// 3. Глобальный обработчик фатальных ошибок
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        Logger::error('FATAL ERROR', [
            'message' => $error['message'],
            'file'    => $error['file'],
            'line'    => $error['line']
        ]);
    }
});

// 4. Заголовки (сессия уже стартована в secret_config.php)
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПРОВЕРКИ ФАЙЛОВ
// ============================================================

/**
 * Проверка магических сигнатур (первые байты файла)
 */
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

/**
 * Проверка наличия макросов в OOXML-файлах
 */
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

/**
 * Определение MIME-типа с fallback на finfo
 */
function detectMimeType($filePath) {
    if (function_exists('mime_content_type')) {
        return @mime_content_type($filePath) ?: 'application/octet-stream';
    }
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        return $finfo->file($filePath) ?: 'application/octet-stream';
    }
    return 'application/octet-stream';
}

/**
 * Улучшенная валидация российского номера телефона
 */
function validateRussianPhone($phone) {
    $digits = preg_replace('/[^0-9]/', '', $phone);
    if (strlen($digits) < 10 || strlen($digits) > 15) return false;
    if (!preg_match('/^[78]\d{9,14}$/', $digits)) return false;
    return true;
}

// ============================================================
// НАЧАЛО ОБРАБОТКИ ЗАПРОСА
// ============================================================
Logger::info('Form submission started', [
    'method'   => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    'has_post' => !empty($_POST)
]);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Logger::warning('Invalid request method', ['method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown']);
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Метод не разрешён'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// Проверка размера запроса
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
$maxAllowed    = MAX_TOTAL_SIZE + 1024 * 1024;
if ($contentLength > $maxAllowed) {
    Logger::warning('Request too large', [
        'content_length' => $contentLength,
        'max_allowed'    => $maxAllowed,
        'ip'             => $ip
    ]);
    http_response_code(413);
    echo json_encode([
        'success'    => false,
        'error'      => 'Размер запроса превышает допустимый.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// CSRF
$csrf_token      = $_POST['csrf_token'] ?? '';
$hasSessionToken = isset($_SESSION['csrf_token']);
if (empty($csrf_token) || !$hasSessionToken || !hash_equals((string)$_SESSION['csrf_token'], (string)$csrf_token)) {
    Logger::warning('CSRF validation failed', [
        'has_post_token'    => !empty($csrf_token),
        'has_session_token' => $hasSessionToken,
        'ip'                => $ip
    ]);
    http_response_code(403);
    echo json_encode([
        'success'    => false,
        'error'      => 'Неверный CSRF токен. Обновите страницу и попробуйте снова.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
Logger::debug('CSRF validation passed');

// Honeypot
if (!empty($_POST['website'])) {
    Logger::info('Honeypot triggered (bot detected)', ['ip' => $ip]);
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

// Rate limiting (атомарная запись)
if (!is_dir(RATE_DIR)) {
    if (!mkdir(RATE_DIR, 0755, true) && !is_dir(RATE_DIR)) {
        Logger::error('Failed to create rate limit directory', ['path' => RATE_DIR]);
    }
}
$rate_file = RATE_DIR . 'rate_' . hash('sha256', $ip);
$now       = time();
$fp = @fopen($rate_file, 'c+');
if (!$fp) {
    Logger::error('Cannot open rate limit file', ['path' => $rate_file]);
} else {
    if (flock($fp, LOCK_EX)) {
        $content  = stream_get_contents($fp);
        $requests = $content ? (json_decode($content, true) ?: []) : [];
        if (!is_array($requests)) $requests = [];
        $filtered = array_values(array_filter($requests, function($ts) use ($now) {
            return is_numeric($ts) && $ts > $now - RATE_LIMIT_WINDOW;
        }));
        if (count($filtered) >= RATE_LIMIT_MAX) {
            flock($fp, LOCK_UN);
            fclose($fp);
            Logger::warning('Rate limit exceeded', [
                'ip'             => $ip,
                'requests_count' => count($filtered),
                'window'         => RATE_LIMIT_WINDOW,
                'max_allowed'    => RATE_LIMIT_MAX
            ]);
            http_response_code(429);
            echo json_encode([
                'success'    => false,
                'error'      => 'Слишком много запросов. Попробуйте позже.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $filtered[] = $now;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($filtered));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

// ============================================================
// ОПРЕДЕЛЕНИЕ ТИПА ФОРМЫ И ВАЛИДАЦИЯ
// ============================================================
$isProposal  = isset($_POST['companyName']);
$isUniversal = isset($_POST['fullName']);
$formType = 'unknown';
$errors = [];
$data   = [];

if ($isProposal) {
    $formType = 'proposal';
    Logger::debug('Processing proposal form');

    $required = ['companyName', 'contactPerson', 'email', 'phone', 'aircraftType', 'serviceType', 'taskDescription'];
    foreach ($required as $f) {
        if (empty(trim($_POST[$f] ?? ''))) {
            $errors[] = "Поле $f обязательно";
        }
    }

    $rawEmail = trim($_POST['email'] ?? '');
    if ($rawEmail !== '' && !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Некорректный email';
    }

    $rawPhone = trim($_POST['phone'] ?? '');
    if (!validateRussianPhone($rawPhone)) {
        $errors[] = 'Некорректный номер телефона (российский формат)';
    }

    if (mb_strlen(trim($_POST['taskDescription'] ?? ''), 'UTF-8') < 10) {
        $errors[] = 'Описание задачи (мин. 10 символов)';
    }

    if (empty($_POST['personalDataConsent'])) {
        $errors[] = 'Необходимо согласие на обработку данных';
    }

    $data = [
        'type'      => 'proposal',
        'company'   => trim($_POST['companyName'] ?? ''),
        'contact'   => trim($_POST['contactPerson'] ?? ''),
        'email'     => $rawEmail,
        'phone'     => $rawPhone,
        'extension' => trim($_POST['extension'] ?? ''),
        'aircraft'  => trim($_POST['aircraftType'] ?? ''),
        'service'   => trim($_POST['serviceType'] ?? ''),
        'task'      => trim($_POST['taskDescription'] ?? ''),
    ];

} elseif ($isUniversal) {
    $formType = 'universal';
    Logger::debug('Processing universal form');

    $required = ['fullName', 'email', 'phone', 'about'];
    foreach ($required as $f) {
        if (empty(trim($_POST[$f] ?? ''))) {
            $errors[] = "Поле $f обязательно";
        }
    }

    $rawEmail = trim($_POST['email'] ?? '');
    if ($rawEmail !== '' && !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Некорректный email';
    }

    $rawPhone = trim($_POST['phone'] ?? '');
    if (!validateRussianPhone($rawPhone)) {
        $errors[] = 'Некорректный номер телефона (российский формат)';
    }

    if (mb_strlen(trim($_POST['about'] ?? ''), 'UTF-8') < 10) {
        $errors[] = 'Расскажите о себе (мин. 10 символов)';
    }

    if (empty($_POST['consent'])) {
        $errors[] = 'Необходимо согласие на обработку ПД';
    }

    $data = [
        'type'          => 'universal',
        'fullName'      => trim($_POST['fullName'] ?? ''),
        'email'         => $rawEmail,
        'phone'         => $rawPhone,
        'about'         => trim($_POST['about'] ?? ''),
        'vacancy_id'    => trim($_POST['vacancy_id'] ?? ''),
        'vacancy_title' => trim($_POST['vacancy_title'] ?? ''),
    ];

} else {
    Logger::warning('Unknown form type', ['post_keys' => array_keys($_POST)]);
    $errors[] = 'Неизвестный тип формы';
}

if ($errors) {
    Logger::info('Form validation failed', [
        'form_type' => $formType,
        'errors'    => $errors,
        'ip'        => $ip
    ]);
    http_response_code(400);
    echo json_encode([
        'success'    => false,
        'errors'     => $errors,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// ЛОГИРОВАНИЕ СОГЛАСИЯ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ
// ============================================================
if (!empty($_POST['personalDataConsent']) || !empty($_POST['consent'])) {
    $consentType = $isProposal ? 'proposal' : 'universal';
    $email = $data['email'] ?? 'unknown';
    $phone = $data['phone'] ?? '';
    $fullName = $data['contact'] ?? $data['fullName'] ?? '';

    $sessionId = session_id();

    $entry = [
        'timestamp'      => date('Y-m-d H:i:s'),
        'session_id'     => $sessionId,
        'ip'             => $ip,
        'user_agent'     => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'form_type'      => $consentType,
        'email'          => $email,
        'phone'          => $phone,
        'full_name'      => $fullName,
        'consent_given'  => true,
        'consent_version' => '2026-06-05',
        'consent_field'  => $isProposal ? 'personalDataConsent' : 'consent'
    ];

    $logFile = PERSONAL_CONSENT_LOG_DIR . 'consent-' . date('Y-m-d') . '.log';
    
    if (!is_dir(PERSONAL_CONSENT_LOG_DIR)) {
        mkdir(PERSONAL_CONSENT_LOG_DIR, 0755, true);
    }

    file_put_contents(
        $logFile,
        json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );

    Logger::debug('Personal data consent logged', ['session_id' => $sessionId]);
}

Logger::debug('Form validation passed', ['form_type' => $formType]);

// ============================================================
// ЗАГРУЗКА ФАЙЛОВ С РАСШИРЕННЫМИ ПРОВЕРКАМИ (без проверки размера каждого файла)
// ============================================================
$uploaded = [];

if (!empty($_FILES['fileAttachment']['name'])) {
    $files = $_FILES['fileAttachment'];
    if (!is_array($files['name'])) {
        $files = [
            'name'     => [$files['name']],
            'type'     => [$files['type']],
            'tmp_name' => [$files['tmp_name']],
            'error'    => [$files['error']],
            'size'     => [$files['size']]
        ];
    }

    $filesCount = count($files['name']);
    Logger::debug('Processing file uploads', ['files_count' => $filesCount]);

    if ($filesCount > MAX_FILES) {
        $errors[] = "Слишком много файлов (макс. " . MAX_FILES . ")";
        Logger::warning('Too many files', ['count' => $filesCount, 'max' => MAX_FILES]);
    }

    // Проверка общего размера всех файлов
    $totalSize = array_sum($files['size']);
    if ($totalSize > MAX_TOTAL_SIZE) {
        $errors[] = "Общий размер файлов превышает " . round(MAX_TOTAL_SIZE / 1024 / 1024) . " МБ";
        Logger::warning('Total size exceeded', ['total' => $totalSize, 'max' => MAX_TOTAL_SIZE]);
    }

    if (!is_dir(UPLOAD_DIR)) {
        if (!mkdir(UPLOAD_DIR, 0755, true) && !is_dir(UPLOAD_DIR)) {
            Logger::error('Failed to create upload directory', ['path' => UPLOAD_DIR]);
            $errors[] = 'Не удалось создать директорию для файлов';
        }
    }

    $errorMessages = [
        UPLOAD_ERR_INI_SIZE   => 'Файл превышает размер upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE  => 'Файл превышает размер MAX_FILE_SIZE в форме',
        UPLOAD_ERR_PARTIAL    => 'Файл загружен частично',
        UPLOAD_ERR_NO_FILE    => 'Файл не был загружен',
        UPLOAD_ERR_NO_TMP_DIR => 'Отсутствует временная папка',
        UPLOAD_ERR_CANT_WRITE => 'Не удалось записать файл на диск',
        UPLOAD_ERR_EXTENSION  => 'Загрузка остановлена расширением PHP',
    ];

    for ($i = 0; $i < $filesCount; $i++) {
        $name  = $files['name'][$i];
        $tmp   = $files['tmp_name'][$i];
        $size  = $files['size'][$i];
        $error = $files['error'][$i];

        if ($error !== UPLOAD_ERR_OK) {
            $errorMsg = $errorMessages[$error] ?? 'Неизвестная ошибка загрузки';
            Logger::error('File upload error', [
                'file_name'  => $name,
                'error_code' => $error,
                'error_msg'  => $errorMsg
            ]);
            $errors[] = "Ошибка загрузки файла: $name ($errorMsg)";
            continue;
        }

        // Проверка расширения и MIME (без проверки размера отдельного файла)
        $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $type = detectMimeType($tmp);

        if (!in_array($ext, ALLOWED_EXTENSIONS, true)) {
            Logger::warning('Disallowed file extension', [
                'file_name' => $name,
                'extension' => $ext,
                'allowed'   => ALLOWED_EXTENSIONS
            ]);
            $errors[] = "Недопустимый тип файла: $name (.$ext)";
            continue;
        }

        if (!in_array($type, ALLOWED_MIME_TYPES, true)) {
            Logger::warning('Disallowed MIME type', [
                'file_name' => $name,
                'mime_type' => $type,
                'allowed'   => ALLOWED_MIME_TYPES
            ]);
            $errors[] = "Недопустимый тип файла: $name ($type)";
            continue;
        }

        if (!validateMagicBytes($tmp, $type)) {
            Logger::warning('Magic bytes mismatch', [
                'file_name' => $name,
                'mime_type' => $type
            ]);
            $errors[] = "Файл $name повреждён или имеет неверную сигнатуру";
            continue;
        }

        if (hasMacros($tmp, $type)) {
            Logger::warning('Macros detected', [
                'file_name' => $name,
                'mime_type' => $type
            ]);
            $errors[] = "Файл $name содержит макросы (запрещено)";
            continue;
        }

        $new_name = bin2hex(random_bytes(16)) . '.' . $ext;
        $dest = UPLOAD_DIR . $new_name;

        if (move_uploaded_file($tmp, $dest)) {
            if (!chmod($dest, 0644)) {
                Logger::warning('Failed to chmod uploaded file', ['path' => $dest]);
            }
            $uploaded[] = [
                'original' => $name,
                'saved'    => $new_name,
                'size'     => $size,
                'mime'     => $type
            ];
            Logger::debug('File uploaded successfully', [
                'original' => $name,
                'saved'    => $new_name,
                'size'     => $size
            ]);
        } else {
            Logger::error('Failed to move uploaded file', [
                'tmp'  => $tmp,
                'dest' => $dest,
                'name' => $name
            ]);
            $errors[] = "Не удалось сохранить файл: $name";
        }
    }
}

if ($errors) {
    foreach ($uploaded as $f) {
        @unlink(UPLOAD_DIR . $f['saved']);
    }
    Logger::warning('File validation failed', [
        'form_type' => $formType,
        'errors'    => $errors
    ]);
    http_response_code(400);
    echo json_encode([
        'success'    => false,
        'errors'     => $errors,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: экранирование для HTML-тела письма
// ============================================================
$esc = static function ($v) {
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
};
$nl2brSafe = static function ($v) use ($esc) {
    return nl2br($esc($v), false);
};

// ============================================================
// ОТПРАВКА EMAIL ЧЕРЕЗ PHPMAILER (без fallback)
// ============================================================
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$adminEmail = ResponseBuilder::buildAdminEmail($data, $uploaded, $esc, $nl2brSafe);
$subject   = $adminEmail['subject'];
$adminHtml = $adminEmail['html'];
$adminText = $adminEmail['text'];

$mail = new PHPMailer(true);

try {
    $mail->CharSet  = 'UTF-8';
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = SMTP_AUTH;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = SMTP_SECURE;
    $mail->Port       = SMTP_PORT;
    $mail->Timeout    = 30;

    $mail->setFrom(FROM_EMAIL, FROM_NAME);

    // Определяем список получателей в зависимости от типа формы
    if ($formType === 'proposal') {
        $adminEmails = defined('ADMIN_EMAILS_PROPOSAL') ? ADMIN_EMAILS_PROPOSAL : [];
        if (empty($adminEmails)) {
            $adminEmails = defined('ADMIN_EMAILS') && is_array(ADMIN_EMAILS) ? ADMIN_EMAILS : ['admin@example.com'];
        }
    } else {
        $adminEmails = defined('ADMIN_EMAILS_RESUME') ? ADMIN_EMAILS_RESUME : [];
        if (empty($adminEmails)) {
            $adminEmails = defined('ADMIN_EMAILS') && is_array(ADMIN_EMAILS) ? ADMIN_EMAILS : ['admin@example.com'];
        }
    }

    $actualAdminEmails = [];
    foreach ($adminEmails as $email) {
        $email = trim($email);
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $mail->addAddress($email);
            $actualAdminEmails[] = $email;
        } else {
            Logger::warning('Invalid admin email skipped', ['email' => $email]);
        }
    }
    if (empty($actualAdminEmails)) {
        $mail->addAddress('admin@example.com');
        $actualAdminEmails[] = 'admin@example.com';
    }
    $adminEmails = $actualAdminEmails;

    if (!empty($data['email']) && is_string($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $replyName = $data['contact'] ?? $data['fullName'] ?? '';
        $mail->addReplyTo($data['email'], $replyName);
    }

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $adminHtml;
    $mail->AltBody = $adminText;

    foreach ($uploaded as $f) {
        $filePath = UPLOAD_DIR . $f['saved'];
        if (file_exists($filePath)) {
            $mail->addAttachment($filePath, $f['original']);
        } else {
            Logger::error('Attachment file not found', ['path' => $filePath]);
        }
    }

    $mail->send();

    Logger::info('Admin email sent successfully', [
        'to'          => $adminEmails,
        'subject'     => $mail->Subject,
        'files_count' => count($uploaded)
    ]);

    // Автоответ клиенту
    if (!empty($data['email']) && is_string($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        try {
            $mail->clearAddresses();
            $mail->clearAttachments();
            $mail->addAddress($data['email']);

            $clientReply = ResponseBuilder::buildClientAutoReply($data, FROM_NAME, $esc);
            $mail->Subject = $clientReply['subject'];
            $mail->Body    = $clientReply['html'];
            $mail->AltBody = $clientReply['text'];

            $mail->send();

            Logger::info('Client confirmation sent', [
                'to'        => $data['email'],
                'form_type' => $formType
            ]);
        } catch (Exception $e) {
            Logger::warning('Client confirmation failed', [
                'to'         => $data['email'],
                'error_info' => $mail->ErrorInfo
            ]);
        }
    }

    // Удаление временных файлов
    foreach ($uploaded as $f) {
        @unlink(UPLOAD_DIR . $f['saved']);
        Logger::debug('Temporary file deleted', ['file' => $f['saved']]);
    }

    Logger::info('Form successfully submitted', [
        'form_type'    => $formType,
        'files_count'  => count($uploaded),
        'client_email' => $data['email'] ?? 'N/A'
    ]);

    echo json_encode([
        'success'    => true,
        'message'    => ResponseBuilder::getSuccessMessage($formType, $data),
        'form_type'  => $formType,
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    foreach ($uploaded as $f) {
        @unlink(UPLOAD_DIR . $f['saved']);
    }
    Logger::error('PHPMailer send failed', [
        'error_info' => $mail->ErrorInfo,
        'form_type'  => $formType,
        'recipients' => $adminEmails ?? []
    ]);
    http_response_code(500);
    echo json_encode([
        'success'    => false,
        'error'      => 'Ошибка отправки письма. Попробуйте позже.',
    ], JSON_UNESCAPED_UNICODE);
}