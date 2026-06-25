/**
 * formUtils – утилиты для работы с формами (без состояния)
 */
const fileUploadCache = new WeakMap();

const FormUtils = {
  initValidation(form, messages = {}, validateOnInput = true) {
    '[FormUtils] initValidation called');
    if (!form || typeof FormValidation === 'undefined') {
      Logger?.WARN('FormValidation не доступен');
      '[FormUtils] FormValidation not available');
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
    '[FormUtils] initFileUpload called with dropSelector:', dropSelector);
    const fileDrop = typeof dropSelector === 'string'
      ? document.querySelector(dropSelector)
      : dropSelector;
    if (!fileDrop) {
      Logger?.WARN('Контейнер файлов не найден');
      '[FormUtils] fileDrop not found');
      return { currentFiles: [], removeFile: () => {}, renderFileList: () => {}, fileDrop: null };
    }

    if (fileUploadCache.has(fileDrop)) {
      '[FormUtils] Returning cached fileUpload for', fileDrop);
      return fileUploadCache.get(fileDrop);
    }

    const maxFiles = options.maxFiles || 10;
    const maxTotalSize = options.maxTotalSize || 24 * 1024 * 1024;
    const state = { currentFiles: [] };

    const fileInput = fileDrop.querySelector('input[type="file"]');
    if (!fileInput) {
      Logger?.WARN('Поле input[type="file"] не найдено');
      '[FormUtils] fileInput not found');
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
      '[FormUtils] Removed old handlers');
    }

    const changeHandler = (e) => {
      '[FormUtils] file input change event, files:', e.target.files);
      _handleFileSelect(e.target.files, fileDrop, state.currentFiles, maxFiles, maxTotalSize, (newFiles) => {
        state.currentFiles = newFiles;
        '[FormUtils] currentFiles updated, count:', state.currentFiles.length);
        _renderFileList(fileDrop, state.currentFiles, (index) => removeFile(index));
        if (onFilesChange) onFilesChange(state.currentFiles);
      });
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
      '[FormUtils] drop event, files:', e.dataTransfer.files);
      _handleFileSelect(e.dataTransfer.files, fileDrop, state.currentFiles, maxFiles, maxTotalSize, (newFiles) => {
        state.currentFiles = newFiles;
        '[FormUtils] currentFiles updated (drop), count:', state.currentFiles.length);
        _renderFileList(fileDrop, state.currentFiles, (index) => removeFile(index));
        if (onFilesChange) onFilesChange(state.currentFiles);
      });
    };

    fileInput.addEventListener('change', changeHandler);
    fileDrop.addEventListener('dragover', dragOverHandler);
    fileDrop.addEventListener('dragleave', dragLeaveHandler);
    fileDrop.addEventListener('drop', dropHandler);

    const removeFile = (index) => {
      '[FormUtils] removeFile called with index:', index);
      const idx = parseInt(index, 10);
      if (!isNaN(idx) && idx >= 0 && idx < state.currentFiles.length) {
        state.currentFiles.splice(idx, 1);
        if (fileInput) fileInput.value = '';
        _renderFileList(fileDrop, state.currentFiles, removeFile);
        if (onFilesChange) onFilesChange(state.currentFiles);
      }
    };

    const renderFileList = () => {
      '[FormUtils] renderFileList called, current files count:', state.currentFiles.length);
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
      'Ошибка получения CSRF:', err);
      return null;
    }
  },

  async submitForm(form, options = {}, files = []) {
      '[FormUtils] submitForm called, files count:', files.length);
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
    
        let csrfToken = await FormUtils.fetchCsrfToken();
        if (!csrfToken) {
          if (onError) onError('Ошибка безопасности. Обновите страницу.');
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
          'Сервер вернул не JSON:', text.substring(0, 200));
          if (onError) onError('Ошибка на сервере. Проверьте логи.');
          return;
        }
    
        if (!response.ok) {
          const msg = result.error || result.errors?.join(', ') || 'Ошибка сервера';
          if (onError) onError(msg);
          return;
        }
    
        if (result.success) {
          '[FormUtils] Submission success:', result);
          if (onSuccess) onSuccess(result);
        } else {
          '[FormUtils] Submission failed:', result);
          if (onError) onError(result.error || 'Ошибка при отправке');
        }
      } catch (error) {
        Logger.ERROR('Form submission error:', error);
        '[FormUtils] Submission error:', error);
        if (onError) onError(error.message || 'Произошла ошибка. Попробуйте позже.');
      } finally {
        clearTimeout(timeoutId);
        _resetSubmitState(submitBtn, originalText);
        isSubmitting = false;
        if (onFinally) onFinally();
      }
    },

  resetForm(form, successSelector, fileUpload, validator) {
    '[FormUtils] resetForm called');
    if (!form) {
      '[FormUtils] resetForm: form is null');
      return;
    }
    form.reset();

    const successMsg = document.querySelector(successSelector);
    if (successMsg) successMsg.classList.remove('show');

    if (fileUpload) {
      '[FormUtils] resetForm: resetting fileUpload, before clear count:', fileUpload.currentFiles?.length || 0);
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
      '[FormUtils] resetForm: after clear count:', fileUpload.currentFiles?.length || 0);
      if (typeof fileUpload.renderFileList === 'function') {
        fileUpload.renderFileList();
      }
    } else {
      '[FormUtils] resetForm: fileUpload is null');
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
      '[FormUtils] resetForm: resetting validator');
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

function _handleFileSelect(files, fileDrop, currentFiles, maxFiles, maxTotalSize, onUpdate) {
  '[_handleFileSelect] Processing files:', files.length);
  if (!files || files.length === 0) return;
  const errors = [];
  const validNewFiles = [];

  let currentTotalSize = 0;
  for (const f of currentFiles) {
    currentTotalSize += f.size;
  }

  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop().toLowerCase();
    const allowedTypes = window.CONFIG?.FORM?.ALLOWED_FILE_TYPES || ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'];
    if (!allowedTypes.includes(ext)) {
      errors.push(`Недопустимый тип файла: ${file.name}`);
      continue;
    }
    if (file.type) {
      const allowedMimes = window.CONFIG?.FORM?.ALLOWED_MIME_TYPES || [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-zip-compressed',
        'multipart/x-zip'
      ];
      if (!allowedMimes.includes(file.type)) {
        errors.push(`Недопустимый MIME-тип: ${file.name}`);
        continue;
      }
    }
    const fileKey = `${file.name}:${file.size}`;
    const isDuplicate = currentFiles.some(f => `${f.name}:${f.size}` === fileKey);
    if (isDuplicate) {
      errors.push(`Файл "${file.name}" уже добавлен`);
      continue;
    }
    const newTotal = currentTotalSize + file.size;
    if (newTotal > maxTotalSize) {
      errors.push(`Общий размер файлов превышает ${maxTotalSize / 1024 / 1024} МБ. Файл "${file.name}" не добавлен.`);
      continue;
    }
    currentTotalSize = newTotal;
    validNewFiles.push(file);
  }

  const totalAfterAdd = currentFiles.length + validNewFiles.length;
  let filesToAdd = validNewFiles;
  if (totalAfterAdd > maxFiles) {
    const space = maxFiles - currentFiles.length;
    if (space <= 0) {
      errors.push(`Достигнут лимит файлов (${maxFiles}). Удалите старые файлы.`);
      filesToAdd = [];
    } else {
      filesToAdd = validNewFiles.slice(0, space);
      errors.push(`Добавлено ${space} из ${validNewFiles.length} файлов. Лимит: ${maxFiles}.`);
    }
  }

  if (errors.length > 0) {
    '[handleFileSelect] Errors:', errors);
    _showUploadWarning(fileDrop, errors.join('; '));
  }
  const newFiles = [...currentFiles, ...filesToAdd];
  '[handleFileSelect] newFiles count:', newFiles.length);
  onUpdate(newFiles);
}

function _renderFileList(fileDrop, currentFiles, removeFileFn) {
  '[_renderFileList] called, files count:', currentFiles.length);
  if (!fileDrop) return;
  let container = fileDrop.querySelector('.form-file-list');
  if (!container) {
    container = document.createElement('div');
    container.className = 'form-file-list';
    fileDrop.appendChild(container);
    '[_renderFileList] created new list container');
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
  '[showUploadWarning]', message);
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
  warningDiv.textContent = `⚠️ ${message}`;
  warningContainer.appendChild(warningDiv);
  warningContainer.classList.remove('form-file-limit-hidden');

  if (warningContainer._timeout) clearTimeout(warningContainer._timeout);
  warningContainer._timeout = setTimeout(() => {
    warningContainer.classList.add('form-file-limit-hidden');
  }, 3000);
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
    '[ModalFormHandler] Constructor called with options:', options);
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
      '[ModalFormHandler] Form not found:', formId);
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

    '[ModalFormHandler] Instance created for modal:', modalKey);
  }

  init() {
    '[ModalFormHandler] init() called');
    if (this._initialized) {
      '[ModalFormHandler] Already initialized, skipping');
      return;
    }
    if (!this.form) {
      '[ModalFormHandler] init: form is null');
      return;
    }

    this.validatorInstance = FormUtils.initValidation(this.form, this.messages);
    const fileDrop = this.form.querySelector(this.fileDropSelector);
    '[ModalFormHandler] fileDrop element:', fileDrop);
    if (fileDrop) {
      this.fileUpload = FormUtils.initFileUpload(fileDrop, null, {
        maxFiles: this.fileOptions.maxFiles || 10,
        maxTotalSize: this.fileOptions.maxTotalSize || 24 * 1024 * 1024
      });
      '[ModalFormHandler] fileUpload created:', this.fileUpload);
      if (this.fileUpload && typeof this.fileUpload.renderFileList === 'function') {
        this.fileUpload.renderFileList();
      }
    } else {
      '[ModalFormHandler] fileDrop not found');
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
    this._initConsentCheckboxes();

    this._initialized = true;
  }

  _initConsentCheckboxes() {
    const requiredCheckboxes = this.form.querySelectorAll('input[type="checkbox"][required]');
    const submitBtn = this.form.querySelector('button[type="submit"]');
    if (!submitBtn) return;
    const update = () => {
      submitBtn.disabled = !Array.from(requiredCheckboxes).every(cb => cb.checked);
    };
    requiredCheckboxes.forEach(cb => cb.addEventListener('change', update));
    update();
  }

  async _handleSubmit(e) {
    '[ModalFormHandler] _handleSubmit called');
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    if (this.rateLimiter && !this.rateLimiter.canProceed()) {
      const remaining = Math.ceil(this.rateLimiter.getRemainingTime() / 1000);
      this._defaultError(`Пожалуйста, подождите ${remaining} секунд перед следующей отправкой.`);
      this.isSubmitting = false;
      return;
    }

    const files = this.fileUpload ? this.fileUpload.currentFiles : [];
    '[ModalFormHandler] Files attached:', files.length);

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
    '[ModalFormHandler] _defaultSuccess called');
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
    } else {
      '[ModalFormHandler] modalManager not available');
    }
    
    if (typeof this.onSuccess === 'function') {
      this.onSuccess(result);
    }
  }

  _defaultError(msg) {
    '[ModalFormHandler] _defaultError:', msg);
    const warning = this.form.querySelector('.rate-limit-warning');
    if (warning) {
      if (warning.classList.contains('show')) return;
      warning.replaceChildren();
      const p = document.createElement('p');
      p.textContent = `⚠️ ${msg}`;
      warning.appendChild(p);
      warning.classList.add('show');
      setTimeout(() => {
        warning.classList.remove('show');
      }, 5000);
    } else {
      alert(msg);
    }
  }

  resetForm() {
    '[ModalFormHandler] resetForm called for modal:', this.modalKey);
    FormUtils.resetForm(this.form, this.successSelector, this.fileUpload, this.validatorInstance);
  }

  destroy() {
    '[ModalFormHandler] destroy called');
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