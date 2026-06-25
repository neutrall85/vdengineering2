/**
 * Страница вакансий – динамическая генерация карточек
 * ООО "Волга-Днепр Инжиниринг"
 */

class VacancyRenderer {
  constructor(data) {
    this.data = data;
    this.container = null;
  }

  render(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (!this.data || this.data.length === 0) {
      this.container.innerHTML = '<p class="no-vacancies">На данный момент открытых вакансий нет, но вы можете отправить резюме на рассмотрение.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    this.data.forEach(vacancy => {
      const card = this._createCard(vacancy);
      fragment.appendChild(card);
    });
    this.container.replaceChildren(fragment);

    this.container.querySelectorAll('.vacancy-card').forEach(card => {
      card.classList.add('visible');
      card.classList.remove('animate-on-scroll', 'fade-up');
    });

    // Даём браузеру время на отрисовку, затем проверяем видимость
    requestAnimationFrame(() => {
      setTimeout(() => {
        this._checkVisibilityAndAddVisibleClass(this.container);
      }, 20);
    });

    if (window.animationManager) {
      window.animationManager.observeNewElements(this.container);
    }
  }

  _createCard(vacancy) {
    const sanitizer = window.Utils?.Sanitizer;
    const safeTitle = sanitizer ? sanitizer.escapeHtml(vacancy.title) : vacancy.title;
    const safeDept = sanitizer ? sanitizer.escapeHtml(vacancy.department) : vacancy.department;

    const card = document.createElement('div');
    card.className = 'vacancy-card animate-on-scroll fade-up';

    const header = document.createElement('div');
    header.className = 'vacancy-header';
    header.innerHTML = `
      <h3 class="vacancy-title">${safeTitle}</h3>
      <span class="vacancy-department">${safeDept}</span>
    `;
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'vacancy-body';

    if (vacancy.requirements?.length) {
      const reqDiv = document.createElement('div');
      reqDiv.className = 'vacancy-requirements';
      reqDiv.innerHTML = '<h4>Требования:</h4><ul>' + vacancy.requirements.map(r => `<li>${sanitizer ? sanitizer.escapeHtml(r) : r}</li>`).join('') + '</ul>';
      body.appendChild(reqDiv);
    }

    if (vacancy.responsibilities?.length) {
      const respDiv = document.createElement('div');
      respDiv.className = 'vacancy-responsibilities';
      respDiv.innerHTML = '<h4>Обязанности:</h4><ul>' + vacancy.responsibilities.map(r => `<li>${sanitizer ? sanitizer.escapeHtml(r) : r}</li>`).join('') + '</ul>';
      body.appendChild(respDiv);
    }

    if (vacancy.conditions?.length) {
      const condDiv = document.createElement('div');
      condDiv.className = 'vacancy-conditions';
      condDiv.innerHTML = '<h4>Условия:</h4><ul>' + vacancy.conditions.map(c => `<li>${sanitizer ? sanitizer.escapeHtml(c) : c}</li>`).join('') + '</ul>';
      body.appendChild(condDiv);
    }

    card.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'vacancy-footer';
    const btn = document.createElement('button');
    btn.className = 'btn-primary btn-apply vacancy-apply-btn';
    btn.setAttribute('data-modal-open', 'application');
    btn.setAttribute('data-vacancy-id', vacancy.id);
    btn.textContent = 'Откликнуться';
    footer.appendChild(btn);
    card.appendChild(footer);

    return card;
  }

  _checkVisibilityAndAddVisibleClass(container) {
    const cards = container.querySelectorAll('.vacancy-card');
    const windowHeight = window.innerHeight;
    const offset = 100;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const isVisible = rect.top < windowHeight - offset && rect.bottom > offset;
      if (isVisible) {
        card.classList.add('visible');
      }
    });
  }
}

let vacancyRenderer = null;

function initVacanciesPage() {
  '[Vacancies] initVacanciesPage вызвана');
  const grid = document.getElementById('vacanciesGrid');
  if (!grid) {
    '[Vacancies] Контейнер vacanciesGrid не найден');
    return;
  }

  const MAX_RETRIES = 30;       // 30 попыток * 100 мс = 3 секунды
  const RETRY_DELAY_MS = 100;

  const renderWithRetry = (attempt = 0) => {
    if (window.VACANCIES_DATA && Array.isArray(window.VACANCIES_DATA) && window.VACANCIES_DATA.length > 0) {
      '[Vacancies] Данные загружены, рендерим', window.VACANCIES_DATA.length, 'вакансий');
      if (!vacancyRenderer) {
        vacancyRenderer = new VacancyRenderer(window.VACANCIES_DATA);
      }
      vacancyRenderer.render('vacanciesGrid');
    } else if (attempt < MAX_RETRIES) {
      `[Vacancies] Данных ещё нет, попытка ${attempt + 1} из ${MAX_RETRIES}`);
      setTimeout(() => renderWithRetry(attempt + 1), RETRY_DELAY_MS);
    } else {
      '[Vacancies] Данные не загружены после всех попыток');
      grid.innerHTML = '<p class="no-vacancies">Данные о вакансиях временно недоступны. Пожалуйста, попробуйте позже.</p>';
    }
  };

  renderWithRetry();
}

function destroyVacanciesPage() {
  if (vacancyRenderer) {
    vacancyRenderer = null;
  }
  const grid = document.getElementById('vacanciesGrid');
  if (grid) grid.innerHTML = '';
}

window.initVacanciesPage = initVacanciesPage;
window.destroyVacanciesPage = destroyVacanciesPage;