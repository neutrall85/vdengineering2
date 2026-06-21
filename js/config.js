/**
 * Конфигурационный файл проекта
 * ООО "Волга-Днепр Инжиниринг"
 */

const CONFIG = {
  PERFORMANCE: {
    SCROLL_DEBOUNCE_MS: 10,
    ANIMATION_THRESHOLD: 100,
    RESIZE_DEBOUNCE_MS: 150,
    COMPONENT_LOAD_DELAY_MS: 50,
    MODAL_FOCUS_DELAY_MS: 100,
    HASH_SCROLL_DELAY_MS: 400,
    INIT_APP_DELAY_MS: 100
  },
  NAVIGATION: {
    SCROLL_HEADER_THRESHOLD: 100,
    SCROLL_TOP_THRESHOLD: 500
  },
  LAYOUT: {
    MOBILE_BREAKPOINT: 1048
  },
  FORM: {
    RATE_LIMIT_MAX: 5,
    RATE_LIMIT_WINDOW_MS: 60000,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    ALLOWED_FILE_TYPES: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip'],
    ALLOWED_MIME_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip'
    ],
    WARNING_AUTO_HIDE_MS: 5000
  },
  ANIMATION: {
    COUNTER_STEPS: 100,
    FADE_IN_THRESHOLD: 100,
    MODAL_CLOSE_DELAY_MS: 3000,
    OBSERVER_THRESHOLD: 0.5,
    ROOT_MARGIN: '50px',
    CARD_STAGGER_MS: 50
  },
  CONTACT: {
    MAP_URL: 'https://yandex.ru/maps/-/CDu~eKqJ',
    EMAIL: 'info@volga-dnepr-engineering.ru',
    PHONE: '+7 (495) 000-00-00'
  },
  SECURITY: {
    CSRF_TOKEN_KEY: 'csrf_token',
    SESSION_STORAGE_KEY: 'form_submitted'
  },
  YANDEX: {
    METRIKA_COUNTER_ID: '109146519'
  },
  API: {
    TIMEOUT_MS: 30000,
    SIMULATED_DELAY_MS: 500
  },
  DEBUG: false
};

// Генерация CSRF токена
// function generateCSRFToken() {
//   const array = new Uint8Array(32);
//   crypto.getRandomValues(array);
//   return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
// }

// // Сохранение CSRF токена в sessionStorage
// if (typeof window !== 'undefined') {
//   if (!sessionStorage.getItem(CONFIG.SECURITY.CSRF_TOKEN_KEY)) {
//     sessionStorage.setItem(CONFIG.SECURITY.CSRF_TOKEN_KEY, generateCSRFToken());
//   }
//   CONFIG.CSRF_TOKEN = sessionStorage.getItem(CONFIG.SECURITY.CSRF_TOKEN_KEY);
// }

// Экспортируем в глобальную область
window.CONFIG = CONFIG;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}