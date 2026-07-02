/**
 * ScrollManager - централизованное управление скроллом страницы
 * ООО "Волга-Днепр Инжиниринг"
 * 
 * Устраняет дублирование логики скролла между ModalManager и ComponentLoader
 * Предоставляет единый API для блокировки/восстановления скролла
 */

const ScrollManager = {
  // Конфигурация
  config: {
    noScrollClass: 'no-scroll',
    scrollbarWidthVar: '--scrollbar-width'
  },

  // Состояние
  state: {
    scrollPosition: 0,
    isLocked: false,
    lockCount: 0 // Для поддержки вложенных модальных окон
  },

  /**
   * Получить ширину полосы прокрутки
   * @returns {number} Ширина скроллбара в пикселях
   */
  getScrollbarWidth() {
    return window.innerWidth - document.documentElement.clientWidth;
  },

  /**
   * Заблокировать скролл страницы с сохранением позиции
   * Поддерживает подсчёт блокировок для вложенных модальных окон
   */
  lock() {
    // Сохраняем позицию только при первой блокировке
    if (this.state.lockCount === 0) {
      this.state.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
      
      // Фиксируем ширину скроллбара
      const scrollbarWidth = this.getScrollbarWidth();
      if (scrollbarWidth > 0) {
        document.body.style.setProperty(this.config.scrollbarWidthVar, `${scrollbarWidth}px`);
      }
      
      // Если есть прокрутка, фиксируем позицию
      if (this.state.scrollPosition > 0) {
        document.body.style.setProperty('--scroll-position', `-${this.state.scrollPosition}px`);
        document.body.classList.add('no-scroll-fixed');
      } else {
        // Если мы вверху страницы, просто блокируем скролл
        document.body.classList.add(this.config.noScrollClass);
      }
      
      this.state.isLocked = true;
    }
    
    this.state.lockCount++;
    return this.state.scrollPosition;
  },

  /**
   * Восстановить скролл страницы
   */
  unlock() {
    if (this.state.lockCount === 0) return;
    
    this.state.lockCount--;
    
    // Восстанавливаем позицию только при последней разблокировке
    if (this.state.lockCount === 0) {
      const scrollPosition = this.state.scrollPosition;
      
      // Сначала убираем классы блокировки
      document.body.classList.remove(this.config.noScrollClass);
      document.body.classList.remove('no-scroll-fixed');
      document.body.style.removeProperty(this.config.scrollbarWidthVar);
      document.body.style.setProperty('--scroll-position', '');
      
      // Восстанавливаем позицию скролла
      if (scrollPosition > 0) {
        window.scrollTo(0, scrollPosition);
      }
      
      this.state.isLocked = false;
      this.state.scrollPosition = 0;
    }
  },

  /**
   * Проверить, заблокирован ли скролл
   * @returns {boolean}
   */
  isLocked() {
    return this.state.isLocked && this.state.lockCount > 0;
  },

  /**
   * Получить текущую позицию скролла
   * @returns {number}
   */
  getPosition() {
    return this.state.scrollPosition;
  },

  /**
   * Принудительно сбросить состояние (на случай ошибок)
   */
  forceReset() {
    this.state.lockCount = 0;
    this.state.isLocked = false;
    this.state.scrollPosition = 0;
    
    document.body.classList.remove(this.config.noScrollClass);
    document.body.classList.remove('no-scroll-fixed');
    document.body.style.removeProperty(this.config.scrollbarWidthVar);
    document.body.style.setProperty('--scroll-position', '');
  }
};

// Экспортируем в глобальную область для обратной совместимости
// Основной доступ через window.App.services.scrollManager
if (typeof window !== 'undefined') {
  window.ScrollManager = ScrollManager;
}

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScrollManager;
}
