/**
 * ConsentManager.js
 * Менеджер согласий пользователя (cookie, аналитика)
 * Полностью соответствует 152-ФЗ и рекомендациям РКН
 * Версия 2.0
 */

const ConsentManager = {
  // Конфигурация категорий согласий
  config: {
    version: '2.0',
    categories: {
      functional: {
        id: 'functional',
        name: 'Технические',
        description: 'Необходимы для работы сайта (формы, навигация)',
        required: true
      },
      analytics: {
        id: 'analytics',
        name: 'Аналитические',
        description: 'Помогают анализировать посещаемость и улучшать сайт (Яндекс.Метрика)',
        required: false
      }
    }
  },

  // Состояние
  state: {
    banner: null,
    settingsIcon: null,
    observer: null,
    recoveryTimer: null,
    eventBus: null,
    _destroyed: false,
    analyticsInitialized: false,   // включена ли аналитика в данный момент
    ymLoaded: false,               // загружен ли скрипт Метрики
    ymCounterId: null
  },

  /**
   * Инициализация менеджера согласий
   */
  init() {
    if (!window.Services?.eventBus) {
      Logger.ERROR('ConsentManager: EventBus not available');
      return;
    }

    this.state.eventBus = window.Services.eventBus;
    const storage = window.Services.storage;

    // Получаем ID счётчика из конфига
    this.state.ymCounterId = window.CONFIG?.YANDEX?.METRIKA_COUNTER_ID || '109146519';

    // Проверка существующих согласий
    const consent = this.getConsent(storage);
    if (!consent) {
      // Нет согласия – аналитика НЕ инициализируется
      this.state.eventBus.emit('preferences:required');
    } else {
      // Есть сохранённое согласие – применяем его
      this._applyConsent(consent.categories, storage);
    }

    // Рендеринг UI компонента
    this._render();

    // Настройка наблюдения за удалением баннера (блокировщики рекламы)
    this._setupMutationObserver();

    Logger.INFO('ConsentManager initialized (lazy analytics mode)');
  },

  /**
   * Получить сохранённые согласия
   */
  getConsent(storage) {
    const consentKey = 'user_preferences_v1';
    return storage.get(consentKey, null);
  },

  /**
   * Сохранить согласия пользователя
   */
  saveConsent(consent, storage) {
    Logger.INFO('ConsentManager: saveConsent called with consent:', consent);
    const consentKey = 'user_preferences_v1';
    const consentData = {
      timestamp: new Date().toISOString(),
      version: this.config.version,
      categories: consent
    };

    storage.set(consentKey, consentData);
    Logger.INFO('ConsentManager: Consent saved to storage:', consentData);
    this._applyConsent(consent, storage);
    this.state.eventBus.emit('preferences:saved', consentData);
    this.hide();
  },

  /**
   * Отозвать согласие (пользователь нажал на иконку настроек)
   */
  withdrawConsent(storage) {
    const consentKey = 'user_preferences_v1';
    storage.remove(consentKey);
    // Принудительно отключаем аналитику и удаляем cookie
    this._disableAnalytics(true); // true = полная очистка
    this.state.eventBus.emit('preferences:withdrawn');
    this.show(); // показываем баннер заново
  },

  /**
   * Получить категории согласий для UI
   */
  getCategories() {
    return this.config.categories;
  },

  /**
   * Применить настройки согласий (включить/выключить аналитику)
   */
  _applyConsent(categories, storage) {
    Logger.INFO('ConsentManager: _applyConsent called with categories:', categories);
    const analyticsEnabled = categories && categories.analytics === true;
    if (analyticsEnabled) {
      this._enableAnalytics();
    } else {
      this._disableAnalytics(false); // false = не удалять cookie, просто отключить отправку
    }
    this.state.eventBus.emit('preferences:applied', categories);
  },

  /**
   * Ленивая загрузка скрипта Яндекс.Метрики и инициализация счётчика
   */
  _loadAnalyticsScript() {
    return new Promise((resolve, reject) => {
      if (this.state.ymLoaded) {
        resolve();
        return;
      }

      // Проверяем, не загружен ли уже скрипт кем-то другим
      if (document.querySelector('script[src*="mc.yandex.ru/metrika/tag.js"]')) {
        this.state.ymLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://mc.yandex.ru/metrika/tag.js';
      script.async = true;
      script.onload = () => {
        this.state.ymLoaded = true;
        // Инициализируем счётчик (без передачи данных, просто создаём объект)
        window.ym = window.ym || function () {
          (window.ym.a = window.ym.a || []).push(arguments);
        };
        window.ym(this.state.ymCounterId, 'init', {
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: true,
          // Важно: параметр ut = "noindex" может использоваться, но не блокирует сбор
        });
        Logger.INFO('ConsentManager: Yandex Metrika script loaded and initialized');
        resolve();
      };
      script.onerror = (err) => {
        Logger.ERROR('ConsentManager: Failed to load Metrika script', err);
        reject(err);
      };
      document.head.appendChild(script);
    });
  },

  /**
   * Включить аналитику: загрузить скрипт и разрешить отправку данных
   */
  _enableAnalytics() {
    if (this.state.analyticsInitialized) {
      Logger.INFO('ConsentManager: Analytics already enabled');
      return;
    }

    this._loadAnalyticsScript()
      .then(() => {
        // Устанавливаем флаг, что пользователь разрешил аналитику
        window.ym(this.state.ymCounterId, 'userParams', { analytics_enabled: true });
        this.state.analyticsInitialized = true;
        Logger.INFO('ConsentManager: Analytics enabled');
      })
      .catch(err => {
        Logger.ERROR('ConsentManager: Could not enable analytics', err);
      });
  },

  /**
   * Отключить аналитику
   * @param {boolean} clearCookies - удалить ли cookie Яндекс.Метрики
   */
  _disableAnalytics(clearCookies = false) {
    if (!this.state.analyticsInitialized && !clearCookies) {
      // Если аналитика никогда не включалась – ничего не делаем
      return;
    }

    try {
      // Отправляем команду Метрике о прекращении сбора данных для этого пользователя
      if (window.ym && this.state.ymLoaded) {
        window.ym(this.state.ymCounterId, 'userParams', { analytics_enabled: false });
      }
      this.state.analyticsInitialized = false;
      Logger.INFO('ConsentManager: Analytics disabled');

      if (clearCookies) {
        this._clearYandexCookies();
        Logger.INFO('ConsentManager: Yandex Metrika cookies cleared');
      }
    } catch (e) {
      Logger.WARN('ConsentManager: Error disabling analytics', e.message);
    }
  },

  /**
   * Удалить все cookie, установленные Яндекс.Метрикой (_ym_*)
   */
  _clearYandexCookies() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name] = cookie.split('=');
      const trimmedName = name.trim();
      if (trimmedName.startsWith('_ym_')) {
        // Удаляем cookie для текущего пути и для корня
        document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
      }
    }
  },

  /**
   * Рендеринг UI баннера и иконки настроек
   */
  _render() {
    if (document.getElementById('user-notice-banner')) return;

    const sanitizer = Utils.Sanitizer || { escapeHtml: (str) => str };

    const bannerHTML = `
      <div id="user-notice-banner" class="user-notice-banner" role="dialog" aria-modal="true" aria-labelledby="user-notice-title">
        <div class="user-notice-content">
          <div class="user-notice-level-1" id="user-notice-level-1">
            <h3 id="user-notice-title" class="user-notice-title">Уважение к вашей конфиденциальности</h3>
            <p class="user-notice-text">
              Мы используем файлы cookie для улучшения работы сайта. Технические cookie необходимы для функционирования сайта.
              Аналитические cookie (Яндекс.Метрика) собирают обезличенную статистику посещений – они включаются только с вашего разрешения.
            </p>

            <div class="user-consent-details" id="user-consent-details">
              <div class="user-consent-category">
                <label class="user-consent-label">
                  <input type="checkbox" id="consent-functional" checked disabled>
                  <span class="user-consent-text">
                    <strong>${sanitizer.escapeHtml(this.config.categories.functional.name)}</strong><br>
                    <small>${sanitizer.escapeHtml(this.config.categories.functional.description)}</small>
                  </span>
                </label>
              </div>

              <div class="user-consent-category">
                <label class="user-consent-label">
                  <input type="checkbox" id="consent-analytics">
                  <span class="user-consent-text">
                    <strong>${sanitizer.escapeHtml(this.config.categories.analytics.name)}</strong><br>
                    <small>${sanitizer.escapeHtml(this.config.categories.analytics.description)}</small>
                  </span>
                </label>
              </div>
            </div>

            <div class="user-notice-buttons">
              <button type="button" class="user-btn user-btn-primary" id="user-accept-all">Принять всё</button>
              <button type="button" class="user-btn user-btn-secondary" id="user-reject-all">Отклонить всё</button>
              <button type="button" class="user-btn user-btn-outline" id="user-save-selection">Сохранить выбор</button>
            </div>
            <div class="user-notice-links">
              <a href="#" class="user-privacy-link" id="user-privacy-link">Политика конфиденциальности</a>
              <a href="#" class="user-cookie-policy-link" id="user-cookie-policy-link">Политика в отношении файлов cookie</a>
            </div>
          </div>
        </div>

        <button type="button" class="user-settings-icon" id="user-settings-icon" title="Настройки cookie">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
        </button>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', bannerHTML);
    this.state.banner = document.getElementById('user-notice-banner');
    this.state.settingsIcon = document.getElementById('user-settings-icon');
    this._attachEvents();

    // Подписка на события
    this._subscribeToEvents();

    // Если нет сохранённого согласия – показываем баннер
    const storage = window.Services.storage;
    const consent = this.getConsent(storage);
    if (!consent) {
      this.show();
    } else {
      // Если согласие есть – скрываем баннер и показываем иконку
      this.hide();
    }
  },

  /**
   * Подписка на события eventBus
   */
  _subscribeToEvents() {
    this.state.eventBus.on('preferences:required', () => this.show());
    this.state.eventBus.on('preferences:saved', () => this.hide());
    this.state.eventBus.on('preferences:withdrawn', () => this.show());
  },

  /**
   * Привязка обработчиков событий к DOM-элементам
   */
  _attachEvents() {
    const storage = window.Services.storage;

    document.getElementById('user-accept-all')?.addEventListener('click', () => {
      Logger.INFO('ConsentManager: Accept all clicked');
      this.saveConsent({
        functional: true,
        analytics: true
      }, storage);
    });

    document.getElementById('user-reject-all')?.addEventListener('click', () => {
      Logger.INFO('ConsentManager: Reject all clicked');
      this.saveConsent({
        functional: true,
        analytics: false
      }, storage);
    });

    document.getElementById('user-save-selection')?.addEventListener('click', () => {
      const consentAnalytics = document.getElementById('consent-analytics')?.checked || false;
      Logger.INFO('ConsentManager: Save selection clicked, analytics =', consentAnalytics);
      this.saveConsent({
        functional: true,
        analytics: consentAnalytics
      }, storage);
    });

    // Ссылка на политику конфиденциальности
    document.getElementById('user-privacy-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof PolicyModalManager !== 'undefined') {
        PolicyModalManager.openPolicyModal('privacy');
      } else {
        Logger.WARN('ConsentManager: PolicyModalManager not available');
      }
    });

    // Ссылка на политику cookie
    document.getElementById('user-cookie-policy-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof PolicyModalManager !== 'undefined') {
        PolicyModalManager.openPolicyModal('cookies');
      } else {
        Logger.WARN('ConsentManager: PolicyModalManager not available');
      }
    });

    // Кнопка отзыва согласия (иконка шестерёнки)
    document.getElementById('user-settings-icon')?.addEventListener('click', () => {
      this.withdrawConsent(storage);
    });
  },

  /**
   * Показать баннер cookie
   */
  show() {
    if (this.state.banner) {
      this.state.banner.classList.add('active', 'visible');
      this.state.banner.classList.remove('hidden');
    }
    // Иконку настроек прячем, когда баннер активен
    if (this.state.settingsIcon) {
      this.state.settingsIcon.classList.remove('visible');
      this.state.settingsIcon.classList.add('hidden');
    }
  },

  /**
   * Скрыть баннер cookie
   */
  hide() {
    if (this.state.banner) {
      this.state.banner.classList.remove('active', 'visible');
      this.state.banner.classList.add('hidden');
    }
    if (this.state.settingsIcon) {
      this.state.settingsIcon.classList.add('visible');
      this.state.settingsIcon.classList.remove('hidden');
    }
  },

  /**
   * MutationObserver для восстановления баннера при удалении блокировщиком рекламы
   */
  _setupMutationObserver() {
    const bannerId = 'user-notice-banner';

    this.state.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.id === bannerId) {
            Logger.INFO('ConsentManager: Banner removed by external script, scheduling recovery...');
            this._scheduleRecovery();
          }
        });
      });
    });

    this.state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  /**
   * Планирование восстановления баннера через 2 секунды
   */
  _scheduleRecovery() {
    if (this.state._destroyed) return;
    if (this.state.recoveryTimer) clearTimeout(this.state.recoveryTimer);

    const storage = window.Services.storage;
    this.state.recoveryTimer = setTimeout(() => {
      if (this.state._destroyed) return;
      const consent = this.getConsent(storage);
      // Если согласия нет и баннер действительно отсутствует – восстанавливаем
      if (!consent && !document.getElementById('user-notice-banner')) {
        Logger.INFO('ConsentManager: Recovering banner...');
        this._render();
      }
    }, 2000);
  },

  /**
   * Очистка ресурсов при уничтожении (для SPA)
   */
  destroy() {
    this.state._destroyed = true;
    if (this.state.observer) {
      this.state.observer.disconnect();
      this.state.observer = null;
    }
    if (this.state.recoveryTimer) {
      clearTimeout(this.state.recoveryTimer);
      this.state.recoveryTimer = null;
    }
    // Удаляем DOM-элементы
    if (this.state.banner) this.state.banner.remove();
    if (this.state.settingsIcon) this.state.settingsIcon.remove();
    this.state.banner = null;
    this.state.settingsIcon = null;
    this.state.eventBus = null;
  }
};

// Экспорт для модульных систем (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConsentManager };
}