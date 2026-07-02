/**
 * Logger Service - Централизованное логирование
 * ООО "Волга-Днепр Инжиниринг"
 * 
 * Уровни логирования:
 * - DEBUG: Отладочная информация (отключена в production)
 * - INFO: Информационные сообщения (отключены в production)
 * - WARN: Предупреждения
 * - ERROR: Ошибки (всегда включены)
 */

const Logger = (function() {
  const LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  };

  // В production отключаем DEBUG и INFO
  const isProduction = window.CONFIG?.PRODUCTION !== false;
  const currentLevel = isProduction ? LEVELS.WARN : LEVELS.DEBUG;

  function formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return [prefix, message, ...args];
  }

  return {
    DEBUG(message, ...args) {
      if (currentLevel <= LEVELS.DEBUG) {
        console.debug(...formatMessage('DEBUG', message, ...args));
      }
    },

    INFO(message, ...args) {
      if (currentLevel <= LEVELS.INFO) {
        console.info(...formatMessage('INFO', message, ...args));
      }
    },

    WARN(message, ...args) {
      if (currentLevel <= LEVELS.WARN) {
        console.warn(...formatMessage('WARN', message, ...args));
      }
    },

    ERROR(message, ...args) {
      // Ошибки логируем всегда
      console.error(...formatMessage('ERROR', message, ...args));
    },

    // Метод для временного включения подробного логирования в production
    enableDebug() {
      if (isProduction) {
        console.info('[Logger] Debug mode enabled for this session');
      }
    }
  };
})();

// Экспортируем Logger для глобального доступа
window.Logger = Logger;
