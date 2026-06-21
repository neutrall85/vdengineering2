/**
 * Объединённые утилиты: DOM, Валидация, Форматирование, Лимитирование
 * ООО "Волга-Днепр Инжиниринг"
 */

const Utils = (function() {
  // ========== DOM утилиты ==========
  const DOM = {
    createElement(tag, attributes = {}, children = []) {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
          element.className = value;
        } else if (key === 'dataset') {
          Object.entries(value).forEach(([dataKey, dataValue]) => {
            element.dataset[dataKey] = dataValue;
          });
        } else if (key === 'on' && typeof value === 'object') {
          Object.entries(value).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
          });
        } else {
          element.setAttribute(key, value);
        }
      });
      children.forEach(child => {
        if (typeof child === 'string') {
          element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          element.appendChild(child);
        }
      });
      return element;
    },

    createSVG(path, width = 24, height = 24, className = '') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      if (className) svg.classList.add(className);
      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathElement.setAttribute('d', path);
      svg.appendChild(pathElement);
      return svg;
    },

    getElement(id) {
      const element = document.getElementById(id);
      if (!element && window.CONFIG?.DEBUG) {
      }
      return element || null;
    },

    query(selector, context = document) {
      return context.querySelector(selector);
    },

    queryAll(selector, context = document) {
      return Array.from(context.querySelectorAll(selector));
    },

    trapFocus(element) {
      const focusable = this.queryAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        element
      );
      if (focusable.length === 0) return null;
      
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      
      const handler = (e) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      
      element.addEventListener('keydown', handler);
      return () => element.removeEventListener('keydown', handler);
    },

    // Удалено: используйте ScrollManager.lock()/unlock() вместо этого метода
    // toggleBodyScroll(disable) { ... }

    setAttributes(element, attributes) {
      Object.entries(attributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          element.setAttribute(key, value);
        }
      });
    }
    // Удалены методы addClass, removeClass, hasClass, toggleClass
    // Используйте нативный element.classList.add/remove/toggle/contains вместо них
  };

  // ========== Санитизация HTML ==========
  const Sanitizer = {
    // Базовое экранирование HTML
    escapeHtml(str) {
      if (str == null) return '';
      str = String(str);
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // Разрешенные теги и атрибуты для безопасного рендеринга
    sanitizeHtml(html, options = {}) {
      if (!html) return '';
      
      const allowedTags = options.allowedTags || [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4',
        'ul', 'ol', 'li', 'a', 'span', 'div', 'img', 'table', 'tr', 'td', 'th'
      ];
      
      const allowedAttributes = options.allowedAttributes || {
        'a': ['href', 'target', 'rel'],
        'img': ['src', 'alt', 'width', 'height'],
        '*': ['class', 'id']
      };
      
      // Используем DOMParser для безопасного парсинга
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Рекурсивная очистка узлов
      const cleanNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          
          // Удаляем неразрешенные теги
          if (!allowedTags.includes(tagName)) {
            const parent = node.parentNode;
            while (node.firstChild) {
              parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
            return;
          }
          
          // Очищаем атрибуты
          const attributes = Array.from(node.attributes);
          attributes.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            const allowedForTag = allowedAttributes[tagName] || allowedAttributes['*'] || [];
            
            if (!allowedForTag.includes(attrName)) {
              node.removeAttribute(attrName);
            } else if (attrName === 'href' || attrName === 'src') {
              // Проверка на опасные протоколы
              const value = attr.value.toLowerCase();
              if (value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('vbscript:')) {
                node.removeAttribute(attrName);
              }
            }
          });
          
          // Рекурсивно очищаем дочерние узлы
          Array.from(node.childNodes).forEach(child => cleanNode(child));
        }
      };
      
      // Собираем результат через сериализацию очищенных узлов
      const resultContainer = document.createElement('div');
      Array.from(doc.body.childNodes).forEach(child => {
        cleanNode(child);
        resultContainer.appendChild(child.cloneNode(true));
      });
      
      return resultContainer.innerHTML;
    },

    // Проверка URL на безопасность
    isValidUrl(url) {
      if (!url) return false;
      try {
        const parsed = new URL(url, window.location.origin);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    }
  };

  // ========== Утилиты для работы с телефоном ==========
  const PhoneUtils = {
    /**
     * Нормализует телефон: удаляет всё кроме цифр
     * @param {string} phone - номер телефона
     * @returns {string} - только цифры
     */
    normalize(phone) {
      if (!phone) return '';
      return phone.replace(/[^0-9]/g, '');
    },

    /**
     * Добавляет префикс +7 если номер начинается с 8 или не имеет префикса
     * @param {string} phone - номер телефона
     * @returns {string} - нормализованный номер с префиксом
     */
    addPrefix(phone) {
      let value = phone.trim();
      if (value.length === 0 || value.startsWith('+')) {
        return value;
      }
      
      // Если номер начинается с 8, заменяем на +7
      if (value.startsWith('8') && value.length > 1) {
        return '+7' + value.substring(1);
      }
      
      // Если номер достаточно длинный, добавляем +7
      if (value.length >= 10) {
        return '+7' + value;
      }
      
      return value;
    },

    /**
     * Применяет автопрефикс к полю ввода
     * @param {HTMLInputElement} inputElement - поле ввода
     */
    setupAutoPrefix(inputElement) {
      if (!inputElement) return;
      
      inputElement.addEventListener('blur', function() {
        this.value = PhoneUtils.addPrefix(this.value);
      });
    }
  };

  // ========== Валидатор ==========
  const Validator = {
    email(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(String(email).toLowerCase());
    },

    phone(phone) {
      const clean = PhoneUtils.normalize(phone);
      return clean.length >= 10 && clean.length <= 11;
    },

    required(value) {
      if (typeof value === 'string') {
        return value.trim().length > 0;
      }
      return value !== null && value !== undefined && value !== '';
    },

    minLength(value, min) {
      if (typeof value === 'string') {
        return value.trim().length >= min;
      }
      return false;
    },

    maxLength(value, max) {
      if (typeof value === 'string') {
        return value.length <= max;
      }
      return true;
    },

    file(file, config = window.CONFIG?.FORM) {
      if (!file) return { valid: true };
      
      if (file.size > config.MAX_FILE_SIZE) {
        return { 
          valid: false, 
          error: `Максимальный размер файла: ${config.MAX_FILE_SIZE / 1024 / 1024}MB` 
        };
      }
      
      const extension = file.name.split('.').pop().toLowerCase();
      if (!config.ALLOWED_FILE_TYPES.includes(extension)) {
        return { valid: false, error: 'Недопустимый тип файла' };
      }
      
      // ✅ ИСПРАВЛЕНО: Добавлена реальная проверка MIME-типа
      if (file.type && !config.ALLOWED_MIME_TYPES.includes(file.type)) {
        return { valid: false, error: 'Недопустимый MIME-тип файла' };
      }
      
      return { valid: true };
    }
  };

  // ========== Лимитирование запросов ==========
  class RateLimiter {
    constructor(storage, key = 'requestTimestamps', max = 5, windowMs = 60000) {
      this.storage = storage;
      this.key = key;
      this.max = max;
      this.windowMs = windowMs;
    }

    _getTimestamps() {
      const data = this.storage.get(this.key);
      return Array.isArray(data) ? data : [];
    }

    _saveTimestamps(timestamps) {
      this.storage.set(this.key, timestamps);
    }

    canProceed() {
      const now = Date.now();
      const timestamps = this._getTimestamps();
      // Оставляем только те, что внутри окна
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      if (valid.length < this.max) {
        return true;
      }
      return false;
    }

    record() {
      const now = Date.now();
      const timestamps = this._getTimestamps();
      // Удаляем старые
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      valid.push(now);
      this._saveTimestamps(valid);
    }

    getRemainingTime() {
      const now = Date.now();
      const timestamps = this._getTimestamps();
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      if (valid.length < this.max) {
        return 0;
      }
      // Самая старая метка из окна
      const oldest = Math.min(...valid);
      return Math.max(0, this.windowMs - (now - oldest));
    }

    reset() {
      this.storage.remove(this.key);
    }
  }

  // ========== Утилиты для работы со строками и slug ==========
  const SlugUtils = {
    /**
     * Месяцы на русском для парсинга
     */
    _months: {
      'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
      'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
      'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
    },

    /**
     * Генерирует URL-friendly slug из строки
     * @param {string} text - исходный текст
     * @returns {string} slug
     */
    generateSlug(text) {
      if (!text) return '';
      
      return text
        .toLowerCase()
        .replace(/[^а-яёa-z0-9\s-]/gi, '') // Удаляем спецсимволы
        .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
        .replace(/-+/g, '-') // Заменяем множественные дефисы на один
        .replace(/^-|-$/g, ''); // Удаляем дефисы по краям
    },

    /**
     * Парсит дату из строки вида "Февраль 2023" или "Январь 2024"
     * @param {string} dateStr - строка даты
     * @returns {{year: string, month: string}} объект с годом и месяцем
     */
    parseDate(dateStr) {
      if (!dateStr) return { year: new Date().getFullYear().toString(), month: '01' };
      
      const parts = dateStr.trim().split(/\s+/);
      const monthName = parts[0].toLowerCase();
      const year = parts[1] || new Date().getFullYear().toString();
      
      const month = this._months[monthName] || '01';
      return { year, month };
    },

    /**
     * Создаёт короткий slug для новости (без ID)
     * @param {string} title - заголовок новости
     * @returns {string} slug
     */
    createShortSlug(title) {
      return this.generateSlug(title);
    }
  };

  return { DOM, Sanitizer, Validator, RateLimiter, SlugUtils, PhoneUtils };
})();


// Экспортируем только основной объект Utils
window.Utils = Utils;
// Также экспортируем PhoneUtils для прямого доступа
window.PhoneUtils = Utils.PhoneUtils;
