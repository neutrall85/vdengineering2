<?php
/**
 * Текстовый логгер с ротацией по дням
 * ООО "Волга-Днепр Инжиниринг"
 */
class Logger {

    private static $logDir;
    private static $requestId;
    private static $initialized = false;

    private const MAX_STRING_LENGTH = 500;
    private const MAX_USER_AGENT_LENGTH = 200;
    private const REQUEST_ID_BYTES = 8;

    public static function init($dir = null) {
        if (self::$initialized) return;

        self::$logDir = $dir ?? __DIR__ . '/../logs';

        if (!is_dir(self::$logDir)) {
            if (!mkdir(self::$logDir, 0755, true) && !is_dir(self::$logDir)) {
                error_log("Logger: failed to create log directory: " . self::$logDir);
                return;
            }
        }

        self::$requestId = substr(bin2hex(random_bytes(self::REQUEST_ID_BYTES)), 0, 16);
        self::$initialized = true;
    }

    public static function getRequestId() {
        return self::$requestId ?? 'unknown';
    }

    public static function info($message, array $context = []) {
        self::write('INFO', $message, $context);
    }

    public static function warning($message, array $context = []) {
        self::write('WARNING', $message, $context);
    }

    public static function error($message, array $context = []) {
        self::write('ERROR', $message, $context);
    }

    public static function debug($message, array $context = []) {
        // [FIX-P0] Корректная проверка APP_DEBUG: строка "false" → boolean false
        $debug = filter_var(
            getenv('APP_DEBUG') ?: ($_ENV['APP_DEBUG'] ?? 'false'),
            FILTER_VALIDATE_BOOLEAN
        );
        if (!$debug) return;
        self::write('DEBUG', $message, $context);
    }

    /**
     * [FIX-P0] Убирает переносы строк — защита от Log Injection.
     * Атакующий не может внедрить фейковую строку лога через \r или \n.
     */
    private static function sanitizeLogString(string $s): string {
        return strtr($s, ["\r" => '\r', "\n" => '\n']);
    }

    /**
     * Запись лога в плоском текстовом формате с ротацией по дням
     */
    private static function write($level, $message, array $context = []) {
        if (!self::$initialized) {
            self::init();
            if (!self::$initialized) {
                error_log("[$level] $message");
                return;
            }
        }

        $sanitizedContext = self::sanitizeContext($context);

        $ip     = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $url    = $_SERVER['REQUEST_URI'] ?? '-';

        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        if (mb_strlen($ua, 'UTF-8') > self::MAX_USER_AGENT_LENGTH) {
            $ua = mb_substr($ua, 0, self::MAX_USER_AGENT_LENGTH, 'UTF-8') . '…';
        }

        $contextStr  = self::formatContext($sanitizedContext);
        $timestamp   = date('Y-m-d\TH:i:sP');
        // [FIX-P0] Санитизируем message перед записью в лог
        $safeMessage = self::sanitizeLogString($message);

        $line = sprintf(
            "[%s] [%-7s] [req_%s] %s %s %s — %s%s\n",
            $timestamp,
            $level,
            self::$requestId,
            $ip,
            $method,
            $url,
            $safeMessage,
            $contextStr ? ' | ' . $contextStr : ''
        );

        // ========== РОТАЦИЯ ПО ДНЯМ ==========
        $dateSuffix = date('Y-m-d');
        $baseName = 'app';
        if ($level === 'ERROR') {
            $baseName = 'error';
        } elseif ($level === 'WARNING') {
            $baseName = 'warning';
        }
        $file = self::$logDir . '/' . $baseName . '-' . $dateSuffix . '.log';
        // ======================================

        $bytes = file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
        if ($bytes === false) {
            error_log("Logger: failed to write to $file");
        }
    }

    /**
     * Форматирует контекст в читаемую строку
     */
    private static function formatContext(array $context) {
        $parts = [];
        foreach ($context as $key => $value) {
            $formatted = self::formatValue($value);
            $parts[] = "$key=$formatted";
        }
        return implode(', ', $parts);
    }

    /**
     * Форматирует одно значение
     */
    private static function formatValue($value) {
        if ($value === null) return 'null';
        if (is_bool($value)) return $value ? 'true' : 'false';
        if (is_int($value) || is_float($value)) return (string)$value;

        if (is_string($value)) {
            // [FIX-P0] Санитизируем строки контекста от переносов строк
            $value = self::sanitizeLogString($value);
            if (preg_match('/[\s,"\']/', $value) || $value === '') {
                return '"' . addcslashes($value, '"\\') . '"';
            }
            return $value;
        }

        if (is_array($value)) {
            if (empty($value)) return '[]';
            if (array_keys($value) === range(0, count($value) - 1)) {
                return '[array:' . count($value) . ']';
            }
            $inner = [];
            foreach ($value as $k => $v) {
                if (is_scalar($v) || $v === null) {
                    $inner[] = "$k=" . self::formatValue($v);
                } else {
                    $inner[] = "$k=" . gettype($v);
                }
            }
            return '{' . implode(', ', $inner) . '}';
        }

        if (is_object($value)) return '[object:' . get_class($value) . ']';
        return '[' . gettype($value) . ']';
    }

    /**
     * Очистка контекста от чувствительных данных
     */
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