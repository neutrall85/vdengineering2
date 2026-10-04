<?php
// ============================================================
// ПРОДАКШН-ВЕРСИЯ – ошибки НЕ выводятся, логируются
// ООО "ВД Инжиниринг"
// ============================================================

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');
ini_set('html_errors', 0);

require_once __DIR__ . '/Logger.php';
require_once __DIR__ . '/secret_config.php';
require_once __DIR__ . '/response_templates.php';

Logger::init(LOG_DIR);

$uploaded = [];

register_shutdown_function(function() use (&$uploaded) {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        Logger::error('FATAL ERROR', [
            'message' => $error['message'],
            'file'    => $error['file'],
            'line'    => $error['line']
        ], 'forms');
        if (!empty($uploaded)) {
            foreach ($uploaded as $f) {
                @unlink(rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $f['saved']);
                Logger::debug('Fatal cleanup: removed file', ['file' => $f['saved']], 'forms');
            }
        }
    }
});

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');

function validateMagicBytes($filePath, $mime) {
    $handle = fopen($filePath, 'rb');
    if (!$handle) return false;
    $bytes = fread($handle, 16);
    fclose($handle);

    if ($mime === 'application/pdf') return strpos($bytes, '%PDF') === 0;
    if ($mime === 'application/zip' || strpos($mime, 'vnd.openxmlformats') !== false) {
        return substr($bytes, 0, 4) === "PK\x03\x04" || substr($bytes, 0, 4) === "PK\x05\x06";
    }
    // [SEC] Полная 8-байтовая OLE-сигнатура для .doc/.xls/.ppt.
    if ($mime === 'application/msword'
        || $mime === 'application/vnd.ms-excel'
        || $mime === 'application/vnd.ms-powerpoint') {
        return substr($bytes, 0, 8) === "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1";
    }
    if ($mime === 'image/jpeg') return substr($bytes, 0, 3) === "\xFF\xD8\xFF";
    if ($mime === 'image/png')  return substr($bytes, 0, 8) === "\x89\x50\x4E\x47\x0D\x0A\x1A\x0A";
    if ($mime === 'image/gif')  return substr($bytes, 0, 6) === "GIF89a" || substr($bytes, 0, 6) === "GIF87a";
    return true;
}

function hasMacros($filePath, $mime) {
    if (strpos($mime, 'vnd.openxmlformats') === false) return false;
    $zip = new ZipArchive();
    if ($zip->open($filePath) === true) {
        $macroFiles = ['word/vbaProject.bin', 'xl/vbaProject.bin', 'ppt/vbaProject.bin'];
        foreach ($macroFiles as $macro) {
            if ($zip->locateName($macro) !== false) { $zip->close(); return true; }
        }
        $zip->close();
    }
    return false;
}

function detectMimeType($filePath) {
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $type = $finfo->file($filePath);
        if ($type) return $type;
    }
    if (function_exists('mime_content_type')) {
        $type = @mime_content_type($filePath);
        if ($type) return $type;
    }
    return 'application/octet-stream';
}

function validatePhone($phone) {
    $digits = preg_replace('/[^0-9]/', '', $phone);
    $len = strlen($digits);
    if ($len === 11 && preg_match('/^[78]\d{10}$/', $digits)) return true;
    if ($len === 12 && preg_match('/^375\d{9}$/', $digits)) return true;
    if ($len === 10 && preg_match('/^[9]\d{9}$/', $digits)) return true;
    return false;
}

function getAllowedMimesForExtension($ext) {
    $map = [
        'pdf'  => ['application/pdf'],
        'docx' => ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
        'pptx' => ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'],
        'doc'  => ['application/msword'],
        'xls'  => ['application/vnd.ms-excel'],
        'ppt'  => ['application/vnd.ms-powerpoint'],
        'jpg'  => ['image/jpeg', 'image/jpg'],
        'jpeg' => ['image/jpeg', 'image/jpg'],
        'png'  => ['image/png'],
        'gif'  => ['image/gif'],
        'zip'  => ['application/zip', 'application/x-zip-compressed'],
    ];
    return $map[strtolower($ext)] ?? null;
}

function validateOoxmlStructure($filePath, $ext) {
    $zip = new ZipArchive();
    if ($zip->open($filePath) !== true) return false;
    $hasContent = false;
    if ($ext === 'xlsx' && $zip->locateName('xl/workbook.xml') !== false) $hasContent = true;
    elseif ($ext === 'docx' && $zip->locateName('word/document.xml') !== false) $hasContent = true;
    elseif ($ext === 'pptx' && $zip->locateName('ppt/presentation.xml') !== false) $hasContent = true;
    $zip->close();
    return $hasContent;
}

function validateZipArchive($zipPath, &$errors, $fileName) {
    if (!class_exists('ZipArchive')) { $errors[] = "Расширение ZipArchive не доступно"; return false; }
    $zip = new ZipArchive();
    if ($zip->open($zipPath) !== true) { $errors[] = "Не удалось открыть ZIP-архив: $fileName"; return false; }
    $maxFilesInZip = 100;
    if ($zip->numFiles > $maxFilesInZip) {
        $errors[] = "Архив $fileName содержит более $maxFilesInZip файлов";
        $zip->close();
        return false;
    }
    $dangerousExtensions = ['php','phtml','php3','php4','php5','phps','exe','bat','cmd','com','scr','pif','sh','bash','zsh','ksh','js','vbs','ps1','psm1','psd1','jar','class','jsp','py','pl','rb','cgi','plx','pm','htaccess','htpasswd'];
    $totalExtractedSize = 0;
    $maxExtractedSize = 50 * 1024 * 1024;
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $stat = $zip->statIndex($i);
        $name = $stat['name'];
        $size = $stat['size'];
        $normalized = str_replace('\\', '/', $name);
        if (preg_match('#^(?:/|[a-zA-Z]:/|//)#', $normalized)) {
            $errors[] = "Архив $fileName содержит абсолютный путь: $name";
            $zip->close();
            return false;
        }
        if (preg_match('#(^|/)\\.\\.(/|$)#', $normalized)) {
            $errors[] = "Архив $fileName содержит недопустимый путь: $name";
            $zip->close();
            return false;
        }
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (in_array($ext, $dangerousExtensions, true)) {
            $errors[] = "Архив $fileName содержит файл с опасным расширением: $name (.$ext)";
            $zip->close();
            return false;
        }
        $totalExtractedSize += $size;
        if ($totalExtractedSize > $maxExtractedSize) {
            $errors[] = "Архив $fileName слишком велик при распаковке";
            $zip->close();
            return false;
        }
    }
    $zip->close();
    return true;
}

function parseStrictDate(string $value): ?DateTime {
    if ($value === '') return null;
    $dt = DateTime::createFromFormat('!d.m.Y', $value);
    if (!$dt) return null;
    if ($dt->format('d.m.Y') !== $value) return null;
    return $dt;
}

Logger::info('Form submission started', [
    'method'   => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
    'has_post' => !empty($_POST)
], 'forms');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Logger::warning('Invalid request method', ['method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown'], 'forms');
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Метод не разрешён'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ip = get_client_ip();

$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
$maxAllowed = MAX_TOTAL_SIZE + 1024 * 1024;
if ($contentLength > $maxAllowed) {
    Logger::warning('Request too large', ['content_length' => $contentLength, 'max_allowed' => $maxAllowed, 'ip' => $ip], 'forms');
    http_response_code(413);
    echo json_encode(['success' => false, 'error' => 'Размер запроса превышает допустимый.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// CSRF
$csrf_token = $_POST['csrf_token'] ?? '';
$hasSessionToken = isset($_SESSION['csrf_token']);
if (empty($csrf_token) || !$hasSessionToken || !hash_equals((string)$_SESSION['csrf_token'], (string)$csrf_token)) {
    Logger::warning('CSRF validation failed', [
        'has_post_token'    => !empty($csrf_token),
        'has_session_token' => $hasSessionToken,
        'ip'                => $ip
    ], 'forms');
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Неверный CSRF токен. Обновите страницу и попробуйте снова.'], JSON_UNESCAPED_UNICODE);
    exit;
}

unset($_SESSION['csrf_token']);
unset($_SESSION['csrf_token_time']);
unset($_SESSION['csrf_token_issued_at']);

$sessionId = session_id();
session_write_close();

Logger::debug('CSRF validation passed', [], 'forms');

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'multipart/form-data') === false && stripos($ct, 'application/x-www-form-urlencoded') === false) {
    Logger::warning('submit.php: unexpected Content-Type', ['ct' => $ct, 'ip' => $ip], 'forms');
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'Неподдерживаемый тип содержимого запроса'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!empty($_POST['website'])) {
    Logger::info('Honeypot triggered (bot detected)', ['ip' => $ip], 'forms');
    echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
    exit;
}

// Rate limiting
if (!is_dir(RATE_DIR)) {
    if (!mkdir(RATE_DIR, 0750, true) && !is_dir(RATE_DIR)) {
        Logger::error('Failed to create rate limit directory', ['path' => RATE_DIR], 'forms');
    }
}
$rate_file = rtrim(RATE_DIR, '/\\') . DIRECTORY_SEPARATOR . 'rate_' . hash('sha256', $ip);
$now = time();
$fp = @fopen($rate_file, 'c+');
if (!$fp) {
    Logger::error('Cannot open rate limit file', ['path' => $rate_file], 'forms');
} else {
    if (flock($fp, LOCK_EX)) {
        $content = stream_get_contents($fp);
        $requests = $content ? (json_decode($content, true) ?: []) : [];
        if (!is_array($requests)) $requests = [];
        $filtered = array_values(array_filter($requests, function($ts) use ($now) {
            return is_numeric($ts) && $ts > $now - RATE_LIMIT_WINDOW;
        }));
        if (count($filtered) >= RATE_LIMIT_MAX) {
            flock($fp, LOCK_UN);
            fclose($fp);
            Logger::warning('Rate limit exceeded', [
                'ip' => $ip,
                'requests_count' => count($filtered),
                'window' => RATE_LIMIT_WINDOW,
                'max_allowed' => RATE_LIMIT_MAX
            ], 'forms');
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Слишком много запросов. Попробуйте позже.'], JSON_UNESCAPED_UNICODE);
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

$isFeedback = isset($_POST['form_type']) && $_POST['form_type'] === 'feedback';
if (!$isFeedback && isset($_POST['organization']) && isset($_POST['message']) && !isset($_POST['companyName'])) {
    $isFeedback = true;
    $_POST['form_type'] = 'feedback';
}
$isProposal  = isset($_POST['companyName']);
$isUniversal = isset($_POST['fullName']);

$formType = 'unknown';
$errors = [];
$data = [];
$sentiment = null;

// [SEC] Лимиты длины текстовых полей — защита от огромных писем и log-инъекций.
if ($isFeedback) {
    $formType = 'feedback';
    Logger::debug('Processing feedback form', [], 'forms');
    $required = ['fullName', 'organization', 'email'];
    foreach ($required as $f) {
        if (empty(trim($_POST[$f] ?? ''))) $errors[] = "Поле $f обязательно";
    }
    $rawEmail = trim($_POST['email'] ?? '');
    if ($rawEmail !== '' && !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) $errors[] = 'Некорректный email';
    if (empty($_POST['consent'])) $errors[] = 'Необходимо согласие на обработку ПД';

    $sentiment = $_POST['sentiment'] ?? '';
    if (!in_array($sentiment, ['positive', 'negative', 'neutral'], true)) $errors[] = 'Выберите тип отзыва';

    $data = [
        'type'         => 'feedback',
        'fullName'     => sanitize_header_value($_POST['fullName'] ?? '', 200),
        'organization' => sanitize_header_value($_POST['organization'] ?? '', 200),
        'email'        => mb_substr($rawEmail, 0, 254, 'UTF-8'),
        'message'      => mb_substr(trim($_POST['message'] ?? ''), 0, 10000, 'UTF-8'),
        'sentiment'    => $sentiment,
    ];
} elseif ($isProposal) {
    $formType = 'proposal';
    Logger::debug('Processing proposal form', [], 'forms');
    $required = ['companyName','contactPerson','email','phone','aircraftType','serviceType','taskDescription','requestCategory','desiredDate'];
    foreach ($required as $f) {
        if (empty(trim($_POST[$f] ?? ''))) $errors[] = "Поле $f обязательно";
    }
    $rawEmail = trim($_POST['email'] ?? '');
    if ($rawEmail !== '' && !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) $errors[] = 'Некорректный email';
    $rawPhone = trim($_POST['phone'] ?? '');
    if (!validatePhone($rawPhone)) $errors[] = 'Некорректный номер телефона';
    if (mb_strlen(trim($_POST['taskDescription'] ?? ''), 'UTF-8') < 10) $errors[] = 'Описание задачи (мин. 10 символов)';

    $category = trim($_POST['requestCategory'] ?? '');
    $allowedCategories = ['AOG', 'CRIT', 'NORM', 'ROUTINE'];
    if (!in_array($category, $allowedCategories, true)) $errors[] = 'Недопустимая категория запроса';

    $desiredDate = trim($_POST['desiredDate'] ?? '');
    if ($desiredDate !== '') {
        $dt = parseStrictDate($desiredDate);
        if ($dt === null) $errors[] = 'Некорректная дата получения КП (ожидается ДД.ММ.ГГГГ)';
        else {
            $todayStart = new DateTime('today');
            if ($dt < $todayStart) $errors[] = 'Дата получения КП должна быть не ранее сегодняшнего дня';
        }
    }

    $desiredApprovalDate = trim($_POST['desiredApprovalDate'] ?? '');
    if ($desiredApprovalDate !== '') {
        $dtApproval = parseStrictDate($desiredApprovalDate);
        if ($dtApproval === null) $errors[] = 'Некорректная дата одобрения (ожидается ДД.ММ.ГГГГ)';
    }
    if (empty($_POST['personalDataConsent'])) $errors[] = 'Необходимо согласие на обработку данных';

    $data = [
        'type'                  => 'proposal',
        'company'               => sanitize_header_value($_POST['companyName'] ?? '', 200),
        'contact'               => sanitize_header_value($_POST['contactPerson'] ?? '', 100),
        'email'                 => mb_substr($rawEmail, 0, 254, 'UTF-8'),
        'phone'                 => mb_substr($rawPhone, 0, 32, 'UTF-8'),
        'extension'             => sanitize_header_value($_POST['extension'] ?? '', 20),
        'aircraft'              => sanitize_header_value($_POST['aircraftType'] ?? '', 100),
        'service'               => sanitize_header_value($_POST['serviceType'] ?? '', 100),
        'task'                  => mb_substr(trim($_POST['taskDescription'] ?? ''), 0, 10000, 'UTF-8'),
        'category'              => $category,
        'desired_date'          => $desiredDate,
        'desired_approval_date' => $desiredApprovalDate,
    ];
} elseif ($isUniversal) {
    $formType = 'universal';
    Logger::debug('Processing universal form', [], 'forms');
    $required = ['fullName', 'email', 'phone', 'about'];
    foreach ($required as $f) {
        if (empty(trim($_POST[$f] ?? ''))) $errors[] = "Поле $f обязательно";
    }
    $rawEmail = trim($_POST['email'] ?? '');
    if ($rawEmail !== '' && !filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) $errors[] = 'Некорректный email';
    $rawPhone = trim($_POST['phone'] ?? '');
    if (!validatePhone($rawPhone)) $errors[] = 'Некорректный номер телефона';
    if (mb_strlen(trim($_POST['about'] ?? ''), 'UTF-8') < 10) $errors[] = 'Расскажите о себе (мин. 10 символов)';
    if (empty($_POST['consent'])) $errors[] = 'Необходимо согласие на обработку ПД';

    $data = [
        'type'          => 'universal',
        'fullName'      => sanitize_header_value($_POST['fullName'] ?? '', 200),
        'email'         => mb_substr($rawEmail, 0, 254, 'UTF-8'),
        'phone'         => mb_substr($rawPhone, 0, 32, 'UTF-8'),
        'about'         => mb_substr(trim($_POST['about'] ?? ''), 0, 10000, 'UTF-8'),
        'vacancy_id'    => sanitize_header_value($_POST['vacancy_id'] ?? '', 64),
        'vacancy_title' => sanitize_header_value($_POST['vacancy_title'] ?? '', 200),
    ];
} else {
    Logger::warning('Unknown form type', ['post_keys' => array_keys($_POST)], 'forms');
    $errors[] = 'Неизвестный тип формы';
}

if ($errors) {
    Logger::info('Form validation failed', ['form_type' => $formType, 'errors' => $errors, 'ip' => $ip], 'forms');
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => $errors], JSON_UNESCAPED_UNICODE);
    exit;
}

// [SEC] Логирование согласия: ПДн хранятся в виде HMAC-хешей (pseudonymize).
if (!empty($_POST['personalDataConsent']) || !empty($_POST['consent'])) {
    $consentType = $isProposal ? 'proposal' : ($isFeedback ? 'feedback' : 'universal');
    $entry = [
        'timestamp'       => date('Y-m-d H:i:s'),
        'session_id_hash' => pseudonymize($sessionId),
        'ip_hash'         => pseudonymize($ip),
        'user_agent'      => mb_substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200, 'UTF-8'),
        'form_type'       => $consentType,
        'email_hash'      => pseudonymize(mb_strtolower($data['email'] ?? '')),
        'phone_hash'      => pseudonymize($data['phone'] ?? ''),
        'full_name_hash'  => pseudonymize($data['contact'] ?? $data['fullName'] ?? ''),
        'consent_given'   => true,
        'consent_version' => CONSENT_VERSION,
        'consent_field'   => $isProposal ? 'personalDataConsent' : 'consent'
    ];
    $logFile = rtrim(PERSONAL_CONSENT_LOG_DIR, '/\\') . DIRECTORY_SEPARATOR . 'consent-' . date('Y-m-d') . '.log';
    if (!is_dir(PERSONAL_CONSENT_LOG_DIR)) @mkdir(PERSONAL_CONSENT_LOG_DIR, 0700, true);
    file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX);
    @chmod($logFile, 0600);
    Logger::debug('Personal data consent logged', ['form_type' => $consentType], 'forms');
}

Logger::debug('Form validation passed', ['form_type' => $formType], 'forms');

// Загрузка файлов
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
    Logger::debug('Processing file uploads', ['files_count' => $filesCount], 'forms');

    if ($filesCount > MAX_FILES) {
        $errors[] = "Слишком много файлов (макс. " . MAX_FILES . ")";
        Logger::warning('Too many files', ['count' => $filesCount, 'max' => MAX_FILES], 'forms');
    }

    $totalSize = array_sum($files['size']);
    if ($totalSize > MAX_TOTAL_SIZE) {
        $errors[] = "Общий размер файлов превышает " . round(MAX_TOTAL_SIZE / 1024 / 1024) . " МБ";
        Logger::warning('Total size exceeded', ['total' => $totalSize, 'max' => MAX_TOTAL_SIZE], 'forms');
    }

    if (!is_dir(UPLOAD_DIR)) {
        if (!mkdir(UPLOAD_DIR, 0700, true) && !is_dir(UPLOAD_DIR)) {
            Logger::error('Failed to create upload directory', ['path' => UPLOAD_DIR], 'forms');
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
            Logger::error('File upload error', ['file_name' => $name, 'error_code' => $error, 'error_msg' => $errorMsg], 'forms');
            $errors[] = "Ошибка загрузки файла: $name ($errorMsg)";
            continue;
        }
        if ($size > MAX_FILE_SIZE) {
            Logger::warning('File too large', ['file_name' => $name, 'size' => $size, 'max_size' => MAX_FILE_SIZE], 'forms');
            $errors[] = "Файл $name превышает " . round(MAX_FILE_SIZE / 1024 / 1024) . " МБ";
            continue;
        }

        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $type = detectMimeType($tmp);

        if (!in_array($ext, ALLOWED_EXTENSIONS, true)) {
            Logger::warning('Disallowed file extension', ['file_name' => $name, 'extension' => $ext], 'forms');
            $errors[] = "Недопустимый тип файла: $name (.$ext)";
            continue;
        }

        $allowedMimes = getAllowedMimesForExtension($ext);
        if ($allowedMimes === null) { $errors[] = "Внутренняя ошибка: нет списка MIME для .$ext"; continue; }
        if (!in_array($type, $allowedMimes, true)) {
            Logger::warning('Extension/MIME mismatch', ['file_name' => $name, 'extension' => $ext, 'detected_mime' => $type], 'forms');
            $errors[] = "Несоответствие расширения и содержимого файла: $name ($type)";
            continue;
        }

        if (!validateMagicBytes($tmp, $type)) {
            Logger::warning('Magic bytes mismatch', ['file_name' => $name, 'mime_type' => $type], 'forms');
            $errors[] = "Файл $name повреждён или имеет неверную сигнатуру";
            continue;
        }

        if (hasMacros($tmp, $type)) {
            Logger::warning('Macros detected', ['file_name' => $name, 'mime_type' => $type], 'forms');
            $errors[] = "Файл $name содержит макросы (запрещено)";
            continue;
        }

        if ($type === 'application/zip' || $ext === 'zip') {
            if (!validateZipArchive($tmp, $errors, $name)) continue;
        }

        if (in_array($ext, ['xlsx', 'docx', 'pptx'], true)) {
            if (!validateOoxmlStructure($tmp, $ext)) {
                Logger::warning('Invalid OOXML structure', ['file_name' => $name, 'extension' => $ext], 'forms');
                $errors[] = "Файл $name имеет неверную структуру (не валидный {$ext})";
                continue;
            }
        }

        $new_name = bin2hex(random_bytes(16)) . '.' . $ext;
        $dest = rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $new_name;

        if (move_uploaded_file($tmp, $dest)) {
            if (!chmod($dest, 0600)) Logger::warning('Failed to chmod uploaded file', ['path' => $dest], 'forms');
            $uploaded[] = ['original' => $name, 'saved' => $new_name, 'size' => $size, 'mime' => $type];
        } else {
            Logger::error('Failed to move uploaded file', ['tmp' => $tmp, 'dest' => $dest, 'name' => $name], 'forms');
            $errors[] = "Не удалось сохранить файл: $name";
        }
    }
}

if ($errors) {
    foreach ($uploaded as $f) @unlink(rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $f['saved']);
    $uploaded = [];
    Logger::warning('File validation failed', ['form_type' => $formType, 'errors' => $errors], 'forms');
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => $errors], JSON_UNESCAPED_UNICODE);
    exit;
}

$esc = static function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); };
$nl2brSafe = static function ($v) use ($esc) { return nl2br($esc($v), false); };

require_once __DIR__ . '/SentPHPMailer.php';
use PHPMailer\PHPMailer\Exception;

if ($formType === 'feedback') {
    $adminEmail = ResponseBuilder::buildFeedbackAdminEmail($data, $uploaded, $esc, $nl2brSafe);
} else {
    $adminEmail = ResponseBuilder::buildAdminEmail($data, $uploaded, $esc, $nl2brSafe);
}
$subject = $adminEmail['subject'];
$adminHtml = $adminEmail['html'];
$adminText = $adminEmail['text'];
$filesCount = count($uploaded);

$recipientCandidates = [];
if ($formType === 'proposal') {
    $recipientCandidates = ADMIN_EMAILS_PROPOSAL ?: ADMIN_EMAILS;
} elseif ($formType === 'feedback') {
    $recipientCandidates = ADMIN_EMAILS_FEEDBACK ?: ADMIN_EMAILS;
} else {
    $recipientCandidates = ADMIN_EMAILS_RESUME ?: ADMIN_EMAILS;
}

$validRecipients = [];
foreach ($recipientCandidates as $email) {
    $email = trim($email);
    if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $validRecipients[] = $email;
    } else {
        Logger::warning('Invalid admin email skipped', ['email' => $email], 'forms');
    }
}

if (empty($validRecipients)) {
    foreach ($uploaded as $f) @unlink(rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $f['saved']);
    $uploaded = [];
    Logger::error('No valid admin recipients configured', ['form_type' => $formType], 'forms');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Не настроен получатель письма. Обратитесь к администратору.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$mail = new SentPHPMailer(true);

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

    foreach ($validRecipients as $email) {
        $mail->addAddress($email);
    }

    if (!empty($data['email']) && is_string($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $replyName = $data['contact'] ?? $data['fullName'] ?? '';
        $mail->addReplyTo($data['email'], $replyName);
    }

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $adminHtml;
    $mail->AltBody = $adminText;

    foreach ($uploaded as $f) {
        $filePath = rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $f['saved'];
        if (file_exists($filePath)) $mail->addAttachment($filePath, $f['original']);
        else Logger::error('Attachment file not found', ['path' => $filePath], 'forms');
    }

    $mail->send();
    // [SEC] Не логируем сами адреса — только количество получателей.
    Logger::info('Admin email sent successfully', [
        'recipients_count' => count($validRecipients),
        'subject'          => $mail->Subject,
        'files_count'      => $filesCount
    ], 'forms');

    if (!empty($data['email']) && is_string($data['email']) && filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        try {
            $mail->clearAddresses();
            $mail->clearAttachments();
            // [FIX] Сбрасываем Reply-To клиента, чтобы автоответ клиенту не уходил ему же.
            $mail->clearReplyTos();
            $mail->addAddress($data['email']);

            $clientReply = ResponseBuilder::buildClientAutoReply($data, FROM_NAME, $esc, $sentiment);
            $mail->Subject = $clientReply['subject'];
            $mail->Body    = $clientReply['html'];
            $mail->AltBody = $clientReply['text'];

            $mail->saveToSent = false;
            $mail->send();
            Logger::info('Client confirmation sent', ['form_type' => $formType, 'sentiment' => $sentiment], 'forms');
        } catch (Exception $e) {
            Logger::warning('Client confirmation failed', ['error_info' => $mail->ErrorInfo], 'forms');
        }
    }

    foreach ($uploaded as $f) {
        @unlink(rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $f['saved']);
        Logger::debug('Temporary file deleted', ['file' => $f['saved']], 'forms');
    }
    $uploaded = [];

    Logger::info('Form successfully submitted', ['form_type' => $formType, 'files_count' => $filesCount], 'forms');

    echo json_encode([
        'success'    => true,
        'message'    => ResponseBuilder::getSuccessMessage($formType, $data),
        'form_type'  => $formType,
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    foreach ($uploaded as $f) @unlink(rtrim(UPLOAD_DIR, '/\\') . DIRECTORY_SEPARATOR . $f['saved']);
    $uploaded = [];
    Logger::error('PHPMailer send failed', [
        'error_info' => $mail->ErrorInfo,
        'form_type'  => $formType,
        'recipients_count' => count($validRecipients)
    ], 'forms');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Ошибка отправки письма. Попробуйте позже.'], JSON_UNESCAPED_UNICODE);
}