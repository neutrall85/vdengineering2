<?php
/**
 * SentPHPMailer.php — PHPMailer с автосохранением копии в IMAP-папку «Отправленные».
 *
 * После успешной SMTP-отправки автоматически кладёт копию письма в IMAP-папку
 * «Отправленные» через MailSaver. Сбой сохранения не влияет на основной сценарий.
 *
 * Использование:
 *     $mail = new SentPHPMailer(true);
 *     ... // как обычный PHPMailer
 *     $mail->send(); // письмо уйдёт по SMTP и скопируется в Sent
 */

require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';
require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/MailSaver.php';

use PHPMailer\PHPMailer\PHPMailer;

class SentPHPMailer extends PHPMailer
{
    /** Сохранять ли копию в «Отправленные» (по умолчанию — да). */
    public bool $saveToSent = true;

    public function send(): bool
    {
        $ok = parent::send();

        if ($ok && $this->saveToSent) {
            $this->storeSentCopy();
        }

        return $ok;
    }

    /**
     * Собирает параметры из текущего состояния PHPMailer и передаёт их MailSaver.
     * Всё в try/catch — сбой сохранения не должен ломать отправку.
     */
    private function storeSentCopy(): void
    {
        try {
            $to = array_map(
                static fn(array $a): string => (string)$a[0],
                $this->getToAddresses()
            );

            $attachments = [];
            foreach ($this->getAttachments() as $a) {
                $path = (string)($a[0] ?? '');
                if ($path !== '' && is_file($path)) {
                    $attachments[] = $path;
                }
            }

            [$replyToEmail, $replyToName] = $this->firstReplyTo();

            MailSaver::saveToSent(
                implode(', ', $to),
                (string)$this->Subject,
                (string)$this->Body,
                (string)$this->AltBody,
                $attachments,
                (string)$this->From,
                (string)$this->FromName,
                $replyToEmail,
                $replyToName
            );
        } catch (\Throwable $e) {
            if (class_exists('Logger')) {
                Logger::warning('SentPHPMailer: failed to store sent copy', [
                    'error' => $e->getMessage(),
                ], 'forms');
            }
        }
    }

    private function firstReplyTo(): array
    {
        $list = $this->getReplyToAddresses();
        if (empty($list)) {
            return ['', ''];
        }
        $first = $list[0];
        return [(string)($first[0] ?? ''), (string)($first[1] ?? '')];
    }
}