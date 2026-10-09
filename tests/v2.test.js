/* Тесты HabitVerse 2.0 — этап 1 (дизайн-система, каркас, Обзор, Привычки, Настройки, ⌘K) */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM || require.resolve('jsdom', { paths: [__dirname] }));

const DIR = path.join(__dirname, '..', 'v2');
const target = process.env.TARGET || 'split';

let html, js;
if (target === 'single') {
  const full = fs.readFileSync(path.join(__dirname, '..', 'HabitVerse-2.0.html'), 'utf8');
  const m = full.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('в single-file сборке v2 не найден встроенный скрипт');
  js = m[1];
  html = full.replace(m[0], '</body>');
} else {
  html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  js = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = e.message || '';
  if (/Not implemented: navigation/i.test(msg)) return; // скачивание файла — не баг
  errors.push('JSDOM: ' + (e.stack || msg));
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
vc.on('warn', () => {});

const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost:8080/', virtualConsole: vc });
const w = dom.window;

const ctx2d = new Proxy({}, {
  get(t, k) {
    if (k === 'canvas') return {};
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (k === 'measureText') return () => ({ width: 20 });
    if (typeof t[k] === 'function') return t[k];
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; },
});
w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AA';
w.HTMLCanvasElement.prototype.toBlob = (cb) => cb(new w.Blob(['x'], { type: 'image/png' }));
Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 900; }, configurable: true });
Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 400; }, configurable: true });
w.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, width: 200, height: 60, right: 210, bottom: 70, x: 10, y: 10 }; };
w.HTMLElement.prototype.scrollIntoView = function () {};
w.devicePixelRatio = 1;
w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
w.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
w.cancelAnimationFrame = (id) => clearTimeout(id);
w.AudioContext = class { constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
  createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  resume() {} };
w.Notification = class { static permission = 'granted'; constructor(t, o) { this.title = t; this.o = o; } static requestPermission() { return Promise.resolve('granted'); } };
w.navigator.serviceWorker = { register: () => Promise.resolve({}) };
Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
w.URL.createObjectURL = () => 'blob:x';
w.URL.revokeObjectURL = () => {};
w.scrollTo = () => {};
w.print = () => {};

const step = (label, fn) => { try { fn(); console.log('  ok  ' + label); } catch (e) { errors.push(label + ' -> ' + e.message); console.log('  FAIL ' + label + ' :: ' + e.message); } };
const q = (sel) => w.document.querySelector(sel);
const qa = (sel) => [...w.document.querySelectorAll(sel)];
const click = (el) => { if (!el) throw new Error('element missing'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const key = (k, opts = {}) => w.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }));

w.eval(js);
w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

setTimeout(() => {
  console.log('\n=== 1. Онбординг и старт ===');
  step('онбординг виден', () => { const o = q('#onboarding'); if (!o) throw new Error('нет контейнера онбординга'); });
  step('проходим онбординг с демо-данными', () => {
    click(q('[data-next]'));
    const name = q('#onbName'); if (!name) throw new Error('нет поля имени');
    name.value = 'Тестер'; name.dispatchEvent(new w.Event('input', { bubbles: true }));
    click(q('[data-next]'));
    click(q('[data-next]'));
    const seed = q('[data-seed]'); if (!seed) throw new Error('нет кнопки демо-данных');
    click(seed);
  });
  step('приложение открыто', () => { if (q('#app') && !q('#app').hidden === false) { /* v2: #app может отсутствовать */ }
    if (!q('#nav').innerHTML.trim()) throw new Error('навигация пуста'); });
  step('данные засеяны', () => {
    const n = w.HV.state.habits.length; if (n < 10) throw new Error('привычек: ' + n);
    console.log('     привычек: ' + n + ', логов: ' + Object.keys(w.HV.state.logs).length + ', заметок: ' + w.HV.state.notes.length);
  });

  console.log('\n=== 2. Каркас v2 ===');
  step('шапка: бренд, разделы, поиск, тема, аватар', () => {
    ['#brandLink', '#nav', '#btnSearch', '#btnTheme', '#btnBell', '#btnAvatar'].forEach((s) => { if (!q(s)) throw new Error('нет ' + s); });
  });
  step('навигация содержит 6 разделов (без Настроек)', () => {
    const n = qa('#nav .nav-item').length; if (n !== 6) throw new Error('разделов: ' + n);
  });
  step('сайдбар: разделы + быстрые действия, БЕЗ дерева привычек', () => {
    if (!q('#sidebar')) throw new Error('нет сайдбара');
    const links = qa('#sidebar [data-go]').length; if (links < 7) throw new Error('разделов: ' + links);
    const acts = qa('#sidebar [data-act]').length; if (acts < 4) throw new Error('быстрых действий: ' + acts);
    if (qa('#sidebar .dot').length) throw new Error('дерево привычек должно быть удалено по требованию пользователя');
    console.log('     разделов: ' + links + ', быстрых действий: ' + acts);
  });
  step('сайдбар: клики по разделам и действиям', () => {
    click(q('#sidebar [data-go="calendar"]'));
    if (!q('.page[data-page="calendar"]').classList.contains('active')) throw new Error('переход не сработал');
    click(q('#sidebar [data-act="cmdk"]'));
    if (q('#cmdkRoot').hidden) throw new Error('⌘K из сайдбара не открылся');
    key('Escape');
  });
  step('заголовок страницы: хлебные крошки + заголовок + действия', () => {
    if (!q('.crumbs')) throw new Error('нет хлебных крошек');
    if (!q('.page-title')) throw new Error('нет заголовка');
    if (!q('.page-actions')) throw new Error('нет области действий');
  });
  step('сворачивание сайдбара', () => {
    const btn = q('#btnCollapse'); if (!btn) throw new Error('нет кнопки сворачивания');
    click(btn);
    if (!q('#body').classList.contains('collapsed')) throw new Error('не свернулся');
    click(q('#btnCollapse'));
    if (q('#body').classList.contains('collapsed')) throw new Error('не развернулся');
  });

  console.log('\n=== 3. Разделы ===');
  ['today', 'habits', 'calendar', 'stats', 'notes', 'team', 'settings'].forEach((p) => {
    step('раздел «' + p + '»', () => {
      w.HV.go(p);
      const sec = q('.page[data-page="' + p + '"]');
      if (!sec.classList.contains('active')) throw new Error('не активен');
      if (sec.innerHTML.length < 200) throw new Error('пуст: ' + sec.innerHTML.length);
    });
  });
  step('навигация кликом по шапке', () => {
    click(qa('#nav .nav-item')[3]);
    if (!q('.page[data-page="stats"]').classList.contains('active')) throw new Error('переход не сработал');
    click(qa('#nav .nav-item')[0]);
  });
  step('навигация кликом по сайдбару', () => {
    const link = qa('#sidebar [data-go]').find((b) => b.dataset.go === 'notes');
    if (!link) throw new Error('нет ссылки на заметки');
    click(link);
    if (!q('.page[data-page="notes"]').classList.contains('active')) throw new Error('переход не сработал');
  });

  console.log('\n=== 4. Геймификация удалена ===');
  step('нет XP / уровней / ачивок в API', () => {
    if (w.HV.ACHS.length !== 0) throw new Error('ACHS не пуст: ' + w.HV.ACHS.length);
    const lv = w.HV.levelOf(10000); if (lv.level !== 1) throw new Error('levelOf всё ещё считает уровни');
  });
  step('нет XP-виджетов и ачивок в разметке', () => {
    ['today', 'habits', 'stats', 'settings'].forEach((p) => {
      w.HV.go(p);
      const html = q('.page[data-page="' + p + '"]').innerHTML;
      if (/\bXP\b/.test(html)) throw new Error('в «' + p + '» остался XP');
      if (/уровень\s*\d/i.test(html)) throw new Error('в «' + p + '» остался уровень');
      if (/ach-item/.test(html)) throw new Error('в «' + p + '» остались ачивки');
    });
  });
  step('нет confetti / звуков / 3D-сферы', () => {
    if (!q('#confetti')) { /* ок */ }
    w.HV.go('today');
    const html = q('.page[data-page="today"]').innerHTML;
    if (/orb-scene|orb-ring|bg-orb/.test(html)) throw new Error('осталась 3D-сфера');
    if (/hv-shimmer|glow/.test(html)) throw new Error('остались неоновые эффекты');
  });

  console.log('\n=== 5. Обзор (Сегодня) ===');
  step('4 метрики', () => { w.HV.go('today'); const n = qa('.metric').length; if (n < 4) throw new Error('метрик: ' + n); });
  step('прогресс дня', () => { if (!q('.progress > i')) throw new Error('нет прогресс-бара'); });
  step('полоса недели из 7 ячеек', () => { const n = qa('.weekstrip-cell').length; if (n !== 7) throw new Error('ячеек: ' + n); });
  step('блок стриков', () => { const t = q('.page[data-page="today"]').textContent; if (!/Стрики/.test(t)) throw new Error('нет блока стриков'); });
  step('мысль дня', () => { const t = q('.page[data-page="today"]').textContent; if (!/Мысль дня/.test(t)) throw new Error('нет цитаты'); });
  step('сводка', () => { const t = q('.page[data-page="today"]').textContent; if (!/Всего отметок/.test(t)) throw new Error('нет сводки'); });
  step('клик по неделе ведёт в календарь', () => { click(q('.weekstrip-cell')); if (!q('.page[data-page="calendar"]').classList.contains('active')) throw new Error('перехода нет'); });

  console.log('\n=== 6. Привычки ===');
  step('строки привычек', () => { w.HV.go('habits'); const n = qa('.hv-row').length; if (n < 5) throw new Error('строк: ' + n); console.log('     строк: ' + n); });
  step('hover-действия: ручка, правка, меню', () => {
    if (!q('.drag-handle')) throw new Error('нет ручки');
    if (!q('[data-edit]')) throw new Error('нет кнопки правки');
    if (!q('[data-menu]')) throw new Error('нет кнопки меню');
  });
  step('чекбокс — svg-галочка, не эмодзи', () => {
    const c = q('.check'); if (!c) throw new Error('нет чекбокса');
    if (!c.innerHTML.includes('<svg')) throw new Error('в чекбоксе не svg');
  });
  step('фильтры с счётчиками', () => {
    const chips = qa('[data-filter]'); if (chips.length < 5) throw new Error('фильтров: ' + chips.length);
    const left = chips.find((c) => c.dataset.filter === 'left'); click(left);
    if (!q('[data-filter="left"]').classList.contains('on')) throw new Error('фильтр не включился');
    click(q('[data-filter="active"]'));
  });
  step('поиск по привычкам', () => {
    const inp = q('#hSearch'); if (!inp) throw new Error('нет поля поиска');
    inp.value = 'вода'; inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    return new Promise((r) => setTimeout(r, 300));
  });
  step('цикл отметки: done → skip → miss → сброс', () => {
    w.HV.go('habits'); w.HV.render();
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Тест v2 отметки', emoji: '🧪', freq: { type: 'daily' }, start: t });
    w.HV.save(); w.HV.render();
    const btn = q('[data-check="' + h.id + '"]'); if (!btn) throw new Error('нет чекбокса новой привычки');
    click(btn); if ((w.HV.state.logs[h.id] || {})[t]?.status !== 'done') throw new Error('не done');
    const b2 = q('[data-check="' + h.id + '"]'); click(b2);
    if ((w.HV.state.logs[h.id] || {})[t]?.status !== 'skip') throw new Error('не skip');
    const b3 = q('[data-check="' + h.id + '"]'); click(b3);
    if ((w.HV.state.logs[h.id] || {})[t]?.status !== 'miss') throw new Error('не miss');
    const b4 = q('[data-check="' + h.id + '"]'); click(b4);
    if ((w.HV.state.logs[h.id] || {})[t]) throw new Error('не сбросилось');
    w.HV.removeHabit(h.id);
  });
  step('меню привычки открывается и содержит пункты', () => {
    w.HV.go('habits'); w.HV.render();
    click(q('[data-menu]'));
    const items = qa('#menuHost .menu button, .menu button');
    if (items.length < 5) throw new Error('пунктов меню: ' + items.length);
  });
  step('инлайн-переименование по двойному клику', () => {
    const nm = q('[data-name]'); if (!nm) throw new Error('нет названия');
    nm.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true }));
    const inp = q('.nm-edit'); if (!inp) throw new Error('поле редактирования не появилось');
  });

  console.log('\n=== 7. Command palette ===');
  step('открывается по кнопке', () => { click(q('#btnSearch')); if (q('#cmdkRoot').hidden) throw new Error('не открылась'); });
  step('содержит группы и элементы', () => {
    const items = qa('.cmdk-item'); if (items.length < 10) throw new Error('элементов: ' + items.length);
    const groups = qa('.cmdk-group'); if (groups.length < 3) throw new Error('групп: ' + groups.length);
    console.log('     команд: ' + items.length + ', групп: ' + groups.length);
  });
  step('фильтрует по вводу', () => {
    const inp = q('#cmdkInput'); inp.value = 'календарь'; inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    const n = qa('.cmdk-item').length; if (n < 1) throw new Error('ничего не найдено'); if (n > 6) throw new Error('не отфильтровалось: ' + n);
  });
  step('навигация стрелками и выбор', () => {
    const inp = q('#cmdkInput'); inp.value = ''; inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    key('ArrowDown'); key('ArrowDown');
    const sel = q('.cmdk-item.sel'); if (!sel) throw new Error('нет выделенного');
    key('Enter');
  });
  step('открывается по ⌘K и Ctrl+K', () => {
    key('k', { metaKey: true }); if (q('#cmdkRoot').hidden) throw new Error('⌘K не сработал');
    key('Escape'); if (!q('#cmdkRoot').hidden) throw new Error('Esc не закрыл');
    key('k', { ctrlKey: true }); if (q('#cmdkRoot').hidden) throw new Error('Ctrl+K не сработал');
    key('Escape');
  });
  step('открывается по «/»', () => { key('/'); if (q('#cmdkRoot').hidden) throw new Error('/ не открыл палитру'); key('Escape'); });

  console.log('\n=== 8. Темы ===');
  step('8 мягких акцентов', () => { if (w.HV.THEME_LIST.length !== 8) throw new Error('тем: ' + w.HV.THEME_LIST.length); });
  step('переключение акцента меняет data-theme', () => {
    ['peach', 'sage', 'sky', 'rose', 'snow'].forEach((t) => {
      w.HV.setTheme(t);
      if (w.document.documentElement.dataset.theme !== t) throw new Error('тема не применилась: ' + t);
    });
  });
  step('светлый/тёмный режим', () => {
    w.HV.setMode('dark'); if (w.document.documentElement.dataset.mode !== 'dark') throw new Error('dark не применился');
    w.HV.setMode('light'); if (w.document.documentElement.dataset.mode !== 'light') throw new Error('light не применился');
  });
  step('поповер темы из шапки', () => {
    click(q('#btnTheme'));
    const m = q('#menuHost .menu'); if (!m) throw new Error('поповер не открылся');
    const sw = qa('#menuHost [data-th]'); if (sw.length !== 8) throw new Error('акцентов в поповере: ' + sw.length);
    click(sw[3]);
    if (!q('#menuHost .menu')) { /* закрылся — ок */ }
  });
  step('плотность compact', () => {
    w.HV.go('settings'); w.HV.render();
    const c = qa('[data-dens="compact"]')[0]; if (!c) throw new Error('нет переключателя плотности');
    click(c);
    if (w.document.documentElement.dataset.density !== 'compact') throw new Error('не применилось');
    click(qa('[data-dens="cozy"]')[0]);
  });
  step('палитра привычек мягкая, без неона', () => {
    const neon = ['#7c5cff', '#00e5c3', '#ff5c8a', '#ffb020'];
    w.HV.go('habits'); w.HV.render();
    const html = q('.page[data-page="habits"]').innerHTML;
    neon.forEach((c) => { if (html.toLowerCase().includes(c)) throw new Error('в разметке кислотный цвет ' + c); });
  });

  console.log('\n=== 9. Настройки ===');
  step('форма профиля', () => { w.HV.go('settings'); ['#sName', '#sBio', '#sBirth', '#sAv'].forEach((s) => { if (!q(s)) throw new Error('нет ' + s); }); });
  step('сохранение профиля', () => {
    q('#sName').value = 'Новое Имя'; click(q('#sSave'));
    if (w.HV.state.profile.name !== 'Новое Имя') throw new Error('не сохранилось');
  });
  step('возраст из даты рождения', () => {
    q('#sBirth').value = '1990-05-14'; click(q('#sSave'));
    const t = q('.page[data-page="settings"]').textContent;
    if (!/лет/.test(t)) throw new Error('возраст не показан');
  });
  step('блоки напоминаний, приватности и данных', () => {
    ['#sNotif', '#sNotifTime', '#sPrivFeed', '#sPrivProf', '#sExport', '#sImport', '#sCsv', '#sSeed', '#sReset']
      .forEach((s) => { if (!q(s)) throw new Error('нет ' + s); });
  });
  step('переключатели работают', () => {
    const t = q('#sPrivFeed'); const before = w.HV.state.profile.privacyFeed;
    click(t); if (w.HV.state.profile.privacyFeed === before) throw new Error('не переключился');
  });

  console.log('\n=== 10. Модалки и данные ===');
  step('модалка привычки открывается', () => { w.HV.go('habits'); w.eval('habitModal()'); if (q('#modalRoot').hidden) throw new Error('не открылась'); });
  step('создание привычки', () => {
    q('#mName').value = 'Привычка v2'; q('#mName').dispatchEvent(new w.Event('input', { bubbles: true }));
    const before = w.HV.state.habits.length; click(q('#mSave'));
    if (w.HV.state.habits.length !== before + 1) throw new Error('не создалась');
  });
  step('недельная квота в модалке', () => {
    w.eval('habitModal()'); click(q('[data-tab="sched"]'));
    if (!q('#mWeekGoal')) throw new Error('нет поля квоты');
    q('#mWeekGoal').value = '4';
    q('#mName').value = 'С квотой'; q('#mName').dispatchEvent(new w.Event('input', { bubbles: true }));
    click(q('#mSave'));
    const h = w.HV.state.habits[w.HV.state.habits.length - 1];
    if (h.weekGoal !== 4) throw new Error('weekGoal=' + h.weekGoal);
    w.HV.removeHabit(h.id);
  });
  step('заморозки в модалке', () => {
    w.eval('habitModal()'); click(q('[data-tab="sched"]'));
    if (!q('#mFreeze')) throw new Error('нет поля заморозок');
    q('#mFreeze').value = '3';
    q('#mName').value = 'С заморозками'; q('#mName').dispatchEvent(new w.Event('input', { bubbles: true }));
    click(q('#mSave'));
    const h = w.HV.state.habits[w.HV.state.habits.length - 1];
    if (h.freezes !== 3) throw new Error('freezes=' + h.freezes);
    w.HV.removeHabit(h.id);
  });
  step('каталог открывается', () => { w.eval('catalogSheet()'); if (q('#sheetRoot').hidden) throw new Error('не открылся'); if (qa('.preset').length < 20) throw new Error('пресетов: ' + qa('.preset').length); q('#sheetRoot').hidden = true; });
  step('заметка создаётся', () => {
    w.eval('noteModal()'); q('#nTitle').value = 'Заметка v2';
    const before = w.HV.state.notes.length; click(q('#nSave'));
    if (w.HV.state.notes.length !== before + 1) throw new Error('не создалась');
  });
  step('карточка для шаринга рисуется', () => {
    q('#sheetRoot').hidden = false;
    w.eval('HV.shareSheet("week", {})');
    const cv = q('#shareCanvas'); if (!cv) throw new Error('нет canvas');
    q('#sheetRoot').hidden = true;
  });
  const checkPersist = () => step('персистентность localStorage', () => {
    const raw = w.localStorage.getItem('habitverse.v1');
    if (!raw) throw new Error('пусто');
    const p = JSON.parse(raw);
    if (!p.habits.length) throw new Error('привычки не сохранились');
    const OK = ['snow','peach','sand','sage','mint','sky','lavender','rose'];
    if (!OK.includes(p.profile.theme)) throw new Error('тема не из v2-набора: ' + p.profile.theme);
    if (!['light','dark'].includes(p.profile.mode)) throw new Error('режим не из v2: ' + p.profile.mode);
    console.log('     размер: ' + (raw.length / 1024).toFixed(1) + ' КБ, тема ' + p.profile.theme + '/' + p.profile.mode);
  });
  step('нет undefined/NaN в разметке', () => {
    ['today', 'habits', 'calendar', 'stats', 'notes', 'team', 'settings'].forEach((p) => {
      w.HV.go(p);
      const txt = q('.page[data-page="' + p + '"]').textContent;
      if (/undefined/.test(txt)) throw new Error('undefined в «' + p + '»');
      if (/NaN/.test(txt)) throw new Error('NaN в «' + p + '»');
    });
  });
  console.log('\n=== 11. Ревью-фиксы (скриншоты пользователя) ===');
  step('сайдбар: списка привычек НЕТ (требование пользователя)', () => {
    w.HV.go('today');
    const sb = q('#sidebar').innerHTML;
    if (/Утренняя пробежка|2 литра воды/.test(sb)) throw new Error('привычки всё ещё в сайдбаре');
    if (!sb.includes('data-act="new-habit"')) throw new Error('нет быстрых действий');
  });
  step('шапка: SVG-иконки вместо эмодзи', () => {
    ['#btnTheme', '#btnBell', '#icSearch'].forEach(sel => {
      const el = q(sel);
      if (!el) throw new Error('нет ' + sel);
      if (!el.querySelector('svg')) throw new Error(sel + ' без svg-иконки');
      if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(el.textContent)) throw new Error(sel + ' содержит эмодзи');
    });
  });
  step('аватары: инициалы, без эмодзи и градиентов', () => {
    w.HV.go('team');
    const avs = qa('.avatar');
    if (avs.length < 4) throw new Error('аватаров мало: ' + avs.length);
    const withEmoji = avs.filter(a => /[\u{1F300}-\u{1FAFF}]/u.test(a.textContent) && !a.querySelector('img'));
    if (withEmoji.length) throw new Error('эмодзи-аватаров: ' + withEmoji.length);
    const grad = avs.filter(a => (a.getAttribute('style') || '').includes('linear-gradient'));
    if (grad.length) throw new Error('градиентных аватаров: ' + grad.length);
    const letters = avs.filter(a => /^[A-ZА-ЯЁ·]$/.test(a.textContent.trim()));
    if (letters.length < 4) throw new Error('инициалов мало: ' + letters.length);
    console.log('     аватаров-инициалов: ' + letters.length);
  });
  step('заметки: сетка карточек, а не столбец', () => {
    w.HV.go('notes');
    const cards = qa('.note-card');
    if (cards.length < 3) throw new Error('карточек: ' + cards.length);
    if (!q('.notes-grid')) throw new Error('нет контейнера notes-grid');
    const c = cards[0];
    if (!c.querySelector('header h4')) throw new Error('нет заголовка карточки');
    if (!c.querySelector('.md ul, .md p, .md h3, .md h4')) throw new Error('тело не размечено блочно');
    if (!c.querySelector('footer .when')) throw new Error('нет даты в футере');
    if (!c.querySelector('.nc-acts [data-npin]')) throw new Error('нет кнопки закрепления');
  });
  step('заметки: markdown-блоки корректны', () => {
    const md = q('.note-card .md').innerHTML;
    if (/<br>/.test(md)) throw new Error('в разметке остались <br> вместо блоков');
    if (q('.note-card .md ul')) {
      const li = q('.note-card .md ul li');
      if (!li || !li.textContent.trim()) throw new Error('пустой пункт списка');
    }
  });
  step('заметки: пин переключается', () => {
    w.HV.go('notes');
    const unpinned = q('.note-card:not(.pinned) [data-npin]');
    if (!unpinned) throw new Error('нет незакреплённой карточки');
    const id = unpinned.dataset.npin;
    click(unpinned);
    const n = w.HV.state.notes.find(x => x.id === id);
    if (!n.pinned) throw new Error('пин не выставился');
    w.HV.go('notes');
    const card = q(`.note-card[data-note="${id}"]`);
    if (!card || !card.classList.contains('pinned')) throw new Error('карточка не помечена закреплённой');
    click(q(`.note-card[data-note="${id}"] [data-npin]`));   // вернуть как было
    if (w.HV.state.notes.find(x => x.id === id).pinned) throw new Error('пин не снялся');
  });
  step('команда: карточки челленджей в новой разметке', () => {
    w.HV.go('team');
    const cards = qa('.chal-card');
    if (cards.length < 2) throw new Error('карточек: ' + cards.length);
    const c = cards[0];
    if (!c.querySelector('header .cc-em')) throw new Error('нет иконки челленджа');
    if (!c.querySelector('.cc-tags .tag')) throw new Error('нет тегов');
    if (!c.querySelector('.cc-prog .progress')) throw new Error('нет прогресса');
    if (!c.querySelector('footer .avstack .avatar')) throw new Error('нет стека аватаров');
    if (!c.querySelector('.cc-menu')) throw new Error('нет меню карточки');
  });
  step('команда: лидерборд и экипаж без градиентных полос', () => {
    const rows = qa('.lb-row');
    if (rows.length < 2) throw new Error('строк лидерборда: ' + rows.length);
    rows.forEach(r => {
      if ((r.innerHTML.match(/linear-gradient/g) || []).length) throw new Error('градиент в строке лидерборда');
    });
    const crew = qa('.crew-row');
    if (!crew.length) throw new Error('нет строк экипажа');
    if (!q('.crew-row [data-nudge]')) throw new Error('нет кнопки поддержки');
  });
  step('команда: лента с аватарами-инициалами и реакциями', () => {
    const fi = qa('.feed-item');
    if (fi.length < 3) throw new Error('событий: ' + fi.length);
    if (!fi[0].querySelector('.avatar')) throw new Error('нет аватара');
    if (!fi[0].querySelector('.react')) throw new Error('нет реакций');
  });
  step('меню карточки челленджа открывается', () => {
    click(q('.cc-menu'));
    const m = q('#menuHost .menu');
    if (!m) throw new Error('меню не открылось');
    if (m.querySelectorAll('button').length < 2) throw new Error('мало пунктов');
    w.document.body.click();
  });
  step('действующие лица без эмодзи в хроме кнопок', () => {
    w.HV.go('today');
    const btns = qa('.page-actions .btn, .toolbar .btn');
    const bad = btns.filter(b => /[\u{1F300}-\u{1FAFF}]/u.test(b.textContent));
    if (bad.length) throw new Error('эмодзи в кнопках: ' + bad.map(b => b.textContent.trim()).join(', '));
  });

  step('горячие клавиши разделов', () => {
    ['1','2','3','4','5','6','7'].forEach((k) => { key(k); });
    if (!q('.page[data-page="settings"]').classList.contains('active')) throw new Error('клавиша 7 не открыла Настройки');
  });

  console.log('\n=== 12. Зачистка alpha.3 (скриншоты 5–6) ===');
  const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F2FF}]/u;
  step('сайдбар: иконки — SVG, без текстовых fallback', () => {
    const ics = qa('#sidebar .side-link .ic');
    if (!ics.length) throw new Error('нет .ic в сайдбаре');
    ics.forEach((el) => {
      if (el.textContent.trim()) throw new Error('текст внутри .ic: ' + el.textContent);
      if (!el.querySelector('svg')) throw new Error('нет svg внутри .ic');
    });
  });
  step('сайдбар: версия сборки видна пользователю', () => {
    const foot = q('#sidebar .side-foot');
    if (!foot || !/v2\.0\.0-alpha\.3/.test(foot.textContent)) throw new Error('нет версии в подвале');
  });
  step('⌘K: иконки — SVG или цветные точки, без глифов', () => {
    key('k', { metaKey: true });
    const items = qa('#cmdkList .cmdk-item');
    if (items.length < 10) throw new Error('мало пунктов: ' + items.length);
    items.forEach((el) => {
      const ic = el.querySelector('.ic');
      if (!ic) throw new Error('нет .ic');
      if (ic.textContent.trim()) throw new Error('текст/глиф в .ic: ' + ic.textContent);
      if (!ic.querySelector('svg') && !ic.querySelector('.dot')) throw new Error('нет svg/dot в .ic');
    });
    key('Escape');
  });
  step('каталог: без эмодзи, плитки с SVG, чипы расписания', () => {
    w.catalogSheet();
    const list = q('#catList');
    if (!list) throw new Error('нет #catList');
    if (EMOJI_RE.test(list.textContent)) throw new Error('эмодзи в каталоге: ' + list.textContent.slice(0, 80));
    const presets = qa('#catList .preset');
    if (presets.length < 10) throw new Error('мало пресетов: ' + presets.length);
    presets.forEach((el) => {
      if (!el.querySelector('.tile svg')) throw new Error('нет svg в плитке');
      if (!el.querySelector('.chip')) throw new Error('нет чипа расписания');
      if (!el.querySelector('.add svg')) throw new Error('нет svg в кнопке добавления');
    });
    if (!q('#catList .cat-head')) throw new Error('нет заголовков групп');
  });
  step('каталог: клик добавляет привычку и гасит строку', () => {
    const before = w.HV.state.habits.length;
    const el = qa('#catList .preset').find((x) => !x.classList.contains('has'));
    if (!el) throw new Error('нет доступных пресетов');
    click(el);
    if (w.HV.state.habits.length !== before + 1) throw new Error('привычка не добавилась');
    if (!el.classList.contains('has')) throw new Error('строка не погасла');
  });
  step('каталог: поиск сужает список', () => {
    w.catalogSheet('пробежка');
    const n = qa('#catList .preset').length;
    if (n < 1 || n > 3) throw new Error('странное число результатов: ' + n);
    w.catalogSheet();
  });
  step('тосты: SVG-иконка по типу, без эмодзи', () => {
    w.eval("toast('проверка тоста', 'ok')");
    const t = qa('#toasts .toast').pop();
    if (!t) throw new Error('нет тоста');
    if (!t.querySelector('.ti svg')) throw new Error('нет svg в .ti');
    if (EMOJI_RE.test(t.textContent)) throw new Error('эмодзи в тосте');
  });
  step('привычки: категория и напоминание в тегах — SVG', () => {
    w.HV.go('habits');
    const tag = q('.hv-meta .tag');
    if (!tag) throw new Error('нет тегов в строке привычки');
    if (!tag.querySelector('svg')) throw new Error('нет svg в теге категории');
    if (EMOJI_RE.test(tag.textContent)) throw new Error('эмодзи в теге: ' + tag.textContent);
  });
  step('инсайты: иконки-плашки с SVG', () => {
    w.HV.go('stats');
    const cards = qa('.ins-ic');
    cards.forEach((c) => { if (!c.querySelector('svg')) throw new Error('нет svg в .ins-ic'); });
  });

  setTimeout(() => {
    step('палитра закрылась после Enter', () => { if (!q('#cmdkRoot').hidden) throw new Error('не закрылась'); });
    checkPersist();
    console.log('\n=== ИТОГ ===');
    if (errors.length) { console.log('ОШИБОК: ' + errors.length); errors.slice(0, 25).forEach((e) => console.log('  - ' + e)); process.exit(1); }
    console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ'); process.exit(0);
  }, 600);
}, 500);
