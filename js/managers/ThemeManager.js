/**
 * ThemeManager - управление светлой/тёмной темой во время работы страницы.
 * ООО "ВД Инжиниринг"
 */
class ThemeManager {
  // [P0-FIX] Fallback: если ThemeBootstrapper не загрузился — класс не падает.
  static STORAGE_KEY = (typeof ThemeBootstrapper !== 'undefined' && ThemeBootstrapper.STORAGE_KEY)
    ? ThemeBootstrapper.STORAGE_KEY
    : 'vd_theme';

  static THEME_LIGHT = 'light';
  static THEME_DARK = 'dark';
  static DESKTOP_TOGGLE_SELECTOR = '.theme-toggle--desktop';
  static MOBILE_TOGGLE_SELECTOR = '.theme-toggle--mobile';
  static ICON_MOON_CLASS = 'theme-toggle__icon--moon';
  static ICON_SUN_CLASS = 'theme-toggle__icon--sun';
  static META_COLORS = { light: '#1b4a96', dark: '#0E2540' };

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.currentTheme = null;
    this.toggles = [];
    this._boundToggleHandler = null;
    this._boundMediaChangeHandler = null;
  }

  init() {
    const saved = this._readSaved();
    const preApplied = document.documentElement.getAttribute('data-theme');
    const initialTheme = saved
      || (this._isValidTheme(preApplied) ? preApplied : null)
      || (this.mediaQuery.matches ? ThemeManager.THEME_DARK : ThemeManager.THEME_LIGHT);

    this.apply(initialTheme, { persist: false });
    this._createToggles();
    this._attachEvents();
    Logger.INFO('ThemeManager initialized, theme =', initialTheme);
  }

  apply(theme, options = {}) {
    const { persist = true } = options;
    const previous = this.currentTheme;
    const next = this._isValidTheme(theme) ? theme : ThemeManager.THEME_LIGHT;
    this.currentTheme = next;
    document.documentElement.setAttribute('data-theme', next);
    this._updateMetaColor(next);
    this._updateTogglesState(next);
    if (persist && previous && previous !== next) {
      window.Services?.eventBus?.emit('theme:changed', { theme: next, previous });
    }
  }

  toggle() {
    const next = this.currentTheme === ThemeManager.THEME_DARK
      ? ThemeManager.THEME_LIGHT : ThemeManager.THEME_DARK;
    this._save(next);
    this.apply(next);
  }

  destroy() {
    if (this._boundToggleHandler) {
      this.toggles.forEach(btn => btn.removeEventListener('click', this._boundToggleHandler));
    }
    if (this._boundMediaChangeHandler) {
      this.mediaQuery.removeEventListener('change', this._boundMediaChangeHandler);
    }
    this.toggles = [];
    this._boundToggleHandler = null;
    this._boundMediaChangeHandler = null;
    this.currentTheme = null;
  }

  _readSaved() {
    try {
      const value = window.Services?.storage?.get(ThemeManager.STORAGE_KEY);
      return this._isValidTheme(value) ? value : null;
    } catch { return null; }
  }

  _save(theme) {
    try { window.Services?.storage?.set(ThemeManager.STORAGE_KEY, theme); } catch { }
  }

  _isValidTheme(value) {
    return value === ThemeManager.THEME_LIGHT || value === ThemeManager.THEME_DARK;
  }

  _updateMetaColor(theme) {
    const color = ThemeManager.META_COLORS[theme] || ThemeManager.META_COLORS.light;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  _updateTogglesState(theme) {
    const isDark = theme === ThemeManager.THEME_DARK;
    const label = isDark ? 'Включить светлую тему' : 'Включить тёмную тему';
    this.toggles.forEach(btn => {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', String(isDark));
    });
  }

  _createToggles() {
    const desktop = document.querySelector(ThemeManager.DESKTOP_TOGGLE_SELECTOR);
    const mobile = document.querySelector(ThemeManager.MOBILE_TOGGLE_SELECTOR);
    this.toggles = [desktop, mobile].filter(Boolean);
    if (this.toggles.length === 0) {
      Logger.WARN('ThemeManager: не найдены кнопки переключения темы');
    }
  }

  _attachEvents() {
    if (this.toggles.length > 0) {
      this._boundToggleHandler = () => this.toggle();
      this.toggles.forEach(btn => btn.addEventListener('click', this._boundToggleHandler));
    }
    this._boundMediaChangeHandler = (e) => {
      if (this._readSaved() === null) {
        this.apply(e.matches ? ThemeManager.THEME_DARK : ThemeManager.THEME_LIGHT, { persist: false });
      }
    };
    this.mediaQuery.addEventListener('change', this._boundMediaChangeHandler);
  }
}

window.ThemeManager = ThemeManager;