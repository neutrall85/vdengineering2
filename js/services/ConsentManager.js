/**
 * ConsentManager.js
 * Менеджер согласий пользователя (cookie, аналитика)
 * Версия 2.1 (без иконки, управление через ссылку в политике и футере)
 */

const ConsentManager = {
  config: {
    version: '2.1',
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

  state: {
    banner: null,
    observer: null,
    recoveryTimer: null,
    eventBus: null,
    _destroyed: false,
    analyticsInitialized: false,
    ymLoaded: false,
    ymCounterId: null
  },

  init() {
    if (!window.Services?.eventBus) {
      Logger.ERROR('ConsentManager: EventBus not available');
      return;
    }

    this.state.eventBus = window.Services.eventBus;
    const storage = window.Services.storage;
    this.state.ymCounterId = window.CONFIG?.YANDEX?.METRIKA_COUNTER_ID || '109146519';

    const consent = this.getConsent(storage);
    if (!consent) {
      this.state.eventBus.emit('preferences:required');
    } else {
      this._applyConsent(consent.categories, storage);
    }

    this._render();
    this._setupMutationObserver();
    this._attachEvents();

    Logger.INFO('ConsentManager initialized (lazy analytics mode)');
  },

  getConsent(storage) {
    const consentKey = 'user_preferences_v1';
    return storage.get(consentKey, null);
  },

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

    this._sendConsentToServer(consent);
    this._applyConsent(consent, storage);
    this.state.eventBus.emit('preferences:saved', consentData);
    this.hide();
  },

  withdrawConsent(storage) {
    console.log('🔄 withdrawConsent вызван (баннер поверх модалки)');

    // Удаляем согласие
    const consentKey = 'user_preferences_v1';
    storage.remove(consentKey);
    this._disableAnalytics(true);
    this.state.eventBus.emit('preferences:withdrawn');

    // Показываем баннер поверх модалки
    this.show();
  },

  getCategories() {
    return this.config.categories;
  },

  _applyConsent(categories, storage) {
    Logger.INFO('ConsentManager: _applyConsent called with categories:', categories);
    const analyticsEnabled = categories && categories.analytics === true;
    if (analyticsEnabled) {
      this._enableAnalytics();
    } else {
      this._disableAnalytics(false);
    }
    this.state.eventBus.emit('preferences:applied', categories);
  },

  _loadAnalyticsScript() {
    return new Promise((resolve, reject) => {
      if (this.state.ymLoaded) {
        resolve();
        return;
      }

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
        window.ym = window.ym || function () {
          (window.ym.a = window.ym.a || []).push(arguments);
        };
        window.ym(this.state.ymCounterId, 'init', {
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: true,
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

  _enableAnalytics() {
    if (this.state.analyticsInitialized) {
      Logger.INFO('ConsentManager: Analytics already enabled');
      return;
    }

    this._loadAnalyticsScript()
      .then(() => {
        window.ym(this.state.ymCounterId, 'userParams', { analytics_enabled: true });
        this.state.analyticsInitialized = true;
        Logger.INFO('ConsentManager: Analytics enabled');
      })
      .catch(err => {
        Logger.ERROR('ConsentManager: Could not enable analytics', err);
      });
  },

  _disableAnalytics(clearCookies = false) {
    if (!this.state.analyticsInitialized && !clearCookies) {
      return;
    }

    try {
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

  _clearYandexCookies() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name] = cookie.split('=');
      const trimmedName = name.trim();
      if (trimmedName.startsWith('_ym_')) {
        document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`;
      }
    }
  },

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
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', bannerHTML);
    this.state.banner = document.getElementById('user-notice-banner');

    const storage = window.Services.storage;
    const consent = this.getConsent(storage);
    if (!consent) {
      this.show();
    } else {
      this.hide();
    }
  },

  _attachEvents() {
    const storage = window.Services.storage;

    document.getElementById('user-accept-all')?.addEventListener('click', () => {
      Logger.INFO('ConsentManager: Accept all clicked');
      this.saveConsent({ functional: true, analytics: true }, storage);
    });

    document.getElementById('user-reject-all')?.addEventListener('click', () => {
      Logger.INFO('ConsentManager: Reject all clicked');
      this.saveConsent({ functional: true, analytics: false }, storage);
    });

    document.getElementById('user-save-selection')?.addEventListener('click', () => {
      const consentAnalytics = document.getElementById('consent-analytics')?.checked || false;
      Logger.INFO('ConsentManager: Save selection clicked, analytics =', consentAnalytics);
      this.saveConsent({ functional: true, analytics: consentAnalytics }, storage);
    });

    document.getElementById('user-privacy-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof PolicyModalManager !== 'undefined') {
        PolicyModalManager.openPolicyModal('privacy');
      } else {
        Logger.WARN('ConsentManager: PolicyModalManager not available');
      }
    });

    document.getElementById('user-cookie-policy-link')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof PolicyModalManager !== 'undefined') {
        PolicyModalManager.openPolicyModal('cookies');
      } else {
        Logger.WARN('ConsentManager: PolicyModalManager not available');
      }
    });

    // Обработчик для ссылки "Настройки cookie" (в футере или в политике)
    document.addEventListener('click', (e) => {
      const link = e.target.closest('#cookie-settings-link');
      if (link) {
        e.preventDefault();
        this.withdrawConsent(storage);
      }
    });
  },

  show() {
    // Если баннер отсутствует в DOM или ссылка на него потеряна – пересоздаём
    if (!this.state.banner || !document.getElementById('user-notice-banner')) {
      this._render();
    }
    if (this.state.banner) {
      this.state.banner.classList.add('active', 'visible');
      this.state.banner.classList.remove('hidden');
    }
  },

  hide() {
    if (this.state.banner) {
      this.state.banner.classList.remove('active', 'visible');
      this.state.banner.classList.add('hidden');
    }
  },

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

  _scheduleRecovery() {
    if (this.state._destroyed) return;
    if (this.state.recoveryTimer) clearTimeout(this.state.recoveryTimer);

    const storage = window.Services.storage;
    this.state.recoveryTimer = setTimeout(() => {
      if (this.state._destroyed) return;
      const consent = this.getConsent(storage);
      if (!consent && !document.getElementById('user-notice-banner')) {
        Logger.INFO('ConsentManager: Recovering banner...');
        this._render();
      }
    }, 2000);
  },

  _sendConsentToServer(categories) {
    let consentType = 'functional';
    if (categories.analytics === true) {
      consentType = 'all';
    } else if (categories.analytics === false) {
      consentType = 'functional';
    }

    fetch('/api/cookie-consent.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_type: consentType,
        version: this.config.version || '2.0',
        url: window.location.href
      })
    }).catch(() => {
      console.warn('Failed to log cookie consent');
    });
  },

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
    if (this.state.banner) this.state.banner.remove();
    this.state.banner = null;
    this.state.eventBus = null;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ConsentManager };
}