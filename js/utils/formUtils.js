/**
 * formUtils – утилиты для работы с формами (без состояния)
 */
const fileUploadCache = new WeakMap();

const FormUtils = {
  initValidation(form, messages = {}, validateOnInput = true) {
    if (!form || typeof FormValidation === 'undefined') {
      Logger?.WARN('FormValidation не доступен');
      return null;
    }
    const defaultMessages = {
      required: 'Это поле обязательно для заполнения',
      email: 'Введите корректный email адрес',
      phone: 'Введите корректный номер телефона',
      minLength: (min) => `Минимальная длина — ${min} символов`,
      consent: 'Необходимо согласие на обработку данных'
    };
    return FormValidation.createValidator(form, {
      validateOnInput,
      messages: { ...defaultMessages, ...messages }
    });
  },

  initFileUpload(dropSelector, onFilesChange, options = {}) {
    const fileDrop = typeof dropSelector === 'string'
      ? document.querySelector(dropSelector)
      : dropSelector;
    if (!fileDrop) {
      Logger?.WARN('Контейнер файлов не найден');
      return { currentFiles: [], removeFile: () => {}, renderFileList: () => {}, fileDrop: null };
    }

    if (fileUploadCache.has(fileDrop)) {
      return fileUploadCache.get(fileDrop);
    }

    const maxFiles = options.maxFiles || 10;
    const maxTotalSize = options.maxTotalSize || 24 * 1024 * 1024;
    const state = { currentFiles: [] };

    const fileInput = fileDrop.querySelector('input[type="file"]');
    if (!fileInput) {
      Logger?.WARN('Поле input[type="file"] не найдено');
      return { currentFiles: state.currentFiles, removeFile: () => {}, renderFileList: () => {}, fileDrop };
    }

    if (fileDrop._handlers) {
      const { fileInput: oldInput, changeHandler, dragOverHandler, dragLeaveHandler, dropHandler } = fileDrop._handlers;
      if (oldInput) oldInput.removeEventListener('change', changeHandler);
      if (fileDrop) {
        fileDrop.removeEventListener('dragover', dragOverHandler);
        fileDrop.removeEventListener('dragleave', dragLeaveHandler);
        fileDrop.removeEventListener('drop', dropHandler);
      }
    }

    const allowedTypes = window.CONFIG?.FORM?.ALLOWED_FILE_TYPES || [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'ppt', 'pptx',
      'jpg', 'jpeg', 'png', 'gif'
    ];
    const allowedMimes = window.CONFIG?.FORM?.ALLOWED_MIME_TYPES || [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-zip-compressed',
      'multipart/x-zip',
      'application/octet-stream',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    const changeHandler = (e) => {
      _handleFileSelect(e.target.files, fileDrop, state.currentFiles, maxFiles, maxTotalSize, (newFiles) => {
        state.currentFiles = newFiles;
        _renderFileList(fileDrop, state.currentFiles, (index) => removeFile(index));
        if (onFilesChange) onFilesChange(state.currentFiles);
      }, allowedTypes, allowedMimes);
    };

    const dragOverHandler = (e) => {
      e.preventDefault();
      fileDrop.classList.add('drag-over');
    };
    const dragLeaveHandler = () => {
      fileDrop.classList.remove('drag-over');
    };
    const dropHandler = (e) => {
      e.preventDefault();
      fileDrop.classList.remove('drag-over');
      _handleFileSelect(e.dataTransfer.files, fileDrop, state.currentFiles, maxFiles, maxTotalSize, (newFiles) => {
        state.currentFiles = newFiles;
        _renderFileList(fileDrop, state.currentFiles, (index) => removeFile(index));
        if (onFilesChange) onFilesChange(state.currentFiles);
      }, allowedTypes, allowedMimes);
    };

    fileInput.addEventListener('change', changeHandler);
    fileDrop.addEventListener('dragover', dragOverHandler);
    fileDrop.addEventListener('dragleave', dragLeaveHandler);
    fileDrop.addEventListener('drop', dropHandler);

    const removeFile = (index) => {
      const idx = parseInt(index, 10);
      if (!isNaN(idx) && idx >= 0 && idx < state.currentFiles.length) {
        state.currentFiles.splice(idx, 1);
        if (fileInput) fileInput.value = '';
        _renderFileList(fileDrop, state.currentFiles, removeFile);
        if (onFilesChange) onFilesChange(state.currentFiles);
      }
    };

    const renderFileList = () => {
      _renderFileList(fileDrop, state.currentFiles, removeFile);
    };

    renderFileList();

    fileDrop._handlers = { fileInput, changeHandler, dragOverHandler, dragLeaveHandler, dropHandler };

    const result = {
      get currentFiles() { return state.currentFiles; },
      removeFile,
      renderFileList,
      fileDrop,
      fileInput
    };

    fileUploadCache.set(fileDrop, result);
    return result;
  },

  async fetchCsrfToken() {
    try {
      const response = await fetch('api/csrf_token.php');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      return data.csrf_token;
    } catch (err) {
      Logger.ERROR('Ошибка получения CSRF:', err);
      return null;
    }
  },

  async submitForm(form, options = {}, files = []) {
    const { onSuccess, onError, onFinally } = options;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Отправить';
    let isSubmitting = true;
    let timeoutId = null;
  
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Отправка... <span class="spinner"></span>';
      }
  
      timeoutId = setTimeout(() => {
        if (isSubmitting) {
          Logger.ERROR('Form submission timeout');
          if (onError) onError('Превышено время ожидания ответа сервера. Попробуйте позже.');
          _resetSubmitState(submitBtn, originalText);
          isSubmitting = false;
        }
      }, 30000);
  
      const formData = new FormData();
  
      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        if (input.type === 'file') return;
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.checked) formData.append(input.name, input.value);
        } else {
          formData.append(input.name, input.value);
        }
      });
  
      files.forEach(file => {
        formData.append('fileAttachment[]', file);
      });

      const dateReceived = formData.get('desiredDate');
      const dateApproval = formData.get('desiredApprovalDate');

      if (dateReceived && dateApproval) {
        const parseDate = (str) => {
          if (!str) return null;
          const parts = str.split('.');
          if (parts.length !== 3) return null;
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
          return new Date(year, month, day);
        };

        const receivedDate = parseDate(dateReceived);
        const approvalDate = parseDate(dateApproval);

        if (receivedDate && approvalDate && approvalDate < receivedDate) {
          const errorMsg = 'Дата одобрения не может быть раньше даты получения КП.';
          if (onError) onError(errorMsg);
          _resetSubmitState(submitBtn, originalText);
          isSubmitting = false;
          clearTimeout(timeoutId);
          return;
        }
      }

      let csrfToken = await FormUtils.fetchCsrfToken();
      if (!csrfToken) {
        if (onError) onError('Ошибка безопасности. Обновите страницу.');
        _resetSubmitState(submitBtn, originalText);
        isSubmitting = false;
        clearTimeout(timeoutId);
        return;
      }
      formData.append('csrf_token', csrfToken);
  
      const response = await fetch('/api/submit.php', {
        method: 'POST',
        body: formData
      });
  
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        Logger.ERROR('Сервер вернул не JSON:', text.substring(0, 200));
        if (onError) onError('Ошибка на сервере. Проверьте логи.');
        _resetSubmitState(submitBtn, originalText);
        isSubmitting = false;
        clearTimeout(timeoutId);
        return;
      }
  
      if (!response.ok) {
        const msg = result.error || result.errors?.join(', ') || 'Ошибка сервера';
        if (onError) onError(msg);
        _resetSubmitState(submitBtn, originalText);
        isSubmitting = false;
        clearTimeout(timeoutId);
        return;
      }
  
      if (result.success) {
        if (onSuccess) onSuccess(result);
      } else {
        if (onError) onError(result.error || 'Ошибка при отправке');
      }
    } catch (error) {
      Logger.ERROR('Form submission error:', error);
      if (onError) onError(error.message || 'Произошла ошибка. Попробуйте позже.');
    } finally {
      clearTimeout(timeoutId);
      _resetSubmitState(submitBtn, originalText);
      isSubmitting = false;
      if (onFinally) onFinally();
    }
  },

  resetForm(form, successSelector, fileUpload, validator) {
    if (!form) {
      Logger.WARN('resetForm: form is null');
      return;
    }
    form.reset();

    const successMsg = document.querySelector(successSelector);
    if (successMsg) successMsg.classList.remove('show');

    if (fileUpload) {
      if (Array.isArray(fileUpload.currentFiles)) {
        fileUpload.currentFiles.length = 0;
      }
      if (fileUpload.fileInput) {
        fileUpload.fileInput.value = '';
      }
      const listContainer = fileUpload.fileDrop?.querySelector('.form-file-list');
      if (listContainer) {
        listContainer.replaceChildren();
      }
      const textEl = fileUpload.fileDrop?.querySelector('.form-file-text');
      if (textEl) {
        textEl.textContent = 'Выбрать файл...';
      }
      const warning = fileUpload.fileDrop?.querySelector('.upload-warning-container');
      if (warning) {
        warning.classList.add('form-file-limit-hidden');
        warning.replaceChildren();
      }
      if (typeof fileUpload.renderFileList === 'function') {
        fileUpload.renderFileList();
      }
    } else {
      if (form) {
        const fileInput = form.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
        const fileList = form.querySelector('.form-file-list');
        if (fileList) fileList.replaceChildren();
        const fileText = form.querySelector('.form-file-text');
        if (fileText) fileText.textContent = 'Выбрать файл...';
        const warning = form.querySelector('.upload-warning-container');
        if (warning) {
          warning.classList.add('form-file-limit-hidden');
          warning.replaceChildren();
        }
      }
    }

    if (validator && typeof validator.reset === 'function') {
      validator.reset();
    }

    form.classList.remove('hidden-form');

    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    const rateWarning = form.querySelector('.rate-limit-warning');
    if (rateWarning) rateWarning.classList.remove('show');

    form.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"], textarea').forEach(el => {
      el.value = '';
      el.classList.remove('error');
      el.removeAttribute('aria-invalid');
    });

    form.querySelectorAll('select').forEach(el => {
      el.selectedIndex = 0;
      el.classList.remove('error');
      el.removeAttribute('aria-invalid');
    });
  }
};

function _handleFileSelect(files, fileDrop, currentFiles, maxFiles, maxTotalSize, onUpdate, allowedTypes, allowedMimes) {
  if (!files || files.length === 0) return;

  const defTypes = allowedTypes || window.CONFIG?.FORM?.ALLOWED_FILE_TYPES || [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip', 'ppt', 'pptx',
    'jpg', 'jpeg', 'png', 'gif'
  ];
  const defMimes = allowedMimes || window.CONFIG?.FORM?.ALLOWED_MIME_TYPES || [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  const formatList = defTypes.map(ext => ext.toUpperCase()).join(', ');
  const maxSizeMB = Math.round(maxTotalSize / 1024 / 1024);
  const maxFilesCount = maxFiles;

  const errors = [];
  const validNewFiles = [];
  let currentTotalSize = currentFiles.reduce((sum, f) => sum + f.size, 0);

  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!defTypes.includes(ext)) {
      errors.push(`Файл "${file.name}" не поддерживается. Разрешённые форматы: ${formatList}.`);
      continue;
    }
    if (file.type && !defMimes.includes(file.type)) {
      errors.push(`Файл "${file.name}" имеет неправильный тип. Разрешены только: ${formatList}.`);
      continue;
    }
    const fileKey = `${file.name}:${file.size}`;
    if (currentFiles.some(f => `${f.name}:${f.size}` === fileKey)) {
      errors.push(`Файл "${file.name}" уже добавлен.`);
      continue;
    }
    const newTotal = currentTotalSize + file.size;
    if (newTotal > maxTotalSize) {
      errors.push(`Файл "${file.name}" не добавлен. Общий размер не должен превышать ${maxSizeMB} МБ.`);
      continue;
    }
    currentTotalSize = newTotal;
    validNewFiles.push(file);
  }

  const totalAfterAdd = currentFiles.length + validNewFiles.length;
  let filesToAdd = validNewFiles;
  if (totalAfterAdd > maxFilesCount) {
    const space = maxFilesCount - currentFiles.length;
    if (space <= 0) {
      errors.push(`Достигнут лимит файлов (максимум ${maxFilesCount} файлов). Удалите лишние.`);
      filesToAdd = [];
    } else {
      filesToAdd = validNewFiles.slice(0, space);
      errors.push(`Добавлено только ${space} из ${validNewFiles.length} файлов (лимит ${maxFilesCount}).`);
    }
  }

  if (errors.length > 0) {
    _showUploadWarning(fileDrop, errors.join(' '));
  }
  onUpdate([...currentFiles, ...filesToAdd]);
}

function _renderFileList(fileDrop, currentFiles, removeFileFn) {
  if (!fileDrop) return;
  let container = fileDrop.querySelector('.form-file-list');
  if (!container) {
    container = document.createElement('div');
    container.className = 'form-file-list';
    fileDrop.appendChild(container);
  }
  container.replaceChildren();
  if (currentFiles.length === 0) {
    const text = fileDrop.querySelector('.form-file-text');
    if (text) text.textContent = 'Выбрать файл...';
  } else {
    currentFiles.forEach((file, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('form-file-item');
      itemDiv.setAttribute('data-index', index);

      const nameSpan = document.createElement('span');
      nameSpan.classList.add('form-file-item-name');
      nameSpan.textContent = file.name;

      const sizeSpan = document.createElement('span');
      sizeSpan.classList.add('form-file-item-size');
      sizeSpan.textContent = _formatFileSize(file.size);

      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.classList.add('form-file-item-remove');
      removeBtn.setAttribute('data-index', index);
      removeBtn.setAttribute('aria-label', 'Удалить файл');

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
      svg.appendChild(path);
      removeBtn.appendChild(svg);

      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeFileFn(index);
      });

      itemDiv.appendChild(nameSpan);
      itemDiv.appendChild(sizeSpan);
      itemDiv.appendChild(removeBtn);
      container.appendChild(itemDiv);
    });
    const text = fileDrop.querySelector('.form-file-text');
    if (text) text.textContent = `Выбрано файлов: ${currentFiles.length}`;
  }
}

function _formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function _showUploadWarning(fileDrop, message) {
  if (!fileDrop) return;
  let warningContainer = fileDrop.querySelector('.upload-warning-container');
  if (!warningContainer) {
    warningContainer = document.createElement('div');
    warningContainer.className = 'upload-warning-container';
    const input = fileDrop.querySelector('input[type="file"]');
    if (input && input.nextSibling) {
      fileDrop.insertBefore(warningContainer, input.nextSibling);
    } else {
      fileDrop.insertBefore(warningContainer, fileDrop.firstChild);
    }
  }
  warningContainer.replaceChildren();
  const warningDiv = document.createElement('div');
  warningDiv.className = 'upload-warning';
  const parts = message.split('. ').filter(s => s.trim());
  if (parts.length > 1) {
    const list = document.createElement('ul');
    parts.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text.trim();
      list.appendChild(li);
    });
    warningDiv.appendChild(list);
  } else {
    warningDiv.textContent = `⚠️ ${message}`;
  }
  warningContainer.appendChild(warningDiv);
  warningContainer.classList.remove('form-file-limit-hidden');

  if (warningContainer._timeout) clearTimeout(warningContainer._timeout);
  warningContainer._timeout = setTimeout(() => {
    warningContainer.classList.add('form-file-limit-hidden');
  }, 6000);
}

function _resetSubmitState(btn, originalText) {
  if (!btn) return;
  btn.disabled = false;
  btn.innerHTML = originalText;
}

// ============================================================
// УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК ФОРМ В МОДАЛКАХ
// ============================================================
class ModalFormHandler {
  constructor(options) {
    const {
      formId,
      successSelector,
      fileDropSelector,
      apiClient,
      rateLimiter,
      modalKey,
      validator = window.Utils?.Validator,
      fileOptions = {},
      messages = {},
      onSuccess = null,
      onError = null,
      onFinally = null,
    } = options;

    this.form = document.getElementById(formId);
    if (!this.form) {
      Logger?.WARN(`ModalFormHandler: форма с id "${formId}" не найдена`);
      return;
    }

    this.successSelector = successSelector;
    this.fileDropSelector = fileDropSelector;
    this.apiClient = apiClient;
    this.rateLimiter = rateLimiter;
    this.modalKey = modalKey;
    this.validator = validator;
    this.fileOptions = fileOptions;
    this.messages = messages;
    this.onSuccess = onSuccess || null;
    this.onError = onError || this._defaultError.bind(this);
    this.onFinally = onFinally || (() => {});

    this.validatorInstance = null;
    this.fileUpload = null;
    this.isSubmitting = false;
    this._boundSubmitHandler = null;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    if (!this.form) {
      Logger.WARN('init: form is null');
      return;
    }

    this.validatorInstance = FormUtils.initValidation(this.form, {
      ...this.messages,
      validateOnInput: false
    });

    const fileDrop = this.form.querySelector(this.fileDropSelector);
    if (fileDrop) {
      this.fileUpload = FormUtils.initFileUpload(fileDrop, null, {
        maxFiles: this.fileOptions.maxFiles || 10,
        maxTotalSize: this.fileOptions.maxTotalSize || 24 * 1024 * 1024
      });
      if (this.fileUpload && typeof this.fileUpload.renderFileList === 'function') {
        this.fileUpload.renderFileList();
      }
    }

    this._boundSubmitHandler = (e) => this._handleSubmit(e);
    this.form.addEventListener('form:valid', this._boundSubmitHandler);

    const phoneInput = this.form.querySelector('input[type="tel"]');
    if (phoneInput && window.Utils?.PhoneUtils) {
      window.Utils.PhoneUtils.setupAutoPrefix(phoneInput);
    }

    const csrfInput = this.form.querySelector('input[name="csrf_token"]');
    if (csrfInput && window.CONFIG?.CSRF_TOKEN) {
      csrfInput.value = window.CONFIG.CSRF_TOKEN;
    }

    const dateInputs = this.form.querySelectorAll('#desiredDate, #desiredApprovalDate');
    dateInputs.forEach(input => {
      if (input && typeof DateInputHelper !== 'undefined' && DateInputHelper.initDateInput) {
        DateInputHelper.initDateInput(input);
      }
    });

    this._initConsentCheckboxes();
    this._initDateValidation();

    this._initialized = true;
  }

  _initDateValidation() {
    const dateReceived = this.form.querySelector('#desiredDate');
    const dateApproval = this.form.querySelector('#desiredApprovalDate');
    const errorEl = this.form.querySelector('#dateOrderError');

    if (!dateReceived || !dateApproval || !errorEl) return;

    const parseDate = (str) => {
      if (!str) return null;
      if (typeof DateInputHelper !== 'undefined' && DateInputHelper._parseDisplayDate) {
        return DateInputHelper._parseDisplayDate(str);
      }
      const parts = str.split('.');
      if (parts.length !== 3) return null;
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (year < 100) {
        const fullYear = new Date().getFullYear();
        const century = Math.floor(fullYear / 100) * 100;
        let y = century + year;
        if (y < fullYear - 80) y += 100;
        year = y;
      }
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    };

    const validateDates = () => {
      const receivedVal = dateReceived.value.trim();
      const approvalVal = dateApproval.value.trim();

      if (!approvalVal) {
        errorEl.classList.remove('show');
        this._updateSubmitButton();
        return;
      }

      const receivedDate = parseDate(receivedVal);
      const approvalDate = parseDate(approvalVal);

      if (!receivedDate || !approvalDate) {
        errorEl.classList.remove('show');
        this._updateSubmitButton();
        return;
      }

      if (approvalDate < receivedDate) {
        errorEl.textContent = 'Дата одобрения не может быть раньше даты получения КП.';
        errorEl.classList.add('show');
      } else {
        errorEl.classList.remove('show');
      }
      this._updateSubmitButton();
    };

    dateReceived.addEventListener('input', validateDates);
    dateReceived.addEventListener('blur', validateDates);
    dateApproval.addEventListener('input', validateDates);
    dateApproval.addEventListener('blur', validateDates);

    validateDates();

    this._dateValidationHandlers = { dateReceived, dateApproval, validateDates };
  }

  _updateSubmitButton() {
    const submitBtn = this.form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    const requiredCheckboxes = this.form.querySelectorAll('input[type="checkbox"][required]');
    const allChecked = Array.from(requiredCheckboxes).every(cb => cb.checked);

    const errorEl = this.form.querySelector('#dateOrderError');
    const hasDateError = errorEl ? errorEl.classList.contains('show') : false;

    submitBtn.disabled = !allChecked || hasDateError;
  }

  _initConsentCheckboxes() {
    const requiredCheckboxes = this.form.querySelectorAll('input[type="checkbox"][required]');
    const submitBtn = this.form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    const update = () => {
      this._updateSubmitButton();
    };

    requiredCheckboxes.forEach(cb => {
      cb.addEventListener('change', update);
    });
    update();
  }

  async _handleSubmit(e) {
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    if (this.rateLimiter && !this.rateLimiter.canProceed()) {
      const remaining = Math.ceil(this.rateLimiter.getRemainingTime() / 1000);
      this._defaultError(`Пожалуйста, подождите ${remaining} секунд перед следующей отправкой.`);
      this.isSubmitting = false;
      return;
    }

    const files = this.fileUpload ? this.fileUpload.currentFiles : [];

    await FormUtils.submitForm(this.form, {
      onSuccess: (result) => {
        this._defaultSuccess(result);
      },
      onError: (msg) => {
        this._defaultError(msg);
      },
      onFinally: () => {
        this.isSubmitting = false;
        this.onFinally();
      }
    }, files);

    if (this.rateLimiter) this.rateLimiter.record();
  }

  _defaultSuccess(result) {
    this.form.classList.add('hidden-form');
    const success = document.querySelector(this.successSelector);
    if (success) success.classList.remove('show');
    
    if (this.modalKey && typeof modalManager !== 'undefined') {
      modalManager.close(this.modalKey);
    }
    
    if (typeof modalManager !== 'undefined') {
      modalManager.open('success');
      setTimeout(() => {
        if (typeof modalManager !== 'undefined') {
          modalManager.close('success');
        }
      }, 3000);
    }
    
    if (typeof this.onSuccess === 'function') {
      this.onSuccess(result);
    }
  }

  _defaultError(msg) {
    let userMessage = msg;
    if (msg.includes('CSRF') || msg.includes('token')) {
      userMessage = 'Ошибка безопасности. Обновите страницу и попробуйте снова.';
    } else if (msg.includes('размер') || msg.includes('size')) {
      const maxSize = this.fileOptions.maxTotalSize ? Math.round(this.fileOptions.maxTotalSize / 1024 / 1024) : 24;
      userMessage = `Файл слишком большой. Максимальный размер – ${maxSize} МБ.`;
    } else if (msg.includes('тип') || msg.includes('format') || msg.includes('расширение')) {
      const formats = window.CONFIG?.FORM?.ALLOWED_FILE_TYPES || ['PDF', 'DOC', 'DOCX', 'XLS', 'XLSX', 'ZIP', 'PPT', 'PPTX', 'JPG', 'PNG', 'GIF'];
      userMessage = `Неподдерживаемый формат файла. Разрешены: ${formats.map(f => f.toUpperCase()).join(', ')}.`;
    } else if (msg.includes('сервера') || msg.includes('позже')) {
      userMessage = 'Ошибка на сервере. Пожалуйста, попробуйте позже.';
    }

    const warning = this.form.querySelector('.rate-limit-warning');
    if (warning) {
      warning.replaceChildren();
      const p = document.createElement('p');
      p.textContent = `⚠️ ${userMessage}`;
      warning.appendChild(p);
      warning.classList.add('show');
      setTimeout(() => warning.classList.remove('show'), 6000);
    } else {
      alert(userMessage);
    }
  }

  resetForm() {
    FormUtils.resetForm(this.form, this.successSelector, this.fileUpload, this.validatorInstance);
  }

  destroy() {
    if (this._boundSubmitHandler) {
      this.form?.removeEventListener('form:valid', this._boundSubmitHandler);
      this._boundSubmitHandler = null;
    }
    if (this.fileUpload) {
      this.fileUpload = null;
    }
    if (this.validatorInstance) {
      this.validatorInstance.destroy?.();
      this.validatorInstance = null;
    }
    this.form = null;
    this._initialized = false;
  }
}

// Экспорт
if (typeof window !== 'undefined') {
  window.FormUtils = FormUtils;
  window.ModalFormHandler = ModalFormHandler;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormUtils;
  module.exports.ModalFormHandler = ModalFormHandler;
}

// ============================================================
// DateInputHelper с поддержкой visualViewport и оверлеем (улучшенная версия)
// ============================================================
const DateInputHelper = {
  initDateInput: function(input, options) {
    if (!input || input._datePickerInitialized) return;
    input._datePickerInitialized = true;

    const { onSelect = null } = options || {};
    let picker = null;
    let overlay = null;
    let isVisible = false;
    let closeTimeout = null;
    let scrollCleanup = null;
    let repositionTimeout = null;

    const createPicker = () => {
      const container = document.createElement('div');
      container.className = 'date-picker';

      const header = document.createElement('div');
      header.className = 'date-picker-header';

      const monthSelect = document.createElement('select');
      monthSelect.className = 'date-picker-month-select';
      const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
      months.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = m;
        monthSelect.appendChild(opt);
      });

      const yearSelect = document.createElement('select');
      yearSelect.className = 'date-picker-year-select';
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 10; y <= currentYear + 10; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      }

      const navDiv = document.createElement('div');
      navDiv.className = 'date-picker-nav';
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '‹';
      prevBtn.setAttribute('aria-label', 'Предыдущий месяц');
      const nextBtn = document.createElement('button');
      nextBtn.textContent = '›';
      nextBtn.setAttribute('aria-label', 'Следующий месяц');
      navDiv.appendChild(prevBtn);
      navDiv.appendChild(nextBtn);

      header.appendChild(monthSelect);
      header.appendChild(yearSelect);
      header.appendChild(navDiv);
      container.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'date-picker-grid';
      container.appendChild(grid);
      document.body.appendChild(container);

      const render = (date, selectedDate) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        monthSelect.value = month;
        yearSelect.value = year;
        grid.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(day => {
          const cell = document.createElement('div');
          cell.className = 'day-name';
          cell.textContent = day;
          grid.appendChild(cell);
        });

        let firstDay = new Date(year, month, 1).getDay();
        firstDay = firstDay === 0 ? 6 : firstDay - 1;
        for (let i = 0; i < firstDay; i++) {
          const empty = document.createElement('div');
          empty.className = 'day-cell empty';
          grid.appendChild(empty);
        }

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const cell = document.createElement('div');
          cell.className = 'day-cell';
          cell.textContent = d;
          const dateObj = new Date(year, month, d);
          dateObj.setHours(0, 0, 0, 0);

          if (dateObj < today) {
            cell.classList.add('disabled');
            cell.style.opacity = '0.4';
            cell.style.cursor = 'not-allowed';
          } else {
            if (dateObj.getTime() === today.getTime()) {
              cell.classList.add('today');
            }
            if (selectedDate && dateObj.getTime() === selectedDate.getTime()) {
              cell.classList.add('selected');
            }
            cell.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              const selected = new Date(year, month, d);
              const formatted = DateInputHelper._formatDate(selected);
              input.value = formatted;
              if (typeof onSelect === 'function') onSelect(selected, formatted);
              closePicker();
              input.dispatchEvent(new Event('input', { bubbles: true }));
            });
          }
          grid.appendChild(cell);
        }
      };

      const changeMonth = (delta) => {
        const newDate = new Date(+yearSelect.value, +monthSelect.value + delta, 1);
        render(newDate, getSelectedDateFromInput());
      };
      prevBtn.addEventListener('click', e => { e.stopPropagation(); changeMonth(-1); });
      nextBtn.addEventListener('click', e => { e.stopPropagation(); changeMonth(1); });
      monthSelect.addEventListener('change', () => {
        render(new Date(+yearSelect.value, +monthSelect.value, 1), getSelectedDateFromInput());
      });
      yearSelect.addEventListener('change', () => {
        render(new Date(+yearSelect.value, +monthSelect.value, 1), getSelectedDateFromInput());
      });

      document.addEventListener('click', function(e) {
        if (picker && !picker.contains(e.target) && e.target !== input) {
          closePicker();
        }
      });

      const getSelectedDateFromInput = () => {
        const val = input.value.trim();
        if (!val) return null;
        const parts = val.split('.');
        if (parts.length !== 3) return null;
        let day = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        let year = parseInt(parts[2], 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date;
      };

      let initialDate = new Date();
      const selected = getSelectedDateFromInput();
      if (selected) initialDate = selected;
      container._render = render;
      render(initialDate, selected);
      return container;
    };

    const ensureOverlay = () => {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'date-picker-overlay';
        overlay.style.display = 'none';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
          e.stopPropagation();
          closePicker();
        });
      }
      return overlay;
    };

    const repositionPicker = () => {
      if (!picker) return;
      // Получаем координаты поля
      let rect = input.getBoundingClientRect();
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      
      // Если поле скрыто – используем fallback
      if (rect.height === 0 || rect.width === 0) {
        const clientRects = input.getClientRects();
        if (clientRects.length > 0) {
          rect = clientRects[0];
        } else {
          rect = {
            top: viewportHeight / 2 - 100,
            bottom: viewportHeight / 2 + 100,
            left: viewportWidth / 2 - 100,
            right: viewportWidth / 2 + 100,
            width: 200,
            height: 200
          };
        }
      }

      const isMobile = window.innerWidth <= 480;
      let topPos = rect.bottom + window.scrollY + 8;
      const spaceBelow = viewportHeight - rect.bottom - 8;
      const pickerHeight = picker.offsetHeight || 260;
      
      // Если снизу не хватает места – ставим сверху
      if (spaceBelow < pickerHeight) {
        let newTop = rect.top + window.scrollY - pickerHeight - 8;
        if (newTop < 10) newTop = 10;
        topPos = newTop;
      }

      // Применяем позицию
      picker.style.setProperty('--picker-top', topPos + 'px');
      
      if (isMobile) {
        picker.style.removeProperty('--picker-left');
        picker.style.left = '50%';
        picker.style.transform = 'translateX(-50%)';
        // Убедимся, что календарь не выходит за левый и правый край
        const pickerWidth = picker.offsetWidth || 260;
        if (pickerWidth > viewportWidth - 20) {
          picker.style.left = '10px';
          picker.style.transform = 'none';
          picker.style.right = '10px';
          picker.style.width = 'auto';
          picker.style.maxWidth = viewportWidth - 20 + 'px';
        }
      } else {
        let leftPos = rect.left + window.scrollX;
        if (leftPos + 260 > viewportWidth) {
          leftPos = viewportWidth - 280;
        }
        if (leftPos < 10) leftPos = 10;
        picker.style.setProperty('--picker-left', leftPos + 'px');
        picker.style.left = '';
        picker.style.transform = '';
        picker.style.right = '';
        picker.style.width = '';
        picker.style.maxWidth = '';
      }
    };

    const closePicker = () => {
      if (closeTimeout) clearTimeout(closeTimeout);
      if (repositionTimeout) clearTimeout(repositionTimeout);
      if (picker) {
        picker.classList.remove('visible');
        isVisible = false;
        if (picker._resizeHandler) {
          window.removeEventListener('resize', picker._resizeHandler);
          picker._resizeHandler = null;
        }
        if (picker._viewportHandler && window.visualViewport) {
          window.visualViewport.removeEventListener('resize', picker._viewportHandler);
          picker._viewportHandler = null;
        }
        if (picker._scrollHandler) {
          window.removeEventListener('scroll', picker._scrollHandler);
          picker._scrollHandler = null;
        }
      }
      if (overlay) {
        overlay.classList.remove('active');
        overlay.style.display = 'none';
      }
      if (scrollCleanup) {
        scrollCleanup();
        scrollCleanup = null;
      }
    };

    const openPicker = () => {
      if (!picker) {
        picker = createPicker();
      }
      // Показываем календарь
      picker.classList.add('visible');
      isVisible = true;
      
      // Сначала позиционируем сразу
      repositionPicker();
      
      // Затем через небольшую задержку повторяем позиционирование (для клавиатуры)
      if (repositionTimeout) clearTimeout(repositionTimeout);
      repositionTimeout = setTimeout(() => {
        if (isVisible) repositionPicker();
        repositionTimeout = null;
      }, 300);

      // Оверлей
      ensureOverlay();
      overlay.style.display = 'block';
      requestAnimationFrame(() => {
        overlay.classList.add('active');
      });

      // Подписка на visualViewport (клавиатура)
      if (window.visualViewport) {
        const onViewportResize = () => {
          if (isVisible) repositionPicker();
        };
        window.visualViewport.addEventListener('resize', onViewportResize);
        picker._viewportHandler = onViewportResize;
      }

      // Подписка на resize окна
      let resizeTimeout = null;
      const onResize = () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          if (isVisible) repositionPicker();
          resizeTimeout = null;
        }, 100);
      };
      window.addEventListener('resize', onResize);
      picker._resizeHandler = onResize;

      // Подписка на scroll (для случаев, когда клавиатура вызывает скролл)
      let scrollTimeout = null;
      const onScroll = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          if (isVisible) repositionPicker();
          scrollTimeout = null;
        }, 50);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      picker._scrollHandler = onScroll;

      // Обработчики скролла внутри родительских контейнеров
      const scrollableParents = [];
      let parent = input.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          scrollableParents.push(parent);
        }
        parent = parent.parentElement;
      }

      const handlers = [];
      const windowHandler = () => { if (isVisible) closePicker(); };
      window.addEventListener('scroll', windowHandler, { passive: true });
      handlers.push({ element: window, handler: windowHandler });

      scrollableParents.forEach(parent => {
        const handler = () => { if (isVisible) closePicker(); };
        parent.addEventListener('scroll', handler, { passive: true });
        handlers.push({ element: parent, handler: handler });
      });

      scrollCleanup = () => {
        handlers.forEach(({ element, handler }) => {
          element.removeEventListener('scroll', handler);
        });
        handlers.length = 0;
      };
    };

    // Обработчики событий (input, blur, focus, click) - без изменений
    input.addEventListener('input', function() {
      let digits = this.value.replace(/\D/g, '');
      if (digits.length > 8) digits = digits.slice(0, 8);
      let masked = '';
      for (let i = 0; i < digits.length; i++) {
        if (i === 2 || i === 4) masked += '.';
        masked += digits[i];
      }
      if (this.value !== masked) {
        this.value = masked;
        this.setSelectionRange(masked.length, masked.length);
        digits = masked.replace(/\D/g, '');
      }

      const prevLen = this._prevLen || 0;
      const isDeleting = digits.length < prevLen;
      this._prevLen = digits.length;

      if (digits.length === 6 && !isDeleting) {
        const day = digits.slice(0, 2);
        const month = digits.slice(2, 4);
        const yearShort = digits.slice(4, 6);
        const fullYear = new Date().getFullYear();
        const century = Math.floor(fullYear / 100) * 100;
        let yearFull = century + parseInt(yearShort, 10);
        if (yearFull < fullYear - 80) yearFull += 100;
        const dateObj = new Date(yearFull, parseInt(month, 10) - 1, parseInt(day, 10));
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dateObj >= today) {
          const newFormatted = `${day}.${month}.${yearFull}`;
          this.value = newFormatted;
          this.setSelectionRange(newFormatted.length, newFormatted.length);
          digits = newFormatted.replace(/\D/g, '');
          this._prevLen = digits.length;
        }
      }

      if (picker && picker._render && isVisible) {
        const val = this.value.trim();
        let displayDate = null;
        let selectedDate = null;
        let day = null, month = null, year = null;
        const parts = val.split('.');
        if (parts.length >= 1 && parts[0].length > 0) day = parseInt(parts[0], 10);
        if (parts.length >= 2 && parts[1].length > 0) month = parseInt(parts[1], 10) - 1;
        if (parts.length >= 3 && parts[2].length > 0) {
          year = parseInt(parts[2], 10);
          if (year < 100) {
            const fullYear = new Date().getFullYear();
            const century = Math.floor(fullYear / 100) * 100;
            let y = century + year;
            if (y < fullYear - 80) y += 100;
            year = y;
          }
        }
        const now = new Date();
        const displayDay = (day !== null && !isNaN(day)) ? day : 1;
        const displayMonth = (month !== null && !isNaN(month)) ? month : now.getMonth();
        const displayYear = (year !== null && !isNaN(year)) ? year : now.getFullYear();
        displayDate = new Date(displayYear, displayMonth, 1);
        if (day !== null && !isNaN(day)) {
          const yearForDate = (year !== null && !isNaN(year)) ? year : now.getFullYear();
          const monthForDate = (month !== null && !isNaN(month)) ? month : now.getMonth();
          const testDate = new Date(yearForDate, monthForDate, day);
          if (!isNaN(testDate.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (testDate >= today) {
              selectedDate = new Date(yearForDate, monthForDate, day);
              selectedDate.setHours(0, 0, 0, 0);
            }
          }
        }
        if (val.length === 0) {
          displayDate = new Date();
          selectedDate = null;
        }
        if (displayDate) {
          picker._render(displayDate, selectedDate);
        }
      }

      if (this.value.length === 10 && picker && isVisible) {
        setTimeout(closePicker, 20);
      }
    });

    input.addEventListener('blur', function() {
      const val = this.value.trim();
      if (!val) return;
      const parts = val.split('.');
      if (parts.length !== 3) return;
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (isNaN(day) || isNaN(month) || isNaN(year)) return;
      const dateObj = new Date(year, month, day);
      if (isNaN(dateObj.getTime())) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dateObj < today) {
        const todayFormatted = DateInputHelper._formatDate(today);
        this.value = todayFormatted;
        this.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof onSelect === 'function') onSelect(today, todayFormatted);
        if (picker && picker._render) picker._render(today, today);
      }
    });

    input.addEventListener('focus', function() {
      if (this.value) {
        const parsed = DateInputHelper._parseDisplayDate(this.value);
        if (parsed) {
          parsed.setHours(0, 0, 0, 0);
          if (picker && picker._render) picker._render(parsed, parsed);
        }
      }
      openPicker();
    });

    input.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!isVisible) openPicker();
    });

    input.addEventListener('blur', function(e) {
      const related = e.relatedTarget;
      if (related && picker && picker.contains(related)) return;
      closeTimeout = setTimeout(() => {
        if (picker && !picker.contains(document.activeElement)) {
          closePicker();
        }
      }, 150);
    });

    input._datePicker = picker;
    input._cleanupDatePicker = () => {
      closePicker();
      if (scrollCleanup) scrollCleanup();
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
    };
  },

  _formatDate: function(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${date.getFullYear()}`;
  },

  _parseDisplayDate: function(value) {
    if (!value) return null;
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    const date = new Date(y, m, d);
    return (date.getFullYear() === y && date.getMonth() === m && date.getDate() === d) ? date : null;
  }
};

if (typeof window !== 'undefined') {
  window.DateInputHelper = DateInputHelper;
}