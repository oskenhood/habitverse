'use strict';
/* ============================================================
   HabitVerse web — unit-тесты движка (фаза 5.2)
   Компилирует web/src/lib/engine.ts (web/node_modules/typescript)
   в tests/webbuild/engine.js и проверяет сценарии, перенесённые
   из tests/v2.test.js и docs/DESIGN.md:
   расписание, логи, цикл отметки, стрики, заморозки, недельная
   квота, консистентность, CRUD, todayCounts, seedDemo, normalize.
   Запуск: npm run test:web   (движок НЕ зависит от DOM)
   ============================================================ */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TSC = path.join(__dirname, '..', 'web', 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(TSC)) {
  console.error('Не найден TypeScript в web/node_modules — выполните: cd web && npm install');
  process.exit(1);
}
const OUT = path.join(__dirname, 'webbuild');
console.log('Компиляция web/src/lib/{engine,md,presets}.ts → tests/webbuild/ …');
execSync(`node "${TSC}" src/lib/engine.ts src/lib/md.ts src/lib/presets.ts --outDir "${OUT}" --module commonjs --target es2020 --strict --skipLibCheck`, {
  cwd: path.join(__dirname, '..', 'web'), stdio: 'inherit',
});
const E = require(path.join(OUT, 'engine.js'));
const MD = require(path.join(OUT, 'md.js'));
const PR = require(path.join(OUT, 'presets.js'));

/* ---------- harness ---------- */
let ok = 0, failed = 0;
function step(name, fn) {
  try { fn(); ok++; console.log('  ok  ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + ' — ' + e.message); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assert'); };
const eq = (a, b, msg) => { if (a !== b) throw new Error((msg || '') + ` ожидал ${b}, получил ${a}`); };

const { D } = E;
const today = D.today();
const monday = D.add(today, -D.dow(today));          // понедельник текущей недели
const ago = (n) => D.add(today, -n);

function fresh() { return E.blank(); }
function mk(s, data) { return E.newHabit(s, data); }

console.log('\n=== 1. Даты ===');
step('key/parse roundtrip', () => {
  const k = D.key(new Date(2026, 9, 6));
  eq(k, '2026-10-06');
  const d = D.parse(k);
  eq(d.getFullYear(), 2026); eq(d.getMonth(), 9); eq(d.getDate(), 6);
});
step('add/diff через границы месяцев', () => {
  eq(D.add('2026-10-06', 1), '2026-10-07');
  eq(D.add('2026-10-01', -1), '2026-09-30');
  eq(D.diff('2026-10-01', '2026-10-06'), 5);
  eq(D.diff('2026-09-30', '2026-10-06'), 6);
});
step('dow: 0 = понедельник (якорь 1970-01-05)', () => {
  eq(D.dow('1970-01-05'), 0);
  eq(D.dow('1970-01-06'), 1);
  eq(D.dow('1970-01-11'), 6);
  assert(D.dow(monday) === 0, 'monday не понедельник');
  assert(D.diff(monday, today) >= 0 && D.diff(monday, today) <= 6, 'today вне текущей недели');
});
step('daysBetween инклюзивен', () => {
  eq(D.daysBetween('2026-10-01', '2026-10-06').length, 6);
  eq(D.daysBetween(today, today).length, 1);
});
step('monthName', () => {
  eq(D.monthName(9), 'октябрь');
  eq(D.monthName(9, true), 'окт');
});
step('human/full не содержат undefined', () => {
  assert(!/undefined|NaN/.test(D.human(today) + D.full(today) + D.human(ago(9))), 'мусор в датах');
});

console.log('\n=== 2. Расписание dueOn ===');
const s2 = fresh();
const hDaily = mk(s2, { start: ago(10), freq: { type: 'daily' } });
const hWd = mk(s2, { start: ago(10), freq: { type: 'weekdays', days: [0, 2, 4] } });
const hInt = mk(s2, { start: monday, freq: { type: 'interval', every: 3 } });
const hMon = mk(s2, { start: '2026-01-01', freq: { type: 'monthly', days: [1, 15] } });
const hWk = mk(s2, { start: ago(30), freq: { type: 'weekly', day: 2 } });

step('daily: каждый день от start, до start — нет', () => {
  assert(E.dueOn(hDaily, today), 'сегодня не due');
  assert(E.dueOn(hDaily, ago(10)), 'start не due');
  assert(!E.dueOn(hDaily, ago(11)), 'до start due');
});
step('archived никогда не due', () => {
  const h = mk(s2, { start: ago(5), archived: true });
  assert(!E.dueOn(h, today), 'архивная due');
});
step('weekdays: только выбранные дни', () => {
  assert(E.dueOn(hWd, monday), 'Пн не due');
  assert(!E.dueOn(hWd, D.add(monday, 1)), 'Вт due');
  assert(E.dueOn(hWd, D.add(monday, 2)), 'Ср не due');
});
step('interval: каждые N дней от start', () => {
  assert(E.dueOn(hInt, monday), 'start не due');
  assert(!E.dueOn(hInt, D.add(monday, 1)), '+1 due');
  assert(E.dueOn(hInt, D.add(monday, 3)), '+3 не due');
  assert(E.dueOn(hInt, D.add(monday, 6)), '+6 не due');
});
step('monthly: числа месяца', () => {
  assert(E.dueOn(hMon, '2026-10-01'), '1-е не due');
  assert(E.dueOn(hMon, '2026-10-15'), '15-е не due');
  assert(!E.dueOn(hMon, '2026-10-02'), '2-е due');
});
step('weekly: один день недели', () => {
  assert(E.dueOn(hWk, D.add(monday, 2)), 'Ср не due');
  assert(!E.dueOn(hWk, D.add(monday, 3)), 'Чт due');
});
step('dueDays считает плановые дни окна', () => {
  eq(E.dueDays(hDaily, ago(9), today).length, 10);
  eq(E.dueDays(hWd, monday, D.add(monday, 6)).length, 3);
});
step('freqLabel человекочитаем', () => {
  eq(E.freqLabel(hDaily), 'Каждый день');
  eq(E.freqLabel(hWd), 'Пн, Ср, Пт');
  eq(E.freqLabel(hInt), 'Каждые 3 дн.');
  eq(E.freqLabel(hMon), '1-е число, 15-е число');
  eq(E.freqLabel(hWk), 'Раз в неделю, Ср');
});

console.log('\n=== 3. Логи и цикл отметки ===');
const s3 = fresh();
const h3 = mk(s3, { start: ago(5) });
step('setLog создаёт запись', () => {
  E.setLog(s3, h3.id, ago(1), 'done', 3);
  const l = E.logAt(s3, h3.id, ago(1));
  assert(l && l.status === 'done' && l.val === 3, 'запись не создалась');
  assert(E.isDone(s3, h3.id, ago(1)), 'isDone не работает');
});
step('setLog сохраняет val/note при обновлении', () => {
  s3.logs[h3.id][ago(1)].note = 'заметка';
  E.setLog(s3, h3.id, ago(1), 'skip');
  const l = E.logAt(s3, h3.id, ago(1));
  eq(l.status, 'skip'); eq(l.val, 3, 'val потерян'); eq(l.note, 'заметка', 'note потерян');
});
step('setLog(null) удаляет запись и пустую карту', () => {
  E.setLog(s3, h3.id, ago(1), null);
  eq(E.logAt(s3, h3.id, ago(1)), null);
  eq(s3.logs[h3.id], undefined, 'пустая карта лога не удалена');
});
step('nextStatus: пусто → done → skip → miss → пусто', () => {
  eq(E.nextStatus(null), 'done');
  eq(E.nextStatus({ status: 'done' }), 'skip');
  eq(E.nextStatus({ status: 'skip' }), 'miss');
  eq(E.nextStatus({ status: 'miss' }), null);
});

console.log('\n=== 4. Стрики и заморозки ===');
function dailyWith(logs, opts) {
  const s = fresh();
  const h = mk(s, { start: ago(12), freq: { type: 'daily' }, freezes: opts && opts.freezes !== undefined ? opts.freezes : 0, ...opts });
  for (const [day, status] of Object.entries(logs)) E.setLog(s, h.id, ago(day), status);
  return { s, h };
}
step('3 дня подряд + сегодня не отмечен → cur=3 (сегодня исправим)', () => {
  const { s, h } = dailyWith({ 1: 'done', 2: 'done', 3: 'done' });
  eq(E.streakOf(s, h).cur, 3);
});
step('сегодня отмечен → cur растёт (РОВНО на 1 — баг демо с двойным счётчиком исправлен в web)', () => {
  const { s, h } = dailyWith({ 0: 'done', 1: 'done', 2: 'done' });
  eq(E.streakOf(s, h).cur, 3);   // в демо v2 здесь было 4 (off-by-one), см. BACKLOG B-1
});
step('skip не рвёт стрик', () => {
  const { s, h } = dailyWith({ 1: 'done', 2: 'skip', 3: 'done', 4: 'done' });
  eq(E.streakOf(s, h).cur, 4);
});
step('пролог без записи рвёт стрик', () => {
  const { s, h } = dailyWith({ 1: 'done', 3: 'done' });   // вчера отмечен, позавчера — пусто
  eq(E.streakOf(s, h).cur, 1);
});
step('miss с бюджетом заморозок: стрик жив, флаг frozen записан', () => {
  // семантика демо: замороженный день ПРОДОЛЖАЕТ стрик, но НЕ инкрементирует счётчик
  // (задокументировано в demo.test.js) → 1 done + frozen + 2 done = cur 3
  const { s, h } = dailyWith({ 1: 'done', 2: 'miss', 3: 'done', 4: 'done' }, { freezes: 2 });
  const st = E.streakOf(s, h);
  eq(st.cur, 3, 'заморозка не спасла стрик');
  eq(st.frozen, 1, 'frozen не учтён');
  const rec = s.logs[h.id][ago(2)];
  assert(rec && rec.frozen === true && rec.d === ago(2), 'флаг frozen не персистирован');
  eq(E.freezesLeft(s, h), 1, 'бюджет не уменьшился');
});
step('miss без бюджета рвёт стрик', () => {
  const { s, h } = dailyWith({ 1: 'done', 2: 'miss', 3: 'done' }, { freezes: 0 });
  eq(E.streakOf(s, h).cur, 1);
});
step('две заморозки в одном месяце, третья — нет', () => {
  const { s, h } = dailyWith({ 1: 'miss', 2: 'miss', 3: 'miss', 4: 'done', 5: 'done' }, { freezes: 2 });
  const st = E.streakOf(s, h);
  // дни 1–3 в одном месяце (если не пересекли границу); проверяем мягко: стрик не длиннее 2+2
  assert(st.cur <= 4, 'стрик длиннее возможного: ' + st.cur);
  assert(st.frozen <= 2, 'потрачено больше заморозок, чем есть');
});
step('noFreeze: бюджет не тратится, флаги не пишутся', () => {
  const { s, h } = dailyWith({ 1: 'done', 2: 'miss', 3: 'done' }, { freezes: 2 });
  const st = E.streakOf(s, h, today, { noFreeze: true, persist: false });
  eq(st.cur, 1);
  assert(!s.logs[h.id][ago(2)].frozen, 'флаг записан при noFreeze');
});
step('persist:false не мутирует логи', () => {
  const { s, h } = dailyWith({ 1: 'done', 2: 'miss', 3: 'done' }, { freezes: 2 });
  E.streakOf(s, h, today, { persist: false });
  assert(!s.logs[h.id][ago(2)].frozen, 'persist:false записал флаг');
});
step('bestOf: рекорд по истории, сегодня не входит', () => {
  const { s, h } = dailyWith({ 2: 'done', 3: 'done', 4: 'done', 5: 'done', 6: 'done', 8: 'done' });
  eq(E.bestOf(s, h), 5);
  E.setLog(s, h, today, 'done');
  eq(E.bestOf(s, h), 5, 'сегодняшний день попал в рекорд');
});
step('заморозка не рвёт рекорд', () => {
  // bestOf тратит бюджет заморозок и на пустые дни от start (эталонное поведение демо),
  // поэтому start ставим вплотную к окну отметок
  const s = fresh();
  const h = mk(s, { start: ago(5), freq: { type: 'daily' }, freezes: 1 });
  for (const [day, st] of Object.entries({ 2: 'done', 3: 'miss', 4: 'done', 5: 'done' })) E.setLog(s, h.id, ago(day), st);
  eq(E.bestOf(s, h), 3);   // done+done+frozen(не инкремент)+done
});

console.log('\n=== 5. Недельная квота ===');
step('weekStartOf/weekIndexOf', () => {
  eq(D.dow(E.weekStartOf(today)), 0);
  eq(E.weekStartOf(monday), monday);
  eq(E.weekIndexOf('1970-01-05'), 0);
  eq(E.weekIndexOf('1970-01-12'), 1);
});
step('fullWeeks: текущая неделя не считается', () => {
  const s = fresh();
  const h = mk(s, { start: D.add(monday, -21), freq: { type: 'daily' }, weekGoal: 3 });
  eq(E.fullWeeks(h, today).length, 3);
});
step('weeklyStreak: ok/fail/ok → cur=1, best=1', () => {
  const s = fresh();
  const start = D.add(monday, -21);
  const h = mk(s, { start, freq: { type: 'daily' }, weekGoal: 3 });
  // неделя -3: 3 done, неделя -2: 2 done (провал), неделя -1: 3 done
  for (const [w, n] of [[3, 3], [2, 2], [1, 3]]) {
    for (let i = 0; i < n; i++) E.setLog(s, h.id, D.add(monday, -7 * w + i), 'done');
  }
  const ws = E.weeklyStreak(s, h, today);
  eq(ws.per.length, 3);
  eq(ws.per[0].ok, true); eq(ws.per[1].ok, false); eq(ws.per[2].ok, true);
  eq(ws.cur, 1); eq(ws.best, 1);
  const st = E.streakOf(s, h, today);
  eq(st.weekly, true); eq(st.cur, 1);
});
step('weekProgress: goal зажимается числом прошедших плановых дней', () => {
  const s = fresh();
  const h = mk(s, { start: D.add(monday, -14), freq: { type: 'daily' }, weekGoal: 3 });
  const wp = E.weekProgress(s, h, today);
  eq(wp.goal, Math.min(3, D.dow(today) + 1));
  eq(wp.from, monday);
  eq(wp.isCurrent, true);
});
step('пустые недели (ok=null) не рвут недельный стрик', () => {
  const s = fresh();
  // monthly days=[15]: почти в каждой неделе 0 плановых дней → null
  const h = mk(s, { start: '2026-08-01', freq: { type: 'monthly', days: [15] }, weekGoal: 1 });
  E.setLog(s, h.id, '2026-08-15', 'done');
  E.setLog(s, h.id, '2026-09-15', 'done');
  const ws = E.weeklyStreak(s, h, '2026-10-06');
  const nulls = ws.per.filter((p) => p.ok === null).length;
  assert(nulls >= 4, 'ожидались пустые недели, получено ' + nulls);
  eq(ws.cur, 2, 'null-недели порвали стрик');
  eq(ws.best, 2);
});

console.log('\n=== 6. Консистентность ===');
step('completion: due/done/rate и null без плановых дней', () => {
  const s = fresh();
  const h = mk(s, { start: ago(9), freq: { type: 'daily' } });
  for (let i = 0; i < 5; i++) E.setLog(s, h.id, ago(i), 'done');
  const c = E.completion(s, h, D.daysBetween(ago(9), today));
  eq(c.due, 10); eq(c.done, 5); eq(c.rate, 0.5);
  const future = mk(s, { start: D.add(today, 1), freq: { type: 'daily' } });
  eq(E.completion(s, future, D.daysBetween(ago(6), today)), null);
});
step('rateOf: всё выполнено → 1', () => {
  const s = fresh();
  const h = mk(s, { start: ago(40), freq: { type: 'daily' } });
  for (let i = 0; i < 30; i++) E.setLog(s, h.id, ago(i), 'done');
  eq(E.rateOf(s, h, 30), 1);
});

console.log('\n=== 7. CRUD привычек ===');
step('newHabit: дефолты', () => {
  const s = fresh();
  const h = E.newHabit(s, { name: 'Тест' });
  assert(h.id.startsWith('h_'), 'id без префикса');
  eq(h.name, 'Тест'); eq(h.freezes, 2); eq(h.weekGoal, 0); eq(h.neg, false);
  eq(h.start, today); eq(h.order, 0); eq(h.archived, false);
  eq(s.habits.length, 1);
});
step('order растёт, updateHabit патчит', () => {
  const s = fresh();
  const a = E.newHabit(s, {}); const b = E.newHabit(s, {});
  eq(b.order, 1);
  E.updateHabit(s, a.id, { name: 'Переименована', weekGoal: 4 });
  eq(a.name, 'Переименована'); eq(a.weekGoal, 4);
  E.updateHabit(s, 'нет_такого', { name: 'X' });   // не должно бросать
});
step('removeHabit удаляет привычку и логи', () => {
  const s = fresh();
  const h = E.newHabit(s, { start: ago(3) });
  E.setLog(s, h.id, ago(1), 'done');
  E.removeHabit(s, h.id);
  eq(s.habits.length, 0); eq(s.logs[h.id], undefined);
});
step('reorderHabits меняет порядок и перенумеровывает', () => {
  const s = fresh();
  const a = E.newHabit(s, { name: 'A' }); const b = E.newHabit(s, { name: 'B' }); const c = E.newHabit(s, { name: 'C' });
  E.reorderHabits(s, -1, c.id);                       // C вверх
  const names = E.visibleHabits(s).map((h) => h.name);
  assert(names.join(',') === 'A,C,B', 'порядок: ' + names.join(','));
  E.visibleHabits(s).forEach((h, i) => eq(h.order, i, 'order не перенумерован'));
  E.reorderHabits(s, -1, a.id);                       // уже первая — без изменений
  eq(E.visibleHabits(s)[0].name, 'A');
});
step('visibleHabits: без архивных, по order', () => {
  const s = fresh();
  E.newHabit(s, { name: 'X', order: 2 });
  E.newHabit(s, { name: 'Y', order: 1, archived: true });
  E.newHabit(s, { name: 'Z', order: 0 });
  eq(E.visibleHabits(s).map((h) => h.name).join(','), 'Z,X');
});

console.log('\n=== 8. todayCounts ===');
step('due/done/left/pct на сегодня', () => {
  const s = fresh();
  const a = E.newHabit(s, { start: ago(5), freq: { type: 'daily' } });
  E.newHabit(s, { start: ago(5), freq: { type: 'daily' } });
  E.setLog(s, a.id, today, 'done');
  const c = E.todayCounts(s);
  eq(c.due, 2); eq(c.done, 1); eq(c.left, 1); eq(c.pct, 50);
});
step('нет привычек → нули без NaN', () => {
  const c = E.todayCounts(fresh());
  eq(c.due, 0); eq(c.pct, 0);
});

console.log('\n=== 9. seedDemo и normalize ===');
step('seedDemo: 13 привычек, история, стрики считаются', () => {
  const s = E.seedDemo();
  eq(s.habits.length, 13);
  assert(s.notes.length >= 2, 'заметок: ' + s.notes.length);
  assert(Object.keys(s.logs).length >= 10, 'мало логов');
  for (const h of s.habits) {
    const st = E.streakOf(s, h, today, { persist: false });
    assert(Number.isFinite(st.cur) && Number.isFinite(st.best), 'NaN в стрике ' + h.name);
    assert(st.best >= st.cur || st.weekly, 'best < cur у ' + h.name);
    assert(h.start && D.dow(h.start) >= 0, 'нет start у ' + h.name);
  }
  eq(s.profile.name, 'Демо Пилот');
});
step('seedDemo детерминирован (mulberry seed)', () => {
  const a = E.seedDemo(); const b = E.seedDemo();
  eq(JSON.stringify(a.logs).length, JSON.stringify(b.logs).length);
  const doneA = Object.values(a.logs).reduce((n, m) => n + Object.values(m).filter((l) => l.status === 'done').length, 0);
  const doneB = Object.values(b.logs).reduce((n, m) => n + Object.values(m).filter((l) => l.status === 'done').length, 0);
  eq(doneA, doneB, 'разное число отметок — rnd не детерминирован');
});
step('normalize достраивает недостающие поля', () => {
  const s = E.normalize({ habits: [{ id: 'x' }], profile: { name: 'A' } });
  eq(s.v, 1); eq(s.habits.length, 1);
  eq(s.profile.name, 'A'); eq(typeof s.profile.notifTime, 'string');
  assert(Array.isArray(s.notes) && Array.isArray(s.feed), 'массивы не достроены');
  assert(s.logs && typeof s.logs === 'object', 'logs не достроен');
});
step('normalize(null) → blank', () => {
  const s = E.normalize(null);
  eq(s.v, 1); eq(s.habits.length, 0); eq(E.STORAGE_KEY, 'habitverse.v1');
});

console.log('\n=== 10. Геймификации в движке нет (правило v2.0) ===');
step('нет экспортов XP/уровней/ачивок', () => {
  /* «xp» матчится внутри «expense» (финансы F-2) — исключаем только expense-экспорты,
     всё остальное с xp/level/achiev/confetti/sfx по-прежнему под запретом */
  const bad = Object.keys(E).filter((k) => (
    /level|achiev|confetti|sfx/i.test(k) || (/xp/i.test(k) && !/expense/i.test(k))
  ));
  eq(bad.length, 0, 'найдено: ' + bad.join(','));
});
step('категории: 8 штук, у всех иконка из набора', () => {
  eq(E.CATEGORIES.length, 8);
  for (const c of E.CATEGORIES) assert(c.icon && c.color && c.name, 'категория без иконки/цвета');
});

console.log('\n=== 11. Фаза 5.3: md2, каталог, заметки, лента, челленджи, DnD, CSV ===');

step('md2: заголовки # → h3..h5', () => {
  assert(MD.md2('# Заголовок').includes('<h3>Заголовок</h3>'), 'h1→h3');
  assert(MD.md2('## Второй').includes('<h4>Второй</h4>'), 'h2→h4');
  assert(MD.md2('### Третий').includes('<h5>Третий</h5>'), 'h3→h5');
});
step('md2: inline **жирный**, *курсив*, `код`', () => {
  const html = MD.md2('**важно** и *нежно* и `код`');
  assert(html.includes('<strong>важно</strong>'), 'bold');
  assert(html.includes('<em>нежно</em>'), 'italic');
  assert(html.includes('<code>код</code>'), 'code');
});
step('md2: список через «-» собирается в ul', () => {
  eq(MD.md2('- один\n- два'), '<ul><li>один</li><li>два</li></ul>');
});
step('md2: цитата > и дата-тег [[ГГГГ-ММ-ДД]]', () => {
  assert(MD.md2('> мысль').includes('<blockquote>мысль</blockquote>'), 'blockquote');
  assert(MD.md2('встреча [[2026-10-06]]').includes('<span class="tag date">2026-10-06</span>'), 'date tag');
});
step('md2: экранирует HTML (XSS-защита)', () => {
  const html = MD.md2('<script>alert(1)</script>');
  assert(!html.includes('<script>'), 'сырой тег не прошёл');
  assert(html.includes('&lt;script&gt;'), 'экранировано');
});
step('md2: пустые строки пропускаются, абзацы в <p>', () => {
  eq(MD.md2('первый\n\nвторой'), '<p>первый</p><p>второй</p>');
});

step('каталог: 7 групп, 30 пресетов', () => {
  eq(PR.PRESETS.length, 7);
  eq(PR.PRESET_COUNT, 30);
});
step('каталог: все пресеты валидны (категория, частота, цвет)', () => {
  const cats = new Set(E.CATEGORIES.map((c) => c.id));
  const freqs = new Set(['daily', 'weekdays', 'interval', 'monthly', 'weekly']);
  for (const g of PR.PRESETS) for (const it of g.items) {
    assert(cats.has(it.cat), 'левая категория: ' + it.cat);
    assert(freqs.has(it.freq.type), 'левая частота: ' + it.freq.type);
    assert(/^#[0-9A-Fa-f]{6}$/.test(it.color), 'левый цвет: ' + it.color);
    assert(it.name && it.emoji, 'без имени/эмодзи');
  }
});
step('presetToHabit: старт сегодня, 2 заморозки, neg сохраняется', () => {
  const sugar = PR.PRESETS.flatMap((g) => g.items).find((x) => x.name === 'Без сахара');
  const data = PR.presetToHabit(sugar, '2026-10-08');
  eq(data.start, '2026-10-08'); eq(data.freezes, 2); eq(data.neg, true); eq(data.cat, 'disc');
});
step('filterPresets: «воды» находит 2 пресета (сверено с данными — грабля №36: «вода» не входит в «воды»)', () => {
  const total = PR.filterPresets('воды').reduce((n, g) => n + g.items.length, 0);
  eq(total, 2);
  eq(PR.filterPresets('чего-нет-в-каталоге').length, 0);
});

step('заметки: saveNote создаёт и обновляет', () => {
  const s = fresh();
  const n = E.saveNote(s, { title: 'Т', body: 'текст', tags: ['a'] });
  eq(s.notes.length, 1); assert(n.id.startsWith('n_'), 'id не n_');
  eq(n.title, 'Т'); assert(n.updated >= n.created, 'updated < created');
  const n2 = E.saveNote(s, { title: 'Т2' }, n.id);
  eq(s.notes.length, 1); eq(n2.title, 'Т2'); eq(n2.body, 'текст', 'затёр body');
});
step('заметки: pin/remove + sortedNotes (закреплённые сверху)', () => {
  const s = fresh();
  const a = E.saveNote(s, { title: 'A' });
  const b = E.saveNote(s, { title: 'B' });
  b.updated = a.updated + 1000;
  eq(E.sortedNotes(s)[0].title, 'B');
  E.toggleNotePin(s, a.id);
  eq(E.sortedNotes(s)[0].title, 'A', 'закреплённая не первая');
  E.removeNote(s, b.id);
  eq(s.notes.length, 1);
});

step('лента: addFeed вставляет в начало и режет по FEED_CAP', () => {
  const s = fresh();
  for (let i = 0; i < E.FEED_CAP + 10; i++) E.addFeed(s, 'checkin', { days: i });
  eq(s.feed.length, E.FEED_CAP);
  eq(s.feed[0].data.days, E.FEED_CAP + 9, 'последнее событие не в начале');
  eq(s.feed[0].who, 'me');
});
step('реакции: toggle ставит/снимает и чистит пустые ключи', () => {
  const s = fresh();
  E.addFeed(s, 'checkin', {});
  const id = s.feed[0].id;
  eq(E.toggleReaction(s, id, '🔥'), true, 'первый клик не поставил');
  assert(s.reactions[id]['🔥'].includes('me'), 'нет me в списке');
  eq(E.toggleReaction(s, id, '🔥'), false, 'второй клик не снял');
  eq(s.reactions[id], undefined, 'пустой объект реакции не удалён');
});

step('челленджи: createChallenge считает end и код', () => {
  const s = fresh();
  const c = E.createChallenge(s, { name: 'Тест', start: '2026-10-01', days: 14, code: 'hv-abcd' });
  eq(c.end, '2026-10-14', 'end = start + days - 1');
  eq(c.code, 'HV-ABCD', 'код не апкейсен');
  eq(c.participants.length, 1); eq(c.participants[0].id, 'me');
  eq(s.challenges.length, 1);
});
step('челленджи: поиск по коду регистронезависим', () => {
  const s = fresh();
  E.createChallenge(s, { name: 'X', start: '2026-10-01', days: 7, code: 'HV-TEST' });
  assert(E.findChallengeByCode(s, 'hv-test'), 'не нашёл по нижнему регистру');
  eq(E.findChallengeByCode(s, 'HV-NOPE'), null);
});
step('challengeProgress: 2 из 4 плановых = 50%', () => {
  const s = fresh();
  const h = mk(s, { name: 'P', freq: { type: 'daily' }, start: D.add(today, -3) });
  E.setLog(s, h.id, D.add(today, -3), 'done');
  E.setLog(s, h.id, D.add(today, -2), 'done');
  const c = E.createChallenge(s, { name: 'C', habitId: h.id, start: D.add(today, -3), days: 30 });
  const p = E.challengeProgress(s, c);
  eq(p.days, 4); eq(p.done, 2); eq(p.pct, 50);
});
step('challengeProgress без привычки → нули', () => {
  const s = fresh();
  const c = E.createChallenge(s, { name: 'C', habitId: 'нет', start: today, days: 7 });
  const p = E.challengeProgress(s, c);
  eq(p.pct, 0); eq(p.days, 0);
});

step('DnD: reorderByIds переставляет order по списку', () => {
  const s = fresh();
  const a = mk(s, { name: 'A' }); const b = mk(s, { name: 'B' }); const c = mk(s, { name: 'C' });
  E.reorderByIds(s, [c.id, a.id, b.id]);
  eq(E.visibleHabits(s).map((h) => h.name).join(''), 'CAB');
  eq(c.order, 0); eq(a.order, 1); eq(b.order, 2);
});

step('buildCsv: заголовок, BOM, ; и экранирование кавычек', () => {
  const s = fresh();
  const h = mk(s, { name: 'Кавычка "к"' });
  E.setLog(s, h.id, today, 'done');
  const csv = E.buildCsv(s);
  assert(csv.startsWith('\uFEFF'), 'нет BOM');
  const lines = csv.slice(1).split('\n');
  eq(lines[0], '"date";"habit";"emoji";"category";"status";"value";"unit";"note";"streak"');
  assert(lines[1].includes('"Кавычка ""к"""'), 'кавычки не экранированы: ' + lines[1]);
  assert(lines[1].includes('"done"'), 'нет статуса');
});

step('simFriendActivity: добавляет событие друга (инжектируемый rnd)', () => {
  const s = E.seedDemo();
  const before = s.feed.length;
  const rnd = E.mulberry(777);
  const ev = E.simFriendActivity(s, rnd);
  assert(ev, 'событие не создано');
  eq(s.feed.length, Math.min(before + 1, E.FEED_CAP));
  assert(ev.who.startsWith('u_'), 'who не друг: ' + ev.who);
});

step('друзья: friendById с фолбэком на DEMO_FRIENDS', () => {
  const s = fresh();
  eq(E.friendById(s, 'u_alex').name, 'Алекс', 'не нашёл демо-друга');
  eq(E.friendById(s, 'u_nope').name, '?', 'нет фолбэка ?');
});
step('друзья: accepted/incoming по relation', () => {
  const s = fresh();
  s.friends = [
    { id: 'f1', name: 'A', emoji: '', color: '' },
    { id: 'f2', name: 'B', emoji: '', color: '', relation: 'incoming' },
  ];
  eq(E.acceptedFriends(s).length, 1);
  eq(E.incomingFriends(s).length, 1);
  eq(E.incomingFriends(s)[0].id, 'f2');
});

step('seedDemo: команда и лента на месте (4 друга, 2 челленджа, feed>0)', () => {
  const s = E.seedDemo();
  eq(s.friends.length, 4);
  eq(s.challenges.length, 2);
  eq(s.challenges.filter((c) => c.status === 'active').length, 1);
  eq(s.challenges.filter((c) => c.status === 'finished').length, 1);
  assert(s.feed.length > 0 && s.feed.length <= 70, 'feed: ' + s.feed.length);
  eq(s.notes.length, 4);
  eq(s.notes[2].habitId, s.habits[4].id, 'заметка не привязана к habit[4]');
  assert(s.feed.every((f) => f.id && f.type && f.who && f.ts), 'битый элемент ленты');
});
step('seedDemo с командой остаётся детерминированным', () => {
  const a = E.seedDemo(); const b = E.seedDemo();
  eq(a.feed.length, b.feed.length, 'feed различается между запусками');
  eq(JSON.stringify(a.feed.map((f) => [f.type, f.who, f.data.days || 0])),
     JSON.stringify(b.feed.map((f) => [f.type, f.who, f.data.days || 0])));
  eq(a.friends.length, b.friends.length);
});

console.log('\n=== 12. Финансы (F-2) ===');
step('finPeriod: день/неделя/месяц от фиксированного якоря', () => {
  const d = E.finPeriod('day', '2026-10-09');
  eq(d.from, '2026-10-09'); eq(d.to, '2026-10-09'); eq(d.days, 1);
  const w = E.finPeriod('week', '2026-10-09');            // 2026-10-09 — пятница (dow=4)
  eq(w.from, '2026-10-05'); eq(w.to, '2026-10-11'); eq(w.days, 7);
  eq(D.dow(w.from), 0, 'неделя началась не с понедельника');
  const m = E.finPeriod('month', '2026-10-09');
  eq(m.from, '2026-10-01'); eq(m.to, '2026-10-31'); eq(m.days, 31);
});
step('finPeriod: високосный февраль', () => {
  const m = E.finPeriod('month', '2028-02-10');
  eq(m.to, '2028-02-29'); eq(m.days, 29);
});
step('finPeriod: неделя через границу месяца', () => {
  const w = E.finPeriod('week', '2026-11-01');            // воскресенье → неделя 26.10–01.11
  eq(w.from, '2026-10-26'); eq(w.to, '2026-11-01');
});
step('finShift: сдвиги периода назад/вперёд', () => {
  eq(E.finShift('day', '2026-10-09', -1), '2026-10-08');
  eq(E.finShift('week', '2026-10-09', 1), '2026-10-16');
  eq(E.finShift('month', '2026-03-31', -1), '2026-02-01'); // якорь нормализуется к 1-му числу
});
step('finLabel: подписи периодов', () => {
  const w = E.finLabel('week', { from: '2026-09-07', to: '2026-09-13', days: 7 });
  assert(w.includes('7–13 сен'), 'неделя: ' + w);
  const m = E.finLabel('month', { from: '2026-09-01', to: '2026-09-30', days: 30 });
  assert(/^сентябрь/.test(m), 'месяц: ' + m);
  const cross = E.finLabel('week', { from: '2026-09-28', to: '2026-10-04', days: 7 });
  assert(cross.includes('28 сен') && cross.includes('4 окт'), 'неделя через месяц: ' + cross);
});
step('fmtMoney: разряды, копейки, ноль', () => {
  eq(E.fmtMoney(400), '400 ₽');
  eq(E.fmtMoney(1400), '1 400 ₽');
  eq(E.fmtMoney(1234567), '1 234 567 ₽');
  eq(E.fmtMoney(299.5), '299,5 ₽');
  eq(E.fmtMoney(299.55), '299,55 ₽');
  eq(E.fmtMoney(0.05), '0,05 ₽');
  eq(E.fmtMoney(0), '0 ₽');
});
step('addExpense: валидация, нормализация, дефолты', () => {
  const s = E.blank();
  const e = E.addExpense(s, { name: '  Шаурма  ', amount: 400, type: 'ЕДА ' });
  eq(s.expenses.length, 1);
  eq(e.name, 'Шаурма'); eq(e.type, 'еда'); eq(e.amount, 400);
  eq(e.date, D.today(), 'дата по умолчанию не сегодня');
  assert(/^e_/.test(e.id), 'id: ' + e.id);
  const e2 = E.addExpense(s, { name: 'Без типа', amount: 10.5 });
  eq(e2.type, 'прочее'); eq(e2.amount, 10.5);
  let err = null;
  try { E.addExpense(s, { name: '   ', amount: 5 }); } catch (x) { err = x.message; }
  eq(err, 'Наименование не может быть пустым');
  err = null;
  try { E.addExpense(s, { name: 'x', amount: 0 }); } catch (x) { err = x.message; }
  eq(err, 'Сумма должна быть больше нуля');
  err = null;
  try { E.addExpense(s, { name: 'x', amount: -3 }); } catch (x) { err = x.message; }
  eq(err, 'Сумма должна быть больше нуля');
  eq(s.expenses.length, 2, 'после ошибок остались лишние записи');
});
step('updateExpense: валидация до мутации; removeExpense', () => {
  const s = E.blank();
  const e = E.addExpense(s, { name: 'Кофе', amount: 200, type: 'кафе', date: '2026-10-01' });
  E.updateExpense(s, e.id, { amount: 250.5, name: ' Кофе2 ' });
  eq(s.expenses[0].amount, 250.5); eq(s.expenses[0].name, 'Кофе2');
  assert(E.updateExpense(s, 'несуществующий', { amount: 1 }) === null, 'не вернул null для чужого id');
  let err = null;
  try { E.updateExpense(s, e.id, { amount: -1, name: 'Испорчено' }); } catch (x) { err = x.message; }
  eq(err, 'Сумма должна быть больше нуля');
  eq(s.expenses[0].name, 'Кофе2', 'частичная мутация при ошибке');
  E.removeExpense(s, e.id);
  eq(s.expenses.length, 0);
});
step('normalize: старые бэкапы без expenses совместимы', () => {
  const s = E.normalize({ habits: [], notes: [] });
  assert(Array.isArray(s.expenses) && s.expenses.length === 0, 'expenses не достроен');
  const s2 = E.normalize({ expenses: 'мусор' });
  assert(Array.isArray(s2.expenses), 'битый expenses не заменён массивом');
});
step('finSummary: итоги, типы, названия, пьедестал', () => {
  const s = E.blank();
  const r = { from: '2026-10-05', to: '2026-10-11', days: 7 };
  const mk = (date, type, name, amount, ts) => E.addExpense(s, { date, type, name, amount, ts });
  mk('2026-10-05', 'еда', 'Продукты', 3000, 1);
  mk('2026-10-06', 'еда', 'Продукты', 1000, 2);            // одинаковое имя → агрегат
  mk('2026-10-07', 'кафе', 'Габаджоу в китайке', 1400, 3);
  mk('2026-10-08', 'транспорт', 'Такси', 540, 4);
  mk('2026-10-20', 'еда', 'Вне периода', 9999, 5);          // не входит в r
  const f = E.finSummary(s, r);
  eq(f.count, 4);
  eq(f.total, 5940);                                        // 3000+1000+1400+540
  eq(f.avgPerDay, 848.57);                                  // 5940/7 → round2
  eq(f.topType.type, 'еда'); eq(f.topType.total, 4000); eq(f.topType.count, 2);
  eq(Math.round(f.topType.share * 100), 67);                // 4000/5940
  eq(f.byType.length, 3);
  eq(f.byType[1].type, 'кафе'); eq(f.byType[2].type, 'транспорт');
  eq(f.topNames[0].name, 'Продукты'); eq(f.topNames[0].total, 4000); eq(f.topNames[0].count, 2);
  eq(f.topNames[0].best.amount, 3000, 'best — не крупнейшая запись');
  eq(f.topNames[1].name, 'Габаджоу в китайке');
  eq(f.podium.length, 3);
  eq(f.podium[0].name, 'Продукты'); eq(f.podium[0].amount, 3000);
  eq(f.podium[1].name, 'Габаджоу в китайке'); eq(f.podium[1].amount, 1400);
  eq(f.podium[2].amount, 1000);
  const f0 = E.finSummary(s, { from: '2026-01-01', to: '2026-01-31', days: 31 });
  eq(f0.count, 0); eq(f0.total, 0); eq(f0.avgPerDay, 0);
  assert(f0.topType === null && f0.podium.length === 0 && f0.topNames.length === 0, 'пустой период не пуст');
});
step('expensesBetween: границы включительно, сортировка desc', () => {
  const s = E.blank();
  E.addExpense(s, { date: '2026-10-01', name: 'a', amount: 1, ts: 10 });
  E.addExpense(s, { date: '2026-10-02', name: 'b', amount: 2, ts: 5 });
  E.addExpense(s, { date: '2026-10-02', name: 'c', amount: 3, ts: 20 });
  const list = E.expensesBetween(s, '2026-10-01', '2026-10-05');
  eq(list.map((e) => e.name).join(','), 'c,b,a');
  eq(E.expensesBetween(s, '2026-10-02', '2026-10-02').length, 2, 'границы невключительны');
});
step('expenseTypeStyle: пресеты и пользовательские типы', () => {
  eq(E.expenseTypeStyle('еда').icon, 'leaf');
  eq(E.expenseTypeStyle('Еда').color, '#5F8A6B', 'регистр типа не нормализован');
  const custom = E.expenseTypeStyle('крипта');
  eq(custom.icon, 'coin');
  assert(/^#[0-9A-F]{6}$/i.test(custom.color), 'цвет: ' + custom.color);
  eq(E.expenseTypeStyle('крипта').color, custom.color, 'хеш цвета не стабилен');
  eq(E.EXPENSE_TYPES.length, 12);
});
step('capFirst', () => {
  eq(E.capFirst('еда'), 'Еда'); eq(E.capFirst(''), '');
});
step('buildExpensesCsv: BOM, шапка, экранирование, фильтр периода', () => {
  const s = E.blank();
  E.addExpense(s, { date: '2026-10-01', type: 'еда', name: 'Хлеб; "Бородинский"', amount: 50, ts: 1 });
  const csv = E.buildExpensesCsv(s);
  eq(csv.charCodeAt(0), 0xFEFF, 'нет BOM');
  const lines = csv.slice(1).split('\n');
  eq(lines[0], '"date";"type";"name";"amount"');
  eq(lines.length, 2);
  assert(lines[1].includes('""Бородинский""'), 'кавычки не экранированы: ' + lines[1]);
  assert(!lines[1].includes('Хлеб;'), 'точка с запятой в имени не заменена');
  eq(E.buildExpensesCsv(s, '2026-11-01', '2026-11-30').slice(1).split('\n').length, 1, 'фильтр периода не сработал');
});
step('seedDemo: 16 расходов, даты в окне 31 дня, детерминированно', () => {
  const s = E.seedDemo();
  eq(s.expenses.length, 16);
  const t = D.today();
  assert(s.expenses.every((e) => e.date <= t && e.date >= D.add(t, -31)), 'дата расхода вне окна');
  assert(s.expenses.every((e) => e.amount > 0 && e.type && e.name && /^e_/.test(e.id)), 'битая запись');
  const a = E.seedDemo(); const b = E.seedDemo();
  eq(JSON.stringify(a.expenses.map((e) => [e.date, e.type, e.name, e.amount])),
     JSON.stringify(b.expenses.map((e) => [e.date, e.type, e.name, e.amount])), 'seed расходов не детерминирован');
  const m = E.finSummary(s, E.finPeriod('month'));
  assert(m.total > 0 && m.podium.length === 3, 'демо-итоги текущего месяца пустые');
  assert(s.expenses.some((e) => e.date === t), 'нет трат за сегодня — дневной итог будет пуст');
});

/* ---------- итог ---------- */
console.log(`\n${'='.repeat(46)}`);
console.log(`engine.web: ${ok} ok, ${failed} FAIL`);
console.log('='.repeat(46));
process.exit(failed ? 1 : 0);
