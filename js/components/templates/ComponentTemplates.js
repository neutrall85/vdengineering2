/**
 * ComponentTemplates - HTML-шаблоны общих компонентов (header, footer)
 * Объединяет шаблоны из отдельных файлов для обратной совместимости
 * ООО "ВД Инжиниринг"
 */

const ComponentTemplates = {
    navbar: NavbarTemplate,
    footer: FooterTemplate
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentTemplates;
}
