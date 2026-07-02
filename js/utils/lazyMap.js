/**
 * Ленивая загрузка Яндекс.Карт (iframe)
 * Загружается только когда элемент попадает в область видимости
 * ООО "Волга-Днепр Инжиниринг"
 */

(function initLazyMaps() {
  // Находим все iframe с классом lazy-map и атрибутом data-src
  const lazyIframes = document.querySelectorAll('iframe.lazy-map[data-src]');

  if (lazyIframes.length === 0) return;

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const iframe = entry.target;
          const src = iframe.getAttribute('data-src');
          if (src) {
            iframe.src = src;
            iframe.removeAttribute('data-src'); // чтобы не загружать повторно
          }
          observer.unobserve(iframe);
        }
      });
    }, {
      rootMargin: '100px', // начнёт загрузку за 100px до появления
      threshold: 0.1
    });

    lazyIframes.forEach(iframe => observer.observe(iframe));
  } else {
    // Fallback для старых браузеров – загружаем сразу
    lazyIframes.forEach(iframe => {
      iframe.src = iframe.getAttribute('data-src');
    });
  }
})();