<?php
/**
 * [P0-FIX] Cron-скрипт для ротации логов и очистки временных файлов.
 *
 * Установка в crontab:
 *   0 3 * * * php /path/to/api/cron/cleanup.php
 *
 * [FIX] Логика очистки:
 *   - логи в корне LOG_DIR — 30 дней;
 *   - логи в каналах (forms/, error_reports/ и т.п.) — 90 дней;
 *   - логи согласий — 3 года (152-ФЗ);
 *   - rate-файлы — 24 часа;
 *   - сессии — 24 часа (страховка для gc);
 *   - вложения в UPLOAD_DIR — 24 часа (если процесс был убит и файл не удалился).
 */

$configPath = __DIR__ . '/../secret_config.php';
if (!is_readable($configPath)) {
    fwrite(STDERR, "[cleanup] secret_config.php not readable: $configPath\n");
    exit(1);
}
require_once __DIR__ . '/../Logger.php';
require_once $configPath;

Logger::init(LOG_DIR);

// Периоды хранения (секунды)
const RETENTION_LOGS_ROOT    = 30 * 86400;
const RETENTION_LOGS_CHANNEL = 90 * 86400;
const RETENTION_CONSENT      = 3 * 365 * 86400;
const RETENTION_RATE         = 86400;
const RETENTION_SESSION      = 86400;
const RETENTION_UPLOAD       = 86400;

/**
 * [FIX] Обёртка над glob(): в PHP 8 glob() возвращает false при пустой
 * или несуществующей директории. foreach (false) даёт Warning.
 * Здесь гарантированно возвращаем массив.
 */
function safeGlob(string $pattern): array {
    $result = @glob($pattern);
    return is_array($result) ? $result : [];
}

/**
 * Удаляет файлы по маске старше $maxAge секунд.
 * Возвращает количество удалённых файлов.
 */
function purgeOldFiles(string $pattern, int $maxAge, int $now): int {
    $deleted = 0;
    foreach (safeGlob($pattern) as $file) {
        if (is_file($file) && filemtime($file) < $now - $maxAge) {
            @unlink($file);
            $deleted++;
        }
    }
    return $deleted;
}

// [FIX] Защита от параллельного запуска (double-run cron).
$lockFile = rtrim(LOG_DIR, '/\\') . DIRECTORY_SEPARATOR . 'cleanup.lock';
$lockFp = @fopen($lockFile, 'c');
if (!$lockFp || !flock($lockFp, LOCK_EX | LOCK_NB)) {
    fwrite(STDERR, "[cleanup] already running, skip\n");
    exit(0);
}

$now = time();

$deletedLogs     = 0;
$deletedRates    = 0;
$deletedSessions = 0;
$deletedUploads  = 0;

// Логи в корне LOG_DIR
$deletedLogs += purgeOldFiles(LOG_DIR . '*.log', RETENTION_LOGS_ROOT, $now);

// Логи в подпапках (forms/, error_reports/, cron/ и др.)
$deletedLogs += purgeOldFiles(LOG_DIR . '*/*.log', RETENTION_LOGS_CHANNEL, $now);

// Логи согласий — 3 года (152-ФЗ требует хранения)
$deletedLogs += purgeOldFiles(CONSENT_LOG_DIR . '*/*.log', RETENTION_CONSENT, $now);

// Rate-файлы
$deletedRates = purgeOldFiles(RATE_DIR . '*', RETENTION_RATE, $now);

// [FIX] Сессии. Начиная с PHP 7.1 session.sid_prefix по умолчанию пустая,
// поэтому файлы называются просто <hash>, а не sess_<hash>.
// SESSION_DIR выделен исключительно под сессии (см. secret_config.php),
// поэтому безопасно чистить всё содержимое директории.
// Lock-файл cleanup.lock живёт в LOG_DIR, сюда не попадает.
$deletedSessions = purgeOldFiles(SESSION_DIR . '*', RETENTION_SESSION, $now);

// [FIX] Временные вложения. submit.php удаляет их после отправки письма,
// но при убийстве процесса (OOM, php-fpm restart, fatal) файл остаётся.
// Через 24 часа удаляем принудительно — это и защита диска, и приватность ПДн.
$deletedUploads = purgeOldFiles(UPLOAD_DIR . '*', RETENTION_UPLOAD, $now);

Logger::info('Cleanup done', [
    'logs'     => $deletedLogs,
    'uploads'  => $deletedUploads,
    'rate'     => $deletedRates,
    'sessions' => $deletedSessions,
], 'cron');

flock($lockFp, LOCK_UN);
fclose($lockFp);