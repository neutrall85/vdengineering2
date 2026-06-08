/**
 * Управление навигацией
 * ООО "Волга-Днепр Инжиниринг"
 */

class NavigationManager {
  constructor() {
    this.scrollThreshold = window.CONFIG?.NAVIGATION?.SCROLL_HEADER_THRESHOLD || 100;
    this.scrollTopThreshold = window.CONFIG?.NAVIGATION?.SCROLL_TOP_THRESHOLD || 500;
    this.swipeThreshold = 50;
    this.navbar = null;
    this.scrollToTopBtn = null;
    this.mobileMenu = null;
    this.mobileMenuBtn = null;
    this.mobileMenuOverlay = null;
    this.scrollHandler = null;
    this.resizeHandler = null;
    this.touchStartX = 0;
    this.touchCurrentX = 0;
    // Ссылки на обработчики для последующего удаления
    this.boundResizeHandler = null;
    this.boundTouchStartHandler = null;
    this.boundTouchMoveHandler = null;
    this.boundTouchEndHandler = null;
    this.boundClickHandler = null;
    this.boundKeydownHandler = null;
    this.boundOverlayClickHandler = null;
    this.boundMenuClickHandler = null;
    this.boundLinkClickHandlers = new Map();
    this.boundPageShowHandler = null;
    this.boundGlobalClickHandler = null;
    this.smoothScrollHandler = null;
  }

  init() {
    try {
      this.navbar = document.getElementById('navbar');
      this.scrollToTopBtn = document.getElementById('scrollToTop');
      this.mobileMenu = document.getElementById('mobileMenu');
      this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
      this.mobileMenuOverlay = document.getElementById('mobileMenuOverlay');

      if (!this.navbar || !this.mobileMenu || !this.mobileMenuBtn) {
        Logger.WARN('Navigation elements not found');
        return;
      }

      this._initSmoothScroll();
      this._initScrollHandler();
      this._initMobileMenu();
      this._initScrollToTop();
      this._handleScroll();

      Logger.INFO('NavigationManager initialized');
    } catch (error) {
      Logger.ERROR('NavigationManager init failed:', error);
    }
  }

  _initSmoothScroll() {
    // Обработчик клика на якорные ссылки для плавной прокрутки
    this.smoothScrollHandler = (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || !link.hash) return;

      const targetId = link.hash.substring(1);
      const targetElement = document.getElementById(targetId);

      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({ behavior: 'smooth' });

        // Закрываем мобильное меню, если оно открыто
        if (this.mobileMenu && this.mobileMenu.classList.contains('active')) {
          this.closeMobileMenu();
        }
      }
    };
    document.addEventListener('click', this.smoothScrollHandler);
  }

  _initScrollHandler() {
    let scrollTimeout;
    let resizeTimeout;

    this.scrollHandler = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => this._handleScroll(), window.CONFIG?.PERFORMANCE?.SCROLL_DEBOUNCE_MS || 10);
    };

    this.resizeHandler = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this._onResize(), window.CONFIG?.PERFORMANCE?.RESIZE_DEBOUNCE_MS || 150);
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler);
  }

  _handleScroll() {
    const scrollY = window.scrollY;

    if (this.navbar) {
      if (scrollY > this.scrollThreshold) {
        this.navbar.classList.add('scrolled');
      } else {
        this.navbar.classList.remove('scrolled');
      }
    }

    if (this.scrollToTopBtn) {
      if (scrollY > this.scrollTopThreshold) {
        this.scrollToTopBtn.classList.add('visible');
      } else {
        this.scrollToTopBtn.classList.remove('visible');
      }
    }
  }

  _onResize() {
    // Обработчик изменения размера окна
    // Дополнительная логика может быть добавлена при необходимости
  }

  _initMobileMenu() {
    if (!this.mobileMenu) return;

    // Инициализация доступности мобильного меню: при закрытом меню ссылки недоступны для Tab
    this._updateMobileMenuAccessibility(false);

    // Touch handlers
    this.boundTouchStartHandler = (e) => {
      this.touchStartX = e.touches[0].clientX;
    };
    this.mobileMenu.addEventListener('touchstart', this.boundTouchStartHandler, { passive: true });

    this.boundTouchMoveHandler = (e) => {
      this.touchCurrentX = e.touches[0].clientX;
    };
    this.mobileMenu.addEventListener('touchmove', this.boundTouchMoveHandler, { passive: true });

    this.boundTouchEndHandler = () => {
      const swipeDistance = this.touchCurrentX - this.touchStartX;
      if (swipeDistance > this.swipeThreshold) {
        this.closeMobileMenu();
      }
      this.touchStartX = 0;
      this.touchCurrentX = 0;
    };
    this.mobileMenu.addEventListener('touchend', this.boundTouchEndHandler);

    // Page show handler
    this.boundPageShowHandler = (e) => {
      if (e.persisted || this.mobileMenu.classList.contains('active')) {
        this.closeMobileMenu();
      }
    };
    window.addEventListener('pageshow', this.boundPageShowHandler);

    // Global click handler
    this.boundGlobalClickHandler = (e) => {
      if (e.target.closest('#mobileMenuBtn')) {
        e.stopPropagation();
        this.toggleMobileMenu();
      }
      if (e.target.id === 'mobileMenuOverlay') {
        this.closeMobileMenu();
      }
    };
    document.addEventListener('click', this.boundGlobalClickHandler);

    // Keydown handler
    this.boundKeydownHandler = (e) => {
      if (e.key === 'Escape' && this.mobileMenu.classList.contains('active')) {
        this.closeMobileMenu();
      }
    };
    document.addEventListener('keydown', this.boundKeydownHandler);

    // Overlay click handler
    if (this.mobileMenuOverlay) {
      this.boundOverlayClickHandler = (e) => {
        e.stopPropagation();
        this.closeMobileMenu();
      };
      this.mobileMenuOverlay.addEventListener('click', this.boundOverlayClickHandler);
    }

    // Menu click handler (stop propagation)
    this.boundMenuClickHandler = (e) => {
      e.stopPropagation();
    };
    this.mobileMenu.addEventListener('click', this.boundMenuClickHandler);

    // Link click handlers
    this.mobileMenu.querySelectorAll('a').forEach(link => {
      const linkClickHandler = (e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        // Закрываем меню (синхронно)
        this.closeMobileMenu();

        // Создаём URL относительно текущей страницы
        let url;
        try {
          url = new URL(href, window.location.href);
        } catch (err) {
          return; // некорректная ссылка
        }

        const isSamePage = url.pathname === window.location.pathname;
        const hasHash = url.hash && url.hash.length > 1;

        if (isSamePage && hasHash) {
          // Якорь на текущей странице – отменяем переход и скроллим
          e.preventDefault();
          const targetId = url.hash.substring(1);
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
        // Если ссылка на другую страницу – ничего не делаем, браузер выполнит переход
        // (меню уже закрыто, скролл разблокирован)
      };
      link.addEventListener('click', linkClickHandler);
      this.boundLinkClickHandlers.set(link, linkClickHandler);
    });

    // Resize handler for closing menu on desktop
    this.boundResizeHandler = () => {
      const breakpoint = window.CONFIG?.LAYOUT?.MOBILE_BREAKPOINT || 1048;
      if (window.innerWidth > breakpoint && this.mobileMenu.classList.contains('active')) {
        this.closeMobileMenu();
      }
    };
    window.addEventListener('resize', this.boundResizeHandler);
  }

  _initScrollToTop() {
    if (this.scrollToTopBtn) {
      this.scrollToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.scrollToTop();
      });
    }
  }

  openMobileMenu() {
    if (!this.mobileMenu) return;

    this.mobileMenu.classList.add('active');
    if (this.mobileMenuOverlay) this.mobileMenuOverlay.classList.add('active');
    if (this.mobileMenuBtn) this.mobileMenuBtn.classList.add('active');

    // Обновляем доступность: делаем ссылки мобильного меню доступными для Tab
    this._updateMobileMenuAccessibility(true);

    // Используем только ScrollManager для блокировки скролла
    if (window.ScrollManager) {
      ScrollManager.lock();
    } else {
      Logger.WARN('ScrollManager not available for mobile menu');
    }
  }

  closeMobileMenu() {
    if (!this.mobileMenu) return;

    this.mobileMenu.classList.remove('active');
    if (this.mobileMenuOverlay) this.mobileMenuOverlay.classList.remove('active');
    if (this.mobileMenuBtn) this.mobileMenuBtn.classList.remove('active');

    // Обновляем доступность: делаем ссылки мобильного меню недоступными для Tab
    this._updateMobileMenuAccessibility(false);

    // Используем только ScrollManager для разблокировки скролла
    if (window.ScrollManager) {
      ScrollManager.unlock();
    } else {
      Logger.WARN('ScrollManager not available for mobile menu close');
    }
  }

  toggleMobileMenu() {
    if (this.mobileMenu && this.mobileMenu.classList.contains('active')) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Обновление доступности ссылок мобильного меню для навигации с клавиатуры
   * @param {boolean} isOpen - состояние меню (открыто/закрыто)
   */
  _updateMobileMenuAccessibility(isOpen) {
    if (!this.mobileMenu) return;
    
    const links = this.mobileMenu.querySelectorAll('a');
    links.forEach(link => {
      if (isOpen) {
        link.setAttribute('tabindex', '0');
        link.removeAttribute('aria-hidden');
      } else {
        link.setAttribute('tabindex', '-1');
        link.setAttribute('aria-hidden', 'true');
      }
    });
  }

  destroy() {
    // Удаляем обработчики событий
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.smoothScrollHandler) {
      document.removeEventListener('click', this.smoothScrollHandler);
    }
    if (this.boundResizeHandler) {
      window.removeEventListener('resize', this.boundResizeHandler);
    }
    if (this.boundTouchStartHandler && this.mobileMenu) {
      this.mobileMenu.removeEventListener('touchstart', this.boundTouchStartHandler);
    }
    if (this.boundTouchMoveHandler && this.mobileMenu) {
      this.mobileMenu.removeEventListener('touchmove', this.boundTouchMoveHandler);
    }
    if (this.boundTouchEndHandler && this.mobileMenu) {
      this.mobileMenu.removeEventListener('touchend', this.boundTouchEndHandler);
    }
    if (this.boundPageShowHandler) {
      window.removeEventListener('pageshow', this.boundPageShowHandler);
    }
    if (this.boundGlobalClickHandler) {
      document.removeEventListener('click', this.boundGlobalClickHandler);
    }
    if (this.boundKeydownHandler) {
      document.removeEventListener('keydown', this.boundKeydownHandler);
    }
    if (this.boundOverlayClickHandler && this.mobileMenuOverlay) {
      this.mobileMenuOverlay.removeEventListener('click', this.boundOverlayClickHandler);
    }
    if (this.boundMenuClickHandler && this.mobileMenu) {
      this.mobileMenu.removeEventListener('click', this.boundMenuClickHandler);
    }
    
    // Удаляем обработчики кликов по ссылкам
    this.boundLinkClickHandlers.forEach((handler, link) => {
      link.removeEventListener('click', handler);
    });
    this.boundLinkClickHandlers.clear();
    
    // Очищаем ссылки на DOM-элементы для предотвращения утечек памяти
    this.navbar = null;
    this.scrollToTopBtn = null;
    this.mobileMenu = null;
    this.mobileMenuBtn = null;
    this.mobileMenuOverlay = null;
  }
}

const navigationManager = new NavigationManager();

// Экспорт удален - регистрация происходит через Application.services
// window.scrollToTop остается как глобальная функция для обратной совместимости
window.scrollToTop = () => navigationManager.scrollToTop();