/**
 * Управление новостями – только рендеринг и лайтбокс
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
    this._boundLoadHandler = null;
  }

  init() {
    Logger.INFO('NewsManager initializing...');
    this._initTabs();
    this._initLightbox();
    // Удалён вызов _initCardClickHandler
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

    if (closeBtn) {
      this._lightboxCloseBtnHandler = () => this.closeLightbox();
      closeBtn.addEventListener('click', this._lightboxCloseBtnHandler);
    }

    this._lightboxOverlayClickHandler = (e) => {
      if (e.target === this.lightboxOverlay) {
        this.closeLightbox();
      }
    };
    this.lightboxOverlay.addEventListener('click', this._lightboxOverlayClickHandler);

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

    if (window.ScrollManager && !window.ScrollManager.isLocked()) {
      ScrollManager.lock();
    }

    this._lightboxImageClickHandler = () => this.closeLightbox();
    this.lightboxImage.addEventListener('click', this._lightboxImageClickHandler);

    const closeBtn = document.getElementById('lightboxCloseBtn');
    if (closeBtn) {
      setTimeout(() => closeBtn.focus(), 100);
    }

    Logger.INFO('Lightbox opened');
  }

  closeLightbox() {
    if (!this.lightboxOverlay) return;

    this.lightboxOverlay.classList.remove('active');

    if (window.ScrollManager) {
      ScrollManager.unlock();
    }

    if (this.lightboxImage && this._lightboxImageClickHandler) {
      this.lightboxImage.removeEventListener('click', this._lightboxImageClickHandler);
      this._lightboxImageClickHandler = null;
    }

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
        let tabId = tab.dataset.year;
        if (!tabId) tabId = tab.dataset.tab;
        if (!tabId) return;

        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.news-tab-content').forEach(content => {
          content.classList.remove('active');
        });
        const activeContent = document.getElementById(`tab-${tabId}`);
        if (activeContent) {
          activeContent.classList.add('active');
        }

        const container = document.getElementById(`newsGrid-${tabId}`);
        if (container && this.renderer) {
          this.renderer.render(tabId, container);
        }
      });
    });

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

  destroy() {
    if (this._boundLoadHandler) {
      window.removeEventListener('load', this._boundLoadHandler);
      this._boundLoadHandler = null;
    }

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

    this.lightboxOverlay = null;
    this.lightboxImage = null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewsManager;
}