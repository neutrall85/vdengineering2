/**
 * Управление модальными окнами – единая точка входа
 * ООО "ВД Инжиниринг"
 *
 * Версия с ЧПУ-ссылками (без #, ?, &)
 * Исправлено восстановление URL при закрытии модалок новостей и проектов
 * Добавлена автоматическая инициализация страницы проектов при закрытии
 * Исправлена корректировка originalPath для категорий (category, project-category)
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
    this.originalPath = null;

    this._categoryRetryCount = 0;
    this._projectCategoryRetryCount = 0;
    this._categoryRetryTimer = null;
    this._projectCategoryRetryTimer = null;
    this._openTimeout = null;
    this._openFromUrlTimeout = null;

    this._initGlobalHandlers();
    this._initPopstate();
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
      const normalizedImages = images.map(img => this._normalizePath(img));
      if (typeof window.initProjectGallery === 'function') {
        window.initProjectGallery(normalizedImages, container, imageEl);
      } else {
        const img = normalizedImages[0] || '/assets/images/placeholder.jpg';
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
      const normalizedImages = images.map(img => this._normalizePath(img));
      if (typeof window.initServiceGallery === 'function') {
        window.initServiceGallery(normalizedImages);
      } else {
        const img = normalizedImages[0] || '/assets/images/placeholder.jpg';
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
      const normalizedImages = images.map(img => this._normalizePath(img));
      if (normalizedImages.length === 0) {
        container.classList.add('hidden');
        return;
      }
      container.classList.remove('hidden');
      container.classList.add('flex');
      if (typeof window.initProjectGallery === 'function') {
        window.initProjectGallery(normalizedImages, container, mainImage);
      } else {
        mainImage.src = normalizedImages[0];
        mainImage.alt = news.title;
      }
    }
  }

  openCategoryByName(category) {
    if (!category) {
      Logger.WARN('openCategoryByName: Категория не передана');
      return;
    }

    if (!window.newsRenderer) {
      if (this._categoryRetryCount < 30) {
        this._categoryRetryCount++;
        if (this._categoryRetryTimer) clearTimeout(this._categoryRetryTimer);
        this._categoryRetryTimer = setTimeout(() => {
          this._categoryRetryTimer = null;
          this.openCategoryByName(category);
        }, 100);
        return;
      } else {
        Logger.ERROR('openCategoryByName: newsRenderer так и не появился');
        this._categoryRetryCount = 0;
        return;
      }
    }
    this._categoryRetryCount = 0;
    if (this._categoryRetryTimer) {
      clearTimeout(this._categoryRetryTimer);
      this._categoryRetryTimer = null;
    }

    const titleEl = document.getElementById('categoryModalTitle');
    const listEl = document.getElementById('categoryNewsList');
    const emptyEl = document.getElementById('categoryNewsEmpty');

    if (!titleEl || !listEl || !emptyEl) {
      Logger.WARN('Элементы модалки категории новостей не найдены в DOM!');
      return;
    }

    listEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    titleEl.textContent = `Новости категории: ${category}`;

    const allNews = Object.values(window.NEWS_DATA || {}).flat();
    const filteredNews = allNews.filter(news => news.category === category);
    filteredNews.sort((a, b) => b.id - a.id);

    if (filteredNews.length === 0) {
      emptyEl.classList.remove('hidden');
      emptyEl.classList.add('block');
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

    if (!window.projectRenderer) {
      if (this._projectCategoryRetryCount < 30) {
        this._projectCategoryRetryCount++;
        if (this._projectCategoryRetryTimer) clearTimeout(this._projectCategoryRetryTimer);
        this._projectCategoryRetryTimer = setTimeout(() => {
          this._projectCategoryRetryTimer = null;
          this.openProjectCategoryByName(category);
        }, 100);
        return;
      } else {
        Logger.ERROR('openProjectCategoryByName: projectRenderer так и не появился');
        this._projectCategoryRetryCount = 0;
        return;
      }
    }
    this._projectCategoryRetryCount = 0;
    if (this._projectCategoryRetryTimer) {
      clearTimeout(this._projectCategoryRetryTimer);
      this._projectCategoryRetryTimer = null;
    }

    const titleEl = document.getElementById('projectCategoryModalTitle');
    const listEl = document.getElementById('projectCategoryList');
    const emptyEl = document.getElementById('projectCategoryEmpty');

    if (!titleEl || !listEl || !emptyEl) {
      Logger.WARN('Элементы модалки категории проектов не найдены в DOM!');
      return;
    }

    listEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    titleEl.textContent = `Проекты категории: ${category}`;

    const allProjects = Object.values(window.projectRenderer?.PROJECTS_DATA || {});
    const filteredProjects = allProjects.filter(project => project.category.includes(category));

    if (filteredProjects.length === 0) {
      emptyEl.classList.remove('hidden');
      emptyEl.classList.add('block');
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
    
    // Проверяем, есть ли атрибут keep-parent (или передаём через опции)
    const keepParent = trigger?.getAttribute('data-keep-parent') === 'true' || false;
    const modalTitle = document.getElementById('universalApplicationModalTitle');
    const modalSubtitle = document.getElementById('universalApplicationModalSubtitle');
    const submitBtnText = document.getElementById('universalSubmitBtnText');
    const successTitle = document.getElementById('universalSuccessTitle');
    const form = document.getElementById('universalApplicationForm');

    if (mode === 'application') {
      if (modalTitle) modalTitle.textContent = 'Отправить заявку';
      if (submitBtnText) submitBtnText.textContent = 'Отправить информацию';
      if (successTitle) successTitle.textContent = 'Данные отправлены!';
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже и мы свяжемся с Вами';
      if (form) {
        this._setHiddenField(form, 'vacancy_id', '');
        this._setHiddenField(form, 'vacancy_title', '');
      }
    } else {
      const vacancyCard = trigger?.closest('.vacancy-card-short') || document.querySelector(`[data-vacancy-id="${vacancyId}"]`);
      const vacancyTitle = vacancyCard?.querySelector('.vacancy-title')?.textContent || '';
      if (modalTitle) modalTitle.textContent = `Отклик на вакансию: ${vacancyTitle}`;
      if (submitBtnText) submitBtnText.textContent = 'Отправить отклик';
      if (successTitle) successTitle.textContent = 'Отклик отправлен!';
      if (modalSubtitle) modalSubtitle.textContent = 'Заполните форму ниже и мы рассмотрим Вашу кандидатуру';
      if (form) {
        this._setHiddenField(form, 'vacancy_id', vacancyId);
        this._setHiddenField(form, 'vacancy_title', vacancyTitle);
      }
    }
    // Открываем универсальную модалку с сохранением родительской, если нужно
    this.open('universal', { keepParentModal: keepParent });
  }

  _setHiddenField(form, name, value) {
    let input = form.querySelector(`input[name="${name}"]`);
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.id = `hidden_${name}`; // добавляем id
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

  _normalizePath(path) {
    if (!path) return '/assets/images/placeholder.jpg';
    if (path.startsWith('/') || path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return '/' + path;
  }

  _updateUrl(key, id) {
    if (!key) return;
    let path;
    if (key === 'proposal') {
      path = '/proposal';
    } else if (key === 'feedback') {
      path = '/feedback';
    } else {
      const urlKey = key === 'project' ? 'projects' : key;
      if (id) {
        path = `/${urlKey}/${encodeURIComponent(id)}`;
      } else {
        return;
      }
    }
    window.history.pushState({ modal: key, id: id || null }, '', path);
  }

  _openFromUrl() {
    const path = window.location.pathname;
    
    // Проверяем /proposal
    if (path === '/proposal' || path === '/proposal.html') {
      if (this._openFromUrlTimeout) clearTimeout(this._openFromUrlTimeout);
      this._openFromUrlTimeout = setTimeout(() => {
        this._openFromUrlTimeout = null;
        this.open('proposal', { skipUrlUpdate: true });
      }, 300);
      return;
    }

    const match = path.match(/^\/(news|projects|category|project-category|feedback)(?:\/(.+))?$/);
    if (match) {
      let [, key, id] = match;
      if (key === 'projects') key = 'project';

      if (key === 'feedback') {
        if (this._openFromUrlTimeout) clearTimeout(this._openFromUrlTimeout);
        this._openFromUrlTimeout = setTimeout(() => {
          this._openFromUrlTimeout = null;
          this.open('feedback', { skipUrlUpdate: true });
        }, 300);
        return;
      }

      const decodedId = id ? decodeURIComponent(id) : null;
      if (!decodedId) {
        return;
      }

      if (this._openFromUrlTimeout) clearTimeout(this._openFromUrlTimeout);
      this._openFromUrlTimeout = setTimeout(() => {
        this._openFromUrlTimeout = null;
        if (key === 'project') {
          const project = window.PROJECTS_DATA?.[decodedId];
          if (project) {
            this._populateProjectModal(project);
            this.currentModalId = decodedId;
            this.open('project', { id: decodedId, keepParentModal: false, skipUrlUpdate: true });
          }
        } else if (key === 'news') {
          const allNews = Object.values(window.NEWS_DATA || {}).flat();
          const news = allNews.find(n => String(n.id) === String(decodedId));
          if (news) {
            this._populateNewsModal(news);
            this.currentModalId = decodedId;
            this.open('news', { id: decodedId, keepParentModal: false, skipUrlUpdate: true });
          }
        } else if (key === 'category') {
          this.openCategoryByName(decodedId);
        } else if (key === 'project-category') {
          this.openProjectCategoryByName(decodedId);
        }
      }, 300);
    }
  }

  _initPopstate() {
    window.addEventListener('popstate', (event) => {
        const state = event.state;
        if (state && state.modal) {
            const { modal, id } = state;

            if (!id && modal !== 'feedback' && modal !== 'proposal' && modal !== 'vacancy') {
                this.closeAll();
                return;
            }

            if (modal === 'proposal') {
                this.open('proposal', { skipUrlUpdate: true });
            } else if (modal === 'feedback') {
                this.open('feedback', { skipUrlUpdate: true });
            } else if (modal === 'vacancy') {
                if (id) {
                    const vacancyId = id; // строковый ID
                    // Проверяем существование вакансии по ID
                    const vacancy = window.VACANCIES_DATA?.find(v => String(v.id) === String(vacancyId));
                    if (vacancy) {
                        // Заполняем модалку
                        if (typeof window.fillVacancyModalById === 'function') {
                            window.fillVacancyModalById(vacancyId);
                        } else {
                            // fallback – заполняем вручную
                            const titleEl = document.getElementById('vacancyModalTitle');
                            const deptEl = document.getElementById('vacancyModalDepartment');
                            const bodyEl = document.getElementById('vacancyModalBody');
                            if (titleEl) titleEl.textContent = vacancy.title;
                            if (deptEl) deptEl.textContent = vacancy.department;
                            if (bodyEl) {
                                const content = document.createElement('div');
                                content.className = 'vacancy-details';
                                if (vacancy.responsibilities && vacancy.responsibilities.length) {
                                    const respDiv = document.createElement('div');
                                    const items = vacancy.responsibilities.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
                                    respDiv.innerHTML = `<h4>Обязанности:</h4><ul>${items}</ul>`;
                                    content.appendChild(respDiv);
                                }
                                if (vacancy.requirements && vacancy.requirements.length) {
                                    const reqDiv = document.createElement('div');
                                    const items = vacancy.requirements.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
                                    reqDiv.innerHTML = `<h4>Требования:</h4><ul>${items}</ul>`;
                                    content.appendChild(reqDiv);
                                }
                                if (vacancy.conditions && vacancy.conditions.length) {
                                    const condDiv = document.createElement('div');
                                    const items = vacancy.conditions.map(c => `<li>${Utils.Sanitizer.escapeHtml(c)}</li>`).join('');
                                    condDiv.innerHTML = `<h4>Условия:</h4><ul>${items}</ul>`;
                                    content.appendChild(condDiv);
                                }
                                bodyEl.replaceChildren(content);
                            }
                        }
                        this.open('vacancy', { id: vacancyId, skipUrlUpdate: true });
                    } else {
                        Logger.WARN(`Вакансия с id ${vacancyId} не найдена`);
                    }
                } else {
                    this.open('vacancy', { skipUrlUpdate: true });
                }
            } else if (modal === 'project') {
                if (id) {
                    const project = window.PROJECTS_DATA?.[id];
                    if (project) {
                        this._populateProjectModal(project);
                        this.currentModalId = id;
                        this.open('project', { id, keepParentModal: false, skipUrlUpdate: true });
                    }
                } else {
                    this.open('project', { skipUrlUpdate: true });
                }
            } else if (modal === 'news') {
                if (id) {
                    const allNews = Object.values(window.NEWS_DATA || {}).flat();
                    const news = allNews.find(n => String(n.id) === String(id));
                    if (news) {
                        this._populateNewsModal(news);
                        this.currentModalId = id;
                        this.open('news', { id, keepParentModal: false, skipUrlUpdate: true });
                    }
                } else {
                    this.open('news', { skipUrlUpdate: true });
                }
            } else if (modal === 'category') {
                if (id) {
                    this.openCategoryByName(id);
                } else {
                    this.open('category', { skipUrlUpdate: true });
                }
            } else if (modal === 'project-category') {
                if (id) {
                    this.openProjectCategoryByName(id);
                } else {
                    this.open('project-category', { skipUrlUpdate: true });
                }
            } else {
                this.open(modal, { skipUrlUpdate: true });
            }
        } else {
            this.closeAll();
            if (window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
            }
        }
    });
}

  open(key, options = {}) {
    const config = this.modals.get(key);
    if (!config) {
      Logger.WARN(`Модалка "${key}" не зарегистрирована`);
      return false;
    }

    const keepParentModal = options.keepParentModal === true;
    const skipStack = options.skipStack === true;
    const skipUrlUpdate = options.skipUrlUpdate === true;

    if (this.activeModal === null && !skipUrlUpdate) {
      let path = window.location.pathname + window.location.search + window.location.hash;

      const prefixMap = {
        'news': '/news',
        'project': '/projects',
        'category': '/category',
        'project-category': '/project-category'
      };
      const baseMap = {
        'news': '/news',
        'project': '/projects',
        'category': '/news',
        'project-category': '/projects'
      };

      const prefix = prefixMap[key];
      if (prefix && path.startsWith(prefix + '/')) {
        path = baseMap[key];
      }

      if (key === 'proposal') {
        path = '/proposal';
      } else if (key === 'feedback') {
        path = '/feedback';
      } else if (key === 'vacancy') {
        // Для вакансий базовый путь — /vacancies, но мы оставляем /vacancy, чтобы URL был /vacancy/123
        // Ничего не меняем
      }

      this.originalPath = path;
    }

    if (this.activeModal && this.activeModal !== key) {
      if (!keepParentModal && !skipStack) {
        this.close(this.activeModal);
      } else if (keepParentModal) {
        if (!skipStack) {
          this.activeModalStack.push(this.activeModal);
        }
      }
    }

    if (!keepParentModal && !skipStack) {
      this.activeModalStack = [];
      this.activeModal = null;
    }

    const overlay = document.getElementById(config.overlayId);
    if (!overlay) return false;

    if (keepParentModal) {
      document.body.appendChild(overlay);
    }

    this.activeModal = key;

    if (!skipStack) {
      ScrollManager.lock();
    }

    if (this._openTimeout) clearTimeout(this._openTimeout);
    this._openTimeout = setTimeout(() => {
      this._openTimeout = null;
      overlay.classList.add('active');
      this._initFocusTrap(overlay);
      if (config.onOpen) config.onOpen(overlay);
      if (options.onOpen) options.onOpen(overlay);
      if (window.Services?.eventBus) {
        window.Services.eventBus.emit('modal:opened', { key, overlay });
      }

      if (!skipUrlUpdate) {
        if (key === 'project' || key === 'news' || key === 'category' || key === 'project-category' || key === 'feedback' || key === 'proposal' || key === 'vacancy') {
          if (key === 'feedback' || key === 'proposal') {
            this._updateUrl(key);
          } else {
            const id = options.id || this.currentModalId || this.currentCategory || this.currentProjectCategory;
            if (id) {
              this._updateUrl(key, id);
            }
          }
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

    if (key === 'project' || key === 'news' || key === 'category' || key === 'project-category' || key === 'vacancy') {
        this.currentModalId = null;
        this.currentCategory = null;
        this.currentProjectCategory = null;
    }

    const previousModal = this.activeModalStack.length > 0 ? this.activeModalStack.pop() : null;
    if (previousModal) {
        const parentId = this._getParentId(previousModal);
        if (parentId) {
            let basePath = `/${previousModal}`;
            if (previousModal === 'news' || previousModal === 'project' || previousModal === 'vacancy') {
                basePath += '/';
            }
            window.history.replaceState({ modal: previousModal, id: parentId }, '', basePath);
        } else {
            if (this.originalPath) {
                window.history.replaceState({}, '', this.originalPath);
            } else {
                window.history.replaceState({}, '', '/');
            }
        }

        ScrollManager.unlock();
        this.open(previousModal, { keepParentModal: false, skipStack: true, skipUrlUpdate: true });
        this.activeModal = previousModal;
    } else {
        if (this.originalPath) {
            window.history.replaceState({}, '', this.originalPath);
            this.originalPath = null;
        } else {
            window.history.replaceState({}, '', '/');
        }

        if ((key === 'project' || key === 'project-category') && 
            typeof window.initProjectsPage === 'function' && !window._projectsPageInitialized) {
            setTimeout(() => {
                window.initProjectsPage();
            }, 50);
        }

        ScrollManager.unlock();
        this.activeModal = null;
    }

    if (config.onClose) {
        config.onClose(overlay);
    }
    if (window.Services?.eventBus) {
        window.Services.eventBus.emit('modal:closed', { key });
    }

    // ===== ДОБАВЛЕНО: снятие фокуса =====
    if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
    }

    return true;
  }

  _getParentId(modalKey) {
    if (modalKey === 'category') return this.currentCategory;
    if (modalKey === 'project-category') return this.currentProjectCategory;
    if (modalKey === 'news') return this.currentModalId;
    if (modalKey === 'project') return this.currentModalId;
    if (modalKey === 'vacancy') return this.currentModalId;
    return null;
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

    if (this._categoryRetryTimer) clearTimeout(this._categoryRetryTimer);
    if (this._projectCategoryRetryTimer) clearTimeout(this._projectCategoryRetryTimer);
    if (this._openTimeout) clearTimeout(this._openTimeout);
    if (this._openFromUrlTimeout) clearTimeout(this._openFromUrlTimeout);

    this._categoryRetryTimer = null;
    this._projectCategoryRetryTimer = null;
    this._openTimeout = null;
    this._openFromUrlTimeout = null;

    this.modals.clear();
    this.activeModal = null;
    this.activeModalStack = [];
    this.currentModalId = null;
    this.currentCategory = null;
    this.currentProjectCategory = null;
    this.originalPath = null;
    this._handlersInitialized = false;
    window.removeEventListener('popstate', this._popstateHandler);
  }
}

const modalManager = new ModalManager();
window.modalManager = modalManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModalManager, modalManager };
}