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
    MAX_FILE_SIZE: 24 * 1024 * 1024,
    MAX_TOTAL_SIZE: 24 * 1024 * 1024,
    ALLOWED_FILE_TYPES: [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'zip',
      'ppt', 'pptx',
      'jpg', 'jpeg', 'png', 'gif'
    ],
    ALLOWED_MIME_TYPES: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-zip-compressed',
      'multipart/x-zip',
      'application/octet-stream',
      'image/jpeg',
      'image/png',
      'image/gif'
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
  SECURITY: {
    CSRF_TOKEN_KEY: 'csrf_token',
    SESSION_STORAGE_KEY: 'form_submitted'
  },
  YANDEX: {
    METRIKA_COUNTER_ID: '110278877',
    MAPS_API_KEY: '4b80a36f-415c-4a3e-a4c1-458070e04049'
  },
  // ===== НОВЫЙ РАЗДЕЛ ДЛЯ КАРТЫ =====
  MAP: {
    STATIC_URL: 'https://static-maps.yandex.ru/1.x/?ll=37.41917,55.947444&z=17&size=600,350&l=map&pt=37.41917,55.947444,pm2rdm',
    MAP_PAGE_URL: 'https://yandex.ru/maps/213/moscow/?ll=37.41917%2C55.947444&z=17&pt=37.41917%2C55.947444'
  }
};

window.CONFIG = CONFIG;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}