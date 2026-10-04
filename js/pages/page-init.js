/**
 * Инициализация главной страницы – только рендеринг
 * ООО "ВД Инжиниринг"
 *
 * Модалка проекта (#projectModalOverlay) уже присутствует
 * в статической разметке index.html — динамическое создание
 * здесь не требуется.
 */
(function() {
  // Минимальная задержка — 100 мс (классы delay-0 и delay-50
  // не определены в CSS; в будущем можно добавить, но сейчас clamp).
  function getDelayClass(index, stagger = 50) {
    const delay = index * stagger;
    const rounded = Math.round(delay / 50) * 50;
    const clamped = Math.max(100, Math.min(rounded, 900));
    return `delay-${clamped}`;
  }

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

    try {
      const renderer = new NewsRenderer(NEWS_DATA);
      renderer.renderPreview(container, 3);
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.ERROR('renderPreviewNews error:', err);
      }
      const errorMsg = document.createElement('p');
      errorMsg.className = 'no-news';
      errorMsg.textContent = 'Новости временно недоступны';
      container.replaceChildren();
      container.appendChild(errorMsg);
    }
  }

  function renderPreviewProjects() {
    const container = document.getElementById('previewProjectsGrid');
    if (!container) return;

    if (typeof PROJECTS_DATA === 'undefined') {
      container.innerHTML = '<p class="no-projects">Проекты временно недоступны</p>';
      return;
    }

    const projectsList = Object.entries(PROJECTS_DATA)
      .slice(0, 4)
      .map(([id, project]) => ({ ...project, id: id }));

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

  function createProjectCard(project, index) {
    const sanitizer = window.Utils?.Sanitizer;
    const safeTitle = sanitizer ? sanitizer.escapeHtml(project.title) : project.title;
    const safeCategory = sanitizer ? sanitizer.escapeHtml(project.category) : project.category;
    const previewImage = (project.images && project.images[0]) || '/assets/images/placeholder.jpg';
    const normalizedSrc = previewImage.startsWith('/') || previewImage.startsWith('http')
      ? previewImage
      : '/' + previewImage;
    const shortDesc = project.shortDescription || '';

    const article = document.createElement('article');
    article.className = 'project-card card animate-on-scroll fade-up';
    const delayClass = getDelayClass(index, 50);
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

    contentDiv.appendChild(title);
    if (descElem) contentDiv.appendChild(descElem);
    contentDiv.appendChild(btn);

    article.appendChild(imgContainer);
    article.appendChild(contentDiv);
    return article;
  }

  function initMainPage() {
    // [FIX] Раньше использовался getElementById('contactEmailLink'),
    // но в index.html было два элемента с этим id — второй терял обработчик.
    // Теперь обрабатываем все ссылки по классу .contact-email-link.
    document.querySelectorAll('.contact-email-link').forEach(emailLink => {
      emailLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Открыть почтовый клиент?')) location.href = emailLink.href;
      });
    });

    setTimeout(() => {
      renderPreviewNews();
      renderPreviewProjects();
    }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMainPage);
  } else {
    initMainPage();
  }
})();