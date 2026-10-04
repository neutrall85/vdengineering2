<?php
// api/csrf_token.php — выдача CSRF-токена
require_once __DIR__ . '/secret_config.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header_remove('X-Powered-By');

// [SECURITY] Разрешаем только GET
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

// [SECURITY] Лёгкое ограничение: не выдаём токен чаще 1 раза в секунду на сессию.
// Защищает от флуда random_bytes и от образования тысяч сессий.
$now = time();
$lastIssued = $_SESSION['csrf_token_issued_at'] ?? 0;

$ttl      = 3600;
$issuedAt = $_SESSION['csrf_token_time'] ?? 0;
$shouldRegenerate = empty($_SESSION['csrf_token']) || ($now - $issuedAt) > $ttl;

if ($shouldRegenerate) {
    if ($now - $lastIssued < 1 && !empty($_SESSION['csrf_token'])) {
        // отдаём существующий токен — не генерируем новый
    } else {
        $_SESSION['csrf_token']           = bin2hex(random_bytes(32));
        $_SESSION['csrf_token_time']      = $now;
        $_SESSION['csrf_token_issued_at'] = $now;
        $issuedAt = $now;
    }
}

$remaining = max(0, $ttl - ($now - ($_SESSION['csrf_token_time'] ?? $now)));
$token = $_SESSION['csrf_token'];

session_write_close();

echo json_encode([
    'csrf_token' => $token,
    'expires_in' => $remaining
], JSON_UNESCAPED_UNICODE);