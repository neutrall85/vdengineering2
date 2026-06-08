// ------------------------------------------------------------
//  ProjectRenderer – рендеринг карточек проектов
// ------------------------------------------------------------
class ProjectRenderer {
  constructor(PROJECTS_DATA) {
    // Нормализация: добавляем id из ключа объекта
    this.PROJECTS_DATA = {};
    Object.entries(PROJECTS_DATA).forEach(([id, project]) => {
      this.PROJECTS_DATA[id] = { ...project, id: parseInt(id, 10) };
    });
    this.loaded = false;
    this.cardStaggerMs = window.CONFIG?.ANIMATION?.CARD_STAGGER_MS || 50;
    this.imageObserver = null;
  }

  render(container) {
    if (!container) {
      Logger?.WARN('ProjectRenderer: контейнер не найден');
      return;
    }

    const projectsList = Object.values(this.PROJECTS_DATA);
    if (projectsList.length === 0) {
      container.innerHTML = '<p class="no-projects">Проекты временно недоступны</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    projectsList.forEach((project, index) => {
      const card = this._createProjectCard(project, index);
      fragment.appendChild(card);
    });

    container.replaceChildren(fragment);
    this._lazyLoadImages(container);

    // Регистрируем новые карточки в AnimationManager (однократная анимация)
    if (typeof animationManager !== 'undefined' && animationManager.observeNewElements) {
      animationManager.observeNewElements(container);
    } else if (window.animationManager?.observeNewElements) {
      window.animationManager.observeNewElements(container);
    } else {
      Logger?.WARN('AnimationManager не доступен, анимация скролла может не работать');
    }

    this.loaded = true;
    Logger?.INFO(`ProjectRenderer: отрендерено ${projectsList.length} проектов`);
  }

  _createProjectCard(project, index) {
    const sanitizer = window.Utils?.Sanitizer;
    const safeTitle = sanitizer ? sanitizer.escapeHtml(project.title) : project.title;
    const safeCategory = sanitizer ? sanitizer.escapeHtml(project.category) : project.category;
    const previewImage = (project.images && project.images[0]) || 'assets/images/placeholder.jpg';

    const additionalDesc = project.shortDescription 
      ? (sanitizer ? sanitizer.escapeHtml(project.shortDescription) : project.shortDescription)
      : '';

    const article = document.createElement('article');
    article.className = 'project-card card animate-on-scroll fade-up';
    article.style.animationDelay = `${index * this.cardStaggerMs}ms`;

    // Контейнер изображения
    const imgContainer = document.createElement('div');
    imgContainer.className = 'project-image-container';
    const img = document.createElement('img');
    img.setAttribute('data-src', previewImage);
    img.alt = safeTitle;
    img.classList.add('project-img-cover');
    img.addEventListener('error', () => {
      img.src = 'assets/images/placeholder.jpg';
    });
    imgContainer.appendChild(img);

    // Блок контента
    const contentDiv = document.createElement('div');
    contentDiv.className = 'project-content-padding';

    const categorySpan = document.createElement('span');
    categorySpan.className = 'project-category-badge';
    categorySpan.textContent = safeCategory;

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = safeTitle;

    let additionalDescElem = null;
    if (additionalDesc) {
      additionalDescElem = document.createElement('p');
      additionalDescElem.className = 'card-desc';
      additionalDescElem.textContent = additionalDesc;
    }

    const btn = document.createElement('button');
    btn.className = 'news-card-link';
    btn.setAttribute('data-modal-open', 'project');
    btn.setAttribute('data-project-id', project.id);
    btn.innerHTML = 'Подробнее <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';

    contentDiv.appendChild(categorySpan);
    contentDiv.appendChild(title);
    if (additionalDescElem) contentDiv.appendChild(additionalDescElem);
    contentDiv.appendChild(btn);

    article.appendChild(imgContainer);
    article.appendChild(contentDiv);

    return article;
  }

  _lazyLoadImages(container) {
    const images = container.querySelectorAll('.project-card img[data-src]');
    if (!images.length) return;

    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src');
          if (src && !img.src) {
            img.src = src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          this.imageObserver.unobserve(img);
        }
      });
    }, { threshold: 0.1, rootMargin: '100px' });

    images.forEach(img => this.imageObserver.observe(img));
  }

  destroy() {
    if (this.imageObserver) {
      this.imageObserver.disconnect();
      this.imageObserver = null;
    }
    this.loaded = false;
  }
}

// ------------------------------------------------------------
//  Инициализация и очистка страницы проектов
// ------------------------------------------------------------
const _projectsPageHandlers = {
  requestQuoteHandler: null,
  renderer: null
};

function initProjectsPage() {
  if (window._projectsPageInitialized) return;
  window._projectsPageInitialized = true;

  const gridContainer = document.querySelector('.projects-grid');
  if (!gridContainer) {
    Logger?.WARN('Контейнер .projects-grid не найден');
    return;
  }

  // Очищаем статический HTML
  gridContainer.innerHTML = '';

  if (window.PROJECTS_DATA) {
    _projectsPageHandlers.renderer = new ProjectRenderer(window.PROJECTS_DATA);
    _projectsPageHandlers.renderer.render(gridContainer);
  } else {
    gridContainer.innerHTML = '<p class="no-projects">Данные проектов не загружены</p>';
  }

  const requestQuoteBtn = document.getElementById('projectsRequestQuoteBtn');
  if (requestQuoteBtn) {
    _projectsPageHandlers.requestQuoteHandler = handleRequestQuote;
    requestQuoteBtn.addEventListener('click', _projectsPageHandlers.requestQuoteHandler);
  }

  Logger?.INFO('ProjectsPage инициализирована (динамический рендеринг)');
}

function handleRequestQuote() {
  const fakeTrigger = document.createElement('button');
  fakeTrigger.setAttribute('data-modal-open', 'application');
  document.body.appendChild(fakeTrigger);
  fakeTrigger.click();
  document.body.removeChild(fakeTrigger);
}

function openProjectModal(title, details, images, category) {
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
  modalTitle.textContent = sanitizer ? sanitizer.escapeHtml(title) : title;
  modalCategory.textContent = sanitizer ? sanitizer.escapeHtml(category) : category;

  modalContent.replaceChildren();
  const ul = document.createElement('ul');
  ul.className = 'modal-list-ul';
  details.forEach(item => {
    const li = document.createElement('li');
    li.className = 'modal-list-li';
    li.textContent = sanitizer ? sanitizer.escapeHtml(item) : item;
    ul.appendChild(li);
  });
  modalContent.appendChild(ul);

  initProjectGallery(images, modalImageContainer, modalImage);

  if (typeof modalManager !== 'undefined') {
    modalManager.open('project');
  } else {
    Logger.ERROR('ModalManager не доступен');
  }
}

function initProjectGallery(images, container, mainImage) {
  const sanitizer = window.Utils?.Sanitizer;
  if (container) container.replaceChildren();

  const newMainImage = mainImage || document.getElementById('projectModalImage');
  const newContainer = container || document.getElementById('projectModalImageContainer');

  if (!newMainImage || !newContainer) {
    Logger.WARN('Элементы галереи проекта не найдены');
    return;
  }

  if (!images || images.length === 0) {
    newMainImage.src = 'assets/images/placeholder.jpg';
    newMainImage.alt = 'Изображение проекта';
    return;
  }

  let currentIndex = 0;

  function updateMainImage(index) {
    const safeUrl = sanitizer && sanitizer.isValidUrl
      ? (sanitizer.isValidUrl(images[index]) ? images[index] : 'assets/images/placeholder.jpg')
      : images[index];
    newMainImage.src = safeUrl;
    newMainImage.alt = `Изображение ${index + 1} из ${images.length}`;
  }

  function openLightbox() {
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    if (!lightboxOverlay || !lightboxImage) return;

    let currentIndexLocal = currentIndex;

    function updateLightboxImage(index) {
      const safeUrl = sanitizer && sanitizer.isValidUrl
        ? (sanitizer.isValidUrl(images[index]) ? images[index] : 'assets/images/placeholder.jpg')
        : images[index];
      lightboxImage.src = safeUrl;
      lightboxImage.alt = `Изображение ${index + 1} из ${images.length}`;

      const lightboxIndicators = document.getElementById('lightboxIndicators');
      if (lightboxIndicators) {
        lightboxIndicators.querySelectorAll('.lightbox-indicator').forEach((ind, i) => {
          ind.classList.toggle('active', i === index);
        });
      }
    }

    const lightboxIndicators = document.getElementById('lightboxIndicators');
    if (lightboxIndicators) {
      lightboxIndicators.replaceChildren();
      if (images.length > 1) {
        images.forEach((_, index) => {
          const indicator = document.createElement('button');
          indicator.className = 'lightbox-indicator' + (index === currentIndexLocal ? ' active' : '');
          indicator.setAttribute('aria-label', `Изображение ${index + 1}`);
          indicator.addEventListener('click', () => {
            currentIndexLocal = index;
            updateLightboxImage(currentIndexLocal);
          });
          lightboxIndicators.appendChild(indicator);
        });
      }
    }

    function navigate(direction) {
      currentIndexLocal = (currentIndexLocal + direction + images.length) % images.length;
      updateLightboxImage(currentIndexLocal);
    }

    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');

    if (prevBtn) {
      prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
      prevBtn.onclick = () => navigate(-1);
    }
    if (nextBtn) {
      nextBtn.style.display = images.length > 1 ? 'flex' : 'none';
      nextBtn.onclick = () => navigate(1);
    }

    updateLightboxImage(currentIndexLocal);
    lightboxOverlay.classList.add('active');

    if (window.ScrollManager && !ScrollManager.isLocked()) {
      ScrollManager.lock();
    }

    const closeBtn = document.getElementById('lightboxCloseBtn');
    const closeHandler = () => {
      lightboxOverlay.classList.remove('active');
      if (window.ScrollManager) ScrollManager.unlock();
      setTimeout(() => {
        lightboxImage.src = '';
      }, 300);
      if (prevBtn) prevBtn.onclick = null;
      if (nextBtn) nextBtn.onclick = null;
      if (closeBtn) closeBtn.onclick = null;
      lightboxOverlay.onclick = null;
    };

    if (closeBtn) closeBtn.onclick = closeHandler;
    lightboxOverlay.onclick = (e) => {
      if (e.target === lightboxOverlay) closeHandler();
    };

    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        closeHandler();
        document.removeEventListener('keydown', escapeHandler);
      }
    });
  }

  newMainImage.style.cursor = 'zoom-in';
  newMainImage.addEventListener('click', openLightbox);

  if (images.length === 1) {
    updateMainImage(0);
    return;
  }

  const prevBtn = createNavButton('gallery-nav gallery-nav-prev', 'Предыдущее изображение', 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z');
  prevBtn.addEventListener('click', () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateMainImage(currentIndex);
    const indicators = newContainer.querySelectorAll('.gallery-indicator');
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === currentIndex));
  });
  newContainer.appendChild(prevBtn);

  const imageWrapper = document.createElement('div');
  imageWrapper.className = 'gallery-image-wrapper';
  newContainer.appendChild(imageWrapper);
  imageWrapper.appendChild(newMainImage);

  const nextBtn = createNavButton('gallery-nav gallery-nav-next', 'Следующее изображение', 'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z');
  nextBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % images.length;
    updateMainImage(currentIndex);
    const indicators = newContainer.querySelectorAll('.gallery-indicator');
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === currentIndex));
  });
  newContainer.appendChild(nextBtn);

  const indicatorsContainer = document.createElement('div');
  indicatorsContainer.className = 'gallery-indicators';
  images.forEach((_, index) => {
    const indicator = document.createElement('button');
    indicator.className = 'gallery-indicator' + (index === 0 ? ' active' : '');
    indicator.setAttribute('aria-label', `Изображение ${index + 1}`);
    indicator.addEventListener('click', () => {
      currentIndex = index;
      updateMainImage(currentIndex);
      indicatorsContainer.querySelectorAll('.gallery-indicator').forEach((ind, i) => {
        ind.classList.toggle('active', i === index);
      });
    });
    indicatorsContainer.appendChild(indicator);
  });
  newContainer.appendChild(indicatorsContainer);

  updateMainImage(0);
}

function createNavButton(className, ariaLabel, pathData) {
  const btn = document.createElement('button');
  btn.className = className;
  btn.setAttribute('aria-label', ariaLabel);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);
  btn.appendChild(svg);
  return btn;
}

function destroyProjectsPage() {
  const requestQuoteBtn = document.getElementById('projectsRequestQuoteBtn');
  if (requestQuoteBtn && _projectsPageHandlers.requestQuoteHandler) {
    requestQuoteBtn.removeEventListener('click', _projectsPageHandlers.requestQuoteHandler);
  }
  if (_projectsPageHandlers.renderer) {
    _projectsPageHandlers.renderer.destroy();
    _projectsPageHandlers.renderer = null;
  }
  window._projectsPageInitialized = false;

  // Удаляем глобальные функции для предотвращения утечек памяти
  delete window.openProjectModal;
  delete window.initProjectGallery;
}

window.initProjectsPage = initProjectsPage;
window.destroyProjectsPage = destroyProjectsPage;
window.openProjectModal = openProjectModal;
window.initProjectGallery = initProjectGallery;