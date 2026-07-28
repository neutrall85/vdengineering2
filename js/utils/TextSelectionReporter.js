/**
 * TextSelectionReporter – отправка сообщений об ошибках без модального окна
 * Выделите текст → Ctrl+Enter → открывается модальное окно
 * Баннер показывается не чаще одного раза в час.
 * ООО "Волга-Днепр Инжиниринг"
 */
class TextSelectionReporter {
  constructor() {
    this.rateLimiterKey = 'error_report_timestamps';
    this.rateLimitMax = 5;
    this.rateLimitWindow = 3600000;
    this.selectedText = '';
    this._boundHandler = null;
    this._initialized = false;
    this._bannerTimer = null;
    this._bannerElement = null;
    this._bannerShown = false;

    this._bannerTimestampKey = 'error_banner_last_shown_v2';
    this._bannerInterval = 3600000;

    this._isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    this._modifierKey = this._isMac ? '⌘' : 'Ctrl';
  }

  init() {
    if (this._initialized) return;
    this._initialized = true;

    this._boundHandler = (e) => this._handleKeydown(e);
    document.addEventListener('keydown', this._boundHandler);

    setTimeout(() => {
      this._showBanner();
    }, 4000);

    Logger.INFO('TextSelectionReporter initialized');
  }

  _showBanner() {
    if (this._bannerShown) return;

    try {
      const lastShown = localStorage.getItem(this._bannerTimestampKey);
      if (lastShown) {
        const lastTime = parseInt(lastShown, 10);
        const now = Date.now();
        if (now - lastTime < this._bannerInterval) {
          this._bannerShown = true;
          return;
        }
      }
    } catch (e) {}

    this._bannerShown = true;

    try {
      localStorage.setItem(this._bannerTimestampKey, String(Date.now()));
    } catch (e) {}

    if (!this._bannerElement) {
      this._bannerElement = document.createElement('div');
      this._bannerElement.className = 'error-banner';
      this._bannerElement.setAttribute('role', 'alert');
      this._bannerElement.innerHTML = `
        <span class="error-banner-text">Заметили опечатку? Выделите её и нажмите <kbd>${this._modifierKey}+Enter</kbd> Спасибо!</span>
        <button class="error-banner-close" aria-label="Закрыть подсказку">&times;</button>
      `;
      document.body.appendChild(this._bannerElement);

      const closeBtn = this._bannerElement.querySelector('.error-banner-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this._hideBanner());
      }
    }

    this._bannerElement.classList.remove('hiding');
    this._bannerElement.classList.add('active');

    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => {
      this._hideBanner();
    }, 5000);
  }

  _hideBanner() {
    if (!this._bannerElement) return;

    this._bannerElement.classList.remove('active');
    this._bannerElement.classList.add('hiding');

    setTimeout(() => {
      if (this._bannerElement) {
        this._bannerElement.classList.remove('hiding');
      }
    }, 2000);

    clearTimeout(this._bannerTimer);
    this._bannerTimer = null;
  }

  _handleKeydown(e) {
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const isModifierEnter = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
    if (!isModifierEnter) return;

    e.preventDefault();

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    if (!selectedText) return;

    this.selectedText = selectedText;

    if (!this._checkRateLimit()) {
      alert('Вы слишком часто отправляете сообщения. Пожалуйста, подождите час.');
      return;
    }

    const contextText = this._getContextText(selection, selectedText);
    const fullText = contextText || selectedText;

    // Открываем модальное окно ошибки
    if (typeof modalManager !== 'undefined') {
      // Экранируем текст для безопасности
      const safeText = Utils.Sanitizer ? Utils.Sanitizer.escapeHtml(fullText) : fullText;
      const display = document.getElementById('errorReportTextDisplay');
      const hidden = document.getElementById('errorReportText');
      if (display) display.textContent = safeText;
      if (hidden) hidden.value = safeText;
      const comment = document.getElementById('errorReportComment');
      if (comment) comment.value = '';
      modalManager.open('error-report');
    } else {
      // fallback – отправляем сразу
      this.submitReport(fullText, '');
    }
  }

  _getContextText(selection, selectedText) {
    if (!selection.rangeCount) return null;

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    let parent = container.nodeType === 3 ? container.parentNode : container;

    const blockTags = ['P', 'DIV', 'SECTION', 'ARTICLE', 'LI', 'BLOCKQUOTE', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    while (parent && parent.nodeType === 1 && !blockTags.includes(parent.tagName)) {
      parent = parent.parentNode;
    }
    if (!parent) parent = document.body;

    const fullText = parent.textContent;
    const index = fullText.indexOf(selectedText);
    if (index === -1) return selectedText;

    const contextLen = 40;
    const start = Math.max(0, index - contextLen);
    const end = Math.min(fullText.length, index + selectedText.length + contextLen);

    const before = fullText.slice(start, index);
    const after = fullText.slice(index + selectedText.length, end);

    const prefix = start > 0 ? '…' : '';
    const suffix = end < fullText.length ? '…' : '';

    return prefix + before + '[' + selectedText + ']' + after + suffix;
  }

  _checkRateLimit() {
    const storage = window.Services?.storage;
    if (!storage) return true;
    const timestamps = storage.get(this.rateLimiterKey, []);
    const now = Date.now();
    const valid = timestamps.filter(ts => now - ts < this.rateLimitWindow);
    return valid.length < this.rateLimitMax;
  }

  _recordRateLimit() {
    const storage = window.Services?.storage;
    if (!storage) return;
    const timestamps = storage.get(this.rateLimiterKey, []);
    const now = Date.now();
    const valid = timestamps.filter(ts => now - ts < this.rateLimitWindow);
    valid.push(now);
    storage.set(this.rateLimiterKey, valid);
  }

  async submitReport(selectedTextWithContext, comment) {
    if (!selectedTextWithContext) {
      alert('Нет выделенного текста. Попробуйте снова.');
      return;
    }

    try {
      const apiUrl = '/api/report-error.php';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          type: 'error_report',
          selectedText: selectedTextWithContext,
          comment: comment || '',
          url: window.location.href,
          userAgent: navigator.userAgent
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        const errorMatch = text.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const errorMsg = errorMatch ? errorMatch[1] : 'Сервер вернул не JSON-ответ';
        throw new Error(`Ошибка ${response.status}: ${errorMsg}`);
      }

      if (!response.ok) {
        const errorJson = await response.json();
        throw new Error(errorJson.error || `Ошибка ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        this._recordRateLimit();
        alert('✅ Спасибо! Сообщение об ошибке отправлено.');
        this.selectedText = '';
      } else {
        throw new Error(result.error || 'Неизвестная ошибка');
      }
    } catch (err) {
      Logger.ERROR('Error report submission failed:', err);
      alert('❌ Не удалось отправить сообщение: ' + err.message);
    }
  }

  destroy() {
    if (this._boundHandler) {
      document.removeEventListener('keydown', this._boundHandler);
      this._boundHandler = null;
    }
    if (this._bannerTimer) {
      clearTimeout(this._bannerTimer);
      this._bannerTimer = null;
    }
    if (this._bannerElement && this._bannerElement.parentNode) {
      this._bannerElement.parentNode.removeChild(this._bannerElement);
    }
    this._initialized = false;
  }
}

const textSelectionReporter = new TextSelectionReporter();
window.textSelectionReporter = textSelectionReporter;