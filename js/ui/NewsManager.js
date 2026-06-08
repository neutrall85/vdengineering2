/**
 * Управление новостями
 * ООО "Волга-Днепр Инжиниринг"
 */

class NewsManager {
  constructor(newsData, renderer) {
    this.newsData = newsData;
    this.renderer = renderer;
    this.activeYear = null;
    this.lightboxOverlay = null;
    this.lightboxImage = null;
    this._lightboxModalClickHandler = null;
    this._lightboxCloseBtnHandler = null;
    this._lightboxOverlayClickHandler = null;
    this._lightboxKeydownHandler = null;
    this._lightboxImageClickHandler = null;
    this._cardClickHandler = null;
    this._boundLoadHandler = null;
  }

  init() {
    Logger.INFO('NewsManager initializing...');
    this._initTabs();
    this._initModal();
    this._initCardClickHandler();
    
    // Инициализация лайтбокса после полной загрузки DOM
    if (document.readyState === 'complete') {
      this._initLightbox();
    } else {
      this._boundLoadHandler = () => this._initLightbox();
      window.addEventListener('load', this._boundLoadHandler);
    }
  }

  _initLightbox() {
    this.lightboxOverlay = document.getElementById('lightboxOverlay');
    this.lightboxImage = document.getElementById('lightboxImage');
    const closeBtn = document.getElementById('lightboxCloseBtn');

    if (!this.lightboxOverlay || !this.lightboxImage) {
      Logger.WARN('Lightbox elements not found');
      return;
    }

    // Клик по изображению в модалке новостей открывает лайтбокс
    const modalImage = document.getElementById('newsModalImage');
    if (modalImage) {
      this._lightboxModalClickHandler = () => {
        if (modalImage.src && modalImage.src !== window.location.href + '#') {
          this.openLightbox(modalImage.src, modalImage.alt);
        }
      };
      modalImage.addEventListener('click', this._lightboxModalClickHandler);
      modalImage.style.cursor = 'zoom-in';
    }

    // Закрытие лайтбокса по кнопке
    if (closeBtn) {
      this._lightboxCloseBtnHandler = () => this.closeLightbox();
      closeBtn.addEventListener('click', this._lightboxCloseBtnHandler);
    }

    // Закрытие лайтбокса по клику на оверлей
    this._lightboxOverlayClickHandler = (e) => {
      if (e.target === this.lightboxOverlay) {
        this.closeLightbox();
      }
    };
    this.lightboxOverlay.addEventListener('click', this._lightboxOverlayClickHandler);

    // Закрытие по Escape
    this._lightboxKeydownHandler = (e) => {
      if (e.key === 'Escape' && this.lightboxOverlay.classList.contains('active')) {
        this.closeLightbox();
      }
    };
    document.addEventListener('keydown', this._lightboxKeydownHandler);

    Logger.INFO('Lightbox initialized');
  }

  openLightbox(imageSrc, imageAlt) {
    if (!this.lightboxOverlay || !this.lightboxImage) return;

    this.lightboxImage.src = imageSrc;
    this.lightboxImage.alt = imageAlt || 'Изображение новости';
    this.lightboxOverlay.classList.add('active');
    
    // Не блокируем скролл повторно, если он уже заблокирован (например, модальным окном новости)
    // ScrollManager использует счётчик блокировок, поэтому дополнительный lock() не нужен
    // Если лайтбокс открыт самостоятельно (не из модалки), то блокируем скролл
    if (window.ScrollManager && !window.ScrollManager.isLocked()) {
      ScrollManager.lock();
    }
    
    // Добавляем закрытие по клику на изображение через addEventListener
    this._lightboxImageClickHandler = () => this.closeLightbox();
    this.lightboxImage.addEventListener('click', this._lightboxImageClickHandler);
    
    // Фокус на кнопку закрытия для доступности
    const closeBtn = document.getElementById('lightboxCloseBtn');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 100);
    }

    Logger.INFO('Lightbox opened');
  }

  closeLightbox() {
    if (!this.lightboxOverlay) return;

    this.lightboxOverlay.classList.remove('active');
    
    // Используем только ScrollManager для восстановления скролла
    if (window.ScrollManager) {
      ScrollManager.unlock();
    } else {
      Logger.WARN('ScrollManager not available for news lightbox close');
    }
    
    // Удаляем обработчик клика по изображению
    if (this.lightboxImage && this._lightboxImageClickHandler) {
      this.lightboxImage.removeEventListener('click', this._lightboxImageClickHandler);
      this._lightboxImageClickHandler = null;
    }
    
    // Очищаем src после анимации
    setTimeout(() => {
      if (this.lightboxImage) {
        this.lightboxImage.src = '';
      }
    }, 300);

    Logger.INFO('Lightbox closed');
  }

  _initTabs() {
    const tabs = document.querySelectorAll('.news-tab');
    if (tabs.length === 0) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Определяем идентификатор: год или имя вкладки
        let tabId = tab.dataset.year;
        if (!tabId) tabId = tab.dataset.tab;
        if (!tabId) return;

        // Активируем таб
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Показываем нужный контент
        document.querySelectorAll('.news-tab-content').forEach(content => {
          content.classList.remove('active');
        });
        const activeContent = document.getElementById(`tab-${tabId}`);
        if (activeContent) {
          activeContent.classList.add('active');
        }

        // Рендерим новости
        const container = document.getElementById(`newsGrid-${tabId}`);
        if (container && this.renderer) {
          // Передаём ключ (год или 'zozh')
          this.renderer.render(tabId, container);
        }
      });
    });

    // Активируем первый таб (или тот, который уже имеет класс active)
    const activeTab = document.querySelector('.news-tab.active');
    if (activeTab) {
      let initialId = activeTab.dataset.year || activeTab.dataset.tab;
      if (initialId) {
        const container = document.getElementById(`newsGrid-${initialId}`);
        if (container && this.renderer) {
          this.renderer.render(initialId, container);
        }
      }
    }
  }

  _initModal() {
    // Модальное окно уже зарегистрировано в app.js
    Logger.INFO('News modal ready');
  }

  _initCardClickHandler() {
    this._cardClickHandler = (e) => {
      const link = e.target.closest('.news-card-link');
      if (link) {
        const newsId = parseInt(link.dataset.newsId, 10);
        
        if (newsId) {
          e.preventDefault();
          this.openNewsModal(newsId);
        }
      }
    };
    document.addEventListener('click', this._cardClickHandler);
  }

  openNewsModal(id) {
    const allNews = Object.values(this.newsData).flat();
    const news = allNews.find(n => n.id === id);
    
    if (!news) return;
    
    this._populateModal(news);
    
    const manager = (typeof modalManager !== 'undefined') ? modalManager : (window.App?.services?.modalManager);
    if (manager) {
      manager.open('news');
    } else {
      Logger.WARN('ModalManager not available');
    }
  }

  closeNewsModal() {
    const manager = (typeof modalManager !== 'undefined') ? modalManager : (window.App?.services?.modalManager);
    if (manager) {
      manager.close('news');
    }
  }

  _populateModal(news) {
    const title = document.getElementById('newsModalTitle');
    const date = document.getElementById('newsModalDate');
    const category = document.getElementById('newsModalCategory');
    const image = document.getElementById('newsModalImage');
    const content = document.getElementById('newsModalContent');
    
    // Используем санитизацию для безопасности
    const sanitizer = window.Utils?.Sanitizer;
    
    if (title) title.textContent = sanitizer ? sanitizer.escapeHtml(news.title) : news.title;
    if (date) date.textContent = sanitizer ? sanitizer.escapeHtml(news.date) : news.date;
    if (category) category.textContent = sanitizer ? sanitizer.escapeHtml(news.category) : news.category;
    if (image) {
      const imageUrl = sanitizer ? (sanitizer.isValidUrl(news.image) ? news.image : 'assets/images/placeholder.jpg') : news.image;
      image.src = imageUrl;
      image.alt = sanitizer ? sanitizer.escapeHtml(news.title) : news.title;
    }
    if (content) {
      // Очищаем контейнер
      content.replaceChildren();
      
      const safeContent = sanitizer ? sanitizer.sanitizeHtml(news.content, {
        allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'a', 'span', 'div']
      }) : news.content;
      
      // Создаём временный элемент для парсинга БЕЗОПАСНОГО HTML
      // Поскольку контент уже прошёл санитизацию, innerHTML здесь допустим
      // Но мы сразу клонируем узлы без событий
      const tempDiv = document.createElement('div');
      tempDiv.textContent = safeContent; // Используем textContent для полной безопасности
      
      // Если нужен HTML, используем подход с созданием элементов вручную
      // Для простого текста достаточно textContent выше
      // Если контент содержит разрешённые теги, создаём структуру вручную
      if (safeContent.includes('<')) {
        // Фоллбэк: создаём элемент и вставляем текст, если есть теги - парсим аккуратно
        const parser = new DOMParser();
        const doc = parser.parseFromString(safeContent, 'text/html');
        Array.from(doc.body.childNodes).forEach(node => {
          content.appendChild(node.cloneNode(true));
        });
      } else {
        content.appendChild(document.createTextNode(safeContent));
      }
    }
  }

  _resetModalContent() {
    const image = document.getElementById('newsModalImage');
    if (image) image.src = '';
  }

  destroy() {
    // Удаляем обработчик загрузки страницы
    if (this._boundLoadHandler) {
      window.removeEventListener('load', this._boundLoadHandler);
      this._boundLoadHandler = null;
    }
    
    // Удаляем обработчики лайтбокса
    if (this._lightboxModalClickHandler) {
      const modalImage = document.getElementById('newsModalImage');
      if (modalImage) {
        modalImage.removeEventListener('click', this._lightboxModalClickHandler);
      }
    }
    if (this._lightboxCloseBtnHandler) {
      const closeBtn = document.getElementById('lightboxCloseBtn');
      if (closeBtn) {
        closeBtn.removeEventListener('click', this._lightboxCloseBtnHandler);
      }
    }
    if (this._lightboxOverlayClickHandler && this.lightboxOverlay) {
      this.lightboxOverlay.removeEventListener('click', this._lightboxOverlayClickHandler);
    }
    if (this._lightboxKeydownHandler) {
      document.removeEventListener('keydown', this._lightboxKeydownHandler);
    }
    if (this._lightboxImageClickHandler && this.lightboxImage) {
      this.lightboxImage.removeEventListener('click', this._lightboxImageClickHandler);
    }
    
    // Удаляем обработчик кликов по карточкам новостей
    if (this._cardClickHandler) {
      document.removeEventListener('click', this._cardClickHandler);
    }
    
    // Очищаем ссылки на DOM элементы
    this.lightboxOverlay = null;
    this.lightboxImage = null;
  }
}

// Экспорт удален - регистрация происходит через Application.services

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewsManager;
}