'use strict';
/* ============================================================
   HabitVerse web — смоук разделов основного проекта (2.1.0)
   Поднимает `next start` (свежий порт, свой child-процесс — грабля №50),
   грузит страницы в jsdom С гидратацией React и проверяет клиентское
   состояние: календарь, отчёты (canvas-заглушки), заметки, команду,
   DnD-сортировку, каталог, виджет заметок F-3, финансы F-2 и онбординг.
   Запуск: npm run test:web:smoke  (нужен собранный web: cd web && npm run build)
   ============================================================ */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const PORT = Number(process.env.SMOKE_PORT || 3555);
const BASE = `http://127.0.0.1:${PORT}`;

/* демо-данные из того же движка, что использует сайт */
const OUT = path.join(__dirname, 'webbuild');
if (!fs.existsSync(path.join(OUT, 'engine.js'))) {
  execSync(`node "${path.join(WEB, 'node_modules', 'typescript', 'bin', 'tsc')}" src/lib/engine.ts src/lib/md.ts src/lib/presets.ts --outDir "${OUT}" --module commonjs --target es2020 --strict --skipLibCheck`, { cwd: WEB, stdio: 'inherit' });
}
const E = require(path.join(OUT, 'engine.js'));
const SEED = JSON.stringify(E.seedDemo());

let ok = 0, failed = 0;
async function step(name, fn) {
  try { await fn(); ok++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' — ' + e.message); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assert'); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` ожидал ${b}, получил ${a}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeCanvasCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop in t) return t[prop];
      return () => {};
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

async function loadPage(urlPath, readyMarker, opts) {
  /* opts.storage: null — пустой localStorage (онбординг), строка — свои данные, по умолчанию SEED */
  const storage = opts && 'storage' in opts ? opts.storage : SEED;
  const vc = new VirtualConsole();
  const pageErrors = [];
  vc.on('jsdomError', (e) => {
    if (/Not implemented: navigation/.test(e.message)) return;   // клики по ссылкам — не баг приложения
    pageErrors.push(e.message);
  });
  vc.on('error', (...a) => pageErrors.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromURL(BASE + urlPath, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      if (storage !== null) window.localStorage.setItem('habitverse.v1', storage);
      // Next.js client-рантайму нужны Web Streams и TextEncoder — в jsdom их нет
      const webStreams = require('stream/web');
      const util = require('util');
      window.ReadableStream = window.ReadableStream || webStreams.ReadableStream;
      window.TransformStream = window.TransformStream || webStreams.TransformStream;
      window.WritableStream = window.WritableStream || webStreams.WritableStream;
      window.TextEncoder = window.TextEncoder || util.TextEncoder;
      window.TextDecoder = window.TextDecoder || util.TextDecoder;
      window.BroadcastChannel = window.BroadcastChannel || require('worker_threads').BroadcastChannel;
      window.HTMLCanvasElement.prototype.getContext = () => fakeCanvasCtx();
      window.Element.prototype.scrollIntoView = function () {};
      window.fetch = (u, o) => fetch(new URL(u, BASE + urlPath), o);
      if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    },
  });
  const { window } = dom;
  /* ждём гидратацию и ready: маркер данных появляется вместо скелетона */
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if (window.document.querySelector(readyMarker)) break;
    await wait(200);
  }
  assert(window.document.querySelector(readyMarker), `гидратация не завершилась: нет ${readyMarker} на ${urlPath}`);
  return { dom, window, document: window.document, pageErrors };
}

function setNativeValue(win, el, value) {
  const proto = el instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
}
function mkPointer(win, type, y) {
  const ev = new win.Event(type, { bubbles: true, cancelable: true });
  ev.clientY = y; ev.clientX = 300; ev.pointerId = 1;
  return ev;
}
const click = (win, el) => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

async function main() {
  console.log(`Старт next start на свежем порту ${PORT}…`);
  // detached: true — чтобы в конце убить всю группу (next start плодит дочерний next-server,
  // обычный server.kill() оставляет сироту, которая держит порт и ест RAM — грабля №56)
  const server = spawn(path.join(WEB, 'node_modules', '.bin', 'next'), ['start', '-p', String(PORT)], {
    cwd: WEB, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
  });
  const killServer = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill(); } catch {} } };
  process.on('exit', killServer);
  let started = false;
  server.stdout.on('data', (d) => { if (/Ready/.test(String(d))) started = true; });
  server.stderr.on('data', () => {});
  for (let i = 0; i < 60 && !started; i++) await wait(500);
  if (!started) { console.error('next start не поднялся за 30 c'); server.kill(); process.exit(1); }

  try {
    /* ---------- КАЛЕНДАРЬ ---------- */
    console.log('\n=== /calendar (гидратация + интерактив) ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/calendar', '.cal-cell');
      await step('месячная сетка: ≥28 ячеек, заголовок месяца, pill «% за месяц»', () => {
        assert(doc.querySelectorAll('.cal-cell').length >= 28, 'ячеек: ' + doc.querySelectorAll('.cal-cell').length);
        assert(doc.querySelector('.cal-title').textContent.length > 3, 'нет названия месяца');
        assert(/% за месяц/.test(doc.body.textContent), 'нет pill «% за месяц»');
      });
      await step('heatmap года: 52–54 колонки', () => {
        const cols = doc.querySelectorAll('.hm-col').length;
        assert(cols >= 52 && cols <= 54, 'колонок: ' + cols);
      });
      await step('панель дня: ≥10 строк привычек с чек-кнопками', () => {
        assert(doc.querySelectorAll('.cal-day-panel .check').length >= 10, 'чеков: ' + doc.querySelectorAll('.cal-day-panel .check').length);
      });
      await step('клик по чек-кнопке меняет статус и сохраняет в localStorage', async () => {
        const checks = [...doc.querySelectorAll('.cal-day-panel .check')];
        const empty = checks.find((b) => !/\b(on|skip|miss|held)\b/.test(b.className));
        const target = empty || checks.find((b) => b.className.includes('on'));
        const expectCls = empty ? 'on' : 'skip';
        click(win, target);
        await wait(400);   // дебаунс persist 120 мс
        assert(target.className.includes(expectCls), `класс ${expectCls} не появился: ${target.className}`);
        assert(/"status"/.test(win.localStorage.getItem('habitverse.v1')), 'логи не сохранены');
      });
      await step('переключение на прошлый месяц работает', async () => {
        const title0 = doc.querySelector('.cal-title').textContent;
        click(win, doc.querySelector('[aria-label="Предыдущий месяц"]'));
        await wait(200);
        assert(doc.querySelector('.cal-title').textContent !== title0, 'месяц не переключился');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- ОТЧЁТЫ ---------- */
    console.log('\n=== /reports ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/reports', '.kpi');
      await step('5 KPI + 5 чипсов диапазонов', () => {
        assert(doc.querySelectorAll('.kpi').length >= 5, 'kpi: ' + doc.querySelectorAll('.kpi').length);
        assert(doc.querySelectorAll('.chip').length >= 5, 'чипсов: ' + doc.querySelectorAll('.chip').length);
      });
      await step('4 canvas-чарта на месте', () => {
        assert(doc.querySelectorAll('canvas').length >= 4, 'canvas: ' + doc.querySelectorAll('canvas').length);
      });
      await step('рейтинг привычек и стрики: ≥10 bar-row', () => {
        assert(doc.querySelectorAll('.bar-row').length >= 10, 'bar-row: ' + doc.querySelectorAll('.bar-row').length);
      });
      await step('инсайты отрисованы (≥2)', () => {
        assert(doc.querySelectorAll('.ins-ic').length >= 2, 'инсайтов: ' + doc.querySelectorAll('.ins-ic').length);
      });
      await step('переключение диапазона «7 дн» не падает', async () => {
        const chip7 = [...doc.querySelectorAll('.chip')].find((c) => /7 дн/.test(c.textContent));
        click(win, chip7);
        await wait(400);
        assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
        assert(doc.querySelectorAll('.kpi').length >= 5, 'KPI пропали после переключения');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- ЗАМЕТКИ ---------- */
    console.log('\n=== /notes ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/notes', '.note-card');
      await step('4 демо-заметки, md2-разметка внутри', () => {
        eq(doc.querySelectorAll('.note-card').length, 4, 'карточек');
        const md = doc.querySelector('.note-card .md');
        assert(md.querySelector('ul, strong, h4, h5, p'), 'нет md-элементов');
      });
      await step('клик по карточке открывает редактор (textarea в модалке)', async () => {
        click(win, doc.querySelector('.note-card'));
        await wait(250);
        assert(doc.querySelector('.modal-root textarea'), 'модалка не открылась');
        win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(200);
      });
      await step('pin поднимает заметку наверх', async () => {
        const card = [...doc.querySelectorAll('.note-card')].find((c) => !c.className.includes('pinned'));
        const title = card.querySelector('h4').textContent;
        click(win, card.querySelector('[aria-label="Закрепить"]'));
        await wait(300);
        eq(doc.querySelector('.note-card h4').textContent, title, 'закреплённая не стала первой');
        eq(doc.querySelectorAll('.note-card.pinned').length, 2, 'закреплённых');
      });
      await step('поиск «сахар» фильтрует список', async () => {
        const input = doc.querySelector('.toolbar-search input');
        setNativeValue(win, input, 'сахар');
        input.dispatchEvent(new win.Event('input', { bubbles: true }));
        await wait(250);
        const n = doc.querySelectorAll('.note-card').length;
        assert(n >= 1 && n < 4, 'фильтр не сработал: ' + n);
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- КОМАНДА ---------- */
    console.log('\n=== /team ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/team', '.chal-card');
      await step('2 карточки челленджей, лидерборд (я + 4), экипаж 4', () => {
        eq(doc.querySelectorAll('.chal-card').length, 2, 'челленджей');
        assert(doc.querySelectorAll('.lb-row').length >= 5, 'lb-row: ' + doc.querySelectorAll('.lb-row').length);
        assert(doc.querySelector('.lb-row.me'), 'нет строки «вы»');
        eq(doc.querySelectorAll('.crew-row').length, 4, 'экипаж');
        assert(doc.querySelector('.crew-row .avatar'), 'нет аватара');
      });
      await step('лента ≥3 элементов, у каждого 5 кнопок реакций', () => {
        const items = doc.querySelectorAll('.feed-item');
        assert(items.length >= 3, 'элементов ленты: ' + items.length);
        eq(items[0].querySelectorAll('.react').length, 5, 'реакций на элемент');
      });
      await step('клик по реакции ставит её (класс on)', async () => {
        click(win, doc.querySelector('.feed-item .react'));
        await wait(300);
        assert(doc.querySelectorAll('.feed-item .react.on').length >= 1, 'реакция не встала');
      });
      await step('«Обновить» добавляет событие ленты (в state, не только в DOM)', async () => {
        const before = JSON.parse(win.localStorage.getItem('habitverse.v1')).feed.length;
        const btn = [...doc.querySelectorAll('button')].find((b) => /Обновить/.test(b.textContent));
        click(win, btn);
        await wait(400);
        const after = JSON.parse(win.localStorage.getItem('habitverse.v1')).feed.length;
        eq(after, Math.min(before + 1, E.FEED_CAP), 'лента не выросла');
      });
      await step('создание челленджа через модалку', async () => {
        const btn = [...doc.querySelectorAll('.sec-h button')].find((b) => b.textContent.trim() === 'Челлендж');
        click(win, btn);
        await wait(250);
        const nameInput = doc.querySelector('.modal-root input');
        assert(nameInput, 'модалка челленджа не открылась');
        setNativeValue(win, nameInput, 'Тестовый челлендж');
        nameInput.dispatchEvent(new win.Event('input', { bubbles: true }));
        const save = [...doc.querySelectorAll('.modal-f .btn')].find((b) => /Создать/.test(b.textContent));
        click(win, save);
        await wait(350);
        assert([...doc.querySelectorAll('.chal-card h3')].some((h) => /Тестовый челлендж/.test(h.textContent)), 'челлендж не создан');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- ПРИВЫЧКИ: DnD ---------- */
    console.log('\n=== /habits (DnD-сортировка) ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/habits', '.hv-row');
      await step('13 демо-привычек, у каждой drag-ручка', () => {
        eq(doc.querySelectorAll('.hv-row').length, 13, 'строк');
        eq(doc.querySelectorAll('.hv-row .drag-handle').length, 13, 'ручек');
      });
      await step('перетаскивание первой строки на вторую меняет и сохраняет порядок', async () => {
        const rows = [...doc.querySelectorAll('.hv-row')];
        const first = rows[0].querySelector('.hv-name .nm').textContent;
        const second = rows[1].querySelector('.hv-name .nm').textContent;
        const handle = rows[0].querySelector('.drag-handle');
        rows[0].getBoundingClientRect = () => ({ top: 100, bottom: 160, height: 60 });
        rows[1].getBoundingClientRect = () => ({ top: 160, bottom: 220, height: 60 });
        handle.setPointerCapture = () => {};
        handle.dispatchEvent(mkPointer(win, 'pointerdown', 130));
        handle.dispatchEvent(mkPointer(win, 'pointermove', 190));
        await wait(120);
        handle.dispatchEvent(mkPointer(win, 'pointerup', 190));
        await wait(400);
        const names = [...doc.querySelectorAll('.hv-row .hv-name .nm')].map((n) => n.textContent);
        eq(names[0], second, 'первая строка'); eq(names[1], first, 'вторая строка');
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        const order = new Map(saved.habits.map((h) => [h.name, h.order]));
        assert(order.get(second) < order.get(first), 'порядок не сохранён в localStorage');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- КАТАЛОГ ---------- */
    console.log('\n=== каталог пресетов ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/habits', '.hv-row');
      await step('кнопка «Каталог» открывает модалку: 7 групп, 30 пресетов', async () => {
        const btn = [...doc.querySelectorAll('.page-actions .btn')].find((b) => /Каталог/.test(b.textContent));
        assert(btn, 'нет кнопки «Каталог»');
        click(win, btn);
        await wait(300);
        eq(doc.querySelectorAll('.modal-root .preset').length, 30, 'пресетов');
        eq(doc.querySelectorAll('.modal-root .cat-group').length, 7, 'групп');
      });
      await step('поиск «кровать» оставляет 1 пресет', async () => {
        const input = doc.querySelector('.modal-root .input-ic input');
        setNativeValue(win, input, 'кровать');
        input.dispatchEvent(new win.Event('input', { bubbles: true }));
        await wait(250);
        eq(doc.querySelectorAll('.modal-root .preset').length, 1, 'пресетов после фильтра');
      });
      await step('клик по пресету добавляет привычку в state', async () => {
        click(win, doc.querySelector('.modal-root .preset:not(.has)'));
        await wait(400);
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        assert(saved.habits.some((h) => h.name === 'Заправить кровать'), 'привычка не добавилась');
      });
      await step('дубль защищён: пресет стал .has', () => {
        assert(doc.querySelector('.modal-root .preset.has'), 'нет класса has у добавленного');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- НАСТРОЙКИ: ИМПОРТ JSON-БЭКАПА ---------- */
    console.log('\n=== настройки: импорт JSON ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/settings', '#setName');
      /* #setName есть уже в SSR-разметке — ждём настоящего клиентского маркера:
         счётчик «… КБ в localStorage» появляется только после гидратации и ready (грабля №55). */
      const t1 = Date.now();
      while (Date.now() - t1 < 15000 && !/КБ в localStorage/.test(doc.body.textContent || '')) await wait(200);
      await step('страница гидратирована (счётчик КБ вместо «…»)', () => {
        assert(/КБ в localStorage/.test(doc.body.textContent || ''), 'нет клиентского маркера гидратации');
      });
      const giveFile = async (name, text) => {
        const input = doc.querySelector('input[type=file]');
        assert(input, 'нет скрытого file-инпута');
        const f = new win.File([text], name, { type: 'application/json' });
        Object.defineProperty(input, 'files', { value: [f], configurable: true });
        input.dispatchEvent(new win.Event('change', { bubbles: true }));
        await wait(300);
        const confirmBtn = [...doc.querySelectorAll('.btn')].find((b) => /Точно импортировать/.test(b.textContent));
        assert(confirmBtn, 'нет подтверждения импорта');
        click(win, confirmBtn);
        await wait(400);
      };
      await step('валидный бэкап заменяет данные (после подтверждения)', async () => {
        const seedObj = JSON.parse(SEED);
        seedObj.habits = [{ ...seedObj.habits[0], name: 'Импорт-тест' }];
        await giveFile('backup.json', JSON.stringify(seedObj));
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        eq(saved.habits.length, 1, 'привычек после импорта');
        eq(saved.habits[0].name, 'Импорт-тест', 'имя привычки');
        const toasts = [...doc.querySelectorAll('.toast')].map((t) => t.textContent).join(' ');
        assert(/Импорт выполнен: 1 привычек/.test(toasts), 'нет тоста об успехе: ' + toasts);
      });
      await step('битый файл — предупреждение, данные целы', async () => {
        await giveFile('broken.json', 'это не json');
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        eq(saved.habits[0].name, 'Импорт-тест', 'данные не должны измениться');
        const toasts = [...doc.querySelectorAll('.toast')].map((t) => t.textContent).join(' ');
        assert(/Импорт не удался/.test(toasts), 'нет тоста-предупреждения: ' + toasts);
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- F-3: ВИДЖЕТ ЗАМЕТОК ---------- */
    console.log('\n=== F-3: плавающий виджет заметок ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/', '.weekstrip-cell');
      await step('виджет на Обзоре: кнопка + счётчик 4', () => {
        const w = doc.querySelector('.notes-widget');
        assert(w && w.querySelector('.nw-btn'), 'нет виджета');
        eq(w.querySelector('.nw-ct').textContent, '4', 'счётчик');
      });
      await step('hover открывает панель: 4 заметки, закреплённая первой', async () => {
        const w = doc.querySelector('.notes-widget');
        w.dispatchEvent(new win.MouseEvent('mouseover', { bubbles: true }));
        await wait(400);
        assert(w.className.includes('open'), 'панель не открылась по hover');
        const items = doc.querySelectorAll('.nw-item');
        eq(items.length, 4, 'заметок в панели');
        assert(/Что сработало за неделю/.test(items[0].textContent), 'первая — не закреплённая');
      });
      await step('уход курсора закрывает панель', async () => {
        const w = doc.querySelector('.notes-widget');
        w.dispatchEvent(new win.MouseEvent('mouseout', { bubbles: true }));
        await wait(550);
        assert(!w.className.includes('open'), 'панель не закрылась');
      });
      await step('тап по кнопке фиксирует панель (тач-режим)', async () => {
        click(win, doc.querySelector('.nw-btn'));
        await wait(200);
        assert(doc.querySelector('.notes-widget').className.includes('open'), 'тап не открыл панель');
      });
      await step('виджет есть и на /settings', async () => {
        const p2 = await loadPage('/settings', '.notes-widget .nw-btn');
        assert(p2.document.querySelector('.notes-widget .nw-btn'), 'нет виджета на /settings');
        p2.window.close();
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- ФИНАНСЫ (F-2) ---------- */
    console.log('\n=== /finance (F-2: реестр, итоги, пьедестал) ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/finance', '.fin-kpis');
      const seedState = JSON.parse(SEED);
      const mSum = E.finSummary(seedState, E.finPeriod('month'));
      const dSum = E.finSummary(seedState, E.finPeriod('day'));
      const setIn = (sel, v) => {
        const el = doc.querySelector(sel);
        assert(el, 'нет поля ' + sel);
        setNativeValue(win, el, v);
        el.dispatchEvent(new win.Event('input', { bubbles: true }));
      };

      await step('4 KPI: итог месяца совпадает с движком, чип «Месяц» активен', () => {
        const metrics = doc.querySelectorAll('.fin-kpis .metric');
        eq(metrics.length, 4, 'метрики');
        eq(metrics[0].querySelector('.val').textContent.trim(), E.fmtMoney(mSum.total), 'итоговая сумма');
        const label = doc.querySelector('.fin-period-label').textContent;
        assert(/месяц/i.test(label), 'подпись периода: ' + label);
        const onChip = [...doc.querySelectorAll('.fin-period-chips .chip')].find((c) => c.className.includes('on'));
        eq(onChip.textContent.trim(), 'Месяц', 'чип периода по умолчанию');
      });
      await step('пьедестал: порядок 2-1-3, медали, цитата и сумма первого места', () => {
        const pods = [...doc.querySelectorAll('.fin-podium .pedestal')];
        eq(pods.length, 3, 'пьедесталов');
        assert(pods[0].className.includes('p2') && pods[1].className.includes('p1') && pods[2].className.includes('p3'), 'порядок не 2-1-3');
        const p1 = pods[1];
        eq(p1.querySelector('.medal').textContent.trim(), '1');
        eq(pods[0].querySelector('.medal').textContent.trim(), '2');
        eq(pods[2].querySelector('.medal').textContent.trim(), '3');
        const quote = p1.querySelector('.quote').textContent;
        eq(quote, `«${mSum.podium[0].name}»`, 'цитата первого места');
        eq(p1.querySelector('.amt').textContent.trim(), E.fmtMoney(mSum.podium[0].amount), 'сумма первого места');
      });
      await step('типы и названия: агрегаты движка в DOM', () => {
        const typeRows = doc.querySelectorAll('.fin-type-row');
        eq(typeRows.length, mSum.byType.length, 'строк типов');
        assert(typeRows[0].textContent.includes(E.capFirst(mSum.byType[0].type)), 'первый тип не топовый');
        const nameRows = doc.querySelectorAll('.fin-name-row');
        assert(nameRows.length >= 1 && nameRows.length <= 8, 'строк названий: ' + nameRows.length);
        assert(nameRows[0].textContent.includes(`«${mSum.topNames[0].name}»`), 'первое название: ' + nameRows[0].textContent);
        assert(nameRows[0].textContent.includes(E.fmtMoney(mSum.topNames[0].total)), 'сумма топ-названия');
      });
      await step('реестр: 16 строк, сортировка по дате desc, 5 колонок', () => {
        const rows = [...doc.querySelectorAll('.fin-row')];
        eq(rows.length, 16, 'строк реестра');
        const dates = rows.map((r) => r.getAttribute('data-date'));
        for (let i = 1; i < dates.length; i++) assert(dates[i - 1] >= dates[i], `сортировка: ${dates[i - 1]} < ${dates[i]}`);
        const ths = doc.querySelectorAll('.fin-table thead th');
        eq(ths.length, 5, 'колонок');
        assert(/Сумма/.test(ths[3].textContent), 'заголовок суммы');
      });
      await step('переключатель «День»: итог пересчитывается движком', async () => {
        click(win, [...doc.querySelectorAll('.fin-period-chips .chip')].find((c) => c.textContent.trim() === 'День'));
        await wait(300);
        eq(doc.querySelector('.fin-kpis .metric .val').textContent.trim(), E.fmtMoney(dSum.total), 'дневной итог');
        assert(dSum.total <= mSum.total, 'дневный итог больше месячного');
        click(win, [...doc.querySelectorAll('.fin-period-chips .chip')].find((c) => c.textContent.trim() === 'Месяц'));
        await wait(300);
      });
      await step('быстрое добавление: форма → строка → localStorage', async () => {
        setIn('.fin-f-type', 'еда');
        setIn('.fin-f-name', 'тестовая трата');
        setIn('.fin-f-amt', '123.4');
        click(win, [...doc.querySelectorAll('.fin-add .btn')].find((b) => /Добавить/.test(b.textContent)));
        await wait(450);   // дебаунс persist 120 мс
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        eq(saved.expenses.length, 17, 'запись не сохранилась');
        const e = saved.expenses.find((x) => x.name === 'тестовая трата');
        assert(e, 'нет записи в state');
        eq(e.type, 'еда'); eq(e.amount, 123.4);
        eq(doc.querySelectorAll('.fin-row').length, 17, 'строка не появилась в реестре');
        eq(doc.querySelector('.fin-f-name').value, '', 'форма не очистилась');
      });
      await step('валидация: пустая сумма — тост-предупреждение, записи нет', async () => {
        setIn('.fin-f-name', 'без суммы');
        setIn('.fin-f-amt', '');
        click(win, [...doc.querySelectorAll('.fin-add .btn')].find((b) => /Добавить/.test(b.textContent)));
        await wait(350);
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        eq(saved.expenses.length, 17, 'валидация пропустила запись');
        const toasts = [...doc.querySelectorAll('.toast')].map((t) => t.textContent).join(' ');
        assert(/Сумма должна быть больше нуля/.test(toasts), 'нет тоста-предупреждения: ' + toasts);
      });
      await step('редактирование через модалку: сумма → 77 ₽', async () => {
        click(win, doc.querySelector('.fin-row .fin-act[aria-label="Редактировать"]'));
        await wait(250);
        const modal = doc.querySelector('.modal-root');
        assert(modal, 'модалка не открылась');
        const amt = modal.querySelector('#emAmount');
        assert(amt, 'нет поля суммы в модалке');
        setNativeValue(win, amt, '77');
        amt.dispatchEvent(new win.Event('input', { bubbles: true }));
        click(win, [...modal.querySelectorAll('.modal-f .btn')].find((b) => /Сохранить/.test(b.textContent)));
        await wait(400);
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        assert(saved.expenses.some((x) => x.amount === 77), 'сумма не обновилась');
        assert(!doc.querySelector('.modal-root'), 'модалка не закрылась');
      });
      await step('удаление через подтверждение', async () => {
        const before = JSON.parse(win.localStorage.getItem('habitverse.v1')).expenses.length;
        click(win, doc.querySelector('.fin-row .fin-act[aria-label="Удалить"]'));
        await wait(250);
        const del = [...doc.querySelectorAll('.modal-f .btn-danger')].find((b) => /Удалить/.test(b.textContent));
        assert(del, 'нет подтверждения удаления');
        click(win, del);
        await wait(400);
        const after = JSON.parse(win.localStorage.getItem('habitverse.v1')).expenses.length;
        eq(after, before - 1, 'запись не удалена');
        eq(doc.querySelectorAll('.fin-row').length, before - 1, 'строка осталась в реестре');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- БЫСТРЫЙ ДОСТУП К ФИНАНСАМ ИЗ ПРИВЫЧЕК (F-2, «оба» размещения) ---------- */
    console.log('\n=== /habits: быстрый доступ к реестру ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/habits', '.hv-row');
      await step('кнопка «Реестр трат» в шапке (есть money-привычка)', () => {
        assert([...doc.querySelectorAll('.page-actions .btn')].some((b) => /Реестр трат/.test(b.textContent)), 'нет кнопки в PageHead');
      });
      await step('чип «Реестр трат» в строке привычки категории «Финансы»', () => {
        const money = JSON.parse(SEED).habits.find((h) => h.cat === 'money');
        assert(money, 'в демо-данных нет money-привычки');
        const row = doc.querySelector(`[data-id="${money.id}"]`);
        assert(row, 'строка money-привычки не найдена');
        const tag = row.querySelector('.fin-tag');
        assert(tag && /Реестр трат/.test(tag.textContent), 'нет чипа быстрого доступа');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }

    /* ---------- ОНБОРДИНГ ---------- */
    console.log('\n=== онбординг: мастер первого визита ===');
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/', '.onb-card', { storage: null });
      const clickBtn = (re) => {
        const b = [...doc.querySelectorAll('.onb-card .btn')].find((x) => re.test(x.textContent));
        assert(b, 'нет кнопки ' + re);
        click(win, b);
      };
      await step('шаг 1: приветствие, 4 точки, «Начать»', () => {
        assert(/HabitVerse/.test(doc.querySelector('.onb-card h2').textContent), 'заголовок');
        eq(doc.querySelectorAll('.onb-dots i').length, 4, 'точек');
        assert(doc.querySelector('.onb-dots i').className.includes('on'), 'первая точка не активна');
        assert([...doc.querySelectorAll('.onb-card .btn')].some((b) => /Начать/.test(b.textContent)), 'нет «Начать»');
      });
      await step('шаг 2: ввод имени', async () => {
        clickBtn(/Начать/);
        await wait(250);
        const input = doc.querySelector('#onbName');
        assert(input, 'нет поля имени');
        setNativeValue(win, input, 'Тест');
        input.dispatchEvent(new win.Event('input', { bubbles: true }));
      });
      await step('шаг 3: аватар-эмодзи — 18 вариантов, выбор отмечается', async () => {
        clickBtn(/Дальше/);
        await wait(250);
        const ems = [...doc.querySelectorAll('.onb-emoji button')];
        eq(ems.length, 18, 'эмодзи');
        click(win, ems.find((b) => b.textContent === '🐼'));
        await wait(150);
        assert([...doc.querySelectorAll('.onb-emoji button')].find((b) => b.textContent === '🐼').className.includes('on'), 'выбор не отмечен');
      });
      await step('шаг 4: «С чистого листа» → профиль, каталог, тост', async () => {
        clickBtn(/Дальше/);
        await wait(250);
        clickBtn(/С чистого листа/);
        await wait(900);   // тост + каталог через 450 мс
        assert(!doc.querySelector('.onboarding'), 'оверлей не исчез');
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        eq(saved.profile.onboarded, true, 'onboarded');
        eq(saved.profile.name, 'Тест', 'имя');
        eq(saved.profile.emoji, '🐼', 'аватар');
        eq(saved.habits.length, 0, 'привычки не пустые');
        assert(doc.querySelector('.modal-root'), 'каталог не открылся после чистого старта');
        assert(/Привет, Тест/.test([...doc.querySelectorAll('.toast')].map((t) => t.textContent).join(' ')), 'нет приветственного тоста');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }
    {
      const { document: doc, window: win, pageErrors } = await loadPage('/', '.onb-card', { storage: null });
      await step('ветка демо-данных: 13 привычек + 16 расходов, имя «Демо Пилот»', async () => {
        const clickBtn = (re) => {
          const b = [...doc.querySelectorAll('.onb-card .btn')].find((x) => re.test(x.textContent));
          assert(b, 'нет кнопки ' + re);
          click(win, b);
        };
        clickBtn(/Начать/); await wait(250);
        clickBtn(/Дальше/); await wait(250);   // имя пустое → останется демо-имя
        clickBtn(/Дальше/); await wait(250);   // аватар по умолчанию 🦊
        clickBtn(/Загрузить демо-данные/);
        await wait(600);
        assert(!doc.querySelector('.onboarding'), 'оверлей не исчез');
        const saved = JSON.parse(win.localStorage.getItem('habitverse.v1'));
        eq(saved.profile.onboarded, true, 'onboarded');
        eq(saved.profile.name, 'Демо Пилот', 'имя из сида');
        eq(saved.habits.length, 13, 'привычек');
        eq(saved.expenses.length, 16, 'расходов');
      });
      await step('нет ошибок выполнения', () => assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ')));
      win.close();
    }
    {
      const { document: doc, window: win } = await loadPage('/', '.weekstrip-cell');
      await step('после онбординга (сид) мастер не показывается', () => {
        assert(!doc.querySelector('.onboarding'), 'оверлей онбординга поверх сид-данных');
      });
      win.close();
    }
  } catch (e) {
    console.error('Внешняя ошибка смоука:', e);
    failed++;
  }

  killServer();
  console.log(`\n${'='.repeat(46)}`);
  console.log(`web.smoke (2.1.0): ${ok} ok, ${failed} FAIL`);
  console.log('='.repeat(46));
  process.exit(failed ? 1 : 0);
}

main();
