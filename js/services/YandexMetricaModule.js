/**
 * Модуль Яндекс.Метрики — загрузка через официальный сниппет (без document.write)
 */
const YandexMetricaModule = {
  state: {
    loaded: false,
    initialized: false,
    counterId: null
  },

  init() {
    this.state.counterId = window.CONFIG?.YANDEX?.METRIKA_COUNTER_ID;
    Logger.INFO('[YandexMetricaModule] Ready, counter ID:', this.state.counterId);
  },

  enable() {
    if (this.state.initialized) {
      Logger.INFO('[YandexMetricaModule] Already enabled');
      return;
    }

    if (typeof window.ym === 'function') {
      this._initCounter();
      this.state.initialized = true;
      return;
    }

    this._loadWithSnippet();
  },

  _loadWithSnippet() {
    try {
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j=0; j<document.scripts.length; j++) {
          if (document.scripts[j].src === r) { return; }
        }
        k=e.createElement(t);
        a=e.getElementsByTagName(t)[0];
        k.async=1;
        k.src=r;
        a.parentNode.insertBefore(k,a);
      })
      (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

      let attempts = 0;
      const maxAttempts = 20;
      const checkInterval = 100;

      const checkYm = () => {
        if (typeof window.ym === 'function') {
          this._initCounter();
          this.state.initialized = true;
          Logger.INFO('[YandexMetricaModule] Enabled and counter initialized');
          return true;
        }
        return false;
      };

      if (checkYm()) return;

      const intervalId = setInterval(() => {
        attempts++;
        if (checkYm()) {
          clearInterval(intervalId);
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          Logger.ERROR('[YandexMetricaModule] ym not defined after snippet load');
        }
      }, checkInterval);

    } catch (e) {
      Logger.ERROR('[YandexMetricaModule] Snippet error:', e.message);
    }
  },

  _initCounter() {
    const id = this.state.counterId;
    if (!id) {
      Logger.ERROR('[YandexMetricaModule] No counter ID');
      return;
    }

    if (typeof window.ym !== 'function') {
      Logger.ERROR('[YandexMetricaModule] window.ym is not a function, cannot init counter');
      return;
    }

    try {
      window.ym(id, 'init', {
        webvisor: false,
        clickmap: false,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: location.href,
        accurateTrackBounce: true,
        trackLinks: true
      });
      Logger.INFO('[YandexMetricaModule] Counter init called with id:', id);
    } catch (e) {
      Logger.ERROR('[YandexMetricaModule] Error during counter init:', e.message);
    }
  },

  // [FIX] Отключение без отправки новых hit'ов.
  // Было: ym(id, 'hit', ...) — то есть «отключение» само генерировало
  // обращение к Метрике, что нарушает отзыв согласия.
  // Стало: официальный 'destruct' + удаление cookie Метрики.
  disable() {
    if (!this.state.counterId) {
      this.state.initialized = false;
      return;
    }

    try {
      if (typeof window.ym === 'function') {
        window.ym(this.state.counterId, 'destruct');
      }
      this._clearMetrikaCookies();
      Logger.INFO('[YandexMetricaModule] Disabled (destructed)');
    } catch (error) {
      Logger.WARN('[YandexMetricaModule] Error disabling analytics:', error.message);
    } finally {
      this.state.initialized = false;
    }
  },

  // [FIX] Очистка cookie-файлов Метрики при отзыве согласия
  _clearMetrikaCookies() {
    const names = [
      '_ym_uid', '_ym_d', '_ym_isad', '_ym_visorc', '_ym_hostIndex',
      'yandexuid', 'yuidss', 'ymex'
    ];
    const expires = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const host = location.hostname;
    const parts = host.split('.');
    const rootDomain = parts.length >= 2 ? '.' + parts.slice(-2).join('.') : host;

    names.forEach(name => {
      document.cookie = `${name}=; ${expires}; path=/`;
      document.cookie = `${name}=; ${expires}; path=/; domain=${host}`;
      document.cookie = `${name}=; ${expires}; path=/; domain=${rootDomain}`;
    });
  }
};

if (typeof window !== 'undefined') {
  window.YandexMetricaModule = YandexMetricaModule;
  YandexMetricaModule.init();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = YandexMetricaModule;
}