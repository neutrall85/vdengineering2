/**
 * PolicyModalManager - менеджер модальных окон политик
 * ООО "ВД Инжиниринг"
 */
const PolicyModalManager = {
    historyStack: [],
    currentIndex: -1,
    backButton: null,
    modalOverlay: null,
    contentContainer: null,

    init() {
        // Клик по ссылкам с data-policy
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-policy]');
            if (link) {
                e.preventDefault();
                const policyKey = link.getAttribute('data-policy');
                this.openPolicyModal(policyKey);
                window.history.pushState({ modal: 'policy', key: policyKey }, '', `/policy/${policyKey}`);
            }
        });

        // Клик по прямым ссылкам /policy/... (игнорируем #cookie-settings-link)
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="/policy/"]');
            if (link) {
                if (link.id === 'cookie-settings-link') return;
                if (link.hasAttribute('data-policy')) return;
                e.preventDefault();
                const policyKey = link.getAttribute('href').replace('/policy/', '');
                if (policyKey && window.POLICY_DOCUMENTS && window.POLICY_DOCUMENTS[policyKey]) {
                    this.openPolicyModal(policyKey);
                    window.history.pushState({ modal: 'policy', key: policyKey }, '', `/policy/${policyKey}`);
                }
            }
        });

        // Настройки cookie (оставляем только баннер, не открываем модалку)
        // Обработчик #cookie-settings-link теперь в ConsentManager
    },

    openPolicyModal(policyKey, addToHistory = true) {
        if (!window.POLICY_DOCUMENTS) {
            Logger?.ERROR?.('POLICY_DOCUMENTS не загружен');
            return;
        }

        const policy = POLICY_DOCUMENTS[policyKey];
        if (!policy) {
            Logger?.WARN?.(`Политика "${policyKey}" не найдена`);
            return;
        }

        if (!this.modalOverlay) {
            this.modalOverlay = document.getElementById('policyModalOverlay');
            if (!this.modalOverlay) {
                this.modalOverlay = this._createPolicyModal();
            }
        }

        // История
        if (addToHistory && this.currentIndex >= 0 && this.historyStack[this.currentIndex]) {
            this.historyStack[this.currentIndex].scrollTop = this.contentContainer?.scrollTop || 0;
        }

        if (addToHistory && this.historyStack[this.currentIndex]?.key !== policyKey) {
            this.historyStack = this.historyStack.slice(0, this.currentIndex + 1);
            this.historyStack.push({ key: policyKey, scrollTop: 0 });
            this.currentIndex++;
        }

        // Заголовок
        const titleEl = document.getElementById('policyModalTitle');
        if (titleEl) titleEl.textContent = policy.title;

        // Контент
        const safeContent = this._sanitizePolicyContent(policy.content);
        this._updateModalContent(safeContent);

        // Восстанавливаем прокрутку
        const savedScrollTop = this.historyStack[this.currentIndex]?.scrollTop ?? 0;
        if (this.contentContainer) this.contentContainer.scrollTop = savedScrollTop;

        this._updateBackButton();

        // Открываем модалку
        let keepParentModal = false;
        if (typeof modalManager !== 'undefined' && modalManager.activeModal && modalManager.activeModal !== 'policy') {
            keepParentModal = true;
        }

        if (!this.modalOverlay.classList.contains('active')) {
            modalManager.open('policy', { keepParentModal });
        }

        // Подсветка
        setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            const highlightQuery = params.get('highlight');
            if (highlightQuery && typeof HighlightUtils !== 'undefined') {
                HighlightUtils.highlight(highlightQuery, this.contentContainer);
                const firstMark = this.contentContainer.querySelector('mark.search-highlight');
                if (firstMark) {
                    this.contentContainer.scrollTop = firstMark.offsetTop - 20;
                }
            }
        }, 300);
    },

    goBack() {
        if (this.currentIndex > 0) {
            if (this.contentContainer && this.historyStack[this.currentIndex]) {
                this.historyStack[this.currentIndex].scrollTop = this.contentContainer.scrollTop;
            }
            this.currentIndex--;
            this.openPolicyModal(this.historyStack[this.currentIndex].key, false);
            return;
        }
        if (this.currentIndex === 0 && modalManager.activeModalStack && modalManager.activeModalStack.length > 0) {
            this.closePolicyModal();
        }
    },

    closePolicyModal() {
        this.historyStack = [];
        this.currentIndex = -1;
        if (this.backButton) this.backButton.classList.add('hidden');
        if (this.contentContainer) {
            this.contentContainer.replaceChildren();
            this.contentContainer.scrollTop = 0;
        }
        if (typeof modalManager !== 'undefined') {
            modalManager.close('policy');
        }
    },

    _sanitizePolicyContent(html) {
        const sanitizer = Utils.Sanitizer || { sanitizeHtml: (h) => h };
        return sanitizer.sanitizeHtml(html, {
            allowedTags: ['h2', 'h3', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'],
            allowedAttributes: { 'a': ['href', 'target', 'rel', 'data-policy'] }
        });
    },

    _updateModalContent(safeHtml) {
        if (!this.contentContainer) return;
        this.contentContainer.replaceChildren();
        const parser = new DOMParser();
        const doc = parser.parseFromString(safeHtml, 'text/html');
        const fragment = document.createDocumentFragment();
        Array.from(doc.body.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                Array.from(node.attributes).forEach(attr => {
                    if (attr.name.startsWith('on') || attr.name.toLowerCase() === 'srcdoc') {
                        node.removeAttribute(attr.name);
                    }
                });
            }
            fragment.appendChild(node.cloneNode(true));
        });
        this.contentContainer.appendChild(fragment);
    },

    _updateBackButton() {
        if (!this.backButton) return;
        const hasHistory = this.currentIndex > 0;
        const hasParentModal = modalManager.activeModalStack && modalManager.activeModalStack.length > 0;
        const showBack = hasHistory || (this.currentIndex === 0 && hasParentModal);
        this.backButton.classList.toggle('hidden', !showBack);
    },

    _createPolicyModal() {
        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'policyModalOverlay';
        modalOverlay.className = 'modal-overlay';
        modalOverlay.setAttribute('role', 'dialog');
        modalOverlay.setAttribute('aria-modal', 'true');

        const modalContainer = document.createElement('div');
        modalContainer.className = 'modal-container';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'modal-close';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        svgEl.setAttribute('viewBox', '0 0 24 24');
        const pathEl = document.createElementNS(svgNS, 'path');
        pathEl.setAttribute('d', 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
        svgEl.appendChild(pathEl);
        closeBtn.appendChild(svgEl);
        closeBtn.addEventListener('click', () => this.closePolicyModal());

        const backBtn = document.createElement('button');
        backBtn.className = 'modal-back-btn hidden';
        backBtn.innerHTML = '← Назад';
        backBtn.setAttribute('aria-label', 'Назад');
        backBtn.addEventListener('click', () => this.goBack());
        this.backButton = backBtn;

        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        const modalTitle = document.createElement('h2');
        modalTitle.className = 'modal-title';
        modalTitle.id = 'policyModalTitle';
        modalHeader.appendChild(backBtn);
        modalHeader.appendChild(modalTitle);

        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.id = 'policyModalContent';
        this.contentContainer = modalBody;

        modalContainer.appendChild(closeBtn);
        modalContainer.appendChild(modalHeader);
        modalContainer.appendChild(modalBody);
        modalOverlay.appendChild(modalContainer);
        document.body.appendChild(modalOverlay);

        if (typeof modalManager !== 'undefined') {
            modalManager.register('policy', {
                overlayId: 'policyModalOverlay',
                onClose: () => this.closePolicyModal()
            });
        }
        return modalOverlay;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PolicyModalManager;
}