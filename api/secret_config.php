<?php
// secret_config.php — централизованный конфиг

// ---- HTTP-заголовки безопасности ----
header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');

require_once __DIR__ . '/env_loader.php';

// ---- Проверка расширений ----
if (!extension_loaded('mbstring')) {
    error_log('WARNING: mbstring extension is not loaded.');
}

// ---- SMTP ----
define('SMTP_HOST',   getenv('SMTP_HOST')   ?: 'smtp.mail.ru');
define('SMTP_PORT',   (int)(getenv('SMTP_PORT') ?: 465));
define('SMTP_SECURE', getenv('SMTP_SECURE') ?: 'ssl');
define('SMTP_AUTH',   getenv('SMTP_AUTH') !== 'false');

$smtp_user = getenv('SMTP_USER') ?: ($_ENV['SMTP_USER'] ?? '');
$smtp_pass = getenv('SMTP_PASS') ?: ($_ENV['SMTP_PASS'] ?? '');
$admin_emails_string = getenv('ADMIN_EMAILS') ?: ($_ENV['ADMIN_EMAILS'] ?? '');
$admin_proposal_string = getenv('ADMIN_EMAILS_PROPOSAL') ?: ($_ENV['ADMIN_EMAILS_PROPOSAL'] ?? '');
$admin_resume_string   = getenv('ADMIN_EMAILS_RESUME')   ?: ($_ENV['ADMIN_EMAILS_RESUME'] ?? '');

$has_admin = !empty($admin_emails_string) || !empty($admin_proposal_string) || !empty($admin_resume_string);

if (empty($smtp_user) || empty($smtp_pass) || !$has_admin) {
    $isDebug = filter_var(
        getenv('APP_DEBUG') ?: ($_ENV['APP_DEBUG'] ?? 'false'),
        FILTER_VALIDATE_BOOLEAN
    );

    if (!$isDebug) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => false,
            'error'   => 'Сервис временно недоступен. Попробуйте позже.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    error_log("WARNING: Missing SMTP credentials or admin emails. Using dev fallback.");
    $smtp_user           = $smtp_user           ?: 'dev@example.com';
    $smtp_pass           = $smtp_pass           ?: 'dev';
    $admin_emails_string = $admin_emails_string ?: 'dev@example.com';
    $admin_proposal_string = $admin_proposal_string ?: 'dev@example.com';
    $admin_resume_string   = $admin_resume_string   ?: 'dev@example.com';
}

define('SMTP_USER', $smtp_user);
define('SMTP_PASS', $smtp_pass);
define('ADMIN_EMAILS', array_values(array_filter(array_map('trim', explode(',', $admin_emails_string)))));
define('ADMIN_EMAILS_PROPOSAL', array_values(array_filter(array_map('trim', explode(',', $admin_proposal_string)))));
define('ADMIN_EMAILS_RESUME',   array_values(array_filter(array_map('trim', explode(',', $admin_resume_string)))));

define('FROM_EMAIL', getenv('FROM_EMAIL') ?: $smtp_user);
define('FROM_NAME',  getenv('FROM_NAME')  ?: 'Волга-Днепр Инжиниринг');

// ---- ПУТИ ----
$basePath = dirname(__DIR__);
define('LOG_DIR',    rtrim($basePath, '/\\') . '/logs/');
define('RATE_DIR',   rtrim($basePath, '/\\') . '/data/');
define('UPLOAD_DIR', __DIR__ . '/../private_uploads/');

// ---- ЛИМИТЫ ----
define('MAX_TOTAL_SIZE', (int)(getenv('MAX_TOTAL_SIZE') ?: 24 * 1024 * 1024)); // 24 MB
define('MAX_FILES',      (int)(getenv('MAX_FILES')      ?: 10));
define('RATE_LIMIT_MAX',    (int)(getenv('RATE_LIMIT_MAX')    ?: 3));
define('RATE_LIMIT_WINDOW', (int)(getenv('RATE_LIMIT_WINDOW') ?: 10));

$allowedExts = getenv('ALLOWED_EXTENSIONS');
$allowedExts = $allowedExts
    ? array_map('trim', explode(',', $allowedExts))
    : ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'];
define('ALLOWED_EXTENSIONS', $allowedExts);

$allowedMimes = getenv('ALLOWED_MIME_TYPES');
$allowedMimes = $allowedMimes ? array_map('trim', explode(',', $allowedMimes)) : [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip'
];
define('ALLOWED_MIME_TYPES', $allowedMimes);

define('LOG_FILE', LOG_DIR . 'forms.log');

ini_set('memory_limit', '256M');
ini_set('max_execution_time', 120);

// ---- ПУТИ ДЛЯ ЛОГОВ СОГЛАСИЙ ----
define('CONSENT_LOG_DIR', LOG_DIR . 'consent/');
define('PERSONAL_CONSENT_LOG_DIR', CONSENT_LOG_DIR . 'personal/');
define('COOKIE_CONSENT_LOG_DIR', CONSENT_LOG_DIR . 'cookies/');

foreach ([CONSENT_LOG_DIR, PERSONAL_CONSENT_LOG_DIR, COOKIE_CONSENT_LOG_DIR] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
}

// ---- Сессия ----
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', $isHttps ? 1 : 0);
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_only_cookies', 1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}