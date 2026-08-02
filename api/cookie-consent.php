<?php
/**
 * API для сохранения согласия на использование cookies
 * ООО "ВД Инжиниринг"
 */
// Настройка ошибок
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Подключаем конфиги и логгер
require_once __DIR__ . '/Logger.php';
require_once __DIR__ . '/secret_config.php';
Logger::init(LOG_DIR);

// Заголовки
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Разрешаем только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Получаем данные
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

// Проверяем обязательные поля
$consentType = $input['consent_type'] ?? ''; // 'all', 'analytics', 'functional'
$version = $input['version'] ?? '2.0';
$url = $input['url'] ?? ($_SERVER['HTTP_REFERER'] ?? '');

if (empty($consentType)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing consent_type']);
    exit;
}

// Получаем идентификатор сессии
$sessionId = session_id();
session_write_close();

// Формируем запись
$entry = [
    'timestamp'     => date('Y-m-d H:i:s'),
    'session_id'    => $sessionId,
    'ip'            => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
    'user_agent'    => $_SERVER['HTTP_USER_AGENT'] ?? '',
    'consent_type'  => $consentType,
    'version'       => $version,
    'url'           => $url,
    'source'        => 'cookie_banner'
];

// Создаём директорию для логов cookies
$logDir = COOKIE_CONSENT_LOG_DIR;
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$logFile = $logDir . 'cookie-consent-' . date('Y-m-d') . '.log';

// [FIX] Защита от переполнения диска/Inode на Timeweb: 
// не пишем в лог, если эта сессия уже есть в последних записях за сегодня
$alreadyLogged = false;
if (file_exists($logFile)) {
    $handle = fopen($logFile, 'r');
    if ($handle) {
        $size = filesize($logFile);
        $readSize = min($size, 10240); // Читаем последние 10 КБ файла
        if ($readSize > 0) {
            fseek($handle, -$readSize, SEEK_END);
            $tail = fread($handle, $readSize);
            if (strpos($tail, $sessionId) !== false) {
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
}

// Логируем в основной лог
Logger::info('Cookie consent logged', ['type' => $consentType, 'ip' => $entry['ip']]);

// Возвращаем успех
echo json_encode(['success' => true]);
exit;