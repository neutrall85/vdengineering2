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
    this.currentModalId = null;
    this.currentCategory = null;
    this.currentProjectCategory = null;
    this._initGlobalHandlers();
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
      case 'category':
        const cat = trigger?.getAttribute('data-category') || trigger?.textContent.trim();
        this.openCategoryByName(cat);
        break;
      case 'project-category':
        const projCat = trigger?.getAttribute('data-category') || trigger?.textContent.trim();
        this.openProjectCategoryByName(projCat);
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
    
    const keepParent = this.activeModal === 'project-category';
    this.open('project', { id: projectId, keepParentModal: keepParent });
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
    
    const keepParent = this.activeModal === 'category';
    this.open('news', { id: newsId, keepParentModal: keepParent });
  }

  _populateNewsModal(news) {
    const titleEl = document.getElementById('newsModalTitle');
    const categoryEl = document.getElementById('newsModalCategory');
    const dateEl = document.getElementById('newsModalDate');
    const contentEl = document.getElementById('newsModalContent');
    const container = document.getElementById('newsModalImageContainer');
    const mainImage = document.getElementById('newsModalImage');

    if (titleEl) titleEl.textContent = news.title;
    if (categoryEl) categoryEl.textContent = news.category;
    if (dateEl) dateEl.textContent = news.date;
    if (contentEl) {
      const div = document.createElement('div');
      div.className = 'news-full-content';
      div.innerHTML = Utils.Sanitizer.sanitizeHtml(news.content);
      contentEl.replaceChildren(div);
    }

    if (container && mainImage) {
      const images = news.images || (news.image ? [news.image] : []);
      if (images.length === 0) {
        container.style.display = 'none';
        return;
      }
      container.style.display = 'flex';
      if (typeof window.initProjectGallery === 'function') {
        window.initProjectGallery(images, container, mainImage);
      } else {
        mainImage.src = images[0];
        mainImage.alt = news.title;
      }
    }
  }

  openCategoryByName(category) {
    if (!category) {
        Logger.WARN('openCategoryByName: Категория не передана');
        return;
    }

    const titleEl = document.getElementById('categoryModalTitle');
    const listEl = document.getElementById('categoryNewsList');
    const emptyEl = document.getElementById('categoryNewsEmpty');

    if (!titleEl || !listEl || !emptyEl) {
      Logger.WARN('Элементы модалки категории новостей не найдены в DOM!');
      return;
    }

    listEl.innerHTML = '';
    emptyEl.style.display = 'none';
    titleEl.textContent = `Новости категории: ${category}`;

    if (!window.newsRenderer) {
      Logger.WARN('window.newsRenderer не найден.');
      emptyEl.textContent = 'Новости временно недоступны.';
      emptyEl.style.display = 'block';
      this.currentCategory = category;
      this.open('category', { id: category });
      return;
    }

    const allNews = Object.values(window.NEWS_DATA || {}).flat();
    const filteredNews = allNews.filter(news => news.category === category);
    filteredNews.sort((a, b) => b.id - a.id);

    if (filteredNews.length === 0) {
      emptyEl.style.display = 'block';
    } else {
      const fragment = document.createDocumentFragment();
      const renderer = window.newsRenderer;

      filteredNews.forEach((news, index) => {
        if (renderer && typeof renderer._createNewsCard === 'function') {
          const card = renderer._createNewsCard(news, index);
          card.dataset.once = 'true';
          fragment.appendChild(card);
        }
      });

      listEl.appendChild(fragment);

      const cards = listEl.querySelectorAll('.news-card');
      cards.forEach(card => {
        card.classList.remove('animate-on-scroll', 'fade-up');
        card.classList.add('loaded');
      });

      if (renderer && typeof renderer._lazyLoadImages === 'function') {
        renderer._lazyLoadImages(listEl);
      }
      if (window.animationManager) {
        window.animationManager.observeNewElements(listEl);
      }
    }

    this.currentCategory = category;
    this.open('category', { id: category });
  }

  openProjectCategoryByName(category) {
    if (!category) {
        Logger.WARN('openProjectCategoryByName: Категория не передана');
        return;
    }

    const titleEl = document.getElementById('projectCategoryModalTitle');
    const listEl = document.getElementById('projectCategoryList');
    const emptyEl = document.getElementById('projectCategoryEmpty');

    if (!titleEl || !listEl || !emptyEl) {
      Logger.WARN('Элементы модалки категории проектов не найдены в DOM!');
      return;
    }

    listEl.innerHTML = '';
    emptyEl.style.display = 'none';
    titleEl.textContent = `Проекты категории: ${category}`;

    if (!window.projectRenderer) {
      Logger.WARN('window.projectRenderer не найден.');
      emptyEl.textContent = 'Проекты временно недоступны.';
      emptyEl.style.display = 'block';
      this.currentProjectCategory = category;
      this.open('project-category', { id: category });
      return;
    }

    const allProjects = Object.values(window.projectRenderer?.PROJECTS_DATA || {});
    const filteredProjects = allProjects.filter(project => project.category.includes(category));

    if (filteredProjects.length === 0) {
      emptyEl.style.display = 'block';
    } else {
      const fragment = document.createDocumentFragment();
      const renderer = window.projectRenderer;

      filteredProjects.forEach((project, index) => {
        if (renderer && typeof renderer._createProjectCard === 'function') {
          const card = renderer._createProjectCard(project, index);
          card.dataset.once = 'true';
          fragment.appendChild(card);
        }
      });

      listEl.appendChild(fragment);

      const cards = listEl.querySelectorAll('.project-card');
      cards.forEach(card => {
        card.classList.remove('animate-on-scroll', 'fade-up');
        card.classList.add('loaded');
      });

      if (renderer && typeof renderer._lazyLoadImages === 'function') {
        renderer._lazyLoadImages(listEl);
      }
      if (window.animationManager) {
        window.animationManager.observeNewElements(listEl);
      }
    }

    this.currentProjectCategory = category;
    this.open('project-category', { id: category });
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
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже и мы свяжемся с вами';
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
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже и мы рассмотрим вашу кандидатуру';
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

  openProjectById(id) {
    if (!window.PROJECTS_DATA || !window.PROJECTS_DATA[id]) {
      Logger.WARN(`Проект с id ${id} не найден`);
      return false;
    }
    const project = window.PROJECTS_DATA[id];
    this._populateProjectModal(project);
    this.currentModalId = id;
    this.open('project', { id: id, keepParentModal: false });
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
    this.open('news', { id: id, keepParentModal: false });
    return true;
  }

  _updateUrl(action, key) {
    const url = new URL(window.location.href);
    if (action === 'add') {
      url.searchParams.set('modal', key);
    } else {
      url.searchParams.delete('modal');
    }
    window.history.replaceState({}, '', url.toString());
  }

  _openFromUrl() {
    const url = new URL(window.location.href);
    const modalKey = url.searchParams.get('modal');
    if (modalKey && this.modals.has(modalKey)) {
      setTimeout(() => {
        this.open(modalKey);
      }, 300);
    }
  }

  // ===== ИСПРАВЛЕНИЕ: не вызываем ScrollManager.lock() при восстановлении (skipStack=true) =====
  open(key, options = {}) {
    const config = this.modals.get(key);
    if (!config) {
      Logger.WARN(`Модалка "${key}" не зарегистрирована`);
      return false;
    }

    const keepParentModal = options.keepParentModal === true;
    const skipStack = options.skipStack === true;

    // Если skipStack=true, не пытаемся закрыть активную модалку (это предотвращает рекурсию при восстановлении)
    if (this.activeModal && this.activeModal !== key && !keepParentModal && !skipStack) {
      this.close(this.activeModal);
    } else if (this.activeModal && this.activeModal !== key && keepParentModal) {
      if (!skipStack) {
        this.activeModalStack.push(this.activeModal);
      }
    }

    const overlay = document.getElementById(config.overlayId);
    if (!overlay) return false;

    // Перемещаем дочернюю модалку в конец body, чтобы она перекрывала родительскую
    if (keepParentModal) {
      document.body.appendChild(overlay);
    }

    this.activeModal = key;
    
    // ===== КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: не блокируем скролл при восстановлении =====
    if (!skipStack) {
      ScrollManager.lock();
    }

    setTimeout(() => {
      overlay.classList.add('active');
      this._initFocusTrap(overlay);
      if (config.onOpen) config.onOpen(overlay);
      if (options.onOpen) options.onOpen(overlay);
      if (window.Services?.eventBus) {
        window.Services.eventBus.emit('modal:opened', { key, overlay });
      }
      if (key === 'feedback') {
        this._updateUrl('add', key);
      }
      if (key === 'project' || key === 'news' || key === 'category' || key === 'project-category') {
        const id = options.id || this.currentModalId || this.currentCategory || this.currentProjectCategory;
        if (id) {
          this._updateHash(key, id);
        }
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

    if (key === 'feedback') {
      this._updateUrl('remove');
    }
    if (key === 'project' || key === 'news' || key === 'category' || key === 'project-category') {
      this._clearHash();
      this.currentModalId = null;
      this.currentCategory = null;
      this.currentProjectCategory = null;
    }

    const previousModal = this.activeModalStack.length > 0 ? this.activeModalStack.pop() : null;
    if (!previousModal) {
      ScrollManager.unlock();
    } else {
      ScrollManager.state.lockCount--;
      // Восстанавливаем родительскую модалку. skipStack=true предотвращает зацикливание закрытия и лишнюю блокировку.
      this.open(previousModal, { keepParentModal: false, skipStack: true });
    }

    // this.open уже установит this.activeModal = previousModal, поэтому не переопределяем здесь.

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

  _updateHash(key, id) {
    const hash = `${key}=${encodeURIComponent(id)}`;
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
    this.currentModalId = null;
    this.currentCategory = null;
    this.currentProjectCategory = null;
    this._handlersInitialized = false;
  }
}

const modalManager = new ModalManager();
window.modalManager = modalManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalManager, modalManager };
}