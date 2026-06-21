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
require_once __DIR__ . '/response_templates.php';  // Шаблоны ответов

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

// [FIX-P1] Определяем IP сразу — нужен для всех последующих проверок
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

// ============================================================
// [FIX-P1] ПРОВЕРКА РАЗМЕРА ЗАПРОСА (защита от DoS через огромный POST)
// ============================================================
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
$maxAllowed    = MAX_TOTAL_SIZE + 1024 * 1024; // файлы + 1 МБ на POST-поля

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

// ============================================================
// CSRF ПРОВЕРКА
// ============================================================
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

// [FIX-P0] Не удаляем токен — он живёт 1 час (см. csrf_token.php).
// Это позволяет отправлять форму из нескольких вкладок одновременно.

Logger::debug('CSRF validation passed');

// ============================================================
// HONEYPOT (защита от ботов)
// ============================================================
if (!empty($_POST['website'])) {
    Logger::info('Honeypot triggered (bot detected)', ['ip' => $ip]);
    // Возвращаем success, чтобы бот не понял, что попался
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

// ============================================================
// [FIX-P1] RATE LIMITING (атомарная операция под flock)
// ============================================================
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
    // Файл недоступен — не блокируем клиента, но проблема записана в лог
} else {
    if (flock($fp, LOCK_EX)) {
        $content  = stream_get_contents($fp);
        $requests = $content ? (json_decode($content, true) ?: []) : [];
        if (!is_array($requests)) {
            $requests = [];
        }

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
$data   = []; // «сырые» валидированные данные (без HTML-экранирования)

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

    $phone_clean = preg_replace('/[^0-9+]/', '', $_POST['phone'] ?? '');
    if (mb_strlen($phone_clean) < 10) {
        $errors[] = 'Некорректный телефон';
    }

    if (mb_strlen(trim($_POST['taskDescription'] ?? ''), 'UTF-8') < 10) {
        $errors[] = 'Описание задачи (мин. 10 символов)';
    }

    if (empty($_POST['privacyConsent']) || empty($_POST['personalDataConsent'])) {
        $errors[] = 'Необходимо согласие на обработку данных';
    }

    $data = [
        'type'      => 'proposal',
        'company'   => trim($_POST['companyName'] ?? ''),
        'contact'   => trim($_POST['contactPerson'] ?? ''),
        'email'     => $rawEmail,
        'phone'     => trim($_POST['phone'] ?? ''),
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

    $phone_clean = preg_replace('/[^0-9+]/', '', $_POST['phone'] ?? '');
    if (mb_strlen($phone_clean) < 10) {
        $errors[] = 'Некорректный телефон';
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
        'phone'         => trim($_POST['phone'] ?? ''),
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

Logger::debug('Form validation passed', ['form_type' => $formType]);

// ============================================================
// ЗАГРУЗКА ФАЙЛОВ
// ============================================================
$uploaded = [];

if (!empty($_FILES['fileAttachment']['name'])) {
    $files = $_FILES['fileAttachment'];

    // Нормализация структуры (один файл vs массив)
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

        if ($size > MAX_FILE_SIZE) {
            Logger::warning('File too large', [
                'file_name' => $name,
                'size'      => $size,
                'max_size'  => MAX_FILE_SIZE
            ]);
            $errors[] = "Файл $name превышает " . round(MAX_FILE_SIZE / 1024 / 1024) . " МБ";
            continue;
        }

        $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $type = @mime_content_type($tmp) ?: 'application/octet-stream';

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
// ОТПРАВКА EMAIL
// ============================================================
$phpmailer_path = __DIR__ . '/PHPMailer/PHPMailer.php';
$useFallback = !file_exists($phpmailer_path);

// Формируем письмо для админа через ResponseBuilder
$adminEmail = ResponseBuilder::buildAdminEmail($data, $uploaded, $esc, $nl2brSafe);
$subject   = $adminEmail['subject'];
$adminHtml = $adminEmail['html'];
$adminText = $adminEmail['text'];

$to = defined('ADMIN_EMAILS') && is_array(ADMIN_EMAILS) ? ADMIN_EMAILS[0] : 'admin@example.com';

if ($useFallback) {
    Logger::warning('PHPMailer not found, using mail() fallback');

    $headers  = "From: " . FROM_EMAIL . "\r\n";
    $headers .= "Reply-To: " . $data['email'] . "\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=utf-8\r\n";
    $headers .= "X-Request-ID: " . Logger::getRequestId() . "\r\n";

    $sent = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $adminHtml, $headers);

    if ($sent) {
        Logger::info('Email sent via mail()', ['to' => $to, 'subject' => $subject]);
        echo json_encode([
            'success'    => true,
            'message'    => ResponseBuilder::getSuccessMessage($formType, $data),
            'form_type'  => $formType,
        ], JSON_UNESCAPED_UNICODE);
    } else {
        Logger::error('mail() function failed', ['to' => $to, 'subject' => $subject]);
        http_response_code(500);
        echo json_encode([
            'success'    => false,
            'error'      => 'Ошибка отправки письма. Попробуйте позже.',
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ============================================================
// ОТПРАВКА ЧЕРЕЗ PHPMAILER
// ============================================================
require_once $phpmailer_path;
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

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

    $adminEmails = [];
    if (defined('ADMIN_EMAILS') && is_array(ADMIN_EMAILS)) {
        foreach (ADMIN_EMAILS as $email) {
            $email = trim($email);
            if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $mail->addAddress($email);
                $adminEmails[] = $email;
            } else {
                Logger::warning('Invalid admin email skipped', ['email' => $email]);
            }
        }
    } else {
        $mail->addAddress('admin@example.com');
        $adminEmails[] = 'admin@example.com';
    }

    if (!empty($data['email']) && is_string($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $replyName = $data['contact'] ?? $data['fullName'] ?? '';
        $mail->addReplyTo($data['email'], $replyName);
    }

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $adminHtml;
    $mail->AltBody = $adminText;

    // Прикрепляем файлы
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

            // Формируем автоответ через ResponseBuilder
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