/**
 * Рендеринг новостей
 * ООО "ВД Инжиниринг"
 */
class NewsRenderer {
  constructor(newsData) {
    this.newsData = newsData;
    this.loadedYears = new Set();
    this.cardStaggerMs = window.CONFIG?.ANIMATION?.CARD_STAGGER_MS || 50;
    this.batchSize = window.CONFIG?.ANIMATION?.NEWS_BATCH_SIZE || 4;
    this._imageObserver = null;   // [P0-FIX]
  }

  _normalizePath(path) {
    if (!path) return '/assets/images/placeholder.jpg';
    if (path.startsWith('/')) return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '/' + path;
  }

  _getDelayClass(index, stagger = 50) {
    const delay = index * stagger;
    const rounded = Math.round(delay / 50) * 50;
    const clamped = Math.max(100, Math.min(rounded, 900));
    return `delay-${clamped}`;
  }

  render(year, container, options = {}) {
    if (!container) { Logger.WARN('Container not found for year:', year); return; }
    if (this.loadedYears.has(year)) return;

    this.loadedYears.add(year);
    const newsList = this.newsData[year] || [];

    if (newsList.length === 0) {
      const noNews = document.createElement('p');
      noNews.classList.add('no-news');
      noNews.textContent = 'Нет новостей';
      container.appendChild(noNews);
      return;
    }

    container._newsLazyState = { year, newsList, renderedCount: 0, batchSize: this.batchSize };
    container.replaceChildren();
    this._renderNextBatch(container);
  }

  renderPreview(container, limit = 3) {
    if (!container) { Logger.WARN('Container not found for news preview'); return; }

    if (!this.newsData || typeof this.newsData !== 'object') {
      const noNews = document.createElement('p');
      noNews.classList.add('no-news');
      noNews.textContent = 'Новости временно недоступны';
      container.replaceChildren();
      container.appendChild(noNews);
      return;
    }

    const allNews = [];
    Object.values(this.newsData).forEach(yearNews => {
      if (Array.isArray(yearNews)) yearNews.forEach(news => allNews.push(news));
    });
    allNews.sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));
    const latestNews = allNews.slice(0, limit);

    if (latestNews.length === 0) {
      const noNews = document.createElement('p');
      noNews.classList.add('no-news');
      noNews.textContent = 'Новости временно недоступны';
      container.replaceChildren();
      container.appendChild(noNews);
      return;
    }

    container.replaceChildren();
    const fragment = document.createDocumentFragment();
    latestNews.forEach((news, index) => fragment.appendChild(this._createNewsCard(news, index)));
    container.appendChild(fragment);

    this._lazyLoadImages(container);
    if (window.animationManager) window.animationManager.observeNewElements(container);

    setTimeout(() => {
      requestAnimationFrame(() => {
        const cards = container.querySelectorAll('.news-card');
        const windowHeight = window.innerHeight;
        const offset = 100;
        cards.forEach(card => {
          const rect = card.getBoundingClientRect();
          if (rect.top < windowHeight - offset && rect.bottom > offset) card.classList.add('visible');
        });
      });
    }, 100);
  }

  _renderNextBatch(container) {
    const state = container._newsLazyState;
    if (!state) return;

    const { newsList, batchSize } = state;
    const start = state.renderedCount;
    const end = Math.min(start + batchSize, newsList.length);

    const oldSentinel = container.querySelector('.news-sentinel');
    if (oldSentinel) oldSentinel.remove();

    const fragment = document.createDocumentFragment();
    const batchCards = [];
    for (let i = start; i < end; i++) {
      const card = this._createNewsCard(newsList[i], i);
      fragment.appendChild(card);
      batchCards.push(card);
    }
    container.appendChild(fragment);
    state.renderedCount = end;

    this._animateBatchEnter(batchCards);
    this._lazyLoadImages(container);
    if (window.animationManager) window.animationManager.observeNewElements(container);

    if (state.renderedCount < newsList.length) this._attachSentinel(container);
    else this._destroySentinel(container);
  }

  _animateBatchEnter(cards) {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cards.forEach((card, i) => {
      if (prefersReduced) { card.classList.remove('news-card--enter'); return; }
      card.classList.add('news-card--enter');
      const delay = i * this.cardStaggerMs;
      setTimeout(() => {
        void card.offsetWidth;
        card.classList.remove('news-card--enter');
        card.classList.add('news-card--entered');
        const cleanup = () => {
          card.classList.remove('news-card--entered');
          card.removeEventListener('animationend', cleanup);
        };
        card.addEventListener('animationend', cleanup);
      }, delay);
    });
  }

  _attachSentinel(container) {
    if (container._newsSentinelObserver) {
      container._newsSentinelObserver.disconnect();
      container._newsSentinelObserver = null;
    }
    const sentinel = document.createElement('div');
    sentinel.className = 'news-sentinel';
    sentinel.setAttribute('aria-hidden', 'true');
    container.appendChild(sentinel);

    container._newsSentinelObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          container._newsSentinelObserver.disconnect();
          container._newsSentinelObserver = null;
          requestAnimationFrame(() => this._renderNextBatch(container));
        }
      });
    }, { rootMargin: '300px 0px' });
    container._newsSentinelObserver.observe(sentinel);
  }

  _destroySentinel(container) {
    if (container._newsSentinelObserver) {
      container._newsSentinelObserver.disconnect();
      container._newsSentinelObserver = null;
    }
    const sentinel = container.querySelector('.news-sentinel');
    if (sentinel) sentinel.remove();
  }

  _createNewsCard(news, index) {
    const article = document.createElement('article');
    article.classList.add('news-card');
    article.dataset.modalOpen = 'news';
    article.dataset.newsId = news.id;
    article.dataset.once = 'true';

    const topRow = document.createElement('div');
    topRow.className = 'news-card-top';

    const imageContainer = document.createElement('div');
    imageContainer.classList.add('news-card-image');

    const placeholder = document.createElement('div');
    placeholder.classList.add('image-placeholder');

    const img = document.createElement('img');
    const previewImage = (news.images && news.images[0]) || news.image || '/assets/images/placeholder.jpg';
    const normalizedSrc = this._normalizePath(previewImage);
    img.alt = news.title;
    let fallbackApplied = false;
    img.addEventListener('error', function () {
      if (fallbackApplied) return;
      fallbackApplied = true;
      this.src = '/assets/images/placeholder.jpg';
    });
    img.src = normalizedSrc;

    imageContainer.appendChild(placeholder);
    imageContainer.appendChild(img);
    topRow.appendChild(imageContainer);

    const headerBlock = document.createElement('div');
    headerBlock.className = 'news-card-header';

    const category = document.createElement('span');
    category.classList.add('news-card-category', 'category-trigger');
    category.textContent = Utils.Sanitizer.escapeHtml(news.category);
    category.dataset.modalOpen = 'category';
    category.dataset.category = news.category;

    const dateDiv = document.createElement('div');
    dateDiv.classList.add('news-card-date');
    const dateSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dateSvg.setAttribute('viewBox', '0 0 24 24');
    const datePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    datePath.setAttribute('d', 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z');
    dateSvg.appendChild(datePath);
    dateDiv.appendChild(dateSvg);
    dateDiv.appendChild(document.createTextNode(` ${this._escapeHtml(news.date)}`));

    const title = document.createElement('h3');
    title.classList.add('news-card-title');
    title.textContent = Utils.Sanitizer.escapeHtml(news.title);

    headerBlock.appendChild(category);
    headerBlock.appendChild(dateDiv);
    headerBlock.appendChild(title);
    topRow.appendChild(headerBlock);

    const bottomRow = document.createElement('div');
    bottomRow.className = 'news-card-bottom';

    const excerpt = document.createElement('p');
    excerpt.classList.add('news-card-excerpt');
    excerpt.textContent = Utils.Sanitizer.escapeHtml(news.excerpt);

    const link = document.createElement('a');
    link.classList.add('news-card-link');
    link.setAttribute('href', '#');
    link.setAttribute('data-modal-open', 'news');
    link.setAttribute('data-news-id', news.id);
    link.textContent = 'Подробнее';

    const linkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    linkSvg.setAttribute('viewBox', '0 0 24 24');
    const linkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linkPath.setAttribute('d', 'M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z');
    linkSvg.appendChild(linkPath);
    link.appendChild(linkSvg);

    bottomRow.appendChild(excerpt);
    bottomRow.appendChild(link);

    article.appendChild(topRow);
    article.appendChild(bottomRow);
    return article;
  }

  // [P0-FIX] Переиспользуем один observer, старый отключаем.
  _lazyLoadImages(container) {
    const images = container.querySelectorAll('.news-card-image img');
    if (this._imageObserver) this._imageObserver.disconnect();

    this._imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.srcLoaded === 'true') { this._imageObserver.unobserve(img); return; }
        img.dataset.srcLoaded = 'true';
        const src = img.getAttribute('data-src') || img.src;
        if (src) {
          const onLoad = () => {
            img.classList.add('loaded');
            const placeholder = img.parentElement?.querySelector('.image-placeholder');
            if (placeholder) placeholder.style.display = 'none';
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
          };
          const onError = () => {
            Logger.WARN('Failed to load image:', src);
            img.src = '/assets/images/placeholder.jpg';
            img.classList.add('loaded');
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
          };
          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
          if (!img.src || img.getAttribute('data-src')) {
            img.src = src;
            img.removeAttribute('data-src');
          }
        }
        this._imageObserver.unobserve(img);
      });
    }, { threshold: 0.1, rootMargin: '100px' });

    images.forEach(img => {
      if (img.dataset.srcLoaded !== 'true') this._imageObserver.observe(img);
    });
  }

  _escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  destroy() {
    if (this._imageObserver) {
      this._imageObserver.disconnect();
      this._imageObserver = null;
    }
    document.querySelectorAll('[id^="newsGrid-"]').forEach(container => {
      if (container._newsSentinelObserver) {
        container._newsSentinelObserver.disconnect();
        container._newsSentinelObserver = null;
      }
    });
    this.loadedYears.clear();
  }
}