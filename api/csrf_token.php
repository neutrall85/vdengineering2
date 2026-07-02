<?php
// api/csrf_token.php — выдача CSRF-токена
require_once __DIR__ . '/secret_config.php'; // Подключаем конфиг (сессия уже стартована безопасно)

// Все заголовки — ДО любого вывода
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate');
header('Pragma: no-cache');
header('Expires: 0');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header_remove('X-Powered-By');

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
session_write_close();

echo json_encode([
    'csrf_token' => $_SESSION['csrf_token'],
    'expires_in' => max(0, $remaining)
], JSON_UNESCAPED_UNICODE);