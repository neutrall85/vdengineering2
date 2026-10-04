/**
 * SEO-модуль для динамических страниц (БЕЗ ES6 EXPORT)
 * ООО "ВД Инжиниринг"
 *
 * Расширен: добавлены хлебные крошки для статических страниц
 * и мета-теги (title, description, canonical) для всех страниц.
 */

const seoDatabase = {
  // Данные для проектов (ключи совпадают с id из PROJECTS_DATA)
  project: {
    'ads-b-out': {
      title: 'Реализация функции ADS-B Out v.2 на ВС Ан-124-100 | Проекты',
      description: 'Дополнительный сертификат типа № FATA-STC030108. Модификация и реализация функции ADS-B Out v.2 на самолётах Ан-124-100(-150).',
      canonical: 'https://vdengineering.ru/projects/ads-b-out'
    },
    'd18t-support': {
      title: 'Поддержание лётной годности ВС Ан-124-100 | Проекты',
      description: 'Дополнительный сертификат типа № FATA-STC0304. Работы по подтверждению ресурса и срока службы ВС Ан-124-100(-150).',
      canonical: 'https://vdengineering.ru/projects/d18t-support'
    },
    'paint-update': {
      title: 'Модификация и обновление ЛКП воздушных судов | Проекты',
      description: 'Разработка и внедрение модификаций лакокрасочного покрытия планера воздушного судна.',
      canonical: 'https://vdengineering.ru/projects/paint-update'
    },
    'foreign-mods': {
      title: 'Модификация ВС и двигателей иностранного производства | Проекты',
      description: 'Разработка и одобрение 17 изменений типовой конструкции для самолётов и двигателей иностранного производства.',
      canonical: 'https://vdengineering.ru/projects/foreign-mods'
    },
    'foreign-repairs': {
      title: 'Нетиповые ремонты компонентов иностранного производства | Проекты',
      description: 'Разработка и выполнение более 235 нетиповых ремонтов конструкции ВС и компонентов II и III классов.',
      canonical: 'https://vdengineering.ru/projects/foreign-repairs'
    },
    'nose-repair': {
      title: 'Ремонт носовой части фюзеляжа | Проекты',
      description: 'Разработка ремонтной документации и выполнение нетиповых ремонтов носовой части фюзеляжа.',
      canonical: 'https://vdengineering.ru/projects/nose-repair'
    },
    'landing-gear': {
      title: 'Модификация и ремонт взлётно-посадочных устройств | Проекты',
      description: 'Инжиниринговые решения по модификации, ремонту и продлению ресурса шасси.',
      canonical: 'https://vdengineering.ru/projects/landing-gear'
    },
    'remote-control': {
      title: 'Модификация системы управления воздушным судном | Проекты',
      description: 'Разработка изменений в системе управления ВС, включая проводку и механизацию.',
      canonical: 'https://vdengineering.ru/projects/remote-control'
    },
    'antenna-replacement': {
      title: 'Модификация и ремонт систем связи и антенн | Проекты',
      description: 'Установка и модификация антенных систем, интеграция нового оборудования связи.',
      canonical: 'https://vdengineering.ru/projects/antenna-replacement'
    },
    'cargo-equipment': {
      title: 'Модификация грузового оборудования и СНО | Проекты',
      description: 'Проектирование, модификация и ремонт погрузочно-разгрузочных систем и СНО.',
      canonical: 'https://vdengineering.ru/projects/cargo-equipment'
    },
    'ground-equipment': {
      title: 'Разработка средств наземного обслуживания (СНО) | Проекты',
      description: 'Создание инновационных решений по наземному обслуживанию, нивелировке и взвешиванию.',
      canonical: 'https://vdengineering.ru/projects/ground-equipment'
    }
  },

  // Частичные ручные overrides для новостей.
  // Для остальных id данные берутся из window.NEWS_DATA (см. updateMetaTags).
  news: {
    '20260619': {
      title: 'Год подтверждения соответствия | Новости',
      description: 'ООО «ВД Инжиниринг» успешно подтвердило соответствие требованиям ФАП-21.',
      canonical: 'https://vdengineering.ru/news/20260619'
    },
    '20230922': {
      title: 'Расширение сертификата разработчика на транспортные ВС | Новости',
      description: '22 сентября 2023 года область действия сертификата № ФАВТ-Р-61 расширена.',
      canonical: 'https://vdengineering.ru/news/20230922'
    },
    '20220628': {
      title: 'Год сертификации и правопреемства | Новости',
      description: 'ООО «ВД Инжиниринг» стало правопреемником AMTES GmbH.',
      canonical: 'https://vdengineering.ru/news/20220628'
    }
  },

  // Данные для статических страниц (включая обратную связь)
  page: {
    'about': {
      title: 'О компании | Ведущий разработчик модификаций авиационной техники',
      description: 'ООО "ВД Инжиниринг" — 9+ лет опыта, 100+ проектов. Разработка и сертификация модификаций авиационной техники, двигателей и компонентов. Узнайте больше о компании.',
      canonical: 'https://vdengineering.ru/about'
    },
    'contacts': {
      title: 'Контакты | Свяжитесь с нами – ООО "ВД Инжиниринг"',
      description: 'Свяжитесь с нами: email для заявок rfp_vde@volga-dnepr.com, телефон +7 (495) 755 90 46, адрес и карта проезда в Москве.',
      canonical: 'https://vdengineering.ru/contacts'
    },
    'partners': {
      title: 'Партнёры и клиенты | ООО "ВД Инжиниринг"',
      description: 'Наши партнёры и клиенты: ведущие авиакомпании и компании авиационной отрасли. Волга-Днепр, Россия, AirBridgeCargo, Белавиа и другие.',
      canonical: 'https://vdengineering.ru/partners'
    },
    'services': {
      title: 'Компетенции | Полный спектр услуг по модификации авиационной техники',
      description: 'Полный цикл разработки модификаций: проектирование, сертификация, выпуск документации. Модификация планера, двигателей, систем, грузового оборудования и СНО.',
      canonical: 'https://vdengineering.ru/services'
    },
    'vacancies': {
      title: 'Вакансии | Присоединяйтесь к команде профессионалов авиаинжиниринга',
      description: 'Актуальные вакансии в ООО "ВД Инжиниринг". Работа в сфере авиационного инжиниринга. Присоединяйтесь к команде профессионалов!',
      canonical: 'https://vdengineering.ru/vacancies'
    },
    'docs': {
      title: 'Документы | Сертификаты и лицензии ООО «ВД Инжиниринг»',
      description: 'Сертификат разработчика № ФАВТ-Р-61, дополнительные сертификаты типа (STC), документация компании Волга-Днепр Инжиниринг.',
      canonical: 'https://vdengineering.ru/docs'
    },
    'feedback': {
      title: 'Обратная связь и запрос коммерческого предложения | Волга-Днепр Инжиниринг',
      description: 'Свяжитесь с нами для обсуждения вашего проекта, запроса КП или отправки резюме. Мы ценим каждого клиента и соискателя. Заполните форму, и мы ответим в кратчайшие сроки.',
      canonical: 'https://vdengineering.ru/feedback'
    }
  }
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateOrCreateMetaTag(selector, attributeName, attributeValue, content) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attributeName, attributeValue);
    document.head.appendChild(element);
  }
  element.content = sanitizeString(content);
}

function updateOrCreateLinkTag(selector, rel, href) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = sanitizeString(href);
}

/**
 * Достаёт данные новости из NEWS_DATA по id и формирует SEO-объект.
 * @param {string} id
 * @returns {{title:string, description:string, canonical:string}|null}
 */
function getNewsSeoFromData(id) {
  if (!window.NEWS_DATA) return null;
  const allNews = Object.values(window.NEWS_DATA).flat();
  const news = allNews.find(n => String(n.id) === String(id));
  if (!news) return null;

  const title = news.title ? `${news.title} | Новости` : 'Новости';
  const description = news.excerpt || (news.content ? news.content.replace(/<[^>]+>/g, '').slice(0, 200) + '…' : '');
  const canonical = `https://vdengineering.ru/news/${news.id}`;

  return { title, description, canonical };
}

function updateMetaTags(type, id) {
  let data = seoDatabase[type]?.[id];

  // Fallback для новостей — берём данные из window.NEWS_DATA,
  // если в seoDatabase.news явной записи нет.
  if (!data && type === 'news') {
    data = getNewsSeoFromData(id);
  }

  if (!data) return;

  try {
    document.title = sanitizeString(data.title);
    updateOrCreateMetaTag('meta[name="description"]', 'name', 'description', data.description);
    updateOrCreateLinkTag('link[rel="canonical"]', 'canonical', data.canonical);
  } catch (error) {
    console.warn('SEO update error:', error);
  }
}

// --- ХЛЕБНЫЕ КРОШКИ (Breadcrumbs) ---

function generateBreadcrumbJSONLD(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `https://vdengineering.ru${item.url}`
    }))
  };
}

function injectJSONLD(data) {
  const existingScript = document.querySelector('script[type="application/ld+json"][data-breadcrumb]');
  if (existingScript) existingScript.remove();

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-breadcrumb', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// --- ГЛАВНАЯ ФУНКЦИЯ ИНИЦИАЛИЗАЦИИ ---

function initDynamicSEO() {
  const path = window.location.pathname;

  // 1. Новость (URL вида /news/123)
  const newsMatch = path.match(/^\/news\/(\d+)/);
  if (newsMatch) {
    const newsId = newsMatch[1];
    const allNews = Object.values(window.NEWS_DATA || {}).flat();
    const news = allNews.find(n => String(n.id) === String(newsId));
    if (news) {
      injectJSONLD(generateBreadcrumbJSONLD([
        { name: 'Главная', url: '/' },
        { name: 'Новости', url: '/news' },
        { name: news.title, url: path }
      ]));
      updateMetaTags('news', newsId);
    }
    return;
  }

  // 2. Проект (URL вида /projects/ads-b-out)
  const projectMatch = path.match(/^\/projects\/(.+)/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    const project = window.PROJECTS_DATA?.[projectId];
    if (project) {
      injectJSONLD(generateBreadcrumbJSONLD([
        { name: 'Главная', url: '/' },
        { name: 'Проекты', url: '/projects' },
        { name: project.title, url: path }
      ]));
      updateMetaTags('project', projectId);
    }
    return;
  }

  // 3. Обратная связь
  if (path === '/feedback') {
    injectJSONLD(generateBreadcrumbJSONLD([
      { name: 'Главная', url: '/' },
      { name: 'Обратная связь', url: '/feedback' }
    ]));
    updateMetaTags('page', 'feedback');
    return;
  }

  // 4. Статические страницы
  const staticPages = {
    '/about': 'about',
    '/contacts': 'contacts',
    '/partners': 'partners',
    '/services': 'services',
    '/vacancies': 'vacancies',
    '/docs': 'docs'
  };

  let cleanPath = path.replace(/\.html$/, '');
  if (staticPages[cleanPath]) {
    const pageKey = staticPages[cleanPath];
    const pageName = {
      'about': 'О компании',
      'contacts': 'Контакты',
      'partners': 'Партнёры и клиенты',
      'services': 'Компетенции',
      'vacancies': 'Вакансии',
      'docs': 'Документы'
    }[pageKey];

    injectJSONLD(generateBreadcrumbJSONLD([
      { name: 'Главная', url: '/' },
      { name: pageName, url: cleanPath }
    ]));

    updateMetaTags('page', pageKey);
    return;
  }
}

// --- АВТОМАТИЧЕСКИЙ ЗАПУСК ПРИ ЗАГРУЗКЕ СТРАНИЦЫ ---
// initDynamicSEO также вызывается из app.js.
// Дублируем вызов на случай, если app.js не инициализирован.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof initDynamicSEO === 'function') initDynamicSEO();
  });
} else {
  if (typeof initDynamicSEO === 'function') initDynamicSEO();
}