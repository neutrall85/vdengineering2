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
        
        if (strlen($value) >= 2) {
            $first = $value[0];
            $last  = $value[strlen($value) - 1];
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                $value = substr($value, 1, -1);
            }
        }
        
        if ($name !== '') {
            if (function_exists('putenv')) {
                @putenv("$name=$value");
            }
            $_ENV[$name]    = $value;
            $_SERVER[$name] = $value;
        }
    }
    return true;
}

$docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
$basePath = dirname($docRoot);

$possiblePaths = [
    $basePath . '/.env',
    __DIR__ . '/../.env',
    __DIR__ . '/.env',
    dirname(__DIR__, 2) . '/www/.env',
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

// Используем error_log, а не Logger
// if (!$envLoaded) {
//     error_log("[WARNING] .env file not found, searched: " . json_encode($possiblePaths));
// } else {
//     error_log("[DEBUG] .env loaded from: $loadedFrom");
// }

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
    error_log("[WARNING] Missing required env variables: " . json_encode($missing));
}