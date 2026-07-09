<?php
/**
 * Текстовый логгер с ротацией по дням и поддержкой каналов
 * ООО "Волга-Днепр Инжиниринг"
 */
class Logger {
    private static $logDir;
    private static $requestId;
    private static $initialized = false;
    private static $fallbackToErrorLog = false;

    private const MAX_STRING_LENGTH = 500;
    private const MAX_USER_AGENT_LENGTH = 200;
    private const REQUEST_ID_BYTES = 8;

    public static function init($dir = null) {
        if (self::$initialized) return;

        // Приоритет: константа LOG_DIR (если определена)
        if (defined('LOG_DIR') && LOG_DIR) {
            self::$logDir = rtrim(LOG_DIR, '/\\') . DIRECTORY_SEPARATOR;
        } elseif ($dir !== null) {
            self::$logDir = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR;
        } else {
            self::$logDir = __DIR__ . '/../logs/';
        }

        if (!is_dir(self::$logDir)) {
            if (!@mkdir(self::$logDir, 0755, true)) {
                self::$fallbackToErrorLog = true;
                error_log("Logger: cannot create log directory " . self::$logDir . ", falling back to error_log");
                self::$logDir = '';
            }
        } elseif (!is_writable(self::$logDir)) {
            self::$fallbackToErrorLog = true;
            error_log("Logger: log directory " . self::$logDir . " is not writable, falling back to error_log");
            self::$logDir = '';
        }

        self::$requestId = substr(bin2hex(random_bytes(self::REQUEST_ID_BYTES)), 0, 16);
        self::$initialized = true;
    }

    public static function getRequestId() {
        return self::$requestId ?? 'unknown';
    }

    public static function info($message, array $context = [], ?string $channel = null) {
        self::write('INFO', $message, $context, $channel);
    }
    public static function warning($message, array $context = [], ?string $channel = null) {
        self::write('WARNING', $message, $context, $channel);
    }
    public static function error($message, array $context = [], ?string $channel = null) {
        self::write('ERROR', $message, $context, $channel);
    }
    public static function debug($message, array $context = [], ?string $channel = null) {
        $debug = filter_var(getenv('APP_DEBUG') ?: ($_ENV['APP_DEBUG'] ?? 'false'), FILTER_VALIDATE_BOOLEAN);
        if (!$debug) return;
        self::write('DEBUG', $message, $context, $channel);
    }

    private static function sanitizeLogString(string $s): string {
        return strtr($s, ["\r" => '\r', "\n" => '\n']);
    }

    private static function write($level, $message, array $context = [], ?string $channel = null) {
        if (!self::$initialized) self::init();

        if (self::$fallbackToErrorLog || empty(self::$logDir)) {
            error_log(sprintf("[%s] [%s] %s %s", date('Y-m-d H:i:s'), $level, $message, json_encode($context, JSON_UNESCAPED_UNICODE)));
            return;
        }

        $sanitizedContext = self::sanitizeContext($context);
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $url = $_SERVER['REQUEST_URI'] ?? '-';
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        if (mb_strlen($ua, 'UTF-8') > self::MAX_USER_AGENT_LENGTH) {
            $ua = mb_substr($ua, 0, self::MAX_USER_AGENT_LENGTH, 'UTF-8') . '…';
        }
        $contextStr = self::formatContext($sanitizedContext);
        $timestamp = date('Y-m-d\TH:i:sP');
        $safeMessage = self::sanitizeLogString($message);
        $line = sprintf(
            "[%s] [%-7s] [req_%s] %s %s %s — %s%s\n",
            $timestamp, $level, self::$requestId, $ip, $method, $url, $safeMessage,
            $contextStr ? ' | ' . $contextStr : ''
        );

        $dateSuffix = date('Y-m-d');
        $baseName = ($level === 'ERROR') ? 'error' : (($level === 'WARNING') ? 'warning' : 'app');

        $targetDir = self::$logDir;
        if ($channel !== null && $channel !== '') {
            $safeChannel = preg_replace('/[^a-zA-Z0-9_\-]/', '', $channel);
            if ($safeChannel !== '') {
                $targetDir = self::$logDir . $safeChannel . DIRECTORY_SEPARATOR;
                if (!is_dir($targetDir)) @mkdir($targetDir, 0755, true);
            }
        }
        $file = $targetDir . $baseName . '-' . $dateSuffix . '.log';
        $result = file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
        if ($result === false) {
            error_log("Logger: failed to write to $file");
            error_log(sprintf("[%s] [%s] %s %s", date('Y-m-d H:i:s'), $level, $message, json_encode($context, JSON_UNESCAPED_UNICODE)));
        }
    }

    private static function formatContext(array $context) {
        $parts = [];
        foreach ($context as $key => $value) {
            $parts[] = "$key=" . self::formatValue($value);
        }
        return implode(', ', $parts);
    }

    private static function formatValue($value) {
        if ($value === null) return 'null';
        if (is_bool($value)) return $value ? 'true' : 'false';
        if (is_int($value) || is_float($value)) return (string)$value;
        if (is_string($value)) {
            $value = self::sanitizeLogString($value);
            return preg_match('/[\s,"\']/', $value) || $value === '' ? '"' . addcslashes($value, '"\\') . '"' : $value;
        }
        if (is_array($value)) {
            if (empty($value)) return '[]';
            if (array_keys($value) === range(0, count($value)-1)) return '[array:' . count($value) . ']';
            $inner = [];
            foreach ($value as $k => $v) {
                $inner[] = "$k=" . (is_scalar($v) || $v === null ? self::formatValue($v) : gettype($v));
            }
            return '{' . implode(', ', $inner) . '}';
        }
        if (is_object($value)) return '[object:' . get_class($value) . ']';
        return '[' . gettype($value) . ']';
    }

    private static function sanitizeContext(array $context) {
        $sensitiveKeys = ['password', 'token', 'csrf', 'secret', 'session_id', 'cookie', 'pass', 'smtp_pass'];
        array_walk_recursive($context, function (&$value, $key) use ($sensitiveKeys) {
            if (is_string($key)) {
                foreach ($sensitiveKeys as $sensitive) {
                    if (stripos($key, $sensitive) !== false) {
                        $value = '***REDACTED***';
                        return;
                    }
                }
            }
            if (is_string($value) && mb_strlen($value, 'UTF-8') > self::MAX_STRING_LENGTH) {
                $value = mb_substr($value, 0, self::MAX_STRING_LENGTH, 'UTF-8') . '...[truncated]';
            }
        });
        return $context;
    }
}