const fs = require('fs');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const glob = require('glob');
const cheerio = require('cheerio');

// Конфигурация
const CONFIG = {
  jsSrc: 'js/**/*.js',
  cssSrc: 'css/styles.css',
  jsDest: 'js/bundle.min.js',
  cssDest: 'css/styles.min.css',
  htmlFiles: '*.html',
  version: Date.now(),
};

// Очистка старых бандлов
function cleanBundles() {
  if (fs.existsSync(CONFIG.jsDest)) {
    fs.unlinkSync(CONFIG.jsDest);
    console.log(`🗑️ Старый JS-бандл удалён`);
  }
  if (fs.existsSync(CONFIG.cssDest)) {
    fs.unlinkSync(CONFIG.cssDest);
    console.log(`🗑️ Старый CSS-бандл удалён`);
  }
}

// Сборка JS
async function buildJS() {
  console.log('🔨 Сборка JS...');
  const order = [
    'js/core/config.js',
    'js/core/Logger.js',
    'js/utils/**/*.js',
    'js/services/**/*.js',
    'js/validation/**/*.js',
    'js/components/templates/**/*.js',
    'js/managers/**/*.js',
    'js/renderers/**/*.js',
    'js/pages/**/*.js',
    'js/data/**/*.js',
    'js/components/**/*.js',
    'js/core/**/*.js',
  ];
  let files = [];
  for (const pattern of order) {
    const matched = glob.sync(pattern, { ignore: ['**/node_modules/**'] });
    for (const file of matched) {
      if (!files.includes(file)) files.push(file);
    }
  }
  let allCode = '';
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    allCode += content + '\n;\n';
  }
  const result = await minify(allCode, {
    compress: true,
    mangle: true,
    output: { beautify: false }
  });
  if (result.error) {
    console.error('❌ Ошибка минификации JS:', result.error);
    process.exit(1);
  }
  fs.writeFileSync(CONFIG.jsDest, result.code, 'utf8');
  console.log(`✅ JS собран: ${CONFIG.jsDest} (${(result.code.length / 1024).toFixed(1)} KB)`);
}

// Сборка CSS
function buildCSS() {
  console.log('🔨 Сборка CSS...');
  const cssContent = fs.readFileSync(CONFIG.cssSrc, 'utf8');
  const minified = new CleanCSS().minify(cssContent);
  if (minified.errors && minified.errors.length) {
    console.error('❌ Ошибки минификации CSS:', minified.errors);
    process.exit(1);
  }
  fs.writeFileSync(CONFIG.cssDest, minified.styles, 'utf8');
  console.log(`✅ CSS собран: ${CONFIG.cssDest} (${(minified.styles.length / 1024).toFixed(1)} KB)`);
}

// Замена локальных скриптов и стилей на бандлы
function replaceWithBundles() {
  console.log('🔄 Замена скриптов и стилей на бандлы...');
  const htmlFiles = glob.sync(CONFIG.htmlFiles, { 
    ignore: ['node_modules/**', 'yandex_114fca37dd9b4a11.html'] 
  });
  const version = CONFIG.version;
  const jsBundle = `/js/bundle.min.js?v=${version}`;
  const cssBundle = `/css/styles.min.css?v=${version}`;

  for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content, { decodeEntities: false });

    // Удаляем все локальные скрипты (не внешние)
    const localScripts = $('script[src]').filter((i, el) => {
      const src = $(el).attr('src');
      return src && !src.startsWith('http://') && !src.startsWith('https://');
    });
    localScripts.remove();

    // Удаляем все локальные стили (не внешние)
    const localLinks = $('link[rel="stylesheet"][href]').filter((i, el) => {
      const href = $(el).attr('href');
      return href && !href.startsWith('http://') && !href.startsWith('https://');
    });
    localLinks.remove();

    // Вставляем CSS-бандл в <head> после preload (или в конец head)
    const newLink = `<link rel="stylesheet" href="${cssBundle}">`;
    const preloadLink = $('link[rel="preload"][as="font"][type="font/woff2"][crossorigin]').first();
    const targetPreload = preloadLink.length ? preloadLink : $('link[rel="preload"]').first();
    if (targetPreload.length) {
      targetPreload.after(newLink);
    } else {
      $('head').append(newLink);
    }

    // Получаем HTML как строку
    let html = $.html({ decodeEntities: false });

    // Вставляем JS-бандл перед закрывающим </body>.
    // Удаляем все пробельные символы перед </body>, вставляем скрипт с отступом (4 пробела),
    // после скрипта ставим перенос строки, затем </body> без отступа.
    const scriptTag = `    <script src="${jsBundle}"><\/script>`;
    html = html.replace(/\s*<\/body>/i, `\n${scriptTag}\n</body>`);

    // Убеждаемся, что </html> не слиплось с </body> и тоже без отступа
    html = html.replace(/<\/body>\s*<\/html>/i, `</body>\n</html>`);

    fs.writeFileSync(file, html, 'utf8');
  }

  console.log(`✅ Все HTML-файлы обновлены (версия ${version})`);
}

// Главная
async function build() {
  console.log('🚀 Начало сборки...\n');
  cleanBundles();
  await buildJS();
  buildCSS();
  replaceWithBundles();
  console.log('\n🎉 Сборка завершена успешно!');
}

build();