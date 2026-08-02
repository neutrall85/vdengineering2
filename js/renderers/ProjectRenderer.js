/**
 * ProjectRenderer – рендеринг карточек проектов
 * ООО "ВД Инжиниринг"
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

  /**
   * Приводит путь к абсолютному (добавляет / в начале, если нет)
   */
  _normalizePath(path) {
    if (!path) return '/assets/images/placeholder.jpg';
    if (path.startsWith('/')) return path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return '/' + path;
  }

  // ИЗМЕНЕНО: добавлена функция расчёта класса задержки
  _getDelayClass(index, stagger = 50) {
    const delay = index * stagger;
    const rounded = Math.round(delay / 50) * 50; // классы идут с шагом 50
    const clamped = Math.min(rounded, 900);      // максимум – delay-900
    return `delay-${clamped}`;
  }

  render(container) {
    if (this.loaded) return;
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
    const normalizedSrc = this._normalizePath(previewImage);
    const additionalDesc = project.shortDescription
      ? (sanitizer ? sanitizer.escapeHtml(project.shortDescription) : project.shortDescription)
      : '';

    const article = document.createElement('article');
    article.className = 'project-card card animate-on-scroll fade-up';
    // ИЗМЕНЕНО: вместо style.animationDelay добавляем класс задержки
    const delayClass = this._getDelayClass(index, this.cardStaggerMs);
    article.classList.add(delayClass);
    article.dataset.modalOpen = 'project';
    article.dataset.projectId = project.id;
    article.dataset.once = 'true';

    const imgContainer = document.createElement('div');
    imgContainer.className = 'project-image-container';
    const img = document.createElement('img');
    img.setAttribute('data-src', normalizedSrc);
    img.alt = safeTitle;
    img.classList.add('project-img-cover');
    if (index < 2) {
      img.setAttribute('fetchpriority', 'high');
    }
    img.decoding = 'async';
    img.addEventListener('error', () => {
      img.src = '/assets/images/placeholder.jpg';
    });
    imgContainer.appendChild(img);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'project-content-padding';

    const categorySpan = document.createElement('span');
    categorySpan.className = 'project-category-badge category-trigger';
    categorySpan.textContent = safeCategory;
    categorySpan.dataset.modalOpen = 'project-category';
    categorySpan.dataset.category = safeCategory;
    contentDiv.appendChild(categorySpan);

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
    }, { threshold: 0.1, rootMargin: '300px' });

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

if (typeof window !== 'undefined') {
  window.ProjectRenderer = ProjectRenderer;
}