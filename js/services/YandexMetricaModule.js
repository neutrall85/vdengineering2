/**
 * Модуль Яндекс.Метрики
 * Отложенная загрузка и управление трекингом в зависимости от согласий пользователя
 */
const YandexMetricaModule = {
  state: {
    loaded: false,
    initialized: false,
    counterId: null
  },

  init() {
    '[YandexMetricaModule] init() called');
    this.state.counterId = window.CONFIG?.YANDEX?.METRIKA_COUNTER_ID || '109146519';
    '[YandexMetricaModule] Counter ID:', this.state.counterId);
    if (typeof Logger !== 'undefined') {
      Logger.INFO('[YandexMetricaModule] Ready, counter ID:', this.state.counterId);
    } else {
      '[YandexMetricaModule] Ready, counter ID:', this.state.counterId);
    }
  },

  enable() {
    '[YandexMetricaModule] enable() called, initialized =', this.state.initialized);
    if (this.state.initialized) {
      '[YandexMetricaModule] Already enabled, skipping');
      if (typeof Logger !== 'undefined') Logger.INFO('[YandexMetricaModule] Already enabled');
      return;
    }

    '[YandexMetricaModule] Starting _loadScript()...');
    this._loadScript()
      .then(() => {
        '[YandexMetricaModule] _loadScript() resolved, calling _initCounter()');
        this._initCounter();
        this.state.initialized = true;
        '[YandexMetricaModule] Enabled and counter initialized successfully');
        if (typeof Logger !== 'undefined') {
          Logger.INFO('[YandexMetricaModule] Enabled and counter initialized');
        } else {
          '[YandexMetricaModule] Enabled and counter initialized');
        }
      })
      .catch(err => {
        '[YandexMetricaModule] _loadScript() rejected:', err.message);
        if (typeof Logger !== 'undefined') {
          Logger.ERROR('[YandexMetricaModule] Failed to load Yandex.Metrika script:', err.message);
        } else {
          '[YandexMetricaModule] Failed to load Yandex.Metrika script:', err.message);
        }
      });
  },

  disable() {
    '[YandexMetricaModule] disable() called, counterId =', this.state.counterId);
    if (typeof window.ym !== 'function' || !this.state.counterId) {
      '[YandexMetricaModule] Cannot disable: ym not a function or no counterId');
      return;
    }

    try {
      window.ym(this.state.counterId, 'userParams', { analytics_enabled: false });
      window.ym(this.state.counterId, 'hit', window.location.href, {
        params: { analytics: 'disabled' }
      });
      '[YandexMetricaModule] Disabled tracking (userParams + hit sent)');
      if (typeof Logger !== 'undefined') {
        Logger.INFO('[YandexMetricaModule] Disabled tracking');
      } else {
        '[YandexMetricaModule] Disabled tracking');
      }
    } catch (error) {
      '[YandexMetricaModule] Error disabling analytics:', error.message);
      if (typeof Logger !== 'undefined') {
        Logger.WARN('[YandexMetricaModule] Error disabling analytics:', error.message);
      } else {
        '[YandexMetricaModule] Error disabling analytics:', error.message);
      }
    } finally {
      this.state.initialized = false;
      '[YandexMetricaModule] state.initialized set to false');
    }
  },

  _loadScript() {
    '[YandexMetricaModule] _loadScript() started');
    return new Promise((resolve, reject) => {
      if (this.state.loaded) {
        '[YandexMetricaModule] Script already loaded, resolving immediately');
        resolve();
        return;
      }

      // Стандартная заглушка, как в оригинальном коде Яндекс.Метрики
      window.ym = window.ym || function() {
        (window.ym.a = window.ym.a || []).push(arguments);
      };
      window.ym.l = 1 * new Date();
      '[YandexMetricaModule] window.ym stub created');

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = 'https://mc.yandex.ru/metrika/tag.js';
      '[YandexMetricaModule] Script element created, src =', script.src);

      script.onload = () => {
        '[YandexMetricaModule] Script onload fired, loaded = true');
        this.state.loaded = true;
        resolve();
      };
      script.onerror = (err) => {
        '[YandexMetricaModule] Script onerror fired:', err);
        reject(new Error('Script load error'));
      };

      document.head.appendChild(script);
      '[YandexMetricaModule] Script appended to head');
      
      // ПРИМЕЧАНИЕ: Скрипт остается в DOM после загрузки, это ожидаемое поведение.
      // Библиотека Яндекс.Метрики требует постоянного присутствия скрипта для корректной работы.
      // Удаление скрипта приведет к неработоспособности трекинга и потере данных аналитики.
    });
  },

  _initCounter() {
    const id = this.state.counterId;
    '[YandexMetricaModule] _initCounter() called for id:', id);
    try {
      window.ym(id, 'init', {
        // ssr: true,
        webvisor: false,
        clickmap: false,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: location.href,
        accurateTrackBounce: true,
        trackLinks: true
      });
      '[YandexMetricaModule] ym() init call completed successfully');
      if (typeof Logger !== 'undefined') {
        Logger.INFO('[YandexMetricaModule] Counter init called with id:', id);
      } else {
        '[YandexMetricaModule] Counter init called with id:', id);
      }
    } catch (e) {
      '[YandexMetricaModule] Error during counter init:', e.message);
      if (typeof Logger !== 'undefined') {
        Logger.ERROR('[YandexMetricaModule] Error during counter init:', e.message);
      } else {
        '[YandexMetricaModule] Error during counter init:', e.message);
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.YandexMetricaModule = YandexMetricaModule;
  YandexMetricaModule.init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = YandexMetricaModule;
}