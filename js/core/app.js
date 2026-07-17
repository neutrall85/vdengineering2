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
    this.scrollProgressElements = null;
    this._boundProgressHandler = null;
    this._boundResizeHandler = null;
    this._boundHashChangeHandler = null;
  }

  async init() {
      try {
          if (typeof ConsentManager === 'undefined') {
              throw new Error('ConsentManager is not loaded - critical security module missing');
          }
  
          const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
          const componentsLoadedPromise = new Promise((resolve) => {
              const onComponentsLoaded = () => {
                  document.removeEventListener('components:loaded', onComponentsLoaded);
                  resolve();
              };
              document.addEventListener('components:loaded', onComponentsLoaded);
  
              if (typeof ComponentLoader !== 'undefined') {
                  ComponentLoader.init({
                      loadNavbar: true,
                      loadFooter: true,
                      loadModal: true,
                      activePage: currentPage === 'index' ? '' : currentPage
                  });
              } else {
                  resolve();
              }
          });
          await componentsLoadedPromise;
  
          this._hidePageLoader();
          this._initGlobalHelpers();
          this._setCurrentYear();
          this._registerModules();
          this._registerModals();
  
          for (const module of this.modules) {
              try {
                  if (module && typeof module.init === 'function') {
                      await module.init();
                  }
              } catch (err) {
                  this.errors.push(`Module ${module.constructor?.name || 'unknown'} init failed: ${err.message}`);
              }
          }
  
          this._initFormManagers();
          this._openModalFromUrl();
  
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
          this._initScrollProgressBar();
          this._initHashListener();
          this._initMapLoader();
  
          // ========== Инициализация репортера ошибок ==========
          if (typeof textSelectionReporter !== 'undefined') {
              textSelectionReporter.init();
          }
  
          setTimeout(() => {
              this._openModalFromHash();
          }, 300);
  
          if (!this._visibilityHandlerAdded) {
              document.addEventListener('visibilitychange', () => {
                  if (!document.hidden) {
                      if (window.newsManager) {
                          const activeTab = document.querySelector('.news-tab.active');
                          if (activeTab) {
                              const year = activeTab.dataset.year || activeTab.dataset.tab;
                              if (year) {
                                  const container = document.getElementById(`newsGrid-${year}`);
                                  if (container && window.newsRenderer) {
                                      window.newsRenderer.render(year, container);
                                  }
                              }
                          }
                      }
                  }
              });
              this._visibilityHandlerAdded = true;
          }
  
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

  _initFormManagers() {
    const proposalForm = document.getElementById('proposalForm');
    if (proposalForm) {
      if (typeof FormManager !== 'undefined' && window.Services?.apiClient) {
        const rateLimiter = new Utils.RateLimiter(window.Services.storage);
        window.formManager = new FormManager(window.Services.apiClient, rateLimiter);
        this.services.formManager = window.formManager;
      } else {
        Logger.WARN('FormManager or apiClient not available');
      }
    } else {
      Logger.WARN('Form #proposalForm not found, FormManager not created');
    }

    if (typeof UniversalApplicationModalManager !== 'undefined') {
      UniversalApplicationModalManager.init();
      this.services.universalModalManager = UniversalApplicationModalManager;
    } else {
      Logger.WARN('UniversalApplicationModalManager not available');
    }

    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        const rateLimiter = new Utils.RateLimiter(window.Services.storage);
        window.feedbackFormManager = new ModalFormHandler({
            formId: 'feedbackForm',
            successSelector: '#feedbackSuccessMessage',
            fileDropSelector: '.form-file',
            apiClient: window.Services.apiClient,
            rateLimiter: rateLimiter,
            modalKey: 'feedback',
            fileOptions: { maxFiles: 10, maxTotalSize: 24 * 1024 * 1024 },
            messages: {
                required: 'Это поле обязательно для заполнения',
                email: 'Введите корректный email адрес',
                consent: 'Необходимо согласие на обработку данных'
            },
            onSuccess: null
        });
        window.feedbackFormManager.init();
        this.services.feedbackFormManager = window.feedbackFormManager;
    }

    const dateInput = document.getElementById('desiredDate');
    if (dateInput && typeof DateInputHelper !== 'undefined') {
        DateInputHelper.initDateInput(dateInput);
    }
    const approvalDateInput = document.getElementById('desiredApprovalDate');
    if (approvalDateInput && typeof DateInputHelper !== 'undefined') {
        DateInputHelper.initDateInput(approvalDateInput);
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
      { key: 'news', overlayId: 'newsModalOverlay', required: false },
      {
        key: 'proposal',
        overlayId: 'proposalModalOverlay',
        required: false,
        focusSelector: '#companyName',
        onClose: () => {
          if (window.formManager) {
            window.formManager.resetForm();
          } else {
            Logger.WARN('formManager not available on proposal close');
          }
        }
      },
      {
        key: 'universal',
        overlayId: 'universalApplicationModalOverlay',
        required: false,
        focusSelector: 'input[type="text"], input[type="email"], textarea',
        onClose: () => {
          if (typeof UniversalApplicationModalManager !== 'undefined') {
            UniversalApplicationModalManager.resetForm();
          } else {
            Logger.WARN('UniversalApplicationModalManager not available on universal close');
          }
        }
      },
      { key: 'project', overlayId: 'projectModalOverlay', required: false },
      { key: 'service', overlayId: 'serviceModalOverlay', required: false },
      { key: 'policy', overlayId: 'policyModalOverlay', required: false },
      { key: 'success', overlayId: 'successModalOverlay', required: false },
      { 
        key: 'feedback', 
        overlayId: 'feedbackModalOverlay', 
        required: false, 
        onClose: () => 
        { 
          if (window.feedbackFormManager) feedbackFormManager.resetForm(); 
        } 
      },
      { key: 'category', overlayId: 'categoryNewsModalOverlay', required: false },
      { key: 'project-category', overlayId: 'projectCategoryModalOverlay', required: false }
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
    window.closeMobileMenu = () => {
      if (navigationManager) navigationManager.closeMobileMenu();
    };
    window.removeFile = (event, index) => {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
      if (window.formManager && typeof window.formManager.removeFile === 'function') {
        window.formManager.removeFile(index);
      } else if (typeof UniversalApplicationModalManager !== 'undefined' && UniversalApplicationModalManager.removeFile) {
        UniversalApplicationModalManager.removeFile(index);
      } else if (window.feedbackFormManager && typeof window.feedbackFormManager.removeFile === 'function') {
        window.feedbackFormManager.removeFile(index);
      }
    };
    window.toggleWidget = (header) => {
      const widget = header.closest('.certificate-widget');
      if (widget) {
        widget.classList.toggle('active');
      }
    };

    document.addEventListener('click', (e) => {
        const link = e.target.closest('#cookie-settings-link');
        if (!link) return;
        
        e.preventDefault();
        
        const storage = window.Services?.storage;
        if (storage && typeof ConsentManager?.withdrawConsent === 'function') {
            ConsentManager.withdrawConsent(storage);
        }
        
        setTimeout(() => {
            const container = document.getElementById('mapContainer');
            if (!container) return;
            
            const staticUrl = window.CONFIG?.MAP?.STATIC_URL;
            if (!staticUrl) return;
            
            const iframe = container.querySelector('iframe');
            if (iframe) iframe.remove();
            
            let img = container.querySelector('img');
            if (img) return;
            
            img = document.createElement('img');
            img.id = 'staticMap';
            img.className = 'static-map';
            img.src = staticUrl;
            img.alt = 'Карта проезда к офису';
            img.loading = 'lazy';
            container.appendChild(img);
            
            Logger.INFO('Карта принудительно переключена на статику (прямой обработчик)');
        }, 150);
    });
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

    const currentPath = window.location.pathname;

    if (currentPath === '/partners.html' || currentPath === '/contacts.html') {
      floatingBtn.classList.add('visible');
      return;
    }

    const isHomePage = currentPath === '/' ||
                       currentPath.endsWith('index.html') ||
                       currentPath === '';
    if (!isHomePage) {
      floatingBtn.remove();
      return;
    }

    const heroSection = document.querySelector('.hero');
    if (heroSection) {
      this._heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.intersectionRatio < 0.5) {
            floatingBtn.classList.add('visible');
          } else {
            floatingBtn.classList.remove('visible');
          }
        });
      }, { threshold: [0, 0.5, 1] });
      this._heroObserver.observe(heroSection);
    } else {
      const SCROLL_THRESHOLD = 150;
      this._boundFloatingScrollHandler = () => {
        if (window.scrollY > SCROLL_THRESHOLD) {
          floatingBtn.classList.add('visible');
        } else {
          floatingBtn.classList.remove('visible');
        }
      };
      window.addEventListener('scroll', this._boundFloatingScrollHandler);
      this._boundFloatingScrollHandler();
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
    const hash = window.location.hash;
    if (!hash || hash === '#') return;
    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;

    const scrollToTarget = () => {
      setTimeout(() => {
        const navbar = document.querySelector('.navbar');
        const headerHeight = navbar ? navbar.offsetHeight : 70;
        const extraOffset = 5;
        const offset = headerHeight + extraOffset;

        const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
      }, window.CONFIG?.PERFORMANCE?.HASH_SCROLL_DELAY_MS || 400);
    };

    document.addEventListener('components:loaded', scrollToTarget, { once: true });
    setTimeout(scrollToTarget, 800);
  }

  _initScrollProgressBar() {
    if (this.scrollProgressElements) return;
    const container = document.createElement('div');
    container.className = 'scroll-progress-container';
    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    container.appendChild(bar);
    document.body.appendChild(container);
    this.scrollProgressElements = { container, bar };

    const updateProgress = () => {
      const winScroll = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (winScroll / height) * 100;
      requestAnimationFrame(() => {
        bar.style.setProperty('--progress', scrolled + '%');
      });
    };

    this._boundProgressHandler = updateProgress;
    this._boundResizeHandler = updateProgress;
    window.addEventListener('scroll', this._boundProgressHandler);
    window.addEventListener('resize', this._boundResizeHandler);
    updateProgress();
  }

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

  _initHashListener() {
    this._boundHashChangeHandler = () => {
      this._openModalFromHash();
    };
    window.addEventListener('hashchange', this._boundHashChangeHandler);
  }

  _openModalFromHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const [type, id] = hash.split('=');
    if (!type || !id) return;

    const modalManager = this.services.modalManager;
    if (!modalManager) {
      Logger.WARN('ModalManager not available for hash handling');
      return;
    }

    if (modalManager.activeModal === type && modalManager.currentModalId === id) {
      return;
    }

    const decodedId = decodeURIComponent(id);

    if (type === 'project') {
      modalManager.openProjectById(decodedId);
    } else if (type === 'news') {
      modalManager.openNewsById(decodedId);
    } else if (type === 'category') {
      modalManager.openCategoryByName(decodedId);
    } else if (type === 'project-category') {
      modalManager.openProjectCategoryByName(decodedId);
    }
  }

  _openModalFromUrl() {
    const url = new URL(window.location.href);
    const modalKey = url.searchParams.get('modal');
    if (modalKey && this.services.modalManager) {
      setTimeout(() => {
        this.services.modalManager.open(modalKey);
      }, 300);
    }
  }

  _initMapLoader() {
    const container = document.getElementById('mapContainer');
    if (!container) return;

    const staticUrl = window.CONFIG?.MAP?.STATIC_URL;
    const mapPageUrl = window.CONFIG?.MAP?.MAP_PAGE_URL;

    if (!staticUrl || !mapPageUrl) {
      Logger.WARN('Map static URL or page URL not configured');
      return;
    }

    container.innerHTML = '';
    const img = document.createElement('img');
    img.className = 'static-map';
    img.src = staticUrl;
    img.alt = 'Карта проезда к офису';
    img.loading = 'lazy';
    img.addEventListener('click', () => {
      window.open(mapPageUrl, '_blank');
    });
    container.appendChild(img);
    Logger.INFO('Статическая карта загружена');
  }

  _showError(error) {
    const errorContainer = document.getElementById('appError');
    if (errorContainer) {
      errorContainer.style.display = 'block';
      errorContainer.replaceChildren();

      const errorDiv = document.createElement('div');
      errorDiv.className = 'app-error-message-block';

      const h2 = document.createElement('h2');
      h2.className = 'app-error-title';
      h2.textContent = 'Ошибка загрузки приложения';
      errorDiv.appendChild(h2);

      const p1 = document.createElement('p');
      p1.className = 'app-error-text';
      p1.textContent = 'Произошла ошибка при инициализации сайта. Пожалуйста, обновите страницу.';
      errorDiv.appendChild(p1);

      const p2 = document.createElement('p');
      p2.className = 'app-error-detail';
      p2.textContent = Utils.Sanitizer.escapeHtml(error.message);
      errorDiv.appendChild(p2);

      const reloadBtn = document.createElement('button');
      reloadBtn.className = 'app-error-reload-btn';
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
    if (this._prefersReducedMotion && this._boundMotionChangeHandler) {
      this._prefersReducedMotion.removeEventListener('change', this._boundMotionChangeHandler);
    }
    if (this._heroObserver) {
      this._heroObserver.disconnect();
      this._heroObserver = null;
    }
    if (this._boundFloatingScrollHandler) {
      window.removeEventListener('scroll', this._boundFloatingScrollHandler);
      this._boundFloatingScrollHandler = null;
    }
    if (this.imageObserver) {
      this.imageObserver.disconnect();
      this.imageObserver = null;
    }
    this._destroyScrollProgressBar();

    if (this._boundHashChangeHandler) {
      window.removeEventListener('hashchange', this._boundHashChangeHandler);
      this._boundHashChangeHandler = null;
    }

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
    if (this.services.feedbackFormManager && typeof this.services.feedbackFormManager.destroy === 'function') {
      this.services.feedbackFormManager.destroy();
    }
    if (typeof UniversalApplicationModalManager !== 'undefined' && typeof UniversalApplicationModalManager.destroy === 'function') {
      UniversalApplicationModalManager.destroy();
    }
    if (typeof textSelectionReporter !== 'undefined' && typeof textSelectionReporter.destroy === 'function') {
      textSelectionReporter.destroy();
    }

    this._cleanupGlobals();
    this.modules = [];
    this.errors = [];
    this.services = {};
    this.initialized = false;
  }

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
      'initProjectGallery',
      'openApplicationModal',
      'closeUniversalApplicationModal'
    ];
    globalFunctions.forEach(fnName => {
      if (typeof window[fnName] === 'function') {
        delete window[fnName];
      }
    });
  }
}

window.Application = Application;

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
        window.newsRenderer = new NewsRenderer(NEWS_DATA);
        window.newsManager = new NewsManager(NEWS_DATA, window.newsRenderer);
        window.newsManager.init();
      } else {
        Logger.ERROR('NewsRenderer или NewsManager не определен');
      }
    } catch (err) {
      Logger.ERROR('Ошибка инициализации менеджеров новостей:', err);
    }
  }

  if (typeof PROJECTS_DATA !== 'undefined' && typeof ProjectRenderer !== 'undefined') {
    try {
      window.projectRenderer = new ProjectRenderer(PROJECTS_DATA);
      Logger.INFO('projectRenderer создан глобально');
    } catch (err) {
      Logger.ERROR('Ошибка создания projectRenderer:', err);
    }
  }

  if (typeof initDocPreviews === 'function') {
    initDocPreviews();
  }

  const app = new Application();
  window.App = app;

  if (typeof ConsentManager !== 'undefined') {
    try {
      ConsentManager.init();
      app.services.consentManager = ConsentManager;
    } catch (err) {
      Logger.ERROR('Failed to initialize ConsentManager:', err);
    }
  }

  app.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}