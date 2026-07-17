/**
 * Инициализация страницы (без export, так как это не модуль)
 */

// Хранилище для обработчиков
const _pageInitHandlers = {
  emailClickHandler: null,
  containerClickHandler: null
};

function initDocsPage() {
  // Обработчик для кнопок просмотра документов
  const docViewLinks = document.querySelectorAll('.doc-view-link');
  docViewLinks.forEach(function(link) {
    link.addEventListener('click', function(e) {
      if (typeof Logger !== 'undefined') {
        Logger.INFO('Просмотр документа:', this.href);
      }
    });
  });

  // Ленивая загрузка изображений превью
  const previewImages = document.querySelectorAll('.doc-preview-image');
  let imageObserver = null;
  if ('IntersectionObserver' in window) {
    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
    previewImages.forEach(img => imageObserver.observe(img));
  }

  // Обработка ошибок загрузки изображений
  const errorHandlerMap = new Map();
  previewImages.forEach(img => {
    const errorHandler = function() {
      const docType = this.getAttribute('data-doc-type') || 'PDF';
      const placeholder = document.createElement('div');
      placeholder.className = 'pdf-preview-placeholder';
      placeholder.replaceChildren();
      
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.className = 'doc-icon';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z');
      svg.appendChild(path);
      
      const span = document.createElement('span');
      span.className = 'doc-type';
      span.textContent = docType;
      
      placeholder.appendChild(svg);
      placeholder.appendChild(span);
      this.parentElement.appendChild(placeholder);
      this.classList.add('hidden');
    };
    img.addEventListener('error', errorHandler);
    errorHandlerMap.set(img, errorHandler);
  });
  
  _pageInitHandlers.imageObserver = imageObserver;
  _pageInitHandlers.errorHandlerMap = errorHandlerMap;

  // ======= КЛИКАБЕЛЬНЫЕ КАРТОЧКИ (с поддержкой новой вкладки) =======
  const cards = document.querySelectorAll('.doc-card');
  const cardClickHandlers = [];
  cards.forEach(card => {
    const link = card.querySelector('.doc-view-link');
    if (!link) return;

    const handler = function(e) {
      // Если клик был по самой ссылке или её потомкам — не перехватываем
      if (link.contains(e.target)) return;
      
      // Эмулируем клик по ссылке — браузер сам обработает Ctrl/Shift/среднюю кнопку
      link.click();
    };
    card.addEventListener('click', handler);
    cardClickHandlers.push({ card, handler });
  });
  _pageInitHandlers.cardClickHandlers = cardClickHandlers;
}

/**
 * Очистка ресурсов страницы документов
 */
function destroyDocsPage() {
  if (_pageInitHandlers.imageObserver) {
    _pageInitHandlers.imageObserver.disconnect();
    _pageInitHandlers.imageObserver = null;
  }
  
  if (_pageInitHandlers.errorHandlerMap) {
    _pageInitHandlers.errorHandlerMap.forEach((handler, img) => {
      img.removeEventListener('error', handler);
    });
    _pageInitHandlers.errorHandlerMap.clear();
  }
}

// Автозапуск если не используется как модуль, или ожидание DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDocsPage);
} else {
  initDocsPage();
}

// Экспортируем функцию очистки
window.destroyDocsPage = destroyDocsPage;