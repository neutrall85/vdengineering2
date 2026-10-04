/**
 * Страница вакансий – динамическая генерация карточек
 * ООО "ВД Инжиниринг"
 */
class VacancyRenderer {
  constructor(data) {
    this.data = data;
    this.container = null;
    this._containerClickHandler = null;
  }

  _getDelayClass(index, stagger = 50) {
    const delay = index * stagger;
    const rounded = Math.round(delay / 50) * 50;
    const clamped = Math.max(100, Math.min(rounded, 900));
    return `delay-${clamped}`;
  }

  _extractExperience(vacancy) {
    const reqs = vacancy.requirements || [];
    for (const req of reqs) {
      const match = req.match(/опыт.*?от\s+(\d+)\s*лет/i);
      if (match) return `Опыт от ${match[1]} лет`;
    }
    return null;
  }

  _extractWorkFormat(vacancy) {
    const conds = vacancy.conditions || [];
    for (const cond of conds) {
      if (/гибридный|удалённо|удаленно|офис\/дом/i.test(cond)) return 'Возможен гибридный формат работы';
    }
    return null;
  }

  _extractLocation(vacancy) {
    const conds = vacancy.conditions || [];
    for (const cond of conds) {
      if (/Место работы:/i.test(cond)) {
        const parts = cond.split(/Место работы:\s*/i);
        if (parts.length > 1) {
          let loc = parts[1].trim();
          loc = loc.replace(/\(.*?\)/, '').trim();
          const shortLoc = loc.split(',').slice(0, 3).join(', ').trim();
          if (shortLoc) return shortLoc;
        }
      }
    }
    return 'Москва, Международное шоссе, 28Б';
  }

  render(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    if (!this.data || this.data.length === 0) {
      this.container.innerHTML = '<p class="no-vacancies">Вакансий пока нет</p>';
      return;
    }

    const fragment = document.createDocumentFragment();
    this.data.forEach((vacancy, index) => {
      fragment.appendChild(this._createShortCard(vacancy, index));
    });
    this.container.replaceChildren(fragment);

    if (this._containerClickHandler) {
      this.container.removeEventListener('click', this._containerClickHandler);
    }
    this._containerClickHandler = (e) => {
      const card = e.target.closest('.vacancy-card-short');
      if (!card) return;
      if (e.target.closest('.btn-primary')) return;
      const id = card.dataset.vacancyId;
      if (id) this._openVacancyModal(id);
    };
    this.container.addEventListener('click', this._containerClickHandler);

    this._checkVisibilityAndAddVisibleClass(this.container);

    if (window.animationManager && typeof window.animationManager.observeNewElements === 'function') {
      window.animationManager.observeNewElements(this.container);
    }
  }

  _createShortCard(vacancy, index) {
    const sanitizer = window.Utils?.Sanitizer;
    const safeTitle = sanitizer ? sanitizer.escapeHtml(vacancy.title) : vacancy.title;
    const safeDept = sanitizer ? sanitizer.escapeHtml(vacancy.department) : vacancy.department;

    const card = document.createElement('div');
    card.className = 'vacancy-card-short animate-on-scroll fade-up';
    card.classList.add(this._getDelayClass(index, 50));
    card.dataset.vacancyId = vacancy.id;
    card.dataset.once = 'true';

    const header = document.createElement('div');
    header.className = 'vacancy-card-header';
    const title = document.createElement('h3');
    title.className = 'vacancy-title';
    title.textContent = safeTitle;
    header.appendChild(title);

    const dept = document.createElement('div');
    dept.className = 'vacancy-department-short';
    dept.textContent = safeDept;
    header.appendChild(dept);
    card.appendChild(header);

    const metaDiv = document.createElement('div');
    metaDiv.className = 'vacancy-meta-info';

    const experience = this._extractExperience(vacancy);
    if (experience) {
      const expSpan = document.createElement('span');
      expSpan.className = 'vacancy-meta-item';
      expSpan.textContent = experience;
      metaDiv.appendChild(expSpan);
    }
    const workFormat = this._extractWorkFormat(vacancy);
    if (workFormat) {
      const formatSpan = document.createElement('span');
      formatSpan.className = 'vacancy-meta-item';
      formatSpan.textContent = workFormat;
      metaDiv.appendChild(formatSpan);
    }
    const location = this._extractLocation(vacancy);
    if (location) {
      const locSpan = document.createElement('span');
      locSpan.className = 'vacancy-meta-item';
      locSpan.textContent = location;
      metaDiv.appendChild(locSpan);
    }

    // [FIX] Раньше здесь искались .vacancy-short-responsibilities и .vacancy-actions
    // в только что созданной карточке — их там нет, ветки всегда были null.
    // Теперь metaDiv просто добавляется в карточку до блока обязанностей.
    if (metaDiv.children.length > 0) {
      card.appendChild(metaDiv);
    }

    const responsibilities = vacancy.responsibilities || [];
    if (responsibilities.length > 0) {
      const respContainer = document.createElement('div');
      respContainer.className = 'vacancy-short-responsibilities';
      const respTitle = document.createElement('div');
      respTitle.className = 'responsibilities-title';
      respTitle.textContent = 'Обязанности:';
      respContainer.appendChild(respTitle);
      const list = document.createElement('ul');
      responsibilities.forEach(item => {
        const li = document.createElement('li');
        li.textContent = sanitizer ? sanitizer.escapeHtml(item) : item;
        list.appendChild(li);
      });
      respContainer.appendChild(list);
      card.appendChild(respContainer);
    }

    const footer = document.createElement('div');
    footer.className = 'vacancy-card-footer';
    const respondBtn = document.createElement('button');
    respondBtn.className = 'btn-primary vacancy-respond-btn';
    respondBtn.textContent = 'Откликнуться';
    respondBtn.setAttribute('data-modal-open', 'application');
    respondBtn.setAttribute('data-vacancy-id', vacancy.id);
    footer.appendChild(respondBtn);
    card.appendChild(footer);

    return card;
  }

  _openVacancyModal(vacancyId) {
    const vacancy = this.data.find(v => String(v.id) === String(vacancyId));
    if (!vacancy) { Logger?.WARN(`Вакансия с id ${vacancyId} не найдена`); return; }

    const titleEl = document.getElementById('vacancyModalTitle');
    const deptEl = document.getElementById('vacancyModalDepartment');
    const bodyEl = document.getElementById('vacancyModalBody');

    if (titleEl) titleEl.textContent = vacancy.title;
    if (deptEl) deptEl.textContent = vacancy.department;

    if (bodyEl) {
      const content = document.createElement('div');
      content.className = 'vacancy-details';
      if (vacancy.responsibilities?.length) {
        const respDiv = document.createElement('div');
        const items = vacancy.responsibilities.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
        respDiv.innerHTML = `<h4>Обязанности:</h4><ul>${items}</ul>`;
        content.appendChild(respDiv);
      }
      if (vacancy.requirements?.length) {
        const reqDiv = document.createElement('div');
        const items = vacancy.requirements.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
        reqDiv.innerHTML = `<h4>Требования:</h4><ul>${items}</ul>`;
        content.appendChild(reqDiv);
      }
      if (vacancy.conditions?.length) {
        const condDiv = document.createElement('div');
        const items = vacancy.conditions.map(c => `<li>${Utils.Sanitizer.escapeHtml(c)}</li>`).join('');
        condDiv.innerHTML = `<h4>Условия:</h4><ul>${items}</ul>`;
        content.appendChild(condDiv);
      }
      bodyEl.replaceChildren(content);
    }

    if (typeof modalManager !== 'undefined') modalManager.open('vacancy', { id: vacancy.id });
    else Logger?.ERROR('modalManager не определён');

    setTimeout(() => {
      const modalOverlay = document.getElementById('vacancyModalOverlay');
      if (!modalOverlay) return;
      const respondBtn = modalOverlay.querySelector('.vacancy-respond-btn');
      if (respondBtn) {
        respondBtn.removeEventListener('click', this._handleRespondClick);
        this._handleRespondClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof modalManager !== 'undefined') {
            modalManager.open('universal', { keepParentModal: true, id: vacancy.id });
          }
        };
        respondBtn.addEventListener('click', this._handleRespondClick);
      }
    }, 50);
  }

  _handleRespondClick(e) {}

  _checkVisibilityAndAddVisibleClass(container) {
    const cards = container.querySelectorAll('.vacancy-card-short');
    const winHeight = window.innerHeight;
    const offset = 100;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.height > 0 && rect.top < winHeight - offset && rect.bottom > offset) {
        card.classList.add('visible');
      }
    });
  }
}

let vacancyRenderer = null;

function initVacanciesPage() {
  if (window._vacanciesPageInitialized) return;
  window._vacanciesPageInitialized = true;

  const grid = document.getElementById('vacanciesGrid');
  if (!grid) { Logger?.ERROR('Контейнер vacanciesGrid не найден'); return; }

  const MAX_RETRIES = 30;
  const RETRY_DELAY_MS = 100;

  const renderWithRetry = (attempt = 0) => {
    if (window.VACANCIES_DATA && Array.isArray(window.VACANCIES_DATA) && window.VACANCIES_DATA.length > 0) {
      if (!vacancyRenderer) vacancyRenderer = new VacancyRenderer(window.VACANCIES_DATA);
      vacancyRenderer.render('vacanciesGrid');
      Logger?.INFO('VacanciesPage рендеринг выполнен');
    } else if (attempt < MAX_RETRIES) {
      setTimeout(() => renderWithRetry(attempt + 1), RETRY_DELAY_MS);
    } else {
      Logger?.ERROR('Данные вакансий не загружены после всех попыток');
      grid.innerHTML = '<p class="no-vacancies">Данные о вакансиях временно недоступны. Пожалуйста, попробуйте позже.</p>';
    }
  };
  renderWithRetry();

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      const container = document.getElementById('vacanciesGrid');
      if (container && window.animationManager) {
        window.animationManager.observeNewElements(container);
        if (vacancyRenderer) vacancyRenderer._checkVisibilityAndAddVisibleClass(container);
      }
    }
  });
}

function destroyVacanciesPage() {
  if (vacancyRenderer) {
    if (vacancyRenderer.container && vacancyRenderer._containerClickHandler) {
      vacancyRenderer.container.removeEventListener('click', vacancyRenderer._containerClickHandler);
    }
    vacancyRenderer = null;
  }
  const grid = document.getElementById('vacanciesGrid');
  if (grid) grid.innerHTML = '';
  window._vacanciesPageInitialized = false;
}

window.initVacanciesPage = initVacanciesPage;
window.destroyVacanciesPage = destroyVacanciesPage;