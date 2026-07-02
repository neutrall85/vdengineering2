/**
 * Инициализация главной страницы – только рендеринг
 * ООО "Волга-Днепр Инжиниринг"
 */
(function() {
  // Динамическое создание модального окна проекта (если отсутствует)
  function ensureProjectModal() {
    if (document.getElementById('projectModalOverlay')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay modal-overlay-project';
    modalOverlay.id = 'projectModalOverlay';
    modalOverlay.setAttribute('role', 'dialog');
    modalOverlay.setAttribute('aria-modal', 'true');
    modalOverlay.setAttribute('aria-labelledby', 'projectModalTitle');

    modalOverlay.innerHTML = `
      <div class="modal-container">
        <button class="modal-close" aria-label="Закрыть">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
        <div class="modal-image-container" id="projectModalImageContainer">
          <img class="modal-image" id="projectModalImage" src="" alt="" loading="lazy">
        </div>
        <div class="modal-body">
          <span class="modal-category" id="projectModalCategory"></span>
          <h2 class="modal-title" id="projectModalTitle"></h2>
          <div class="modal-content" id="projectModalContent"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    if (typeof modalManager !== 'undefined') {
      modalManager.register('project', {
        overlayId: 'projectModalOverlay',
        onClose: null,
        onOpen: null,
        focusSelector: null
      });
    } else {
      document.addEventListener('components:loaded', function onComponentsLoaded() {
        if (typeof modalManager !== 'undefined') {
          modalManager.register('project', {
            overlayId: 'projectModalOverlay',
            onClose: null,
            onOpen: null,
            focusSelector: null
          });
        }
        document.removeEventListener('components:loaded', onComponentsLoaded);
      });
    }
  }

  // Рендер превью новостей
  function renderPreviewNews() {
    const container = document.getElementById('previewNewsGrid');
    if (!container) return;

    if (typeof NEWS_DATA === 'undefined' || typeof NewsRenderer === 'undefined') {
      const errorMsg = document.createElement('p');
      errorMsg.className = 'no-news';
      errorMsg.textContent = 'Новости временно недоступны';
      container.replaceChildren();
      container.appendChild(errorMsg);
      return;
    }

    const renderer = new NewsRenderer(NEWS_DATA);
    renderer.renderPreview(container, 3);
  }

  // Рендер превью проектов (4 штуки)
  function renderPreviewProjects() {
    const container = document.getElementById('previewProjectsGrid');
    if (!container) return;

    if (typeof PROJECTS_DATA === 'undefined') {
      container.innerHTML = '<p class="no-projects">Проекты временно недоступны</p>';
      return;
    }

    const projectsList = Object.entries(PROJECTS_DATA)
      .slice(0, 4)
      .map(([id, project]) => ({
        ...project,
        id: id
      }));

    if (projectsList.length === 0) {
      container.innerHTML = '<p class="no-projects">Нет проектов для отображения</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    projectsList.forEach((project, index) => {
      const card = createProjectCard(project, index);
      fragment.appendChild(card);
    });

    container.replaceChildren(fragment);

    // Ленивая загрузка изображений
    const images = container.querySelectorAll('.project-card img[data-src]');
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.getAttribute('data-src');
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              img.classList.add('loaded');
            }
            imageObserver.unobserve(img);
          }
        });
      }, { threshold: 0.1, rootMargin: '100px' });
      images.forEach(img => imageObserver.observe(img));
    } else {
      images.forEach(img => {
        const src = img.getAttribute('data-src');
        if (src) img.src = src;
      });
    }

    if (typeof animationManager !== 'undefined') {
      animationManager.observeNewElements(container);
    }

    // Принудительная проверка видимости
   setTimeout(() => {
      requestAnimationFrame(() => {
          const cards = container.querySelectorAll('.project-card');
          const windowHeight = window.innerHeight;
          const offset = 100;
          cards.forEach(card => {
              const rect = card.getBoundingClientRect();
              const isVisible = rect.top < windowHeight - offset && rect.bottom > offset;
              if (isVisible) {
                  card.classList.add('visible');
              }
          });
      });
    }, 100);
  }

  // Вспомогательная функция создания карточки проекта
  function createProjectCard(project, index) {
    const sanitizer = window.Utils?.Sanitizer;
    const safeTitle = sanitizer ? sanitizer.escapeHtml(project.title) : project.title;
    const safeCategory = sanitizer ? sanitizer.escapeHtml(project.category) : project.category;
    const previewImage = (project.images && project.images[0]) || 'assets/images/placeholder.jpg';
    const shortDesc = project.shortDescription || '';

    const article = document.createElement('article');
    article.className = 'project-card card animate-on-scroll fade-up';
    article.style.animationDelay = `${index * 50}ms`;
    // Централизованное открытие через ModalManager
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

    let descElem = null;
    if (shortDesc) {
      descElem = document.createElement('p');
      descElem.className = 'card-desc';
      descElem.textContent = sanitizer ? sanitizer.escapeHtml(shortDesc) : shortDesc;
    }

    const btn = document.createElement('button');
    btn.className = 'news-card-link';
    btn.setAttribute('data-modal-open', 'project');
    btn.setAttribute('data-project-id', project.id);
    btn.innerHTML = 'Подробнее <svg viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';

    contentDiv.appendChild(categorySpan);
    contentDiv.appendChild(title);
    if (descElem) contentDiv.appendChild(descElem);
    contentDiv.appendChild(btn);

    article.appendChild(imgContainer);
    article.appendChild(contentDiv);
    return article;
  }

  // DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    ensureProjectModal();

    const emailLink = document.getElementById('contactEmailLink');
    if (emailLink) {
      emailLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Открыть почтовый клиент?')) location.href = emailLink.href;
      });
    }

    setTimeout(() => {
      renderPreviewNews();
      renderPreviewProjects();
    }, 200);
  });

  window.destroyMainPage = function() {
    const projectModal = document.getElementById('projectModalOverlay');
    if (projectModal && !document.querySelector('html[data-project-modal-static]')) {
      projectModal.remove();
    }
  };
})();