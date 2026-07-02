/**
 * Управление модальными окнами – единая точка входа
 * ООО "Волга-Днепр Инжиниринг"
 * 
 * Добавлена поддержка глубоких ссылок (hash) для проектов и новостей.
 * Добавлена поддержка query-параметра ?modal=feedback для открытия модалки по прямой ссылке.
 */
class ModalManager {
  constructor() {
    this.modals = new Map();
    this.activeModal = null;
    this.activeModalStack = [];
    this.cleanupHandlers = new Map();
    this._boundKeyHandler = null;
    this._boundClickHandler = null;
    this._boundOpenHandler = null;
    this._boundFocusTrapHandler = null;
    this._handlersInitialized = false;
    this.currentModalId = null; // id текущего открытого объекта (проекта или новости)
    this._initGlobalHandlers();
    // <-- ИЗМЕНЕНИЕ: при создании экземпляра проверяем параметр modal в URL
    this._openFromUrl();
  }

  register(key, config) {
    this.modals.set(key, {
      overlayId: config.overlayId,
      onOpen: config.onOpen || null,
      onClose: config.onClose || null,
      focusSelector: config.focusSelector || null
    });
    this._setupOverlayClick(key);
    return this;
  }

  _setupOverlayClick(key) {
    const config = this.modals.get(key);
    if (!config) return;
    const overlay = document.getElementById(config.overlayId);
    if (!overlay) return;
    if (overlay._clickHandlerAttached) return;

    const clickHandler = (e) => {
      if (e.target === overlay) {
        this.close(key);
      }
    };
    overlay.addEventListener('click', clickHandler, { capture: false });
    overlay._clickHandlerAttached = true;
    overlay._clickHandler = clickHandler;
    this.cleanupHandlers.set(key, { overlay, clickHandler });
  }

  _initGlobalHandlers() {
    if (this._handlersInitialized) return;

    this._boundKeyHandler = (e) => {
      if (e.key !== 'Escape') return;
      if (this.activeModal) {
        this.close(this.activeModal);
        return;
      }
      const policyModal = document.getElementById('policyModalOverlay');
      if (policyModal && policyModal.classList.contains('active')) {
        this.close('policy');
      }
    };
    document.addEventListener('keydown', this._boundKeyHandler);

    this._boundClickHandler = (e) => {
      const closeBtn = e.target.closest('.modal-close');
      if (!closeBtn) return;
      const overlay = closeBtn.closest('.modal-overlay');
      if (!overlay) return;

      let modalKey = null;
      for (const [key, config] of this.modals) {
        if (config.overlayId === overlay.id) {
          modalKey = key;
          break;
        }
      }

      if (modalKey) {
        this.close(modalKey);
      } else {
        overlay.classList.remove('active');
        ScrollManager.unlock();
        this.activeModal = null;
        this.activeModalStack = [];
      }
    };
    document.addEventListener('click', this._boundClickHandler, { capture: false });

    this._boundOpenHandler = (e) => {
      const trigger = e.target.closest('[data-modal-open]');
      if (!trigger) return;
      const modalType = trigger.getAttribute('data-modal-open');
      if (!modalType) return;
      e.preventDefault();
      this._handleModalOpen(modalType, trigger);
    };
    document.addEventListener('click', this._boundOpenHandler, { capture: false });

    this._handlersInitialized = true;
  }

  _handleModalOpen(modalType, trigger) {
    switch (modalType) {
      case 'proposal':
        this.open('proposal');
        break;
      case 'application':
      case 'universal':
        this._openUniversalApplication(trigger);
        break;
      case 'project':
        this._openProject(trigger);
        break;
      case 'service':
        this._openService(trigger);
        break;
      case 'news':
        this._openNews(trigger);
        break;
      case 'feedback':
        this.open('feedback');
        break;
      default:
        Logger.WARN(`Неизвестный тип модалки: ${modalType}`);
    }
  }

  _openProject(trigger) {
    const projectId = trigger?.getAttribute('data-project-id');
    if (!projectId || !window.PROJECTS_DATA || !window.PROJECTS_DATA[projectId]) {
      Logger.WARN(`Проект с id ${projectId} не найден`);
      return;
    }
    const project = window.PROJECTS_DATA[projectId];
    this._populateProjectModal(project);
    this.currentModalId = projectId;
    this.open('project', { id: projectId });
  }

  _populateProjectModal(project) {
    const titleEl = document.getElementById('projectModalTitle');
    const categoryEl = document.getElementById('projectModalCategory');
    const contentEl = document.getElementById('projectModalContent');
    const imageEl = document.getElementById('projectModalImage');
    const container = document.getElementById('projectModalImageContainer');

    if (titleEl) titleEl.textContent = project.title;
    if (categoryEl) categoryEl.textContent = project.category;
    if (contentEl) {
      const list = document.createElement('ul');
      list.className = 'modal-list';
      project.details.forEach(detail => {
        const li = document.createElement('li');
        li.textContent = detail;
        list.appendChild(li);
      });
      contentEl.replaceChildren(list);
    }
    if (container && imageEl) {
      const images = project.images || [];
      if (typeof window.initProjectGallery === 'function') {
        window.initProjectGallery(images, container, imageEl);
      } else {
        const img = images[0] || 'assets/images/placeholder.jpg';
        imageEl.src = img;
        imageEl.alt = project.title;
      }
    }
  }

  _openService(trigger) {
    const serviceId = trigger?.getAttribute('data-service-id');
    if (!serviceId || !window.servicesData || !window.servicesData[serviceId]) {
      Logger.WARN(`Услуга с id ${serviceId} не найдена`);
      return;
    }
    const service = window.servicesData[serviceId];
    this._populateServiceModal(service);
    this.open('service');
  }

  _populateServiceModal(service) {
    const titleEl = document.getElementById('serviceModalTitle');
    const categoryEl = document.getElementById('serviceModalCategory');
    const contentEl = document.getElementById('serviceModalContent');
    const imageEl = document.getElementById('serviceModalImage');
    const container = document.getElementById('serviceModalImageContainer');

    if (titleEl) titleEl.textContent = service.title;
    if (categoryEl) categoryEl.textContent = service.category || 'Услуга';
    if (contentEl) {
      const list = document.createElement('ul');
      list.className = 'modal-list';
      (service.details || []).forEach(detail => {
        const li = document.createElement('li');
        li.textContent = detail;
        list.appendChild(li);
      });
      contentEl.replaceChildren(list);
    }
    if (container && imageEl) {
      const images = service.images || [];
      if (typeof window.initServiceGallery === 'function') {
        window.initServiceGallery(images);
      } else {
        const img = images[0] || 'assets/images/placeholder.jpg';
        imageEl.src = img;
        imageEl.alt = service.title;
      }
    }
  }

  _openNews(trigger) {
    const newsId = trigger?.getAttribute('data-news-id');
    if (!newsId) return;
    const allNews = Object.values(window.NEWS_DATA || {}).flat();
    const news = allNews.find(n => String(n.id) === String(newsId));
    if (!news) {
      Logger.WARN(`Новость с id ${newsId} не найдена`);
      return;
    }
    this._populateNewsModal(news);
    this.currentModalId = newsId;
    this.open('news', { id: newsId });
  }

  _populateNewsModal(news) {
    const titleEl = document.getElementById('newsModalTitle');
    const categoryEl = document.getElementById('newsModalCategory');
    const dateEl = document.getElementById('newsModalDate');
    const contentEl = document.getElementById('newsModalContent');
    const imageEl = document.getElementById('newsModalImage');

    if (titleEl) titleEl.textContent = news.title;
    if (categoryEl) categoryEl.textContent = news.category;
    if (dateEl) dateEl.textContent = news.date;
    if (contentEl) {
      const div = document.createElement('div');
      div.className = 'news-full-content';
      div.innerHTML = Utils.Sanitizer.sanitizeHtml(news.content);
      contentEl.replaceChildren(div);
    }
    if (imageEl) {
      imageEl.src = news.image || 'assets/images/placeholder.jpg';
      imageEl.alt = news.title;
    }
  }

  _openUniversalApplication(trigger) {
    const vacancyId = trigger?.getAttribute('data-vacancy-id') || null;
    const mode = vacancyId ? 'vacancy' : 'application';

    const modalTitle = document.getElementById('universalApplicationModalTitle');
    const modalSubtitle = document.getElementById('universalApplicationModalSubtitle');
    const submitBtnText = document.getElementById('universalSubmitBtnText');
    const successTitle = document.getElementById('universalSuccessTitle');

    const form = document.getElementById('universalApplicationForm');

    if (mode === 'application') {
        if (modalTitle) modalTitle.textContent = 'Отправить заявку';
        if (submitBtnText) submitBtnText.textContent = 'Отправить информацию';
        if (successTitle) successTitle.textContent = 'Данные отправлены!';
        if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже, и мы свяжемся с вами';
        
        if (form) {
            this._setHiddenField(form, 'vacancy_id', '');
            this._setHiddenField(form, 'vacancy_title', '');
        }
    } else {
        const vacancyCard = trigger?.closest('.vacancy-card');
        const vacancyTitle = vacancyCard?.querySelector('.vacancy-title')?.textContent || '';
        if (modalTitle) modalTitle.textContent = `Отклик на вакансию: ${vacancyTitle}`;
        if (submitBtnText) submitBtnText.textContent = 'Отправить отклик';
        if (successTitle) successTitle.textContent = 'Отклик отправлен!';
        if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже, и мы рассмотрим вашу кандидатуру';
        
        if (form) {
            this._setHiddenField(form, 'vacancy_id', vacancyId);
            this._setHiddenField(form, 'vacancy_title', vacancyTitle);
        }
    }

    this.open('universal');
  }

  _setHiddenField(form, name, value) {
    let input = form.querySelector(`input[name="${name}"]`);
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
    }
    input.value = value;
  }

  // ========== Публичные методы для глубоких ссылок ==========
  openProjectById(id) {
    if (!window.PROJECTS_DATA || !window.PROJECTS_DATA[id]) {
      Logger.WARN(`Проект с id ${id} не найден`);
      return false;
    }
    const project = window.PROJECTS_DATA[id];
    this._populateProjectModal(project);
    this.currentModalId = id;
    this.open('project', { id: id });
    return true;
  }

  openNewsById(id) {
    const allNews = Object.values(window.NEWS_DATA || {}).flat();
    const news = allNews.find(n => String(n.id) === String(id));
    if (!news) {
      Logger.WARN(`Новость с id ${id} не найдена`);
      return false;
    }
    this._populateNewsModal(news);
    this.currentModalId = id;
    this.open('news', { id: id });
    return true;
  }
  // ===================================================

  // <-- ИЗМЕНЕНИЕ: метод для обновления URL (добавление/удаление параметра modal)
  _updateUrl(action, key) {
    const url = new URL(window.location.href);
    if (action === 'add') {
      url.searchParams.set('modal', key);
    } else {
      url.searchParams.delete('modal');
    }
    window.history.replaceState({}, '', url.toString());
  }

  // <-- ИЗМЕНЕНИЕ: при загрузке проверяем параметр modal и открываем соответствующую модалку
  _openFromUrl() {
    const url = new URL(window.location.href);
    const modalKey = url.searchParams.get('modal');
    if (modalKey && this.modals.has(modalKey)) {
      setTimeout(() => {
        this.open(modalKey);
      }, 300);
    }
  }

  open(key, options = {}) {
    const config = this.modals.get(key);
    if (!config) {
      Logger.WARN(`Модалка "${key}" не зарегистрирована`);
      return false;
    }

    if (this.activeModal === key) return true;

    const keepParentModal = options.keepParentModal === true;
    if (this.activeModal && this.activeModal !== key && !keepParentModal) {
      this.close(this.activeModal);
    } else if (this.activeModal && this.activeModal !== key && keepParentModal) {
      this.activeModalStack.push(this.activeModal);
    }

    const overlay = document.getElementById(config.overlayId);
    if (!overlay) return false;

    this.activeModal = key;
    ScrollManager.lock();

    setTimeout(() => {
      overlay.classList.add('active');

      this._initFocusTrap(overlay);
      if (config.onOpen) config.onOpen(overlay);
      if (options.onOpen) options.onOpen(overlay);
      if (window.Services?.eventBus) {
        window.Services.eventBus.emit('modal:opened', { key, overlay });
      }

      // <-- ИЗМЕНЕНИЕ: добавляем параметр modal в URL для модалки feedback
      if (key === 'feedback') {
        this._updateUrl('add', key);
      }

      if (key === 'project' || key === 'news') {
        const id = options.id || this.currentModalId;
        if (id) {
          this._updateHash(key, id);
        }
      }
    }, 50);

    return true;
  }

  close(key) {
    const config = this.modals.get(key);
    if (!config) {
      return false;
    }
    if (this.activeModal !== key) {
      return false;
    }

    const overlay = document.getElementById(config.overlayId);
    if (!overlay) return false;

    this._removeFocusTrap();
    overlay.classList.remove('active');

    // <-- ИЗМЕНЕНИЕ: удаляем параметр modal из URL при закрытии feedback
    if (key === 'feedback') {
      this._updateUrl('remove');
    }

    if (key === 'project' || key === 'news') {
      this._clearHash();
      this.currentModalId = null;
    }

    const previousModal = this.activeModalStack.length > 0 ? this.activeModalStack.pop() : null;
    if (!previousModal) {
      ScrollManager.unlock();
    } else {
      ScrollManager.state.lockCount--;
    }

    this.activeModal = previousModal;

    if (config.onClose) {
      config.onClose(overlay);
    }

    if (window.Services?.eventBus) {
      window.Services.eventBus.emit('modal:closed', { key });
    }
    return true;
  }

  isOpen(key = null) {
    return key ? this.activeModal === key : this.activeModal !== null;
  }

  closeAll() {
    this.modals.forEach((_, key) => this.close(key));
  }

  // ========== Вспомогательные методы для хеша ==========
  _updateHash(key, id) {
    const hash = `${key}=${id}`;
    const currentHash = window.location.hash.slice(1);
    if (currentHash !== hash) {
      history.pushState(null, '', '#' + hash);
    }
  }

  _clearHash() {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
  // ===================================================

  _initFocusTrap(overlay) {
    if (!overlay) return;
    this._removeFocusTrap();
    const focusable = overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    this._boundFocusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', this._boundFocusTrapHandler);
  }

  _removeFocusTrap() {
    if (this._boundFocusTrapHandler) {
      document.removeEventListener('keydown', this._boundFocusTrapHandler);
      this._boundFocusTrapHandler = null;
    }
  }

  destroy() {
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
    if (this._boundClickHandler) {
      document.removeEventListener('click', this._boundClickHandler);
      this._boundClickHandler = null;
    }
    if (this._boundOpenHandler) {
      document.removeEventListener('click', this._boundOpenHandler);
      this._boundOpenHandler = null;
    }
    this._removeFocusTrap();
    this.cleanupHandlers.forEach(({ overlay, clickHandler }) => {
      if (overlay && clickHandler) {
        overlay.removeEventListener('click', clickHandler);
      }
    });
    this.cleanupHandlers.clear();
    this.modals.clear();
    this.activeModal = null;
    this.activeModalStack = [];
    this._handlersInitialized = false;
    this.currentModalId = null;
  }
}

const modalManager = new ModalManager();
window.modalManager = modalManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalManager, modalManager };
}