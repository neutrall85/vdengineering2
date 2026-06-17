const UniversalApplicationModalManager = {
  form: null,
  validatorInstance: null,
  fileUpload: null,
  successSelector: '#universalSuccessMessage',

  init() {
    this.form = document.getElementById('universalApplicationForm');
    if (!this.form) return;

    // Валидация
    this.validatorInstance = FormUtils.initValidation(this.form, {
      required: 'Это поле обязательно для заполнения',
      email: 'Введите корректный email адрес',
      phone: 'Введите корректный номер телефона',
      fileRequired: 'Пожалуйста, прикрепите резюме'
    });

    // Файлы
    this.fileUpload = FormUtils.initFileUpload(
      this.form.querySelector('.form-file'),
      null,
      { maxFiles: 5, maxFileSize: 10 * 1024 * 1024 }
    );

    // Телефон
    const phoneInput = document.getElementById('universalPhone');
    if (phoneInput && Utils.PhoneUtils) {
      Utils.PhoneUtils.setupAutoPrefix(phoneInput);
    }

    // Обработка отправки
    this.form.addEventListener('form:valid', (e) => {
      this._handleSubmit(e);
    });

    Logger.INFO('UniversalApplicationModalManager инициализирован');
  },

  async _handleSubmit(e) {
    await FormUtils.submitForm(this.form, {
        apiClient: window.Services.apiClient,
        onSuccess: (result) => {
        this.form.classList.add('hidden-form');
        const success = document.querySelector(this.successSelector);
        if (success) success.classList.add('show');
        setTimeout(() => {
            if (typeof modalManager !== 'undefined') modalManager.close('universal');
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
  },

  resetForm() {
    FormUtils.resetForm(
      this.form,
      this.successSelector,
      this.fileUpload,
      this.validatorInstance
    );
  },

  destroy() {
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
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalApplicationModalManager;
}