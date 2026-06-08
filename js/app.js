/**
 * Главный файл инициализации приложения
 * ООО "Волга-Днепр Инжиниринг"
 */

class Application {
  constructor() {
    this.initialized = false;
    this.modules = [];
    this.errors = [];
    this.services = {};
    // НОВОЕ: переменные для прогресс-бара
    this.scrollProgressElements = null;
    this._boundProgressHandler = null;
    this._boundResizeHandler = null;
  }

  async init() {
    try {
      if (typeof ConsentManager === 'undefined') {
        throw new Error('ConsentManager is not loaded - critical security module missing');
      }
      
      if (typeof ComponentLoader !== 'undefined') {
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
        const componentsLoadedPromise = new Promise((resolve) => {
          const onComponentsLoaded = () => {
            document.removeEventListener('components:loaded', onComponentsLoaded);
            resolve();
          };
          document.addEventListener('components:loaded', onComponentsLoaded);
          ComponentLoader.init({ 
            loadNavbar: true, 
            loadFooter: true, 
            loadModal: true,
            activePage: currentPage === 'index' ? '' : currentPage
          });
        });
        await componentsLoadedPromise;
      }
      
      this._hidePageLoader();
      this._initGlobalHelpers();
      this._setCurrentYear();
      this._registerModules();
      
      const registerModalsOnce = () => {
        if (!this._modalsRegistered) {
          this._registerModals();
        }
      };
      
      document.addEventListener('components:loaded', registerModalsOnce, { once: true });
      
      setTimeout(() => {
        registerModalsOnce();
      }, 100);
      
      for (const module of this.modules) {
        try {
          if (module && typeof module.init === 'function') {
            await module.init();
          }
        } catch (err) {
          this.errors.push(`Module ${module.constructor?.name || 'unknown'} init failed: ${err.message}`);
          if (window.Services?.eventBus) {
            window.Services.eventBus.emit('module:error', { module: module.constructor?.name, error: err.message });
          }
        }
      }
      
      const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
      const pageInitMap = {
        'projects': 'initProjectsPage',
        'services': 'initServicesPage',
        'vacancies': 'initVacanciesPage'
      };
      
      if (pageInitMap[currentPage]) {
        const initFn = window[pageInitMap[currentPage]];
        if (typeof initFn === 'function') {
          initFn();
        }
      }
      
      this._initFloatingCTA();
      this._initImageLazyLoading();
      this._initPrefersReducedMotion();
      this._handleHashScroll();
      
      // НОВОЕ: инициализация полосы прогресса
      this._initScrollProgressBar();
      
      this.initialized = true;
      if (this.errors.length > 0) {
        Logger.WARN('Application initialized with errors:', this.errors);
      }
      if (window.Services?.eventBus) {
        window.Services.eventBus.emit('app:ready');
      }
    } catch (error) {
      this._showError(error);
    }
  }

  _registerModules() {
    const modulesToRegister = [];
    
    if (typeof navigationManager !== 'undefined') {
      this.services.navigationManager = navigationManager;
      modulesToRegister.push(navigationManager);
    }
    if (typeof animationManager !== 'undefined') {
      this.services.animationManager = animationManager;
      modulesToRegister.push(animationManager);
    }
    if (typeof formManager !== 'undefined') {
      this.services.formManager = formManager;
      modulesToRegister.push(formManager);
    }
    if (typeof newsManager !== 'undefined') {
      this.services.newsManager = newsManager;
      modulesToRegister.push(newsManager);
    }
    if (typeof newsRenderer !== 'undefined') {
      this.services.newsRenderer = newsRenderer;
    }
    if (typeof modalManager !== 'undefined') {
      this.services.modalManager = modalManager;
    }
    
    this.modules = modulesToRegister;
  }

  _registerModals() {
    if (typeof modalManager === 'undefined') return;
    
    if (this._modalsRegistered) return;
    
    const modalsToRegister = [
      { key: 'about', overlayId: 'aboutModalOverlay', required: false },
      { key: 'details', overlayId: 'detailsModalOverlay', required: false },
      { 
        key: 'news', 
        overlayId: 'newsModalOverlay',
        required: false
      },
      { 
        key: 'proposal', 
        overlayId: 'proposalModalOverlay', 
        required: false,
        focusSelector: '#companyName'
      },
      { 
        key: 'universal', 
        overlayId: 'universalApplicationModalOverlay', 
        required: false,
        focusSelector: 'input[type="text"], input[type="email"], textarea'
      },
      { key: 'project', overlayId: 'projectModalOverlay', required: false },
      { key: 'service', overlayId: 'serviceModalOverlay', required: false },
      { key: 'policy', overlayId: 'policyModalOverlay', required: false }
    ];

    modalsToRegister.forEach(({ key, overlayId, required, onClose, onOpen, focusSelector }) => {
      const overlay = document.getElementById(overlayId);
      if (overlay) {
        modalManager.register(key, { overlayId, onClose, onOpen, focusSelector });
      } else if (required) {
        Logger.WARN(`Required modal "${key}" not found`);
      }
    });
    
    this._modalsRegistered = true;
  }

  _initGlobalHelpers() {
    window.scrollToTop = () => {
      if (navigationManager) navigationManager.scrollToTop();
    };
    
    window.toggleMobileMenu = () => {
      if (navigationManager) navigationManager.toggleMobileMenu();
    };
    
    window.closeModal = () => {
      if (typeof modalManager !== 'undefined') modalManager.close('form');
    };
    
    window.removeFile = (event, index) => {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      if (formManager && typeof formManager.removeFile === 'function') {
        formManager.removeFile(index);
      }
    };
    
    window.closeMobileMenu = () => {
      if (navigationManager) navigationManager.closeMobileMenu();
    };
    
    window.closeAboutModal = () => {
      if (typeof modalManager !== 'undefined') modalManager.close('about');
    };
    
    window.closeDetailsModal = () => {
      if (typeof modalManager !== 'undefined') modalManager.close('details');
    };
    
    window.closeNewsModal = () => {
      if (newsManager && typeof newsManager.closeNewsModal === 'function') {
        newsManager.closeNewsModal();
      } else if (typeof modalManager !== 'undefined') {
        modalManager.close('news');
      }
    };
    
    window.closePolicyModal = () => {
      if (typeof modalManager !== 'undefined') {
        modalManager.close('policy');
      }
    };
    
    window.toggleWidget = (header) => {
      const widget = header.closest('.certificate-widget');
      if (widget) {
        widget.classList.toggle('active');
      }
    };
    
    window.openDetailsModal = (title, details) => {
      const modalTitle = document.getElementById('detailsModalTitle');
      const modalList = document.getElementById('detailsModalList');
      
      if (modalTitle && modalList) {
        const sanitizer = window.Utils?.Sanitizer;
        modalTitle.textContent = sanitizer ? sanitizer.escapeHtml(title) : title;
        
        modalList.replaceChildren();
        const ul = document.createElement('ul');
        details.forEach(item => {
          const li = document.createElement('li');
          li.textContent = sanitizer ? sanitizer.escapeHtml(item) : item;
          ul.appendChild(li);
        });
        modalList.appendChild(ul);
        if (typeof modalManager !== 'undefined') modalManager.open('details');
      }
    };
    
    // Обработчик авто-ресайза textarea
    this._boundInputHandler = (e) => {
      if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('form-textarea')) {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
      }
    };
    document.addEventListener('input', this._boundInputHandler);
    
    // Обработчики открытия модалок теперь централизованы в ModalManager через data-modal-open
  }

  _hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      document.body.classList.add('app-ready');
      setTimeout(() => {
        loader.classList.add('hidden');
        setTimeout(() => {
          loader.style.display = 'none';
        }, 300);
      }, 100);
    }
  }

  _setCurrentYear() {
    const yearElement = document.getElementById('currentYear');
    if (yearElement) {
      yearElement.textContent = new Date().getFullYear();
    }
  }

  _initFloatingCTA() {
    const floatingBtn = document.querySelector('.floating-cta-btn');

    if (!floatingBtn) return;

    this._boundFloatingBtnClick = () => {
      if (typeof modalManager !== 'undefined') {
        modalManager.open('proposal');
      } else if (window.App?.services?.modalManager) {
        window.App.services.modalManager.open('proposal');
      } else if (typeof window.openModal === 'function') {
        window.openModal();
      }
    };
    floatingBtn.addEventListener('click', this._boundFloatingBtnClick, { passive: true });

    let heroExited = false;
    
    const heroSection = document.querySelector('.hero, header');
    if (heroSection) {
      this._heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            heroExited = true;
            floatingBtn.classList.add('visible');
          } else {
            heroExited = false;
            floatingBtn.classList.remove('visible');
          }
        });
      }, { threshold: 0 });
      
      this._heroObserver.observe(heroSection);
    }
  }

  _initImageLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
            }
            this.imageObserver.unobserve(img);
          }
        });
      }, { rootMargin: '100px' });
      
      lazyImages.forEach(img => this.imageObserver.observe(img));
    } else {
      lazyImages.forEach(img => {
        const src = img.getAttribute('data-src');
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
        }
      });
    }
  }

  _initPrefersReducedMotion() {
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (this._prefersReducedMotion.matches) {
      document.body.classList.add('reduced-motion');
      const style = document.createElement('style');
      style.textContent = `
        .reduced-motion *,
        .reduced-motion *::before,
        .reduced-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      `;
      document.head.appendChild(style);
    }
    
    this._boundMotionChangeHandler = (e) => {
      if (e.matches) {
        document.body.classList.add('reduced-motion');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    };
    this._prefersReducedMotion.addEventListener('change', this._boundMotionChangeHandler);
  }

  _handleHashScroll() {
    const isHomePage = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
    if (!isHomePage) return;

    const hash = window.location.hash;
    if (!hash || hash === '#') return;

    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;

    const scrollToTarget = () => {
      setTimeout(() => {
        const offset = window.CONFIG?.NAVIGATION?.HASH_SCROLL_OFFSET || 80;
        const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      }, window.CONFIG?.PERFORMANCE?.HASH_SCROLL_DELAY_MS || 400);
    };

    const onComponentsLoaded = () => {
      scrollToTarget();
    };

    document.addEventListener('components:loaded', onComponentsLoaded, { once: true });
    setTimeout(() => {
      scrollToTarget();
    }, 800);
  }

  // НОВОЕ: инициализация прогресс-бара прокрутки
  _initScrollProgressBar() {
    // Избегаем дублирования
    if (this.scrollProgressElements) return;

    // Создаём контейнер и полосу
    const container = document.createElement('div');
    container.className = 'scroll-progress-container';
    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    container.appendChild(bar);
    document.body.appendChild(container);
    this.scrollProgressElements = { container, bar };

    // Функция обновления ширины
    const updateProgress = () => {
      const winScroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (winScroll / height) * 100;
      requestAnimationFrame(() => {
        bar.style.width = scrolled + '%';
      });
    };

    // Привязываем обработчики с сохранением ссылок для удаления
    this._boundProgressHandler = updateProgress;
    this._boundResizeHandler = updateProgress;
    window.addEventListener('scroll', this._boundProgressHandler);
    window.addEventListener('resize', this._boundResizeHandler);
    // Запускаем один раз для установки начального значения
    updateProgress();
  }

  // НОВОЕ: удаление прогресс-бара (очистка ресурсов)
  _destroyScrollProgressBar() {
    if (this.scrollProgressElements) {
      const { container, bar } = this.scrollProgressElements;
      if (container && container.parentNode) container.parentNode.removeChild(container);
      this.scrollProgressElements = null;
    }
    if (this._boundProgressHandler) {
      window.removeEventListener('scroll', this._boundProgressHandler);
      window.removeEventListener('resize', this._boundResizeHandler);
      this._boundProgressHandler = null;
      this._boundResizeHandler = null;
    }
  }

  _showError(error) {
    const errorContainer = document.getElementById('appError');
    if (errorContainer) {
      errorContainer.style.display = 'block';
      errorContainer.replaceChildren();
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.style.background = '#f8d7da';
      errorDiv.style.color = '#721c24';
      errorDiv.style.padding = '1rem';
      errorDiv.style.margin = '1rem';
      errorDiv.style.borderRadius = '8px';
      
      const h2 = document.createElement('h2');
      h2.textContent = 'Ошибка загрузки приложения';
      errorDiv.appendChild(h2);
      
      const p1 = document.createElement('p');
      p1.textContent = 'Произошла ошибка при инициализации сайта. Пожалуйста, обновите страницу.';
      errorDiv.appendChild(p1);
      
      const p2 = document.createElement('p');
      p2.style.fontSize = '0.85rem';
      p2.style.marginTop = '0.5rem';
      p2.textContent = Utils.Sanitizer.escapeHtml(error.message);
      errorDiv.appendChild(p2);
      
      const reloadBtn = document.createElement('button');
      reloadBtn.id = 'reloadErrorBtn';
      reloadBtn.style.marginTop = '0.5rem';
      reloadBtn.style.padding = '0.5rem 1rem';
      reloadBtn.style.cursor = 'pointer';
      reloadBtn.textContent = 'Обновить страницу';
      reloadBtn.addEventListener('click', function() {
        window.location.reload();
      });
      errorDiv.appendChild(reloadBtn);
      
      errorContainer.appendChild(errorDiv);
    } else {
      alert('Ошибка загрузки приложения: ' + Utils.Sanitizer.escapeHtml(error.message));
    }
  }

  destroy() {
    // Очищаем обработчик prefers-reduced-motion
    if (this._prefersReducedMotion && this._boundMotionChangeHandler) {
      this._prefersReducedMotion.removeEventListener('change', this._boundMotionChangeHandler);
    }
    
    // Отключаем IntersectionObserver для hero секции
    if (this._heroObserver) {
      this._heroObserver.disconnect();
    }
    
    // Отключаем IntersectionObserver для ленивой загрузки изображений
    if (this.imageObserver) {
      this.imageObserver.disconnect();
      this.imageObserver = null;
    }
    
    // Удаляем обработчик плавающей кнопки CTA
    const floatingBtn = document.querySelector('.floating-cta-btn');
    if (floatingBtn && this._boundFloatingBtnClick) {
      floatingBtn.removeEventListener('click', this._boundFloatingBtnClick);
    }
    
    // Удаляем глобальный обработчик input для textarea
    if (this._boundInputHandler) {
      document.removeEventListener('input', this._boundInputHandler);
      this._boundInputHandler = null;
    }
    
    // НОВОЕ: удаляем прогресс-бар
    this._destroyScrollProgressBar();
    
    // Делегируем очистку модулям
    if (this.services.navigationManager && typeof this.services.navigationManager.destroy === 'function') {
      this.services.navigationManager.destroy();
    }
    if (this.services.animationManager && typeof this.services.animationManager.destroy === 'function') {
      this.services.animationManager.destroy();
    }
    if (this.services.modalManager && typeof this.services.modalManager.destroy === 'function') {
      this.services.modalManager.destroy();
    }
    if (this.services.newsManager && typeof this.services.newsManager.destroy === 'function') {
      this.services.newsManager.destroy();
    }
    if (this.services.newsRenderer && typeof this.services.newsRenderer.destroy === 'function') {
      this.services.newsRenderer.destroy();
    }
    if (this.services.formManager && typeof this.services.formManager.destroy === 'function') {
      this.services.formManager.destroy();
    }
    if (this.services.consentManager && typeof this.services.consentManager.destroy === 'function') {
      this.services.consentManager.destroy();
    }
    
    // Вызываем destroy у UniversalApplicationModalManager если он существует
    if (typeof UniversalApplicationModalManager !== 'undefined' && typeof UniversalApplicationModalManager.destroy === 'function') {
      UniversalApplicationModalManager.destroy();
    }
    
    // ОЧИСТКА ГЛОБАЛЬНЫХ ФУНКЦИЙ - добавляем cleanupGlobals
    this._cleanupGlobals();
    
    // Очищаем ссылки
    this.modules = [];
    this.errors = [];
    this.services = {};
    this.initialized = false;
  }
  
  /**
   * Очистка глобальных функций window установленных в _initGlobalHelpers
   */
  _cleanupGlobals() {
    const globalFunctions = [
      'scrollToTop',
      'toggleMobileMenu',
      'closeModal',
      'removeFile',
      'closeMobileMenu',
      'closeAboutModal',
      'closeDetailsModal',
      'closeNewsModal',
      'closePolicyModal',
      'toggleWidget',
      'openDetailsModal',
      'openProjectModal',
      'initProjectGallery'
    ];
    
    globalFunctions.forEach(fnName => {
      if (typeof window[fnName] === 'function') {
        delete window[fnName];
      }
    });
    
    // Также очищаем глобальные функции UniversalApplicationModalManager если они существуют
    if (typeof window.openApplicationModal === 'function') {
      delete window.openApplicationModal;
    }
    if (typeof window.closeUniversalApplicationModal === 'function') {
      delete window.closeUniversalApplicationModal;
    }
  }
}

// Экспортируем Application в глобальную область
window.Application = Application;

if (typeof Utils !== 'undefined' && Utils.DOM && !Utils.DOM.escapeHtml) {
  Utils.DOM.escapeHtml = function(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}

let newsRenderer, newsManager, formManager;

function initApp() {
  const hasConfig = typeof window.CONFIG !== 'undefined';
  const hasServices = typeof window.Services !== 'undefined';
  const hasUtils = typeof window.Utils !== 'undefined';
  
  if (!hasConfig || !hasServices || !hasUtils) {
    setTimeout(() => initApp(), window.CONFIG?.PERFORMANCE?.INIT_APP_DELAY_MS || 100);
    return;
  }
  
  if (typeof NEWS_DATA !== 'undefined') {
    try {
      if (typeof NewsRenderer !== 'undefined' && typeof NewsManager !== 'undefined') {
        newsRenderer = new NewsRenderer(NEWS_DATA);
        newsManager = new NewsManager(NEWS_DATA, newsRenderer);
        newsManager.init();
      } else {
        Logger.ERROR('NewsRenderer или NewsManager не определен');
      }
    } catch (err) {
      Logger.ERROR('Ошибка инициализации менеджеров новостей:', err);
    }
  }
  
  if (hasServices && hasUtils) {
    try {
      const formRateLimiter = new Utils.RateLimiter(window.Services.storage);
      formManager = new FormManager(
        window.Services.apiClient, 
        formRateLimiter, 
        Utils.Validator
      );
      formManager.init();
      window.openModal = () => formManager.openModal();
    } catch (err) {
      Logger.ERROR('Failed to initialize FormManager:', err);
    }
  } else {
    Logger.WARN('Required services or utils are not available for FormManager initialization');
  }
  
  // Инициализация ленивой загрузки PDF превью (только если функция существует)
  if (typeof initDocPreviews === 'function') {
    initDocPreviews();
  }
  
  const app = new Application();
  window.App = app;
  
  // Инициализация ConsentManager через единую точку Application
  // UI баннера теперь встроен непосредственно в ConsentManager
  if (typeof ConsentManager !== 'undefined') {
    try {
      ConsentManager.init();
      app.services.consentManager = ConsentManager;
    } catch (err) {
      console.error('Failed to initialize ConsentManager:', err);
    }
  }
  
  app.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}