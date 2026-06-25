<?php
/**
 * env_loader.php — мини-парсер .env с проверкой обязательных переменных
 */

function loadEnv($path) {
    if (!file_exists($path) || !is_readable($path)) {
        return false;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return false;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) continue;
        if (strpos($line, '=') === false) continue;

        [$name, $value] = array_pad(explode('=', $line, 2), 2, '');
        $name  = trim($name);
        $value = trim($value);

        // Убираем обрамляющие кавычки
        if (strlen($value) >= 2) {
            $first = $value[0];
            $last  = $value[strlen($value) - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
        }

        // [FIX] Заполняем все три источника для максимальной совместимости
        if ($name !== '') {
            putenv("$name=$value");
            $_ENV[$name]    = $value;
            $_SERVER[$name] = $value;
        }
    }
    return true;
}

// Пути поиска .env
$possiblePaths = [
    __DIR__ . '/../.env',
    __DIR__ . '/.env',
    dirname($_SERVER['DOCUMENT_ROOT'] ?? '') . '/.env',
];

$envLoaded = false;
$loadedFrom = null;
foreach ($possiblePaths as $path) {
    if (loadEnv($path)) {
        $envLoaded = true;
        $loadedFrom = $path;
        break;
    }
}

// [FIX] Единая функция логирования (если Logger ещё не инициализирован — в error_log)
$envLog = static function (string $level, string $msg, array $ctx = []) {
    if (class_exists('Logger') && method_exists('Logger', strtolower($level))) {
        Logger::$level($msg, $ctx);
    } else {
        error_log("[$level] $msg" . ($ctx ? ' ' . json_encode($ctx, JSON_UNESCAPED_UNICODE) : ''));
    }
};

if (!$envLoaded) {
    $envLog('warning', '.env file not found', ['searched' => $possiblePaths]);
} else {
    $envLog('debug', '.env loaded', ['path' => $loadedFrom]);
}

// Проверка обязательных переменных
$requiredVars = ['SMTP_USER', 'SMTP_PASS'];
$missing = [];
foreach ($requiredVars as $var) {
    $v = getenv($var);
    if ($v === false || $v === '') {
        $v = $_ENV[$var] ?? ($_SERVER[$var] ?? null);
        if ($v === null || $v === '') {
            $missing[] = $var;
        }
    }
}

if (!empty($missing)) {
    $envLog('warning', 'Missing required env variables', ['missing' => $missing]);
}