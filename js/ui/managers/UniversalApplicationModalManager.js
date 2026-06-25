const UniversalApplicationModalManager = {
  handler: null,

  init() {
    '[UniversalApplicationModalManager] init called');
    this.handler = new ModalFormHandler({
      formId: 'universalApplicationForm',
      successSelector: '#universalSuccessMessage',
      fileDropSelector: '.form-file',
      apiClient: window.Services.apiClient,
      rateLimiter: null,
      modalKey: 'universal',
      fileOptions: { 
        maxFiles: 5, 
        maxTotalSize: 24 * 1024 * 1024 // 24 MB общий размер
      },
      messages: {
        required: 'Это поле обязательно для заполнения',
        email: 'Введите корректный email адрес',
        phone: 'Введите корректный номер телефона',
        fileRequired: 'Пожалуйста, прикрепите резюме'
      },
      onSuccess: null // Убираем задержку
    });
    this.handler.init();
    '[UniversalApplicationModalManager] handler initialized');
  },

  resetForm() {
    '[UniversalApplicationModalManager] resetForm called');
    if (this.handler) this.handler.resetForm();
  },

  removeFile(index) {
    '[UniversalApplicationModalManager] removeFile called with index:', index);
    if (this.handler) this.handler.removeFile(index);
  },

  destroy() {
    '[UniversalApplicationModalManager] destroy called');
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UniversalApplicationModalManager;
}