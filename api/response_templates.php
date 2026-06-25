<?php
/**
 * response_templates.php — шаблоны ответов для разных типов форм
 * ООО "Волга-Днепр Инжиниринг"
 */
class ResponseBuilder {

    public static function getSuccessMessage(string $formType, array $data = []): string {
        if ($formType === 'proposal') {
            return 'Запрос на коммерческое предложение принят. Специалист коммерческой службы свяжется с Вами в течение 1 рабочего дня.';
        }
        if (!empty($data['vacancy_title'])) {
            return 'Ваш отклик на вакансию принят. HR-специалист рассмотрит резюме и свяжется с Вами в случае соответствия требованиям.';
        }
        return 'Ваше резюме принято. HR-специалист рассмотрит его и свяжется с Вами при появлении подходящих вакансий.';
    }

    public static function getAdminSubject(array $data): string {
        if ($data['type'] === 'proposal') {
            $subject = '📩 Запрос КП — ' . ($data['company'] ?? 'без названия');
            if (!empty($data['aircraft'])) {
                $subject .= ' | ' . $data['aircraft'];
            }
            return $subject;
        }
        if (!empty($data['vacancy_title'])) {
            $subject = '👤 Отклик на вакансию — «' . $data['vacancy_title'] . '»';
        } else {
            $subject = '📄 Резюме (без конкретной вакансии)';
        }
        if (!empty($data['fullName'])) {
            $subject .= ' | ' . $data['fullName'];
        }
        return $subject;
    }

    public static function buildAdminEmail(array $data, array $uploaded, callable $esc, callable $nl2brSafe): array {
        $subject = self::getAdminSubject($data);

        $html = '<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $esc($subject) . '</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">

<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
  <tr>
    <td style="padding:30px 30px 20px; border-bottom:4px solid #004E96; text-align:center;">
      <p style="margin:0; font-size:14px; color:#6c757d;">Новое сообщение с сайта</p>
    </td>
  </tr>
  <tr>
    <td style="padding:25px 30px;">';

        $html .= '<h2 style="margin:0 0 20px; font-size:20px; color:#004E96; font-weight:600;">' . $esc($subject) . '</h2>';

        $labels = [
            'company'       => 'Компания',
            'contact'       => 'Контактное лицо',
            'fullName'      => 'ФИО',
            'email'         => 'Email',
            'phone'         => 'Телефон',
            'extension'     => 'Добавочный',
            'aircraft'      => 'Тип воздушного судна',
            'service'       => 'Тип услуги',
            'task'          => 'Описание задачи',
            'about'         => 'О себе / сопроводительное письмо',
            'vacancy_title' => 'Вакансия',
            'vacancy_id'    => 'ID вакансии',
        ];

        foreach ($data as $k => $v) {
            if ($k === 'type') continue;
            if (($k === 'vacancy_id' || $k === 'vacancy_title') && $v === '') continue;
            // Пропускаем добавочный, если пуст
            if ($k === 'extension' && $v === '') continue;

            $label = $esc($labels[$k] ?? $k);
            if (in_array($k, ['task', 'about'], true)) {
                $html .= '<p style="margin:0 0 12px; font-size:14px; color:#333;"><strong style="color:#004E96;">' . $label . ':</strong><br>' . $nl2brSafe($v) . '</p>';
            } else {
                $html .= '<p style="margin:0 0 8px; font-size:14px; color:#333;"><strong style="color:#004E96;">' . $label . ':</strong> ' . $esc($v) . '</p>';
            }
        }

        if ($uploaded) {
            $html .= '<p style="margin:20px 0 8px; font-size:14px; color:#004E96; font-weight:600;">Приложенные файлы:</p>';
            $html .= '<ul style="margin:0; padding-left:20px; list-style:disc;">';
            foreach ($uploaded as $f) {
                $html .= '<li style="font-size:14px; color:#333; margin-bottom:4px;">' . $esc($f['original']) . ' (' . round($f['size']/1024) . ' KB)</li>';
            }
            $html .= '</ul>';
        }

        $html .= '</td>
  </tr>
  <tr>
    <td style="padding:20px 30px; background-color:#f8f9fa; border-top:1px solid #e9ecef; text-align:center; font-size:12px; color:#6c757d;">
      <p style="margin:0;">Это письмо сгенерировано автоматически. Пожалуйста, не отвечайте на него.</p>
      <p style="margin:5px 0 0;">&copy; ' . date('Y') . ' ООО «Волга-Днепр Инжиниринг»</p>
    </td>
  </tr>
</table>

</body>
</html>';

        $text = $subject . "\n" . str_repeat('-', 40) . "\n";
        foreach ($data as $k => $v) {
            if ($k === 'type') continue;
            if (($k === 'vacancy_id' || $k === 'vacancy_title') && $v === '') continue;
            if ($k === 'extension' && $v === '') continue;
            $label = $labels[$k] ?? $k;
            $text .= "$label: $v\n";
        }
        if ($uploaded) {
            $text .= "\nПриложенные файлы:\n";
            foreach ($uploaded as $f) {
                $text .= "- {$f['original']} (" . round($f['size']/1024) . " KB)\n";
            }
        }

        return ['html' => $html, 'text' => $text, 'subject' => $subject];
    }

    public static function buildClientAutoReply(array $data, string $companyName, callable $esc): array {
        $clientName = $esc($data['contact'] ?? $data['fullName'] ?? 'Клиент');
        $companyEsc = $esc($companyName);

        if ($data['type'] === 'proposal') {
            return self::buildProposalReply($clientName, $companyEsc, $companyName, $esc);
        }
        if (!empty($data['vacancy_title'])) {
            return self::buildVacancyReply($data, $clientName, $companyEsc, $companyName, $esc);
        }
        return self::buildResumeReply($clientName, $companyEsc, $companyName, $esc);
    }

    private static function buildProposalReply(
        string $clientName,
        string $companyEsc,
        string $companyRaw,
        callable $esc
    ): array {
        $subject = 'Ваш запрос на коммерческое предложение получен | ' . $companyRaw;

        $html = '<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $esc($subject) . '</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">

<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
  <tr>
    <td style="padding:30px 30px 20px; border-bottom:4px solid #004E96; text-align:center;">
      <img src="https://neutrall85.tw1.ru/assets/images/logo.webp" alt="Волга-Днепр Инжиниринг" style="height:50px; width:auto; display:block; margin:0 auto 5px;">
      <p style="margin:0; font-size:14px; color:#6c757d;">Подтверждение получения запроса</p>
    </td>
  </tr>
  <tr>
    <td style="padding:25px 30px;">
      <h2 style="margin:0 0 16px; font-size:20px; color:#004E96; font-weight:600;">Запрос получен</h2>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Уважаемый(ая), ' . $clientName . ',</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Благодарим Вас за обращение в <strong style="color:#004E96;">' . $companyEsc . '</strong>.</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Ваш запрос на коммерческое предложение направлен специалистам.</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Если вопрос срочный — просто ответьте на это письмо, мы увидим его в первую очередь.</p>
      <p style="margin:20px 0 0; font-size:15px; color:#333; line-height:1.5;">С уважением, команда <strong style="color:#004E96;">' . $companyEsc . '</strong></p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 30px; background-color:#f8f9fa; border-top:1px solid #e9ecef; text-align:center; font-size:12px; color:#6c757d;">
      <p style="margin:0;">Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
      <p style="margin:5px 0 0;">&copy; ' . date('Y') . ' ООО «Волга-Днепр Инжиниринг»</p>
    </td>
  </tr>
</table>

</body>
</html>';

        $text = "Запрос получен\n\n"
            . "Уважаемый(ая), $clientName,\n\n"
            . "Благодарим Вас за обращение в $companyRaw.\n\n"
            . "Ваш запрос на коммерческое предложение направлен специалистам.\n\n"
            . "Если вопрос срочный — просто ответьте на это письмо, мы увидим его в первую очередь.\n\n"
            . "С уважением,\nкоманда\n$companyRaw";

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }

    private static function buildVacancyReply(
        array $data,
        string $clientName,
        string $companyEsc,
        string $companyRaw,
        callable $esc
    ): array {
        $subject = 'Ваш отклик на вакансию получен | ' . $companyRaw;

        $vacancyHtml = '<p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Мы получили Ваш отклик на вакансию <strong style="color:#004E96;">«' . $esc($data['vacancy_title']) . '»</strong>.</p>';
        $vacancyText = "Мы получили Ваш отклик на вакансию «" . $data['vacancy_title'] . "».\n\n";

        $html = '<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $esc($subject) . '</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">

<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
  <tr>
    <td style="padding:30px 30px 20px; border-bottom:4px solid #004E96; text-align:center;">
      <img src="https://neutrall85.tw1.ru/assets/images/logo.webp" alt="Волга-Днепр Инжиниринг" style="height:50px; width:auto; display:block; margin:0 auto 5px;">
      <p style="margin:0; font-size:14px; color:#6c757d;">Подтверждение отклика на вакансию</p>
    </td>
  </tr>
  <tr>
    <td style="padding:25px 30px;">
      <h2 style="margin:0 0 16px; font-size:20px; color:#004E96; font-weight:600;">Отклик получен</h2>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Уважаемый(ая), ' . $clientName . ',</p>
      ' . $vacancyHtml . '
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Благодарим Вас за интерес к работе в <strong style="color:#004E96;">' . $companyEsc . '</strong>.</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Ваше резюме передано в отдел управления персонала. Если Ваш опыт и компетенции соответствуют требованиям вакансии, мы свяжемся с Вами в течение <strong style="color:#004E96;">5 рабочих дней</strong> для обсуждения дальнейших шагов.</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Обратите внимание: при большом количестве откликов мы отвечаем только кандидатам, прошедшим первичный отбор. Это не отменяет внимательного рассмотрения каждого резюме.</p>
      <p style="margin:20px 0 0; font-size:15px; color:#333; line-height:1.5;">С уважением,<br>отдел управления персоналом<br><strong style="color:#004E96;">' . $companyEsc . '</strong></p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 30px; background-color:#f8f9fa; border-top:1px solid #e9ecef; text-align:center; font-size:12px; color:#6c757d;">
      <p style="margin:0;">Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
      <p style="margin:5px 0 0;">&copy; ' . date('Y') . ' ООО «Волга-Днепр Инжиниринг»</p>
    </td>
  </tr>
</table>

</body>
</html>';

        $text = "Отклик получен\n\n"
            . "Уважаемый(ая), $clientName,\n\n"
            . $vacancyText
            . "Благодарим Вас за интерес к работе в $companyRaw.\n\n"
            . "Ваше резюме передано в отдел управления персоналом. Если Ваш опыт и компетенции соответствуют требованиям вакансии, мы свяжемся с Вами в течение 5 рабочих дней для обсуждения дальнейших шагов.\n\n"
            . "Обратите внимание: при большом количестве откликов мы отвечаем только кандидатам, прошедшим первичный отбор. Это не отменяет внимательного рассмотрения каждого резюме.\n\n"
            . "С уважением,\nотдел управления персоналом\n$companyRaw";

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }

    private static function buildResumeReply(
        string $clientName,
        string $companyEsc,
        string $companyRaw,
        callable $esc
    ): array {
        $subject = 'Ваше резюме получено | ' . $companyRaw;

        $html = '<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . $esc($subject) . '</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, Helvetica, sans-serif;">

<table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; margin:0 auto; background-color:#ffffff; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
  <tr>
    <td style="padding:30px 30px 20px; border-bottom:4px solid #004E96; text-align:center;">
      <img src="https://neutrall85.tw1.ru/assets/images/logo.webp" alt="Волга-Днепр Инжиниринг" style="height:50px; width:auto; display:block; margin:0 auto 5px;">
      <p style="margin:0; font-size:14px; color:#6c757d;">Подтверждение получения резюме</p>
    </td>
  </tr>
  <tr>
    <td style="padding:25px 30px;">
      <h2 style="margin:0 0 16px; font-size:20px; color:#004E96; font-weight:600;">Резюме получено</h2>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Уважаемый(ая), ' . $clientName . ',</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Благодарим Вас за интерес к работе в <strong style="color:#004E96;">' . $companyEsc . '</strong>.</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Ваше резюме получено и передано в отдел управления персоналом. Мы рассмотрим его в рамках актуальных и будущих вакансий компании.</p>
      <p style="margin:0 0 12px; font-size:15px; color:#333; line-height:1.5;">Если Ваш опыт и компетенции будут соответствовать нашим потребностям, мы свяжемся с Вами.</p>
      <p style="margin:20px 0 0; font-size:15px; color:#333; line-height:1.5;">С уважением,<br>отдел управления персоналом<br><strong style="color:#004E96;">' . $companyEsc . '</strong></p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 30px; background-color:#f8f9fa; border-top:1px solid #e9ecef; text-align:center; font-size:12px; color:#6c757d;">
      <p style="margin:0;">Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
      <p style="margin:5px 0 0;">&copy; ' . date('Y') . ' ООО «Волга-Днепр Инжиниринг»</p>
    </td>
  </tr>
</table>

</body>
</html>';

        $text = "Резюме получено\n\n"
            . "Уважаемый(ая), $clientName,\n\n"
            . "Благодарим Вас за интерес к работе в $companyRaw.\n\n"
            . "Ваше резюме получено и передано в отдел управления персоналом. Мы рассмотрим его в рамках актуальных и будущих вакансий компании.\n\n"
            . "Если Ваш опыт и компетенции будут соответствовать нашим потребностям, мы свяжемся с Вами.\n\n"
            . "С уважением,\nотдел управления персоналом\n$companyRaw";

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }
}