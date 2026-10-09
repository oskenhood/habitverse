/* Harness: гоняем демо в jsdom, ловим runtime-ошибки (dev-only) */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require(process.env.JSDOM || require.resolve('jsdom', { paths: [__dirname] }));

const DIR = path.join(__dirname, '..', 'demo');
const target = process.env.TARGET || 'split';
let html, js;
if (target === 'single') {
  const full = fs.readFileSync(path.join(__dirname, '..', 'HabitVerse-demo.html'), 'utf8');
  const m = full.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!m) throw new Error('в single-file сборке не найден встроенный скрипт');
  js = m[1];
  html = full.replace(m[0], '</body>');   // скрипт исполняем вручную, уже после моков
} else {
  html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  js = fs.readFileSync(path.join(DIR, 'app.js'), 'utf8');
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  const msg = e.message || '';
  // jsdom не умеет навигацию (скачивание файла через <a download>) — это не баг приложения
  if (/Not implemented: navigation/i.test(msg)) { console.log('  (skip) jsdom navigation — скачивание файла'); return; }
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
    if (['fillStyle','strokeStyle','lineWidth','font','textAlign','globalAlpha','shadowColor','shadowBlur','lineJoin'].includes(k)) return t[k] ?? '';
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; }
});
w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 900; }, configurable: true });
Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 400; }, configurable: true });
w.HTMLElement.prototype.getBoundingClientRect = function () { return { left: 10, top: 10, width: 200, height: 60, right: 210, bottom: 70, x: 10, y: 10 }; };
w.devicePixelRatio = 1;
w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
w.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
w.cancelAnimationFrame = id => clearTimeout(id);
w.AudioContext = class { constructor(){ this.currentTime = 0; this.state='running'; this.destination={}; }
  createOscillator(){ return { type:'', frequency:{ setValueAtTime(){} }, connect(){}, start(){}, stop(){} }; }
  createGain(){ return { gain:{ setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  resume(){} };
w.Notification = class { static permission = 'granted'; constructor(t, o){ this.title = t; this.opts = o; } static requestPermission(){ return Promise.resolve('granted'); } };
w.navigator.serviceWorker = { register: () => Promise.resolve({}) };
Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
w.scrollTo = () => {}; w.print = () => {};
w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};

const step = (label, fn) => { try { fn(); console.log('  ok  ' + label); } catch (e) { errors.push(label + ' -> ' + e.message); console.log('  FAIL ' + label + ' :: ' + e.message); } };
const q = s => w.document.querySelector(s);
const qa = s => [...w.document.querySelectorAll(s)];
const click = el => { if (!el) throw new Error('element missing'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };

w.eval(js);
w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));

setTimeout(() => {
  console.log('\n=== 1. Онбординг ===');
  step('онбординг виден', () => { if (q('#onboarding').hidden) throw new Error('hidden'); });
  step('шаг 2: имя', () => { click(q('[data-next]')); q('#onbName').value = 'Тестер'; q('#onbName').dispatchEvent(new w.Event('input', {bubbles:true})); });
  step('шаг 3: аватар', () => { click(q('[data-next]')); });
  step('шаг 4: демо-данные', () => { click(q('[data-next]')); click(q('[data-seed]')); });
  step('приложение открыто', () => { if (q('#app').hidden) throw new Error('app hidden'); });

  console.log('\n=== 2. Данные ===');
  step('привычки созданы', () => { const n = w.HV.state.habits.length; if (n < 10) throw new Error('habits=' + n); console.log('     привычек: ' + n); });
  step('логи есть', () => { const n = Object.keys(w.HV.state.logs).length; if (!n) throw new Error('no logs'); console.log('     с историей: ' + n); });
  step('стрик считается', () => { const h = w.HV.state.habits[0]; const s = w.HV.streakOf(h); console.log('     ' + h.name + ' -> cur ' + s.cur + ' best ' + s.best); });
  step('расписание', () => { const h = w.HV.state.habits[0]; console.log('     due today: ' + w.HV.dueOn(h, w.HV.D.today())); });
  step('XP', () => { if (!w.HV.state.profile.xp) throw new Error('xp=0'); console.log('     xp: ' + w.HV.state.profile.xp); });
  step('ачивки', () => { console.log('     ' + w.HV.state.seenAch.length + ': ' + w.HV.state.seenAch.slice(0,10).join(',')); });
  step('лента', () => { console.log('     событий: ' + w.HV.state.feed.length); });
  step('заметки/челленджи/друзья', () => { console.log('     notes ' + w.HV.state.notes.length + ', challenges ' + w.HV.state.challenges.length + ', friends ' + w.HV.state.friends.length); });

  console.log('\n=== 3. Страницы ===');
  ['today','calendar','stats','notes','social','feed','profile'].forEach(p => {
    step('страница ' + p, () => { w.HV.go(p); const sec = q('.page[data-page="' + p + '"]');
      if (!sec.classList.contains('active')) throw new Error('not active');
      if (sec.innerHTML.length < 300) throw new Error('empty: ' + sec.innerHTML.length); });
  });

  console.log('\n=== 4. Чек-ины ===');
  // выбираем привычку, которая ЗАПЛАНИРОВАНА на сегодня и ещё НЕ отмечена,
  // чтобы цикл done -> skip -> miss -> сброс был детерминированным
  let TARGET = null;
  step('клик -> done', () => { w.HV.go('today');
    const t = w.HV.D.today();
    // создаём собственную привычку, чтобы цикл был детерминированным
    // (сид намеренно оставляет часть сегодняшних привычек уже выполненными)
    const created = w.HV.newHabit({ name: 'Тестовая для отметок', emoji: '🧪', freq: { type: 'daily' }, start: t });
    if (!created || !created.id) throw new Error('не удалось создать привычку');
    if (!w.HV.dueOn(created, t)) throw new Error('привычка не запланирована на сегодня');
    TARGET = created.id;
    w.HV.render();                                   // перерисовать список после создания
    const btn = q('[data-check="' + TARGET + '"]'); if (!btn) throw new Error('нет чекбокса у ' + TARGET);
    click(btn); const l = (w.HV.state.logs[TARGET]||{})[t];
    if (!l || l.status !== 'done') throw new Error('got ' + JSON.stringify(l)); });
  step('клик -> skip', () => { const btn = q('[data-check="' + TARGET + '"]'); click(btn);
    const l = (w.HV.state.logs[TARGET]||{})[w.HV.D.today()]; if (!l || l.status !== 'skip') throw new Error('got ' + JSON.stringify(l)); });
  step('клик -> miss', () => { const btn = q('[data-check="' + TARGET + '"]'); click(btn);
    const l = (w.HV.state.logs[TARGET]||{})[w.HV.D.today()]; if (!l || l.status !== 'miss') throw new Error('got ' + JSON.stringify(l)); });
  step('клик -> сброс', () => { const btn = q('[data-check="' + TARGET + '"]'); click(btn);
    const l = (w.HV.state.logs[TARGET]||{})[w.HV.D.today()]; if (l) throw new Error('got ' + JSON.stringify(l)); });
  step('ячейка недели (backfill)', () => { const b = q('[data-cell]'); if (!b) throw new Error('нет ячеек'); click(b);
    if (q('#sheetRoot').hidden) throw new Error('sheet не открылся'); q('#sheetRoot').hidden = true; });

  console.log('\n=== 5. Модалки и CRUD ===');
  step('модалка создания', () => { w.habitModal(); if (q('#modalRoot').hidden) throw new Error('не открылась'); if (!q('#mName')) throw new Error('нет полей'); });
  step('вкладки', () => { ['look','sched','rem','main'].forEach(t => click(q('[data-tab="' + t + '"]'))); });
  step('эмодзи', () => { click(q('[data-tab="look"]')); const e = q('[data-em]'); if (!e) throw new Error('нет'); click(e); });
  step('категория эмодзи', () => { const c = q('[data-ecat]'); click(c); if (!q('[data-em]')) throw new Error('нет сетки'); });
  step('цвет', () => { click(q('[data-col]')); });
  step('частота weekdays', () => { click(q('[data-tab="sched"]')); const s = q('#mFreq'); s.value = 'weekdays'; s.dispatchEvent(new w.Event('change',{bubbles:true}));
    if (!q('[data-wd]')) throw new Error('нет дней'); click(q('[data-wd="2"]')); click(q('[data-preset="work"]')); });
  step('частота interval', () => { const s = q('#mFreq'); s.value = 'interval'; s.dispatchEvent(new w.Event('change',{bubbles:true})); if (!q('#fEvery')) throw new Error('нет поля'); });
  step('частота monthly', () => { const s = q('#mFreq'); s.value = 'monthly'; s.dispatchEvent(new w.Event('change',{bubbles:true})); if (!q('#fMonth')) throw new Error('нет поля'); });
  step('сохранение привычки', () => { const s = q('#mFreq'); s.value = 'daily'; s.dispatchEvent(new w.Event('change',{bubbles:true}));
    q('#mName').value = 'Тестовая привычка'; q('#mName').dispatchEvent(new w.Event('input',{bubbles:true}));
    const before = w.HV.state.habits.length; click(q('#mSave'));
    if (w.HV.state.habits.length !== before + 1) throw new Error('не создалась'); });
  step('валидация пустого имени', () => { w.habitModal(); q('#mName').value = '  '; const before = w.HV.state.habits.length; click(q('#mSave'));
    if (w.HV.state.habits.length !== before) throw new Error('создалась с пустым именем'); q('#modalRoot').hidden = true; });
  step('редактирование', () => { const h = w.HV.state.habits[0]; w.habitModal(h.id);
    if (q('#mName').value !== h.name) throw new Error('имя не подставилось');
    q('#mName').value = 'Изменено'; q('#mName').dispatchEvent(new w.Event('input',{bubbles:true})); click(q('#mSave'));
    if (w.HV.state.habits.find(x=>x.id===h.id).name !== 'Изменено') throw new Error('не сохранилось'); });
  step('меню привычки', () => { w.HV.go('today'); const b = q('[data-menu]'); if (!b) throw new Error('нет'); click(b);
    if (!q('.menu')) throw new Error('меню не появилось');
    ['dup','hist','note','rem','up','down','arch','edit'].forEach(a => { const btn = q('[data-a="' + a + '"]'); if (!btn) throw new Error('нет пункта ' + a); });
    q('#modalRoot').hidden = true; q('#sheetRoot').hidden = true; });
  step('дублирование', () => { const before = w.HV.state.habits.length; w.HV.go('today'); click(q('[data-menu]'));
    click(q('[data-a="dup"]')); if (w.HV.state.habits.length !== before + 1) throw new Error('не дублировалась');
    const last = w.HV.state.habits[w.HV.state.habits.length-1]; if (!last.id) throw new Error('id undefined!'); });
  step('статистика привычки', () => { w.eval('HV.habitStatsSheet(' + JSON.stringify(w.HV.state.habits[0].id) + ')');
    if (q('#sheetRoot').hidden) throw new Error('sheet не открылся');
    if (!q('#hmOne')) throw new Error('нет heatmap'); q('#sheetRoot').hidden = true; });
  step('напоминание sheet', () => { w.eval('HV.reminderSheet(' + JSON.stringify(w.HV.state.habits[0].id) + ')');
    if (!q('#rTime')) throw new Error('нет поля времени'); q('#rTime').value = '08:00'; click(q('#rSave'));
    if (w.HV.state.habits[0].reminder !== '08:00') throw new Error('не сохранилось: ' + w.HV.state.habits[0].reminder); });
  step('заметка: создать', () => { w.noteModal(); q('#nTitle').value = 'Тест-заметка'; q('#nBody').value = '# Заголовок\n**жирный** и `код`\n- пункт';
    const before = w.HV.state.notes.length; click(q('#nSave'));
    if (w.HV.state.notes.length !== before + 1) throw new Error('не создалась'); });
  step('заметка: редактировать', () => { const n = w.HV.state.notes[0]; w.noteModal(n.id); q('#nTitle').value = 'Обновлено'; click(q('#nSave'));
    if (w.HV.state.notes.find(x=>x.id===n.id).title !== 'Обновлено') throw new Error('не обновилась'); });
  step('заметка: удалить', () => { const before = w.HV.state.notes.length; const n = w.HV.state.notes[0];
    w.eval('HV.state.notes = HV.state.notes.filter(x => x.id !== ' + JSON.stringify(n.id) + '); HV.save()');
    if (w.HV.state.notes.length !== before - 1) throw new Error('не удалилась'); });
  step('челлендж: создать', () => { w.challengeModal(); q('#cName').value = 'Тест-челлендж'; const before = w.HV.state.challenges.length; click(q('#cSave'));
    if (w.HV.state.challenges.length !== before + 1) throw new Error('не создался'); });
  step('челлендж: карточка', () => { w.HV.go('social'); const c = q('.ch-card'); if (!c) throw new Error('нет карточек'); click(c);
    if (q('#sheetRoot').hidden) throw new Error('sheet не открылся'); if (!q('#cCopy')) throw new Error('нет кода'); q('#sheetRoot').hidden = true; });
  step('челлендж: удалить', () => { const before = w.HV.state.challenges.length; const c = w.HV.state.challenges[0];
    w.eval('HV.state.challenges = HV.state.challenges.filter(x => x.id !== ' + JSON.stringify(c.id) + '); HV.save()');
    if (w.HV.state.challenges.length !== before - 1) throw new Error('не удалился'); });
  step('ввод кода', () => { w.HV.go('social'); click(q('#btnJoinCode')); if (!q('#jCode')) throw new Error('нет поля'); q('#sheetRoot').hidden = true; });
  step('друзья sheet', () => { click(q('#btnAddFriend')); if (!q('#fMail')) throw new Error('нет поля'); q('#sheetRoot').hidden = true; });
  step('пинок другу', () => { const b = q('[data-nudge]'); if (!b) throw new Error('нет'); click(b); });

  console.log('\n=== 6. Календарь ===');
  step('ячейки месяца', () => { w.HV.go('calendar'); const n = qa('.cal-cell').length; if (n < 28) throw new Error('ячеек ' + n); console.log('     ячеек: ' + n); });
  step('heatmap года', () => { const n = qa('#calHm .hm-cell').length; if (n < 300) throw new Error('heatmap ' + n); console.log('     heatmap: ' + n); });
  step('клик по дню', () => { click(q('.cal-cell.today') || q('.cal-cell')); if (!q('#calDay').innerHTML.includes('check')) throw new Error('день не отрисован'); });
  step('отметка из дня', () => { const b = q('[data-dchk]'); if (!b) throw new Error('нет чекбокса'); click(b); });
  step('навигация месяца', () => { click(q('#calPrev')); click(q('#calPrev')); click(q('#calNext')); click(q('#calToday')); });
  step('фильтр по привычке', () => { const s = q('#calSel'); s.value = w.HV.state.habits[0].id; s.dispatchEvent(new w.Event('change',{bubbles:true}));
    if (!qa('.cal-cell').length) throw new Error('пусто'); s.value = 'all'; s.dispatchEvent(new w.Event('change',{bubbles:true})); });
  step('клик по heatmap', () => { const c = qa('#calHm .hm-cell').filter(x => x.dataset.k && x.dataset.k < w.HV.D.today())[0]; if (!c) throw new Error('нет ячейки'); click(c); });
  step('сводка месяца', () => { if (!q('.page[data-page="calendar"]').textContent.includes('Сводка месяца')) throw new Error('нет сводки'); });

  console.log('\n=== 7. Отчёты ===');
  step('KPI', () => { w.HV.go('stats'); const n = qa('.kpi').length; if (n < 6) throw new Error('kpi ' + n); console.log('     kpi: ' + n); });
  step('canvas-графики', () => { ['chTrend','chDonut','chDow','chRadar'].forEach(id => { if (!q('#' + id)) throw new Error('нет ' + id); }); });
  step('бары привычек', () => { if (!qa('#bars .bar-row').length) throw new Error('нет баров'); });
  step('ачивки', () => { const n = qa('.ach-item').length; const want = w.HV.ACHS.length;
    if (n !== want) throw new Error('ачивок ' + n + ', ожидалось ' + want); console.log('     ачивок: ' + want); });
  step('инсайты', () => { const t = q('.page[data-page="stats"]').textContent; if (!t.includes('Инсайты')) throw new Error('нет инсайтов'); console.log('     инсайтов: ' + (t.match(/🏆|📈|🧭|🌱|📅|🩹|💪|🔥|⚖️|🌈|🌟/g)||[]).length); });
  step('диапазоны 7/30/90/180/365', () => { [7,90,180,365,30].forEach(r => { w.HV.go('stats'); click(q('[data-range="' + r + '"]'));
    if (!qa('.kpi').length) throw new Error('сломалось на ' + r); }); });
  step('heatmap в отчётах', () => { w.HV.go('stats'); if (!qa('#statsHm .hm-cell').length) throw new Error('нет'); });
  step('экспорт CSV', () => { w.eval('HV.exportCsv()'); });
  step('экспорт JSON', () => { w.eval('HV.exportJson()'); });

  console.log('\n=== 8. Профиль и настройки ===');
  step('форма профиля', () => { w.HV.go('profile'); if (!q('#pName')) throw new Error('нет'); if (!q('#pName').value) throw new Error('имя пустое'); });
  step('сохранение профиля', () => { q('#pName').value = 'Новое Имя'; q('#pBio').value = 'Био'; q('#pBirth').value = '1990-01-01'; click(q('#pSave'));
    if (w.HV.state.profile.name !== 'Новое Имя') throw new Error('не сохранилось'); });
  step('возраст считается', () => { if (!q('.page[data-page="profile"]').textContent.includes('лет')) throw new Error('нет возраста'); });
  step('темы', () => { ['abyss','neon','graphite','paper','midnight'].forEach(t => { click(q('[data-theme="' + t + '"]'));
    if (w.document.documentElement.dataset.theme !== t) throw new Error('тема не применилась: ' + t); }); });
  step('акценты', () => { qa('[data-ac]').slice(0,5).forEach(b => click(b)); });
  step('плотность', () => { click(q('[data-dens="compact"]')); if (w.document.documentElement.dataset.density !== 'compact') throw new Error('не применилось'); click(q('[data-dens="cozy"]')); });
  step('переключатели', () => { ['#pSound','#pPrivFeed','#pPrivProf','#pNotif'].forEach(s => click(q(s))); });
  step('аватар-эмодзи', () => { click(q('[data-pe]')); });
  step('тест уведомления', () => { w.eval('HV.testNotify()'); });
  step('sheet уведомлений привычки', () => { click(q('#pTestNotif')); });
  step('PWA sheet', () => { click(q('#pInstall')); if (q('#sheetRoot').hidden) throw new Error('не открылся'); q('#sheetRoot').hidden = true; });
  step('импорт/экспорт кнопок', () => { if (!q('#pExport') || !q('#pImport') || !q('#pReset')) throw new Error('нет кнопок'); });
  step('сброс демо-данных', () => { w.HV.go('profile'); const before = w.HV.state.habits.length;
    w.eval('HV.state = HV.blank(); HV.seedDemo(); HV.save(); HV.render()');
    if (!w.HV.state.habits.length) throw new Error('сид не сработал'); });

  console.log('\n=== 8b. v1.1: заморозки, негативные привычки, drag&drop ===');
  step('заморозка спасает стрик', () => {
    const t = w.HV.D.today();
    // freezes=3 (а не 2), чтобы t-7 гарантированно спасался даже в другом календарном месяце
    const h = w.HV.newHabit({ name: 'Тест заморозки', emoji: '🧊', freq: { type: 'daily' }, start: w.HV.D.add(t, -12), freezes: 3 });
    w.HV.save();
    for (let i = 12; i >= 8; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');   // 5 дней
    w.HV.setLog(h.id, w.HV.D.add(t, -7), 'miss');                                // ← заморозка
    for (let i = 6; i >= 1; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');   // 6 дней
    w.HV.save();
    const st = w.HV.streakOf(h);
    // 5 (t-12..t-8) + 6 (t-6..t-1) = 11; спасённый t-7 продолжает цепочку, но не считается
    if (st.cur !== 11) throw new Error('ожидался стрик 11 (5 + 6), получено ' + st.cur);
    if (st.frozen !== 1) throw new Error('ожидалась 1 заморозка, получено ' + st.frozen);
    w.HV.removeHabit(h.id);
  });
  step('без заморозок стрик рвётся', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Жёсткий режим', emoji: '⚡', freq: { type: 'daily' }, start: w.HV.D.add(t, -12), freezes: 0 });
    for (let i = 12; i >= 8; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -7), 'miss');
    for (let i = 6; i >= 1; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.save();
    const st = w.HV.streakOf(h);
    if (st.cur !== 6) throw new Error('ожидался стрик 6, получено ' + st.cur);
    if (st.frozen !== 0) throw new Error('не должно быть заморозок');
    w.HV.removeHabit(h.id);
  });
  step('день без отметки стрик рвёт (заморозка только на явный ✕)', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Без отметки', emoji: '🤔', freq: { type: 'daily' }, start: w.HV.D.add(t, -12), freezes: 3 });
    for (let i = 12; i >= 8; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    for (let i = 6; i >= 1; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');   // t-7 без записи
    w.HV.save();
    const st = w.HV.streakOf(h);
    if (st.cur !== 6) throw new Error('ожидался стрик 6, получено ' + st.cur);
    if (st.frozen !== 0) throw new Error('заморозка не должна тратиться на незаполненный день');
    w.HV.removeHabit(h.id);
  });
  step('бюджет заморозок исчерпывается', () => {
    const t = w.HV.D.today();
    const mo = k => k.slice(0, 7);
    // ⚠️ тест обязан быть календарно-независимым: t-4 и t-7 могут попасть
    //    в разные месяцы (у каждого месяца СВОЙ бюджет заморозок)
    const sameMonth = mo(w.HV.D.add(t, -4)) === mo(w.HV.D.add(t, -7));
    const h = w.HV.newHabit({ name: 'Одна заморозка', emoji: '🧊', freq: { type: 'daily' }, start: w.HV.D.add(t, -10), freezes: 1 });
    for (let i = 10; i >= 8; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -7), 'miss');
    for (let i = 6; i >= 5; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -4), 'miss');
    for (let i = 3; i >= 1; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.save();
    const st = w.HV.streakOf(h);
    // один месяц → вторая miss рвёт стрик (cur 3); разные месяцы → обе спасаются (cur 8)
    // замороженный день ПРОДОЛЖАЕТ стрик, но НЕ инкрементирует счётчик.
    //   один месяц: 3 (t-1..t-3) + 2 (t-5,t-6) = 5, вторая miss рвёт цепочку
    //   разные месяцы: у каждого месяца свой бюджет, обе miss спасены = 3 + 2 + 3 = 8
    const wantCur = sameMonth ? 5 : 8;
    const wantFrozen = sameMonth ? 1 : 2;
    if (st.cur !== wantCur) throw new Error(`ожидался стрик ${wantCur} (мес. ${sameMonth ? 'один' : 'разные'}), получено ${st.cur}`);
    if (st.frozen !== wantFrozen) throw new Error(`ожидалось ${wantFrozen} заморозок, получено ${st.frozen}`);
    if (w.HV.freezesUsed(h) < 1) throw new Error('заморозка не зафиксирована');
    w.HV.removeHabit(h.id);
  });
  step('в одном месяце бюджет общий (жёсткая проверка)', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Два провала в одном месяце', emoji: '🧊', freq: { type: 'daily' }, start: w.HV.D.add(t, -6), freezes: 1 });
    for (let i = 6; i >= 5; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -4), 'miss');   // тратит единственную заморозку
    w.HV.setLog(h.id, w.HV.D.add(t, -3), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -2), 'miss');   // бюджет пуст → рвёт
    w.HV.setLog(h.id, w.HV.D.add(t, -1), 'done');
    w.HV.save();
    const st = w.HV.streakOf(h);
    // t-1 done (cur 1) -> t-2 miss спасён заморозкой (cur всё ещё 1) -> t-3 done (cur 2)
    // -> t-4 miss, бюджет месяца пуст -> BREAK. Итого 2, а не 1.
    if (st.cur !== 2) throw new Error('ожидался стрик 2 (заморозка не инкрементирует счётчик), получено ' + st.cur);
    if (st.frozen !== 1) throw new Error('ожидалась 1 заморозка, получено ' + st.frozen);
    w.HV.removeHabit(h.id);
  });
  step('заморозки текущего месяца расходуются', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Месячный бюджет', emoji: '📆', freq: { type: 'daily' }, start: w.HV.D.add(t, -3), freezes: 2 });
    w.HV.setLog(h.id, w.HV.D.add(t, -3), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -2), 'done');
    w.HV.setLog(h.id, w.HV.D.add(t, -1), 'miss');
    w.HV.save();
    w.HV.streakOf(h);                       // должен потратить заморозку
    const used = w.HV.freezesUsed(h);
    const left = w.HV.freezesLeft(h);
    if (used !== 1) throw new Error('freezesUsed=' + used + ', ожидалось 1');
    if (left !== 1) throw new Error('freezesLeft=' + left + ', ожидалось 1');
    // повторный вызов не должен тратить вторую заморозку (детерминированность)
    w.HV.streakOf(h); w.HV.streakOf(h);
    if (w.HV.freezesUsed(h) !== 1) throw new Error('бюджет потёк при повторных вызовах: ' + w.HV.freezesUsed(h));
    w.HV.removeHabit(h.id);
  });
  step('прошлый месяц не тратит текущий бюджет', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Прошлый месяц', emoji: '🗓️', freq: { type: 'daily' }, start: w.HV.D.add(t, -40), freezes: 2 });
    const prev = w.HV.D.add(t, -35);
    for (let i = 40; i >= 32; i--) {                       // заполняем историю, чтобы не было «пустых» дней
      const k = w.HV.D.add(t, -i);
      w.HV.setLog(h.id, k, (k === prev || k === w.HV.D.add(prev, 1)) ? 'miss' : 'done');
    }
    w.HV.save();
    if (w.HV.freezesUsed(h) !== 0) throw new Error('прошлый месяц списал текущий бюджет');
    if (w.HV.freezesLeft(h) !== 2) throw new Error('остаток должен быть 2');
    w.HV.removeHabit(h.id);
  });
  step('стрик не обнуляется, пока сегодня не отметил', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Сегодня ещё не отмечал', emoji: '⏳', freq: { type: 'daily' }, start: w.HV.D.add(t, -5), freezes: 0 });
    for (let i = 5; i >= 1; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.save();
    const st = w.HV.streakOf(h);
    if (st.cur !== 5) throw new Error('ожидался стрик 5 (сегодня ещё можно исправить), получено ' + st.cur);
    w.HV.setLog(h.id, t, 'done'); w.HV.save();
    const after = w.HV.streakOf(h).cur;
    if (after !== 7) throw new Error('после отметки сегодня ожидалось 7 (сегодня + 6 дней), получено ' + after);
    w.HV.removeHabit(h.id);
  });
  step('негативная привычка: создание и бейдж', () => {
    const h = w.HV.newHabit({ name: 'Без кофе', emoji: '☕', neg: true, freq: { type: 'daily' }, start: w.HV.D.today() });
    w.HV.save(); w.HV.go('today'); w.HV.render();
    if (h.neg !== true) throw new Error('флаг neg не выставлен');
    const row = q('.habit[data-id="' + h.id + '"]');
    if (!row) throw new Error('строка не отрисована');
    if (!row.classList.contains('neg')) throw new Error('нет класса .neg');
    if (!row.innerHTML.includes('не делать')) throw new Error('нет бейджа «не делать»');
    w.HV.setLog(h.id, w.HV.D.today(), 'done'); w.HV.save(); w.HV.render();
    if (!q('.habit[data-id="' + h.id + '"]').classList.contains('done')) throw new Error('не отметилось');
    w.HV.removeHabit(h.id);
  });
  step('drag&drop: атрибуты на месте', () => {
    w.HV.go('today'); w.HV.render();
    const rows = qa('#habitList [data-drag]');
    if (!rows.length) throw new Error('нет draggable-строк');
    if (!rows[0].getAttribute('draggable')) throw new Error('draggable не выставлен');
    if (!q('.drag-handle')) throw new Error('нет ручки перетаскивания');
    console.log('     draggable-строк: ' + rows.length);
  });
  step('drag&drop: reorderHabits меняет порядок', () => {
    const before = w.HV.state.habits.filter(h => !h.archived).map(h => h.id);
    if (before.length < 2) throw new Error('нужно минимум 2 привычки');
    w.HV.reorderHabits(1, before[0]);
    const after = w.HV.state.habits.filter(h => !h.archived).map(h => h.id);
    if (after[0] === before[0] && after[1] === before[1]) throw new Error('порядок не изменился');
    w.HV.reorderHabits(-1, after[1]);
  });
  step('виджет заморозок в карточке', () => {
    w.HV.go('today'); w.HV.render();
    if (!q('.streak.freeze')) throw new Error('нет бейджа заморозок');
    if (!/🧊/.test(q('.streak.freeze').textContent)) throw new Error('нет иконки 🧊');
  });
  step('поле «заморозки» в модалке', () => {
    w.habitModal();
    const inp = q('#mFreeze');
    if (!inp) throw new Error('нет поля заморозок');
    inp.value = '5';
    const neg = q('[data-neg="1"]'); if (!neg) throw new Error('нет переключателя типа');
    click(neg);
    if (!q('[data-neg="1"]').classList.contains('on')) throw new Error('тип не переключился');
    q('#mName').value = 'С заморозками'; q('#mName').dispatchEvent(new w.Event('input',{bubbles:true}));
    click(q('[data-tab="sched"]'));
    if (!q('#mFreeze')) throw new Error('поле заморозок пропало после смены вкладки');
    q('#mFreeze').value = '5';
    const before = w.HV.state.habits.length;
    click(q('#mSave'));
    const created = w.HV.state.habits[w.HV.state.habits.length - 1];
    if (w.HV.state.habits.length !== before + 1) throw new Error('не создалась');
    if (created.freezes !== 5) throw new Error('freezes не сохранилось: ' + created.freezes);
    w.HV.removeHabit(created.id);
  });
  step('ачивки freeze/neg7 в справочнике', () => {
    const ids = w.HV.ACHS.map(a => a.id);
    if (!ids.includes('freeze')) throw new Error('нет ачивки freeze');
    if (!ids.includes('neg7')) throw new Error('нет ачивки neg7');
  });
  step('сид содержит негативные привычки', () => {
    w.HV.state = w.HV.blank(); w.HV.seedDemo(); w.HV.save(); w.HV.render();
    const neg = w.HV.state.habits.filter(h => h.neg);
    if (neg.length < 1) throw new Error('в сиде нет негативных привычек');
    console.log('     негативных в сиде: ' + neg.length + ' (' + neg.map(h => h.emoji).join(' ') + ')');
  });

  console.log('\n=== 8c. v1.2: недельная квота, каталог, карточки, реакции ===');
  step('недельная квота: 3 недели зачёта = стрик 3', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Квота 3 из 5', emoji: '🎯', freq: { type: 'weekdays', days: [0,1,2,3,4] },
      start: w.HV.D.add(t, -30), weekGoal: 3, freezes: 0 });
    for (let wk = 3; wk >= 1; wk--) {
      const mon = w.HV.D.add(w.HV.D.add(t, -w.HV.D.dow(t)), -7 * wk);
      [0,1,2].forEach(off => w.HV.setLog(h.id, w.HV.D.add(mon, off), 'done'));
    }
    w.HV.save();
    const st = w.HV.streakOf(h);
    if (st.weekly !== true) throw new Error('не установлен флаг weekly');
    if (st.cur !== 3) throw new Error('ожидался стрик 3 недели, получено ' + st.cur);
    if (st.best !== 3) throw new Error('ожидался рекорд 3, получено ' + st.best);
    w.HV.removeHabit(h.id);
  });
  step('недельная квота: недобор рвёт стрик', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Квота провал', emoji: '🎯', freq: { type: 'weekdays', days: [0,1,2,3,4] },
      start: w.HV.D.add(t, -30), weekGoal: 3, freezes: 0 });
    for (let wk = 3; wk >= 1; wk--) {
      const mon = w.HV.D.add(w.HV.D.add(t, -w.HV.D.dow(t)), -7 * wk);
      const days = wk === 2 ? [0] : [0,1,2];            // неделю назад — только 1 день, квота не закрыта
      days.forEach(off => w.HV.setLog(h.id, w.HV.D.add(mon, off), 'done'));
    }
    w.HV.save();
    const st = w.HV.streakOf(h);
    if (st.cur !== 1) throw new Error('ожидался стрик 1 (недобор рвёт цепочку), получено ' + st.cur);
    if (st.best !== 1) throw new Error('ожидался рекорд 1, получено ' + st.best);
    w.HV.removeHabit(h.id);
  });
  step('weekProgress считает текущую неделю', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Прогресс недели', emoji: '📅', freq: { type: 'daily' }, start: w.HV.D.add(t, -10), weekGoal: 3 });
    const mon = w.HV.D.add(t, -w.HV.D.dow(t));
    w.HV.setLog(h.id, mon, 'done');
    w.HV.save();
    const wp = w.HV.weekProgress(h, t);
    if (wp.goal !== 3) throw new Error('goal=' + wp.goal);
    if (wp.done < 1) throw new Error('done=' + wp.done);
    if (wp.from !== mon) throw new Error('неделя начинается не с понедельника: ' + wp.from + ' vs ' + mon);
    if (wp.isCurrent !== true) throw new Error('isCurrent должен быть true');
    w.HV.removeHabit(h.id);
  });
  step('привычка без квоты считает стрик днями', () => {
    const t = w.HV.D.today();
    const h = w.HV.newHabit({ name: 'Обычная', emoji: '✅', freq: { type: 'daily' }, start: w.HV.D.add(t, -6), freezes: 0 });
    for (let i = 6; i >= 1; i--) w.HV.setLog(h.id, w.HV.D.add(t, -i), 'done');
    w.HV.save();
    const st = w.HV.streakOf(h);
    if (st.weekly) throw new Error('не должно быть weekly');
    if (st.cur !== 6) throw new Error('ожидался стрик 6, получено ' + st.cur);
    w.HV.removeHabit(h.id);
  });
  step('поле недельной цели в модалке', () => {
    w.habitModal();
    const inp = q('#mWeekGoal'); if (!inp) throw new Error('нет поля');
    click(q('[data-tab="sched"]'));
    if (!q('#mWeekGoal')) throw new Error('поле пропало на вкладке расписания');
    const chip = q('[data-wg="3"]'); if (!chip) throw new Error('нет пресета «3 из 7»');
    click(chip);
    q('#mName').value = 'С недельной целью'; q('#mName').dispatchEvent(new w.Event('input',{bubbles:true}));
    const before = w.HV.state.habits.length;
    click(q('#mSave'));
    const created = w.HV.state.habits[w.HV.state.habits.length - 1];
    if (w.HV.state.habits.length !== before + 1) throw new Error('не создалась');
    if (created.weekGoal !== 3) throw new Error('weekGoal не сохранилось: ' + created.weekGoal);
    w.HV.removeHabit(created.id);
  });
  step('каталог: открывается и содержит пресеты', () => {
    if (!Array.isArray(w.HV.PRESETS) || w.HV.PRESETS.length < 5) throw new Error('PRESETS пуст');
    const total = w.HV.PRESETS.reduce((n, g) => n + g.items.length, 0);
    if (total < 20) throw new Error('мало пресетов: ' + total);
    w.HV.catalogSheet();
    if (q('#sheetRoot').hidden) throw new Error('sheet не открылся');
    const n = qa('.preset').length;
    if (n < 20) throw new Error('в каталоге ' + n + ' карточек');
    console.log('     пресетов в каталоге: ' + total + ', групп: ' + w.HV.PRESETS.length);
    q('#sheetRoot').hidden = true;
  });
  step('каталог: добавление привычки кликом', () => {
    q('#sheetRoot').hidden = false;
    w.HV.catalogSheet();
    const before = w.HV.state.habits.length;
    const card = q('.preset'); if (!card) throw new Error('нет карточек');
    const name = card.querySelector('b').textContent.trim();
    click(card);
    if (w.HV.state.habits.length !== before + 1) throw new Error('привычка не добавилась');
    if (!w.HV.state.habits.some(h => h.name === name)) throw new Error('добавилась не та привычка');
    q('#sheetRoot').hidden = true;
  });
  step('каталог: повторное добавление блокируется', () => {
    const name = w.HV.state.habits[w.HV.state.habits.length - 1].name;
    q('#sheetRoot').hidden = false;
    w.HV.catalogSheet();
    const before = w.HV.state.habits.length;
    const card = [...qa('.preset')].find(c => c.querySelector('b').textContent.trim().startsWith(name));
    if (!card) throw new Error('не нашёл карточку ' + name);
    click(card);
    if (w.HV.state.habits.length !== before) throw new Error('дубликат создался');
    q('#sheetRoot').hidden = true;
  });
  step('поиск по каталогу', () => {
    q('#sheetRoot').hidden = false;
    // ⚠️ в каталоге «Стакан воды» и «2 литра воды» — запрос «вода» не найдёт ничего (вода ≠ воды)
    w.HV.catalogSheet('воды');
    const n = qa('.preset').length;
    if (n !== 2) throw new Error('по запросу «воды» ожидалось 2 карточки, получено ' + n);
    console.log('     по запросу «воды» найдено: ' + n);
    q('#sheetRoot').hidden = true;

    q('#sheetRoot').hidden = false;
    w.HV.catalogSheet('пробежка');
    if (qa('.preset').length !== 1) throw new Error('по «пробежка» ожидалась 1 карточка');
    q('#sheetRoot').hidden = false;
    w.HV.catalogSheet('');                            // пустой запрос = весь каталог
    const all = qa('.preset').length;
    if (all < 25) throw new Error('пустой запрос должен показывать весь каталог, получено ' + all);
    console.log('     полный каталог: ' + all + ' карточек');
    q('#sheetRoot').hidden = true;
  });
  step('поиск по каталогу: пустой результат', () => {
    q('#sheetRoot').hidden = false;
    w.HV.catalogSheet('zzz-такого-нет');
    if (qa('.preset').length !== 0) throw new Error('нашлось то, чего нет');
    if (!q('#catList').textContent.includes('Ничего не нашлось')) throw new Error('нет пустого состояния');
    q('#sheetRoot').hidden = true;
  });

  step('карточка привычки: открывается и рисуется', () => {
    q('#sheetRoot').hidden = false;
    const h = w.HV.state.habits.find(x => !x.archived);
    w.eval('HV.shareSheet("habit", { habit: HV.state.habits.find(x => !x.archived) })');
    if (q('#sheetRoot').hidden) throw new Error('sheet не открылся');
    const cv = q('#shareCanvas'); if (!cv) throw new Error('нет canvas');
    if (cv.width < 100) throw new Error('canvas не отрисован: ' + cv.width);
    const txt = w.HV.shareText('habit', { habit: h });
    if (!txt.includes(h.name)) throw new Error('в тексте нет названия');
    if (!/🔥/.test(txt)) throw new Error('в тексте нет стрика');
    q('#sheetRoot').hidden = true;
  });
  step('карточка недели: открывается и рисуется', () => {
    q('#sheetRoot').hidden = false;
    w.eval('HV.shareSheet("week", {})');
    const cv = q('#shareCanvas'); if (!cv) throw new Error('нет canvas');
    if (cv.width < 100) throw new Error('canvas не отрисован');
    const txt = w.HV.shareText('week', {});
    if (!/недел/i.test(txt) && !/НЕДЕЛЯ/i.test(txt)) throw new Error('в тексте нет слова «неделя»');
    q('#sheetRoot').hidden = true;
  });
  step('кнопка «Итог недели» на странице Сегодня', () => {
    w.HV.go('today'); w.HV.render();
    const b = q('#btnShareWeek'); if (!b) throw new Error('нет кнопки');
    click(b);
    if (q('#sheetRoot').hidden) throw new Error('не открылось');
    q('#sheetRoot').hidden = true;
  });
  step('реакции: поставить и снять', () => {
    w.HV.go('feed'); w.HV.render();
    if (!w.HV.state.feed.length) throw new Error('лента пуста');
    const fid = w.HV.state.feed[0].id;
    w.HV.reactTo(fid, '🔥');
    let r = w.HV.state.reactions[fid];
    if (!r || !r['🔥'] || !r['🔥'].includes('me')) throw new Error('реакция не поставилась: ' + JSON.stringify(r));
    w.HV.reactTo(fid, '🔥');
    if (w.HV.state.reactions[fid]) throw new Error('реакция не снялась');
  });
  step('реакции: несколько эмодзи и счётчики в DOM', () => {
    w.HV.go('feed'); w.HV.render();
    const fid = w.HV.state.feed[0].id;
    w.HV.reactTo(fid, '👏'); w.HV.reactTo(fid, '💪');
    const r = w.HV.state.reactions[fid];
    if (!r['👏'] || !r['💪']) throw new Error('не обе реакции записаны');
    w.HV.render();
    const btns = qa('[data-react]');
    if (!btns.length) throw new Error('кнопки реакций не отрисованы');
    const on = qa('[data-react].on').length;
    if (on !== 2) throw new Error('ожидалось 2 активные реакции в DOM, получено ' + on);
    delete w.HV.state.reactions[fid]; w.HV.save();
  });
  step('touch drag&drop: ручки на месте', () => {
    w.HV.go('today'); w.HV.render();
    const handles = qa('[data-handle]');
    if (!handles.length) throw new Error('нет ручек data-handle');
    if (handles.length !== qa('[data-drag]').length) throw new Error('ручек меньше, чем строк');
    console.log('     ручек перетаскивания: ' + handles.length);
  });

  console.log('\n=== 9. Мелочи ===');
  step('цитата', () => { click(q('#btnQuote')); if (q('#quotePop').hidden) throw new Error('не открылась'); click(q('#qNext')); q('#quotePop').hidden = true; });
  step('фильтры привычек', () => { w.HV.go('today'); ['due','done','left','arch','all'].forEach(f => click(q('[data-filter="' + f + '"]'))); });
  step('поиск', () => { const s = q('#globalSearch'); s.value = 'вода'; s.dispatchEvent(new w.Event('input',{bubbles:true}));
    s.value = 'zzz'; s.dispatchEvent(new w.Event('input',{bubbles:true}));
    s.value = ''; s.dispatchEvent(new w.Event('input',{bubbles:true})); });
  step('горячие клавиши', () => { ['1','2','3','4','5','6','7'].forEach(k => w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key:k, bubbles:true})));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key:'n', bubbles:true})); q('#modalRoot').hidden = true;
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', {key:'Escape', bubbles:true})); });
  step('кнопка темы в сайдбаре', () => { click(q('#btnTheme')); });
  step('быстрое добавление', () => { click(q('#btnQuickAdd')); if (q('#modalRoot').hidden) throw new Error('не открылась'); q('#modalRoot').hidden = true; });
  step('бейдж «осталось»', () => { w.HV.go('today'); console.log('     badge: ' + (q('#navBadgeToday').hidden ? 'скрыт' : q('#navBadgeToday').textContent)); });
  step('симуляция активности', () => { w.HV.go('feed'); const before = w.HV.state.feed.length; click(q('#btnSimAct'));
    if (w.HV.state.feed.length <= before) throw new Error('не добавилось'); });
  setTimeout(() => {
  step('localStorage persist', () => { const raw = w.localStorage.getItem('habitverse.v1'); if (!raw) throw new Error('пусто');
    const p = JSON.parse(raw); if (!p.habits.length) throw new Error('нет привычек');
    console.log('     размер: ' + (raw.length/1024).toFixed(1) + ' КБ, ключей логов: ' + Object.keys(p.logs).length); });
  step('битых ссылок в DOM нет', () => { const bad = qa('[class*="undefined"], [style*="undefined"]'); if (bad.length) throw new Error('undefined в разметке: ' + bad.length); });
  step('нет NaN в тексте', () => { const t = q('#pages').textContent; if (/NaN/.test(t)) throw new Error('NaN найден'); });
    console.log('\n=== ИТОГ ===');
    if (errors.length) { console.log('ОШИБОК: ' + errors.length); errors.slice(0, 30).forEach(e => console.log('  - ' + e)); process.exit(1); }
    console.log('ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ'); process.exit(0);
  }, 500);
}, 500);
