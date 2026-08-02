/**
 * FormManager – создаёт обработчик для формы коммерческого предложения
 * ООО "ВД Инжиниринг"
 */
class FormManager {
  constructor(apiClient, rateLimiter) {
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
  }

  init() {
    // no-op
  }

  resetForm() {
    if (this.handler) this.handler.resetForm();
  }

  removeFile(index) {
    if (this.handler) this.handler.removeFile(index);
  }

  openModal() {
    if (typeof modalManager !== 'undefined') {
      modalManager.open('proposal');
    }
  }

  destroy() {
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
  }
}