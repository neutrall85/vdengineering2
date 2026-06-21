/**
 * ModalTemplates - HTML-шаблоны модальных окон
 * Вынесены из ComponentLoader для улучшения читаемости
 * ООО "Волга-Днепр Инжиниринг"
 */

const ModalTemplates = {
    proposalModal: `
<!-- Commercial Proposal Modal -->
<div class="modal-overlay modal-overlay-proposal" id="proposalModalOverlay" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
  <div class="modal-container modal-container-proposal">
    <button class="modal-close" aria-label="Закрыть">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <div class="modal-header">
      <h2 class="modal-title" id="modalTitle">Запрос коммерческого предложения</h2>
      <p class="modal-subtitle">Заполните форму ниже, и мы свяжемся с вами в течение 24 часов</p>
    </div>
    <div class="modal-body">
      <div class="rate-limit-warning" id="rateLimitWarning">
        <p>⚠️ Слишком много запросов. Пожалуйста, подождите 60 секунд перед следующей отправкой.</p>
      </div>

      <!-- Блок успеха УДАЛЁН – теперь используется отдельная модалка successModal -->

      <input type="hidden" id="csrfToken" name="csrf_token" value="">

      <div class="hp-field">
        <label for="hp_website">Website</label>
        <input type="text" id="hp_website" name="website" tabindex="-1" autocomplete="off">
      </div>

      <form id="proposalForm" novalidate>
        <div class="form-group">
          <label class="form-label" for="companyName">Название компании <span class="required">*</span></label>
          <input type="text" class="form-input" id="companyName" name="companyName" placeholder="Введите название компании" required minlength="2" maxlength="200" autocomplete="organization">
          <p class="error-message" id="companyNameError">Пожалуйста, введите корректное название компании</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="contactPerson">Контактное лицо <span class="required">*</span></label>
          <input type="text" class="form-input" id="contactPerson" name="contactPerson" placeholder="Ваше полное имя" required minlength="2" maxlength="100" autocomplete="name">
          <p class="error-message" id="contactPersonError">Пожалуйста, введите ваше имя</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="email">Электронная почта <span class="required">*</span></label>
          <input type="email" class="form-input" id="email" name="email" placeholder="ваш.email@company.com" required maxlength="255" autocomplete="email">
          <p class="error-message" id="emailError">Пожалуйста, введите корректный email</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="phone-proposal">Телефон <span class="required">*</span></label>
          <div class="form-phone-group">
            <input type="tel" class="form-input" id="phone-proposal" name="phone" placeholder="+7 (999) 000-00-00" required minlength="10" maxlength="20" autocomplete="tel" class="form-input-phone">
            <input type="text" class="form-input" id="extension" name="extension" placeholder="доб." maxlength="6" autocomplete="off" class="form-input-extension">
          </div>
          <p class="error-message" id="phoneError">Пожалуйста, введите корректный номер телефона</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="aircraftType">Тип воздушного судна <span class="required">*</span></label>
          <input type="text" class="form-input" id="aircraftType" name="aircraftType" placeholder="Введите тип воздушного судна (например, Boeing 777)" required minlength="2" maxlength="100" autocomplete="off">
          <p class="error-message" id="aircraftTypeError">Пожалуйста, введите тип воздушного судна</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="serviceType">Требуемая услуга <span class="required">*</span></label>
          <input type="text" class="form-input" id="serviceType" name="serviceType" placeholder="Введите тип услуги (например, модификация систем управления)" required minlength="2" maxlength="100" autocomplete="off">
          <p class="error-message" id="serviceTypeError">Пожалуйста, выберите тип услуги</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="taskDescription">Краткое описание задачи <span class="required">*</span></label>
          <textarea class="form-textarea" id="taskDescription" name="taskDescription" placeholder="Пожалуйста, опишите требования к модификации, сроки и любые конкретные детали..." required minlength="10" maxlength="2000"></textarea>
          <p class="error-message" id="taskDescriptionError">Пожалуйста, опишите вашу задачу (минимум 10 символов)</p>
        </div>

        <div class="form-group">
          <label class="form-label">Вложение (опционально)</label>
          <div class="form-file" id="fileDrop">
            <input type="file" id="fileAttachment" name="fileAttachment[]" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip" aria-label="Загрузить файл" multiple>
            <div class="form-file-icon">
              <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
            </div>
            <p class="form-file-text">Выбрать файл...</p>
            <p class="form-file-hint">PDF, DOC, DOCX, XLS, XLSX, ZIP (Max 10MB)</p>
            <div class="form-file-list" id="fileList"></div>
          </div>
        </div>

        <div class="form-agreement form-agreement-checkbox">
          <label class="checkbox-label">
            <input type="checkbox" id="privacyConsent" name="privacyConsent" required>
            <span class="checkbox-text">Я ознакомлен и согласен с <a href="#" data-policy="privacy" target="_blank" rel="noopener noreferrer">Политикой конфиденциальности</a> <span class="required">*</span></span>
          </label>
          <p class="error-message" id="privacyConsentError">Необходимо согласие с Политикой конфиденциальности</p>
        </div>

        <div class="form-agreement form-agreement-checkbox">
          <label class="checkbox-label">
            <input type="checkbox" id="personalDataConsent" name="personalDataConsent" required>
            <span class="checkbox-text">Я ознакомлен и согласен с <a href="#" data-policy="personal-data" target="_blank" rel="noopener noreferrer">Политикой обработки персональных данных</a> <span class="required">*</span></span>
          </label>
          <p class="error-message" id="personalDataConsentError">Необходимо согласие с Политикой обработки персональных данных</p>
        </div>

        <button type="submit" class="form-submit" id="submitBtn">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          <span>Отправить запрос</span>
        </button>
      </form>
    </div>
  </div>
</div>`,

    universalApplicationModal: `
<!-- Universal Application Modal -->
<div class="modal-overlay modal-overlay-universal" id="universalApplicationModalOverlay" role="dialog" aria-modal="true" aria-labelledby="universalApplicationModalTitle">
  <div class="modal-container">
    <button class="modal-close" aria-label="Закрыть">
      <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    </button>
    <div class="modal-header">
      <h2 class="modal-title" id="universalApplicationModalTitle">Отклик на вакансию</h2>
      <p class="modal-subtitle" id="universalApplicationModalSubtitle">Заполните форму ниже, и мы рассмотрим вашу кандидатуру</p>
    </div>
    <div class="modal-body">
      <div class="rate-limit-warning" id="universalRateLimitWarning">
        <p>⚠️ Слишком много запросов. Пожалуйста, подождите 60 секунд перед следующей отправкой.</p>
      </div>

      <!-- Блок успеха УДАЛЁН – теперь используется отдельная модалка successModal -->

      <form id="universalApplicationForm" novalidate>
        <div class="form-group">
          <label class="form-label" for="fullName">ФИО <span class="required">*</span></label>
          <input type="text" class="form-input" id="fullName" name="fullName" placeholder="Введите ваши ФИО полностью" required minlength="2" maxlength="200" autocomplete="name">
          <p class="error-message" id="fullNameError">Пожалуйста, введите корректное ФИО</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="phone-universal">Номер телефона <span class="required">*</span></label>
          <input type="tel" class="form-input" id="phone-universal" name="phone" placeholder="+7 (999) 000-00-00" required minlength="10" maxlength="20" autocomplete="tel">
          <p class="error-message" id="phoneError">Пожалуйста, введите корректный номер телефона</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="email">Адрес e-mail <span class="required">*</span></label>
          <input type="email" class="form-input" id="email" name="email" placeholder="ваш.email@example.com" required maxlength="255" autocomplete="email">
          <p class="error-message" id="emailError">Пожалуйста, введите корректный email</p>
        </div>

        <div class="form-group">
          <label class="form-label" for="about">Расскажите о себе <span class="required">*</span></label>
          <textarea class="form-textarea" id="about" name="about" placeholder="Расскажите о вашем опыте, навыках и почему вы хотите работать у нас..." required minlength="10" maxlength="2000"></textarea>
          <p class="error-message" id="aboutError">Пожалуйста, расскажите о себе (минимум 10 символов)</p>
        </div>

        <div class="form-group">
          <label class="form-label">Резюме (файл) <span class="required">*</span></label>
          <div class="form-file" id="universalFileDrop">
            <input type="file" id="fileAttachment" name="fileAttachment[]" accept=".pdf,.doc,.docx,.xls,.xlsx" aria-label="Загрузить резюме" required multiple>
            <div class="form-file-icon">
              <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>
            </div>
            <p class="form-file-text">Выбрать файл...</p>
            <p class="form-file-hint">PDF, DOC, DOCX, XLS, XLSX (Max 10MB)</p>
            <div class="form-file-list" id="universalFileList"></div>
          </div>
          <p class="error-message" id="fileAttachmentError">Пожалуйста, прикрепите резюме</p>
        </div>

        <div class="form-agreement form-agreement-checkbox">
          <label class="checkbox-label">
            <input type="checkbox" id="consent" name="consent" required>
            <span class="checkbox-text">Я согласен с <a href="#" data-policy="personal-data" target="_blank" rel="noopener noreferrer">Условиями обработки персональных данных</a> <span class="required">*</span></span>
          </label>
          <p class="error-message" id="consentError">Необходимо подтвердить согласие</p>
        </div>

        <button type="submit" class="form-submit" id="universalSubmitBtn">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          <span id="universalSubmitBtnText">Отправить отклик</span>
        </button>
      </form>
    </div>
  </div>
</div>`,

    // НОВАЯ МОДАЛКА УСПЕХА (без крестика, использует существующие стили)
    successModal: `
<!-- Success Modal -->
<div class="modal-overlay modal-overlay-success" id="successModalOverlay" role="dialog" aria-modal="true" aria-labelledby="successModalTitle">
  <div class="modal-container modal-container-success">
    <!-- Крестик удалён по требованию -->
    <div class="modal-body success-modal-body">
      <div class="success-message show" style="display: block; text-align: center; padding: 1rem 0;">
        <div class="success-icon">
          <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <h3 class="success-title" id="successModalTitle">Заявка отправлена!</h3>
        <p class="success-text" id="successModalText">Спасибо за ваш запрос. Мы свяжемся с вами в ближайшее время.</p>
      </div>
    </div>
  </div>
</div>
`
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalTemplates;
}