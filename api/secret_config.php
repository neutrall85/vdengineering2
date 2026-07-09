<?php
/**
 * secret_config.php — ТОЛЬКО конфигурация
 * Определяет константы, пути, загружает .env
 */

// ---- HTTP-заголовки безопасности ----
header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');

// ---- Загрузка .env ----
require_once __DIR__ . '/env_loader.php';

// ---- Корень сайта (исправлено для вашего хостинга) ----
$siteRoot = dirname($_SERVER['DOCUMENT_ROOT']);

// ---- Пути к служебным папкам (явно задаём абсолютные пути) ----
define('LOG_DIR', '/var/www/normacode_ru_usr/data/logs/');
define('RATE_DIR', '/var/www/normacode_ru_usr/data/rate/');
define('UPLOAD_DIR', '/var/www/normacode_ru_usr/data/private_uploads/');
define('SESSION_DIR', '/var/www/normacode_ru_usr/data/sessions/');

// Остальные константы (логи по типам)
define('CONSENT_LOG_DIR',          LOG_DIR . 'consent/');
define('PERSONAL_CONSENT_LOG_DIR', CONSENT_LOG_DIR . 'personal/');
define('COOKIE_CONSENT_LOG_DIR',   CONSENT_LOG_DIR . 'cookies/');

define('LOG_FORMS_DIR',    LOG_DIR . 'forms/');
define('LOG_ERRORS_DIR',   LOG_DIR . 'errors/');
define('LOG_ACCESS_DIR',   LOG_DIR . 'access/');
define('LOG_SMTP_DIR',     LOG_DIR . 'smtp/');
define('LOG_UPLOADS_DIR',  LOG_DIR . 'uploads/');

// ---- Функция env() ----
function env(string $key, bool $required = true): ?string {
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
    if ($value === false) $value = null;
    if ($required && ($value === null || $value === '')) {
        throw new \Exception("Missing required environment variable: $key");
    }
    return $value;
}

// ---- SMTP ----
define('SMTP_HOST',   env('SMTP_HOST'));
define('SMTP_PORT',   (int)env('SMTP_PORT'));
define('SMTP_SECURE', env('SMTP_SECURE'));
define('SMTP_AUTH',   env('SMTP_AUTH', false) !== 'false');
define('SMTP_USER',   env('SMTP_USER'));
define('SMTP_PASS',   env('SMTP_PASS'));

// ---- Отправитель ----
define('FROM_EMAIL', env('FROM_EMAIL'));
define('FROM_NAME',  env('FROM_NAME'));

// ---- Администраторы ----
$adminProposal = env('ADMIN_EMAILS_PROPOSAL');
$adminResume   = env('ADMIN_EMAILS_RESUME');
$adminFeedback = env('ADMIN_EMAILS_FEEDBACK');

define('ADMIN_EMAILS_PROPOSAL', array_values(array_filter(array_map('trim', explode(',', $adminProposal)))));
define('ADMIN_EMAILS_RESUME',   array_values(array_filter(array_map('trim', explode(',', $adminResume)))));
define('ADMIN_EMAILS_FEEDBACK', array_values(array_filter(array_map('trim', explode(',', $adminFeedback)))));

$adminAll = env('ADMIN_EMAILS', false);
define('ADMIN_EMAILS', $adminAll ? array_values(array_filter(array_map('trim', explode(',', $adminAll)))) : []);

// ---- Лимиты ----
define('MAX_FILE_SIZE',     (int)(env('MAX_FILE_SIZE', false) ?: 24 * 1024 * 1024));
define('MAX_TOTAL_SIZE',    (int)(env('MAX_TOTAL_SIZE', false) ?: 24 * 1024 * 1024));
define('MAX_FILES',         (int)(env('MAX_FILES', false) ?: 10));
define('RATE_LIMIT_MAX',    (int)(env('RATE_LIMIT_MAX', false) ?: 5));
define('RATE_LIMIT_WINDOW', (int)(env('RATE_LIMIT_WINDOW', false) ?: 60));

// ---- Разрешённые расширения и MIME ----
$allowedExts = env('ALLOWED_EXTENSIONS', false);
define('ALLOWED_EXTENSIONS', $allowedExts ? array_map('trim', explode(',', $allowedExts)) : [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'gif'
]);

$allowedMimes = env('ALLOWED_MIME_TYPES', false);
define('ALLOWED_MIME_TYPES', $allowedMimes ? array_map('trim', explode(',', $allowedMimes)) : [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/gif'
]);

// ---- Настройки PHP ----
ini_set('memory_limit', '256M');
ini_set('max_execution_time', 120);

// ---- Создание директорий ----
foreach ([
    LOG_FORMS_DIR, LOG_ERRORS_DIR, LOG_ACCESS_DIR, LOG_SMTP_DIR, LOG_UPLOADS_DIR,
    CONSENT_LOG_DIR, RATE_DIR, UPLOAD_DIR, SESSION_DIR
] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
}

// ---- Настройки сессии ----
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443)
    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', $isHttps ? 1 : 0);
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_samesite', 'Strict');
ini_set('session.use_only_cookies', 1);

session_save_path(SESSION_DIR);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}