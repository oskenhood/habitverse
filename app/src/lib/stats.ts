import { D } from './dates';
import { dueOn } from './schedule';
import type { Habit, HabitLog, LogStatus } from '@/types/database';

/** Карта отметок: logs[habitId][dateKey] = log */
export type LogMap = Record<string, Record<string, HabitLog>>;

export const buildLogMap = (rows: HabitLog[]): LogMap => {
  const map: LogMap = {};
  for (const l of rows) {
    if (!map[l.habit_id]) map[l.habit_id] = {};
    map[l.habit_id][l.log_date] = l;
  }
  return map;
};

export const logAt = (logs: LogMap, hid: string, key: string): HabitLog | null => logs[hid]?.[key] ?? null;

export const isDone = (logs: LogMap, hid: string, key: string): boolean =>
  logs[hid]?.[key]?.status === 'done';

export interface Streak {
  cur: number;
  best: number;
  /** сколько дней в текущем стрике спасено заморозкой */
  frozen: number;
  /** true, если у привычки недельная квота и стрик измеряется неделями */
  weekly?: boolean;
  week?: WeekProgress;
}

export interface WeekProgress {
  from: string;
  due: number;
  done: number;
  goal: number;
  ok: boolean;
  isCurrent: boolean;
}

/* ---------- недельная квота «M из N» (v1.2) ----------
   Надстройка над ЛЮБОЙ частотой: weekly_target = сколько плановых дней в неделю
   нужно закрыть. 0 = квоты нет (прежняя логика «каждый плановый день»).
   Неделя — ISO, с понедельника. Стрик считается НЕДЕЛЯМИ. */

export const weekStartOf = (key: string): string => {
  const d = D.parse(key);
  d.setDate(d.getDate() - D.dow(key));
  return D.key(d);
};

const weekIndexOf = (key: string) => Math.floor(D.diff('1970-01-05', weekStartOf(key)) / 7);

export function weekProgress(h: Habit, logs: LogMap, key = D.today()): WeekProgress {
  const from = weekStartOf(key);
  const dueDays = [0, 1, 2, 3, 4, 5, 6].map((i) => D.add(from, i)).filter((k) => k <= D.today() && dueOn(h, k));
  const done = dueDays.filter((k) => isDone(logs, h.id, k)).length;
  const goal = Math.max(1, Math.min(h.weekly_target || 1, dueDays.length || h.weekly_target || 1));
  return { from, due: dueDays.length, done, goal, ok: done >= goal, isCurrent: from === weekStartOf(D.today()) };
}

/** Полные недели от start_date до until (текущая незакрытая не считается) */
function fullWeeks(h: Habit, until: string): string[] {
  const start = h.start_date || until;
  let w = weekIndexOf(start);
  const last = weekIndexOf(until);
  const out: string[] = [];
  while (w < last) {
    const monday = D.add('1970-01-05', w * 7);
    if (monday >= start) out.push(monday);
    w += 1;
  }
  return out;
}

export interface WeekStat { monday: string; due: number; done: number; goal: number; ok: boolean | null }

export function weeklyStreak(h: Habit, logs: LogMap, until = D.today()) {
  const weeks = fullWeeks(h, until);
  const goal = Math.max(1, Math.min(h.weekly_target || 1, 7));
  const per: WeekStat[] = [];
  let best = 0;
  let run = 0;
  for (const monday of weeks) {
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => D.add(monday, i)).filter((k) => k >= (h.start_date || monday) && dueOn(h, k));
    const done = days.filter((k) => isDone(logs, h.id, k)).length;
    const ok: boolean | null = days.length === 0 ? null : done >= Math.min(goal, days.length);
    per.push({ monday, due: days.length, done, goal, ok });
    if (ok === true) { run += 1; if (run > best) best = run; } else if (ok === false) run = 0;
  }
  let cur = 0;
  for (let i = per.length - 1; i >= 0; i -= 1) {
    if (per[i].ok === true) cur += 1;
    else if (per[i].ok === false) break;
  }
  return { cur, best: Math.max(best, cur), per, week: weekProgress(h, logs, until) };
}

/* ---------- streak freeze: «правило двух дней» ----------
   Провал (✕) не рвёт стрик, пока в его календарном месяце есть запас заморозок.
   Потраченная заморозка помечается в логе полем frozen — расчёт детерминирован.
   День без отметки заморозкой НЕ спасается (иначе старая история сжигала бы бюджет). */

export const monthOf = (key: string) => String(key).slice(0, 7);

export function freezesUsedIn(h: Habit, logs: LogMap, month: string): number {
  return Object.values(logs[h.id] ?? {}).filter((l) => l.frozen && monthOf(String((l as unknown as { d?: string }).d ?? l.log_date)) === month).length;
}
export const freezesLeftIn = (h: Habit, logs: LogMap, month: string) =>
  Math.max(0, (h.freezes ?? 0) - freezesUsedIn(h, logs, month));
export const freezesUsed = (h: Habit, logs: LogMap, on = D.today()) => freezesUsedIn(h, logs, monthOf(on));
export const freezesLeft = (h: Habit, logs: LogMap, on = D.today()) => freezesLeftIn(h, logs, monthOf(on));

export function streakOf(h: Habit, logs: LogMap, until = D.today(), opts: { noFreeze?: boolean } = {}): Streak {
  // привычка с недельной квотой: стрик измеряется неделями
  if ((h.weekly_target ?? 0) > 0) {
    const ws = weeklyStreak(h, logs, until);
    return { cur: ws.cur, best: Math.max(ws.best, ws.cur), frozen: 0, weekly: true, week: ws.week };
  }

  const start = h.start_date || until;
  const today = D.today();
  const canFreeze = !opts.noFreeze;

  let cur = 0;
  let frozen = 0;
  const budget: Record<string, number> = {};
  const left = (m: string) => {
    if (budget[m] === undefined) budget[m] = canFreeze ? freezesLeftIn(h, logs, m) : 0;
    return budget[m];
  };
  const spend = (m: string) => { budget[m] = left(m) - 1; };

  // сегодняшний день ещё можно исправить: если он не закрыт, считаем от вчера
  let k = until === today && logs[h.id]?.[today]?.status !== 'done' ? D.add(until, -1) : until;
  if (until === today && logs[h.id]?.[today]?.status === 'done') cur = 1;

  let guard = 0;
  while (k >= start && !dueOn(h, k) && guard < 400) { k = D.add(k, -1); guard += 1; }
  if (k < start) return { cur, best: Math.max(cur, bestStreak(h, logs, opts)), frozen };

  guard = 0;
  while (k >= start && guard < 4000) {
    guard += 1;
    if (dueOn(h, k)) {
      const l = logs[h.id]?.[k];
      const st = l?.status ?? null;
      if (st === 'done' || st === 'skip') {
        cur += 1;
      } else if (l?.frozen) {
        frozen += 1;                                  // уже спасён ранее — бюджет не тратим
      } else if (st === 'miss') {
        const m = monthOf(k);
        if (left(m) > 0) {
          spend(m);
          frozen += 1;
          if (canFreeze) {
            if (!logs[h.id]) logs[h.id] = {};
            logs[h.id][k] = { ...(l as object), id: l?.id ?? 'tmp', habit_id: h.id, user_id: h.user_id,
              log_date: k, status: 'miss', value: l?.value ?? null, note: l?.note ?? '',
              created_at: l?.created_at ?? '', updated_at: l?.updated_at ?? '', frozen: true,
              ...( { d: k } as object) } as HabitLog;
          }
        } else break;
      } else break;
    }
    k = D.add(k, -1);
  }
  return { cur, best: Math.max(cur, bestStreak(h, logs, opts)), frozen };
}

export function bestStreak(h: Habit, logs: LogMap, opts: { noFreeze?: boolean } = {}): number {
  const from = h.start_date || D.today();
  const days = D.range(from, D.today()).filter((k) => dueOn(h, k));
  const canFreeze = !opts.noFreeze;
  const budget: Record<string, number> = {};
  const left = (m: string) => {
    if (budget[m] === undefined) budget[m] = canFreeze ? freezesLeftIn(h, logs, m) : 0;
    return budget[m];
  };
  const spend = (m: string) => { budget[m] = left(m) - 1; };

  let best = 0;
  let run = 0;
  for (const k of days) {
    if (k >= D.today()) break;
    const l = logs[h.id]?.[k];
    const st = l?.status ?? null;
    if (st === 'done' || st === 'skip') { run += 1; if (run > best) best = run; continue; }
    if (l?.frozen) continue;
    const m = monthOf(k);
    if (left(m) > 0) { spend(m); continue; }
    run = 0;
  }
  return best;
}

export interface Completion {
  due: number;
  done: number;
  rate: number;
}

export function completion(h: Habit, logs: LogMap, days: string[]): Completion | null {
  const due = days.filter((k) => dueOn(h, k));
  if (!due.length) return null;
  const done = due.filter((k) => isDone(logs, h.id, k)).length;
  return { due: due.length, done, rate: done / due.length };
}

export const rateOf = (h: Habit, logs: LogMap, n = 30): number | null => {
  const c = completion(h, logs, D.range(D.add(D.today(), -(n - 1)), D.today()));
  return c ? c.rate : null;
};

/** Процент выполнения по всем привычкам за каждый день периода */
export function dailyRates(habits: Habit[], logs: LogMap, days: string[]) {
  return days.map((k) => {
    const due = habits.filter((h) => dueOn(h, k));
    const done = due.filter((h) => isDone(logs, h.id, k));
    return {
      key: k,
      due: due.length,
      done: done.length,
      rate: due.length ? done.length / due.length : null,
    };
  });
}

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

export function totalsFor(habits: Habit[], logs: LogMap, days: string[]) {
  const rates = dailyRates(habits, logs, days);
  const valid = rates.filter((r) => r.rate !== null) as { key: string; due: number; done: number; rate: number }[];
  const overall = valid.length ? avg(valid.map((r) => r.rate)) : 0;

  let skipped = 0;
  let done = 0;
  let missed = 0;
  for (const k of days) {
    for (const h of habits) {
      const st: LogStatus | undefined = logs[h.id]?.[k]?.status;
      if (st === 'done') done += 1;
      else if (st === 'skip') skipped += 1;
      else if (dueOn(h, k) && k < D.today()) missed += 1;
    }
  }
  return {
    rates,
    overall,
    done,
    skipped,
    missed,
    perfectDays: valid.filter((r) => r.rate === 1).length,
    bestCur: habits.length ? Math.max(...habits.map((h) => streakOf(h, logs).cur)) : 0,
    bestEver: habits.length ? Math.max(...habits.map((h) => streakOf(h, logs).best)) : 0,
  };
}

/** Лучший/худший день недели */
export function weekdayStats(habits: Habit[], logs: LogMap, days: string[]) {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    let due = 0;
    let done = 0;
    for (const k of days) {
      if (D.dow(k) !== i) continue;
      for (const h of habits) {
        if (!dueOn(h, k)) continue;
        due += 1;
        if (isDone(logs, h.id, k)) done += 1;
      }
    }
    return { dow: i, due, done, rate: due ? done / due : 0 };
  });
}

/** Матрица для heatmap: значение 0..1 либо null (не запланировано) */
export function heatmapValues(habits: Habit[], logs: LogMap, from: string, to: string) {
  return D.range(from, to).map((k) => {
    const due = habits.filter((h) => dueOn(h, k));
    if (!due.length) return { key: k, value: null as number | null };
    const done = due.filter((h) => isDone(logs, h.id, k)).length;
    return { key: k, value: done / due.length };
  });
}

export const heatLevel = (v: number | null): 0 | 1 | 2 | 3 | 4 => {
  if (v === null) return 0;
  if (v <= 0) return 0;
  if (v < 0.34) return 1;
  if (v < 0.67) return 2;
  if (v < 1) return 3;
  return 4;
};

/** Персональные инсайты по статистике */
export interface Insight {
  icon: string;
  title: string;
  text: string;
}

export function buildInsights(
  habits: Habit[],
  logs: LogMap,
  days: string[],
  categories: { id: string; name: string; emoji: string }[],
): Insight[] {
  const out: Insight[] = [];
  const t = totalsFor(habits, logs, days);
  const ws = weekdayStats(habits, logs, days);
  const withRate = ws.filter((x) => x.due > 0).sort((a, b) => b.rate - a.rate);
  const pct = Math.round(t.overall * 100);

  if (!days.length || !habits.length) {
    out.push({ icon: '🌱', title: 'Данных пока мало', text: 'Добавь привычки и отметь пару дней — здесь появятся персональные инсайты.' });
    return out;
  }

  if (t.overall >= 0.85) {
    out.push({ icon: '🏆', title: 'Ты в отличной форме', text: `${pct}% выполнения за ${days.length} дней. Пора повышать планку: добавь сложность или новую привычку.` });
  } else if (t.overall >= 0.5) {
    out.push({ icon: '📈', title: 'Хороший рабочий ритм', text: `${pct}% за период. До стабильных 85% не хватает немного — попробуй сузить фокус до 3–5 ключевых привычек.` });
  } else {
    out.push({ icon: '🧭', title: 'Нужна перезагрузка системы', text: `${pct}% выполнения. Скорее всего привычек слишком много или они слишком крупные. Разбей одну на шаги по 2 минуты.` });
  }

  if (withRate.length >= 2 && withRate[0].dow !== withRate[withRate.length - 1].dow) {
    const best = withRate[0];
    const worst = withRate[withRate.length - 1];
    const names = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
    out.push({
      icon: '📅',
      title: `${['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][best.dow]} — твой день`,
      text: `В ${names[best.dow]} ты выполняешь ${Math.round(best.rate * 100)}%, а в ${names[worst.dow]} — ${Math.round(worst.rate * 100)}%. Перенеси тяжёлые привычки на сильные дни.`,
    });
  }

  const ranked = habits
    .map((h) => ({ h, r: rateOf(h, logs, days.length) }))
    .filter((x) => x.r !== null) as { h: Habit; r: number }[];
  ranked.sort((a, b) => a.r - b.r);

  const weak = ranked[0];
  const strong = ranked[ranked.length - 1];
  if (weak && weak.r < 0.6) {
    out.push({ icon: '🩹', title: 'Слабое звено', text: `${weak.h.emoji} «${weak.h.name}» — ${Math.round(weak.r * 100)}%. Уменьши цель до 2 минут или привяжи к уже работающей привычке.` });
  }
  if (strong && strong.r >= 0.8 && strong.h.id !== weak?.h.id) {
    out.push({ icon: '💪', title: 'Опора', text: `${strong.h.emoji} «${strong.h.name}» — ${Math.round(strong.r * 100)}%. Используй её как якорь: сразу после неё запускай слабую привычку.` });
  }

  const longest = habits.map((h) => ({ h, s: streakOf(h, logs) })).sort((a, b) => b.s.best - a.s.best)[0];
  if (longest && longest.s.best >= 7) {
    out.push({ icon: '🔥', title: 'Рекорд стрика', text: `«${longest.h.name}» — ${longest.s.best} дней подряд. Сейчас: ${longest.s.cur}. Цель — превзойти рекорд.` });
  }

  const byCat = categories
    .map((c) => {
      const hs = habits.filter((h) => h.category === c.id);
      const rs = hs.map((h) => rateOf(h, logs, days.length)).filter((v): v is number => v !== null);
      return { c, n: hs.length, r: rs.length ? avg(rs) : null };
    })
    .filter((x) => x.r !== null && x.n > 0) as { c: { id: string; name: string; emoji: string }; n: number; r: number }[];
  byCat.sort((a, b) => b.r - a.r);
  if (byCat.length >= 2) {
    out.push({
      icon: '⚖️',
      title: 'Баланс сфер',
      text: `Сильнее всего ${byCat[0].c.emoji} ${byCat[0].c.name.toLowerCase()} (${Math.round(byCat[0].r * 100)}%), слабее — ${byCat[byCat.length - 1].c.emoji} ${byCat[byCat.length - 1].c.name.toLowerCase()} (${Math.round(byCat[byCat.length - 1].r * 100)}%).`,
    });
  }
  const unused = categories.find((c) => !habits.some((h) => h.category === c.id));
  if (unused) {
    out.push({ icon: '🌈', title: 'Слепая зона', text: `Категория «${unused.emoji} ${unused.name}» не задействована. Одна привычка там добавит жизни баланса.` });
  }
  if (t.perfectDays >= 2) {
    out.push({ icon: '🌟', title: 'Идеальные дни', text: `${t.perfectDays} дней со 100% выполнением за период. Это твой эталон — держи его в голове в тяжёлые дни.` });
  }
  return out;
}
