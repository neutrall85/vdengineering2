/**
 * formUtils – утилиты для работы с формами (без состояния)
 * ООО "Волга-Днепр Инжиниринг"
 */
const FormUtils = {
  /**
   * Инициализация валидации формы через FormValidation
   * @param {HTMLFormElement} form
   * @param {Object} messages – кастомные сообщения
   * @param {boolean} validateOnInput
   * @returns {Object} validator – экземпляр FormValidator
   */
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

  /**
   * Инициализация загрузки файлов
   * @param {string|HTMLElement} dropSelector – селектор или элемент .form-file
   * @param {Function} onFilesChange – коллбэк при изменении списка файлов
   * @param {Object} options – { maxFiles, maxFileSize }
   * @returns {Object} { currentFiles, removeFile, renderFileList, fileDrop }
   */
  initFileUpload(dropSelector, onFilesChange, options = {}) {
    const fileDrop = typeof dropSelector === 'string'
      ? document.querySelector(dropSelector)
      : dropSelector;
    if (!fileDrop) {
      Logger?.WARN('Контейнер файлов не найден');
      return { currentFiles: [], removeFile: () => {}, renderFileList: () => {}, fileDrop: null };
    }

    const maxFiles = options.maxFiles || 10;
    const maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    let currentFiles = [];
    let uploadWarningTimeout = null;

    const fileInput = fileDrop.querySelector('input[type="file"]');
    if (!fileInput) {
      Logger?.WARN('Поле input[type="file"] не найдено');
      return { currentFiles: [], removeFile: () => {}, renderFileList: () => {}, fileDrop };
    }

    // Обработчики
    const changeHandler = (e) => {
      _handleFileSelect(e.target.files, fileDrop, currentFiles, maxFiles, maxFileSize, (newFiles) => {
        currentFiles = newFiles;
        _renderFileList(fileDrop, currentFiles, (index) => removeFile(index));
        if (onFilesChange) onFilesChange(currentFiles);
      });
    };

    const dragOverHandler = (e) => {
      e.preventDefault();
      fileDrop.style.borderColor = 'var(--vd-blue)';
      fileDrop.style.background = 'rgba(0, 51, 160, 0.05)';
    };
    const dragLeaveHandler = () => {
      fileDrop.style.borderColor = '';
      fileDrop.style.background = '';
    };
    const dropHandler = (e) => {
      e.preventDefault();
      fileDrop.style.borderColor = '';
      fileDrop.style.background = '';
      _handleFileSelect(e.dataTransfer.files, fileDrop, currentFiles, maxFiles, maxFileSize, (newFiles) => {
        currentFiles = newFiles;
        _renderFileList(fileDrop, currentFiles, (index) => removeFile(index));
        if (onFilesChange) onFilesChange(currentFiles);
      });
    };

    fileInput.addEventListener('change', changeHandler);
    fileDrop.addEventListener('dragover', dragOverHandler);
    fileDrop.addEventListener('dragleave', dragLeaveHandler);
    fileDrop.addEventListener('drop', dropHandler);

    // Функция удаления файла
    const removeFile = (index) => {
      const idx = parseInt(index, 10);
      if (!isNaN(idx) && idx >= 0 && idx < currentFiles.length) {
        currentFiles.splice(idx, 1);
        if (fileInput) fileInput.value = '';
        _renderFileList(fileDrop, currentFiles, removeFile);
        if (onFilesChange) onFilesChange(currentFiles);
      }
    };

    // Рендеринг списка
    const renderFileList = () => {
      _renderFileList(fileDrop, currentFiles, removeFile);
    };

    // Первоначальный рендеринг
    renderFileList();

    // Сохраняем обработчики для очистки
    fileDrop._handlers = { changeHandler, dragOverHandler, dragLeaveHandler, dropHandler };

    return {
      currentFiles,
      removeFile,
      renderFileList,
      fileDrop,
      fileInput
    };
  },

  /**
   * Отправка формы с обработкой состояния и rate limit
   * @param {HTMLFormElement} form
   * @param {Object} options – { apiClient, rateLimiter, onSuccess, onError, onFinally }
   * @param {Array} files – список файлов
   * @returns {Promise<void>}
   */
  async submitForm(form, options = {}, files = []) {
    const { apiClient, onSuccess, onError, onFinally } = options;
    if (!apiClient) {
        Logger?.ERROR('apiClient не передан');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn?.textContent || 'Отправить';
    let isSubmitting = true;
    let timeoutId = null;

    try {
        if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.replaceChildren();
        const spinner = document.createElement('div');
        spinner.classList.add('spinner');
        const loadingText = document.createElement('span');
        loadingText.textContent = 'Отправка...';
        submitBtn.appendChild(spinner);
        submitBtn.appendChild(loadingText);
        }

        timeoutId = setTimeout(() => {
        if (isSubmitting) {
            Logger.ERROR('Form submission timeout');
            if (onError) onError('Превышено время ожидания ответа сервера. Попробуйте позже.');
            _resetSubmitState(submitBtn, originalText);
            isSubmitting = false;
        }
        }, 30000);

        // Сбор данных
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
        if (value instanceof File) return;
        if (typeof value === 'string') {
            data[key] = Utils.Sanitizer.escapeHtml(value.trim());
        } else {
            data[key] = value;
        }
        });
        data.files = files.map(file => ({ name: file.name, size: file.size, type: file.type }));

        const csrfToken = form.querySelector('input[name="csrf_token"]')?.value || window.CONFIG?.CSRF_TOKEN || '';
        const result = await apiClient.submitForm(data, { 'X-CSRF-Token': csrfToken });

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

  /**
   * Сброс формы: скрыть сообщение об успехе, сбросить поля, ошибки, файлы
   * @param {HTMLFormElement} form
   * @param {string} successSelector
   * @param {Object} fileUpload – объект, возвращённый initFileUpload
   * @param {Object} validator – экземпляр FormValidator
   */
  resetForm(form, successSelector, fileUpload, validator) {
    if (!form) return;

    // Сброс полей
    form.reset();

    // Скрыть сообщение об успехе
    const successMsg = document.querySelector(successSelector);
    if (successMsg) successMsg.classList.remove('show');

    // Сброс файлов
    if (fileUpload) {
      fileUpload.currentFiles = [];
      if (fileUpload.fileInput) fileUpload.fileInput.value = '';
      fileUpload.renderFileList();
    }

    // Сброс ошибок валидации
    if (validator && typeof validator.reset === 'function') {
      validator.reset();
    }

    // Удалить класс hidden-form
    form.classList.remove('hidden-form');

    // Сброс чекбоксов согласия (если есть)
    form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    // Сброс предупреждения о лимите
    const rateWarning = form.querySelector('.rate-limit-warning');
    if (rateWarning) rateWarning.classList.remove('show');
  }
};

// ----- Вспомогательные внутренние функции -----

function _handleFileSelect(files, fileDrop, currentFiles, maxFiles, maxFileSize, onUpdate) {
  if (!files || files.length === 0) return;

  const errors = [];
  const validNewFiles = [];

  for (const file of Array.from(files)) {
    if (file.size > maxFileSize) {
      errors.push(`Файл "${file.name}" превышает ${maxFileSize / 1024 / 1024}MB`);
      continue;
    }
    const validation = Utils.Validator.file(file);
    if (!validation.valid) {
      errors.push(validation.error);
      continue;
    }
    const fileKey = `${file.name}:${file.size}`;
    const isDuplicate = currentFiles.some(f => `${f.name}:${f.size}` === fileKey);
    if (isDuplicate) {
      errors.push(`Файл "${file.name}" уже добавлен`);
      continue;
    }
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
      errors.push(`Добавлено ${space} из ${validNewFiles.length} файлов. Лимит ${maxFiles}.`);
    }
  }

  if (errors.length > 0) {
    _showUploadWarning(fileDrop, errors.join('; '));
  }

  const newFiles = [...currentFiles, ...filesToAdd];
  onUpdate(newFiles);
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
  btn.replaceChildren();
  btn.textContent = originalText;
}

// Экспорт
if (typeof window !== 'undefined') {
  window.FormUtils = FormUtils;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormUtils;
}