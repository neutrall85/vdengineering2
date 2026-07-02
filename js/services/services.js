/**
 * Объединённые сервисы: EventBus, StorageService, ApiClient
 * ООО "Волга-Днепр Инжиниринг"
 */

const Services = (function() {
  // ========== Шина событий ==========
  class EventBus {
    constructor() {
      this.events = new Map();
    }

    on(event, callback) {
      if (!this.events.has(event)) {
        this.events.set(event, new Set());
      }
      this.events.get(event).add(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (this.events.has(event)) {
        this.events.get(event).delete(callback);
      }
    }

    emit(event, data) {
      if (this.events.has(event)) {
        this.events.get(event).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            // ignore
          }
        });
      }
    }

    clear() {
      this.events.clear();
    }
  }

  // ========== Хранилище ==========
  class StorageService {
    constructor(storage = localStorage) {
      this.storage = storage;
    }

    get(key, defaultValue = null) {
      try {
        const value = this.storage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
      } catch (error) {
        return defaultValue;
      }
    }

    set(key, value) {
      try {
        this.storage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        return false;
      }
    }

    remove(key) {
      try {
        this.storage.removeItem(key);
        return true;
      } catch (error) {
        return false;
      }
    }

    clear() {
      try {
        this.storage.clear();
        return true;
      } catch (error) {
        return false;
      }
    }
  }

  // ========== API Клиент (исправленный) ==========
  class ApiClient {
    constructor(baseUrl = '') {
      this.baseUrl = baseUrl;
    }

    /**
     * Реальная отправка данных на сервер через FormData
     * @param {FormData} formData - данные формы
     * @param {Object} options - дополнительные опции (не используются)
     * @returns {Promise<Object>} ответ сервера
     */
    async submitForm(formData, options = {}) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(`${this.baseUrl}/api/submit.php`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          // НЕ устанавливаем Content-Type – браузер сам добавит multipart/form-data с boundary
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Превышено время ожидания ответа сервера (30 сек)');
        }
        throw error;
      }
    }

    /**
     * Получает CSRF-токен с сервера
     * @returns {Promise<string>}
     */
    async getCsrfToken() {
      console.log('[ApiClient] getCsrfToken called');
      const response = await fetch(`${this.baseUrl}/api/csrf_token.php`, {
        method: 'GET',
        credentials: 'same-origin'
      });
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Не удалось получить CSRF-токен: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      console.log('[ApiClient] CSRF token received:', data.csrf_token);
      return data.csrf_token;
    }
  }

  // Создаём экземпляры по умолчанию
  const eventBus = new EventBus();
  const storage = new StorageService();
  const apiClient = new ApiClient();

  return { EventBus, StorageService, ApiClient, eventBus, storage, apiClient };
})();

// Экспортируем только основной объект Services
window.Services = Services;