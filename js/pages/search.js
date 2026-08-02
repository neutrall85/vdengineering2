/**
 * search.js – инициализация страницы поиска
 * ООО "ВД Инжиниринг"
 */

function initSearchPage() {
    if (!window.SearchManager) {
        Logger?.WARN('SearchManager не загружен');
        return;
    }
    const path = window.location.pathname;
    if (path !== '/search' && path !== '/search.html') return;

    const searchManager = new SearchManager();
    searchManager.init();
    window._searchManager = searchManager;
}

function destroySearchPage() {
    if (window._searchManager && typeof window._searchManager.destroy === 'function') {
        window._searchManager.destroy();
        window._searchManager = null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearchPage);
} else {
    initSearchPage();
}