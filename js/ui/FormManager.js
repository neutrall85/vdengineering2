/**
 * FormManager – создаёт обработчик для формы коммерческого предложения
 * ООО "Волга-Днепр Инжиниринг"
 */
class FormManager {
  constructor(apiClient, rateLimiter) {
    '[FormManager] Constructor called');
    this.handler = new ModalFormHandler({
      formId: 'proposalForm',
      successSelector: '#successMessage',
      fileDropSelector: '.form-file',
      apiClient,
      rateLimiter,
      modalKey: 'proposal',
      fileOptions: { 
        maxFiles: 10, 
        maxTotalSize: 24 * 1024 * 1024
      },
      messages: {
        required: 'Это поле обязательно для заполнения',
        email: 'Введите корректный email адрес',
        phone: 'Введите корректный номер телефона'
      },
      onSuccess: null
    });
    this.handler.init();
    '[FormManager] Handler initialized');
  }

  init() {
    '[FormManager] init called (no-op)');
  }

  resetForm() {
    '[FormManager] resetForm called');
    if (this.handler) this.handler.resetForm();
  }

  removeFile(index) {
    '[FormManager] removeFile called with index:', index);
    if (this.handler) this.handler.removeFile(index);
  }

  openModal() {
    '[FormManager] openModal called');
    if (typeof modalManager !== 'undefined') {
      modalManager.open('proposal');
    }
  }

  destroy() {
    '[FormManager] destroy called');
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
  }
}