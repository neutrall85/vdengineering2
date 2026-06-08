/**
 * Управление модальными окнами
 * ООО "Волга-Днепр Инжиниринг"
 * 
 * Единая точка управления закрытием модалок:
 * - Клик по кнопке закрытия (.modal-close)
 * - Клик вне области модалки (по overlay)
 * - Нажатие клавиши Escape
 */

class ModalManager {
  constructor() {
    this.modals = new Map();
    this.activeModal = null;
    this.activeModalStack = [];
    this.cleanupHandlers = new Map();
    this._boundKeyHandler = null;
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
    
    this._ensureCloseButton(overlay);
    
    if (overlay._clickHandlerAttached) return;
    
    const clickHandler = (e) => {
      if (!e.target || !e.target.nodeType) return;
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
      const overlayId = overlay.id;
      const modalKeyMap = {
        'modalOverlay': 'form',
        'detailsModalOverlay': 'details',
        'newsModalOverlay': 'news',
        'proposalModalOverlay': 'proposal',
        'universalApplicationModalOverlay': 'universal',
        'aboutModalOverlay': 'about',
        'projectModalOverlay': 'project',
        'serviceModalOverlay': 'service',
        'policyModalOverlay': 'policy'
      };
      const modalKey = modalKeyMap[overlayId];
      if (modalKey && this.modals.has(modalKey)) {
        this.close(modalKey);
      } else {
        overlay.classList.remove('active');
        ScrollManager.unlock();
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
      case 'form':
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
      default:
        Logger.WARN(`Unknown modal type: ${modalType}`);
    }
  }

  _openUniversalApplication(trigger) {
    const vacancyId = trigger ? trigger.getAttribute('data-vacancy-id') : null;
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
      const vacancyDepartment = vacancyCard?.querySelector('.vacancy-department')?.textContent || '';
      
      if (modalTitle) modalTitle.textContent = `Отклик на вакансию: ${vacancyTitle}`;
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже, и мы рассмотрим вашу кандидатуру';
      if (submitBtnText) submitBtnText.textContent = 'Отправить отклик';
      if (successTitle) successTitle.textContent = 'Отклик отправлен!';
    }
    
    this.open('universal');
  }

  _openProject(trigger) {
    const projectId = trigger?.getAttribute('data-project-id');
    if (!projectId || !window.PROJECTS_DATA || !window.PROJECTS_DATA[projectId]) {
      Logger.WARN(`Project with id ${projectId} not found`);
      return;
    }
    
    const project = window.PROJECTS_DATA[projectId];
    const modalTitle = document.getElementById('projectModalTitle');
    const modalContent = document.getElementById('projectModalContent');
    const modalCategory = document.getElementById('projectModalCategory');
    const modalImageContainer = document.getElementById('projectModalImageContainer');
    const modalImage = document.getElementById('projectModalImage');
    
    if (!modalTitle || !modalContent || !modalCategory) {
      Logger.WARN('Элементы модального окна проекта не найдены');
      return;
    }
    
    const sanitizer = window.Utils?.Sanitizer;
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
    
    this.open('project');
  }

  _openService(trigger) {
    const serviceId = trigger?.getAttribute('data-service-id');
    if (!serviceId || !window.servicesData || !window.servicesData[serviceId]) {
      Logger.WARN(`Service with id ${serviceId} not found`);
      return;
    }
    
    const service = window.servicesData[serviceId];
    const modalTitle = document.getElementById('serviceModalTitle');
    const modalContent = document.getElementById('serviceModalContent');
    const modalCategory = document.getElementById('serviceModalCategory');
    
    if (!modalTitle || !modalContent) {
      Logger.WARN('Элементы модального окна услуги не найдены');
      return;
    }
    
    const sanitizer = window.Utils?.Sanitizer;
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
    
    this.open('service');
  }

  open(key, options = {}) {
    const config = this.modals.get(key);
    if (!config) {
      Logger.WARN(`Modal "${key}" not registered`);
      return false;
    }

    if (this.activeModal === key) {
      return true;
    }

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

      if (key === 'form' && typeof formManager !== 'undefined') {
        formManager.initFileUploadOnModalOpen();
      }

      const focusTarget = options.focusSelector 
        ? document.querySelector(options.focusSelector)
        : config.focusSelector
          ? overlay.querySelector(config.focusSelector)
          : overlay.querySelector('.modal-close, button, [href], input, select, textarea');
      
      if (focusTarget) {
        setTimeout(() => focusTarget.focus(), window.CONFIG?.PERFORMANCE?.MODAL_FOCUS_DELAY_MS || 100);
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
    
    const previousModal = this.activeModalStack && this.activeModalStack.length > 0 
      ? this.activeModalStack.pop() 
      : null;
    
    if (!previousModal) {
      ScrollManager.unlock();
    } else {
      ScrollManager.state.lockCount--;
    }
    
    this.activeModal = previousModal;

    if (key === 'proposal' && !previousModal && typeof formManager !== 'undefined' && typeof formManager._resetForm === 'function') {
      formManager._resetForm();
    }

    if (key === 'universal' && !previousModal && typeof UniversalApplicationModalManager !== 'undefined' && typeof UniversalApplicationModalManager.resetForm === 'function') {
      UniversalApplicationModalManager.resetForm();
    }

    if (config.onClose) config.onClose(overlay);
    if (window.Services?.eventBus) {
      window.Services.eventBus.emit('modal:closed', { key });
    }
    return true;
  }

  isOpen(key = null) {
    if (key) {
      return this.activeModal === key;
    }
    return this.activeModal !== null;
  }

  closeAll() {
    this.modals.forEach((_, key) => {
      this.close(key);
    });
  }
  
  _initFocusTrap(overlay) {
    if (!overlay) return;
    this._removeFocusTrap();
    
    const focusableElements = overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length === 0) return;
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    this._boundFocusTrapHandler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
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
    this.cleanupHandlers.forEach((handlerData, key) => {
      const { overlay, clickHandler } = handlerData;
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