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
      <li><a href="#" data-modal-open="feedback">Обратная связь</a></li> <!-- НОВАЯ ССЫЛКА -->
    </ul>
  </div>
  <div class="footer-bottom">
    <p>© <span id="currentYear"></span> ООО «Волга-Днепр Инжиниринг». Все права защищены.</p>
  </div>
</footer>

<button class="scroll-to-top" id="scrollToTop" aria-label="Наверх">
  <svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>
</button>`;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FooterTemplate;
}