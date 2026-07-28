/**
 * highlight.js – утилита для подсветки текста на странице
 * ООО "Волга-Днепр Инжиниринг"
 */

const HighlightUtils = {
    /**
     * Подсвечивает все вхождения текста внутри контейнера
     * @param {string} query – текст для поиска (регистронезависимый)
     * @param {Element} container – DOM-элемент, внутри которого ищем (по умолчанию document.body)
     * @param {string} markClass – класс для <mark> (по умолчанию 'search-highlight')
     */
    highlight(query, container = document.body, markClass = 'search-highlight') {
        if (!query) return;
        // Удаляем предыдущую подсветку
        this.clearHighlights(container, markClass);
        
        const q = query.toLowerCase().trim();
        if (!q) return;
        
        // Обходим текстовые узлы
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    // Пропускаем уже подсвеченные (внутри <mark>)
                    if (node.parentElement && node.parentElement.tagName === 'MARK') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );
        
        const nodesToReplace = [];
        let node;
        while ((node = walker.nextNode())) {
            const text = node.textContent;
            const lowerText = text.toLowerCase();
            if (lowerText.includes(q)) {
                nodesToReplace.push({ node, text, lowerText });
            }
        }
        
        // Заменяем узлы с подсветкой
        nodesToReplace.forEach(({ node, text }) => {
            const fragment = document.createDocumentFragment();
            let remaining = text;
            while (true) {
                const pos = remaining.toLowerCase().indexOf(q);
                if (pos === -1) {
                    if (remaining) {
                        fragment.appendChild(document.createTextNode(remaining));
                    }
                    break;
                }
                // Текст до совпадения
                if (pos > 0) {
                    fragment.appendChild(document.createTextNode(remaining.slice(0, pos)));
                }
                // Совпадение – оборачиваем в <mark>
                const mark = document.createElement('mark');
                mark.className = markClass;
                mark.textContent = remaining.slice(pos, pos + q.length);
                fragment.appendChild(mark);
                // Оставшийся текст после совпадения
                remaining = remaining.slice(pos + q.length);
            }
            node.parentNode.replaceChild(fragment, node);
        });
    },
    
    /**
     * Удаляет все подсветки внутри контейнера
     */
    clearHighlights(container = document.body, markClass = 'search-highlight') {
        const marks = container.querySelectorAll(`mark.${markClass}`);
        marks.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
    }
};

if (typeof window !== 'undefined') {
    window.HighlightUtils = HighlightUtils;
}