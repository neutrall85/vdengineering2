const fs = require('fs');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const glob = require('glob');
const cheerio = require('cheerio');

// ============================================================================
// КОНФИГУРАЦИЯ
// ============================================================================
const CONFIG = {
  cssSrc: 'css/styles.css',
  cssDest: 'css/styles.min.css',
  htmlFiles: '*.html',
  htmlIgnore: ['node_modules/**', 'yandex_114fca37dd9b4a11.html'],
  version: Date.now(),
};

// ============================================================================
// МАНИФЕСТ JS-БАНДЛОВ
// ----------------------------------------------------------------------------
// Единый источник истины: где взять код, в каком порядке склеить,
// что исключить, куда положить, как подключить в HTML.
//
// Порядок массивов значим. Внутри паттерна файлы сортируются по алфавиту —
// это даёт детерминированную сборку.
//
// ThemeBootstrapper.js идёт в ОТДЕЛЬНЫЙ бандл, потому что:
//   1) подключается в <head> блокирующим <script> (устраняет FOUC);
//   2) самодостаточен и не зависит от остального кода;
//   3) держит основной бандл разгруженным от критичного кода.
// ============================================================================
const JS_BUNDLES = [
  {
    name: 'theme-bootstrap',
    patterns: ['js/managers/ThemeBootstrapper.js'],
    exclude: [],
    dest: 'js/theme-bootstrap.min.js',
    inject: 'head-before-css',
    defer: false,
  },
  {
  name: 'main',
    patterns: [
      'js/core/config.js',
      'js/core/Logger.js',
      'js/utils/**/*.js',
      'js/services/**/*.js',
      'js/validation/**/*.js',
      // Порядок важен: базовые шаблоны объявляются до агрегатора.
      'js/components/templates/NavbarTemplate.js',
      'js/components/templates/FooterTemplate.js',
      'js/components/templates/ModalTemplates.js',
      'js/components/templates/ComponentTemplates.js',
      'js/managers/**/*.js',
      'js/renderers/**/*.js',
      'js/pages/**/*.js',
      'js/data/**/*.js',
      'js/components/**/*.js',
      'js/core/**/*.js',
    ],
    exclude: [
      'js/managers/ThemeBootstrapper.js',
    ],
    dest: 'js/bundle.min.js',
    inject: 'body-end',
    defer: false,
  },
];

// ============================================================================
// ОЧИСТКА
// ============================================================================
function cleanBundles() {
  const targets = [
    ...JS_BUNDLES.map(b => b.dest),
    CONFIG.cssDest,
  ];
  for (const path of targets) {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
      console.log(`🗑️  Удалён: ${path}`);
    }
  }
}

// ============================================================================
// СБОРКА JS
// ============================================================================
async function buildBundle(bundle) {
  console.log(`🔨 Сборка JS-бандла "${bundle.name}"...`);

  const files = collectBundleFiles(bundle);
  if (files.length === 0) {
    console.error(`❌ Бандл "${bundle.name}" пуст — проверьте паттерны.`);
    process.exit(1);
  }

  const concatenated = files
    .map(file => fs.readFileSync(file, 'utf8') + '\n;\n')
    .join('');

  const result = await minify(concatenated, {
    compress: true,
    mangle: true,
    output: { beautify: false },
  });

  if (result.error) {
    console.error(`❌ Ошибка минификации "${bundle.name}":`, result.error);
    process.exit(1);
  }

  fs.writeFileSync(bundle.dest, result.code, 'utf8');

  const sizeKB = (result.code.length / 1024).toFixed(1);
  console.log(`✅ ${bundle.dest} (${sizeKB} KB, ${files.length} файлов)`);
}

// Собирает список файлов бандла согласно паттернам и исключениям.
function collectBundleFiles(bundle) {
  const excludeSet = new Set(bundle.exclude.map(normalizePath));
  const seen = new Set();
  const files = [];

  for (const pattern of bundle.patterns) {
    const matched = glob
      .sync(pattern, { ignore: ['**/node_modules/**'] })
      .map(normalizePath)
      .sort();

    for (const file of matched) {
      if (excludeSet.has(file)) continue;
      if (seen.has(file)) continue;
      seen.add(file);
      files.push(file);
    }
  }

  return files;
}

// Приводим путь к POSIX-виду — glob на Windows возвращает '\'.
function normalizePath(p) {
  return p.replace(/\\/g, '/');
}

// ============================================================================
// СБОРКА CSS
// ============================================================================
function buildCSS() {
  console.log('🔨 Сборка CSS...');
  const cssContent = fs.readFileSync(CONFIG.cssSrc, 'utf8');
  const minified = new CleanCSS().minify(cssContent);

  if (minified.errors && minified.errors.length) {
    console.error('❌ Ошибки минификации CSS:', minified.errors);
    process.exit(1);
  }

  fs.writeFileSync(CONFIG.cssDest, minified.styles, 'utf8');
  console.log(
    `✅ ${CONFIG.cssDest} (${(minified.styles.length / 1024).toFixed(1)} KB)`
  );
}

// ============================================================================
// ЗАМЕНА СКРИПТОВ И СТИЛЕЙ В HTML
// ============================================================================
function replaceWithBundles() {
  console.log('🔄 Замена скриптов и стилей на бандлы...');

  const htmlFiles = glob.sync(CONFIG.htmlFiles, { ignore: CONFIG.htmlIgnore });
  const version = CONFIG.version;
  const cssBundleHref = `/css/styles.min.css?v=${version}`;

  for (const file of htmlFiles) {
    const original = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(original, { decodeEntities: false });

    removeLocalScripts($);
    removeLocalStyles($);
    injectCssBundle($, cssBundleHref);

    for (const bundle of JS_BUNDLES) {
      injectJsBundle($, bundle, version);
    }

    const html = $.html({ decodeEntities: false });
    fs.writeFileSync(file, finalizeHtmlFormatting(html), 'utf8');
  }

  console.log(`✅ Все HTML-файлы обновлены (версия ${version})`);
}

function removeLocalScripts($) {
  $('script[src]')
    .filter((i, el) => isLocalUrl($(el).attr('src')))
    .remove();
}

function removeLocalStyles($) {
  $('link[rel="stylesheet"][href]')
    .filter((i, el) => isLocalUrl($(el).attr('href')))
    .remove();
}

function injectCssBundle($, href) {
  const link = `<link rel="stylesheet" href="${href}">`;
  const targetPreload = $('link[rel="preload"][as="font"][type="font/woff2"]').first();
  const fallbackPreload = $('link[rel="preload"]').first();

  if (targetPreload.length) {
    targetPreload.after(link);
  } else if (fallbackPreload.length) {
    fallbackPreload.after(link);
  } else {
    $('head').append(link);
  }
}

function injectJsBundle($, bundle, version) {
  const src = `/${bundle.dest}?v=${version}`;
  const deferAttr = bundle.defer ? ' defer' : '';
  const scriptHtml = `<script${deferAttr} src="${src}"></script>`;

  switch (bundle.inject) {
    case 'head-before-css':
      injectBeforeCss($, scriptHtml);
      break;
    case 'body-end':
      injectBeforeBodyEnd($, scriptHtml);
      break;
    default:
      console.warn(`⚠️  Неизвестная стратегия inject: ${bundle.inject}`);
  }
}

function injectBeforeCss($, htmlString) {
  const firstCss = $('head link[rel="stylesheet"]').first();
  if (firstCss.length) {
    firstCss.before(htmlString);
  } else {
    $('head').prepend(htmlString);
  }
}

function injectBeforeBodyEnd($, htmlString) {
  const $body = $('body');
  if ($body.length) {
    $body.append(htmlString);
  } else {
    $.root().append(htmlString);
  }
}

function finalizeHtmlFormatting(html) {
  return html
    .replace(/\s*<\/body>/i, '\n</body>')
    .replace(/<\/body>\s*<\/html>/i, '</body>\n</html>');
}

function isLocalUrl(url) {
  if (!url) return false;
  return !url.startsWith('http://') && !url.startsWith('https://');
}

// ============================================================================
// ГЛАВНАЯ
// ============================================================================
async function build() {
  console.log('🚀 Начало сборки...\n');
  cleanBundles();

  for (const bundle of JS_BUNDLES) {
    await buildBundle(bundle);
  }

  buildCSS();
  replaceWithBundles();

  console.log('\n🎉 Сборка завершена успешно!');
}

build();