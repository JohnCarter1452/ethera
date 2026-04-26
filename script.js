// script.js — полная логика для энциклопедии Этеры

// Конфигурация
const dataRoot = '/data/';
let contentCache = {};           // Кэш загруженных статей { "category/slug": html }
let searchIndex = [];            // Массив для поиска: { title, url, snippet, category, slug }

// Дождаться загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initMobileMenu();
    setupSearch();
    handleRoute();
    window.addEventListener('popstate', handleRoute);
});

// ---------- ОБЩИЕ ФУНКЦИИ ----------
function getCategoryTitleRu(cat) {
    const titles = {
        'classes': 'Классы',
        'peoples': 'Народы',
        'factions': 'Фракции',
        'geography': 'География',
        'artifacts': 'Артефакты',
        'bestiary': 'Бестиарий',
        'lore': 'Лор и история',
        'religions': 'Религии',
        'rules': 'Правила',
        'rules_ether': 'Эфир',
        'gm_tools': 'Инструменты мастера',
        'main': 'Главная'
    };
    return titles[cat] || cat;
}

// Извлечение заголовка из Markdown
function getTitleFromMarkdown(md) {
    const match = md.match(/^#\s+(.*)/m);
    return match ? match[1] : 'Без названия';
}

// Добавление статьи в поисковый индекс
function addToSearchIndex(category, slug, title, content) {
    // Ограничим длину сниппета
    const plainText = content.replace(/<[^>]*>/g, '').substring(0, 200);
    searchIndex.push({
        title,
        url: `#${category}/${slug}`,
        snippet: plainText,
        category,
        slug
    });
}

// ---------- ЗАГРУЗКА И ОТОБРАЖЕНИЕ ----------
async function loadContent(category, slug) {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    // Проверка кэша
    const cacheKey = `${category}/${slug}`;
    if (contentCache[cacheKey]) {
        container.innerHTML = contentCache[cacheKey];
        return;
    }
    
    try {
        let url = '';
        let isIndex = false;
        if (slug === 'index') {
            // Пытаемся загрузить README.md или _catalog.md
            const readmeUrl = `${dataRoot}${category}/README.md`;
            const catalogUrl = `${dataRoot}${category}/_catalog.md`;
            let resp = await fetch(readmeUrl);
            if (resp.ok) {
                url = readmeUrl;
            } else {
                resp = await fetch(catalogUrl);
                if (resp.ok) url = catalogUrl;
                else throw new Error('Нет index-файла');
            }
            isIndex = true;
        } else {
            url = `${dataRoot}${category}/${slug}.md`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const markdown = await response.text();
        const html = marked.parse(markdown);
        
        let finalHtml = '';
        if (isIndex) {
            finalHtml = `
                <div class="entry-header"><h1>${getCategoryTitleRu(category)}</h1></div>
                <div class="entry-content">${html}</div>
            `;
        } else {
            const title = getTitleFromMarkdown(markdown);
            finalHtml = `
                <div class="entry-header"><h1>${escapeHtml(title)}</h1></div>
                <div class="entry-content">${html}</div>
            `;
        }
        
        container.innerHTML = finalHtml;
        contentCache[cacheKey] = finalHtml;
        
        // Добавляем в поисковый индекс (если не индексная страница)
        if (!isIndex) {
            const title = getTitleFromMarkdown(markdown);
            addToSearchIndex(category, slug, title, html);
        }
        
        // Обновить URL
        history.pushState({ category, slug }, '', `#${category}/${slug}`);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="entry-header"><h1>Ошибка</h1></div>
                               <div class="entry-content"><p>Не удалось загрузить страницу: ${category}/${slug}.md</p>
                               <p>Убедитесь, что файл существует в папке data/${category}/.</p></div>`;
    }
}

// Загрузка главной страницы (README.md в корне или приветствие)
async function loadMainPage() {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    try {
        const response = await fetch('/README.md');
        if (response.ok) {
            const markdown = await response.text();
            const html = marked.parse(markdown);
            container.innerHTML = `
                <div class="entry-header"><h1>Хроники Этеры</h1></div>
                <div class="entry-content">${html}</div>
            `;
        } else {
            // Запасной контент
            container.innerHTML = `
                <div class="entry-header"><h1>Добро пожаловать в Этеру</h1></div>
                <div class="entry-content">
                    <p>Этера — планета пара и эфира, где цивилизация строится на наследии Аэтерных Архитекторов. Здесь нет магии, но есть древние технологии, уникальные руды и смертельные тайны.</p>
                    <div class="stat-block">«Эфир не прощает слабости. Он ждёт тех, кто осмелится им управлять.» — Архивариус-Отступник</div>
                    <p>Используйте меню для навигации по энциклопедии. Все данные загружаются из Markdown-файлов, вы можете свободно редактировать их в папке /data/.</p>
                </div>
            `;
        }
        history.pushState({}, '', '#');
    } catch (err) {
        container.innerHTML = `<div class="entry-header"><h1>Приветствие</h1></div>
                               <div class="entry-content"><p>Добро пожаловать в энциклопедию Этеры.</p></div>`;
    }
}

// ---------- НАВИГАЦИЯ ----------
function initNavigation() {
    // Все ссылки с data-category и data-slug
    const links = document.querySelectorAll('.nav-list a');
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.getAttribute('data-category');
            const slug = link.getAttribute('data-slug');
            if (category && slug) {
                loadContent(category, slug);
            } else {
                loadMainPage();
            }
            // Закрываем меню на мобильных
            if (window.innerWidth <= 800) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });
    
    // Ссылка в логотипе
    const homeLink = document.getElementById('homeLink');
    if (homeLink) {
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            loadMainPage();
        });
    }
}

function handleRoute() {
    const hash = window.location.hash.slice(1);
    if (!hash || hash === '') {
        loadMainPage();
        return;
    }
    const parts = hash.split('/');
    if (parts.length >= 2) {
        const category = parts[0];
        const slug = parts.slice(1).join('/');
        loadContent(category, slug);
    } else {
        loadMainPage();
    }
}

// ---------- ПОИСК ----------
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query === '') return;
            await performSearch(query);
        }
    });
}

async function performSearch(query) {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<div class="loading">Поиск...</div>';
    
    // Если поисковый индекс пуст — загружаем все статьи (можно в фоне, но здесь сделаем простую загрузку по мере необходимости)
    // Для демонстрации, если индекс пуст, предложим пользователю просканировать сайт
    if (searchIndex.length === 0) {
        // Загружаем список статей из специального файла (упрощённо: предложим пользователю вручную создать список)
        // Но можно сделать фоновую загрузку всех статей по известной структуре.
        // Сделаем так: попробуем загрузить предопределённый файл `search_index.json`
        try {
            const resp = await fetch('/search_index.json');
            if (resp.ok) {
                const items = await resp.json();
                searchIndex.push(...items);
            } else {
                // Заглушка: показываем сообщение
                container.innerHTML = `<div class="entry-header"><h1>Поиск</h1></div>
                                       <div class="entry-content"><p>Индекс поиска ещё не создан. Пожалуйста, создайте файл <code>search_index.json</code> в корне сайта со списком статей.</p>
                                       <p>Формат: <code>[{"title":"Название","url":"#категория/статья","snippet":"..."}]</code></p></div>`;
                return;
            }
        } catch (err) {
            container.innerHTML = `<div class="entry-header"><h1>Поиск</h1></div>
                                   <div class="entry-content"><p>Индекс поиска не найден. Создайте файл <code>search_index.json</code> или воспользуйтесь навигацией по меню.</p></div>`;
            return;
        }
    }
    
    const lowerQuery = query.toLowerCase();
    const results = searchIndex.filter(item => 
        item.title.toLowerCase().includes(lowerQuery) || 
        item.snippet.toLowerCase().includes(lowerQuery)
    );
    
    if (results.length === 0) {
        container.innerHTML = `<div class="entry-header"><h1>Поиск: "${escapeHtml(query)}"</h1></div>
                               <div class="entry-content"><p>Ничего не найдено.</p></div>`;
        return;
    }
    
    let html = `<div class="entry-header"><h1>Результаты поиска: "${escapeHtml(query)}"</h1></div>
                <div class="list-grid">`;
    for (const res of results) {
        html += `
            <div class="list-card" data-url="${res.url}">
                <h3>${escapeHtml(res.title)}</h3>
                <p>${escapeHtml(res.snippet)}...</p>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
    
    // Добавляем обработчики клика на карточки результатов
    document.querySelectorAll('.list-card[data-url]').forEach(card => {
        card.addEventListener('click', () => {
            const url = card.getAttribute('data-url');
            if (url) {
                window.location.hash = url.replace('#', '');
                handleRoute();
            }
        });
    });
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ---------- МОБИЛЬНОЕ МЕНЮ ----------
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const closeBtn = document.getElementById('closeSidebarBtn');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('open');
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('open');
        });
    }
    // Закрытие при клике вне меню
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 800) {
            if (sidebar && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}