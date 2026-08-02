/**
 * Управление анимациями при скролле (расширенная версия)
 * ООО "ВД Инжиниринг"
 * Поддерживает повторные анимации, безопасная работа с памятью
 * 
 * Исправление: добавлен метод _forceVisibleCheck() для немедленного показа
 * элементов, уже находящихся в видимой области при загрузке страницы.
 */
class AnimationManager {
  constructor() {
    this.observers = [];
    this.counterObserver = null;
    this.scrollObserver = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observedElements = new WeakSet();
  }

  init() {
    this._initScrollAnimations();
    this._initCounters();
    // Принудительная проверка видимости уже загруженных элементов
    this._forceVisibleCheck();
    Logger.INFO('AnimationManager initialized');
  }

  _initScrollAnimations() {
    const options = {
      threshold: window.CONFIG?.ANIMATION?.OBSERVER_THRESHOLD || 0.2,
      rootMargin: window.CONFIG?.ANIMATION?.ROOT_MARGIN || '0px 0px 20px 0px'
    };

    this.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target;
        
        if (!el.isConnected) {
          this.scrollObserver.unobserve(el);
          this.observedElements.delete(el);
          return;
        }
        
        if (entry.isIntersecting) {
          if (el.classList.contains('text-reveal') && !el.dataset.revealProcessed) {
            this._processTextReveal(el);
          }
          
          el.classList.add('visible');
          
          if (el.dataset.once !== 'false') {
            this.scrollObserver.unobserve(el);
            this.observedElements.delete(el);
          }
        } else {
          if (el.dataset.once === 'false') {
            el.classList.remove('visible');
          }
        }
      });
    }, options);

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach(el => {
      this.scrollObserver.observe(el);
      this.observedElements.add(el);
    });
    this.observers.push(this.scrollObserver);
  }

  /**
   * Принудительная проверка видимости элементов (синхронно)
   * Решает проблему задержки появления контента на мобильных устройствах
   */
  _forceVisibleCheck() {
    // Используем requestAnimationFrame, чтобы не блокировать основной поток
    requestAnimationFrame(() => {
        const elements = document.querySelectorAll('.animate-on-scroll');
        const windowHeight = window.innerHeight;
        const offset = 50;

        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.top < windowHeight - offset && rect.bottom > offset;
            if (isVisible && !el.classList.contains('visible')) {
                el.classList.add('visible');
            }
        });
    });
  }

  // ИЗМЕНЕНИЕ: переписан метод _processTextReveal – без инлайн-стилей, через классы и таймер
  _processTextReveal(element) {
    if (element.dataset.revealProcessed) return;
    element.dataset.revealProcessed = 'true';
    
    const originalText = element.innerText;
    if (!originalText.trim()) return;
    
    const fragment = document.createDocumentFragment();
    const charSpans = [];
    
    for (let i = 0; i < originalText.length; i++) {
      const ch = originalText[i];
      if (ch === ' ' || ch === '\n' || ch === '\t') {
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'char-space';
        spaceSpan.textContent = ' ';
        fragment.appendChild(spaceSpan);
      } else {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        fragment.appendChild(span);
        charSpans.push(span);
      }
    }
    
    element.innerHTML = '';
    element.appendChild(fragment);
    
    // Последовательно добавляем класс .visible к каждому символу с задержкой 30ms
    let index = 0;
    const interval = setInterval(() => {
      if (index >= charSpans.length) {
        clearInterval(interval);
        return;
      }
      charSpans[index].classList.add('visible');
      index++;
    }, 30);
  }

  _initCounters() {
    const counters = document.querySelectorAll('.stat-number');
    if (counters.length === 0) return;

    this.counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._animateCounter(entry.target);
          this.counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(counter => this.counterObserver.observe(counter));
    this.observers.push(this.counterObserver);
  }

  _animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'), 10);
    const suffix = element.getAttribute('data-suffix') || '';
    if (!target || isNaN(target)) return;

    let current = 0;
    const steps = window.CONFIG?.ANIMATION?.COUNTER_STEPS || 100;
    const step = target / steps;
    
    const update = () => {
      current += step;
      if (current < target) {
        element.textContent = Math.floor(current) + suffix;
        requestAnimationFrame(update);
      } else {
        element.textContent = target + suffix;
      }
    };
    update();
  }

  observeNewElements(container) {
    if (!this.scrollObserver) return;
    const newElements = container.querySelectorAll('.animate-on-scroll');
    newElements.forEach(el => {
      if (this.observedElements.has(el)) return;
      if (el.dataset.once === 'true' && el.classList.contains('visible')) return;
      this.scrollObserver.observe(el);
      this.observedElements.add(el);
    });
    // Проверяем видимость новых элементов (например, после загрузки через компоненты)
    this._forceVisibleCheck();
  }

  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.observedElements = new WeakSet();
  }
}

const animationManager = new AnimationManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnimationManager, animationManager };
}

window.animationManager = animationManager;