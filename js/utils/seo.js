/**
 * SEO-модуль для динамических страниц (БЕЗ ES6 EXPORT)
 */

const seoDatabase = {
  project: {
    'ads-b-out': {
      title: 'Реализация функции ADS-B Out v.2 на ВС Ан-124-100 | Проекты',
      description: 'Дополнительный сертификат типа № FATA-STC030108. Модификация и реализация функции ADS-B Out v.2 на самолетах Ан-124-100(-150).',
      canonical: 'https://vdengineering.ru/projects/ads-b-out'
    },
    'd18t-support': {
      title: 'Поддержание летной годности ВС Ан-124-100 | Проекты',
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
      description: 'Разработка и одобрение 11 изменений типовой конструкции для самолетов и двигателей иностранного производства.',
      canonical: 'https://vdengineering.ru/projects/foreign-mods'
    },
    'foreign-repairs': {
      title: 'Нетиповые ремонты компонентов иностранного производства | Проекты',
      description: 'Разработка и выполнение более 170 нетиповых ремонтов конструкции ВС и компонентов II и III классов.',
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
  news: {
    '20260619': {
      title: 'Год подтверждения соответствия | Новости',
      description: 'ООО «Волга-Днепр Инжиниринг» успешно подтвердило соответствие требованиям ФАП-21.',
      canonical: 'https://vdengineering.ru/news/20260619'
    },
    '20230922': {
      title: 'Расширение сертификата разработчика на транспортные ВС | Новости',
      description: '22 сентября 2023 года область действия сертификата № ФАВТ-Р-61 расширена.',
      canonical: 'https://vdengineering.ru/news/20230922'
    },
    '20220628': {
      title: 'Год сертификации и правопреемства | Новости',
      description: 'ООО «Волга-Днепр Инжиниринг» стало правопреемником AMTES GmbH.',
      canonical: 'https://vdengineering.ru/news/20220628'
    }
  },
  page: {
    'feedback': {
      title: 'Обратная связь и запрос коммерческого предложения | Волга-Днепр Инжиниринг',
      description: 'Свяжитесь с нами для обсуждения вашего проекта, запроса КП или отправки резюме. Мы ценим каждого клиента и соискателя. Заполните форму, и мы ответим в кратчайшие сроки.',
      canonical: 'https://vdengineering.ru/feedback'
    }
  }
};

// --- ФУНКЦИИ ДЛЯ ХЛЕБНЫХ КРОШЕК (SEO) ---
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
// --------------------------------------------

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

function updateMetaTags(type, id) {
  const data = seoDatabase[type]?.[id];
  if (!data) return;

  try {
    document.title = sanitizeString(data.title);
    updateOrCreateMetaTag('meta[name="description"]', 'name', 'description', data.description);
    updateOrCreateLinkTag('link[rel="canonical"]', 'canonical', data.canonical);
  } catch (error) {
    console.warn('SEO update error:', error);
  }
}

// Глобальная функция инициализации (без export)
function initDynamicSEO() {
  const path = window.location.pathname;

  // 1. Проверяем, открыта ли новость
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

  // 2. Проверяем, открыт ли проект (исправлено: /projects/)
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

  // 3. Если это страница обратной связи
  if (path === '/feedback' || path === '/feedback.html' || path.indexOf('/feedback') === 0) {
    updateMetaTags('page', 'feedback');
  }
}

// Глобальная функция для модалок (без export)
function handleModalOpen(type, id, modalOpenCallback) {
  updateMetaTags(type, id);
  window.history.pushState({ type, id }, '', `/${type}/${id}`);
  if (typeof modalOpenCallback === 'function') {
    modalOpenCallback(id);
  }
}