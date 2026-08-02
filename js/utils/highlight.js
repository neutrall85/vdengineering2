/**
 * highlight.js – утилита для подсветки текста на странице
 * ООО "ВД Инжиниринг"
 *
 * Подсвечивает все вхождения подстрок (регистронезависимо).
 * Текст внутри кнопок (button, [role="button"]) игнорируется – не подсвечивается.
 *
 * Без использования innerHTML – только DOM-узлы.
 * Собирает фрагмент из текстовых узлов и маркеров.
 * Использует normalize для объединения соседних текстовых узлов.
 */
const HighlightUtils = {
    /**
     * Подсвечивает все вхождения слов запроса в тексте, исключая кнопки.
     * @param {string} query – поисковый запрос (слова через пробел)
     * @param {HTMLElement} container – контейнер, в котором ищем
     * @param {string} markClass – класс для маркеров (<mark>)
     */
    highlight(query, container = document.body, markClass = 'search-highlight') {
        if (!query) return;
        this.clearHighlights(container, markClass);

        const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return;

        // Создаём обходчик, который пропускает текстовые узлы внутри кнопок
        const walker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    // Пропускаем уже подсвеченные маркеры (чтобы не зациклиться)
                    if (node.parentElement && node.parentElement.tagName === 'MARK') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        // Собираем все подходящие текстовые узлы
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        // Обрабатываем каждый текстовый узел (как в оригинале)
        for (const textNode of textNodes) {
            const text = textNode.textContent;
            const lowerText = text.toLowerCase();

            // Ищем все вхождения каждого слова запроса
            let matches = [];
            for (const word of words) {
                let idx = lowerText.indexOf(word);
                while (idx !== -1) {
                    matches.push({ start: idx, end: idx + word.length });
                    idx = lowerText.indexOf(word, idx + 1);
                }
            }

            if (matches.length === 0) continue;

            // Сортируем и объединяем пересекающиеся диапазоны
            matches.sort((a, b) => a.start - b.start);
            const merged = [];
            let cur = matches[0];
            for (let i = 1; i < matches.length; i++) {
                if (matches[i].start <= cur.end) {
                    cur.end = Math.max(cur.end, matches[i].end);
                } else {
                    merged.push(cur);
                    cur = matches[i];
                }
            }
            merged.push(cur);

            // Строим фрагмент с текстовыми кусками и маркерами
            const fragment = document.createDocumentFragment();
            let lastEnd = 0;
            for (const m of merged) {
                if (m.start > lastEnd) {
                    fragment.appendChild(document.createTextNode(text.slice(lastEnd, m.start)));
                }
                const mark = document.createElement('mark');
                mark.className = markClass;
                mark.textContent = text.slice(m.start, m.end);
                fragment.appendChild(mark);
                lastEnd = m.end;
            }
            if (lastEnd < text.length) {
                fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
            }

            const wrapper = document.createElement('span');
            wrapper.appendChild(fragment);
            textNode.parentNode.replaceChild(wrapper, textNode);
        }

        // Объединяем соседние текстовые узлы во всём контейнере
        container.normalize();
    },

    /**
     * Очищает все ранее созданные подсветки (удаляет <mark> с заданным классом)
     */
    clearHighlights(container = document.body, markClass = 'search-highlight') {
        const marks = container.querySelectorAll(`mark.${markClass}`);
        marks.forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
        });
        container.normalize();
    }
};

if (typeof window !== 'undefined') {
    window.HighlightUtils = HighlightUtils;
}