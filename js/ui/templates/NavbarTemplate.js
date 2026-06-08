/**
 * NavbarTemplate - HTML-шаблон навигационного меню
 * ООО "Волга-Днепр Инжиниринг"
 */

const NavbarTemplate = `
<nav class="navbar" id="navbar">
  <div class="navbar-content">
    <div class="logo">
      <a href="index.html">
        <img src="assets/images/logo.svg" alt="Волга-Днепр Инжиниринг" class="logo-image">
      </a>
    </div>
    <ul class="nav-links">
      <li><a href="about.html">О нас</a></li>
      <li><a href="services.html">Компетенции</a></li>
      <li><a href="news.html">Новости</a></li>
      <li><a href="projects.html">Проекты</a></li>
      <li><a href="docs.html">Документы</a></li>
      <li><a href="vacancies.html">Вакансии</a></li>
      <li><a href="index.html#partners">Партнёры</a></li>
      <li><a href="index.html#contact-details">Контакты</a></li>
    </ul>
    <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Меню">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>
</nav>

<div class="mobile-menu" id="mobileMenu">
  <a href="index.html" class="home-link-mobile">Главная</a>
  <a href="about.html">О нас</a>
  <a href="services.html">Компетенции</a>
  <a href="news.html">Новости</a>
  <a href="projects.html">Проекты</a>
  <a href="docs.html">Документы</a>
  <a href="vacancies.html">Вакансии</a>
  <a href="index.html#partners">Партнёры</a>
  <a href="index.html#contact-details">Контакты</a>
</div>`;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavbarTemplate;
}
