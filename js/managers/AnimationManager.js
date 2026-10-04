/**
 * Управление анимациями при скролле
 * ООО "ВД Инжиниринг"
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
          if (el.classList.contains('text-reveal') && !el.dataset.revealProcessed) this._processTextReveal(el);
          el.classList.add('visible');
          if (el.dataset.once !== 'false') {
            this.scrollObserver.unobserve(el);
            this.observedElements.delete(el);
          }
        } else {
          if (el.dataset.once === 'false') el.classList.remove('visible');
        }
      });
    }, options);

    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      this.scrollObserver.observe(el);
      this.observedElements.add(el);
    });
    this.observers.push(this.scrollObserver);
  }

  _forceVisibleCheck() {
    requestAnimationFrame(() => {
      const elements = document.querySelectorAll('.animate-on-scroll');
      const windowHeight = window.innerHeight;
      const offset = 50;
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < windowHeight - offset && rect.bottom > offset && !el.classList.contains('visible')) {
          el.classList.add('visible');
        }
      });
    });
  }

  // [P0-FIX] Проверка element.isConnected в каждом тике — очищаем interval
  // при выпадении элемента из DOM, устраняем утечку.
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

    let index = 0;
    const intervalId = setInterval(() => {
      if (!element.isConnected) { clearInterval(intervalId); return; }
      if (index >= charSpans.length) { clearInterval(intervalId); return; }
      charSpans[index].classList.add('visible');
      index++;
    }, 30);
    element._revealInterval = intervalId;
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
    this._forceVisibleCheck();
  }

  destroy() {
    // [P0-FIX] Очищаем все висящие интервалы анимации символов.
    document.querySelectorAll('.text-reveal').forEach(el => {
      if (el._revealInterval) {
        clearInterval(el._revealInterval);
        delete el._revealInterval;
      }
    });
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