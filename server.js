const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let url = req.url;

    // Игнорируем query-параметры (например, ?v=1)
    if (url.includes('?')) url = url.split('?')[0];

    // --- ПРАВИЛА ПЕРЕЗАПИСИ URL (ЧПУ) ---
    // Если запрос начинается с /news/ или равен /news -> отдаем news.html
    if (url.startsWith('/news/') || url === '/news') {
        url = '/news.html';
    } 
    else if (url.startsWith('/projects/') || url === '/projects') {
        url = '/projects.html';
    } 
    else if (url.startsWith('/services/') || url === '/services') {
        url = '/services.html';
    } 
    else if (url.startsWith('/vacancies/') || url === '/vacancies') {
        url = '/vacancies.html';
    } 
    else if (url.startsWith('/partners/') || url === '/partners') {
        url = '/partners.html';
    } 
    else if (url.startsWith('/contacts/') || url === '/contacts') {
        url = '/contacts.html';
    } 
    else if (url.startsWith('/docs/') || url === '/docs') {
        url = '/docs.html';
    } 
    else if (url.startsWith('/about/') || url === '/about') {
        url = '/about.html';
    } 
    else if (url.startsWith('/search/') || url === '/search') {
        url = '/search.html';
    } 
    else if (url === '/' || url === '/index') {
        url = '/index.html';
    }

    // --- ОПРЕДЕЛЕНИЕ ТИПА ФАЙЛА (для CSS, JS, картинок) ---
    const filePath = path.join(__dirname, url);
    const extname = path.extname(filePath);
    const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2'
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // --- ОТДАЕМ ФАЙЛ ---
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Страница не найдена</h1>');
            } else {
                res.writeHead(500);
                res.end(`Ошибка сервера: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`✅ СЕРВЕР ЗАПУЩЕН! Откройте в браузере: http://localhost:${PORT}/`);
});