<?php
/**
 * API для приёма сообщений об ошибках (отдельный обработчик)
 * ООО "ВД Инжиниринг"
 *
 * ВЕРСИЯ С ИСПРАВЛЕНИЕМ: отправка на все адреса из ADMIN_ERROR_EMAIL (массив)
 */

ini_set('display_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

require_once __DIR__ . '/Logger.php';
require_once __DIR__ . '/secret_config.php';

Logger::init(LOG_DIR);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Только POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Метод не разрешён']);
    exit;
}

// Получаем JSON
$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Неверный формат данных']);
    exit;
}

// Проверяем, что это сообщение об ошибке
if (!isset($input['type']) || $input['type'] !== 'error_report') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Неверный тип запроса']);
    exit;
}

// Валидация данных
$selectedText = trim($input['selectedText'] ?? '');
$comment = trim($input['comment'] ?? '');
$url = trim($input['url'] ?? '');
$userAgent = trim($input['userAgent'] ?? '');

if (empty($selectedText)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Текст с ошибкой не может быть пустым']);
    exit;
}

// Rate limiting по IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateDir = RATE_DIR;
$rateFile = rtrim($rateDir, '/\\') . DIRECTORY_SEPARATOR . 'error_report_' . hash('sha256', $ip);
$now = time();
$window = 3600;
$maxRequests = 5;

if (!is_dir($rateDir)) {
    mkdir($rateDir, 0755, true);
}

$fp = @fopen($rateFile, 'c+');
if ($fp) {
    if (flock($fp, LOCK_EX)) {
        $content = stream_get_contents($fp);
        $requests = $content ? json_decode($content, true) : [];
        if (!is_array($requests)) $requests = [];
        $filtered = array_values(array_filter($requests, function($ts) use ($now, $window) {
            return is_numeric($ts) && $ts > $now - $window;
        }));
        if (count($filtered) >= $maxRequests) {
            flock($fp, LOCK_UN);
            fclose($fp);
            http_response_code(429);
            echo json_encode(['success' => false, 'error' => 'Слишком много запросов. Подождите час.']);
            exit;
        }
        $filtered[] = $now;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($filtered));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}

// Логируем (комментарий не логируем)
Logger::info('Error report received', [
    'ip' => $ip,
    'url' => $url,
    'selectedText_length' => mb_strlen($selectedText, 'UTF-8'),
], 'error_reports');

// ============================================================
// ПОЛУЧАЕМ СПИСОК ПОЛУЧАТЕЛЕЙ (ИСПРАВЛЕНИЕ)
// ============================================================
$recipients = [];

// 1. Если определён ADMIN_ERROR_EMAIL и это массив – используем его
if (defined('ADMIN_ERROR_EMAIL') && is_array(ADMIN_ERROR_EMAIL) && !empty(ADMIN_ERROR_EMAIL)) {
    $recipients = ADMIN_ERROR_EMAIL;
}
// 2. Если нет, пробуем ADMIN_EMAILS (общий список)
elseif (defined('ADMIN_EMAILS') && is_array(ADMIN_EMAILS) && !empty(ADMIN_EMAILS)) {
    $recipients = ADMIN_EMAILS;
}
// 3. Если ничего нет – fallback
else {
    $recipients = ['admin@example.com'];
}

// Фильтруем только валидные email
$recipients = array_values(array_filter($recipients, function($email) {
    return filter_var(trim($email), FILTER_VALIDATE_EMAIL) !== false;
}));

if (empty($recipients)) {
    // Если после фильтрации ни одного адреса – ошибка
    Logger::error('No valid recipient emails for error report', [], 'error_reports');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Не настроен получатель письма. Обратитесь к администратору.']);
    exit;
}

// ============================================================
// ПОДГОТОВКА ПИСЬМА
// ============================================================
$subject = '📝 Сообщение об ошибке на сайте';

$esc = static function ($v) {
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
};
$nl2brSafe = static function ($v) use ($esc) {
    return nl2br($esc($v), false);
};

$html = '<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>' . $esc($subject) . '</title></head>
<body style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
<div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<h2 style="color:#004E96;">' . $esc($subject) . '</h2>
<p><strong>Страница:</strong> <a href="' . $esc($url) . '">' . $esc($url) . '</a></p>
<p><strong>IP отправителя:</strong> ' . $esc($ip) . '</p>
<p><strong>Текст с ошибкой:</strong><br><blockquote style="background:#f0f0f0; padding:10px; border-radius:4px;">' . $nl2brSafe($selectedText) . '</blockquote></p>';
if (!empty($comment)) {
    $html .= '<p><strong>Комментарий:</strong><br>' . $nl2brSafe($comment) . '</p>';
}
$html .= '<p><strong>User-Agent:</strong> ' . $esc($userAgent) . '</p>
<p><small>Это автоматическое уведомление с сайта.</small></p>
</div>
</body>
</html>';

$text = "Сообщение об ошибке\n\n"
      . "Страница: $url\n"
      . "IP: $ip\n"
      . "Текст с ошибкой:\n$selectedText\n";
if (!empty($comment)) {
    $text .= "Комментарий:\n$comment\n";
}
$text .= "User-Agent: $userAgent\n";

// ============================================================
// ОТПРАВКА ЧЕРЕЗ PHPMailer
// ============================================================
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);
try {
    $mail->CharSet = 'UTF-8';
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = SMTP_AUTH;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->SMTPSecure = SMTP_SECURE;
    $mail->Port       = SMTP_PORT;
    $mail->setFrom(FROM_EMAIL, FROM_NAME);

    // Добавляем всех получателей из массива
    foreach ($recipients as $email) {
        $mail->addAddress($email);
    }

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $html;
    $mail->AltBody = $text;

    // Отправляем
    $mail->send();

    Logger::info('Error report email sent', [
        'recipients' => $recipients,
        'ip'         => $ip
    ], 'error_reports');

    echo json_encode(['success' => true, 'message' => 'Сообщение отправлено']);
} catch (Exception $e) {
    Logger::error('Error report email failed', [
        'error'   => $mail->ErrorInfo,
        'to'      => $recipients,
        'ip'      => $ip
    ], 'error_reports');
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Не удалось отправить письмо. Попробуйте позже.']);
}