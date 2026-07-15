/**
 * Инициализация страницы проектов – без класса ProjectRenderer
 * ООО "Волга-Днепр Инжиниринг"
 */

// Хранилище для обработчиков
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
  if (window.PROJECTS_DATA && typeof window.ProjectRenderer !== 'undefined') {
    _projectsPageHandlers.renderer = new window.ProjectRenderer(window.PROJECTS_DATA);
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

// ========== ГАЛЕРЕЯ ПРОЕКТОВ (с поддержкой свайпа и предзагрузкой) ==========

if (!window._galleryImageCache) {
  window._galleryImageCache = {};
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

  const cache = window._galleryImageCache;

  function preloadAllImages() {
    images.forEach(src => {
      if (!cache[src]) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        cache[src] = img;
      }
    });
  }

  setTimeout(preloadAllImages, 50);

  const firstSrc = images[0];
  if (firstSrc && !document.querySelector(`link[href="${firstSrc}"]`)) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = firstSrc;
    document.head.appendChild(link);
  }

  let currentIndex = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;
  let isTransitioning = false;

  function updateMainImage(index) {
    const src = images[index];
    if (!src) return;

    const cachedImg = cache[src];
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      newMainImage.src = src;
    } else {
      newMainImage.src = src;
      if (!cachedImg) {
        const img = new Image();
        img.src = src;
        cache[src] = img;
      }
    }
    const indicators = newContainer.querySelectorAll('.gallery-indicator');
    indicators.forEach((ind, i) => ind.classList.toggle('active', i === index));
  }

  function preloadAdjacent(index) {
    const prev = (index - 1 + images.length) % images.length;
    const next = (index + 1) % images.length;
    [prev, next].forEach(i => {
      const src = images[i];
      if (!cache[src]) {
        const img = new Image();
        img.src = src;
        cache[src] = img;
      }
    });
  }

  function navigate(direction) {
    if (isTransitioning) return;
    isTransitioning = true;
    const newIndex = (currentIndex + direction + images.length) % images.length;
    currentIndex = newIndex;
    updateMainImage(currentIndex);
    preloadAdjacent(currentIndex);
    setTimeout(() => { isTransitioning = false; }, 200);
  }

  function openLightbox() {
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    if (!lightboxOverlay || !lightboxImage) return;

    let lbCurrentIndex = currentIndex;
    let lbTouchStartX = 0;
    let lbTouchStartY = 0;
    let lbIsSwiping = false;

    function updateLightboxImage(index) {
      const src = images[index];
      const cached = cache[src];
      if (cached && cached.complete && cached.naturalWidth > 0) {
        lightboxImage.src = src;
      } else {
        lightboxImage.src = src;
        if (!cache[src]) {
          const img = new Image();
          img.src = src;
          cache[src] = img;
        }
      }
      const indicators = document.getElementById('lightboxIndicators');
      if (indicators) {
        indicators.querySelectorAll('.lightbox-indicator').forEach((el, i) => {
          el.classList.toggle('active', i === index);
        });
      }
    }

    function navigateLightbox(direction) {
      lbCurrentIndex = (lbCurrentIndex + direction + images.length) % images.length;
      updateLightboxImage(lbCurrentIndex);
    }

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
        dot.className = 'lightbox-indicator' + (idx === lbCurrentIndex ? ' active' : '');
        dot.setAttribute('aria-label', `Изображение ${idx + 1}`);
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          lbCurrentIndex = idx;
          updateLightboxImage(lbCurrentIndex);
        });
        indicatorsContainer.appendChild(dot);
      });
    }

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
    const showNav = images.length > 1;
    prevBtn.style.display = showNav ? 'flex' : 'none';
    nextBtn.style.display = showNav ? 'flex' : 'none';

    const prevHandler = () => navigateLightbox(-1);
    const nextHandler = () => navigateLightbox(1);
    prevBtn.onclick = prevHandler;
    nextBtn.onclick = nextHandler;

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
        if (deltaX > 0) navigateLightbox(-1);
        else navigateLightbox(1);
        lbIsSwiping = true;
      }
      lbTouchStartX = 0;
      lbTouchStartY = 0;
    }

    const lbContent = lightboxOverlay.querySelector('.lightbox-content');
    lbContent.removeEventListener('touchstart', lbHandleTouchStart);
    lbContent.removeEventListener('touchmove', lbHandleTouchMove);
    lbContent.removeEventListener('touchend', lbHandleTouchEnd);
    lbContent.addEventListener('touchstart', lbHandleTouchStart, { passive: true });
    lbContent.addEventListener('touchmove', lbHandleTouchMove, { passive: true });
    lbContent.addEventListener('touchend', lbHandleTouchEnd, { passive: true });

    updateLightboxImage(lbCurrentIndex);
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
        lbContent.removeEventListener('touchstart', lbHandleTouchStart);
        lbContent.removeEventListener('touchmove', lbHandleTouchMove);
        lbContent.removeEventListener('touchend', lbHandleTouchEnd);
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
      if (deltaX > 0) navigate(-1);
      else navigate(1);
      isSwiping = true;
    }
    touchStartX = 0;
    touchStartY = 0;
  }

  newMainImage.addEventListener('click', function(e) {
    if (isSwiping) {
      isSwiping = false;
      return;
    }
    openLightbox();
  });

  let wrapper = newContainer.querySelector('.gallery-image-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'gallery-image-wrapper';
    newContainer.appendChild(wrapper);
  }
  if (!wrapper.contains(newMainImage)) {
    wrapper.appendChild(newMainImage);
  }

  wrapper.removeEventListener('touchstart', handleTouchStart);
  wrapper.removeEventListener('touchmove', handleTouchMove);
  wrapper.removeEventListener('touchend', handleTouchEnd);
  wrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: true });
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: true });

  if (images.length === 1) {
    updateMainImage(0);
    return;
  }

  const prevBtn = createNavButton('gallery-nav gallery-nav-prev', 'Предыдущее изображение', 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z');
  prevBtn.addEventListener('click', () => navigate(-1));
  newContainer.appendChild(prevBtn);

  const nextBtn = createNavButton('gallery-nav gallery-nav-next', 'Следующее изображение', 'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z');
  nextBtn.addEventListener('click', () => navigate(1));
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
      preloadAdjacent(currentIndex);
    });
    indicatorsContainer.appendChild(indicator);
  });
  newContainer.appendChild(indicatorsContainer);

  updateMainImage(0);
  preloadAdjacent(0);

  newMainImage.fetchPriority = 'high';
  newMainImage.decoding = 'async';
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

// Экспорт функций в глобальную область
window.initProjectsPage = initProjectsPage;
window.destroyProjectsPage = destroyProjectsPage;
window.initProjectGallery = initProjectGallery;