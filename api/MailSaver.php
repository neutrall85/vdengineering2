<?php
/**
 * MailSaver.php — сохранение отправленного письма в IMAP-папку «Отправленные»
 * ООО "ВД Инжиниринг"
 */

class MailSaver
{
    public static function saveToSent(
        string $to,
        string $subject,
        string $bodyHtml,
        string $bodyText = '',
        array  $attach = [],
        string $fromEmail = '',
        string $fromName = '',
        string $replyToEmail = '',
        string $replyToName = ''
    ): bool {
        if (!defined('IMAP_ENABLED') || !IMAP_ENABLED) return false;
        if (!function_exists('imap_open')) { self::logWarning('IMAP extension not available'); return false; }

        if (function_exists('imap_timeout')) {
            imap_timeout(IMAP_OPENTIMEOUT, 5);
            imap_timeout(IMAP_READTIMEOUT, 5);
            imap_timeout(IMAP_WRITETIMEOUT, 5);
        }

        $mailbox = self::buildMailboxString();
        $stream = @imap_open($mailbox, IMAP_USER, IMAP_PASS, 0, 1);

        if (!$stream) {
            self::logWarning('imap_open failed', [
                'mailbox' => $mailbox,
                'error'   => function_exists('imap_last_error') ? imap_last_error() : 'n/a',
            ]);
            return false;
        }

        try {
            $raw = self::buildRawMessage($to, $subject, $bodyHtml, $bodyText, $attach, $fromEmail, $fromName, $replyToEmail, $replyToName);
            $ok = @imap_append($stream, $mailbox, $raw, '\\Seen');

            if (!$ok) {
                self::logWarning('imap_append failed', [
                    'mailbox' => $mailbox,
                    'error'   => function_exists('imap_last_error') ? imap_last_error() : 'n/a',
                ]);
            } else {
                self::logDebug('Saved to Sent', ['folder' => IMAP_SENT_FOLDER, 'to' => $to]);
            }
            return (bool)$ok;
        } finally {
            @imap_close($stream);
        }
    }

    /**
     * [SEC] По умолчанию используем /validate-cert. Отключение проверки
     * сертификата IMAP-сервера возможно только явно через IMAP_VERIFY_CERT=false
     * в .env или через IMAP_FLAGS.
     */
    private static function buildMailboxString(): string
    {
        if (defined('IMAP_FLAGS') && IMAP_FLAGS !== '') {
            $flags = ltrim(IMAP_FLAGS, '/');
            return '{' . IMAP_HOST . ':' . IMAP_PORT . '/' . $flags . '}' . IMAP_SENT_FOLDER;
        }

        $flags = 'imap';
        if (defined('IMAP_SECURE') && IMAP_SECURE === 'ssl')      $flags .= '/ssl';
        elseif (defined('IMAP_SECURE') && IMAP_SECURE === 'tls')  $flags .= '/tls';

        $verify = !defined('IMAP_VERIFY_CERT') || IMAP_VERIFY_CERT;
        $flags .= $verify ? '/validate-cert' : '/novalidate-cert';

        return '{' . IMAP_HOST . ':' . IMAP_PORT . '/' . $flags . '}' . IMAP_SENT_FOLDER;
    }

    private static function buildRawMessage(
        string $to, string $subject, string $bodyHtml, string $bodyText, array $attach,
        string $fromEmail, string $fromName, string $replyToEmail, string $replyToName
    ): string {
        $eol = "\r\n";
        $fromEmail = $fromEmail !== '' ? $fromEmail : (defined('FROM_EMAIL') ? FROM_EMAIL : 'no-reply@localhost');
        $fromName  = $fromName  !== '' ? $fromName  : (defined('FROM_NAME')  ? FROM_NAME  : '');

        $headers = [];
        $headers[] = 'Date: ' . date('r');
        $headers[] = 'From: ' . self::encodeAddress($fromEmail, $fromName);
        $headers[] = 'To: '   . self::sanitizeHeader($to);
        if ($replyToEmail !== '') $headers[] = 'Reply-To: ' . self::encodeAddress($replyToEmail, $replyToName);
        $headers[] = 'Subject: ' . self::encodeHeader($subject);
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . (IMAP_HOST ?: 'localhost') . '>';

        $boundaryMixed = '=_mixed_' . bin2hex(random_bytes(12));
        $boundaryAlt   = '=_alt_'   . bin2hex(random_bytes(12));

        if (!empty($attach)) {
            $headers[] = 'Content-Type: multipart/mixed; boundary="' . $boundaryMixed . '"';
            $body  = '--' . $boundaryMixed . $eol;
            $body .= 'Content-Type: multipart/alternative; boundary="' . $boundaryAlt . '"' . $eol . $eol;
            $body .= self::buildAlternativePart($bodyText, $bodyHtml, $boundaryAlt, $eol);
            foreach ($attach as $file) {
                if (!is_string($file) || !is_file($file) || !is_readable($file)) continue;
                $body .= '--' . $boundaryMixed . $eol;
                $body .= self::buildAttachmentPart($file, $eol);
            }
            $body .= '--' . $boundaryMixed . '--' . $eol;
        } else {
            $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundaryAlt . '"';
            $body = self::buildAlternativePart($bodyText, $bodyHtml, $boundaryAlt, $eol);
        }

        return implode($eol, $headers) . $eol . $eol . $body;
    }

    private static function buildAlternativePart(string $text, string $html, string $boundary, string $eol): string
    {
        $plain = $text !== '' ? $text : strip_tags($html);
        $out  = '--' . $boundary . $eol;
        $out .= 'Content-Type: text/plain; charset=UTF-8' . $eol;
        $out .= 'Content-Transfer-Encoding: base64' . $eol . $eol;
        $out .= chunk_split(base64_encode($plain), 76, $eol);
        $out .= '--' . $boundary . $eol;
        $out .= 'Content-Type: text/html; charset=UTF-8' . $eol;
        $out .= 'Content-Transfer-Encoding: base64' . $eol . $eol;
        $out .= chunk_split(base64_encode($html), 76, $eol);
        $out .= '--' . $boundary . '--' . $eol;
        return $out;
    }

    private static function buildAttachmentPart(string $file, string $eol): string
    {
        $name = basename($file);
        $encoded = self::encodeHeader($name);
        $mime = self::detectMime($file);
        $data = base64_encode((string)file_get_contents($file));
        $out  = 'Content-Type: ' . $mime . '; name="' . $encoded . '"' . $eol;
        $out .= 'Content-Transfer-Encoding: base64' . $eol;
        $out .= 'Content-Disposition: attachment; filename="' . $encoded . '"' . $eol . $eol;
        $out .= chunk_split($data, 76, $eol);
        return $out;
    }

    private static function encodeAddress(string $email, string $name = ''): string
    {
        $email = self::sanitizeHeader($email);
        if ($name === '') return $email;
        return self::encodeHeader($name) . ' <' . $email . '>';
    }

    private static function encodeHeader(string $value): string
    {
        $value = str_replace(["\r", "\n"], ' ', $value);
        if (preg_match('/[\x80-\xFF]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    }

    private static function sanitizeHeader(string $value): string
    {
        return trim(str_replace(["\r", "\n"], '', $value));
    }

    private static function detectMime(string $file): string
    {
        if (class_exists('finfo')) {
            $f = new finfo(FILEINFO_MIME_TYPE);
            $t = $f->file($file);
            if ($t) return $t;
        }
        if (function_exists('mime_content_type')) {
            $t = @mime_content_type($file);
            if ($t) return $t;
        }
        return 'application/octet-stream';
    }

    private static function logWarning(string $msg, array $ctx = []): void
    {
        if (class_exists('Logger')) Logger::warning('MailSaver: ' . $msg, $ctx, 'forms');
    }

    private static function logDebug(string $msg, array $ctx = []): void
    {
        if (class_exists('Logger')) Logger::debug('MailSaver: ' . $msg, $ctx, 'forms');
    }
}