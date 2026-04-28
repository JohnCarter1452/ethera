// script.js — полная логика для энциклопедии Этеры
// Добавлена автоматическая генерация каталога через catalog.json

// Конфигурация
const dataRoot = '/ethera/data/';
const baseUrl = '/ethera';
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

document.getElementById('backButton').addEventListener('click', () => {
    history.back();
});

// ---------- ОБЩИЕ ФУНКЦИИ ----------
function getCategoryTitleRu(cat) {
    const titles = {
        'classes': 'Классы',
        'peoples': 'Народы',
        'factions': 'Фракции',
        'geography': 'География',
        'artifacts': 'Артефакты',
        'equipment': 'Снаряжение',
        'backgrounds': 'Предыстории',
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
    const plainText = content.replace(/<[^>]*>/g, '').substring(0, 200);
    searchIndex.push({
        title,
        url: `#${category}/${slug}`,
        snippet: plainText,
        category,
        slug
    });
}

// ---------- ЗАГРУЗКА КАТАЛОГА (список статей) ----------
async function loadCategoryIndex(category) {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<div class="loading">Загрузка каталога...</div>';
    try {
        // 1. Пытаемся загрузить catalog.json
        const catalogUrl = `${dataRoot}${category}/catalog.json`;
        const catalogResp = await fetch(catalogUrl);
        if (catalogResp.ok) {
            const files = await catalogResp.json();
            if (files.length) {
                let html = `<div class="entry-header"><h1>${getCategoryTitleRu(category)}</h1></div>
                            <div class="list-grid">`;
                for (let file of files) {
                    // Убираем расширение .md, если есть
                    let slug = file.endsWith('.md') ? file.slice(0, -3) : file;
                    let title = slug.replace(/_/g, ' ');
                    html += `<div class="list-card" data-category="${category}" data-slug="${slug}">
                                <h3>${escapeHtml(title)}</h3>
                            </div>`;
                }
                html += `</div>`;
                container.innerHTML = html;
                // Обработчики кликов по карточкам
                document.querySelectorAll('.list-card[data-category][data-slug]').forEach(card => {
                    card.addEventListener('click', () => {
                        const cat = card.getAttribute('data-category');
                        const slug = card.getAttribute('data-slug');
                        loadContent(cat, slug);
                    });
                });
                history.pushState({ category, slug: 'index' }, '', `#${category}/index`);
                return;
            }
        }
        
        // 2. Если нет catalog.json, пробуем README.md
        const readmeUrl = `${dataRoot}${category}/README.md`;
        const readmeResp = await fetch(readmeUrl);
        if (readmeResp.ok) {
            const markdown = await readmeResp.text();
            const html = marked.parse(markdown);
            container.innerHTML = `<div class="entry-header"><h1>${getCategoryTitleRu(category)}</h1></div>
                                    <div class="entry-content">${html}</div>`;
            history.pushState({ category, slug: 'index' }, '', `#${category}/index`);
            return;
        }
        
        // 3. Иначе _catalog.md
        const catalogMdUrl = `${dataRoot}${category}/_catalog.md`;
        const catalogMdResp = await fetch(catalogMdUrl);
        if (catalogMdResp.ok) {
            const markdown = await catalogMdResp.text();
            const html = marked.parse(markdown);
            container.innerHTML = `<div class="entry-header"><h1>${getCategoryTitleRu(category)}</h1></div>
                                    <div class="entry-content">${html}</div>`;
            history.pushState({ category, slug: 'index' }, '', `#${category}/index`);
            return;
        }
        
        // 4. Ничего не найдено
        container.innerHTML = `<div class="entry-header"><h1>${getCategoryTitleRu(category)}</h1></div>
                                <div class="entry-content"><p>В этой категории пока нет статей. Вы можете добавить файлы .md в папку <code>data/${category}/</code>.</p>
                                <p>Для автоматического каталога создайте файл <code>catalog.json</code> со списком имён файлов (без расширения .md).<br>
                                Или создайте <code>README.md</code> с ручным списком ссылок.</p></div>`;
        history.pushState({ category, slug: 'index' }, '', `#${category}/index`);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="entry-header"><h1>Ошибка</h1></div>
                               <div class="entry-content"><p>Не удалось загрузить каталог категории ${category}.</p></div>`;
    }
}

// ---------- ЗАГРУЗКА И ОТОБРАЖЕНИЕ КОНКРЕТНОЙ СТАТЬИ ----------
async function loadContent(category, slug) {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    
    const cacheKey = `${category}/${slug}`;
    if (contentCache[cacheKey]) {
        container.innerHTML = contentCache[cacheKey];
        return;
    }
    
    try {
        // Если запрошен каталог (index) — используем отдельную функцию
        if (slug === 'index') {
            await loadCategoryIndex(category);
            return;
        }
        
        // Загрузка обычной статьи
        const url = `${dataRoot}${category}/${slug}.md`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const markdown = await response.text();
        const html = marked.parse(markdown);
        const title = getTitleFromMarkdown(markdown);
        
        const finalHtml = `
            <div class="entry-header"><h1>${escapeHtml(title)}</h1></div>
            <div class="entry-content">${html}</div>
        `;
        container.innerHTML = finalHtml;
        contentCache[cacheKey] = finalHtml;
        
        // Добавляем в поисковый индекс
        addToSearchIndex(category, slug, title, html);
        
        // Обновить URL
        history.pushState({ category, slug }, '', `#${category}/${slug}`);
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="entry-header"><h1>Ошибка</h1></div>
                               <div class="entry-content"><p>Не удалось загрузить страницу: ${category}/${slug}.md</p>
                               <p>Убедитесь, что файл существует в папке data/${category}/.</p></div>`;
    }
}

// Загрузка главной страницы (README.md в корне сайта)
async function loadMainPage() {
    const container = document.getElementById('dynamicContent');
    container.innerHTML = '<div class="loading">Загрузка...</div>';
    try {
        // Используем baseUrl для корректного пути (например, /ethera/README.md)
        const response = await fetch(`${baseUrl}/README.md`);
        if (response.ok) {
            const markdown = await response.text();
            const html = marked.parse(markdown);
            container.innerHTML = `
                <div class="entry-header"><h1>Хроники Этеры</h1></div>
                <div class="entry-content">${html}</div>
            `;
        } else {
            // Запасной контент (если README.md не найден)
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
            if (window.innerWidth <= 800) {
                document.getElementById('sidebar').classList.remove('open');
            }
        });
    });
    
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
    
    if (searchIndex.length === 0) {
        try {
            const resp = await fetch('/search_index.json');
            if (resp.ok) {
                const items = await resp.json();
                searchIndex.push(...items);
            } else {
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
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 800) {
            if (sidebar && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

/* Стиль для ссылки с картинкой-логотипом */
.image-logo {
    display: inline-block;
    line-height: 0; /* убирает лишний отступ под картинкой */
    transition: transform 0.2s, filter 0.2s;
}

.image-logo img {
    height: 60px;        /* регулируйте под свой логотип */
    width: auto;
    display: block;
    border: none;
}

.image-logo:hover {
    transform: scale(1.02);
    filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.5));
}

/* ===== БОКОВАЯ ПАНЕЛЬ ===== */
.sidebar {
    width: 280px;
    background: rgba(18, 23, 27, 0.85); /* Полупрозрачный фон */
    backdrop-filter: blur(12px);        /* Эффект размытия */
    border-right: 1px solid rgba(42, 37, 51, 0.5);
    padding: 2rem 1rem;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    transition: transform 0.3s ease;
    z-index: 10;
}

/* Заголовок раздела */
.nav-category {
    margin-bottom: 2rem; /* Увеличиваем отступ между группами */
}

.nav-category h3 {
    font-family: 'Algeria Two', 'Cinzel', serif;
    font-size: 0.8rem;   /* Чуть меньше, чем обычно */
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #8e869e;
    margin-bottom: 1rem;
    padding-left: 0.5rem;
    font-weight: 500;
}

/* Список ссылок */
.nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.nav-list li {
    margin-bottom: 0.2rem;
}

.nav-list a {
    display: block;
    padding: 0.6rem 1rem;          /* Увеличиваем область клика */
    border-radius: 8px;              /* Скругленные углы */
    font-family: 'Inkulinati', 'Open Sans', sans-serif;
    font-size: 0.95rem;
    color: #cbc3d4;
    text-decoration: none;
    transition: all 0.2s ease;
}

/* Эффект при наведении */
.nav-list a:hover {
    background-color: rgba(212, 175, 55, 0.15); /* Подсветка золотым цветом */
    color: #d4af37;
    padding-left: 1.2rem;
}

// ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ПОИСКА ----------
function simpleStem(word) {
    // Простой стемминг для русского языка: удаление окончаний
    const suffixes = [
        'ая', 'яя', 'ее', 'ие', 'ые', 'ое', 'ей', 'ий', 'ой', 'ый',
        'ую', 'юю', 'ую', 'яю', 'ем', 'им', 'ом', 'ам', 'ям', 'ах', 'ях',
        'а', 'я', 'е', 'и', 'й', 'ь', 'о', 'у', 'ю', 'ы'
    ];
    let stem = word.toLowerCase();
    for (let suffix of suffixes) {
        if (stem.endsWith(suffix)) {
            stem = stem.slice(0, -suffix.length);
            break;
        }
    }
    if (stem.length < 2) stem = word.toLowerCase();
    return stem;
}

function tokenize(text) {
    // Разбиваем текст на слова, удаляем знаки препинания и приводим к нижнему регистру
    return text.toLowerCase().match(/\b[\wа-яё]+\b/gu) || [];
}

function highlightWords(text, words) {
    // Выделение найденных слов жирным в сниппете
    let result = text;
    for (let w of words) {
        const regex = new RegExp(`(${w})`, 'gi');
        result = result.replace(regex, '<strong>$1</strong>');
    }
    return result;
}

// ---------- КЭШИРОВАНИЕ ИНДЕКСА ----------
const STORAGE_KEY = 'etherea_search_index';
const STORAGE_VERSION = 'v1';

async function buildSearchIndex() {
    if (searchIndexBuilt) return;
    
    // Проверяем localStorage
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (data.version === STORAGE_VERSION && data.index && data.index.length) {
                searchIndex = data.index;
                searchIndexBuilt = true;
                console.log('Индекс загружен из кэша');
                return;
            }
        } catch(e) {}
    }
    
    const container = document.getElementById('dynamicContent');
    const originalContent = container.innerHTML;
    container.innerHTML = '<div class="loading">Построение индекса поиска...</div>';
    
    const categories = [
        'classes', 'peoples', 'factions', 'geography', 'artifacts',
        'bestiary', 'backgrounds', 'lore', 'religions', 'rules', 'ether_rules', 'gm_tools'
    ];
    const index = [];
    
    for (const cat of categories) {
        try {
            const catalogUrl = `${dataRoot}${cat}/catalog.json`;
            const resp = await fetch(catalogUrl);
            if (resp.ok) {
                const files = await resp.json();
                for (let file of files) {
                    let slug = file.endsWith('.md') ? file.slice(0, -3) : file;
                    const articleUrl = `${dataRoot}${cat}/${slug}.md`;
                    const articleResp = await fetch(articleUrl);
                    if (articleResp.ok) {
                        const markdown = await articleResp.text();
                        const title = markdown.match(/^#\s+(.*)/m)?.[1] || slug;
                        // Убираем markdown разметку для сниппета
                        const plainText = markdown.replace(/[#*`\[\]()]/g, '').substring(0, 500);
                        index.push({
                            title: title,
                            url: `#${cat}/${slug}`,
                            snippet: plainText,
                            words: tokenize(title + ' ' + plainText)
                        });
                    }
                }
            }
        } catch(e) { console.warn(`Ошибка индексации для ${cat}`, e); }
    }
    
    searchIndex = index;
    searchIndexBuilt = true;
    // Сохраняем в localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        index: searchIndex
    }));
    container.innerHTML = originalContent;
}

// ---------- УЛУЧШЕННЫЙ ПОИСК С РАНЖИРОВАНИЕМ ----------
async function performSearch(query) {
    if (!query.trim()) return;
    if (!searchIndexBuilt) await buildSearchIndex();
    
    const container = document.getElementById('dynamicContent');
    if (!searchIndex || searchIndex.length === 0) {
        container.innerHTML = `<div class="entry-header"><h1>Поиск</h1></div><div class="entry-content"><p>Не удалось построить индекс. Попробуйте позже.</p></div>`;
        return;
    }
    
    // Разбиваем запрос на слова и применяем стемминг
    const queryWords = tokenize(query);
    const queryStems = queryWords.map(w => simpleStem(w));
    
    // Для каждой статьи считаем релевантность (количество совпадений)
    const resultsWithScore = [];
    for (const item of searchIndex) {
        let score = 0;
        const matchedWords = [];
        for (let qs of queryStems) {
            for (let term of item.words) {
                if (term.includes(qs) || qs.includes(term)) {
                    score++;
                    matchedWords.push(qs);
                    break;
                }
            }
        }
        if (score > 0) {
            resultsWithScore.push({ ...item, score, matchedWords });
        }
    }
    
    // Сортируем по убыванию релевантности
    resultsWithScore.sort((a,b) => b.score - a.score);
    
    if (resultsWithScore.length === 0) {
        container.innerHTML = `<div class="entry-header"><h1>Поиск: "${escapeHtml(query)}"</h1></div>
                               <div class="entry-content"><p>Ничего не найдено.</p></div>`;
        return;
    }
    
    // Формируем результаты, выделяя найденные слова
    let html = `<div class="entry-header"><h1>Результаты поиска: "${escapeHtml(query)}"</h1></div>
                <div class="list-grid">`;
    for (const res of resultsWithScore) {
        let snippet = res.snippet.substring(0, 200) + '...';
        // Выделяем найденные слова в сниппете
        snippet = highlightWords(snippet, res.matchedWords);
        html += `<div class="list-card" data-url="${res.url}">
                    <h3>${escapeHtml(res.title)}</h3>
                    <p>${snippet}</p>
                </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
    
    // Обработчики кликов по карточкам
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

// ---------- ОБНОВЛЁННАЯ НАСТРОЙКА ПОИСКА (debounce) ----------
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    let debounceTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        const query = e.target.value.trim();
        if (!query) return;
        debounceTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
}
