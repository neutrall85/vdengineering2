/**
 * SearchManager – управление поиском по сайту
 * ООО "ВД Инжиниринг"
 * 
 * Автоматический сбор индекса:
 * - статические страницы (загружаются через fetch, извлекается meta-description)
 * - динамические данные (NEWS_DATA, PROJECTS_DATA, VACANCIES_DATA, SERVICES_DATA, POLICY_DOCUMENTS)
 * - текст из шаблонов навбара и футера (добавляется в контент главной страницы)
 * 
 * Поддержка поиска по фразе в кавычках (точное совпадение)
 * Кэширование индекса в localStorage
 * 
 * Функция преобразования раскладки (русская ↔ английская)
 * Поиск выполняется по всем вариантам раскладки, результаты объединяются.
 * В заголовке отображаются все запросы, по которым были найдены результаты (каждый в кавычках).
 * При переходе на страницу подсвечиваются все найденные варианты.
 */
class SearchManager {
    constructor() {
        this.index = null;
        this.searchInput = null;
        this.form = null;
        this.resultsContainer = null;
        this._boundSubmitHandler = null;
        this._boundPopStateHandler = null;
        this._isIndexBuilt = false;
        this._isBuilding = false;
        this._buildPromise = null;
        
        // Список статических страниц для индексации
        this.staticPages = [
            { url: '/', title: 'Главная' },
            { url: '/about', title: 'О компании' },
            { url: '/services', title: 'Компетенции' },
            { url: '/news', title: 'Новости' },
            { url: '/projects', title: 'Проекты' },
            { url: '/docs', title: 'Документы' },
            { url: '/vacancies', title: 'Вакансии' },
            { url: '/partners', title: 'Партнёры' },
            { url: '/contacts', title: 'Контакты' },
            { url: '/feedback', title: 'Обратная связь' }
        ];
        
        this.cacheKey = 'search_index_v2';
        this.cacheTTL = 24 * 60 * 60 * 1000; // 24 часа

        // ========== Карта преобразования раскладки ==========
        this.layoutMap = {
            // Русская → Английская
            'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']',
            'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j', 'л': 'k', 'д': 'l', 'ж': ';', 'э': "'",
            'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', 'ё': '`',
            // Английская → Русская (обратная)
            'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ',
            'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж', "'": 'э',
            'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '`': 'ё'
        };
    }

    /**
     * Преобразование раскладки строки
     * @param {string} text - исходный текст
     * @param {string} direction - 'ru-en' или 'en-ru'
     * @returns {string} преобразованный текст
     */
    convertLayout(text, direction = 'ru-en') {
        if (!text) return text;
        text = text.toLowerCase();
        const map = this.layoutMap;
        return text.split('').map(ch => {
            if (direction === 'ru-en') {
                return map[ch] || ch;
            } else { // en-ru
                const entry = Object.entries(map).find(([key, val]) => val === ch && key !== val);
                return entry ? entry[0] : ch;
            }
        }).join('');
    }

    /**
     * Инициализация поиска
     */
    init() {
        if (this._loadFromCache()) {
            Logger.INFO('Search index loaded from cache');
        } else {
            this.ensureIndex();
        }

        const footerSearch = document.getElementById('footerSearchForm');
        if (footerSearch) this._initFooterSearch(footerSearch);

        const pageSearch = document.getElementById('searchForm');
        if (pageSearch) this._initPageSearch(pageSearch);

        this._boundPopStateHandler = this._handlePopState.bind(this);
        window.addEventListener('popstate', this._boundPopStateHandler);

        if (window.location.pathname === '/search' || window.location.pathname === '/search.html') {
            const params = new URLSearchParams(window.location.search);
            const query = params.get('q');
            if (query && query.trim()) {
                setTimeout(() => this._performSearch(query.trim()), 50);
            }
        }

        document.addEventListener('components:loaded', () => {
            this.reindex();
        });
    }

    /**
     * Построение индекса – асинхронное, с кэшированием
     */
    async ensureIndex() {
        if (this._isBuilding) return this._buildPromise;
        if (this._isIndexBuilt && this.index && this.index.length > 0) return this.index;

        this._isBuilding = true;
        this._buildPromise = this._buildIndex();
        await this._buildPromise;
        this._isBuilding = false;
        return this.index;
    }

    async _buildIndex() {
        const startTime = performance.now();
        Logger.INFO('Building search index...');

        const index = [];

        // 1. Статические страницы – загружаем через fetch
        await this._fetchStaticPages(index);

        // 2. Динамические данные
        this._addNewsData(index);
        this._addProjectsData(index);
        this._addVacanciesData(index);
        this._addServicesData(index);
        this._addPolicyDocuments(index);

        // 3. Текст из шаблонов (навбар, футер) – добавляем к главной странице
        this._enrichWithTemplates(index);

        this.index = index;
        this._isIndexBuilt = true;

        this._saveToCache(index);

        Logger.INFO(`Search index built with ${index.length} entries in ${Math.round(performance.now() - startTime)}ms`);
        return index;
    }

    async _fetchStaticPages(index) {
        const fetchPromises = this.staticPages.map(page => 
            fetch(page.url, { cache: 'force-cache' })
                .then(res => res.text())
                .then(html => ({ ...page, html }))
                .catch(err => {
                    Logger.WARN(`Failed to fetch ${page.url}:`, err);
                    return null;
                })
        );

        const results = await Promise.all(fetchPromises);
        for (const result of results) {
            if (!result) continue;
            const { url, title, html } = result;
            const extracted = this._extractTextFromHtml(html);
            if (extracted.content) {
                index.push({
                    url: url,
                    title: title,
                    description: extracted.description || extracted.content.slice(0, 200) + '...',
                    keywords: '',
                    content: extracted.content
                });
            }
        }
    }

    _extractTextFromHtml(html, keepNavigation = false) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        if (!keepNavigation) {
            const selectorsToRemove = [
                'script', 'style', 'noscript',
                '#navbar', '.navbar', 'nav',
                'footer', '.footer',
                '#pageLoader', '.page-loader',
                '#appError', '.app-error',
                '.no-js-header', '.no-js-nav'
            ];
            selectorsToRemove.forEach(sel => {
                doc.querySelectorAll(sel).forEach(el => el.remove());
            });
        }

        let metaDescription = '';
        const metaTag = doc.querySelector('meta[name="description"]');
        if (metaTag) {
            metaDescription = metaTag.getAttribute('content') || '';
        }

        const body = doc.body;
        if (!body) return { content: '', description: metaDescription };

        const textParts = [];
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest('.hidden, [hidden]')) return NodeFilter.FILTER_REJECT;
                const text = node.textContent.trim();
                if (text.length < 10) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let node;
        let allText = '';
        while ((node = walker.nextNode())) {
            const text = node.textContent.trim();
            if (text) {
                allText += ' ' + text;
            }
        }
        allText = allText.replace(/\s+/g, ' ').trim();

        let description = metaDescription;
        if (!description && allText) {
            description = allText.slice(0, 200) + '...';
        }

        return { content: allText, description: description };
    }

    _addNewsData(index) {
        if (!window.NEWS_DATA) return;
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
                    const content = contentParts.join(' ');
                    index.push({
                        url: `/news/${news.id}`,
                        title: news.title || '',
                        description: news.excerpt || content.slice(0, 200) + '...',
                        keywords: news.category || '',
                        content: content
                    });
                });
            }
        });
    }

    _addProjectsData(index) {
        if (!window.PROJECTS_DATA) return;
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
                description: project.shortDescription || content.slice(0, 200) + '...',
                keywords: project.category || '',
                content: content
            });
        });
    }

    _addVacanciesData(index) {
        if (!window.VACANCIES_DATA || !Array.isArray(window.VACANCIES_DATA)) return;
        window.VACANCIES_DATA.forEach(vacancy => {
            const contentParts = [];
            if (vacancy.requirements) contentParts.push(vacancy.requirements.join(' '));
            if (vacancy.responsibilities) contentParts.push(vacancy.responsibilities.join(' '));
            if (vacancy.conditions) contentParts.push(vacancy.conditions.join(' '));
            const content = contentParts.join(' ');
            index.push({
                url: `/vacancies`,
                title: vacancy.title || '',
                description: vacancy.department || content.slice(0, 200) + '...',
                keywords: vacancy.department || '',
                content: content
            });
        });
    }

    _addServicesData(index) {
        if (!window.SERVICES_DATA) return;
        Object.values(window.SERVICES_DATA).forEach(service => {
            const detailsText = (service.details || []).join(' ');
            const content = [
                service.shortDescription || '',
                detailsText
            ].join(' ');
            index.push({
                url: `/services`,
                title: service.title || '',
                description: service.shortDescription || content.slice(0, 200) + '...',
                keywords: service.category || '',
                content: content
            });
        });
    }

    _addPolicyDocuments(index) {
        if (!window.POLICY_DOCUMENTS) return;
        Object.entries(window.POLICY_DOCUMENTS).forEach(([key, policy]) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = policy.content;
            const textContent = tempDiv.textContent || '';
            index.push({
                url: `/policy/${key}`,
                title: policy.title || key,
                description: `Политика: ${policy.title}`,
                keywords: key,
                content: textContent,
                isPolicy: true,
                policyKey: key
            });
        });
    }

    _enrichWithTemplates(index) {
        let homeEntry = index.find(entry => entry.url === '/');
        if (!homeEntry) {
            homeEntry = {
                url: '/',
                title: 'Главная',
                description: '',
                keywords: '',
                content: ''
            };
            index.push(homeEntry);
        }

        if (typeof NavbarTemplate !== 'undefined') {
            const navText = this._extractTextFromHtml(NavbarTemplate, true);
            if (navText.content) homeEntry.content += ' ' + navText.content;
        }

        if (typeof FooterTemplate !== 'undefined') {
            const footerText = this._extractTextFromHtml(FooterTemplate, true);
            if (footerText.content) homeEntry.content += ' ' + footerText.content;
        }

        homeEntry.content = homeEntry.content.trim();
        if (!homeEntry.description) {
            homeEntry.description = homeEntry.content.slice(0, 200) + '...';
        }
    }

    _saveToCache(index) {
        try {
            const data = {
                timestamp: Date.now(),
                index: index
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
        } catch (e) {
            Logger.WARN('Failed to cache search index:', e);
        }
    }

    _loadFromCache() {
        try {
            const raw = localStorage.getItem(this.cacheKey);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (!data.timestamp || !data.index) return false;
            if (Date.now() - data.timestamp > this.cacheTTL) {
                localStorage.removeItem(this.cacheKey);
                return false;
            }
            this.index = data.index;
            this._isIndexBuilt = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    reindex() {
        this.index = null;
        this._isIndexBuilt = false;
        localStorage.removeItem(this.cacheKey);
        this.ensureIndex();
        Logger.INFO('Search index rebuilt');
    }

    // ========== Методы поиска (изменены для поддержки раскладки) ==========

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
        if (input.value.trim()) this._performSearch(input.value.trim());
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
        if (query && query.trim()) this._performSearch(query.trim());
        else this._clearResults();
    }

    async _performSearch(query) {
        if (!this.resultsContainer) {
            const container = document.getElementById('searchResults');
            if (container) this.resultsContainer = container;
            else return;
        }
        await this.ensureIndex();
        const result = this.search(query);
        this._currentHighlightQuery = result.highlightQuery;
        this._renderResults(result.results, result.displayQueries, result.highlightQuery);
    }

    // ========== ОСНОВНОЙ МЕТОД ПОИСКА (с преобразованием раскладки) ==========
    search(query) {
        if (!this.index || !this.index.length) return { results: [], displayQueries: [query], originalQuery: query };

        const originalQuery = query.trim();
        if (!originalQuery) return { results: [], displayQueries: [query], originalQuery: query };

        // Генерируем варианты запросов
        const queries = [originalQuery];
        let convertedQuery = null;

        // Если запрос только из латиницы, добавляем преобразованный в кириллицу
        if (/^[a-z\s]+$/i.test(originalQuery)) {
            convertedQuery = this.convertLayout(originalQuery, 'en-ru');
            if (convertedQuery && convertedQuery !== originalQuery.toLowerCase()) {
                queries.push(convertedQuery);
            }
        }
        // Если запрос только из кириллицы, добавляем преобразованный в латиницу (опционально)
        else if (/^[а-яё\s]+$/i.test(originalQuery)) {
            convertedQuery = this.convertLayout(originalQuery, 'ru-en');
            if (convertedQuery && convertedQuery !== originalQuery.toLowerCase()) {
                queries.push(convertedQuery);
            }
        }

        // Выполняем поиск по каждому запросу и объединяем результаты
        const resultsMap = new Map(); // url -> { item, score }
        let foundInOriginal = false;
        let foundInConverted = false;

        for (const q of queries) {
            const parsed = this._parseQuery(q);
            const { phrases, words } = parsed;
            if (phrases.length === 0 && words.length === 0) continue;

            for (const item of this.index) {
                const searchText = [
                    item.title,
                    item.keywords,
                    item.content
                ].join(' ').toLowerCase();

                let score = 0;

                for (const phrase of phrases) {
                    const lowerPhrase = phrase.toLowerCase();
                    if (searchText.includes(lowerPhrase)) {
                        score += 50;
                        if (item.title.toLowerCase().includes(lowerPhrase)) score += 30;
                        if (item.description && item.description.toLowerCase().includes(lowerPhrase)) score += 20;
                        if (item.keywords && item.keywords.toLowerCase().includes(lowerPhrase)) score += 15;
                    }
                }

                for (const word of words) {
                    const lowerWord = word.toLowerCase();
                    if (searchText.includes(lowerWord)) {
                        score += 1;
                        if (item.title.toLowerCase().includes(lowerWord)) {
                            score += 2;
                            if (item.title.toLowerCase().startsWith(lowerWord)) score += 1;
                        }
                        if (item.keywords && item.keywords.toLowerCase().includes(lowerWord)) score += 1.5;
                    }
                }

                if (score > 0) {
                    if (resultsMap.has(item.url)) {
                        const existing = resultsMap.get(item.url);
                        if (score > existing.score) {
                            resultsMap.set(item.url, { ...item, score });
                        }
                    } else {
                        resultsMap.set(item.url, { ...item, score });
                    }
                    // Запоминаем, в каком запросе нашли
                    if (q === originalQuery) foundInOriginal = true;
                    if (q === convertedQuery) foundInConverted = true;
                }
            }
        }

        const results = Array.from(resultsMap.values());
        results.sort((a, b) => b.score - a.score);

        // Формируем displayQueries и highlightQuery
        let displayQueries = [];
        let highlightQuery = originalQuery;

        if (foundInOriginal && foundInConverted && convertedQuery) {
            displayQueries = [originalQuery, convertedQuery];
            highlightQuery = `${originalQuery} ${convertedQuery}`;
        } else if (foundInOriginal) {
            displayQueries = [originalQuery];
            highlightQuery = originalQuery;
        } else if (foundInConverted && convertedQuery) {
            displayQueries = [convertedQuery];
            highlightQuery = convertedQuery;
        } else {
            displayQueries = [originalQuery];
            highlightQuery = originalQuery;
        }

        // Приводим короткие русские аббревиатуры к верхнему регистру
        displayQueries = displayQueries.map(q => {
            if (/^[а-яё]{2,4}$/i.test(q) && !foundInOriginal) {
                return q.toUpperCase();
            }
            return q;
        });

        // Если только один запрос и он был преобразован, highlightQuery обновляем
        if (displayQueries.length === 1 && displayQueries[0] !== originalQuery) {
            highlightQuery = displayQueries[0];
        }

        return { results, displayQueries, originalQuery, highlightQuery };
    }

    _parseQuery(query) {
        const trimmed = query.trim();
        if (!trimmed) return { phrases: [], words: [] };

        const phrases = [];
        const regex = /["']([^"']*)["']/g;
        let match;

        while ((match = regex.exec(trimmed)) !== null) {
            const phrase = match[1].trim();
            if (phrase) phrases.push(phrase);
        }

        const withoutQuotes = trimmed.replace(/["']/g, '');
        const allWords = withoutQuotes.split(/\s+/).filter(w => w.length > 1);

        const wordsSet = new Set(allWords);
        for (const phrase of phrases) {
            const phraseWords = phrase.split(/\s+/);
            for (const word of phraseWords) {
                wordsSet.delete(word);
            }
        }

        return { phrases, words: Array.from(wordsSet) };
    }

    /**
     * Определяет, является ли URL модальным (открывается в модалке, а не переходом)
     */
    _isModalUrl(url) {
        if (!url) return false;
        return /^\/(news|projects|policy|category|project-category)\//.test(url);
    }

    /**
     * Открывает модалку по URL с переданным highlightQuery
     */
    _openModalByUrl(url, highlightQuery) {
        const match = url.match(/^\/(news|projects|policy|category|project-category)\/(.+)/);
        if (!match) return false;
        const [, type, id] = match;

        if (type === 'policy') {
            if (typeof PolicyModalManager !== 'undefined') {
                PolicyModalManager.openPolicyModal(id);
                if (highlightQuery) {
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('highlight', highlightQuery);
                    window.history.pushState({ modal: 'policy', key: id, highlight: highlightQuery }, '', currentUrl);
                }
                return true;
            }
            return false;
        }

        if (typeof modalManager === 'undefined') return false;

        if (type === 'news') {
            const allNews = Object.values(window.NEWS_DATA || {}).flat();
            const news = allNews.find(n => String(n.id) === String(id));
            if (news) {
                modalManager.openNewsById(id);
                if (highlightQuery) {
                    const currentUrl = new URL(window.location);
                    currentUrl.searchParams.set('highlight', highlightQuery);
                    window.history.pushState({ modal: 'news', id: id, highlight: highlightQuery }, '', currentUrl);
                }
                return true;
            }
        } else if (type === 'projects') {
            modalManager.openProjectById(id);
            if (highlightQuery) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('highlight', highlightQuery);
                window.history.pushState({ modal: 'project', id: id, highlight: highlightQuery }, '', currentUrl);
            }
            return true;
        } else if (type === 'category') {
            modalManager.openCategoryByName(decodeURIComponent(id));
            if (highlightQuery) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('highlight', highlightQuery);
                window.history.pushState({ modal: 'category', id: id, highlight: highlightQuery }, '', currentUrl);
            }
            return true;
        } else if (type === 'project-category') {
            modalManager.openProjectCategoryByName(decodeURIComponent(id));
            if (highlightQuery) {
                const currentUrl = new URL(window.location);
                currentUrl.searchParams.set('highlight', highlightQuery);
                window.history.pushState({ modal: 'project-category', id: id, highlight: highlightQuery }, '', currentUrl);
            }
            return true;
        }
        return false;
    }

    _renderResults(results, displayQueries, highlightQuery) {
        if (!this.resultsContainer) return;

        const displayQueriesSafe = displayQueries.map(q => `«${this._escapeHtml(q)}»`).join(', ');

        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-empty">
                    <p>По запросу ${displayQueriesSafe} ничего не найдено.</p>
                    <p>Попробуйте изменить формулировку запроса.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        const header = document.createElement('div');
        header.className = 'search-results-header';
        header.innerHTML = `<p>Найдено <strong>${results.length}</strong> результатов по запросу <strong>${displayQueriesSafe}</strong></p>`;
        fragment.appendChild(header);

        results.forEach(item => {
            const card = document.createElement('div');
            card.className = 'search-result-card';

            const isModal = this._isModalUrl(item.url);

            if (item.isPolicy && item.policyKey) {
                const titleSpan = document.createElement('span');
                titleSpan.className = 'search-result-title policy-link';
                titleSpan.textContent = item.title;
                titleSpan.style.cursor = 'pointer';
                titleSpan.style.color = 'var(--vd)';
                titleSpan.style.textDecoration = 'underline';
                titleSpan.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (typeof PolicyModalManager !== 'undefined') {
                        const url = new URL(window.location);
                        url.searchParams.set('highlight', highlightQuery);
                        window.history.pushState({ modal: 'policy', key: item.policyKey, highlight: highlightQuery }, '', url);
                        PolicyModalManager.openPolicyModal(item.policyKey);
                    }
                });

                const urlSpan = document.createElement('div');
                urlSpan.className = 'search-result-url';
                urlSpan.textContent = `Политика: ${item.title}`;
                const desc = document.createElement('p');
                desc.className = 'search-result-desc';
                desc.textContent = item.description || '';

                card.appendChild(titleSpan);
                card.appendChild(urlSpan);
                if (desc.textContent) card.appendChild(desc);
            } else if (isModal) {
                const titleSpan = document.createElement('span');
                titleSpan.className = 'search-result-title modal-link';
                titleSpan.textContent = item.title;
                titleSpan.style.cursor = 'pointer';
                titleSpan.style.color = 'var(--vd)';
                titleSpan.style.textDecoration = 'underline';
                titleSpan.addEventListener('click', (e) => {
                    e.preventDefault();
                    this._openModalByUrl(item.url, highlightQuery);
                });

                const urlSpan = document.createElement('div');
                urlSpan.className = 'search-result-url';
                urlSpan.textContent = item.url;
                const desc = document.createElement('p');
                desc.className = 'search-result-desc';
                desc.textContent = item.description || '';

                card.appendChild(titleSpan);
                card.appendChild(urlSpan);
                if (desc.textContent) card.appendChild(desc);
            } else {
                const link = document.createElement('a');
                let url = item.url;
                const separator = url.includes('?') ? '&' : '?';
                url += `${separator}highlight=${encodeURIComponent(highlightQuery)}`;
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
            }

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
            forms.forEach(form => form.removeEventListener('submit', this._boundSubmitHandler));
            this._boundSubmitHandler = null;
        }
        if (this._boundPopStateHandler) {
            window.removeEventListener('popstate', this._boundPopStateHandler);
            this._boundPopStateHandler = null;
        }
        this.searchInput = null;
        this.resultsContainer = null;
        this.index = null;
        this._isIndexBuilt = false;
    }
}

if (typeof window !== 'undefined') {
    window.SearchManager = SearchManager;
}