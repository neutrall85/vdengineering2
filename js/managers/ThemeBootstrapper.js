/**
 * ThemeBootstrapper - применяет тему до первой отрисовки страницы.
 *
 * Назначение:
 *   Устранить FOUC (вспышку светлой темы) путём применения атрибута
 *   data-theme на <html> максимально рано — до того, как браузер
 *   отрисует body.
 *
 * Принципы:
 *   - Никаких зависимостей от Services, CONFIG, Logger.
 *   - Единственная ответственность: определить и применить тему.
 *   - Не создаёт DOM-узлов, не навешивает обработчиков — только атрибут.
 *   - Идемпотентен: повторный вызов не ломает состояние.
 *
 * Подключение:
 *   Собирается в отдельный бандл js/theme-bootstrap.min.js и
 *   подключается в <head> обычным <script> (не defer/async),
 *   чтобы выполниться до парсинга body.
 *
 * Управление темой (переключение, события) — зона ответственности
 * ThemeManager, который инициализируется позже и синхронизируется
 * с уже установленным значением.
 */
class ThemeBootstrapper {
  /**
   * Ключ хранения выбора пользователя.
   * Должен совпадать с ThemeManager.STORAGE_KEY.
   */
  static STORAGE_KEY = 'vd_theme';

  /**
   * Допустимые значения темы.
   */
  static VALID_THEMES = ['light', 'dark'];

  /**
   * Тема по умолчанию, если ничего не определено.
   */
  static DEFAULT_THEME = 'light';

  /**
   * Применить тему немедленно.
   * @param {Document} doc - документ (по умолчанию window.document)
   * @param {Storage} storage - хранилище (по умолчанию window.localStorage)
   * @param {Window} win - окно (по умолчанию window)
   * @returns {string} применённая тема
   */
  static apply(doc = document, storage = localStorage, win = window) {
    const theme = this.resolveTheme(storage, win);
    doc.documentElement.setAttribute('data-theme', theme);
    return theme;
  }

  /**
   * Определить тему по приоритетам:
   *   1. Явный выбор пользователя в localStorage.
   *   2. Системная тема (prefers-color-scheme).
   *   3. DEFAULT_THEME.
   * @returns {string}
   */
  static resolveTheme(storage = localStorage, win = window) {
    const saved = this.readSaved(storage);
    if (saved) return saved;

    const prefersDark = typeof win.matchMedia === 'function'
      && win.matchMedia('(prefers-color-scheme: dark)').matches;

    return prefersDark ? 'dark' : this.DEFAULT_THEME;
  }

  /**
   * Прочитать сохранённый выбор пользователя.
   * Учитывает формат StorageService (JSON.stringify).
   * @returns {'light'|'dark'|null}
   */
  static readSaved(storage = localStorage) {
    try {
      const raw = storage.getItem(this.STORAGE_KEY);
      if (!raw) return null;

      // StorageService пишет через JSON.stringify → значение в кавычках.
      // Пробуем распарсить; если не удалось — считаем строкой (legacy).
      let value;
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw;
      }

      return this.VALID_THEMES.includes(value) ? value : null;
    } catch {
      return null;
    }
  }
}

// Немедленное применение — единственный side effect класса,
// оправданный его назначением (bootstrap).
ThemeBootstrapper.apply();

if (typeof window !== 'undefined') {
  window.ThemeBootstrapper = ThemeBootstrapper;
}