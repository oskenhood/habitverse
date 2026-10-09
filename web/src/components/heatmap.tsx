'use client';

/* ============================================================
   Heatmap-ы (фаза 5.3) — порт yearHeatmapHTML/heatmapHTML из v2.
   YearHeatmap: год по неделям, интенсивность = % выполнения дня.
   HabitHeatmap: N дней одной привычки (для шита челленджа).
   ============================================================ */
import {
  D, dueOn, isDone, logAt, visibleHabits,
  type Habit, type HvState,
} from '@/lib/engine';

/** Доля выполнения дня по списку привычек (null — нет плановых). */
export function dayRate(s: HvState, list: Habit[], k: string): number | null {
  const dueL = list.filter((h) => dueOn(h, k));
  if (!dueL.length) return null;
  return dueL.filter((h) => isDone(s, h.id, k)).length / dueL.length;
}

export function rateLevel(rate: number | null): string {
  if (rate === null || rate === 0) return '';
  if (rate < 0.34) return 'l1';
  if (rate < 0.67) return 'l2';
  if (rate < 1) return 'l3';
  return 'l4';
}

/** Колонки недель: от понедельника ≥ (today-364) до сегодня; null — будущая ячейка. */
export function yearWeeks(today: string): Array<Array<string | null>> {
  const start = D.add(today, -364);
  let k = start;
  while (D.dow(k) !== 0) k = D.add(k, -1);
  const weeks: Array<Array<string | null>> = [];
  while (k <= today) {
    const col: Array<string | null> = [];
    for (let i = 0; i < 7; i++) { const kk = D.add(k, i); col.push(kk > today ? null : kk); }
    weeks.push(col);
    k = D.add(k, 7);
  }
  return weeks;
}

export function YearHeatmap({
  state, sel = 'all', onPick,
}: {
  state: HvState;
  sel?: string;                    // 'all' | id привычки
  onPick?: (k: string) => void;
}) {
  const t = D.today();
  const habits = visibleHabits(state);
  const list = sel === 'all' ? habits : habits.filter((h) => h.id === sel);
  const weeks = yearWeeks(t);
  return (
    <div>
      <div className="hm">
        <div className="hm-inner">
          {weeks.map((col, ci) => (
            <div className="hm-col" key={ci}>
              {col.map((kk, ri) => {
                if (!kk) return <div className="hm-cell" key={ri} style={{ opacity: 0.15 }} />;
                const rate = dayRate(state, list, kk);
                const zero = rate === 0 && list.some((h) => dueOn(h, kk));
                return (
                  <div
                    key={ri}
                    className={`hm-cell ${rateLevel(rate)}`}
                    title={`${D.human(kk)}${rate !== null ? ` · ${Math.round(rate * 100)}%` : ''}`}
                    style={zero ? { background: 'color-mix(in oklab, var(--bad) 50%, transparent)' } : undefined}
                    onClick={() => { if (onPick && !D.isFuture(kk)) onPick(kk); }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="hm-legend">
          <span>0%</span>
          <div className="hm-cell" /><div className="hm-cell l1" /><div className="hm-cell l2" />
          <div className="hm-cell l3" /><div className="hm-cell l4" />
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

export function HabitHeatmap({
  state, h, days, onPick,
}: {
  state: HvState; h: Habit; days: number; onPick?: (k: string) => void;
}) {
  const t = D.today();
  let k = D.add(t, -(days - 1));
  while (D.dow(k) !== 0) k = D.add(k, -1);
  const weeks: Array<Array<string | null>> = [];
  while (k <= t) {
    const col: Array<string | null> = [];
    for (let i = 0; i < 7; i++) { const kk = D.add(k, i); col.push(kk > t ? null : kk); }
    weeks.push(col);
    k = D.add(k, 7);
  }
  return (
    <div className="hm">
      <div className="hm-inner">
        {weeks.map((col, ci) => (
          <div className="hm-col" key={ci}>
            {col.map((kk, ri) => {
              if (!kk) return <div className="hm-cell" key={ri} style={{ opacity: 0.18 }} />;
              const d = dueOn(h, kk);
              const l = logAt(state, h.id, kk);
              const st = l ? l.status : (d && kk < t ? 'miss' : null);
              const lvl = !d ? '' : st === 'done' ? 'l4' : st === 'skip' ? 'l2' : st === 'miss' ? '' : 'l1';
              return (
                <div
                  key={ri}
                  className={`hm-cell ${lvl}`}
                  title={`${D.human(kk)}${d ? '' : ' · не запланировано'}`}
                  style={st === 'miss' ? { background: 'color-mix(in oklab, var(--bad) 55%, transparent)' } : undefined}
                  onClick={() => { if (onPick && !D.isFuture(kk)) onPick(kk); }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="hm-legend">
        <span>меньше</span>
        <div className="hm-cell" /><div className="hm-cell l1" /><div className="hm-cell l2" />
        <div className="hm-cell l3" /><div className="hm-cell l4" />
        <span>больше</span>
      </div>
    </div>
  );
}
