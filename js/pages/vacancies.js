/**
 * Страница вакансий – динамическая генерация карточек (краткие карточки)
 * ООО "ВД Инжиниринг"
 * 
 * Версия с мета-информацией (опыт, формат работы, адрес) и подвалом как в модалке
 * Поддержка строковых ID вакансий
 */
class VacancyRenderer {
    constructor(data) {
        this.data = data;
        this.container = null;
    }

    // ИЗМЕНЕНО: добавлена функция расчёта класса задержки
    _getDelayClass(index, stagger = 50) {
        const delay = index * stagger;
        const rounded = Math.round(delay / 50) * 50;
        const clamped = Math.min(rounded, 900);
        return `delay-${clamped}`;
    }

    /**
     * Извлекает требуемый опыт из списка требований.
     * Ищет фразу "опыт ... от N лет" (между "опыт" и "от" могут быть другие слова).
     * @param {Object} vacancy
     * @returns {string|null} строка вида "Опыт от 5 лет" или null
     */
    _extractExperience(vacancy) {
        const reqs = vacancy.requirements || [];
        for (const req of reqs) {
            const match = req.match(/опыт.*?от\s+(\d+)\s*лет/i);
            if (match) {
                return `Опыт от ${match[1]} лет`;
            }
        }
        return null;
    }

    /**
     * Определяет формат работы из условий
     * @param {Object} vacancy
     * @returns {string|null} "Возможен гибридный формат работы" или null
     */
    _extractWorkFormat(vacancy) {
        const conds = vacancy.conditions || [];
        for (const cond of conds) {
            if (/гибридный|удалённо|удаленно|офис\/дом/i.test(cond)) {
                return 'Возможен гибридный формат работы';
            }
        }
        return null;
    }

    /**
     * Извлекает адрес из условий (город, улица, номер дома)
     * @param {Object} vacancy
     * @returns {string|null} "Москва, Международное шоссе, 28Б" или null
     */
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

    /**
     * Рендеринг всех вакансий в контейнер
     * @param {string} containerId - id контейнера
     */
    render(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        if (!this.data || this.data.length === 0) {
            this.container.innerHTML = '<p class="no-vacancies">Вакансий пока нет</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        this.data.forEach((vacancy, index) => {
            const card = this._createShortCard(vacancy, index);
            fragment.appendChild(card);
        });
        this.container.replaceChildren(fragment);

        // Обработка кликов по карточкам (открытие модалки)
        this.container.addEventListener('click', (e) => {
            const card = e.target.closest('.vacancy-card-short');
            if (!card) return;
            if (e.target.closest('.btn-primary')) return;
            const id = card.dataset.vacancyId;
            if (id) {
                this._openVacancyModal(id);
            }
        });

        // Синхронная проверка видимости
        this._checkVisibilityAndAddVisibleClass(this.container);

        // Добавление в IntersectionObserver для анимации
        if (window.animationManager && typeof window.animationManager.observeNewElements === 'function') {
            window.animationManager.observeNewElements(this.container);
        }
    }

    /**
     * Создаёт карточку вакансии (краткий вариант)
     * @param {Object} vacancy
     * @param {number} index
     * @returns {HTMLElement}
     */
    _createShortCard(vacancy, index) {
        const sanitizer = window.Utils?.Sanitizer;
        const safeTitle = sanitizer ? sanitizer.escapeHtml(vacancy.title) : vacancy.title;
        const safeDept = sanitizer ? sanitizer.escapeHtml(vacancy.department) : vacancy.department;

        const card = document.createElement('div');
        card.className = 'vacancy-card-short animate-on-scroll fade-up';
        // ИЗМЕНЕНО: вместо style.animationDelay добавляем класс задержки
        const delayClass = this._getDelayClass(index, 50);
        card.classList.add(delayClass);
        card.dataset.vacancyId = vacancy.id;
        card.dataset.once = 'true';

        // --- HEADER ---
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

        // --- МЕТА-ИНФОРМАЦИЯ (опыт, формат работы, адрес) ---
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

        // Вставляем мета-блок после заголовка, перед обязанностями
        if (metaDiv.children.length > 0) {
            const responsibilities = card.querySelector('.vacancy-short-responsibilities');
            if (responsibilities) {
                card.insertBefore(metaDiv, responsibilities);
            } else {
                const actions = card.querySelector('.vacancy-actions') || card.querySelector('.vacancy-card-footer');
                if (actions) {
                    card.insertBefore(metaDiv, actions);
                } else {
                    card.appendChild(metaDiv);
                }
            }
        }

        // --- ОБЯЗАННОСТИ (все пункты) ---
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

        // --- ПОДВАЛ (кнопка "Откликнуться") ---
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

    /**
     * Открывает модальное окно с полной информацией о вакансии
     * @param {string} vacancyId - строковый ID вакансии
     */
    _openVacancyModal(vacancyId) {
        const vacancy = this.data.find(v => String(v.id) === String(vacancyId));
        if (!vacancy) {
            Logger?.WARN(`Вакансия с id ${vacancyId} не найдена`);
            return;
        }

        const titleEl = document.getElementById('vacancyModalTitle');
        const deptEl = document.getElementById('vacancyModalDepartment');
        const bodyEl = document.getElementById('vacancyModalBody');

        if (titleEl) titleEl.textContent = vacancy.title;
        if (deptEl) deptEl.textContent = vacancy.department;

        if (bodyEl) {
            const content = document.createElement('div');
            content.className = 'vacancy-details';

            if (vacancy.responsibilities && vacancy.responsibilities.length) {
                const respDiv = document.createElement('div');
                const items = vacancy.responsibilities.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
                respDiv.innerHTML = `<h4>Обязанности:</h4><ul>${items}</ul>`;
                content.appendChild(respDiv);
            }

            if (vacancy.requirements && vacancy.requirements.length) {
                const reqDiv = document.createElement('div');
                const items = vacancy.requirements.map(r => `<li>${Utils.Sanitizer.escapeHtml(r)}</li>`).join('');
                reqDiv.innerHTML = `<h4>Требования:</h4><ul>${items}</ul>`;
                content.appendChild(reqDiv);
            }

            if (vacancy.conditions && vacancy.conditions.length) {
                const condDiv = document.createElement('div');
                const items = vacancy.conditions.map(c => `<li>${Utils.Sanitizer.escapeHtml(c)}</li>`).join('');
                condDiv.innerHTML = `<h4>Условия:</h4><ul>${items}</ul>`;
                content.appendChild(condDiv);
            }

            bodyEl.replaceChildren(content);
        }

        if (typeof modalManager !== 'undefined') {
            modalManager.open('vacancy', { id: vacancy.id });
        } else {
            Logger?.ERROR('modalManager не определён');
        }

        // Обработчик для кнопки "Откликнуться" внутри модалки
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
                        modalManager.open('universal', {
                            keepParentModal: true,
                            id: vacancy.id
                        });
                    }
                };
                respondBtn.addEventListener('click', this._handleRespondClick);
            }
        }, 50);
    }

    /**
     * Заглушка для обработчика клика по кнопке отклика (переопределяется в _openVacancyModal)
     */
    _handleRespondClick(e) {}

    /**
     * Проверяет видимость карточек и добавляет класс visible для уже видимых
     * @param {HTMLElement} container
     */
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

// ===== Глобальная инициализация =====
let vacancyRenderer = null;

/**
 * Инициализация страницы вакансий
 */
function initVacanciesPage() {
    const grid = document.getElementById('vacanciesGrid');
    if (!grid) {
        Logger?.ERROR('Контейнер vacanciesGrid не найден');
        return;
    }

    const MAX_RETRIES = 30;
    const RETRY_DELAY_MS = 100;

    const renderWithRetry = (attempt = 0) => {
        if (window.VACANCIES_DATA && Array.isArray(window.VACANCIES_DATA) && window.VACANCIES_DATA.length > 0) {
            if (!vacancyRenderer) {
                vacancyRenderer = new VacancyRenderer(window.VACANCIES_DATA);
            }
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
                if (vacancyRenderer) {
                    vacancyRenderer._checkVisibilityAndAddVisibleClass(container);
                }
            }
        }
    });
}

/**
 * Очистка ресурсов страницы вакансий
 */
function destroyVacanciesPage() {
    if (vacancyRenderer) {
        vacancyRenderer = null;
    }
    const grid = document.getElementById('vacanciesGrid');
    if (grid) grid.innerHTML = '';
    window._vacanciesPageInitialized = false;
}

// Экспорт в глобальную область
window.initVacanciesPage = initVacanciesPage;
window.destroyVacanciesPage = destroyVacanciesPage;