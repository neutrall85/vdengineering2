/**
 * HeroSlideshow - покачивающееся слайд-шоу для hero секции
 * Автоматическое переключение слайдов с плавным переходом
 */
class HeroSlideshow {
  constructor() {
    this.container = document.querySelector('.slideshow-container');
    // Если контейнера нет, класс не должен инициализироваться дальше
    if (!this.container) return;

    this.slides = this.container.querySelectorAll('.slideshow-slide');
    this.prevBtn = this.container.querySelector('.slideshow-prev');
    this.nextBtn = this.container.querySelector('.slideshow-next');
    this.indicators = this.container.querySelectorAll('.slideshow-indicator');

    this.currentSlide = 0;
    this.slideInterval = 4000;
    this.intervalId = null;
    this.eventListeners = [];
    this.isDestroyed = false; // Флаг состояния

    this.init();
  }

  init() {
    if (this.slides.length <= 1) {
      // Если слайд один, автовоспроизведение и кнопки не нужны
      this.destroy(); 
      return;
    }
    this.startAutoPlay();
    this.attachEvents();
  }

  attachEvents() {
    // Кнопки навигации
    if (this.prevBtn) {
      const prevHandler = () => {
        if (this.isDestroyed) return;
        this.pause();
        this.prevSlide();
        this.startAutoPlay();
      };
      this.prevBtn.addEventListener('click', prevHandler);
      this.eventListeners.push({ element: this.prevBtn, event: 'click', handler: prevHandler });
    }

    if (this.nextBtn) {
      const nextHandler = () => {
        if (this.isDestroyed) return;
        this.pause();
        this.nextSlide();
        this.startAutoPlay();
      };
      this.nextBtn.addEventListener('click', nextHandler);
      this.eventListeners.push({ element: this.nextBtn, event: 'click', handler: nextHandler });
    }

    // Индикаторы (точки)
    if (this.indicators) {
      this.indicators.forEach((ind, idx) => {
        const indicatorHandler = () => {
          if (this.isDestroyed) return;
          this.pause();
          this.goToSlide(idx);
          this.startAutoPlay();
        };
        ind.addEventListener('click', indicatorHandler);
        this.eventListeners.push({ element: ind, event: 'click', handler: indicatorHandler });
      });
    }

    // Пауза при наведении
    const mouseenterHandler = () => {
      if (this.isDestroyed) return;
      this.pause();
    };
    
    const mouseleaveHandler = () => {
      if (this.isDestroyed) return;
      this.resume();
    };

    this.container.addEventListener('mouseenter', mouseenterHandler);
    this.container.addEventListener('mouseleave', mouseleaveHandler);

    this.eventListeners.push(
      { element: this.container, event: 'mouseenter', handler: mouseenterHandler },
      { element: this.container, event: 'mouseleave', handler: mouseleaveHandler }
    );
  }

  startAutoPlay() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.isDestroyed) this.nextSlide();
    }, this.slideInterval);
  }

  pause() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  resume() {
    if (!this.intervalId && !this.isDestroyed) this.startAutoPlay();
  }

  prevSlide() {
    let newIndex = this.currentSlide - 1;
    if (newIndex < 0) newIndex = this.slides.length - 1;
    this.goToSlide(newIndex);
  }

  nextSlide() {
    let newIndex = this.currentSlide + 1;
    if (newIndex >= this.slides.length) newIndex = 0;
    this.goToSlide(newIndex);
  }

  goToSlide(index) {
    if (!this.slides[this.currentSlide] || !this.slides[index]) return;
    
    this.slides[this.currentSlide].classList.remove('active');
    this.currentSlide = index;
    this.slides[this.currentSlide].classList.add('active');
    this.updateIndicators();
  }

  updateIndicators() {
    if (this.indicators) {
      this.indicators.forEach((ind, i) => {
        ind.classList.toggle('active', i === this.currentSlide);
      });
    }
  }

  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    // 1. Останавливаем таймер немедленно
    this.pause();

    // 2. Удаляем все обработчики событий
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element) {
        element.removeEventListener(event, handler);
      }
    });
    this.eventListeners = [];

    // 3. Очищаем ссылки на DOM-элементы для сборщика мусора
    this.container = null;
    this.slides = null;
    this.prevBtn = null;
    this.nextBtn = null;
    this.indicators = null;
  }
}

// --- Правильная инициализация и управление жизненным циклом ---

let slideshowInstance = null;

function initSlideshow() {
  if (!slideshowInstance) {
    slideshowInstance = new HeroSlideshow();
  }
}

// Запуск при загрузке DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSlideshow);
} else {
  initSlideshow();
}

// Гарантированная очистка при выгрузке страницы
window.addEventListener('beforeunload', () => {
  if (slideshowInstance) {
    slideshowInstance.destroy();
    slideshowInstance = null;
  }
});