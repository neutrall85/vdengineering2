/**
 * Инициализация страницы проектов – без класса ProjectRenderer
 * ООО "ВД Инжиниринг"
 */

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

if (!window._galleryImageCache) window._galleryImageCache = {};

function _normalizePath(path) {
  if (!path) return '/assets/images/placeholder.jpg';
  if (path.startsWith('/') || path.startsWith('http://') || path.startsWith('https://')) return path;
  return '/' + path;
}

function initProjectGallery(images, container, mainImage) {
  const sanitizer = window.Utils?.Sanitizer;
  if (container) container.replaceChildren();

  const newMainImage = mainImage || document.getElementById('projectModalImage');
  const newContainer = container || document.getElementById('projectModalImageContainer');
  if (!newMainImage || !newContainer) { Logger.WARN('Элементы галереи проекта не найдены'); return; }

  if (!images || images.length === 0) {
    newMainImage.src = '/assets/images/placeholder.jpg';
    newMainImage.alt = 'Изображение проекта';
    return;
  }

  const normalizedImages = images.map(img => _normalizePath(img));
  const cache = window._galleryImageCache;

  function preloadAllImages() {
    normalizedImages.forEach(src => {
      if (!cache[src]) {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        cache[src] = img;
      }
    });
  }
  setTimeout(preloadAllImages, 50);

  const firstSrc = normalizedImages[0];
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
    const src = normalizedImages[index];
    if (!src) return;
    const cachedImg = cache[src];
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      newMainImage.src = src;
    } else {
      newMainImage.src = src;
      if (!cache[src]) {
        const img = new Image();
        img.src = src;
        cache[src] = img;
      }
    }
    newContainer.querySelectorAll('.gallery-indicator').forEach((ind, i) => {
      ind.classList.toggle('active', i === index);
    });
  }

  function preloadAdjacent(index) {
    const prev = (index - 1 + normalizedImages.length) % normalizedImages.length;
    const next = (index + 1) % normalizedImages.length;
    [prev, next].forEach(i => {
      const src = normalizedImages[i];
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
    const newIndex = (currentIndex + direction + normalizedImages.length) % normalizedImages.length;
    currentIndex = newIndex;
    updateMainImage(currentIndex);
    preloadAdjacent(currentIndex);
    setTimeout(() => { isTransitioning = false; }, 200);
  }

  function openLightbox() {
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    if (!lightboxOverlay || !lightboxImage) return;

    if (lightboxOverlay._lbAbortController) lightboxOverlay._lbAbortController.abort();
    const ac = new AbortController();
    const { signal } = ac;
    lightboxOverlay._lbAbortController = ac;

    const oldPrevBtn = document.getElementById('lightboxPrevBtn');
    const oldNextBtn = document.getElementById('lightboxNextBtn');
    const oldIndicators = document.getElementById('lightboxIndicators');
    if (oldPrevBtn) oldPrevBtn.remove();
    if (oldNextBtn) oldNextBtn.remove();
    if (oldIndicators) oldIndicators.remove();

    const hasMultiple = normalizedImages.length > 1;
    let prevBtn = null, nextBtn = null, indicatorsContainer = null;

    if (hasMultiple) {
      prevBtn = document.createElement('button');
      prevBtn.className = 'lightbox-nav lightbox-prev';
      prevBtn.id = 'lightboxPrevBtn';
      prevBtn.setAttribute('aria-label', 'Предыдущее изображение');
      prevBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`;
      prevBtn.addEventListener('click', () => navigateLightbox(-1), { signal });
      lightboxOverlay.querySelector('.lightbox-content').appendChild(prevBtn);

      nextBtn = document.createElement('button');
      nextBtn.className = 'lightbox-nav lightbox-next';
      nextBtn.id = 'lightboxNextBtn';
      nextBtn.setAttribute('aria-label', 'Следующее изображение');
      nextBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>`;
      nextBtn.addEventListener('click', () => navigateLightbox(1), { signal });
      lightboxOverlay.querySelector('.lightbox-content').appendChild(nextBtn);

      indicatorsContainer = document.createElement('div');
      indicatorsContainer.className = 'lightbox-indicators';
      indicatorsContainer.id = 'lightboxIndicators';
      normalizedImages.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.className = 'lightbox-indicator';
        dot.setAttribute('aria-label', `Изображение ${idx + 1}`);
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          lbCurrentIndex = idx;
          updateLightboxImage(lbCurrentIndex);
          indicatorsContainer.querySelectorAll('.lightbox-indicator').forEach((el, i) => {
            el.classList.toggle('active', i === idx);
          });
        }, { signal });
        indicatorsContainer.appendChild(dot);
      });
      lightboxOverlay.querySelector('.lightbox-content').appendChild(indicatorsContainer);
    } else {
      lightboxOverlay.classList.remove('single-image');
    }

    let lbCurrentIndex = currentIndex;
    let lbTouchStartX = 0, lbTouchStartY = 0, lbIsSwiping = false;

    function updateLightboxImage(index) {
      const src = normalizedImages[index];
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
      if (indicatorsContainer) {
        indicatorsContainer.querySelectorAll('.lightbox-indicator').forEach((el, i) => {
          el.classList.toggle('active', i === index);
        });
      }
    }

    function navigateLightbox(direction) {
      lbCurrentIndex = (lbCurrentIndex + direction + normalizedImages.length) % normalizedImages.length;
      updateLightboxImage(lbCurrentIndex);
    }

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
      if (Math.abs(deltaX) > 10) lbIsSwiping = true;
    }
    function lbHandleTouchEnd(e) {
      if (!lbTouchStartX) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - lbTouchStartX;
      const deltaY = touch.clientY - lbTouchStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      if (hasMultiple && absDeltaX > 50 && absDeltaX > absDeltaY) {
        if (deltaX > 0) navigateLightbox(-1);
        else navigateLightbox(1);
        lbIsSwiping = true;
      }
      lbTouchStartX = 0;
      lbTouchStartY = 0;
    }

    const lbContent = lightboxOverlay.querySelector('.lightbox-content');
    lbContent.addEventListener('touchstart', lbHandleTouchStart, { passive: true, signal });
    lbContent.addEventListener('touchmove', lbHandleTouchMove, { passive: true, signal });
    lbContent.addEventListener('touchend', lbHandleTouchEnd, { passive: true, signal });

    updateLightboxImage(lbCurrentIndex);
    lightboxOverlay.classList.add('active');
    if (window.ScrollManager && !ScrollManager.isLocked()) ScrollManager.lock();

    const closeBtn = document.getElementById('lightboxCloseBtn');
    const closeHandler = () => {
      lightboxOverlay.classList.remove('active');
      if (window.ScrollManager) ScrollManager.unlock();
      ac.abort();
      lightboxOverlay._lbAbortController = null;
      setTimeout(() => { lightboxImage.src = ''; }, 300);
    };
    if (closeBtn) closeBtn.addEventListener('click', closeHandler, { signal });
    lightboxOverlay.addEventListener('click', (e) => {
      if (e.target === lightboxOverlay && !lbIsSwiping) closeHandler();
    }, { signal });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeHandler();
    }, { signal });
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
    if (Math.abs(deltaX) > 10) isSwiping = true;
  }
  function handleTouchEnd(e) {
    if (!touchStartX) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    if (normalizedImages.length > 1 && absDeltaX > 50 && absDeltaX > absDeltaY) {
      if (deltaX > 0) navigate(-1);
      else navigate(1);
      isSwiping = true;
    }
    touchStartX = 0;
    touchStartY = 0;
  }

  // [P0-FIX] Все обработчики wrapper подписываются через единый AbortController —
  // повторный вызов initProjectGallery отменяет предыдущие.
  let wrapper = newContainer.querySelector('.gallery-image-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'gallery-image-wrapper';
    newContainer.appendChild(wrapper);
  }
  if (!wrapper.contains(newMainImage)) wrapper.appendChild(newMainImage);

  if (wrapper._galleryAbortController) wrapper._galleryAbortController.abort();
  const galleryAc = new AbortController();
  const gallerySignal = galleryAc.signal;
  wrapper._galleryAbortController = galleryAc;

  wrapper.addEventListener('touchstart', handleTouchStart, { passive: true, signal: gallerySignal });
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: true, signal: gallerySignal });
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: true, signal: gallerySignal });

  newMainImage.addEventListener('click', function () {
    if (isSwiping) { isSwiping = false; return; }
    openLightbox();
  }, { signal: gallerySignal });

  if (normalizedImages.length > 1) {
    const prevBtn = createNavButton('gallery-nav gallery-nav-prev', 'Предыдущее изображение', 'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z');
    prevBtn.addEventListener('click', () => navigate(-1), { signal: gallerySignal });
    newContainer.appendChild(prevBtn);

    const nextBtn = createNavButton('gallery-nav gallery-nav-next', 'Следующее изображение', 'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z');
    nextBtn.addEventListener('click', () => navigate(1), { signal: gallerySignal });
    newContainer.appendChild(nextBtn);

    const indicatorsContainer = document.createElement('div');
    indicatorsContainer.className = 'gallery-indicators';
    normalizedImages.forEach((_, index) => {
      const indicator = document.createElement('button');
      indicator.className = 'gallery-indicator' + (index === 0 ? ' active' : '');
      indicator.setAttribute('aria-label', `Изображение ${index + 1}`);
      indicator.addEventListener('click', () => {
        currentIndex = index;
        updateMainImage(currentIndex);
        preloadAdjacent(currentIndex);
      }, { signal: gallerySignal });
      indicatorsContainer.appendChild(indicator);
    });
    newContainer.appendChild(indicatorsContainer);
  }

  updateMainImage(0);
  if (normalizedImages.length === 1) preloadAdjacent(0);

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

window.initProjectsPage = initProjectsPage;
window.destroyProjectsPage = destroyProjectsPage;
window.initProjectGallery = initProjectGallery;