/**
 * SearchManager – управление поиском по сайту
 * ООО "Волга-Днепр Инжиниринг"
 * 
 * Динамический индекс: автоматически собирает данные из NEWS_DATA, PROJECTS_DATA,
 * VACANCIES_DATA, SERVICES_DATA и статических страниц SEARCH_DATA.
 * Гарантирует поиск по всем словам на сайте.
 */
class SearchManager {
    constructor() {
        this.index = null;
        this.searchInput = null;
        this.form = null;
        this.resultsContainer = null;
        this._boundSubmitHandler = null;
        this._boundPopStateHandler = null;
    }

    /**
     * Построение индекса из всех доступных данных
     */
    buildIndex() {
        const index = [];

        // 1. Статические страницы (SEARCH_DATA)
        if (window.SEARCH_DATA && Array.isArray(window.SEARCH_DATA)) {
            window.SEARCH_DATA.forEach(page => {
                index.push({
                    url: page.url,
                    title: page.title || '',
                    description: page.description || '',
                    keywords: page.keywords || '',
                    content: page.content || ''
                });
            });
        }

        // 2. Новости (NEWS_DATA)
        if (window.NEWS_DATA) {
            Object.values(window.NEWS_DATA).forEach(yearNews => {
                if (Array.isArray(yearNews)) {
                    yearNews.forEach(news => {
                        const contentParts = [];
                        if (news.content) {
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = news.content;
                            contentParts.push(tempDiv.textContent || '');
                        }
                        if (news.excerpt) contentParts.push(news.excerpt);
                        index.push({
                            url: `/news/${news.id}`,
                            title: news.title || '',
                            description: news.excerpt || '',
                            keywords: news.category || '',
                            content: contentParts.join(' ')
                        });
                    });
                }
            });
        }

        // 3. Проекты (PROJECTS_DATA)
        if (window.PROJECTS_DATA) {
            Object.entries(window.PROJECTS_DATA).forEach(([id, project]) => {
                const detailsText = (project.details || []).join(' ');
                const content = [
                    project.shortDescription || '',
                    detailsText,
                    (project.images || []).join(' ')
                ].join(' ');
                index.push({
                    url: `/projects/${id}`,
                    title: project.title || '',
                    description: project.shortDescription || '',
                    keywords: project.category || '',
                    content: content
                });
            });
        }

        // 4. Вакансии (VACANCIES_DATA)
        if (window.VACANCIES_DATA && Array.isArray(window.VACANCIES_DATA)) {
            window.VACANCIES_DATA.forEach(vacancy => {
                const contentParts = [];
                if (vacancy.requirements) contentParts.push(vacancy.requirements.join(' '));
                if (vacancy.responsibilities) contentParts.push(vacancy.responsibilities.join(' '));
                if (vacancy.conditions) contentParts.push(vacancy.conditions.join(' '));
                index.push({
                    url: `/vacancies`,
                    title: vacancy.title || '',
                    description: vacancy.department || '',
                    keywords: vacancy.department || '',
                    content: contentParts.join(' ')
                });
            });
        }

        // 5. Услуги (SERVICES_DATA)
        if (window.SERVICES_DATA) {
            Object.values(window.SERVICES_DATA).forEach(service => {
                const detailsText = (service.details || []).join(' ');
                const content = [
                    service.shortDescription || '',
                    detailsText
                ].join(' ');
                index.push({
                    url: `/services`,
                    title: service.title || '',
                    description: service.shortDescription || '',
                    keywords: service.category || '',
                    content: content
                });
            });
        }

        this.index = index;
        return this.index;
    }

    init() {
        this.buildIndex();

        const footerSearch = document.getElementById('footerSearchForm');
        if (footerSearch) {
            this._initFooterSearch(footerSearch);
        }

        const pageSearch = document.getElementById('searchForm');
        if (pageSearch) {
            this._initPageSearch(pageSearch);
        }

        // Обработка popstate для обновления результатов при навигации назад/вперёд
        this._boundPopStateHandler = this._handlePopState.bind(this);
        window.addEventListener('popstate', this._boundPopStateHandler);

        // Если мы на странице /search, выполняем поиск по параметру URL
        if (window.location.pathname === '/search' || window.location.pathname === '/search.html') {
            const params = new URLSearchParams(window.location.search);
            const query = params.get('q');
            if (query && query.trim()) {
                setTimeout(() => {
                    this._performSearch(query.trim());
                }, 50);
            }
        }
    }

    _initFooterSearch(form) {
        const input = form.querySelector('input[name="q"]');
        if (!input) return;
        this.searchInput = input;
        this._boundSubmitHandler = (e) => this._handleFooterSubmit(e);
        form.addEventListener('submit', this._boundSubmitHandler);
    }

    _initPageSearch(form) {
        const input = form.querySelector('input[name="q"]');
        const results = document.getElementById('searchResults');
        if (!input || !results) return;
        this.searchInput = input;
        this.resultsContainer = results;
        this._boundSubmitHandler = (e) => this._handlePageSubmit(e);
        form.addEventListener('submit', this._boundSubmitHandler);
        if (input.value.trim()) {
            this._performSearch(input.value.trim());
        }
    }

    _handleFooterSubmit(e) {
        e.preventDefault();
        const query = this.searchInput ? this.searchInput.value.trim() : '';
        if (!query) return;
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
    }

    _handlePageSubmit(e) {
        e.preventDefault();
        const query = this.searchInput ? this.searchInput.value.trim() : '';
        if (!query) {
            this._clearResults();
            const url = new URL(window.location);
            url.searchParams.delete('q');
            window.history.pushState({}, '', url);
            return;
        }
        const url = new URL(window.location);
        url.searchParams.set('q', query);
        window.history.pushState({ query: query }, '', url);
        this._performSearch(query);
    }

    _handlePopState() {
        const params = new URLSearchParams(window.location.search);
        const query = params.get('q');
        if (query && query.trim()) {
            this._performSearch(query.trim());
        } else {
            this._clearResults();
        }
    }

    _performSearch(query) {
        if (!this.resultsContainer) {
            const container = document.getElementById('searchResults');
            if (container) {
                this.resultsContainer = container;
            } else {
                return;
            }
        }
        const results = this.search(query);
        this._renderResults(results, query);
    }

    search(query) {
        if (!query || !this.index || !this.index.length) return [];
        const q = query.toLowerCase().trim();
        const words = q.split(/\s+/).filter(w => w.length > 1);
        if (words.length === 0) return [];

        const scored = this.index.map(item => {
            let score = 0;
            const searchText = [
                item.title,
                item.description,
                item.keywords,
                item.content,
                item.url
            ].join(' ').toLowerCase();

            words.forEach(word => {
                if (searchText.includes(word)) score += 1;
                const titleLower = item.title.toLowerCase();
                if (titleLower.includes(word)) {
                    score += 2;
                    if (titleLower.startsWith(word)) score += 1;
                }
                if (item.keywords.toLowerCase().includes(word)) score += 1.5;
                if (titleLower.split(/\s+/).some(w => w === word)) score += 1;
            });

            return { ...item, score };
        });

        const filtered = scored.filter(item => item.score > 0);
        filtered.sort((a, b) => b.score - a.score);
        return filtered;
    }

    _renderResults(results, query) {
        if (!this.resultsContainer) return;
        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <p>По запросу «<strong>${this._escapeHtml(query)}</strong>» ничего не найдено.</p>
                    <p>Попробуйте изменить формулировку запроса.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        const header = document.createElement('div');
        header.className = 'search-results-header';
        header.innerHTML = `<p>Найдено <strong>${results.length}</strong> результатов по запросу «<strong>${this._escapeHtml(query)}</strong>»</p>`;
        fragment.appendChild(header);

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'search-result-card';

            const link = document.createElement('a');
            // Добавляем параметр highlight для подсветки
            let url = item.url;
            const separator = url.includes('?') ? '&' : '?';
            url += `${separator}highlight=${encodeURIComponent(query)}`;
            link.href = url;
            link.className = 'search-result-title';
            link.textContent = item.title;

            const urlSpan = document.createElement('div');
            urlSpan.className = 'search-result-url';
            urlSpan.textContent = item.url;

            const desc = document.createElement('p');
            desc.className = 'search-result-desc';
            desc.textContent = item.description || '';

            card.appendChild(link);
            card.appendChild(urlSpan);
            if (desc.textContent) card.appendChild(desc);
            fragment.appendChild(card);
        });

        this.resultsContainer.replaceChildren(fragment);
    }

    _clearResults() {
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <p>Введите поисковый запрос.</p>
                </div>
            `;
        }
    }

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    destroy() {
        if (this._boundSubmitHandler) {
            const forms = document.querySelectorAll('#footerSearchForm, #searchForm');
            forms.forEach(form => {
                form.removeEventListener('submit', this._boundSubmitHandler);
            });
            this._boundSubmitHandler = null;
        }
        if (this._boundPopStateHandler) {
            window.removeEventListener('popstate', this._boundPopStateHandler);
            this._boundPopStateHandler = null;
        }
        this.searchInput = null;
        this.resultsContainer = null;
        this.index = null;
    }
}

if (typeof window !== 'undefined') {
    window.SearchManager = SearchManager;
}