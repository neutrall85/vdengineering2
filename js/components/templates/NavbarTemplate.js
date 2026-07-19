/**
 * NavbarTemplate - HTML-шаблон навигационного меню
 * ООО "Волга-Днепр Инжиниринг"
 */

const NavbarTemplate = `
<nav class="navbar" id="navbar">
  <div class="navbar-content">
    <div class="logo">
      <a href="/">
        <img src="/assets/images/logo.svg" alt="Волга-Днепр Инжиниринг" class="logo-image" width="300" height="70" fetchpriority="high">
      </a>
    </div>
    <ul class="nav-links">
      <li><a href="/about">О нас</a></li>
      <li><a href="/services">Компетенции</a></li>
      <li><a href="/news">Новости</a></li>
      <li><a href="/projects">Проекты</a></li>
      <li><a href="/docs">Документы</a></li>
      <li><a href="/vacancies">Вакансии</a></li>
      <li><a href="/index#partners">Партнёры</a></li>
      <li><a href="/index#contact-details">Контакты</a></li>
    </ul>
    <button class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Меню">
      <span></span>
      <span></span>
      <span></span>
    </button>
  </div>
</nav>

<div class="mobile-menu" id="mobileMenu">
  <a href="/index" class="home-link-mobile">Главная</a>
  <a href="/about">О нас</a>
  <a href="/services">Компетенции</a>
  <a href="/news">Новости</a>
  <a href="/projects">Проекты</a>
  <a href="/docs">Документы</a>
  <a href="/vacancies">Вакансии</a>
  <a href="/partners">Партнёры</a>
  <a href="/contacts">Контакты</a>
</div>`;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NavbarTemplate;
}