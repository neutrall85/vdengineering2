/**
 * Объединённые утилиты: DOM, Валидация, Форматирование, Лимитирование
 * ООО "Волга-Днепр Инжиниринг"
 */

// ========== Словари префиксов для телефонов ==========
// ========== Словари префиксов для телефонов ==========
const PHONE_PREFIXES = {
    RU: {
        mobile: new Set(['9']),
        fixed: new Set([
            // Москва и область (включая новые коды 496)
            '495', '499', '496', '4966', '4967', '49624', '49632', '49634', '49638',
            '49643', '49644', '49652', '49654',

            // Санкт-Петербург и область
            '812', '813', '81361', '81370', '81371', '81372', '81373', '81378',

            // Крупные города (3-значные коды)
            '343', // Екатеринбург
            '383', // Новосибирск
            '846', // Самара
            '831', // Нижний Новгород
            '861', // Краснодар
            '843', // Казань
            '862', // Сочи
            '865', // Ставрополь
            '818', // Архангельск
            '851', // Астрахань
            '385', // Барнаул
            '472', // Белгород
            '416', // Благовещенск
            '426', // Биробиджан
            '473', // Воронеж
            '423', // Владивосток
            '867', // Владикавказ
            '492', // Владимир
            '844', // Волгоград
            '817', // Вологда
            '821', // Сыктывкар
            '871', // Грозный
            '341', // Ижевск
            '395', // Иркутск
            '836', // Йошкар-Ола
            '401', // Калининград
            '842', // Калуга
            '384', // Кемерово
            '833', // Киров
            '471', // Курск
            '474', // Липецк
            '413', // Магадан
            '351', // Челябинск
            '872', // Махачкала
            '877', // Майкоп
            '879', // Пятигорск
            '815', // Мурманск
            '855', // Набережные Челны
            '866', // Нальчик
            '346', // Сургут
            '816', // Великий Новгород
            '381', // Омск
            '486', // Орёл
            '353', // Оренбург
            '841', // Пенза
            '485', // Ярославль
            '342', // Пермь
            '814', // Петрозаводск
            '415', // Петропавловск-Камчатский
            '811', // Псков
            '863', // Ростов-на-Дону
            '491', // Рязань
            '834', // Саранск
            '845', // Саратов
            '481', // Смоленск
            '487', // Тула
            '475', // Тамбов
            '482', // Тверь
            '848', // Тольятти
            '382', // Томск
            '345', // Тюмень
            '301', // Улан-Удэ
            '347', // Уфа
            '421', // Хабаровск
            '835', // Чебоксары
            '820', // Череповец
            '878', // Черкесск
            '390', // Черногорск
            '302', // Чита
            '411', // Якутск
            '424', // Южно-Сахалинск

            // Остальные коды из списка
            '49244', // Александров
            '86133', // Анапа
            '39518', // Ангарск
            '83147', // Арзамас
            '86137', // Армавир
            '41145', // Балтийск
            '41641', // Белогорск
            '81756', // Белозерск
            '42622', // Биробиджан (уже есть)
            '47354', // Борисоглебск
            '39168', // Бородино
            '3953',  // Братск
            '86559', // Буденовск
            '81738', // Великий Устюг
            '83136', // Володарск
            '82151', // Воркута
            '81278', // Выборг
            '49355', // Гаврилов-Посад
            '49437', // Галич
            '86141', // Геленджик
            '87122', // Грозный (уже есть)
            '49241', // Гусь-Хрустальный
            '39115', // Енисейск
            '87934', // Ессентуки
            '87932', // Железноводск
            '86532', // Железноводск
            '81554', // Заполярный
            '4932',  // Иваново
            '34357', // Кировоград
            '81531', // Кировск (Мурманская обл.)
            '81262', // Кировск (Ленинградская обл.)
            '87937', // Кисловодск
            '86537', // Кисловодск
            '4217',  // Комсомольск-на-Амуре
            '4942',  // Кострома
            '47541', // Котовск
            '42454', // Курильск
            '47131', // Курчатов
            '87935', // Лермонтов
            '3519',  // Магнитогорск
            '87722', // Майкоп (уже есть)
            '47545', // Мичуринск
            '49234', // Муром
            '48646', // Мценск
            '42366', // Находка
            '86552', // Невинномысск
            '34612', // Нефтеюганск
            '3435',  // Нижний Тагил
            '3843',  // Новокузнецк
            '8617',  // Новороссийск
            '34549', // Новый Уренгой
            '3919',  // Норильск
            '3537',  // Орск
            '49334', // Палех
            '48535', // Переславль-Залесский
            '82142', // Печора
            '81832', // Плесецк
            '49243', // Покров
            '49339', // Приволжск
            '87933', // Пятигорск (уже есть)
            '86533', // Пятигорск (уже есть)
            '48536', // Ростов Великий
            '84643', // Сызрань
            '8634',  // Таганрог
            '34511', // Тобольск
            '41656', // Тында
            '48532', // Углич
            '84442', // Урюпинск
            '84639', // Чапаевск
            '84511', // Энгельс
        ])
    },
    BY: {
        mobile: new Set(['25', '29', '33', '44']),
        fixed: new Set([
            '17', '1713', '1714', '1715', '1716', '1717', '1718', '1719',
            '1742', '176', '1770', '1771', '1772', '1774', '1775', '1776', '1777', '1779',
            '1792', '1793', '1794', '1795', '1796', '1797',
            '212', '2130', '2131', '2132', '2133', '2135', '2136', '2137', '2138', '2139',
            '214', '2151', '2152', '2153', '2154', '2155', '2156', '2157', '2158', '2159',
            '216'
        ])
    }
};

const Utils = (function() {
    // ========== DOM утилиты ==========
    const DOM = {
        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);
            Object.entries(attributes).forEach(([key, value]) => {
                if (key === 'className') {
                    element.className = value;
                } else if (key === 'dataset') {
                    Object.entries(value).forEach(([dataKey, dataValue]) => {
                        element.dataset[dataKey] = dataValue;
                    });
                } else if (key === 'on' && typeof value === 'object') {
                    Object.entries(value).forEach(([event, handler]) => {
                        element.addEventListener(event, handler);
                    });
                } else {
                    element.setAttribute(key, value);
                }
            });
            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else if (child instanceof Node) {
                    element.appendChild(child);
                }
            });
            return element;
        },

        createSVG(path, width = 24, height = 24, className = '') {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);
            if (className) svg.classList.add(className);
            const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathElement.setAttribute('d', path);
            svg.appendChild(pathElement);
            return svg;
        },

        getElement(id) {
            return document.getElementById(id) || null;
        },

        query(selector, context = document) {
            return context.querySelector(selector);
        },

        queryAll(selector, context = document) {
            return Array.from(context.querySelectorAll(selector));
        },

        trapFocus(element) {
            const focusable = this.queryAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                element
            );
            if (focusable.length === 0) return null;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const handler = (e) => {
                if (e.key !== 'Tab') return;
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            };
            element.addEventListener('keydown', handler);
            return () => element.removeEventListener('keydown', handler);
        },

        setAttributes(element, attributes) {
            Object.entries(attributes).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    element.setAttribute(key, value);
                }
            });
        }
    };

    // ========== Санитизация HTML ==========
    const Sanitizer = {
        escapeHtml(str) {
            if (str == null) return '';
            str = String(str);
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        sanitizeHtml(html, options = {}) {
            if (!html) return '';
            const allowedTags = options.allowedTags || [
                'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4',
                'ul', 'ol', 'li', 'a', 'span', 'div', 'img', 'table', 'tr', 'td', 'th'
            ];
            const allowedAttributes = options.allowedAttributes || {
                'a': ['href', 'target', 'rel'],
                'img': ['src', 'alt', 'width', 'height'],
                '*': ['class', 'id']
            };
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const cleanNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) return;
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    if (!allowedTags.includes(tagName)) {
                        const parent = node.parentNode;
                        while (node.firstChild) {
                            parent.insertBefore(node.firstChild, node);
                        }
                        parent.removeChild(node);
                        return;
                    }
                    const attributes = Array.from(node.attributes);
                    attributes.forEach(attr => {
                        const attrName = attr.name.toLowerCase();
                        const allowedForTag = allowedAttributes[tagName] || allowedAttributes['*'] || [];
                        if (!allowedForTag.includes(attrName)) {
                            node.removeAttribute(attrName);
                        } else if (attrName === 'href' || attrName === 'src') {
                            const value = attr.value.toLowerCase();
                            if (value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('vbscript:')) {
                                node.removeAttribute(attrName);
                            }
                        }
                    });
                    Array.from(node.childNodes).forEach(child => cleanNode(child));
                }
            };
            const resultContainer = document.createElement('div');
            Array.from(doc.body.childNodes).forEach(child => {
                cleanNode(child);
                resultContainer.appendChild(child.cloneNode(true));
            });
            return resultContainer.innerHTML;
        },

        isValidUrl(url) {
            if (!url) return false;
            try {
                const parsed = new URL(url, window.location.origin);
                return ['http:', 'https:'].includes(parsed.protocol);
            } catch {
                return false;
            }
        }
    };

    // ========== Утилиты для работы с телефоном (исправленная версия) ==========
    const PhoneUtils = {
        defaultCountry: 'RU',

        detectCountry(digits, preferredCountry = null) {
            if (!digits) return this.defaultCountry;
            if (preferredCountry && (preferredCountry === 'RU' || preferredCountry === 'BY')) {
                return preferredCountry;
            }
            let number = digits;
            let hasEight = false;
            if (digits.startsWith('8')) {
                number = digits.slice(1);
                hasEight = true;
            } else if (digits.startsWith('7')) {
                number = digits.slice(1);
            } else if (digits.startsWith('375')) {
                return 'BY';
            }

            for (let p of PHONE_PREFIXES.RU.mobile) {
                if (number.startsWith(p)) return 'RU';
            }
            for (let p of PHONE_PREFIXES.BY.mobile) {
                if (number.startsWith(p)) return 'BY';
            }
            const fixedRU = Array.from(PHONE_PREFIXES.RU.fixed).sort((a, b) => b.length - a.length);
            const fixedBY = Array.from(PHONE_PREFIXES.BY.fixed).sort((a, b) => b.length - a.length);
            for (let p of fixedRU) {
                if (number.startsWith(p)) return 'RU';
            }
            for (let p of fixedBY) {
                if (number.startsWith(p)) return 'BY';
            }
            if (hasEight) return 'RU';
            if (digits.length >= 10) return 'RU';
            return this.defaultCountry;
        },

        normalize(phone) {
            if (!phone) return '';
            return phone.replace(/[^0-9]/g, '');
        },

        addPrefix(phone, preferredCountry = null) {
            let raw = phone.trim();
            if (!raw) return raw;
            if (raw.startsWith('+')) {
                return '+' + raw.replace(/[^0-9]/g, '');
            }
            let digits = this.normalize(raw);
            if (!digits) return raw;

            let country = this.detectCountry(digits, preferredCountry);
            let national = digits;

            // Обработка российских номеров
            if (digits.startsWith('8')) {
                // Если длина 11 (8 + 10 цифр), то это национальный префикс
                if (digits.length === 11) {
                    national = digits.slice(1);
                    country = 'RU';
                } else {
                    // Иначе считаем, что 8 – часть кода города, не удаляем
                    national = digits;
                    country = 'RU';
                }
            } else if (digits.startsWith('7')) {
                // Если начинается с 7, это код страны
                if (digits.length === 11) {
                    national = digits.slice(1);
                    country = 'RU';
                } else {
                    national = digits;
                    country = 'RU';
                }
            } else if (digits.startsWith('375')) {
                national = digits.slice(3);
                country = 'BY';
            } else {
                country = this.detectCountry(digits, preferredCountry);
                national = digits;
            }

            let code = country === 'BY' ? '375' : '7';
            return '+' + code + national;
        },

        format(phone, preferredCountry = null) {
            let digits = this.normalize(phone);
            if (!digits) return '';
        
            let withCode = this.addPrefix(digits, preferredCountry);
            let rest = withCode.replace(/^\+/, '');
            let code = '';
            let national = '';
            if (rest.startsWith('375')) {
                code = '375';
                national = rest.slice(3);
            } else if (rest.startsWith('7')) {
                code = '7';
                national = rest.slice(1);
            } else {
                code = '7';
                national = rest;
            }
        
            if (!national) return '+' + code;
        
            let country = this.detectCountry(national, preferredCountry);
            let formatted;
        
            if (country === 'BY') {
                // Беларусь – без изменений
                let mask;
                if (national.length <= 2) {
                    mask = '+' + code + ' (__';
                } else if (national.length <= 5) {
                    mask = '+' + code + ' (__) ___';
                } else if (national.length <= 7) {
                    mask = '+' + code + ' (__) ___-__';
                } else {
                    mask = '+' + code + ' (__) ___-__-__';
                }
                formatted = this._applyMask(national, mask);
            } else {
                // Россия: определяем длину кода города
                const fixedCodes = Array.from(PHONE_PREFIXES.RU.fixed);
                // Сортируем по убыванию длины, чтобы сначала проверить самые длинные
                const sortedCodes = fixedCodes.sort((a, b) => b.length - a.length);
                let isFound = false;
                let cityCode = '';
                let remaining = national;
        
                for (let p of sortedCodes) {
                    if (national.startsWith(p)) {
                        isFound = true;
                        cityCode = p;
                        remaining = national.slice(p.length);
                        break;
                    }
                }
        
                if (isFound && remaining.length > 0) {
                    // Форматируем оставшуюся часть
                    let groups = [];
                    let len = remaining.length;
                    if (len > 0) {
                        // Если остаток маленький, просто добавляем его
                        if (len <= 4) {
                            groups.push(remaining);
                        } else {
                            // Разбиваем по 2-3 цифры, начиная с большей группы
                            let firstGroupSize = len % 2 === 0 ? 2 : 3;
                            let start = 0;
                            if (firstGroupSize === 3) {
                                groups.push(remaining.slice(0, 3));
                                start = 3;
                            }
                            for (let i = start; i < len; i += 2) {
                                groups.push(remaining.slice(i, i + 2));
                            }
                        }
                    }
                    let numberPart = groups.join('-');
                    formatted = '+' + code + ' (' + cityCode + ') ' + numberPart;
                } else {
                    // Если код не найден – используем маску по умолчанию (для мобильных)
                    let mask;
                    if (national.length <= 3) {
                        mask = '+' + code + ' (___';
                    } else if (national.length <= 6) {
                        mask = '+' + code + ' (___) ___';
                    } else if (national.length <= 8) {
                        mask = '+' + code + ' (___) ___-__';
                    } else {
                        mask = '+' + code + ' (___) ___-__-__';
                    }
                    formatted = this._applyMask(national, mask);
                }
            }
        
            return formatted;
        },

        _applyMask(digits, mask) {
            let result = '';
            let idx = 0;
            for (let ch of mask) {
                if (ch === '_') {
                    result += digits[idx] || '_';
                    idx++;
                } else {
                    result += ch;
                }
            }
            return result;
        },

        setupAutoPrefix(inputElement, preferredCountry = null) {
            if (!inputElement) return;
            inputElement.addEventListener('blur', function() {
                let raw = this.value.trim();
                if (!raw) return;
                let withCode = PhoneUtils.addPrefix(raw, preferredCountry);
                this.value = PhoneUtils.format(withCode, preferredCountry);
            });
        },

        getInternational(phone, preferredCountry = null) {
            return this.addPrefix(phone, preferredCountry);
        }
    };

    // ========== Валидатор ==========
    const Validator = {
        email(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(String(email).toLowerCase());
        },

        phone(phone) {
            const clean = PhoneUtils.normalize(phone);
            return clean.length >= 10 && clean.length <= 11;
        },

        required(value) {
            if (typeof value === 'string') {
                return value.trim().length > 0;
            }
            return value !== null && value !== undefined && value !== '';
        },

        minLength(value, min) {
            if (typeof value === 'string') {
                return value.trim().length >= min;
            }
            return false;
        },

        maxLength(value, max) {
            if (typeof value === 'string') {
                return value.length <= max;
            }
            return true;
        },

        file(file, config = window.CONFIG?.FORM) {
            if (!file) return { valid: true };
            const extension = file.name.split('.').pop().toLowerCase();
            if (!config.ALLOWED_FILE_TYPES.includes(extension)) {
                return { valid: false, error: 'Недопустимый тип файла' };
            }
            if (file.type && !config.ALLOWED_MIME_TYPES.includes(file.type)) {
                return { valid: false, error: 'Недопустимый MIME-тип файла' };
            }
            return { valid: true };
        }
    };

    // ========== Лимитирование запросов ==========
    class RateLimiter {
        constructor(storage, key = 'requestTimestamps', max = 5, windowMs = 60000) {
            this.storage = storage;
            this.key = key;
            this.max = max;
            this.windowMs = windowMs;
        }

        _getTimestamps() {
            const data = this.storage.get(this.key);
            return Array.isArray(data) ? data : [];
        }

        _saveTimestamps(timestamps) {
            this.storage.set(this.key, timestamps);
        }

        canProceed() {
            const now = Date.now();
            const timestamps = this._getTimestamps();
            const valid = timestamps.filter(ts => now - ts < this.windowMs);
            return valid.length < this.max;
        }

        record() {
            const now = Date.now();
            const timestamps = this._getTimestamps();
            const valid = timestamps.filter(ts => now - ts < this.windowMs);
            valid.push(now);
            this._saveTimestamps(valid);
        }

        getRemainingTime() {
            const now = Date.now();
            const timestamps = this._getTimestamps();
            const valid = timestamps.filter(ts => now - ts < this.windowMs);
            if (valid.length < this.max) return 0;
            const oldest = Math.min(...valid);
            return Math.max(0, this.windowMs - (now - oldest));
        }

        reset() {
            this.storage.remove(this.key);
        }
    }

    // ========== Утилиты для работы со строками и slug ==========
    const SlugUtils = {
        _months: {
            'январь': '01', 'февраль': '02', 'март': '03', 'апрель': '04',
            'май': '05', 'июнь': '06', 'июль': '07', 'август': '08',
            'сентябрь': '09', 'октябрь': '10', 'ноябрь': '11', 'декабрь': '12'
        },

        generateSlug(text) {
            if (!text) return '';
            return text
                .toLowerCase()
                .replace(/[^а-яёa-z0-9\s-]/gi, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        },

        parseDate(dateStr) {
            if (!dateStr) return { year: new Date().getFullYear().toString(), month: '01' };
            const parts = dateStr.trim().split(/\s+/);
            const monthName = parts[0].toLowerCase();
            const year = parts[1] || new Date().getFullYear().toString();
            const month = this._months[monthName] || '01';
            return { year, month };
        },

        createShortSlug(title) {
            return this.generateSlug(title);
        }
    };

    return { DOM, Sanitizer, PhoneUtils, Validator, RateLimiter, SlugUtils };
})();

window.Utils = Utils;
window.PhoneUtils = Utils.PhoneUtils;