<?php
/**
 * response_templates.php — шаблоны ответов для разных типов форм
 * ООО "Волга-Днепр Инжиниринг"
 *
 * proposal              — запрос коммерческого предложения (B2B, MRO-услуги)
 * universal (vacancy)   — отклик на конкретную вакансию
 * universal (no vacancy) — отправка резюме без конкретной вакансии
 */
class ResponseBuilder {

    /**
     * Сообщение об успешной отправке (для JSON-ответа клиенту)
     */
    public static function getSuccessMessage(string $formType, array $data = []): string {
        if ($formType === 'proposal') {
            return 'Запрос на коммерческое предложение принят. Специалист коммерческой службы свяжется с вами в течение 1 рабочего дня.';
        }

        if (!empty($data['vacancy_title'])) {
            return 'Ваш отклик на вакансию принят. HR-специалист рассмотрит резюме и свяжется с вами в случае соответствия требованиям.';
        }

        return 'Ваше резюме принято. HR-специалист рассмотрит его и свяжется с вами при появлении подходящих вакансий.';
    }

    /**
     * Тема письма для админа
     */
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

    /**
     * HTML и текст письма для админа
     */
    public static function buildAdminEmail(array $data, array $uploaded, callable $esc, callable $nl2brSafe): array {
        $subject = self::getAdminSubject($data);

        $html = '<h2>' . $esc($subject) . '</h2>';
        $text = $subject . "\n" . str_repeat('-', 40) . "\n";

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
            // [FIX] Пропускаем пустые поля вакансии
            if (($k === 'vacancy_id' || $k === 'vacancy_title') && $v === '') continue;
            
            $label = $esc($labels[$k] ?? $k);
            if (in_array($k, ['task', 'about'], true)) {
                $html .= "<p><strong>$label:</strong><br>" . $nl2brSafe($v) . "</p>";
            } else {
                $html .= "<p><strong>$label:</strong> " . $esc($v) . "</p>";
            }
            $text .= "$label: $v\n";
        }

        if ($uploaded) {
            $html .= '<p><strong>Приложенные файлы:</strong><br>';
            $text .= "\nПриложенные файлы:\n";
            foreach ($uploaded as $f) {
                $html .= '— ' . $esc($f['original']) . ' (' . round($f['size']/1024) . ' KB)<br>';
                $text .= "- {$f['original']} (" . round($f['size']/1024) . " KB)\n";
            }
            $html .= '</p>';
        }

        return ['html' => $html, 'text' => $text, 'subject' => $subject];
    }

    /**
     * Тема и тело автоответа клиенту
     */
    public static function buildClientAutoReply(array $data, string $companyName, callable $esc): array {
        $clientName = $esc($data['contact'] ?? $data['fullName'] ?? 'Клиент');
        $companyEsc = $esc($companyName);

        if ($data['type'] === 'proposal') {
            return self::buildProposalReply($clientName, $companyEsc, $companyName);
        }

        if (!empty($data['vacancy_title'])) {
            return self::buildVacancyReply($data, $clientName, $companyEsc, $companyName, $esc);
        }

        return self::buildResumeReply($clientName, $companyEsc, $companyName);
    }

    /**
     * Автоответ для запроса КП (proposal)
     */
    private static function buildProposalReply(
        string $clientName, string $companyEsc, string $companyRaw
    ): array {
        $subject = 'Ваш запрос на коммерческое предложение получен | ' . $companyRaw;

        $html = "<h2>Запрос получен</h2>
<p>Уважаемый(ая) $clientName,</p>
<p>Благодарим вас за обращение в <strong>$companyEsc</strong>.</p>
<p>Ваш запрос на коммерческое предложение направлен специалистам.</p>
<p>Если вопрос срочный — просто ответьте на это письмо, мы увидим его в первую очередь.</p>
<p>С уважением,<br>команда<br>$companyEsc</p>";

        $text = "Запрос получен\n\n"
            . "Уважаемый(ая) $clientName,\n\n"
            . "Благодарим вас за обращение в $companyRaw.\n\n"
            . "Ваш запрос на коммерческое предложение направлен специалистам.\n\n"
            . "Если вопрос срочный — просто ответьте на это письмо, мы увидим его в первую очередь.\n\n"
            . "С уважением,\nкоманда\n$companyRaw";

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }

    /**
     * Автоответ для отклика на конкретную вакансию (universal + vacancy_title)
     */
    private static function buildVacancyReply(
        array $data, string $clientName, string $companyEsc,
        string $companyRaw, callable $esc
    ): array {
        $subject = 'Ваш отклик на вакансию получен | ' . $companyRaw;

        $vacancyHtml = "<p>Мы получили ваш отклик на вакансию <strong>«" . $esc($data['vacancy_title']) . "»</strong>.</p>";
        $vacancyText = "Мы получили ваш отклик на вакансию «" . $data['vacancy_title'] . "».\n\n";

        $html = "<h2>Отклик получен</h2>
<p>Уважаемый(ая) $clientName,</p>
$vacancyHtml
<p>Благодарим вас за интерес к работе в <strong>$companyEsc</strong>.</p>
<p>Ваше резюме передано в отдел управления персонала. Если ваш опыт и компетенции соответствуют требованиям вакансии, мы свяжемся с вами в течение <strong>5 рабочих дней</strong> для обсуждения дальнейших шагов.</p>
<p>Обратите внимание: при большом количестве откликов мы отвечаем только кандидатам, прошедшим первичный отбор. Это не отменяет внимательного рассмотрения каждого резюме.</p>
<p>С уважением,<br>отдел управления персоналом<br>$companyEsc</p>";

        $text = "Отклик получен\n\n"
            . "Уважаемый(ая) $clientName,\n\n"
            . $vacancyText
            . "Благодарим вас за интерес к работе в $companyRaw.\n\n"
            . "Ваше резюме передано в отдел управления персоналом. Если ваш опыт и компетенции соответствуют требованиям вакансии, мы свяжемся с вами в течение 5 рабочих дней для обсуждения дальнейших шагов.\n\n"
            . "Обратите внимание: при большом количестве откликов мы отвечаем только кандидатам, прошедшим первичный отбор. Это не отменяет внимательного рассмотрения каждого резюме.\n\n"
            . "С уважением,\nотдел управления персоналом\n$companyRaw";

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }

    /**
     * Автоответ для отправки резюме без конкретной вакансии (universal, no vacancy)
     */
    private static function buildResumeReply(
        string $clientName, string $companyEsc, string $companyRaw
    ): array {
        $subject = 'Ваше резюме получено | ' . $companyRaw;

        $html = "<h2>Резюме получено</h2>
<p>Уважаемый(ая) $clientName,</p>
<p>Благодарим вас за интерес к работе в <strong>$companyEsc</strong>.</p>
<p>Ваше резюме получено и передано в отдел управления персоналом. Мы рассмотрим его в рамках актуальных и будущих вакансий компании.</p>
<p>Если ваш опыт и компетенции будут соответствовать нашим потребностям, мы свяжемся с вами.</p>
<p>С уважением,<br>отдел управления персоналом<br>$companyEsc</p>";

        $text = "Резюме получено\n\n"
            . "Уважаемый(ая) $clientName,\n\n"
            . "Благодарим вас за интерес к работе в $companyRaw.\n\n"
            . "Ваше резюме получено и передано в отдел управления персоналом. Мы рассмотрим его в рамках актуальных и будущих вакансий компании.\n\n"
            . "Если ваш опыт и компетенции будут соответствовать нашим потребностям, мы свяжемся с вами.\n\n"
            . "С уважением,\nотдел управления персоналом\n$companyRaw";

        return ['subject' => $subject, 'html' => $html, 'text' => $text];
    }
}