/**
 * FormManager – создаёт обработчик для формы коммерческого предложения
 * ООО "Волга-Днепр Инжиниринг"
 */
class FormManager {
  constructor(apiClient, rateLimiter) {
    console.log('[FormManager] Constructor called');
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
    console.log('[FormManager] Handler initialized');
  }

  init() {
    console.log('[FormManager] init called (no-op)');
  }

  resetForm() {
    console.log('[FormManager] resetForm called');
    if (this.handler) this.handler.resetForm();
  }

  removeFile(index) {
    console.log('[FormManager] removeFile called with index:', index);
    if (this.handler) this.handler.removeFile(index);
  }

  openModal() {
    console.log('[FormManager] openModal called');
    if (typeof modalManager !== 'undefined') {
      modalManager.open('proposal');
    }
  }

  destroy() {
    console.log('[FormManager] destroy called');
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
  }
}