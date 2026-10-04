/**
 * ComponentLoader - загрузчик общих компонентов (header, footer)
 * Отвечает за подстановку HTML-шаблонов в DOM.
 * Вся логика поведения делегируется специализированным менеджерам.
 *
 * Зависимости:
 * - templates/NavbarTemplate.js
 * - templates/FooterTemplate.js
 * - templates/ModalTemplates.js
 * - managers/PolicyModalManager.js
 * - managers/UniversalApplicationModalManager.js
 */

const ComponentLoader = {
    templates: {
        navbar: typeof NavbarTemplate !== 'undefined' ? NavbarTemplate : '',
        footer: typeof FooterTemplate !== 'undefined' ? FooterTemplate : '',
        proposalModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.proposalModal : '',
        universalApplicationModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.universalApplicationModal : '',
        successModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.successModal : '',
        feedbackModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.feedbackModal : '',
        categoryNewsModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.categoryNewsModal : '',
        projectCategoryModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.projectCategoryModal : '',
        newsModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.newsModal : '',
        projectModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.projectModal : '',
        serviceModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.serviceModal : '',
        errorReportModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.errorReportModal : '',
        vacancyModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.vacancyModal : ''
    },

    init(options = {}, callback = null) {
        const {
            loadNavbar = true,
            loadFooter = true,
            loadModal = true,
            activePage = ''
        } = options;

        // Каждый шаг изолирован: исключение в одном
        // не мешает диспатчу components:loaded.
        if (loadNavbar) {
            try { this._loadNavbar(activePage); }
            catch (e) { Logger.ERROR('ComponentLoader._loadNavbar failed:', e); }
        }
        if (loadModal) {
            try { this._loadModals(); }
            catch (e) { Logger.ERROR('ComponentLoader._loadModals failed:', e); }
        }
        if (loadFooter) {
            try { this._loadFooter(activePage); }
            catch (e) { Logger.ERROR('ComponentLoader._loadFooter failed:', e); }
        }

        document.dispatchEvent(new CustomEvent('components:loaded'));
        if (callback) {
            setTimeout(callback, window.CONFIG?.PERFORMANCE?.COMPONENT_LOAD_DELAY_MS || 50);
        }
    },

    /**
     * Вставляет HTML-строку в родительский элемент.
     * Поддерживает несколько корневых узлов (например, footer + scroll-to-top).
     * Безопасен для пустой строки.
     */
    _appendHtml(parent, html) {
        if (!parent || typeof html !== 'string' || html === '') return;
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        while (wrapper.firstChild) {
            parent.appendChild(wrapper.firstChild);
        }
    },

    _loadNavbar(activePage) {
        let navContainer = document.getElementById('navbar');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'navbar';
            document.body.insertBefore(navContainer, document.body.firstChild);
        }

        if (!navContainer.hasChildNodes()) {
            this._appendHtml(navContainer, this.templates.navbar);
        }

        this.setActiveLink(activePage);

        if (!document.getElementById('mobileMenuOverlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'mobile-menu-overlay';
            overlay.id = 'mobileMenuOverlay';
            document.body.appendChild(overlay);
        }
    },

    _loadFooter(activePage) {
        // Удаляем существующий футер и кнопку «наверх», если они есть
        const existingFooter = document.querySelector('body > footer.footer');
        if (existingFooter) existingFooter.remove();

        const existingScrollToTop = document.querySelector('body > button.scroll-to-top');
        if (existingScrollToTop) existingScrollToTop.remove();

        this._appendHtml(document.body, this.templates.footer);

        this.updateYear();

        if (typeof PolicyModalManager !== 'undefined') {
            PolicyModalManager.init();
        } else {
            Logger.WARN('PolicyModalManager not available');
        }
    },

    _loadModals() {
        const map = [
            ['proposalModalOverlay',             this.templates.proposalModal],
            ['universalApplicationModalOverlay', this.templates.universalApplicationModal],
            ['successModalOverlay',              this.templates.successModal],
            ['feedbackModalOverlay',             this.templates.feedbackModal],
            ['categoryNewsModalOverlay',         this.templates.categoryNewsModal],
            ['projectCategoryModalOverlay',      this.templates.projectCategoryModal],
            ['newsModalOverlay',                 this.templates.newsModal],
            // [ADD] Проект-модалка и модалка услуги — раньше их не было в templates,
            // из-за чего на страницах без статической разметки (#projectModalOverlay)
            // клик по карточке проекта/услуги не открывал модалку.
            ['projectModalOverlay',              this.templates.projectModal],
            ['serviceModalOverlay',              this.templates.serviceModal],
            ['errorReportModalOverlay',          this.templates.errorReportModal],
            ['vacancyModalOverlay',              this.templates.vacancyModal]
        ];

        for (const [overlayId, html] of map) {
            if (!document.getElementById(overlayId) && html) {
                this._appendHtml(document.body, html);
            }
        }

        // Лайтбокс — полная разметка с навигацией и индикаторами.
        if (!document.getElementById('lightboxOverlay')) {
            const lightboxHTML = `
                <div class="lightbox-overlay" id="lightboxOverlay" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
                    <div class="lightbox-content">
                        <button class="lightbox-close" id="lightboxCloseBtn" aria-label="Закрыть">
                            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                        <button class="lightbox-nav lightbox-prev" id="lightboxPrevBtn" aria-label="Предыдущее изображение">
                            <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                        </button>
                        <button class="lightbox-nav lightbox-next" id="lightboxNextBtn" aria-label="Следующее изображение">
                            <svg viewBox="0 0 24 24"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                        </button>
                        <img class="lightbox-image" id="lightboxImage" src="" alt="">
                        <div class="lightbox-indicators" id="lightboxIndicators"></div>
                    </div>
                </div>
            `;
            this._appendHtml(document.body, lightboxHTML);
            Logger.INFO('Lightbox overlay created by ComponentLoader');
        }
    },

    /**
     * Проставляет класс .active ссылкам меню, ведущим на текущую страницу.
     * @param {string} activePage — 'about' | 'services' | '' (главная)
     */
    setActiveLink(activePage) {
        const isHomePage = activePage === '' || activePage === 'index';

        const homeLinkDesktop = document.querySelector('.nav-links .home-link');
        if (homeLinkDesktop) {
            homeLinkDesktop.classList.toggle('hidden', isHomePage);
        }

        const homeLinkMobile = document.querySelector('.mobile-menu .home-link-mobile');
        if (homeLinkMobile) {
            homeLinkMobile.classList.toggle('hidden', isHomePage);
        }

        const matches = (href) => {
            if (!href) return false;
            if (activePage && (href === `/${activePage}` || href === `/${activePage}.html`)) return true;
            if (isHomePage && (href === '/' || href === '/index' || href === '/index.html')) return true;
            return false;
        };

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.toggle('active', matches(link.getAttribute('href')));
        });

        document.querySelectorAll('.mobile-menu a').forEach(link => {
            link.classList.toggle('active', matches(link.getAttribute('href')));
        });
    },

    updateYear() {
        const yearElement = document.getElementById('currentYear');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentLoader;
}