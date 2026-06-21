<?php
// api/csrf_token.php — выдача CSRF-токена

// Все заголовки — ДО любого вывода
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header_remove('X-Powered-By');

// Старт сессии
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

    ini_set('session.cookie_httponly', 1);
    ini_set('session.cookie_secure', $isHttps ? 1 : 0);
    ini_set('session.use_strict_mode', 1);
    ini_set('session.cookie_samesite', 'Strict');

    session_start();
}

// [FIX-P0] Токен живёт 1 час. Регенерируем только если его нет или он истёк.
// Это позволяет открывать форму в нескольких вкладках одновременно.
$ttl      = 3600;
$now      = time();
$issuedAt = $_SESSION['csrf_token_time'] ?? 0;

if (empty($_SESSION['csrf_token']) || ($now - $issuedAt) > $ttl) {
    $_SESSION['csrf_token']      = bin2hex(random_bytes(32));
    $_SESSION['csrf_token_time'] = $now;
}

$remaining = $ttl - ($now - $_SESSION['csrf_token_time']);

echo json_encode([
    'csrf_token' => $_SESSION['csrf_token'],
    'expires_in' => max(0, $remaining)
], JSON_UNESCAPED_UNICODE);