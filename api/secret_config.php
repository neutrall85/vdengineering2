<?php
/**
 * secret_config.php — ТОЛЬКО конфигурация
 * ООО "ВД Инжиниринг"
 */

header_remove('X-Powered-By');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
header('X-Permitted-Cross-Domain-Policies: none');
header('Cross-Origin-Opener-Policy: same-origin-allow-popups');
header('Cross-Origin-Resource-Policy: same-site');

require_once __DIR__ . '/env_loader.php';

define('LOG_DIR',     '/var/www/vdengineering_usr/data/logs/');
define('RATE_DIR',    '/var/www/vdengineering_usr/data/rate/');
define('UPLOAD_DIR',  '/var/www/vdengineering_usr/data/private_uploads/');
define('SESSION_DIR', '/var/www/vdengineering_usr/data/sessions/');

define('CONSENT_LOG_DIR',          LOG_DIR . 'consent/');
define('PERSONAL_CONSENT_LOG_DIR', CONSENT_LOG_DIR . 'personal/');
define('COOKIE_CONSENT_LOG_DIR',   CONSENT_LOG_DIR . 'cookies/');

function env(string $key, bool $required = true): ?string {
    $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
    if ($value === false) $value = null;
    if ($required && ($value === null || $value === '')) {
        throw new \Exception("Missing required environment variable: $key");
    }
    return $value;
}

function sanitize_header_value($str, int $maxLen = 500): string {
    if (!is_string($str)) return '';
    $str = preg_replace('/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/u', ' ', $str);
    if (mb_strlen($str, 'UTF-8') > $maxLen) $str = mb_substr($str, 0, $maxLen, 'UTF-8');
    return trim($str);
}

// [SEC] Псевдонимизация ПДн для логов: одна и та же строка → один и тот же хеш
// при неизменной соли. Соль задаётся в .env как CONSENT_HASH_SALT.
// Не хранит исходные значения — устраняет утечку ПДн в файлах логов.
function pseudonymize(string $value): string {
    if ($value === '') return '';
    return substr(hash_hmac('sha256', $value, CONSENT_HASH_SALT), 0, 32);
}

/**
 * [SEC] Same-origin проверка с учётом scheme + host + port.
 * При TRUSTED_PROXY=true и заданном X-Forwarded-Proto учитывает реальную схему.
 */
function is_same_origin_request(): bool {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '') return false;

    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
        ? 'https' : 'http';

    $trustedProxy = filter_var(getenv('TRUSTED_PROXY') ?: 'false', FILTER_VALIDATE_BOOLEAN);
    if ($trustedProxy && (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')) {
        $scheme = 'https';
    }

    $expectedHost   = strtolower($host);
    $expectedOrigin = strtolower($scheme . '://' . $expectedHost);

    $check = static function (string $url) use ($expectedHost, $expectedOrigin): bool {
        $parts = parse_url($url);
        if (!$parts || empty($parts['host'])) return false;
        $origin = strtolower(($parts['scheme'] ?? '') . '://' . $parts['host']
            . (isset($parts['port']) ? ':' . $parts['port'] : ''));
        if ($origin === $expectedOrigin) return true;
        return strcasecmp($parts['host'], explode(':', $expectedHost)[0]) === 0;
    };

    if (!empty($_SERVER['HTTP_ORIGIN'])  && $check($_SERVER['HTTP_ORIGIN']))  return true;
    if (!empty($_SERVER['HTTP_REFERER']) && $check($_SERVER['HTTP_REFERER'])) return true;
    return false;
}

/**
 * [SEC] Возвращает реальный IP клиента с учётом trusted proxy.
 * TRUSTED_PROXIES — CSV-список доверенных адресов прокси.
 * Если список не задан, при TRUSTED_PROXY=true доверяем любому источнику
 * (обратная совместимость); рекомендуется задать список.
 */
function get_client_ip(): string {
    static $cached = null;
    if ($cached !== null) return $cached;

    $trustedProxy   = filter_var(getenv('TRUSTED_PROXY') ?: 'false', FILTER_VALIDATE_BOOLEAN);
    $trustedProxies = array_filter(array_map('trim', explode(',', getenv('TRUSTED_PROXIES') ?: '')));
    $remoteAddr     = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    $isTrusted = $trustedProxy
        && (empty($trustedProxies) || in_array($remoteAddr, $trustedProxies, true));

    if ($isTrusted) {
        $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
        if ($forwarded !== '') {
            foreach (array_map('trim', explode(',', $forwarded)) as $ip) {
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    $cached = $ip;
                    return $cached;
                }
            }
        }
        $realIp = $_SERVER['HTTP_X_REAL_IP'] ?? '';
        if ($realIp !== '' && filter_var($realIp, FILTER_VALIDATE_IP)) {
            $cached = $realIp;
            return $cached;
        }
    }

    $cached = $remoteAddr;
    return $cached;
}

// ---- Версия документов (юридически значимая) ----
define('CONSENT_VERSION',   env('CONSENT_VERSION',   false) ?: '2026-07-18');
define('CONSENT_HASH_SALT', env('CONSENT_HASH_SALT', false) ?: 'CHANGE_ME_VD_CONSENT_HASH_SALT');

// ---- SMTP ----
define('SMTP_HOST',   env('SMTP_HOST'));
define('SMTP_PORT',   (int)env('SMTP_PORT'));
define('SMTP_SECURE', env('SMTP_SECURE'));
define('SMTP_AUTH',   env('SMTP_AUTH', false) !== 'false');
define('SMTP_USER',   env('SMTP_USER'));
define('SMTP_PASS',   env('SMTP_PASS'));

// ---- IMAP ----
define('IMAP_HOST',        env('IMAP_HOST', false) ?: '');
define('IMAP_PORT',        (int)(env('IMAP_PORT', false) ?: 993));
define('IMAP_SECURE',      env('IMAP_SECURE', false) ?: 'ssl');
define('IMAP_USER',        env('IMAP_USER', false) ?: '');
define('IMAP_PASS',        env('IMAP_PASS', false) ?: '');
define('IMAP_SENT_FOLDER', env('IMAP_SENT_FOLDER', false) ?: 'Sent');
define('IMAP_FLAGS',       env('IMAP_FLAGS', false) ?: '');
// [SEC] По умолчанию проверяем сертификат IMAP. Отключать — только осознанно.
define('IMAP_VERIFY_CERT', filter_var(env('IMAP_VERIFY_CERT', false) ?: 'true', FILTER_VALIDATE_BOOLEAN));
define('IMAP_ENABLED',     IMAP_HOST !== '' && IMAP_USER !== '' && IMAP_PASS !== '');

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

$adminErrorEmail = env('ADMIN_ERROR_EMAIL', false);
define('ADMIN_ERROR_EMAIL', $adminErrorEmail ? array_values(array_filter(array_map('trim', explode(',', $adminErrorEmail)))) : []);

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

// [SEC] Права каталогов: логи — группе, приватные данные — только владельцу.
$dirModes = [
    LOG_DIR                  => 0750,
    RATE_DIR                 => 0750,
    UPLOAD_DIR               => 0700,
    SESSION_DIR              => 0700,
    CONSENT_LOG_DIR          => 0700,
    PERSONAL_CONSENT_LOG_DIR => 0700,
    COOKIE_CONSENT_LOG_DIR   => 0700,
];
foreach ($dirModes as $dir => $mode) {
    if (!is_dir($dir)) @mkdir($dir, $mode, true);
    @chmod($dir, $mode);
}

// ---- Настройки сессии ----
$trustedProxy = filter_var(getenv('TRUSTED_PROXY') ?: 'false', FILTER_VALIDATE_BOOLEAN);
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);

if (!$isHttps && $trustedProxy) {
    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    if ($forwardedProto === 'https') $isHttps = true;
}

ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', $isHttps ? 1 : 0);
ini_set('session.use_strict_mode', 1);
// [FIX] Lax вместо Strict — не ломает сессию при переходах с внешних сайтов.
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.use_only_cookies', 1);
ini_set('session.sid_length', 48);
ini_set('session.sid_bits_per_character', 6);
ini_set('session.gc_maxlifetime', 3600);

session_save_path(SESSION_DIR);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}