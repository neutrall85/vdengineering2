<?php
/**
 * API для сохранения согласия на использование cookies
 * ООО "ВД Инжиниринг"
 */
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once __DIR__ . '/Logger.php';
require_once __DIR__ . '/secret_config.php';
Logger::init(LOG_DIR);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'application/json') === false) {
    http_response_code(415);
    echo json_encode(['success' => false, 'error' => 'Unsupported Media Type']);
    exit;
}

if (!is_same_origin_request()) {
    Logger::warning('Cookie consent: same-origin check failed', [
        'origin'  => $_SERVER['HTTP_ORIGIN'] ?? '',
        'referer' => $_SERVER['HTTP_REFERER'] ?? '',
    ]);
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

// [SEC] Строгий whitelist для consent_type
$consentType = $input['consent_type'] ?? '';
$allowedConsentTypes = ['all', 'analytics', 'functional'];
if (!in_array($consentType, $allowedConsentTypes, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid consent_type']);
    exit;
}

// [SEC] Whitelist версий — раньше писалось что угодно (до 20 символов).
$allowedVersions = ['2.0', '3.0'];
$versionRaw = (string)($input['version'] ?? '3.0');
$version = in_array($versionRaw, $allowedVersions, true) ? $versionRaw : '3.0';

$url = mb_substr((string)($input['url'] ?? ($_SERVER['HTTP_REFERER'] ?? '')), 0, 500, 'UTF-8');
if ($url !== '' && !preg_match('#^https?://#i', $url)) {
    $url = '';
}

// [SEC] Вместо session_id и IP пишем хеши — устраняем утечку ПДн из логов.
$sessionIdHash = pseudonymize(session_id());
session_write_close();

$userAgent = mb_substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200, 'UTF-8');

$entry = [
    'timestamp'       => date('Y-m-d H:i:s'),
    'session_id_hash' => $sessionIdHash,
    'ip_hash'         => pseudonymize(get_client_ip()),
    'user_agent'      => $userAgent,
    'consent_type'    => $consentType,
    'version'         => $version,
    'url'             => $url,
    'source'          => 'cookie_banner'
];

$logDir = COOKIE_CONSENT_LOG_DIR;
if (!is_dir($logDir)) {
    mkdir($logDir, 0700, true);
}

$logFile = $logDir . 'cookie-consent-' . date('Y-m-d') . '.log';

// Защита от переполнения диска: не пишем, если эта сессия уже есть в последних 10 КБ
$alreadyLogged = false;
$needle = '"session_id_hash":"' . $sessionIdHash . '"';
if (file_exists($logFile)) {
    $handle = fopen($logFile, 'r');
    if ($handle) {
        $size = filesize($logFile);
        $readSize = min($size, 10240);
        if ($readSize > 0) {
            fseek($handle, -$readSize, SEEK_END);
            $tail = fread($handle, $readSize);
            if (strpos($tail, $needle) !== false) {
                $alreadyLogged = true;
            }
        }
        fclose($handle);
    }
}

if (!$alreadyLogged) {
    file_put_contents(
        $logFile,
        json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
    @chmod($logFile, 0600);
}

Logger::info('Cookie consent logged', ['type' => $consentType]);

echo json_encode(['success' => true]);
exit;