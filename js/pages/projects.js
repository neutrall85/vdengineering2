/**
 * ProjectRenderer – рендеринг карточек проектов
 * ООО "Волга-Днепр Инжиниринг"
 */
class ProjectRenderer {
  constructor(PROJECTS_DATA) {
    this.PROJECTS_DATA = {};
    Object.entries(PROJECTS_DATA).forEach(([id, project]) => {
      this.PROJECTS_DATA[id] = { ...project, id: id };
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

    if (typeof animationManager !== 'undefined' && animationManager.observeNewElements) {
      animationManager.observeNewElements(container);
    } else if (window.animationManager?.observeNewElements) {
      window.animationManager.observeNewElements(container);
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
    article.dataset.modalOpen = 'project';
    article.dataset.projectId = project.id;

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

// ========== Инициализация страницы проектов ==========
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

  gridContainer.innerHTML = '';
  if (window.PROJECTS_DATA) {
    _projectsPageHandlers.renderer = new ProjectRenderer(window.PROJECTS_DATA);
    _projectsPageHandlers.renderer.render(gridContainer);
  } else {
    gridContainer.innerHTML = '<p class="no-projects">Данные проектов не загружены</p>';
  }

  const requestQuoteBtn = document.getElementById('projectsRequestQuoteBtn');
  if (requestQuoteBtn) {
    _projectsPageHandlers.requestQuoteHandler = () => {
      const fakeTrigger = document.createElement('button');
      fakeTrigger.setAttribute('data-modal-open', 'application');
      document.body.appendChild(fakeTrigger);
      fakeTrigger.click();
      document.body.removeChild(fakeTrigger);
    };
    requestQuoteBtn.addEventListener('click', _projectsPageHandlers.requestQuoteHandler);
  }

  Logger.INFO('ProjectsPage инициализирована (динамический рендеринг)');
}

// ========== ГАЛЕРЕЯ ПРОЕКТОВ (с поддержкой свайпа) ==========
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
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  // ---------- Основная галерея (модалка) ----------
  function updateMainImage(index) {
    const safeUrl = sanitizer && sanitizer.isValidUrl
      ? (sanitizer.isValidUrl(images[index]) ? images[index] : 'assets/images/placeholder.jpg')
      : images[index];
    newMainImage.src = safeUrl;
    newMainImage.alt = `Изображение ${index + 1} из ${images.length}`;
  }

  // ---------- Лайтбокс ----------
  function openLightbox() {
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    if (!lightboxOverlay || !lightboxImage) return;

    let lightboxCurrentIndex = currentIndex;
    let lbTouchStartX = 0;
    let lbTouchStartY = 0;
    let lbIsSwiping = false;

    function updateLightboxImage(index) {
      const safeUrl = sanitizer && sanitizer.isValidUrl
        ? (sanitizer.isValidUrl(images[index]) ? images[index] : 'assets/images/placeholder.jpg')
        : images[index];
      lightboxImage.src = safeUrl;
      lightboxImage.alt = `Изображение ${index + 1} из ${images.length}`;
      // Обновляем индикаторы
      const indicators = document.getElementById('lightboxIndicators');
      if (indicators) {
        indicators.querySelectorAll('.lightbox-indicator').forEach((el, i) => {
          el.classList.toggle('active', i === index);
        });
      }
    }

    function navigateLightbox(direction) {
      lightboxCurrentIndex = (lightboxCurrentIndex + direction + images.length) % images.length;
      updateLightboxImage(lightboxCurrentIndex);
    }

    // Создаём индикаторы, если их нет
    let indicatorsContainer = document.getElementById('lightboxIndicators');
    if (!indicatorsContainer) {
      indicatorsContainer = document.createElement('div');
      indicatorsContainer.className = 'lightbox-indicators';
      indicatorsContainer.id = 'lightboxIndicators';
      lightboxOverlay.querySelector('.lightbox-content').appendChild(indicatorsContainer);
    }
    indicatorsContainer.replaceChildren();
    if (images.length > 1) {
      images.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.className = 'lightbox-indicator' + (idx === lightboxCurrentIndex ? ' active' : '');
        dot.setAttribute('aria-label', `Изображение ${idx + 1}`);
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          lightboxCurrentIndex = idx;
          updateLightboxImage(lightboxCurrentIndex);
        });
        indicatorsContainer.appendChild(dot);
      });
    }

    // Навигационные кнопки (для десктопа)
    let prevBtn = document.getElementById('lightboxPrevBtn');
    let nextBtn = document.getElementById('lightboxNextBtn');
    if (!prevBtn) {
      prevBtn = createNavButton('lightbox-nav lightbox-prev', 'Предыдущее', 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z');
      prevBtn.id = 'lightboxPrevBtn';
      lightboxOverlay.querySelector('.lightbox-content').appendChild(prevBtn);
    }
    if (!nextBtn) {
      nextBtn = createNavButton('lightbox-nav lightbox-next', 'Следующее', 'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z');
      nextBtn.id = 'lightboxNextBtn';
      lightboxOverlay.querySelector('.lightbox-content').appendChild(nextBtn);
    }
    // Обновляем видимость кнопок
    const showNav = images.length > 1;
    prevBtn.style.display = showNav ? 'flex' : 'none';
    nextBtn.style.display = showNav ? 'flex' : 'none';

    // Обработчики кликов по кнопкам
    const prevHandler = () => navigateLightbox(-1);
    const nextHandler = () => navigateLightbox(1);
    prevBtn.onclick = prevHandler;
    nextBtn.onclick = nextHandler;

    // ---------- СВАЙП В ЛАЙТБОКСЕ (исправлено passive) ----------
    function lbHandleTouchStart(e) {
      const touch = e.touches[0];
      lbTouchStartX = touch.clientX;
      lbTouchStartY = touch.clientY;
      lbIsSwiping = false;
    }

    function lbHandleTouchMove(e) {
      if (!lbTouchStartX) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - lbTouchStartX;
      const deltaY = touch.clientY - lbTouchStartY;
      if (Math.abs(deltaX) > 10) {
        lbIsSwiping = true;
        e.preventDefault(); // предотвращаем скролл страницы
      }
    }

    function lbHandleTouchEnd(e) {
      if (!lbTouchStartX) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - lbTouchStartX;
      const deltaY = touch.clientY - lbTouchStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      if (images.length > 1 && absDeltaX > 50 && absDeltaX > absDeltaY) {
        e.preventDefault();
        if (deltaX > 0) {
          navigateLightbox(-1);
        } else {
          navigateLightbox(1);
        }
        lbIsSwiping = true;
      }

      lbTouchStartX = 0;
      lbTouchStartY = 0;
    }

    // Удаляем старые обработчики, если есть
    const lbContent = lightboxOverlay.querySelector('.lightbox-content');
    lbContent.removeEventListener('touchstart', lbHandleTouchStart);
    lbContent.removeEventListener('touchmove', lbHandleTouchMove);
    lbContent.removeEventListener('touchend', lbHandleTouchEnd);
    // touchstart – passive: true (нет preventDefault), touchmove и touchend – passive: false
    lbContent.addEventListener('touchstart', lbHandleTouchStart, { passive: true });
    lbContent.addEventListener('touchmove', lbHandleTouchMove, { passive: false });
    lbContent.addEventListener('touchend', lbHandleTouchEnd, { passive: false });

    // Открытие лайтбокса
    updateLightboxImage(lightboxCurrentIndex);
    lightboxOverlay.classList.add('active');
    if (window.ScrollManager && !ScrollManager.isLocked()) {
      ScrollManager.lock();
    }

    // Закрытие
    const closeBtn = document.getElementById('lightboxCloseBtn');
    const closeHandler = () => {
      lightboxOverlay.classList.remove('active');
      if (window.ScrollManager) ScrollManager.unlock();
      setTimeout(() => {
        lightboxImage.src = '';
        // Удаляем обработчики при закрытии
        lbContent.removeEventListener('touchstart', lbHandleTouchStart);
        lbContent.removeEventListener('touchmove', lbHandleTouchMove);
        lbContent.removeEventListener('touchend', lbHandleTouchEnd);
        // Сбрасываем onclick, чтобы не было утечек
        prevBtn.onclick = null;
        nextBtn.onclick = null;
        lightboxOverlay.onclick = null;
        document.removeEventListener('keydown', escapeHandler);
      }, 300);
    };

    if (closeBtn) closeBtn.onclick = closeHandler;
    lightboxOverlay.onclick = (e) => {
      if (e.target === lightboxOverlay && !lbIsSwiping) {
        closeHandler();
      }
    };

    const escapeHandler = (e) => {
      if (e.key === 'Escape') closeHandler();
    };
    document.addEventListener('keydown', escapeHandler);
  }

  // ---------- Обработчики для основной галереи (свайп в модалке, исправлено passive) ----------
  function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isSwiping = false;
  }

  function handleTouchMove(e) {
    if (!touchStartX) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) > 10) {
      isSwiping = true;
      e.preventDefault();
    }
  }

  function handleTouchEnd(e) {
    if (!touchStartX) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (images.length > 1 && absDeltaX > 50 && absDeltaX > absDeltaY) {
      e.preventDefault();
      if (deltaX > 0) {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
      } else {
        currentIndex = (currentIndex + 1) % images.length;
      }
      updateMainImage(currentIndex);
      const indicators = newContainer.querySelectorAll('.gallery-indicator');
      indicators.forEach((ind, i) => ind.classList.toggle('active', i === currentIndex));
      isSwiping = true;
    }

    touchStartX = 0;
    touchStartY = 0;
  }

  // Клик по изображению для открытия лайтбокса (игнорируем, если был свайп)
  newMainImage.addEventListener('click', function(e) {
    if (isSwiping) {
      isSwiping = false;
      return;
    }
    openLightbox();
  });

  // Создаём обёртку для изображения, если её нет
  let wrapper = newContainer.querySelector('.gallery-image-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'gallery-image-wrapper';
    newContainer.appendChild(wrapper);
  }
  if (!wrapper.contains(newMainImage)) {
    wrapper.appendChild(newMainImage);
  }

  // Обработчики свайпа для основной галереи
  wrapper.removeEventListener('touchstart', handleTouchStart);
  wrapper.removeEventListener('touchmove', handleTouchMove);
  wrapper.removeEventListener('touchend', handleTouchEnd);
  wrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: false });
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: false });

  // ---------- Кнопки и индикаторы для основной галереи ----------
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
}

window.initProjectsPage = initProjectsPage;
window.destroyProjectsPage = destroyProjectsPage;
window.initProjectGallery = initProjectGallery;