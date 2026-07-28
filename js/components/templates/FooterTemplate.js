/**
 * FooterTemplate - HTML-шаблон футера
 * ООО "Волга-Днепр Инжиниринг"
 */

const FooterTemplate = `
<footer class="footer">
  <div class="footer-legal animate-on-scroll blur-in">
    <ul>
      <li><a href="#" data-policy="terms">Правила пользования сайтом</a></li>
      <li><a href="#" data-policy="privacy">Политика конфиденциальности</a></li>
      <li><a href="#" data-policy="personal-data">Политика обработки персональных данных</a></li>
      <li><a href="#" data-policy="cookies">Политика в отношении файлов cookie</a></li>
      <li><a href="#" id="cookie-settings-link">Настройки cookie</a></li>
      <li><a href="#" data-policy="laborAssessment">Оценка условий труда</a></li>
      <li><a href="#" data-modal-open="feedback">Обратная связь</a></li>
    </ul>
  </div>
  <div class="footer-search">
    <form id="footerSearchForm" class="footer-search-form" action="/search" method="get" role="search">
      <div class="footer-search-group">
        <input type="text" name="q" class="footer-search-input" placeholder="Поиск по сайту..." aria-label="Поиск по сайту">
        <button type="submit" class="footer-search-btn">
          <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          <span>Искать</span>
        </button>
      </div>
    </form>
  </div>
  <div class="footer-bottom">
    <p>© <span id="currentYear"></span> ООО «ВД Инжиниринг». ИНН 7743364515. Все права защищены.</p>
  </div>
</footer>

<button class="scroll-to-top" id="scrollToTop" aria-label="Наверх">
  <svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>
</button>`;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FooterTemplate;
}