/**
 * Управление навигацией
 * ООО "ВД Инжиниринг"
 */
class NavigationManager {
  constructor() {
    this.scrollThreshold = window.CONFIG?.NAVIGATION?.SCROLL_HEADER_THRESHOLD || 100;
    this.scrollTopThreshold = window.CONFIG?.NAVIGATION?.SCROLL_TOP_THRESHOLD || 500;
    this.swipeThreshold = 50;
    this.navbar = null;
    this.scrollToTopBtn = null;
    this.mobileMenuBtn = null;
    this.mobileMenuOverlay = null;
    this.scrollHandler = null;
    this.touchStartX = 0;
    this.touchCurrentX = 0;
    this.boundResizeHandler = null;
    this.boundTouchStartHandler = null;
    this.boundTouchMoveHandler = null;
    this.boundTouchEndHandler = null;
    this.boundKeydownHandler = null;
    this.boundOverlayClickHandler = null;
    this.boundMenuClickHandler = null;
    this.boundLinkClickHandlers = new Map();
    this.boundPageShowHandler = null;
    this.boundGlobalClickHandler = null;
    this.smoothScrollHandler = null;
    this._updateNavTimeout = null;
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

      this.updateNavLinksForMobile();

      // Debounced resize для переключения ссылок (partners/contacts: якоря ↔ отдельные страницы)
      this.boundResizeHandler = () => {
        clearTimeout(this._updateNavTimeout);
        this._updateNavTimeout = setTimeout(() => this.updateNavLinksForMobile(), 150);
      };
      window.addEventListener('resize', this.boundResizeHandler);

      document.addEventListener('components:loaded', () => this.updateNavLinksForMobile());

      Logger.INFO('NavigationManager initialized');
    } catch (error) {
      Logger.ERROR('NavigationManager init failed:', error);
    }
  }

  /**
   * Ссылки на партнёров и контакты:
   *  - на десктопе — якоря на главной странице (/index#partners, /index#contact-details)
   *  - на мобильных — отдельные страницы (/partners, /contacts)
   *
   * В шаблоне NavbarTemplate уже прописаны корректные href, поэтому
   * функция нужна только при ресайзе окна: чтобы при смене режима
   * заменить href на противоположный.
   */
  updateNavLinksForMobile() {
    const isMobile = window.innerWidth < (window.CONFIG?.LAYOUT?.MOBILE_BREAKPOINT || 1048);

    const partnerTargets = new Set(['/index#partners', 'index.html#partners', '/partners', '/partners.html', 'partners.html']);
    const contactTargets = new Set(['/index#contact-details', 'index.html#contact-details', '/contacts', '/contacts.html', 'contacts.html']);

    const apply = (link) => {
      const href = link.getAttribute('href');
      if (!href) return;

      if (partnerTargets.has(href)) {
        link.setAttribute('href', isMobile ? '/partners' : '/index#partners');
      } else if (contactTargets.has(href)) {
        link.setAttribute('href', isMobile ? '/contacts' : '/index#contact-details');
      }
    };

    document.querySelectorAll('.nav-links a').forEach(apply);
    document.querySelectorAll('.mobile-menu a').forEach(apply);
  }

  _initSmoothScroll() {
    this.smoothScrollHandler = (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || !link.hash) return;
      const targetId = link.hash.substring(1);
      const targetElement = document.getElementById(targetId);
      if (!targetElement) return;

      e.preventDefault();

      const getHeaderHeight = () => {
        const navbar = document.querySelector('.navbar');
        return navbar ? navbar.offsetHeight : 70;
      };
      const EXTRA_OFFSET = -5;

      const headerHeight = getHeaderHeight();
      const rect = targetElement.getBoundingClientRect();
      const targetTop = rect.top + window.scrollY;
      const offset = headerHeight + EXTRA_OFFSET;
      window.scrollTo({ top: targetTop - offset, behavior: 'smooth' });
    };
    document.addEventListener('click', this.smoothScrollHandler);
  }

  _initScrollHandler() {
    let scrollTimeout;

    this.scrollHandler = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => this._handleScroll(), window.CONFIG?.PERFORMANCE?.SCROLL_DEBOUNCE_MS || 10);
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
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

  _initMobileMenu() {
    if (!this.mobileMenu) return;

    this._updateMobileMenuAccessibility(false);

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

    this.boundPageShowHandler = (e) => {
      if (e.persisted || this.mobileMenu.classList.contains('active')) {
        this.closeMobileMenu();
      }
    };
    window.addEventListener('pageshow', this.boundPageShowHandler);

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

    this.boundKeydownHandler = (e) => {
      if (e.key === 'Escape' && this.mobileMenu.classList.contains('active')) {
        this.closeMobileMenu();
      }
    };
    document.addEventListener('keydown', this.boundKeydownHandler);

    if (this.mobileMenuOverlay) {
      this.boundOverlayClickHandler = (e) => {
        e.stopPropagation();
        this.closeMobileMenu();
      };
      this.mobileMenuOverlay.addEventListener('click', this.boundOverlayClickHandler);
    }

    this.boundMenuClickHandler = (e) => {
      e.stopPropagation();
    };
    this.mobileMenu.addEventListener('click', this.boundMenuClickHandler);

    this.mobileMenu.querySelectorAll('a').forEach(link => {
      const linkClickHandler = (e) => {
        const href = link.getAttribute('href');
        if (!href) return;

        this.closeMobileMenu();

        let url;
        try {
          url = new URL(href, window.location.href);
        } catch (err) {
          return;
        }

        const isSamePage = url.pathname === window.location.pathname;
        const hasHash = url.hash && url.hash.length > 1;

        if (isSamePage && hasHash) {
          e.preventDefault();
          const targetId = url.hash.substring(1);
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
      };
      link.addEventListener('click', linkClickHandler);
      this.boundLinkClickHandlers.set(link, linkClickHandler);
    });
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

    this._updateMobileMenuAccessibility(true);

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

    this._updateMobileMenuAccessibility(false);

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
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.smoothScrollHandler) {
      document.removeEventListener('click', this.smoothScrollHandler);
    }
    if (this.boundResizeHandler) {
      window.removeEventListener('resize', this.boundResizeHandler);
      clearTimeout(this._updateNavTimeout);
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

    this.boundLinkClickHandlers.forEach((handler, link) => {
      link.removeEventListener('click', handler);
    });
    this.boundLinkClickHandlers.clear();

    this.navbar = null;
    this.scrollToTopBtn = null;
    this.mobileMenu = null;
    this.mobileMenuBtn = null;
    this.mobileMenuOverlay = null;
  }
}

const navigationManager = new NavigationManager();

window.scrollToTop = () => navigationManager.scrollToTop();