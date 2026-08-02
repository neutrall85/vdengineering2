/**
 * Инициализация страницы услуг – только подстановка данных и галерея
 * ООО "ВД Инжиниринг"
 */

// Галерея изображений для услуги (с поддержкой лайтбокса)
function initServiceGallery(images) {
  const container = document.getElementById('serviceModalImageContainer');
  const mainImage = document.getElementById('serviceModalImage');
  if (!container || !mainImage) return;

  container.classList.add('hidden');

  if (!images || images.length === 0) {
    mainImage.src = 'assets/images/placeholder.jpg';
    mainImage.alt = 'Изображение услуги';
    mainImage.classList.remove('zoom-in');
    mainImage.classList.add('cursor-default');
    return;
  }

  container.classList.remove('hidden');
  container.classList.add('flex');
  container.innerHTML = '';
  container.appendChild(mainImage);

  let currentIndex = 0;

  function updateMainImage(index) {
    mainImage.src = images[index];
    mainImage.alt = `Изображение ${index + 1} из ${images.length}`;
  }

  // Лайтбокс
  let lightboxOpen = false;
  let lightboxCurrentIndex = currentIndex;

  function openLightbox() {
    if (lightboxOpen) return;
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    if (!lightboxOverlay || !lightboxImage) return;

    lightboxCurrentIndex = currentIndex;
    updateLightboxImage(lightboxCurrentIndex);
    lightboxOverlay.classList.add('active');
    lightboxOpen = true;

    if (window.ScrollManager) ScrollManager.lock();

    const closeLightbox = () => {
      lightboxOverlay.classList.remove('active');
      if (window.ScrollManager) ScrollManager.unlock();
      lightboxOpen = false;
      removeLightboxHandlers();
    };

    function updateLightboxImage(index) {
      lightboxImage.src = images[index];
      lightboxImage.alt = `Изображение ${index + 1} из ${images.length}`;
      updateLightboxIndicators(index);
    }

    function updateLightboxIndicators(index) {
      const indicatorsContainer = document.getElementById('lightboxIndicators');
      if (!indicatorsContainer) return;
      const indicators = indicatorsContainer.querySelectorAll('.lightbox-indicator');
      indicators.forEach((ind, i) => {
        ind.classList.toggle('active', i === index);
      });
    }

    function navigate(direction) {
      lightboxCurrentIndex = (lightboxCurrentIndex + direction + images.length) % images.length;
      updateLightboxImage(lightboxCurrentIndex);
    }

    const prevBtn = document.getElementById('lightboxPrevBtn');
    const nextBtn = document.getElementById('lightboxNextBtn');
    const closeBtn = document.getElementById('lightboxCloseBtn');

    const prevHandler = () => navigate(-1);
    const nextHandler = () => navigate(1);
    const closeHandler = closeLightbox;
    const overlayClickHandler = (e) => {
      if (e.target === lightboxOverlay) closeLightbox();
    };
    const keydownHandler = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigate(-1);
      if (e.key === 'ArrowRight') navigate(1);
    };

    if (prevBtn) prevBtn.addEventListener('click', prevHandler);
    if (nextBtn) nextBtn.addEventListener('click', nextHandler);
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);
    lightboxOverlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);

    function removeLightboxHandlers() {
      if (prevBtn) prevBtn.removeEventListener('click', prevHandler);
      if (nextBtn) nextBtn.removeEventListener('click', nextHandler);
      if (closeBtn) closeBtn.removeEventListener('click', closeHandler);
      lightboxOverlay.removeEventListener('click', overlayClickHandler);
      document.removeEventListener('keydown', keydownHandler);
    }

    lightboxOverlay._closeLightboxHandler = closeLightbox;
    lightboxOverlay._removeHandlers = removeLightboxHandlers;
  }

  mainImage.classList.add('zoom-in');
  mainImage.onclick = openLightbox;

  if (images.length === 1) {
    updateMainImage(0);
    return;
  }

  const prevBtn = document.createElement('button');
  prevBtn.className = 'gallery-nav gallery-nav-prev';
  prevBtn.setAttribute('aria-label', 'Предыдущее изображение');
  prevBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
  prevBtn.onclick = () => {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
    updateMainImage(currentIndex);
    updateIndicators();
  };

  const nextBtn = document.createElement('button');
  nextBtn.className = 'gallery-nav gallery-nav-next';
  nextBtn.setAttribute('aria-label', 'Следующее изображение');
  nextBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>';
  nextBtn.onclick = () => {
    currentIndex = (currentIndex + 1) % images.length;
    updateMainImage(currentIndex);
    updateIndicators();
  };

  const indicatorsContainer = document.createElement('div');
  indicatorsContainer.className = 'gallery-indicators';

  function updateIndicators() {
    const indicators = indicatorsContainer.querySelectorAll('.gallery-indicator');
    indicators.forEach((ind, i) => {
      ind.classList.toggle('active', i === currentIndex);
    });
  }

  images.forEach((_, idx) => {
    const indicator = document.createElement('button');
    indicator.className = 'gallery-indicator' + (idx === 0 ? ' active' : '');
    indicator.setAttribute('aria-label', `Изображение ${idx + 1}`);
    indicator.onclick = () => {
      currentIndex = idx;
      updateMainImage(currentIndex);
      updateIndicators();
    };
    indicatorsContainer.appendChild(indicator);
  });

  container.appendChild(prevBtn);
  container.appendChild(nextBtn);
  container.appendChild(indicatorsContainer);
  updateMainImage(0);
}

// Инициализация страницы услуг (подстановка данных из servicesData)
function initServicesPage() {
  if (!window.servicesData) {
    if (window.Logger) {
      Logger.WARN('servicesData не найдена, карточки услуг не обновлены');
    }
    return;
  }

  const serviceCards = document.querySelectorAll('.service-card[data-service-id]');
  serviceCards.forEach(card => {
    const serviceId = card.getAttribute('data-service-id');
    const data = window.servicesData[serviceId];
    if (!data) return;

    const titleEl = card.querySelector('.card-title');
    if (titleEl && data.title) {
      titleEl.textContent = data.title;
    }

    const descEl = card.querySelector('.card-desc');
    if (descEl && data.shortDescription) {
      descEl.textContent = data.shortDescription;
    }
  });

  if (window.Logger) {
    Logger.INFO('initServicesPage: данные подставлены в карточки услуг');
  }
}

window.initServiceGallery = initServiceGallery;
window.initServicesPage = initServicesPage;