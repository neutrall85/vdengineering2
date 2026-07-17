/**
 * ConsentManager.js
 * Менеджер согласий пользователя (cookie, аналитика)
 * Версия 3.0 – делегирует работу с Metrika модулю YandexMetricaModule
 */

const ConsentManager = {
  config: {
    version: '3.0',
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
    _destroyed: false
  },

  init() {
    if (!window.Services?.eventBus) {
      Logger.ERROR('ConsentManager: EventBus not available');
      return;
    }
    this.state.eventBus = window.Services.eventBus;
    const storage = window.Services.storage;

    const consent = this.getConsent(storage);
    if (!consent) {
      this.state.eventBus.emit('preferences:required');
    } else {
      this._applyConsent(consent.categories, storage);
    }

    this._render();
    this._setupMutationObserver();
    this._attachEvents();
    Logger.INFO('ConsentManager initialized (v3.0)');
  },

  getConsent(storage) {
    return storage.get('user_preferences_v1', null);
  },

  saveConsent(consent, storage) {
    Logger.INFO('ConsentManager: saveConsent called with consent:', consent);
    const consentData = {
      timestamp: new Date().toISOString(),
      version: this.config.version,
      categories: consent
    };
    storage.set('user_preferences_v1', consentData);
    this._sendConsentToServer(consent);
    this._applyConsent(consent, storage);
    this.state.eventBus.emit('preferences:saved', consentData);
    this.hide();
  },

  withdrawConsent(storage) {
    storage.remove('user_preferences_v1');
    this._applyConsent({ functional: true, analytics: false }, storage);
    this.state.eventBus.emit('preferences:withdrawn');
    this.show();
  },

  getCategories() {
    return this.config.categories;
  },

  _applyConsent(categories, storage) {
    Logger.INFO('ConsentManager: _applyConsent called with categories:', categories);
    const analyticsEnabled = categories && categories.analytics === true;

    if (analyticsEnabled) {
      if (typeof YandexMetricaModule !== 'undefined') {
        YandexMetricaModule.enable();
      } else {
        Logger.WARN('YandexMetricaModule not available');
      }
    } else {
      if (typeof YandexMetricaModule !== 'undefined') {
        if (YandexMetricaModule.state && YandexMetricaModule.state.counterId) {
            YandexMetricaModule.disable();
        }
      }
    }
    this.state.eventBus.emit('preferences:applied', categories);
  },

  // ===== ОСТАЛЬНЫЕ МЕТОДЫ (без изменений) =====
  _render() {
    if (document.getElementById('user-notice-banner')) return;
    const sanitizer = Utils.Sanitizer || { escapeHtml: (str) => str };
    const bannerHTML = `
      <div id="user-notice-banner" class="user-notice-banner" role="dialog" aria-modal="true" aria-labelledby="user-notice-title">
        <div class="user-notice-content">
          <div class="user-notice-level-1" id="user-notice-level-1">
            <h3 id="user-notice-title" class="user-notice-title">Уважение к Вашей конфиденциальности</h3>
            <p class="user-notice-text">
              Мы используем файлы cookie для улучшения работы сайта. Технические cookie необходимы для функционирования сайта.
              Аналитические cookie (Яндекс.Метрика) собирают обезличенную статистику посещений – они включаются только с Вашего разрешения.
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
    document.addEventListener('click', (e) => {
      const link = e.target.closest('#cookie-settings-link');
      if (link) {
        e.preventDefault();
        this.withdrawConsent(storage);
      }
    });
  },

  show() {
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
    if (categories.analytics === true) consentType = 'all';
    else if (categories.analytics === false) consentType = 'functional';
    fetch('/api/cookie-consent.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        consent_type: consentType,
        version: this.config.version || '3.0',
        url: window.location.href
      })
    }).catch(() => Logger.WARN('Failed to log cookie consent'));
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