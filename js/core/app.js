/**
 * Главный файл инициализации приложения
 * ООО "ВД Инжиниринг"
 */

class Application {
  constructor() {
    this.initialized = false;
    this.modules = [];
    this.errors = [];
    this.services = {};
    this.themeManager = null;

    this._boundProgressHandler = null;
    this._boundResizeHandler = null;
    this._boundPopstateHandler = null;
    this._boundHeroObserver = null;
    this._boundFloatingScrollHandler = null;
    this._boundMotionChangeHandler = null;
    this._boundComponentsLoadedScrollHandler = null;
    this._boundHashScrollTimeout = null;

    // [FIX] Ссылки на обработчики формы отчёта об ошибках.
    this._boundErrorReportHandler = null;
    this._boundErrorReportCancelHandler = null;

    this.scrollProgressElements = null;
    this._heroObserverInstance = null;
    this._prefersReducedMotion = null;
    this._modalsRegistered = false;
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

      const currentPage = window.location.pathname.replace(/^\/|\/$/g, '').split('/')[0] || 'index';

      const componentsLoadedPromise = new Promise(this._resolveOnComponentsLoaded.bind(this));
      await componentsLoadedPromise;

      const currentPath = window.location.pathname;
      if ((currentPath.startsWith('/projects') || currentPath.startsWith('/project-category')) && typeof initProjectsPage === 'function') {
        initProjectsPage();
      }

      this._hidePageLoader();
      this._initGlobalHelpers();
      this._registerModules();
      this._registerModals();
      this._initThemeManager();

      await this._initAllModules();

      this._handleDirectUrlAfterLoad();
      this._initFormManagers();

      document.addEventListener('components:loaded', () => {
        const pageInitMap = { projects: 'initProjectsPage', services: 'initServicesPage', vacancies: 'initVacanciesPage' };
        if (pageInitMap[currentPage]) {
          const initFn = window[pageInitMap[currentPage]];
          if (typeof initFn === 'function') {
            requestAnimationFrame(() => {
              initFn();
              if (currentPage === 'vacancies') window._vacanciesPageInitialized = true;
            });
          }
        }
      });

      if (document.querySelector('.navbar')) {
        const pageInitMap = { projects: 'initProjectsPage', services: 'initServicesPage', vacancies: 'initVacanciesPage' };
        if (pageInitMap[currentPage]) {
          const initFn = window[pageInitMap[currentPage]];
          if (typeof initFn === 'function') {
            requestAnimationFrame(() => {
              initFn();
              if (currentPage === 'vacancies') window._vacanciesPageInitialized = true;
            });
          }
        }
      }

      this._initFloatingCTA();
      this._initPrefersReducedMotion();
      this._handleHashScroll();
      this._initScrollProgressBar();
      this._initMapLoader();

      if (typeof SearchManager !== 'undefined') {
        const searchManager = new SearchManager();
        searchManager.init();
        this.services.searchManager = searchManager;
      }

      const params = new URLSearchParams(window.location.search);
      const highlightQuery = params.get('highlight');
      if (highlightQuery && typeof HighlightUtils !== 'undefined') {
        this._applyHighlightWithRetry(highlightQuery);
      }

      if (typeof modalManager !== 'undefined' && typeof HighlightUtils !== 'undefined') {
        const highlightHandler = (event) => {
          const overlay = event.overlay;
          const q = new URLSearchParams(window.location.search).get('highlight');
          if (q && overlay) {
            setTimeout(() => {
              HighlightUtils.highlight(q, overlay);
              const firstMark = overlay.querySelector('mark.search-highlight');
              if (firstMark) {
                const modalBody = overlay.querySelector('.modal-body');
                if (modalBody) {
                  const rect = firstMark.getBoundingClientRect();
                  const containerRect = modalBody.getBoundingClientRect();
                  modalBody.scrollTop = (rect.top - containerRect.top) + modalBody.scrollTop - 20;
                } else {
                  firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }, 250);
          }
        };
        this._highlightModalHandler = highlightHandler;
        window.Services?.eventBus?.on('modal:opened', highlightHandler);
      }

      if (currentPath === '/search' || currentPath === '/search.html') {
        const footerSearch = document.querySelector('.footer-search');
        if (footerSearch) footerSearch.style.display = 'none';
      }

      if (typeof textSelectionReporter !== 'undefined') {
        textSelectionReporter.init();
      }

      this.initialized = true;

      if (this.errors.length > 0) {
        Logger.WARN('Application initialized with errors:', this.errors);
      }

      if (window.Services && window.Services.eventBus) {
        window.Services.eventBus.emit('app:ready');
      }
    } catch (error) {
      this._hidePageLoader();
      this._showError(error);
    }
  }

  _applyHighlightWithRetry(query, retryCount = 0) {
    HighlightUtils.highlight(query);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const allMarks = document.querySelectorAll('mark.search-highlight');
        let targetMark = null;
        for (const mark of allMarks) {
          const rect = mark.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) { targetMark = mark; break; }
        }
        if (!targetMark) return;

        const rect = targetMark.getBoundingClientRect();
        const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (isInViewport) return;

        const navbar = document.querySelector('.navbar');
        const navbarHeight = navbar ? navbar.offsetHeight : 70;
        const topOffset = navbarHeight + 20;
        const bottomOffset = 30;
        const distanceFromBottom = document.documentElement.scrollHeight - rect.bottom;
        let finalPosition;

        if (distanceFromBottom < window.innerHeight / 2) {
          finalPosition = rect.top + window.scrollY - (window.innerHeight - rect.height - bottomOffset);
        } else {
          finalPosition = rect.top + window.scrollY - (window.innerHeight / 2) + (rect.height / 2);
          finalPosition = Math.max(finalPosition, rect.top + window.scrollY - topOffset);
        }

        window.scrollTo({ top: Math.max(0, finalPosition), behavior: 'smooth' });

        if (retryCount < 3) {
          setTimeout(() => {
            const newRect = targetMark.getBoundingClientRect();
            if (!(newRect.top >= 0 && newRect.bottom <= window.innerHeight)) {
              window.scrollTo({ top: Math.max(0, finalPosition + 50), behavior: 'auto' });
              setTimeout(() => {
                const finalRect = targetMark.getBoundingClientRect();
                if (!(finalRect.top >= 0 && finalRect.bottom <= window.innerHeight)) {
                  targetMark.scrollIntoView({ block: 'center', behavior: 'auto' });
                }
              }, 200);
            }
          }, 300);
        }
      });
    });
  }

  _initThemeManager() {
    if (typeof ThemeManager === 'undefined') {
      Logger.WARN('ThemeManager not available');
      return;
    }
    this.themeManager = new ThemeManager();
    this.themeManager.init();
    this.services.themeManager = this.themeManager;
  }

  _handleDirectUrlAfterLoad() {
    const path = window.location.pathname;

    const vacancyMatch = path.match(/^\/vacancy\/(.+)/);
    if (vacancyMatch) {
      const vacancyId = vacancyMatch[1];
      if (typeof modalManager !== 'undefined' && vacancyId) {
        if (typeof initVacanciesPage === 'function' && !window._vacanciesPageInitialized) {
          initVacanciesPage();
          window._vacanciesPageInitialized = true;
        }
        const vacancy = window.VACANCIES_DATA?.find(v => String(v.id) === String(vacancyId));
        if (vacancy) {
          if (typeof window.fillVacancyModalById === 'function') {
            window.fillVacancyModalById(vacancyId);
          } else {
            const titleEl = document.getElementById('vacancyModalTitle');
            const deptEl = document.getElementById('vacancyModalDepartment');
            const bodyEl = document.getElementById('vacancyModalBody');
            if (titleEl) titleEl.textContent = vacancy.title;
            if (deptEl) deptEl.textContent = vacancy.department;
            if (bodyEl) {
              const content = document.createElement('div');
              content.className = 'vacancy-details';
              if (vacancy.responsibilities?.length) {
                const respDiv = document.createElement('div');
                const items = vacancy.responsibilities.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
                respDiv.innerHTML = `<h4>Обязанности:</h4><ul>${items}</ul>`;
                content.appendChild(respDiv);
              }
              if (vacancy.requirements?.length) {
                const reqDiv = document.createElement('div');
                const items = vacancy.requirements.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
                reqDiv.innerHTML = `<h4>Требования:</h4><ul>${items}</ul>`;
                content.appendChild(reqDiv);
              }
              if (vacancy.conditions?.length) {
                const condDiv = document.createElement('div');
                const items = vacancy.conditions.map(c => `<li>${Utils.Sanitizer.escapeHtml(c)}</li>`).join('');
                condDiv.innerHTML = `<h4>Условия:</h4><ul>${items}</ul>`;
                content.appendChild(condDiv);
              }
              bodyEl.replaceChildren(content);
            }
          }
          modalManager.open('vacancy', { id: vacancyId, skipUrlUpdate: true, direct: true });
        } else {
          Logger.WARN(`Вакансия с id ${vacancyId} не найдена`);
        }
      }
      return;
    }

    const newsMatch = path.match(/^\/news\/(\d+)/);
    if (newsMatch && typeof modalManager !== 'undefined' && typeof modalManager.openNewsById === 'function') {
      modalManager.openNewsById(newsMatch[1]);
      return;
    }

    const projectMatch = path.match(/^\/projects\/(.+)/);
    if (projectMatch && typeof modalManager !== 'undefined' && typeof modalManager.openProjectById === 'function') {
      if (typeof initProjectsPage === 'function' && !window._projectsPageInitialized) initProjectsPage();
      modalManager.openProjectById(projectMatch[1]);
      return;
    }

    const categoryMatch = path.match(/^\/category\/(.+)/);
    if (categoryMatch && typeof modalManager?.openCategoryByName === 'function') {
      modalManager.openCategoryByName(decodeURIComponent(categoryMatch[1]));
      return;
    }

    const projectCategoryMatch = path.match(/^\/project-category\/(.+)/);
    if (projectCategoryMatch && typeof modalManager?.openProjectCategoryByName === 'function') {
      modalManager.openProjectCategoryByName(decodeURIComponent(projectCategoryMatch[1]));
      return;
    }

    if (path === '/feedback' && typeof modalManager !== 'undefined') {
      modalManager.open('feedback', { skipUrlUpdate: true, direct: true });
      return;
    }

    if (path === '/proposal' && typeof modalManager !== 'undefined') {
      modalManager.open('proposal', { skipUrlUpdate: true, direct: true });
      return;
    }

    const policyMatch = path.match(/^\/policy\/(.+)/);
    if (policyMatch && typeof PolicyModalManager !== 'undefined') {
      PolicyModalManager.openPolicyModal(policyMatch[1]);
      window.history.pushState({ modal: 'policy', key: policyMatch[1] }, '', path);
    }
  }

  _handlePopState() {
    const state = window.history.state;
    if (state && state.modal === 'policy' && state.key && typeof PolicyModalManager !== 'undefined') {
      PolicyModalManager.openPolicyModal(state.key);
      return;
    }
    if (typeof initDynamicSEO === 'function') initDynamicSEO();
  }

  _resolveOnComponentsLoaded(resolve) {
    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('components:loaded', onComponentsLoaded);
      resolve();
    };
    const onComponentsLoaded = () => done();

    document.addEventListener('components:loaded', onComponentsLoaded);
    setTimeout(done, 3000);

    if (typeof ComponentLoader !== 'undefined') {
      try {
        const currentPage = window.location.pathname.replace(/^\/|\/$/g, '').split('/')[0] || 'index';
        ComponentLoader.init({
          loadNavbar: true,
          loadFooter: true,
          loadModal: true,
          activePage: currentPage === 'index' ? '' : currentPage
        });
      } catch (err) {
        Logger.ERROR('ComponentLoader.init() threw:', err);
        done();
      }
    } else {
      done();
    }
  }

  async _initAllModules() {
    for (const module of this.modules) {
      try {
        if (module && typeof module.init === 'function') await module.init();
      } catch (err) {
        const name = module.constructor?.name || 'unknown';
        this.errors.push('Module ' + name + ' init failed: ' + err.message);
      }
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
    }

    if (typeof UniversalApplicationModalManager !== 'undefined') {
      UniversalApplicationModalManager.init();
      this.services.universalModalManager = UniversalApplicationModalManager;
    }

    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
      const rateLimiter = new Utils.RateLimiter(window.Services.storage);
      window.feedbackFormManager = new ModalFormHandler({
        formId: 'feedbackForm',
        successSelector: '#feedbackSuccessMessage',
        fileDropSelector: '.form-file',
        apiClient: window.Services.apiClient,
        rateLimiter,
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

    const errorForm = document.getElementById('errorReportForm');
    if (errorForm) {
      // [FIX] Обработчики сохраняются в this._bound... и снимаются в destroy().
      this._boundErrorReportHandler = async (e) => {
        e.preventDefault();

        const text = document.getElementById('errorReportText').value.trim();
        if (!text) { alert('Нет текста для отправки.'); return; }

        const comment = document.getElementById('errorReportComment').value.trim();
        if (comment.length > 1000) { alert('Комментарий не может превышать 1000 символов.'); return; }

        const submitBtn = document.getElementById('errorReportSubmitBtn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
          const csrfToken = await FormUtils.fetchCsrfToken();
          if (!csrfToken) {
            alert('❌ Ошибка безопасности. Обновите страницу и попробуйте снова.');
            return;
          }

          const response = await fetch('/api/report-error.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
              type: 'error_report',
              selectedText: text,
              comment,
              url: window.location.href,
              userAgent: navigator.userAgent
            })
          });

          const result = await response.json();

          if (result.success) {
            alert('✅ Спасибо! Сообщение об ошибке отправлено.');
            if (window.textSelectionReporter) window.textSelectionReporter._recordRateLimit();
            if (typeof modalManager !== 'undefined') modalManager.close('error-report');
          } else {
            throw new Error(result.error || 'Ошибка отправки');
          }
        } catch (err) {
          alert('❌ Не удалось отправить: ' + err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      };
      errorForm.addEventListener('submit', this._boundErrorReportHandler);

      const cancelBtn = document.getElementById('errorReportCancelBtn');
      if (cancelBtn) {
        this._boundErrorReportCancelHandler = () => {
          if (typeof modalManager !== 'undefined') modalManager.close('error-report');
        };
        cancelBtn.addEventListener('click', this._boundErrorReportCancelHandler);
      }
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
    if (typeof newsRenderer !== 'undefined') this.services.newsRenderer = newsRenderer;
    if (typeof modalManager !== 'undefined') this.services.modalManager = modalManager;
    this.modules = modulesToRegister;
  }

  _registerModals() {
    if (typeof modalManager === 'undefined' || this._modalsRegistered) return;
    const modalsToRegister = [
      { key: 'news', overlayId: 'newsModalOverlay' },
      { key: 'proposal', overlayId: 'proposalModalOverlay', focusSelector: '#companyName', onClose: this._handleProposalClose.bind(this) },
      { key: 'universal', overlayId: 'universalApplicationModalOverlay', focusSelector: 'input[type="text"], input[type="email"], textarea', onClose: this._handleUniversalClose.bind(this) },
      { key: 'project', overlayId: 'projectModalOverlay' },
      { key: 'service', overlayId: 'serviceModalOverlay' },
      { key: 'policy', overlayId: 'policyModalOverlay' },
      { key: 'success', overlayId: 'successModalOverlay' },
      { key: 'feedback', overlayId: 'feedbackModalOverlay', onClose: this._handleFeedbackClose.bind(this) },
      { key: 'category', overlayId: 'categoryNewsModalOverlay' },
      { key: 'project-category', overlayId: 'projectCategoryModalOverlay' },
      { key: 'error-report', overlayId: 'errorReportModalOverlay', onClose: this._handleErrorReportClose.bind(this) },
      { key: 'vacancy', overlayId: 'vacancyModalOverlay' }
    ];
    for (const cfg of modalsToRegister) this._processModalRegistration(cfg);
    this._modalsRegistered = true;
  }

  _processModalRegistration(config) {
    const overlay = document.getElementById(config.overlayId);
    if (overlay) {
      modalManager.register(config.key, {
        overlayId: config.overlayId,
        onClose: config.onClose,
        onOpen: config.onOpen,
        focusSelector: config.focusSelector
      });
    }
  }

  _handleProposalClose() {
    if (window.formManager) window.formManager.resetForm();
    else Logger.WARN('formManager not available on proposal close');
  }

  _handleUniversalClose() {
    if (typeof UniversalApplicationModalManager !== 'undefined') UniversalApplicationModalManager.resetForm();
  }

  _handleFeedbackClose() {
    if (window.feedbackFormManager) window.feedbackFormManager.resetForm();
  }

  _handleErrorReportClose() {
    const form = document.getElementById('errorReportForm');
    if (form) form.reset();
    const warning = document.getElementById('errorReportRateLimitWarning');
    if (warning) warning.classList.remove('show');
  }

  _initGlobalHelpers() {
    window.scrollToTop = this._globalScrollToTop.bind(this);
    window.toggleMobileMenu = this._globalToggleMobileMenu.bind(this);
    window.closeMobileMenu = this._globalCloseMobileMenu.bind(this);
    window.removeFile = this._globalRemoveFile.bind(this);
  }

  _globalScrollToTop() { if (typeof navigationManager !== 'undefined') navigationManager.scrollToTop(); }
  _globalToggleMobileMenu() { if (typeof navigationManager !== 'undefined') navigationManager.toggleMobileMenu(); }
  _globalCloseMobileMenu() { if (typeof navigationManager !== 'undefined') navigationManager.closeMobileMenu(); }

  _globalRemoveFile(event, index) {
    if (event) { event.stopPropagation(); event.preventDefault(); }
    if (window.formManager?.removeFile) window.formManager.removeFile(index);
    else if (typeof UniversalApplicationModalManager !== 'undefined' && UniversalApplicationModalManager.removeFile) UniversalApplicationModalManager.removeFile(index);
    else if (window.feedbackFormManager?.removeFile) window.feedbackFormManager.removeFile(index);
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
    if (loader) loader.style.display = 'none';
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
    if (!isHomePage) { floatingBtn.remove(); return; }

    const heroSection = document.querySelector('.hero');
    if (heroSection) {
      this._boundHeroObserver = this._handleHeroIntersection.bind(this);
      this._heroObserverInstance = new IntersectionObserver(this._boundHeroObserver, { threshold: [0, 0.5, 1] });
      this._heroObserverInstance.observe(heroSection);
    } else {
      this._boundFloatingScrollHandler = this._handleFloatingScroll.bind(this, 150, floatingBtn);
      window.addEventListener('scroll', this._boundFloatingScrollHandler);
      this._boundFloatingScrollHandler();
    }
  }

  _handleHeroIntersection(entries) {
    const floatingBtn = document.querySelector('.floating-cta-btn');
    if (!floatingBtn) return;
    for (const entry of entries) {
      if (entry.intersectionRatio < 0.5) floatingBtn.classList.add('visible');
      else floatingBtn.classList.remove('visible');
    }
  }

  _handleFloatingScroll(threshold, btn) {
    if (window.scrollY > threshold) btn.classList.add('visible');
    else btn.classList.remove('visible');
  }

  _initPrefersReducedMotion() {
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (this._prefersReducedMotion.matches) document.body.classList.add('reduced-motion');
    this._boundMotionChangeHandler = this._handleMotionChange.bind(this);
    this._prefersReducedMotion.addEventListener('change', this._boundMotionChangeHandler);
  }

  _handleMotionChange(e) {
    if (e.matches) document.body.classList.add('reduced-motion');
    else document.body.classList.remove('reduced-motion');
  }

  _handleHashScroll() {
    const hash = window.location.hash;
    if (!hash || hash === '#') return;
    const targetElement = document.getElementById(hash.substring(1));
    if (!targetElement) return;
    this._boundComponentsLoadedScrollHandler = this._scrollToTarget.bind(this, targetElement);
    document.addEventListener('components:loaded', this._boundComponentsLoadedScrollHandler, { once: true });
    this._boundHashScrollTimeout = setTimeout(this._boundComponentsLoadedScrollHandler, 800);
  }

  _scrollToTarget(targetElement) {
    const delay = window.CONFIG?.PERFORMANCE?.HASH_SCROLL_DELAY_MS || 400;
    setTimeout(this._performScrollToTarget.bind(this, targetElement), delay);
  }

  _performScrollToTarget(targetElement) {
    const navbar = document.querySelector('.navbar');
    const headerHeight = navbar ? navbar.offsetHeight : 70;
    const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: elementPosition - (headerHeight + 5), behavior: 'smooth' });
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
      if (container?.parentNode) container.parentNode.removeChild(container);
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
    // [FIX] Поддерживает как #mapContainer (обратная совместимость), так и
    // [data-map-container] — для случаев, когда таких контейнеров несколько.
    const containers = document.querySelectorAll('#mapContainer, [data-map-container]');
    if (containers.length === 0) return;
    const staticUrl = window.CONFIG?.MAP?.STATIC_URL;
    const mapPageUrl = window.CONFIG?.MAP?.MAP_PAGE_URL;
    if (!staticUrl || !mapPageUrl) { Logger.WARN('Map static URL or page URL not configured'); return; }
    containers.forEach(container => {
      container.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'static-map';
      img.src = staticUrl;
      img.alt = 'Карта проезда к офису';
      img.loading = 'lazy';
      img.addEventListener('click', this._handleMapClick.bind(this, mapPageUrl));
      container.appendChild(img);
    });
    Logger.INFO('Статическая карта загружена');
  }

  _handleMapClick(url) { window.open(url, '_blank'); }

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

  _handleReloadClick() { window.location.reload(); }

  destroy() {
    if (this._boundPopstateHandler) window.removeEventListener('popstate', this._boundPopstateHandler);
    if (this._boundMotionChangeHandler && this._prefersReducedMotion) this._prefersReducedMotion.removeEventListener('change', this._boundMotionChangeHandler);
    if (this._boundComponentsLoadedScrollHandler) document.removeEventListener('components:loaded', this._boundComponentsLoadedScrollHandler);
    if (this._boundHashScrollTimeout) clearTimeout(this._boundHashScrollTimeout);
    if (this._heroObserverInstance) this._heroObserverInstance.disconnect();
    if (this._boundFloatingScrollHandler) window.removeEventListener('scroll', this._boundFloatingScrollHandler);
    this._destroyScrollProgressBar();

    // [FIX] Снимаем обработчики формы отчёта об ошибках.
    if (this._boundErrorReportHandler) {
      const errorForm = document.getElementById('errorReportForm');
      if (errorForm) errorForm.removeEventListener('submit', this._boundErrorReportHandler);
      this._boundErrorReportHandler = null;
    }
    if (this._boundErrorReportCancelHandler) {
      const cancelBtn = document.getElementById('errorReportCancelBtn');
      if (cancelBtn) cancelBtn.removeEventListener('click', this._boundErrorReportCancelHandler);
      this._boundErrorReportCancelHandler = null;
    }

    const servicesToDestroy = ['navigationManager', 'animationManager', 'modalManager', 'newsManager', 'newsRenderer', 'formManager', 'consentManager', 'feedbackFormManager', 'themeManager'];
    for (const name of servicesToDestroy) this._destroyService(name);

    if (typeof UniversalApplicationModalManager !== 'undefined' && UniversalApplicationModalManager.destroy) UniversalApplicationModalManager.destroy();
    if (typeof textSelectionReporter !== 'undefined' && textSelectionReporter.destroy) textSelectionReporter.destroy();

    this._cleanupGlobals();
    this.modules = []; this.errors = []; this.services = {};
    this.initialized = false; this.themeManager = null;
  }

  _destroyService(name) {
    const service = this.services[name];
    if (service && typeof service.destroy === 'function') service.destroy();
  }

  _cleanupGlobals() {
    const fns = ['scrollToTop', 'toggleMobileMenu', 'closeModal', 'removeFile', 'closeMobileMenu', 'closeAboutModal', 'closeDetailsModal', 'closeNewsModal', 'closePolicyModal', 'openDetailsModal', 'openProjectModal', 'initProjectGallery', 'openApplicationModal', 'closeUniversalApplicationModal'];
    for (const name of fns) {
      if (typeof window[name] === 'function') delete window[name];
    }
  }
}

window.Application = Application;

function initApp() {
  const hasConfig = typeof window.CONFIG !== 'undefined';
  const hasServices = typeof window.Services !== 'undefined';
  const hasUtils = typeof window.Utils !== 'undefined';
  if (!hasConfig || !hasServices || !hasUtils) {
    setTimeout(retryInitialization, window.CONFIG?.PERFORMANCE?.INIT_APP_DELAY_MS || 100);
    return;
  }

  if (typeof NEWS_DATA !== 'undefined') {
    try {
      if (typeof NewsRenderer !== 'undefined' && typeof NewsManager !== 'undefined') {
        window.newsRenderer = new NewsRenderer(NEWS_DATA);
        window.newsManager = new NewsManager(NEWS_DATA, window.newsRenderer);
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

function retryInitialization() { initApp(); }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}