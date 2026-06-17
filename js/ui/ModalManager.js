/**
 * Управление модальными окнами – единая точка входа
 * ООО "Волга-Днепр Инжиниринг"
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
    this._initGlobalHandlers();
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

    this._ensureCloseButton(overlay);

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

  _ensureCloseButton(overlay) {
    const container = overlay.querySelector('.modal-container, .modal-container-proposal, .details-modal-container');
    if (!container) return;
    if (container.querySelector('.modal-close')) return;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', 'Закрыть');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
    svg.appendChild(path);
    closeBtn.appendChild(svg);

    container.insertBefore(closeBtn, container.firstChild);
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

      // ✅ Ищем ключ по id overlay (гарантирует нахождение)
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
        // Если ключ не найден – закрываем вручную и сбрасываем состояние
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
    this.open('project');
  }

  _populateProjectModal(project) {
    const sanitizer = window.Utils?.Sanitizer;
    const modalTitle = document.getElementById('projectModalTitle');
    const modalContent = document.getElementById('projectModalContent');
    const modalCategory = document.getElementById('projectModalCategory');
    const modalImageContainer = document.getElementById('projectModalImageContainer');
    const modalImage = document.getElementById('projectModalImage');

    if (!modalTitle || !modalContent || !modalCategory) {
      Logger.WARN('Элементы модального окна проекта не найдены');
      return;
    }

    modalTitle.textContent = sanitizer ? sanitizer.escapeHtml(project.title) : project.title;
    modalCategory.textContent = sanitizer ? sanitizer.escapeHtml(project.category) : project.category;

    modalContent.replaceChildren();
    const ul = document.createElement('ul');
    ul.className = 'modal-list-ul';
    project.details.forEach(item => {
      const li = document.createElement('li');
      li.className = 'modal-list-li';
      li.textContent = sanitizer ? sanitizer.escapeHtml(item) : item;
      ul.appendChild(li);
    });
    modalContent.appendChild(ul);

    if (typeof initProjectGallery === 'function') {
      initProjectGallery(project.images, modalImageContainer, modalImage);
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
    const sanitizer = window.Utils?.Sanitizer;
    const modalTitle = document.getElementById('serviceModalTitle');
    const modalContent = document.getElementById('serviceModalContent');
    const modalCategory = document.getElementById('serviceModalCategory');

    if (!modalTitle || !modalContent) {
      Logger.WARN('Элементы модального окна услуги не найдены');
      return;
    }

    modalTitle.textContent = sanitizer ? sanitizer.escapeHtml(service.title) : service.title;
    modalCategory.textContent = sanitizer ? sanitizer.escapeHtml(service.category) : service.category;

    modalContent.replaceChildren();
    const ul = document.createElement('ul');
    ul.className = 'modal-list-ul';
    service.details.forEach(item => {
      const li = document.createElement('li');
      li.className = 'modal-list-li';
      li.textContent = sanitizer ? sanitizer.escapeHtml(item) : item;
      ul.appendChild(li);
    });
    modalContent.appendChild(ul);

    if (typeof initServiceGallery === 'function') {
      initServiceGallery(service.images);
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
    this.open('news');
  }

  _populateNewsModal(news) {
    const sanitizer = window.Utils?.Sanitizer;
    const title = document.getElementById('newsModalTitle');
    const date = document.getElementById('newsModalDate');
    const category = document.getElementById('newsModalCategory');
    const image = document.getElementById('newsModalImage');
    const content = document.getElementById('newsModalContent');

    if (!title || !content) {
      Logger.WARN('Элементы модального окна новости не найдены');
      return;
    }

    title.textContent = sanitizer ? sanitizer.escapeHtml(news.title) : news.title;
    if (date) date.textContent = sanitizer ? sanitizer.escapeHtml(news.date) : news.date;
    if (category) category.textContent = sanitizer ? sanitizer.escapeHtml(news.category) : news.category;
    if (image) {
      image.src = sanitizer?.isValidUrl ? (sanitizer.isValidUrl(news.image) ? news.image : 'assets/images/placeholder.jpg') : news.image;
      image.alt = sanitizer ? sanitizer.escapeHtml(news.title) : news.title;
    }

    content.replaceChildren();
    const safeContent = sanitizer ? sanitizer.sanitizeHtml(news.content, {
      allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'span', 'div']
    }) : news.content;
    const parser = new DOMParser();
    const doc = parser.parseFromString(safeContent, 'text/html');
    Array.from(doc.body.childNodes).forEach(node => {
      content.appendChild(node.cloneNode(true));
    });
  }

  _openUniversalApplication(trigger) {
    const vacancyId = trigger?.getAttribute('data-vacancy-id') || null;
    const mode = vacancyId ? 'vacancy' : 'application';

    const modalTitle = document.getElementById('universalApplicationModalTitle');
    const modalSubtitle = document.getElementById('universalApplicationModalSubtitle');
    const submitBtnText = document.getElementById('universalSubmitBtnText');
    const successTitle = document.getElementById('universalSuccessTitle');

    if (mode === 'application') {
      if (modalTitle) modalTitle.textContent = 'Отправить заявку';
      if (submitBtnText) submitBtnText.textContent = 'Отправить информацию';
      if (successTitle) successTitle.textContent = 'Данные отправлены!';
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже, и мы свяжемся с вами';
    } else {
      const vacancyCard = trigger?.closest('.vacancy-card');
      const vacancyTitle = vacancyCard?.querySelector('.vacancy-title')?.textContent || '';
      if (modalTitle) modalTitle.textContent = `Отклик на вакансию: ${vacancyTitle}`;
      if (submitBtnText) submitBtnText.textContent = 'Отправить отклик';
      if (successTitle) successTitle.textContent = 'Отклик отправлен!';
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже, и мы рассмотрим вашу кандидатуру';
    }

    this.open('universal');
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

      const focusTarget = options.focusSelector
        ? document.querySelector(options.focusSelector)
        : config.focusSelector
          ? overlay.querySelector(config.focusSelector)
          : overlay.querySelector('.modal-close, button, [href], input, select, textarea');
      if (focusTarget) {
        setTimeout(() => focusTarget.focus(), 100);
      }

      this._initFocusTrap(overlay);
      if (config.onOpen) config.onOpen(overlay);
      if (options.onOpen) options.onOpen(overlay);
      if (window.Services?.eventBus) {
        window.Services.eventBus.emit('modal:opened', { key, overlay });
      }
    }, 50);

    return true;
  }

  close(key) {
    const config = this.modals.get(key);
    if (!config) return false;
    if (this.activeModal !== key) return false;

    const overlay = document.getElementById(config.overlayId);
    if (!overlay) return false;

    this._removeFocusTrap();
    overlay.classList.remove('active');

    const previousModal = this.activeModalStack.length > 0 ? this.activeModalStack.pop() : null;
    if (!previousModal) {
      ScrollManager.unlock();
    } else {
      ScrollManager.state.lockCount--;
    }

    this.activeModal = previousModal;

    // Сброс форм
    if (key === 'proposal' && !previousModal && typeof formManager?._resetForm === 'function') {
      formManager._resetForm();
    }
    if (key === 'universal' && !previousModal && typeof UniversalApplicationModalManager?.resetForm === 'function') {
      UniversalApplicationModalManager.resetForm();
    }

    if (config.onClose) config.onClose(overlay);
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
  }
}

const modalManager = new ModalManager();
window.modalManager = modalManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalManager, modalManager };
}