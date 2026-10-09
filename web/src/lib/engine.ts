/* ============================================================
   HabitVerse web — движок данных и расчётов (фаза 5.2)
   Порт из v2/app.js (демо-эталон). Отличие: все функции ЧИСТЫЕ —
   состояние передаётся первым аргументом, поэтому движок можно
   тестировать на Node без DOM (tests/engine.web.test.js).
   Сторонние эффекты (localStorage, React) — в store.ts.
   ============================================================ */

/* ---------- утилиты ---------- */
export const pad = (n: number): string => String(n).padStart(2, '0');
export const uid = (p: string): string => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]): number => (a.length ? sum(a) / a.length : 0);
export const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- даты (локальное время, ключ «ГГГГ-ММ-ДД») ---------- */
export const D = {
  today(): string { return D.key(new Date()); },
  key(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; },
  parse(k: string): Date { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); },
  add(k: string, n: number): string { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  diff(a: string, b: string): number { return Math.round((D.parse(b).getTime() - D.parse(a).getTime()) / 864e5); },
  dow(k: string): number { return (D.parse(k).getDay() + 6) % 7; },           // 0 = Пн
  isFuture(k: string): boolean { return k > D.today(); },
  daysBetween(a: string, b: string): string[] { const out: string[] = []; for (let k = a; k <= b; k = D.add(k, 1)) out.push(k); return out; },
  monthName(m: number, short?: boolean): string {
    const n = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    return short ? n[m].slice(0, 3) : n[m];
  },
  human(k: string): string {
    const d = D.parse(k); const t = D.today();
    if (k === t) return 'сегодня';
    if (k === D.add(t, -1)) return 'вчера';
    if (k === D.add(t, 1)) return 'завтра';
    return `${d.getDate()} ${D.monthName(d.getMonth(), true)}`;
  },
  full(k: string): string {
    const d = D.parse(k);
    const wd = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'][d.getDay()];
    return `${wd}, ${d.getDate()} ${D.monthName(d.getMonth())} ${d.getFullYear()}`;
  },
  ago(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
    if (s < 86400) return `${Math.floor(s / 3600)} ч назад`;
    if (s < 604800) return `${Math.floor(s / 86400)} дн назад`;
    return new Date(ts).toLocaleDateString('ru-RU');
  },
};
export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

/* ---------- типы данных ---------- */
export type LogStatus = 'done' | 'skip' | 'miss';
export interface LogEntry {
  status: LogStatus;
  val: number | null;
  note: string;
  ts: number;
  d?: string;        // дата, к которой относится запись (ставится при заморозке стрика)
  frozen?: boolean;  // день спасён заморозкой («правило двух дней»)
}
export type LogsMap = Record<string, Record<string, LogEntry>>;

export type FreqType = 'daily' | 'weekdays' | 'interval' | 'monthly' | 'weekly';
export interface Freq { type: FreqType; days?: number[]; every?: number; day?: number; }

export interface Habit {
  id: string; name: string; emoji: string; color: string; desc: string; cat: string;
  freq: Freq; start: string; target: number; unit: string;
  reminder: string; notif: boolean; difficulty: number;
  order: number; archived: boolean; createdAt: number;
  neg: boolean; freezes: number; weekGoal: number;
}

export interface Profile {
  name: string; avatar: string; emoji: string; bio: string; birth: string;
  joined: number; theme: string; mode: 'light' | 'dark'; accent: number;
  sound: boolean; notif: boolean; notifTime: string; density: string; weekStart: number;
  onboarded: boolean; privacyFeed: boolean; privacyProfile: boolean;
}

export interface Note {
  id: string; title: string; body: string; pinned: boolean; color: string;
  tags: string[]; habitId: string | null; created: number; updated: number;
}

/* ---------- финансы (F-2): запись расхода ---------- */
export interface Expense {
  id: string;
  type: string;      // тип расхода — строка в нижнем регистре (пресет из EXPENSE_TYPES или свой)
  name: string;      // наименование в вольной форме — «цитата пользователя»
  amount: number;    // сумма > 0, округление до копеек
  date: string;      // «ГГГГ-ММ-ДД», к какому дню относится трата
  ts: number;        // момент создания записи
}

/* ---------- команда: друзья, челленджи, лента (фаза 5.3) ---------- */
export interface Friend {
  id: string; name: string; display_name?: string; emoji: string; color: string; bio?: string;
  since?: number; streak?: number; score?: number; xp?: number;
  relation?: 'accepted' | 'incoming' | 'pending_in'; avatar_url?: string;
}
export interface Participant {
  id: string; name: string; emoji?: string; avatar?: string; color?: string; score?: number;
}
export interface Challenge {
  id: string; name: string; emoji: string; color: string; desc: string;
  habitId: string | null; start: string; days: number; end: string;
  code: string; invite_code?: string; status: 'active' | 'finished';
  createdAt: number; participants: Participant[];
}
export interface FeedData {
  habitId?: string; key?: string; status?: string; days?: number; level?: number;
  friend?: string; chalId?: string; action?: string; me?: boolean;
}
export interface FeedItem { id: string; type: string; who: string; data: FeedData; ts: number; }
/** Реакции ленты: feedId → эмодзи → список id участников. Эмодзи — контент (можно). */
export type Reactions = Record<string, Record<string, string[]>>;

export interface HvState {
  v: number;
  profile: Profile;
  habits: Habit[];
  logs: LogsMap;
  notes: Note[];
  expenses: Expense[];   // финансы (F-2); в старых бэкапах поля нет — normalize достраивает []
  reactions: Reactions;
  challenges: Challenge[];
  friends: Friend[];
  feed: FeedItem[];
  seenAch: unknown[];
  lastVisit: string;
}

/* ---------- константы ---------- */
export const APP_VERSION = '2.1.0';   // релизная версия основного проекта; синхронизировать с VERSION и docs/PORT_PLAN.md
export const STORAGE_KEY = 'habitverse.v1';   // тот же ключ и схема, что у демо (совместимость импорта)

/* Реакции ленты — эмодзи как пользовательский контент (правило DESIGN: в хроме эмодзи нет). */
export const REACTIONS = ['🔥', '👏', '💪', '😮', '❤️'];

/* Демо-экипаж (как DEMO_FRIENDS в v2/app.js) — до фазы 5.4 команда смоделирована. */
export const DEMO_FRIENDS: Friend[] = [
  { id: 'u_alex', name: 'Алекс', emoji: '🦊', color: '#C0714F', bio: 'Бег и код. 6 утра — моё время.' },
  { id: 'u_mira', name: 'Мира', emoji: '🌙', color: '#7A6AA8', bio: 'Йога, книги, тишина.' },
  { id: 'u_kir', name: 'Кирилл', emoji: '⚡', color: '#3F8A80', bio: 'Холодный душ 200 дней подряд.' },
  { id: 'u_sonya', name: 'Соня', emoji: '🌸', color: '#A85C74', bio: 'Рисую каждый день по скетчу.' },
];

export const COLORS = [
  '#6B6E76', '#3F8A80', '#A85C74', '#A9853F', '#4A76A8', '#5F8A6B', '#C0714F', '#7A6AA8',
  '#A85C74', '#3F8A80', '#A9853F', '#8A5F6B', '#5F8A6B', '#5F6B8A', '#7A6AA8', '#6B6E76',
];

export interface Category { id: string; name: string; em: string; icon: string; color: string; }
export const CATEGORIES: Category[] = [
  { id: 'health', name: 'Здоровье', em: '💪', icon: 'heart', color: '#5F8A6B' },
  { id: 'mind', name: 'Разум', em: '🧠', icon: 'book', color: '#4A76A8' },
  { id: 'work', name: 'Работа', em: '💼', icon: 'case', color: '#A9853F' },
  { id: 'disc', name: 'Дисциплина', em: '⚡', icon: 'bolt', color: '#A85C74' },
  { id: 'social', name: 'Общение', em: '🫂', icon: 'users', color: '#7A6AA8' },
  { id: 'creo', name: 'Творчество', em: '🎨', icon: 'palette', color: '#3F8A80' },
  { id: 'spirit', name: 'Душа', em: '🌱', icon: 'leaf', color: '#5F8A6B' },
  { id: 'money', name: 'Финансы', em: '💰', icon: 'coin', color: '#A9853F' },
];
export const catOf = (id: string): Category => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

/* Эмодзи — только контент (иконки привычек), в UI-хроме не используются */
export const EMOJIS: Record<string, string[]> = {
  'Спорт': ['🏃', '💪', '🏋️', '🧘', '🚴', '🏊', '⚽', '🥊', '🤸', '🎯', '🧗', '🛹', '🏄', '⛹️', '🚶', '🤺'],
  'Еда и вода': ['💧', '🥗', '🍎', '🥑', '🍳', '🫖', '☕', '🚫', '🍫', '🥤', '🍵', '🧃', '🍽️', '🥦'],
  'Сон и отдых': ['😴', '🛌', '🌙', '⭐', '🛀', '🕯️', '🌅', '🏖️', '💤', '🧖'],
  'Учёба и работа': ['📚', '💻', '✍️', '🧠', '📝', '🎓', '🔬', '🗣️', '📖', '🧮', '⌨️', '📊', '🎧', '🔎'],
  'Творчество': ['🎨', '🎸', '🎹', '🎤', '📷', '🎬', '✂️', '🧶', '🪄', '🖌️', '🎭', '🪕'],
  'Дисциплина': ['⏰', '✅', '🔥', '⚡', '🧹', '💊', '🪥', '🚿', '👔', '📵', '💸', '🧾'],
  'Люди и душа': ['🫂', '❤️', '🙏', '🌱', '🐕', '📞', '💌', '🤝', '👶', '🧓', '😊', '🌻'],
};
export const EMOJI_GROUP: Record<string, string> = {
  health: 'Спорт', mind: 'Учёба и работа', work: 'Учёба и работа', disc: 'Дисциплина',
  social: 'Люди и душа', creo: 'Творчество', spirit: 'Люди и душа', money: 'Дисциплина',
};

export const QUOTES: Array<[string, string]> = [
  ['Мы есть то, что постоянно делаем. Совершенство — не действие, а привычка.', 'Аристотель'],
  ['Маленькие ежедневные победы важнее редких подвигов.', 'HabitVerse'],
  ['Ты не поднимаешься до уровня своих целей — ты опускаешься до уровня своих систем.', 'Джеймс Клир'],
  ['Дисциплина — это мост между целями и достижениями.', 'Джим Рон'],
  ['Не считай дни. Делай так, чтобы дни считались.', 'Мухаммед Али'],
  ['Успех — это сумма небольших усилий, повторяющихся день за днём.', 'Роберт Кольер'],
  ['Лучшее время посадить дерево было 20 лет назад. Второе лучшее — сегодня.', 'Китайская пословица'],
  ['Мотивация запускает. Привычка удерживает.', 'Джим Рюн'],
  ['Провал — это просто возможность начать заново, но уже умнее.', 'Генри Форд'],
  ['Сложнее всего начать. Остальное — дело инерции.', 'HabitVerse'],
  ['Один пропущенный день — случайность. Два — начало новой привычки.', 'Джеймс Клир'],
  ['Твой будущий ты наблюдает за тобой сейчас через воспоминания.', 'HabitVerse'],
  ['Постоянство важнее интенсивности.', 'HabitVerse'],
  ['Делай то, что можешь, с тем, что имеешь, там, где ты есть.', 'Теодор Рузвельт'],
  ['Привычка — это канат. Мы вплетаем в него по нитке каждый день.', 'Хорас Манн'],
  ['Если хочешь идти быстро — иди один. Если далеко — идите вместе.', 'Африканская пословица'],
  ['Не цель делает тебя сильнее. Делает тебя сильнее путь к ней.', 'HabitVerse'],
  ['Каждое «сделано» — это голос за того человека, которым ты хочешь стать.', 'Джеймс Клир'],
  ['Сила воли конечна. Сила расписания — нет.', 'HabitVerse'],
  ['Стрик ломается один раз. Главное — не ломать его дважды.', 'Правило двух дней'],
];

/* ---------- состояние ---------- */
export function blankProfile(): Profile {
  return {
    name: '', avatar: '', emoji: '🙂', bio: '', birth: '', joined: Date.now(),
    theme: 'snow', mode: 'light', accent: 0, sound: true, notif: false, notifTime: '20:00',
    density: 'cozy', weekStart: 1, onboarded: false, privacyFeed: true, privacyProfile: false,
  };
}
export function blank(): HvState {
  return {
    v: 1,
    profile: blankProfile(),
    reactions: {},
    habits: [], logs: {}, notes: [], expenses: [], challenges: [], friends: [], feed: [], seenAch: [], lastVisit: '',
  };
}
/** Аккуратное слияние сырых данных (localStorage/импорт) с пустым состоянием — как load() в демо. */
export function normalize(raw: Partial<HvState> | null | undefined): HvState {
  const s = Object.assign(blank(), raw || {}) as HvState;
  s.profile = Object.assign(blankProfile(), s.profile || {});
  s.logs = s.logs || {};
  s.reactions = s.reactions || {};
  (['habits', 'notes', 'expenses', 'challenges', 'friends', 'feed', 'seenAch'] as const).forEach((k) => {
    if (!Array.isArray(s[k])) (s as unknown as Record<string, unknown>)[k] = [];
  });
  return s;
}

/* ---------- расписание ---------- */
export function dueOn(h: Habit, key: string): boolean {
  if (h.archived) return false;
  const start = h.start || key;
  if (key < start) return false;
  const f = h.freq || { type: 'daily' };
  switch (f.type) {
    case 'daily': return true;
    case 'weekdays': return (f.days || [0, 1, 2, 3, 4]).includes(D.dow(key));
    case 'interval': { const n = Math.max(1, f.every || 2); return D.diff(start, key) % n === 0; }
    case 'monthly': { const days = (f.days || [1]).map(Number); return days.includes(D.parse(key).getDate()); }
    case 'weekly': return D.dow(key) === ((f.day ?? 0) % 7);
    default: return true;
  }
}
export function dueDays(h: Habit, from: string, to: string): string[] {
  return D.daysBetween(from, to).filter((k) => dueOn(h, k));
}
export function freqLabel(h: Pick<Habit, 'freq'>): string {
  const f = h.freq || { type: 'daily' };
  if (f.type === 'daily') return 'Каждый день';
  if (f.type === 'weekdays') {
    return (f.days || []).length === 7 ? 'Каждый день' : (f.days || []).slice().sort().map((i) => WD[i]).join(', ');
  }
  if (f.type === 'interval') return `Каждые ${f.every || 2} дн.`;
  if (f.type === 'monthly') return (f.days || [1]).map((d) => `${d}-е число`).join(', ');
  if (f.type === 'weekly') return 'Раз в неделю, ' + WD[(f.day ?? 0) % 7];
  return '';
}

/* ---------- логи ---------- */
export const logAt = (s: HvState, hid: string, key: string): LogEntry | null => (s.logs[hid] || {})[key] || null;
export function setLog(s: HvState, hid: string, key: string, status: LogStatus | null, val?: number | null): void {
  if (!s.logs[hid]) s.logs[hid] = {};
  if (!status) {
    delete s.logs[hid][key];
    if (!Object.keys(s.logs[hid]).length) delete s.logs[hid];
  } else {
    const prev = s.logs[hid][key];
    s.logs[hid][key] = { status, val: val ?? (prev && prev.val) ?? null, note: (prev && prev.note) || '', ts: Date.now() };
  }
}
export const isDone = (s: HvState, hid: string, key: string): boolean => {
  const l = logAt(s, hid, key); return !!l && l.status === 'done';
};
/** Цикл отметки: пусто → выполнено → пропуск → провал → пусто (как в демо). */
export function nextStatus(cur: LogEntry | null): LogStatus | null {
  if (!cur) return 'done';
  if (cur.status === 'done') return 'skip';
  if (cur.status === 'skip') return 'miss';
  return null;
}

/* ---------- streak freeze: «правило двух дней» ----------
   Провал не рвёт стрик, пока в его календарном месяце есть запас заморозок.
   Потраченная заморозка фиксируется в логе полем frozen — расчёт детерминирован. */
export const monthOf = (key: string): string => String(key).slice(0, 7);

export function freezesUsedIn(s: HvState, h: Habit, month: string): number {
  return Object.values(s.logs[h.id] || {})
    .filter((l) => l.frozen && monthOf(l.d || '') === month).length;
}
export function freezesLeftIn(s: HvState, h: Habit, month: string): number {
  return Math.max(0, (h.freezes ?? 0) - freezesUsedIn(s, h, month));
}
export function freezesUsed(s: HvState, h: Habit, on: string = D.today()): number { return freezesUsedIn(s, h, monthOf(on)); }
export function freezesLeft(s: HvState, h: Habit, on: string = D.today()): number { return freezesLeftIn(s, h, monthOf(on)); }

export interface StreakOpts { noFreeze?: boolean; persist?: boolean; }
export interface WeekRec { monday: string; due: number; done: number; goal: number; ok: boolean | null; }
export interface WeekProgress { from: string; due: number; done: number; goal: number; ok: boolean; isCurrent: boolean; }
export interface Streak {
  cur: number; best: number; frozen: number;
  weekly?: boolean; week?: WeekProgress; weeks?: WeekRec[];
}

export function streakOf(s: HvState, h: Habit, until: string = D.today(), opts: StreakOpts = {}): Streak {
  // привычка с недельной квотой: стрик измеряется неделями, а не днями
  if (h.weekGoal > 0) {
    const ws = weeklyStreak(s, h, until);
    return { cur: ws.cur, best: Math.max(ws.best, ws.cur), frozen: 0, weekly: true, week: ws.week, weeks: ws.per };
  }
  const start = h.start || until;
  const today = D.today();
  const canFreeze = !opts.noFreeze;
  const persist = opts.persist !== false;

  let cur = 0, frozen = 0;
  const budget: Record<string, number> = {};               // остаток заморозок по месяцам

  const left = (m: string): number => {
    if (budget[m] === undefined) budget[m] = canFreeze ? freezesLeftIn(s, h, m) : 0;
    return budget[m];
  };
  const spend = (m: string): void => { budget[m] = left(m) - 1; };

  // Сегодняшний день ещё можно исправить: считаем от вчера.
  // Если сегодня закрыт — добавляем 1 к стрику (ровно один раз).
  // ВНИМАНИЕ: в демо v2 здесь был off-by-one (сегодня пересчитывалось дважды,
  // cur=1 + цикл снова с today) — в web-движке исправлено (см. BACKLOG B-1, HANDOFF грабля №50).
  let k = until === today ? D.add(until, -1) : until;
  if (until === today && logAt(s, h.id, today)?.status === 'done') cur = 1;

  let guard = 0;
  while (k >= start && !dueOn(h, k) && guard++ < 400) k = D.add(k, -1);
  if (k < start) return { cur, best: Math.max(cur, bestOf(s, h, opts)), frozen };

  guard = 0;
  while (k >= start && guard++ < 4000) {
    if (dueOn(h, k)) {
      const l = logAt(s, h.id, k);
      const stt = l ? l.status : null;
      if (stt === 'done' || stt === 'skip') {
        cur++;
      } else if (l && l.frozen) {
        frozen++;                                            // уже спасён ранее — бюджет не тратим
      } else if (stt === 'miss') {
        const m = monthOf(k);
        if (left(m) > 0) {
          spend(m); frozen++;
          if (canFreeze && persist) {
            if (!s.logs[h.id]) s.logs[h.id] = {};
            const rec = s.logs[h.id][k] || { status: 'miss', val: null, note: '', ts: Date.now() };
            s.logs[h.id][k] = { ...rec, status: 'miss', d: k, frozen: true };
          }
        } else break;
      } else break;
    }
    k = D.add(k, -1);
  }
  return { cur, best: Math.max(cur, bestOf(s, h, opts)), frozen };
}

export function bestOf(s: HvState, h: Habit, opts: StreakOpts = {}): number {
  const days = dueDays(h, h.start || D.today(), D.today());
  const canFreeze = !opts.noFreeze;
  const budget: Record<string, number> = {};
  const left = (m: string): number => { if (budget[m] === undefined) budget[m] = canFreeze ? freezesLeftIn(s, h, m) : 0; return budget[m]; };
  const spend = (m: string): void => { budget[m] = left(m) - 1; };

  let best = 0, run = 0;
  for (const k of days) {
    if (k >= D.today()) break;                               // сегодняшние дни в рекорд не идут
    const l = logAt(s, h.id, k);
    const stt = l ? l.status : null;
    if (stt === 'done' || stt === 'skip') { run++; best = Math.max(best, run); continue; }
    if (l && l.frozen) { continue; }                         // спасён — стрик продолжается
    const m = monthOf(k);
    if (left(m) > 0) { spend(m); continue; }
    run = 0;
  }
  return best;
}

/* ---------- недельная квота «M из N» ----------
   weekGoal = сколько плановых дней в неделю нужно закрыть; 0 = квоты нет.
   Неделя ISO, с понедельника. Стрик считается НЕДЕЛЯМИ. */
export function weekStartOf(key: string): string {
  const k = D.parse(key); const off = D.dow(key);
  return D.key(new Date(k.getFullYear(), k.getMonth(), k.getDate() - off));
}
export function weekIndexOf(key: string): number {
  return Math.floor(D.diff('1970-01-05', weekStartOf(key)) / 7);   // 1970-01-05 — понедельник
}

export function weekProgress(s: HvState, h: Habit, key: string): WeekProgress {
  const from = weekStartOf(key);
  const due = [0, 1, 2, 3, 4, 5, 6].map((i) => D.add(from, i)).filter((k) => k <= D.today() && dueOn(h, k));
  const done = due.filter((k) => isDone(s, h.id, k)).length;
  const goal = Math.max(1, Math.min(h.weekGoal, due.length || h.weekGoal || 1));
  return { from, due: due.length, done, goal, ok: done >= goal, isCurrent: from === weekStartOf(D.today()) };
}

/** Полные недели от start до until (текущая незакрытая неделя не считается). */
export function fullWeeks(h: Habit, until: string = D.today()): string[] {
  const start = h.start || until;
  let w = weekIndexOf(start);
  const last = weekIndexOf(until);
  const out: string[] = [];
  while (w < last) {                                         // строго меньше: текущая неделя неполная
    const monday = D.add('1970-01-05', w * 7);
    if (monday >= start) out.push(monday);
    w++;
  }
  return out;
}

export function weeklyStreak(s: HvState, h: Habit, until: string = D.today()): { cur: number; best: number; per: WeekRec[]; week: WeekProgress } {
  const weeks = fullWeeks(h, until);
  let cur = 0, best = 0, run = 0;
  const per: WeekRec[] = [];
  for (const monday of weeks) {
    const goal = h.weekGoal;
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => D.add(monday, i)).filter((k) => k >= (h.start || monday) && dueOn(h, k));
    const done = days.filter((k) => isDone(s, h.id, k)).length;
    const ok = days.length === 0 ? null : done >= Math.min(goal, days.length);
    per.push({ monday, due: days.length, done, goal, ok });
    if (ok === true) { run++; best = Math.max(best, run); } else if (ok === false) run = 0;
  }
  // текущий стрик: с конца, пока недели закрыты; null (нет плановых дней) не рвёт и не продлевает
  for (let i = per.length - 1; i >= 0; i--) {
    if (per[i].ok === true) cur++;
    else if (per[i].ok === false) break;
  }
  const wp = weekProgress(s, h, until);
  return { cur, best, per, week: wp };
}

/* ---------- консистентность ---------- */
export interface Completion { due: number; done: number; rate: number; }
export function completion(s: HvState, h: Habit, days: string[]): Completion | null {
  const due = days.filter((k) => dueOn(h, k));
  if (!due.length) return null;
  const done = due.filter((k) => isDone(s, h.id, k)).length;
  return { due: due.length, done, rate: done / due.length };
}
export function rateOf(s: HvState, h: Habit, n: number = 30): number | null {
  const from = D.add(D.today(), -(n - 1));
  const c = completion(s, h, D.daysBetween(from, D.today()));
  return c ? c.rate : null;
}

/* ---------- CRUD привычек ---------- */
export type NewHabitData = Partial<Omit<Habit, 'id'>> & { id?: string };

export function newHabit(s: HvState, data: NewHabitData = {}): Habit {
  const h: Habit = {
    id: uid('h_'), name: 'Новая привычка', emoji: '✨', color: COLORS[s.profile.accent] || COLORS[0],
    desc: '', cat: 'health', freq: { type: 'daily' }, start: D.today(), target: 1, unit: '',
    reminder: '', notif: true, difficulty: 1, order: s.habits.length, archived: false, createdAt: Date.now(),
    neg: false, freezes: 2, weekGoal: 0,
    ...data,
  };
  s.habits.push(h);
  return h;
}
export function updateHabit(s: HvState, id: string, patch: Partial<Habit>): void {
  const h = s.habits.find((x) => x.id === id); if (!h) return;
  Object.assign(h, patch);
}
export function removeHabit(s: HvState, id: string): void {
  const i = s.habits.findIndex((x) => x.id === id); if (i < 0) return;
  s.habits.splice(i, 1); delete s.logs[id];
}
export function reorderHabits(s: HvState, dir: -1 | 1, id: string): void {
  const list = visibleHabits(s); const i = list.findIndex((h) => h.id === id);
  const j = i + dir; if (i < 0 || j < 0 || j >= list.length) return;
  const a = s.habits.indexOf(list[i]), b = s.habits.indexOf(list[j]);
  [s.habits[a], s.habits[b]] = [s.habits[b], s.habits[a]];
  s.habits.forEach((h, k) => { h.order = k; });
}
export const visibleHabits = (s: HvState): Habit[] =>
  s.habits.filter((h) => !h.archived).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export interface TodayCounts { due: number; done: number; left: number; pct: number; }
export function todayCounts(s: HvState): TodayCounts {
  const t = D.today();
  const list = visibleHabits(s).filter((h) => dueOn(h, t));
  const done = list.filter((h) => isDone(s, h.id, t)).length;
  return { due: list.length, done, left: list.length - done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}

/* ---------- заметки (фаза 5.3) ---------- */
export const NOTE_COLORS = ['', '#6B6E7614', '#3F8A8014', '#A85C7414', '#A9853F14', '#4A76A814', '#5F8A6B14'];
export type NoteData = Partial<Omit<Note, 'id'>> & { id?: string };

export function saveNote(s: HvState, data: NoteData, id?: string | null): Note {
  if (id) {
    const n = s.notes.find((x) => x.id === id);
    if (n) { Object.assign(n, data, { updated: Date.now() }); return n; }
  }
  const n: Note = {
    id: uid('n_'), title: '', body: '', pinned: false, color: '', tags: [], habitId: null,
    created: Date.now(), updated: Date.now(), ...data,
  };
  s.notes.push(n);
  return n;
}
export function removeNote(s: HvState, id: string): void {
  s.notes = s.notes.filter((n) => n.id !== id);
}
export function toggleNotePin(s: HvState, id: string): void {
  const n = s.notes.find((x) => x.id === id);
  if (n) { n.pinned = !n.pinned; n.updated = Date.now(); }
}
/** Порядок заметок как в демо: закреплённые сверху, затем по свежести. */
export function sortedNotes(s: HvState): Note[] {
  return [...s.notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
}

/* ---------- лента и реакции (фаза 5.3) ---------- */
export const FEED_CAP = 120;
export function addFeed(s: HvState, type: string, data: FeedData = {}, who: string = 'me'): FeedItem {
  const item: FeedItem = { id: uid('f_'), type, data, who, ts: Date.now() };
  s.feed.unshift(item);
  s.feed = s.feed.slice(0, FEED_CAP);
  return item;
}
export function toggleReaction(s: HvState, feedId: string, emoji: string, who: string = 'me'): boolean {
  if (!s.reactions[feedId]) s.reactions[feedId] = {};
  const r = s.reactions[feedId];
  const mine = (r[emoji] || []).includes(who);
  if (mine) r[emoji] = (r[emoji] || []).filter((x) => x !== who);
  else (r[emoji] = r[emoji] || []).push(who);
  if (!(r[emoji] || []).length) delete r[emoji];
  if (!Object.keys(r).length) delete s.reactions[feedId];
  return !mine;
}

/* ---------- друзья и челленджи (фаза 5.3) ---------- */
export function friendById(s: HvState, id: string): Friend {
  return s.friends.find((f) => f.id === id)
    || DEMO_FRIENDS.find((f) => f.id === id)
    || { id, name: '?', emoji: '👤', color: '#888' };
}
export function acceptedFriends(s: HvState): Friend[] {
  return s.friends.filter((f) => (f.relation || 'accepted') === 'accepted');
}
export function incomingFriends(s: HvState): Friend[] {
  return s.friends.filter((f) => f.relation === 'incoming' || f.relation === 'pending_in');
}

export interface ChallengeScore { pct: number; done: number; days: number; }
/** Прогресс «меня» в челлендже: плановые дни привычки от start до min(end, сегодня). */
export function challengeProgress(s: HvState, c: Challenge): ChallengeScore {
  const h = s.habits.find((x) => x.id === c.habitId);
  if (!h) return { pct: 0, done: 0, days: 0 };
  const today = D.today();
  const keys = D.daysBetween(c.start, c.end < today ? c.end : today);
  const due = keys.filter((k) => dueOn(h, k));
  const done = due.filter((k) => isDone(s, h.id, k)).length;
  return { pct: due.length ? Math.round((done / due.length) * 100) : 0, done, days: due.length };
}
export interface NewChallengeData {
  name: string; desc?: string; emoji?: string; color?: string;
  habitId?: string | null; start?: string; days?: number; code?: string;
}
export function createChallenge(s: HvState, data: NewChallengeData): Challenge {
  const start = data.start || D.today();
  const days = Math.max(1, data.days || 30);
  const c: Challenge = {
    id: uid('c_'), name: data.name.slice(0, 60), emoji: (data.emoji || '🔥').slice(0, 4),
    color: data.color || COLORS[1], desc: data.desc || '', habitId: data.habitId || null,
    start, days, end: D.add(start, days - 1),
    code: (data.code || ('HV-' + Math.random().toString(36).slice(2, 6))).toUpperCase(),
    status: 'active', createdAt: Date.now(),
    participants: [{ id: 'me', name: s.profile.name || 'Вы', emoji: s.profile.emoji, color: COLORS[s.profile.accent % COLORS.length] || COLORS[0], score: 0 }],
  };
  s.challenges.unshift(c);
  return c;
}
export function removeChallenge(s: HvState, id: string): void {
  s.challenges = s.challenges.filter((c) => c.id !== id);
}
export function findChallengeByCode(s: HvState, code: string): Challenge | null {
  const c = code.trim().toUpperCase();
  return s.challenges.find((x) => (x.invite_code || x.code || '').toUpperCase() === c) || null;
}

/** Имитация активности команды (демо-режим; в 5.4 заменится realtime из Supabase).
    rnd injectable для тестов. */
export function simFriendActivity(s: HvState, rnd: () => number = Math.random): FeedItem | null {
  const friends = s.friends.length ? s.friends : DEMO_FRIENDS;
  const f = friends[Math.floor(rnd() * friends.length)];
  if (!f) return null;
  const roll = rnd();
  let type: string; let data: FeedData;
  if (roll < 0.4) { type = 'checkin'; data = { friend: f.id }; }
  else if (roll < 0.7) { type = 'streak'; data = { friend: f.id, days: 5 + Math.floor(rnd() * 40) }; }
  else if (roll < 0.9) { type = 'perfect'; data = { friend: f.id }; }
  else { type = 'level'; data = { friend: f.id, level: 2 + Math.floor(rnd() * 14) }; }
  const item: FeedItem = { id: uid('f_'), who: f.id, ts: Date.now() - Math.floor(rnd() * 3600e3), type, data };
  s.feed.unshift(item);
  // друзья тоже реагируют на ваши события
  const mine = s.feed.find((x) => x.who === 'me');
  if (mine && rnd() < 0.55) {
    const em = REACTIONS[Math.floor(rnd() * REACTIONS.length)];
    if (!s.reactions[mine.id]) s.reactions[mine.id] = {};
    (s.reactions[mine.id][em] = s.reactions[mine.id][em] || []).push(f.id);
  }
  s.feed = s.feed.slice(0, FEED_CAP);
  return item;
}

/* ---------- сортировка drag-and-drop (фаза 5.3) ---------- */
/** Переставляет привычки по переданному списку id (обычно — видимый порядок после DnD). */
export function reorderByIds(s: HvState, ids: string[]): void {
  const order = new Map(ids.map((id, i) => [id, i]));
  const vis = s.habits.filter((h) => order.has(h.id));
  vis.sort((a, b) => (order.get(a.id) as number) - (order.get(b.id) as number));
  vis.forEach((h, i) => { h.order = i; });
  // остальные (архив и не попавшие в список) — после видимых, стабильно
  const rest = s.habits.filter((h) => !order.has(h.id));
  rest.forEach((h, i) => { h.order = vis.length + i; });
}

/* ---------- экспорт CSV (фаза 5.3, порт exportCsv из v2) ---------- */
export function buildCsv(s: HvState): string {
  const rows: Array<Array<string | number>> = [['date', 'habit', 'emoji', 'category', 'status', 'value', 'unit', 'note', 'streak']];
  Object.entries(s.logs).forEach(([hid, m]) => {
    const h = s.habits.find((x) => x.id === hid); if (!h) return;
    Object.entries(m).forEach(([k, l]) => rows.push([
      k, h.name, h.emoji, catOf(h.cat).name, l.status, l.val ?? '', h.unit || '', String(l.note || '').replace(/[\n;]/g, ' '), '',
    ]));
  });
  rows.sort((a, b) => (String(a[0]) < String(b[0]) ? 1 : -1));
  return '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

/* ============================================================
   Финансы (F-2) — реестр расходов: типы, периоды, агрегации.
   Все функции чистые (состояние — первым аргументом), эффекты — в store.ts.
   ============================================================ */

/** Пресеты типов расхода. Тип хранится строкой в нижнем регистре — пользователь
    может ввести и свой (datalist), тогда оформление подбирается по хешу. */
export interface ExpenseType { name: string; icon: string; color: string; }
export const EXPENSE_TYPES: ExpenseType[] = [
  { name: 'еда', icon: 'leaf', color: '#5F8A6B' },
  { name: 'кафе', icon: 'coin', color: '#C0714F' },
  { name: 'транспорт', icon: 'bolt', color: '#4A76A8' },
  { name: 'жильё и счета', icon: 'print', color: '#A9853F' },
  { name: 'связь', icon: 'globe', color: '#3F8A80' },
  { name: 'здоровье', icon: 'heart', color: '#A85C74' },
  { name: 'развлечения', icon: 'spark', color: '#7A6AA8' },
  { name: 'покупки', icon: 'case', color: '#8A6B5F' },
  { name: 'подписки', icon: 'clock', color: '#5F7A8A' },
  { name: 'обучение', icon: 'book', color: '#5F8A6B' },
  { name: 'путешествия', icon: 'flag', color: '#4A6FA5' },
  { name: 'прочее', icon: 'dots', color: '#6B6E76' },
];
const SOFT_COLORS = ['#6B6E76', '#C0714F', '#A9853F', '#5F8A6B', '#3F8A80', '#4A76A8', '#7A6AA8', '#A85C74', '#8A6B5F', '#5F7A8A'];

/** Оформление типа: пресет → свои иконка/цвет; пользовательский тип → мягкий тон по хешу. */
export function expenseTypeStyle(type: string): { icon: string; color: string } {
  const t = String(type || '').trim().toLowerCase();
  const preset = EXPENSE_TYPES.find((x) => x.name === t);
  if (preset) return { icon: preset.icon, color: preset.color };
  let h = 0;
  for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { icon: 'coin', color: SOFT_COLORS[h % SOFT_COLORS.length] };
}

/** Первая буква заглавная — для отображения типов («еда» → «Еда»). */
export const capFirst = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------- периоды: день / неделя / месяц ---------- */
export type FinPeriod = 'day' | 'week' | 'month';
export interface PeriodRange { from: string; to: string; days: number; }

/** Границы периода, в который попадает anchor (по умолчанию сегодня).
    Неделя — понедельник…воскресенье (0 = Пн, как во всём движке). */
export function finPeriod(p: FinPeriod, anchor?: string): PeriodRange {
  const a = anchor && /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? anchor : D.today();
  if (p === 'day') return { from: a, to: a, days: 1 };
  if (p === 'week') {
    const from = D.add(a, -D.dow(a));
    return { from, to: D.add(from, 6), days: 7 };
  }
  const d = D.parse(a);
  const from = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { from, to: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(last)}`, days: last };
}

/** Сдвиг якоря на период назад/вперёд (для стрелок навигации). */
export function finShift(p: FinPeriod, anchor: string, dir: -1 | 1): string {
  if (p === 'day') return D.add(anchor, dir);
  if (p === 'week') return D.add(anchor, dir * 7);
  const d = D.parse(anchor);
  d.setDate(1);
  d.setMonth(d.getMonth() + dir);
  return D.key(d);
}

/** Человекочитаемая подпись периода: «сегодня», «6–12 окт», «октябрь 2026». */
export function finLabel(p: FinPeriod, r: PeriodRange): string {
  if (p === 'day') return D.human(r.from);
  const a = D.parse(r.from); const b = D.parse(r.to);
  if (p === 'week') {
    const span = a.getMonth() === b.getMonth()
      ? `${a.getDate()}–${b.getDate()} ${D.monthName(a.getMonth(), true)}`
      : `${a.getDate()} ${D.monthName(a.getMonth(), true)} – ${b.getDate()} ${D.monthName(b.getMonth(), true)}`;
    return finPeriod('week').from === r.from ? `эта неделя, ${span}` : span;
  }
  const now = new Date();
  const year = a.getFullYear() === now.getFullYear() ? '' : ` ${a.getFullYear()}`;
  return finPeriod('month').from === r.from ? `этот месяц, ${D.monthName(a.getMonth())}${year}` : `${D.monthName(a.getMonth())}${year}`;
}

/* ---------- CRUD расходов ---------- */
export interface ExpenseData { type?: string; name: string; amount: number; date?: string; ts?: number; }

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Новая запись. Бросает Error с человекочитаемым сообщением при невалидных данных
    (текст сообщения показывается тостом). */
export function addExpense(s: HvState, data: ExpenseData): Expense {
  const name = String(data.name || '').trim().slice(0, 120);
  if (!name) throw new Error('Наименование не может быть пустым');
  const amount = round2(Number(data.amount));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Сумма должна быть больше нуля');
  if (amount > 1e12) throw new Error('Слишком большая сумма');
  const type = (String(data.type || '').trim().toLowerCase().slice(0, 40)) || 'прочее';
  const date = data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date) ? data.date : D.today();
  const e: Expense = { id: uid('e_'), type, name, amount, date, ts: data.ts || Date.now() };
  s.expenses.unshift(e);
  return e;
}

export function updateExpense(s: HvState, id: string, patch: Partial<Omit<Expense, 'id'>>): Expense | null {
  const e = s.expenses.find((x) => x.id === id);
  if (!e) return null;
  /* сначала валидируем всё, потом мутируем — при ошибке запись остаётся нетронутой */
  let name: string | undefined;
  let amount: number | undefined;
  let type: string | undefined;
  if (patch.name !== undefined) {
    name = String(patch.name).trim().slice(0, 120);
    if (!name) throw new Error('Наименование не может быть пустым');
  }
  if (patch.amount !== undefined) {
    amount = round2(Number(patch.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Сумма должна быть больше нуля');
    if (amount > 1e12) throw new Error('Слишком большая сумма');
  }
  if (patch.type !== undefined) type = (String(patch.type).trim().toLowerCase().slice(0, 40)) || 'прочее';
  if (name !== undefined) e.name = name;
  if (amount !== undefined) e.amount = amount;
  if (type !== undefined) e.type = type;
  if (patch.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(patch.date))) e.date = String(patch.date);
  return e;
}

export function removeExpense(s: HvState, id: string): void {
  s.expenses = s.expenses.filter((x) => x.id !== id);
}

/* ---------- агрегации за период ---------- */
export interface FinTopName { name: string; total: number; count: number; best: Expense; }
export interface FinByType { type: string; total: number; count: number; share: number; }
export interface FinSummary {
  total: number; count: number; days: number; avgPerDay: number;
  byType: FinByType[];          // по убыванию total
  topType: FinByType | null;    // самый затратный тип
  topNames: FinTopName[];       // названия по убыванию total (агрегат одинаковых имён)
  podium: Expense[];            // топ-3 отдельных записи по сумме — для пьедестала
}

export function expensesBetween(s: HvState, from: string, to: string): Expense[] {
  return s.expenses
    .filter((e) => e.date >= from && e.date <= to)
    .slice()
    .sort((a, b) => (a.date === b.date ? b.ts - a.ts : (a.date < b.date ? 1 : -1)));
}

export function finSummary(s: HvState, r: PeriodRange): FinSummary {
  const list = s.expenses.filter((e) => e.date >= r.from && e.date <= r.to);
  const total = round2(sum(list.map((e) => e.amount)));
  const byTypeMap = new Map<string, FinByType>();
  for (const e of list) {
    const t = byTypeMap.get(e.type) || { type: e.type, total: 0, count: 0, share: 0 };
    t.total = round2(t.total + e.amount); t.count += 1;
    byTypeMap.set(e.type, t);
  }
  const byType = [...byTypeMap.values()].sort((a, b) => (b.total - a.total) || a.type.localeCompare(b.type, 'ru'));
  byType.forEach((t) => { t.share = total > 0 ? t.total / total : 0; });
  const namesMap = new Map<string, FinTopName>();
  for (const e of list) {
    const key = e.name.trim().toLowerCase();
    const n = namesMap.get(key) || { name: e.name.trim(), total: 0, count: 0, best: e };
    n.total = round2(n.total + e.amount); n.count += 1;
    if (e.amount > n.best.amount) n.best = e;
    namesMap.set(key, n);
  }
  const topNames = [...namesMap.values()].sort((a, b) => (b.total - a.total) || a.name.localeCompare(b.name, 'ru'));
  const podium = list.slice().sort((a, b) => (b.amount - a.amount) || (b.ts - a.ts)).slice(0, 3);
  return {
    total, count: list.length, days: r.days,
    avgPerDay: r.days > 0 ? round2(total / r.days) : 0,
    byType, topType: byType[0] || null, topNames, podium,
  };
}

/* ---------- формат денег: «1 234,50 ₽» → «1 234,5 ₽», целые без копеек ---------- */
export function fmtMoney(n: number): string {
  const v = round2(Number(n) || 0);
  const neg = v < 0;
  const abs = Math.abs(v);
  const int = Math.trunc(abs);
  const frac = round2(abs - int);
  const intStr = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  let fracStr = '';
  if (frac > 0) {
    fracStr = ',' + String(Math.round(frac * 100)).padStart(2, '0').replace(/0$/, '');
  }
  return `${neg ? '−' : ''}${intStr}${fracStr} ₽`;
}

/* ---------- CSV реестра расходов (для кнопки «Экспорт CSV» на /finance) ---------- */
export function buildExpensesCsv(s: HvState, from?: string, to?: string): string {
  const rows: Array<Array<string | number>> = [['date', 'type', 'name', 'amount']];
  expensesBetween(s, from || '0000-00-00', to || '9999-99-99')
    .forEach((e) => rows.push([e.date, e.type, String(e.name).replace(/[\n;]/g, ' '), e.amount]));
  return '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}

/* Эмодзи-аватары онбординга — пользовательский контент (правило DESIGN 1b: допускается). */
export const ONB_EMOJI = ['🙂', '😎', '🦊', '🐺', '🐼', '🦁', '🚀', '⚡', '🔥', '🌙', '🎯', '🧠', '💎', '👑', '🥷', '🦄', '🌸', '🍀'];

/* ---------- демо-данные (перенос seedDemo из v2: привычки, заметки, команда, челленджи, лента) ---------- */
export function seedDemo(): HvState {
  const rnd = mulberry(20261006);
  const s = blank();
  s.profile = { ...blankProfile(), name: 'Демо Пилот', emoji: '🦊', bio: 'Собираю систему привычек: тело, голова, работа. Цель — 90 дней без провалов.', birth: '1996-05-14', joined: Date.now() - 92 * 864e5, onboarded: true, notif: false };

  const start = D.add(D.today(), -91);
  const defs: NewHabitData[] = [
    { name: 'Утренняя пробежка', emoji: '🏃', color: '#C0714F', cat: 'health', freq: { type: 'weekdays', days: [0, 2, 4, 5] }, target: 1, desc: '5 км в лёгком темпе, пульс до 145.', difficulty: 3, reminder: '06:40' },
    { name: '2 литра воды', emoji: '💧', color: '#4A76A8', cat: 'health', freq: { type: 'daily' }, target: 8, unit: 'стаканов', desc: 'Стакан сразу после пробуждения.', difficulty: 1, reminder: '' },
    { name: 'Чтение 20 страниц', emoji: '📚', color: '#7A6AA8', cat: 'mind', freq: { type: 'daily' }, target: 20, unit: 'страниц', desc: 'Бумажная книга, без телефона рядом.', difficulty: 2, reminder: '22:00' },
    { name: 'Медитация', emoji: '🧘', color: '#3F8A80', cat: 'spirit', freq: { type: 'daily' }, target: 10, unit: 'минут', desc: 'Дыхание 4-7-8, потом наблюдение.', difficulty: 2, reminder: '07:10' },
    { name: 'Глубокая работа', emoji: '💻', color: '#6B6E76', cat: 'work', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4] }, target: 2, unit: 'блока по 50 мин', desc: 'Без мессенджеров и вкладок.', difficulty: 4, reminder: '09:30' },
    { name: 'Без сахара', emoji: '🚫', color: '#A85C74', cat: 'disc', freq: { type: 'daily' }, target: 1, desc: 'Ноль добавленного сахара. Фрукты можно.', difficulty: 4, reminder: '', neg: true },
    { name: 'Английский 15 мин', emoji: '🗣️', color: '#A9853F', cat: 'mind', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4, 5] }, target: 15, unit: 'минут', desc: 'Карточки + один подкаст.', difficulty: 2, reminder: '13:00' },
    { name: 'Звонок близким', emoji: '📞', color: '#5F8A6B', cat: 'social', freq: { type: 'weekdays', days: [2, 5, 6] }, target: 1, desc: 'Минимум 10 минут живого разговора.', difficulty: 1, reminder: '19:00' },
    { name: 'Скетч дня', emoji: '🎨', color: '#3F8A80', cat: 'creo', freq: { type: 'weekdays', days: [1, 3, 5] }, target: 1, desc: 'Любой рисунок 10 минут, без оценки.', difficulty: 2, reminder: '' },
    { name: 'Отбой до 23:30', emoji: '😴', color: '#5F6B8A', cat: 'health', freq: { type: 'daily' }, target: 1, desc: 'Экраны off за 40 минут до сна.', difficulty: 3, reminder: '22:45' },
    { name: 'Без телефона до завтрака', emoji: '📵', color: '#6B6E76', cat: 'disc', freq: { type: 'daily' }, target: 1, desc: 'Первый час после пробуждения — без экрана.', difficulty: 3, reminder: '', neg: true },
    { name: 'Уборка 10 минут', emoji: '🧹', color: '#6B6E76', cat: 'disc', freq: { type: 'weekdays', days: [1, 4] }, target: 10, unit: 'минут', desc: 'Таймер и одна зона.', difficulty: 1, reminder: '' },
    { name: 'Учёт расходов', emoji: '💰', color: '#A85C74', cat: 'money', freq: { type: 'daily' }, target: 1, desc: 'Записать все траты за день.', difficulty: 1, reminder: '21:30' },
  ];
  defs.forEach((d, i) => {
    const h = newHabit(s, { ...d, order: i, start, notif: !!d.reminder });
    // реалистичная история: чем ближе к сегодняшнему дню, тем лучше дисциплина
    const days = D.daysBetween(start, D.today());
    let mood = 0.55 + rnd() * 0.12;
    days.forEach((k, idx) => {
      if (!dueOn(h, k)) return;
      mood = clamp(mood + (rnd() - 0.48) * 0.045, 0.35, 0.96);
      const recency = idx / days.length;                     // 0 → начало, 1 → сегодня
      const p = clamp(mood * (0.72 + recency * 0.42), 0.1, 0.97);
      const r = rnd();
      if (r < p) {
        s.logs[h.id] = { ...(s.logs[h.id] || {}), [k]: { status: 'done', val: h.target > 1 ? Math.max(1, Math.round(h.target * (0.75 + rnd() * 0.4))) : null, note: '', ts: Date.parse(k) } };
      } else if (r < p + 0.07) {
        s.logs[h.id] = { ...(s.logs[h.id] || {}), [k]: { status: 'skip', val: null, note: '', ts: Date.parse(k) } };
      } else if (k < D.today()) {
        s.logs[h.id] = { ...(s.logs[h.id] || {}), [k]: { status: 'miss', val: null, note: '', ts: Date.parse(k) } };
      }
    });
  });

  s.notes = [
    { id: uid('n_'), title: 'Что сработало за неделю', pinned: true, color: '#3F8A8014', tags: ['инсайт', 'неделя'], habitId: null, body: '## Наблюдения\n- Утренняя пробежка идёт легче, если одежда сложена с вечера.\n- **Медитация** сразу после пробуждения = 90% успеха.\n- Сахар ломается в пятницу вечером → нужен план на пятницу.\n\n## Вывод\nПеренёс сложное на утро. Вечером оставляю только лёгкое.', created: Date.now() - 6 * 864e5, updated: Date.now() - 6 * 864e5 },
    { id: uid('n_'), title: 'Правило двух дней', pinned: false, color: '#A85C7414', tags: ['принцип'], habitId: null, body: 'Никогда не пропускать **два дня подряд**. Один пропуск — случайность. Два — начало новой привычки не делать.\n\n- пропустил → на следующий день делаю минимум 2 минуты\n- минимум засчитывается как выполненное', created: Date.now() - 14 * 864e5, updated: Date.now() - 3 * 864e5 },
    { id: uid('n_'), title: 'Прогресс: глубокая работа', pinned: false, color: '#6B6E7614', tags: ['работа'], habitId: s.habits[4] ? s.habits[4].id : null, body: '[[2026-09-20]] 2 блока × 50 мин — закрыл задачу, которую откладывал месяц.\n`вывод`: блоки по 50 минут работают лучше, чем «поработаю сколько смогу».', created: Date.now() - 9 * 864e5, updated: Date.now() - 9 * 864e5 },
    { id: uid('n_'), title: 'Идеи привычек на следующий квартал', pinned: false, color: '#A9853F14', tags: ['идеи'], habitId: null, body: '- 🥗 Готовка дома 5 раз в неделю\n- 🚶 8000 шагов\n- ✍️ Утренние страницы (3 страницы)\n- 🎸 Гитара 15 минут\n- 🧠 Один курс/модуль в неделю', created: Date.now() - 2 * 864e5, updated: Date.now() - 2 * 864e5 },
  ];

  /* команда и челленджи (демо-режим; в 5.4 — реальные данные из Supabase) */
  s.friends = DEMO_FRIENDS.map((f) => ({ ...f, since: Date.now() - Math.floor(rnd() * 7e9), streak: 4 + Math.floor(rnd() * 46), score: 0 }));

  const ch1Start = D.add(D.today(), -18);
  s.challenges = [
    {
      id: uid('c_'), name: '30 дней без сахара', emoji: '🚫', color: '#A85C74',
      desc: 'Ноль добавленного сахара. Ставка: проигравший готовит ужин победителю.',
      habitId: s.habits[5] ? s.habits[5].id : null, start: ch1Start, days: 30, end: D.add(ch1Start, 29),
      code: 'HV-SUGAR', status: 'active', createdAt: Date.now(),
      participants: [
        { id: 'me', name: s.profile.name, emoji: s.profile.emoji, color: '#6B6E76' },
        { id: 'u_alex', name: 'Алекс', emoji: '🦊', color: '#C0714F', score: 62 },
        { id: 'u_kir', name: 'Кирилл', emoji: '⚡', color: '#3F8A80', score: 78 },
        { id: 'u_sonya', name: 'Соня', emoji: '🌸', color: '#A85C74', score: 44 },
      ],
    },
    {
      id: uid('c_'), name: 'Утро на 6:30', emoji: '🌅', color: '#A9853F',
      desc: 'Подъём в 6:30 каждый будний день. 21 день.',
      habitId: s.habits[0] ? s.habits[0].id : null, start: D.add(D.today(), -60), days: 21, end: D.add(D.today(), -40),
      code: 'HV-630', status: 'finished', createdAt: Date.now() - 60 * 864e5,
      participants: [
        { id: 'me', name: s.profile.name, emoji: s.profile.emoji, color: '#6B6E76' },
        { id: 'u_mira', name: 'Мира', emoji: '🌙', color: '#7A6AA8', score: 88 },
        { id: 'u_alex', name: 'Алекс', emoji: '🦊', color: '#C0714F', score: 71 },
      ],
    },
  ];

  /* лента: история событий за 27 дней (детерминированно — тот же mulberry) */
  const hist: FeedItem[] = [];
  for (let i = 26; i >= 0; i--) {
    const k = D.add(D.today(), -i);
    s.habits.forEach((h) => {
      if (isDone(s, h.id, k) && rnd() < 0.28) {
        const fr = s.friends[Math.floor(rnd() * s.friends.length)];
        hist.push({ id: uid('f_'), type: 'checkin', who: rnd() < 0.55 ? 'me' : fr.id, data: { habitId: h.id, key: k, status: 'done' }, ts: Date.parse(k) + 3e7 });
      }
    });
    if (rnd() < 0.18) {
      const fr = s.friends[Math.floor(rnd() * s.friends.length)];
      const type = (['streak', 'perfect', 'level'] as const)[Math.floor(rnd() * 3)];
      hist.push({ id: uid('f_'), type, who: fr.id, data: { friend: fr.id, days: 5 + Math.floor(rnd() * 30), level: 3 + Math.floor(rnd() * 10) }, ts: Date.parse(k) + 5e7 });
    }
  }
  s.feed = hist.sort((a, b) => b.ts - a.ts).slice(0, 70);

  /* финансы (F-2): детерминированный реестр трат за последние ~4 недели.
     Названия — в вольной форме, как просил бета-тестер («цитата пользователя»). */
  const finDefs: Array<[offset: number, type: string, name: string, amount: number]> = [
    [0, 'кафе', 'Жёстко навернул габаджоу в китайке', 1400],
    [0, 'кафе', 'Кофе, чтобы проснуться', 220],
    [0, 'транспорт', 'Такси, потому что дождь', 540],
    [1, 'еда', 'Продукты на неделю', 3200],
    [1, 'подписки', 'Музыка, которая сама себя не послушает', 299],
    [2, 'развлечения', 'Кино с попкорном (попкорн дороже билета)', 1150],
    [3, 'здоровье', 'Аптека: витаминки и пластыри', 430],
    [4, 'обучение', 'Книга про атомные привычки', 780],
    [5, 'покупки', 'Кроссовки, которые сами не пробегут', 6400],
    [7, 'жильё и счета', 'Интернет и свет', 2100],
    [9, 'еда', 'Пельмени премиум-класса', 640],
    [12, 'транспорт', 'Бензин', 2500],
    [15, 'связь', 'Новые наушники (старые «сами умерли»)', 3700],
    [18, 'кафе', 'Завтрак, который я сначала сфотографировал', 690],
    [22, 'развлечения', 'Квест с друзьями', 1200],
    [26, 'прочее', 'Странная покупка с маркетплейса', 850],
  ];
  finDefs.forEach(([off, type, name, amount], i) => {
    const date = D.add(D.today(), -off);
    s.expenses.push({ id: uid('e_'), type, name, amount, date, ts: Date.parse(date) + (860 - off) * 60000 + i });
  });
  s.expenses.sort((a, b) => (a.date === b.date ? b.ts - a.ts : (a.date < b.date ? 1 : -1)));
  return s;
}
