/**
 * Единый модуль валидации форм
 * ООО "Волга-Днепр Инжиниринг"
 */

const FormValidation = (function() {
  'use strict';

  const ERROR_MESSAGES = {
    required: 'Это поле обязательно для заполнения',
    email: 'Введите корректный email адрес',
    phone: 'Введите корректный номер телефона',
    minLength: (min) => `Минимальная длина — ${min} символов`,
    maxLength: (max) => `Максимальная длина — ${max} символов`,
    consent: 'Необходимо согласие на обработку данных',
    fileRequired: 'Пожалуйста, прикрепите файл',
    fileSize: (size) => `Максимальный размер файла: ${size}MB`,
    fileType: 'Недопустимый тип файла'
  };

  class FormValidator {
    constructor(formElement, options = {}) {
      if (!formElement || formElement.tagName !== 'FORM') {
        throw new Error('FormValidator требует элемент FORM');
      }

      this.form = formElement;
      this.options = {
        errorClass: options.errorClass || 'error-message',
        successClass: options.successClass || 'success-message',
        showClass: options.showClass || 'show',
        validateOnInput: options.validateOnInput !== undefined ? options.validateOnInput : true,
        messages: { ...ERROR_MESSAGES, ...options.messages }
      };

      this.errors = new Map();
      this.fields = new Map();
      
      this._init();
    }

    _init() {
      this._collectFields();
      
      if (this.options.validateOnInput) {
        this._attachInputListeners();
      } else {
        // Валидируем только при потере фокуса и отправке формы
        this._attachBlurListeners();
      }

      this.form.addEventListener('submit', (e) => this._handleSubmit(e));
    }

    _collectFields() {
      const fieldSelectors = [
        'input[type="text"]:not([type="hidden"])',
        'input[type="email"]',
        'input[type="tel"]',
        'input[type="password"]',
        'textarea',
        'select',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'input[type="file"]'
      ];

      const fields = this.form.querySelectorAll(fieldSelectors.join(', '));
      
      fields.forEach(field => {
        const name = field.name || field.id;
        if (!name) return;

        const rules = this._parseRules(field);
        this.fields.set(name, {
          element: field,
          rules,
          errors: []
        });
      });
    }

    _parseRules(field) {
      const rules = [];

      if (field.hasAttribute('required')) {
        rules.push({ type: 'required', message: this.options.messages.required });
      }

      if (field.type === 'email') {
        rules.push({ type: 'email', message: this.options.messages.email });
      }

      if (field.type === 'tel') {
        rules.push({ type: 'phone', message: this.options.messages.phone });
      }

      const minLength = field.getAttribute('minlength');
      if (minLength) {
        rules.push({ 
          type: 'minLength', 
          value: parseInt(minLength, 10),
          message: this.options.messages.minLength(parseInt(minLength, 10))
        });
      }

      const maxLength = field.getAttribute('maxlength');
      if (maxLength) {
        rules.push({ 
          type: 'maxLength', 
          value: parseInt(maxLength, 10),
          message: this.options.messages.maxLength(parseInt(maxLength, 10))
        });
      }

      if (field.type === 'checkbox' && (field.name.includes('consent') || field.id.includes('consent'))) {
        rules.push({ type: 'consent', message: this.options.messages.consent });
      }

      if (field.type === 'file' && field.hasAttribute('required')) {
        rules.push({ type: 'fileRequired', message: this.options.messages.fileRequired });
      }

      return rules;
    }

    _attachInputListeners() {
      this.fields.forEach((fieldData, name) => {
        const { element } = fieldData;
        
        const inputHandler = () => {
          this.validateField(name);
          this._clearError(name);
        };
        const blurHandler = () => {
          this.validateField(name);
        };
        
        const eventType = element.type === 'file' ? 'change' : 'input';
        element.addEventListener(eventType, inputHandler);
        element.addEventListener('blur', blurHandler);
        
        fieldData.handlers = { input: inputHandler, blur: blurHandler, eventType };
      });
      
      this._submitHandler = (e) => this._handleSubmit(e);
      this.form.addEventListener('submit', this._submitHandler);
    }

    _attachBlurListeners() {
      this.fields.forEach((fieldData, name) => {
        const { element } = fieldData;
        
        const blurHandler = () => {
          this.validateField(name);
        };
        element.addEventListener('blur', blurHandler);
        
        fieldData.handlers = { blur: blurHandler };
      });
      
      this._submitHandler = (e) => this._handleSubmit(e);
      this.form.addEventListener('submit', this._submitHandler);
    }

    _handleSubmit(e) {
      e.preventDefault();
      
      const isValid = this.validate();
      
      if (isValid) {
        this.form.dispatchEvent(new CustomEvent('form:valid', { 
          bubbles: true,
          detail: { formData: new FormData(this.form) }
        }));
      } else {
        this.form.dispatchEvent(new CustomEvent('form:invalid', { 
          bubbles: true,
          detail: { errors: this.errors }
        }));
      }

      return isValid;
    }

    validateField(name) {
      const fieldData = this.fields.get(name);
      if (!fieldData) return true;

      const { element, rules } = fieldData;
      const value = this._getFieldValue(element);
      const errors = [];

      for (const rule of rules) {
        const isValid = this._validateRule(value, rule, element);
        if (!isValid) {
          errors.push(rule.message);
        }
      }

      fieldData.errors = errors;
      
      if (errors.length > 0) {
        this._showError(name, errors[0]);
        return false;
      } else {
        this._clearError(name);
        return true;
      }
    }

    _getFieldValue(element) {
      if (element.type === 'checkbox') {
        return element.checked;
      }
      if (element.type === 'radio') {
        const radios = this.form.querySelectorAll(`input[name="${element.name}"]`);
        for (const radio of radios) {
          if (radio.checked) return radio.value;
        }
        return null;
      }
      if (element.type === 'file') {
        return element.files;
      }
      return element.value;
    }

    _validateRule(value, rule, element) {
      switch (rule.type) {
        case 'required':
          if (element.type === 'file') {
            return value && value.length > 0;
          }
          return Utils.Validator.required(value);
        case 'email':
          return Utils.Validator.email(value);
        case 'phone':
          return Utils.Validator.phone(value);
        case 'minLength':
          return Utils.Validator.minLength(value, rule.value);
        case 'maxLength':
          return Utils.Validator.maxLength(value, rule.value);
        case 'consent':
          return value === true;
        case 'fileRequired':
          return value && value.length > 0;
        default:
          return true;
      }
    }

    _showError(name, message) {
      const fieldData = this.fields.get(name);
      if (!fieldData) return;

      const { element } = fieldData;
      const errorId = `${name}Error`;
      let errorElement = document.getElementById(errorId);

      if (!errorElement) {
        errorElement = document.createElement('p');
        errorElement.id = errorId;
        errorElement.className = this.options.errorClass;
        
        if (element.type === 'checkbox' || element.type === 'radio') {
          element.parentElement.appendChild(errorElement);
        } else if (element.type === 'file') {
          const fileDrop = element.closest('.form-file');
          if (fileDrop) {
            fileDrop.parentElement.appendChild(errorElement);
          } else {
            element.parentElement?.appendChild(errorElement);
          }
        } else {
          element.parentElement?.appendChild(errorElement);
        }
      }

      errorElement.textContent = message;
      errorElement.classList.add('show');     
      element.setAttribute('aria-invalid', 'true');
      element.classList.add('error');
    }

    _clearError(name) {
      const fieldData = this.fields.get(name);
      if (!fieldData) return;

      const { element } = fieldData;
      const errorId = `${name}Error`;
      const errorElement = document.getElementById(errorId);

      if (errorElement) {
        errorElement.classList.remove('show');
      }

      element.removeAttribute('aria-invalid');
      element.classList.remove('error');
    }

    validate() {
      let isValid = true;
      let firstErrorField = null;

      this.fields.forEach((fieldData, name) => {
        const fieldValid = this.validateField(name);
        if (!fieldValid && !firstErrorField) {
          firstErrorField = fieldData.element;
        }
        isValid = isValid && fieldValid;
      });

      if (!isValid && firstErrorField) {
        firstErrorField.focus();
      }

      return isValid;
    }

    reset() {
      this.fields.forEach((_, name) => this._clearError(name));
      this.errors.clear();
    }

    getData() {
      if (!this.validate()) {
        return null;
      }

      const data = {};
      const formData = new FormData(this.form);
      formData.forEach((value, key) => {
        data[key] = value;
      });
      return data;
    }

    destroy() {
      if (this._submitHandler) {
        this.form.removeEventListener('submit', this._submitHandler);
        this._submitHandler = null;
      }
      
      this.fields.forEach((fieldData, name) => {
        const errorId = `${name}Error`;
        const errorElement = document.getElementById(errorId);
        if (errorElement && errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement);
        }
      });
      
      this.fields.forEach((fieldData) => {
        const { element, handlers } = fieldData;
        if (element && handlers) {
          if (handlers.eventType) {
            element.removeEventListener(handlers.eventType, handlers.input);
          }
          element.removeEventListener('blur', handlers.blur);
          fieldData.handlers = null;
        }
        fieldData.element = null;
      });
      this.fields.clear();
      this.errors.clear();
      this.form = null;
    }
  }

  const FileValidator = {
    validate(file, config = window.CONFIG?.FORM) {
      if (!file) return { valid: true };
      const result = Utils.Validator.file(file, config);
      if (!result.valid) {
        return { valid: false, message: result.error };
      }
      return { valid: true };
    },
    validateMultiple(files, config = window.CONFIG?.FORM) {
      const errors = [];
      for (const file of files) {
        const result = this.validate(file, config);
        if (!result.valid) {
          errors.push({ file: file.name, message: result.message });
        }
      }
      return { valid: errors.length === 0, errors };
    }
  };

  function createValidator(formElement, options = {}) {
    return new FormValidator(formElement, options);
  }

  return {
    FormValidator,
    FileValidator,
    createValidator,
    ERROR_MESSAGES
  };
})();

window.FormValidation = FormValidation;