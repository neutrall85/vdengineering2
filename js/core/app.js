/**
 * Главный файл инициализации приложения
 * ООО "Волга-Днепр Инжиниринг"
 * Строгий ООП стиль: нулевое использование инлайновых коллбэков
 */

class Application {
  constructor() {
    this.initialized = false;
    this.modules = [];
    this.errors = [];
    this.services = {};
    
    this._boundProgressHandler = null;
    this._boundResizeHandler = null;
    this._boundPopstateHandler = null;
    this._boundVisibilityHandler = null;
    this._boundHeroObserver = null;
    this._boundFloatingScrollHandler = null;
    this._boundImageObserver = null;
    this._boundMotionChangeHandler = null;
    this._boundCookieClickHandler = null;
    this._boundComponentsLoadedScrollHandler = null;
    this._boundHashScrollTimeout = null;

    this.scrollProgressElements = null;
    this._heroObserverInstance = null;
    this._imageObserverInstance = null;
    this._prefersReducedMotion = null;
    this._modalsRegistered = false;
    this._visibilityHandlerAdded = false;
  }

  async init() {
    try {
      if (typeof ConsentManager === 'undefined') {
        throw new Error('ConsentManager is not loaded - critical security module missing');
      }

      if (typeof initDynamicSEO === 'function') {
        try {
          initDynamicSEO();
          this._boundPopstateHandler = this._handlePopState.bind(this);
          window.addEventListener('popstate', this._boundPopstateHandler);
        } catch (seoError) {
          Logger.WARN('SEO initialization failed:', seoError);
        }
      }

      const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
      
      const componentsLoadedPromise = new Promise(this._resolveOnComponentsLoaded.bind(this));
      await componentsLoadedPromise;
      
      this._hidePageLoader();
      this._initGlobalHelpers();
      this._setCurrentYear();
      this._registerModules();
      this._registerModals();
      
      await this._initAllModules();
      
      this._initFormManagers();
      
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
      this._initMapLoader();
      
      if (typeof textSelectionReporter !== 'undefined') {
        textSelectionReporter.init();
      }
      
      if (!this._visibilityHandlerAdded) {
        this._boundVisibilityHandler = this._handleVisibilityChange.bind(this);
        document.addEventListener('visibilitychange', this._boundVisibilityHandler);
        this._visibilityHandlerAdded = true;
      }
      
      this.initialized = true;
      
      if (this.errors.length > 0) {
        Logger.WARN('Application initialized with errors:', this.errors);
      }
      
      if (window.Services && window.Services.eventBus) {
        window.Services.eventBus.emit('app:ready');
      }
    } catch (error) {
      this._showError(error);
    }
  }

  _handlePopState() {
    if (typeof initDynamicSEO === 'function') {
      initDynamicSEO();
    }
  }

  _resolveOnComponentsLoaded(resolve) {
    const onComponentsLoaded = function() {
      document.removeEventListener('components:loaded', onComponentsLoaded);
      resolve();
    };
    document.addEventListener('components:loaded', onComponentsLoaded);
    
    if (typeof ComponentLoader !== 'undefined') {
      const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'index';
      ComponentLoader.init({
        loadNavbar: true,
        loadFooter: true,
        loadModal: true,
        activePage: currentPage === 'index' ? '' : currentPage
      });
    } else {
      resolve();
    }
  }

  async _initAllModules() {
    for (let i = 0; i < this.modules.length; i++) {
      const module = this.modules[i];
      try {
        if (module && typeof module.init === 'function') {
          await module.init();
        }
      } catch (err) {
        const moduleName = (module.constructor && module.constructor.name) || 'unknown';
        this.errors.push('Module ' + moduleName + ' init failed: ' + err.message);
      }
    }
  }

  _initFormManagers() {
    const proposalForm = document.getElementById('proposalForm');
    if (proposalForm) {
      if (typeof FormManager !== 'undefined' && window.Services && window.Services.apiClient) {
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
    if (typeof modalManager === 'undefined' || this._modalsRegistered) return;
    
    const modalsToRegister = [
      { key: 'about', overlayId: 'aboutModalOverlay', required: false },
      { key: 'details', overlayId: 'detailsModalOverlay', required: false },
      { key: 'news', overlayId: 'newsModalOverlay', required: false },
      { key: 'proposal', overlayId: 'proposalModalOverlay', required: false, focusSelector: '#companyName', onClose: this._handleProposalClose.bind(this) },
      { key: 'universal', overlayId: 'universalApplicationModalOverlay', required: false, focusSelector: 'input[type="text"], input[type="email"], textarea', onClose: this._handleUniversalClose.bind(this) },
      { key: 'project', overlayId: 'projectModalOverlay', required: false },
      { key: 'service', overlayId: 'serviceModalOverlay', required: false },
      { key: 'policy', overlayId: 'policyModalOverlay', required: false },
      { key: 'success', overlayId: 'successModalOverlay', required: false },
      { key: 'feedback', overlayId: 'feedbackModalOverlay', required: false, onClose: this._handleFeedbackClose.bind(this) },
      { key: 'category', overlayId: 'categoryNewsModalOverlay', required: false },
      { key: 'project-category', overlayId: 'projectCategoryModalOverlay', required: false }
    ];
    
    for (let i = 0; i < modalsToRegister.length; i++) {
      this._processModalRegistration(modalsToRegister[i]);
    }
    this._modalsRegistered = true;
  }

  _processModalRegistration(config) {
    const key = config.key;
    const overlayId = config.overlayId;
    const required = config.required;
    const onClose = config.onClose;
    const onOpen = config.onOpen;
    const focusSelector = config.focusSelector;
    
    const overlay = document.getElementById(overlayId);
    if (overlay) {
      modalManager.register(key, { overlayId: overlayId, onClose: onClose, onOpen: onOpen, focusSelector: focusSelector });
    } else if (required) {
      Logger.WARN('Required modal "' + key + '" not found');
    }
  }

  _handleProposalClose() {
    if (window.formManager) {
      window.formManager.resetForm();
    } else {
      Logger.WARN('formManager not available on proposal close');
    }
  }

  _handleUniversalClose() {
    if (typeof UniversalApplicationModalManager !== 'undefined') {
      UniversalApplicationModalManager.resetForm();
    } else {
      Logger.WARN('UniversalApplicationModalManager not available on universal close');
    }
  }

  _handleFeedbackClose() {
    if (window.feedbackFormManager) {
      window.feedbackFormManager.resetForm();
    }
  }

  _initGlobalHelpers() {
    window.scrollToTop = this._globalScrollToTop.bind(this);
    window.toggleMobileMenu = this._globalToggleMobileMenu.bind(this);
    window.closeMobileMenu = this._globalCloseMobileMenu.bind(this);
    window.removeFile = this._globalRemoveFile.bind(this);
    window.toggleWidget = this._globalToggleWidget.bind(this);
    
    this._boundCookieClickHandler = this._handleCookieSettingsClick.bind(this);
    document.addEventListener('click', this._boundCookieClickHandler);
  }

  _globalScrollToTop() {
    if (typeof navigationManager !== 'undefined') {
      navigationManager.scrollToTop();
    }
  }

  _globalToggleMobileMenu() {
    if (typeof navigationManager !== 'undefined') {
      navigationManager.toggleMobileMenu();
    }
  }

  _globalCloseMobileMenu() {
    if (typeof navigationManager !== 'undefined') {
      navigationManager.closeMobileMenu();
    }
  }

  _globalRemoveFile(event, index) {
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
  }

  _globalToggleWidget(header) {
    const widget = header.closest('.certificate-widget');
    if (widget) {
      widget.classList.toggle('active');
    }
  }

  _handleCookieSettingsClick(e) {
    const link = e.target.closest('#cookie-settings-link');
    if (!link) return;
    
    e.preventDefault();
    const storage = window.Services && window.Services.storage;
    if (storage && typeof ConsentManager.withdrawConsent === 'function') {
      ConsentManager.withdrawConsent(storage);
    }
    
    setTimeout(this._switchMapToStatic.bind(this), 150);
  }

  _switchMapToStatic() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    
    const staticUrl = window.CONFIG && window.CONFIG.MAP && window.CONFIG.MAP.STATIC_URL;
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
  }

  _hidePageLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      document.body.classList.add('app-ready');
      setTimeout(this._finishHideLoader.bind(this), 100);
    }
  }

  _finishHideLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(this._completelyHideLoader.bind(this), 300);
    }
  }

  _completelyHideLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
      loader.style.display = 'none';
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
    
    const isHomePage = currentPath === '/' || currentPath.endsWith('index.html') || currentPath === '';
    if (!isHomePage) {
      floatingBtn.remove();
      return;
    }
    
    const heroSection = document.querySelector('.hero');
    if (heroSection) {
      this._boundHeroObserver = this._handleHeroIntersection.bind(this);
      this._heroObserverInstance = new IntersectionObserver(this._boundHeroObserver, { threshold: [0, 0.5, 1] });
      this._heroObserverInstance.observe(heroSection);
    } else {
      const SCROLL_THRESHOLD = 150;
      this._boundFloatingScrollHandler = this._handleFloatingScroll.bind(this, SCROLL_THRESHOLD, floatingBtn);
      window.addEventListener('scroll', this._boundFloatingScrollHandler);
      this._boundFloatingScrollHandler();
    }
  }

  _handleHeroIntersection(entries) {
    const floatingBtn = document.querySelector('.floating-cta-btn');
    if (!floatingBtn) return;
    
    for (let i = 0; i < entries.length; i++) {
      this._processHeroEntry(floatingBtn, entries[i]);
    }
  }

  _processHeroEntry(btn, entry) {
    if (entry.intersectionRatio < 0.5) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }

  _handleFloatingScroll(threshold, btn) {
    if (window.scrollY > threshold) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }

  _initImageLazyLoading() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      this._boundImageObserver = this._handleImageIntersection.bind(this);
      this._imageObserverInstance = new IntersectionObserver(this._boundImageObserver, { rootMargin: '100px' });
      for (let i = 0; i < lazyImages.length; i++) {
        this._observeImage(lazyImages[i]);
      }
    } else {
      for (let i = 0; i < lazyImages.length; i++) {
        this._loadImageImmediately(lazyImages[i]);
      }
    }
  }

  _observeImage(img) {
    this._imageObserverInstance.observe(img);
  }

  _handleImageIntersection(entries) {
    for (let i = 0; i < entries.length; i++) {
      this._processImageEntry(entries[i]);
    }
  }

  _processImageEntry(entry) {
    if (entry.isIntersecting) {
      const img = entry.target;
      const src = img.getAttribute('data-src');
      if (src) {
        img.src = src;
        img.removeAttribute('data-src');
        img.classList.add('loaded');
      }
      this._imageObserverInstance.unobserve(img);
    }
  }

  _loadImageImmediately(img) {
    const src = img.getAttribute('data-src');
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
  }

  _initPrefersReducedMotion() {
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    if (this._prefersReducedMotion.matches) {
      document.body.classList.add('reduced-motion');
    }
    
    this._boundMotionChangeHandler = this._handleMotionChange.bind(this);
    this._prefersReducedMotion.addEventListener('change', this._boundMotionChangeHandler);
  }

  _handleMotionChange(e) {
    if (e.matches) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }

  _handleHashScroll() {
    const hash = window.location.hash;
    if (!hash || hash === '#') return;
    
    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);
    if (!targetElement) return;
    
    this._boundComponentsLoadedScrollHandler = this._scrollToTarget.bind(this, targetElement);
    document.addEventListener('components:loaded', this._boundComponentsLoadedScrollHandler, { once: true });
    this._boundHashScrollTimeout = setTimeout(this._boundComponentsLoadedScrollHandler, 800);
  }

  _scrollToTarget(targetElement) {
    const delay = (window.CONFIG && window.CONFIG.PERFORMANCE && window.CONFIG.PERFORMANCE.HASH_SCROLL_DELAY_MS) || 400;
    setTimeout(this._performScrollToTarget.bind(this, targetElement), delay);
  }

  _performScrollToTarget(targetElement) {
    const navbar = document.querySelector('.navbar');
    const headerHeight = navbar ? navbar.offsetHeight : 70;
    const offset = headerHeight + 5;
    const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
  }

  _initScrollProgressBar() {
    if (this.scrollProgressElements) return;
    
    const container = document.createElement('div');
    container.className = 'scroll-progress-container';
    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    container.appendChild(bar);
    document.body.appendChild(container);
    
    this.scrollProgressElements = { container: container, bar: bar };
    
    this._boundProgressHandler = this._updateScrollProgress.bind(this, bar);
    this._boundResizeHandler = this._updateScrollProgress.bind(this, bar);
    
    window.addEventListener('scroll', this._boundProgressHandler);
    window.addEventListener('resize', this._boundResizeHandler);
    this._updateScrollProgress(bar);
  }

  _updateScrollProgress(bar) {
    const winScroll = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const scrolled = (winScroll / height) * 100;
    requestAnimationFrame(this._applyScrollProgress.bind(this, bar, scrolled));
  }

  _applyScrollProgress(bar, scrolled) {
    bar.style.setProperty('--progress', scrolled + '%');
  }

  _destroyScrollProgressBar() {
    if (this.scrollProgressElements) {
      const container = this.scrollProgressElements.container;
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

  _initMapLoader() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    
    const staticUrl = window.CONFIG && window.CONFIG.MAP && window.CONFIG.MAP.STATIC_URL;
    const mapPageUrl = window.CONFIG && window.CONFIG.MAP && window.CONFIG.MAP.MAP_PAGE_URL;
    
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
    
    img.addEventListener('click', this._handleMapClick.bind(this, mapPageUrl));
    container.appendChild(img);
    Logger.INFO('Статическая карта загружена');
  }

  _handleMapClick(url) {
    window.open(url, '_blank');
  }

  _handleVisibilityChange() {
    if (!document.hidden && window.newsManager) {
      const activeTab = document.querySelector('.news-tab.active');
      if (activeTab) {
        const year = activeTab.dataset.year || activeTab.dataset.tab;
        if (year) {
          const container = document.getElementById('newsGrid-' + year);
          if (container && window.newsRenderer) {
            window.newsRenderer.render(year, container);
          }
        }
      }
    }
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
      reloadBtn.addEventListener('click', this._handleReloadClick.bind(this));
      errorDiv.appendChild(reloadBtn);
      
      errorContainer.appendChild(errorDiv);
    } else {
      alert('Ошибка загрузки приложения: ' + Utils.Sanitizer.escapeHtml(error.message));
    }
  }

  _handleReloadClick() {
    window.location.reload();
  }

  destroy() {
    if (this._boundPopstateHandler) window.removeEventListener('popstate', this._boundPopstateHandler);
    if (this._boundVisibilityHandler) document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    if (this._boundCookieClickHandler) document.removeEventListener('click', this._boundCookieClickHandler);
    if (this._boundMotionChangeHandler && this._prefersReducedMotion) this._prefersReducedMotion.removeEventListener('change', this._boundMotionChangeHandler);
    if (this._boundComponentsLoadedScrollHandler) document.removeEventListener('components:loaded', this._boundComponentsLoadedScrollHandler);
    if (this._boundHashScrollTimeout) clearTimeout(this._boundHashScrollTimeout);
    
    if (this._heroObserverInstance) this._heroObserverInstance.disconnect();
    if (this._imageObserverInstance) this._imageObserverInstance.disconnect();
    if (this._boundFloatingScrollHandler) window.removeEventListener('scroll', this._boundFloatingScrollHandler);
    
    this._destroyScrollProgressBar();
    
    const servicesToDestroy = [
      'navigationManager', 'animationManager', 'modalManager', 
      'newsManager', 'newsRenderer', 'formManager', 'consentManager', 'feedbackFormManager'
    ];
    
    for (let i = 0; i < servicesToDestroy.length; i++) {
      this._destroyService(servicesToDestroy[i]);
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

  _destroyService(serviceName) {
    const service = this.services[serviceName];
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  }

  _cleanupGlobals() {
    const globalFunctions = [
      'scrollToTop', 'toggleMobileMenu', 'closeModal', 'removeFile', 'closeMobileMenu',
      'closeAboutModal', 'closeDetailsModal', 'closeNewsModal', 'closePolicyModal',
      'toggleWidget', 'openDetailsModal', 'openProjectModal', 'initProjectGallery',
      'openApplicationModal', 'closeUniversalApplicationModal'
    ];
    
    for (let i = 0; i < globalFunctions.length; i++) {
      this._cleanupGlobalFunction(globalFunctions[i]);
    }
  }

  _cleanupGlobalFunction(fnName) {
    if (typeof window[fnName] === 'function') {
      delete window[fnName];
    }
  }
}

window.Application = Application;

function initApp() {
  const hasConfig = typeof window.CONFIG !== 'undefined';
  const hasServices = typeof window.Services !== 'undefined';
  const hasUtils = typeof window.Utils !== 'undefined';
  
  if (!hasConfig || !hasServices || !hasUtils) {
    setTimeout(retryInitialization, (window.CONFIG && window.CONFIG.PERFORMANCE && window.CONFIG.PERFORMANCE.INIT_APP_DELAY_MS) || 100);
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

function retryInitialization() {
  initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}