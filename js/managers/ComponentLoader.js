/**
 * ComponentLoader - загрузчик общих компонентов (header, footer)
 * Отвечает за подстановку HTML-шаблонов в DOM.
 * Вся логика поведения делегируется специализированным менеджерам.
 * 
 * Зависимости:
 * - templates/ComponentTemplates.js
 * - templates/ModalTemplates.js
 * - managers/PolicyModalManager.js
 * - managers/UniversalApplicationModalManager.js
 */

const ComponentLoader = {
    templates: {
        navbar: typeof ComponentTemplates !== 'undefined' ? ComponentTemplates.navbar : '',
        footer: typeof ComponentTemplates !== 'undefined' ? ComponentTemplates.footer : '',
        proposalModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.proposalModal : '',
        universalApplicationModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.universalApplicationModal : '',
        successModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.successModal : '',
        feedbackModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.feedbackModal : '',
        categoryNewsModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.categoryNewsModal : '',
        projectCategoryModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.projectCategoryModal : '',
        newsModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.newsModal : '',
        errorReportModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.errorReportModal : '',
        vacancyModal: typeof ModalTemplates !== 'undefined' ? ModalTemplates.vacancyModal : '' // добавлено
    },

    /**
     * Инициализация компонентов на странице
     */
    init(options = {}, callback = null) {
        const { 
            loadNavbar = true, 
            loadFooter = true, 
            loadModal = true,
            activePage = '' 
        } = options;

        if (loadNavbar) this._loadNavbar(activePage);
        if (loadModal) this._loadModals();
        if (loadFooter) this._loadFooter(activePage);

        document.dispatchEvent(new CustomEvent('components:loaded'));
        if (callback) {
            setTimeout(callback, window.CONFIG?.PERFORMANCE?.COMPONENT_LOAD_DELAY_MS || 50);
        }
    },

    _loadNavbar(activePage) {
        const navContainer = document.getElementById('navbar');
        const parser = new DOMParser();
        
        if (navContainer && !navContainer.hasChildNodes()) {
            const doc = parser.parseFromString(this.templates.navbar, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                navContainer.appendChild(node.cloneNode(true));
            });
            this.setActiveLink(activePage);
        } else if (!navContainer) {
            const newNavContainer = document.createElement('div');
            newNavContainer.id = 'navbar';
            const doc = parser.parseFromString(this.templates.navbar, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                newNavContainer.appendChild(node.cloneNode(true));
            });
            const firstBodyChild = document.body.firstChild;
            document.body.insertBefore(newNavContainer, firstBodyChild);
            this.setActiveLink(activePage);
        } else {
            this.setActiveLink(activePage);
        }
        
        if (!document.getElementById('mobileMenuOverlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'mobile-menu-overlay';
            overlay.id = 'mobileMenuOverlay';
            document.body.appendChild(overlay);
        }
    },

    _loadModals() {
        // Загрузка модального окна КП
        const existingModal = document.getElementById('modalOverlay');
        if (!existingModal) {
            const modalContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.proposalModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                modalContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(modalContainer.firstElementChild);
        }
        
        // Загрузка универсального модального окна заявок
        const existingUniversalModal = document.getElementById('universalApplicationModalOverlay');
        if (!existingUniversalModal) {
            const universalModalContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.universalApplicationModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                universalModalContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(universalModalContainer.firstElementChild);
        }

        // Загрузка модалки успеха
        const existingSuccessModal = document.getElementById('successModalOverlay');
        if (!existingSuccessModal) {
            const successModalContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.successModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                successModalContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(successModalContainer.firstElementChild);
        }

        // Загрузка модалки обратной связи
        if (!document.getElementById('feedbackModalOverlay')) {
            const feedbackModalContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.feedbackModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                feedbackModalContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(feedbackModalContainer.firstElementChild);
        }

        // Загрузка модалки категории новостей
        if (!document.getElementById('categoryNewsModalOverlay')) {
            const categoryModalContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.categoryNewsModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                categoryModalContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(categoryModalContainer.firstElementChild);
        }

        // Загрузка модалки категории проектов
        if (!document.getElementById('projectCategoryModalOverlay')) {
            const projectCategoryContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.projectCategoryModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                projectCategoryContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(projectCategoryContainer.firstElementChild);
        }

        // Загрузка модалки новости
        if (!document.getElementById('newsModalOverlay')) {
            const newsModalContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.newsModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                newsModalContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(newsModalContainer.firstElementChild);
        }

        // ========== ЗАГРУЗКА МОДАЛКИ ОШИБКИ ==========
        if (!document.getElementById('errorReportModalOverlay')) {
            const errorReportContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.errorReportModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                errorReportContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(errorReportContainer.firstElementChild);
        }

        // ========== ЗАГРУЗКА МОДАЛКИ ВАКАНСИИ ==========
        if (!document.getElementById('vacancyModalOverlay')) {
            const vacancyContainer = document.createElement('div');
            const parser = new DOMParser();
            const doc = parser.parseFromString(this.templates.vacancyModal, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                vacancyContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(vacancyContainer.firstElementChild);
        }
    },

    _loadFooter(activePage) {
        const existingFooter = document.querySelector('body > footer.footer');
        const parser = new DOMParser();
        
        if (!existingFooter) {
            const footerContainer = document.createElement('div');
            const doc = parser.parseFromString(this.templates.footer, 'text/html');
            Array.from(doc.body.childNodes).forEach(node => {
                footerContainer.appendChild(node.cloneNode(true));
            });
            document.body.appendChild(footerContainer.firstElementChild);
        } else {
            const doc = parser.parseFromString(this.templates.footer, 'text/html');
            const newFooter = doc.body.firstElementChild;
            if (newFooter) {
                existingFooter.replaceWith(newFooter);
            }
        }
        
        this.updateYear();
        
        if (typeof PolicyModalManager !== 'undefined') {
            PolicyModalManager.init();
        } else {
            Logger.WARN('PolicyModalManager not available');
        }
    },

    setActiveLink(activePage) {
        const isHomePage = activePage === '' || activePage === 'index';
        const homeLinkDesktop = document.querySelector('.nav-links .home-link');
        if (homeLinkDesktop) {
            if (isHomePage) homeLinkDesktop.classList.add('hidden');
            else homeLinkDesktop.classList.remove('hidden');
        }
        const homeLinkMobile = document.querySelector('.mobile-menu .home-link-mobile');
        if (homeLinkMobile) {
            if (isHomePage) homeLinkMobile.classList.add('hidden');
            else homeLinkMobile.classList.remove('hidden');
        }
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === activePage || link.getAttribute('href') === `${activePage}.html`) {
                link.classList.add('active');
            }
        });
        document.querySelectorAll('.mobile-menu a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === activePage || link.getAttribute('href') === `${activePage}.html`) {
                link.classList.add('active');
            }
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