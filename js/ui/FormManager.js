class FormManager {
  constructor(apiClient, rateLimiter, validator) {
    this.apiClient = apiClient;
    this.rateLimiter = rateLimiter;
    this.validator = validator;
    this.form = null;
    this.validatorInstance = null;
    this.fileUpload = null;
    this.successSelector = '#successMessage';
    this.rateLimitWarning = null;
    this.submitTimeoutId = null;
    this._boundSubmitHandler = null;
  }

  init() {
    this.form = document.getElementById('proposalForm');
    if (!this.form) {
      Logger.WARN('Форма коммерческого предложения не найдена');
      return;
    }

    // Валидация
    this.validatorInstance = FormUtils.initValidation(this.form, {
      required: 'Это поле обязательно для заполнения',
      email: 'Введите корректный email адрес',
      phone: 'Введите корректный номер телефона'
    });

    // Файлы
    this.fileUpload = FormUtils.initFileUpload(
      this.form.querySelector('.form-file'),
      (files) => { /* можно логировать изменения */ },
      { maxFiles: 10, maxFileSize: 10 * 1024 * 1024 }
    );

    // Обработчик отправки
    this._boundSubmitHandler = async (e) => {
      e.preventDefault();
      // Валидация запускается автоматически через form:valid, но мы просто вызовем submitForm
      // Если валидация не пройдена, FormValidation не даст отправить.
      // Лучше подписаться на событие form:valid
    };
    this.form.addEventListener('form:valid', (e) => {
      this._handleSubmit(e);
    });

    // Инициализация чекбоксов (кнопка отправки)
    this._initConsentCheckboxes();

    // Плавающая кнопка (уже есть data-modal-open)
    Logger.INFO('FormManager инициализирован (использует FormUtils)');
  }

  _initConsentCheckboxes() {
    const privacy = document.getElementById('privacyConsent');
    const personal = document.getElementById('personalDataConsent');
    const submitBtn = document.getElementById('submitBtn');
    if (!privacy || !personal || !submitBtn) return;

    const update = () => {
      submitBtn.disabled = !(privacy.checked && personal.checked);
    };
    privacy.addEventListener('change', update);
    personal.addEventListener('change', update);
    update();
  }

  async _handleSubmit(e) {
    await FormUtils.submitForm(this.form, {
      apiClient: this.apiClient,
      onSuccess: (result) => {
        this.form.classList.add('hidden-form');
        const success = document.querySelector(this.successSelector);
        if (success) success.classList.add('show');
        setTimeout(() => {
          if (typeof modalManager !== 'undefined') modalManager.close('proposal');
          this.resetForm();
        }, 3000);
      },
      onError: (msg) => {
        const warning = this.form.querySelector('.rate-limit-warning');
        if (warning) {
          warning.replaceChildren();
          const p = document.createElement('p');
          p.textContent = `⚠️ ${msg}`;
          warning.appendChild(p);
          warning.classList.add('show');
          setTimeout(() => warning.classList.remove('show'), 5000);
        } else {
          alert(msg);
        }
      }
    }, this.fileUpload?.currentFiles || []);
  }

  resetForm() {
    FormUtils.resetForm(
      this.form,
      this.successSelector,
      this.fileUpload,
      this.validatorInstance
    );
    // Дополнительно сбросить чекбоксы (уже сброшены в resetForm)
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = true;
  }

  openModal() {
    // Используется только для плавающей кнопки, но лучше использовать data-modal-open
    if (typeof modalManager !== 'undefined') modalManager.open('proposal');
  }

  initFileUploadOnModalOpen() {
    // Уже инициализировано в init
  }

  removeFile(index) {
    if (this.fileUpload) this.fileUpload.removeFile(index);
  }

  destroy() {
    // Очистка обработчиков файлов
    if (this.fileUpload?.fileDrop?._handlers) {
      const { fileDrop, fileInput, changeHandler, dragOverHandler, dragLeaveHandler, dropHandler } = this.fileUpload.fileDrop._handlers;
      if (fileInput) fileInput.removeEventListener('change', changeHandler);
      if (fileDrop) {
        fileDrop.removeEventListener('dragover', dragOverHandler);
        fileDrop.removeEventListener('dragleave', dragLeaveHandler);
        fileDrop.removeEventListener('drop', dropHandler);
      }
    }
    this.fileUpload = null;
    this.validatorInstance = null;
    this.form = null;
  }
}