'use client';

import { useMemo } from 'react';
import { D, WD, WD_FULL } from '@/lib/dates';
import { dueOn, freqLabel } from '@/lib/schedule';
import { completion, freezesLeft, isDone, streakOf, type LogMap } from '@/lib/stats';
import { Heatmap } from '@/components/calendar/heatmap';
import { Sheet } from '@/components/ui/overlays';
import type { Habit } from '@/types/database';

export function HabitStatsSheet({
  habitId,
  habits,
  logs,
  onClose,
  onPickDay,
}: {
  habitId: string | null;
  habits: Habit[];
  logs: LogMap;
  onClose: () => void;
  onPickDay?: (h: Habit, date: string) => void;
}) {
  const habit = habits.find((h) => h.id === habitId) ?? null;

  const data = useMemo(() => {
    if (!habit) return null;
    const s = streakOf(habit, logs);
    const all = D.range(habit.start_date || D.add(D.today(), -89), D.today());
    const c90 = completion(habit, logs, all);
    const c30 = completion(habit, logs, D.range(D.add(D.today(), -29), D.today()));
    const c7 = completion(habit, logs, D.range(D.add(D.today(), -6), D.today()));
    const byDow = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const ks = all.filter((k) => D.dow(k) === i && dueOn(habit, k));
      return { i, due: ks.length, done: ks.filter((k) => isDone(logs, habit.id, k)).length };
    });
    const total = Object.values(logs[habit.id] ?? {}).reduce((n, l) => n + (l.status === 'done' ? 1 : 0), 0);
    const totalVal = Object.values(logs[habit.id] ?? {}).reduce((n, l) => n + (Number(l.value) || 0), 0);
    return { s, c90, c30, c7, byDow, total, totalVal };
  }, [habit, logs]);

  if (!habit || !data) return null;

  const kpi = (v: string | number, l: string) => (
    <div className="p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--stroke)]">
      <div className="text-[25px] font-extrabold tracking-tight tabular leading-none">{v}</div>
      <div className="text-[10.5px] text-[var(--muted)] uppercase tracking-[.09em] mt-1.5">{l}</div>
    </div>
  );

  return (
    <Sheet open={!!habit} onClose={onClose} icon={habit.emoji} title={habit.name}>
      <p className="text-sm text-[var(--muted)] -mt-2 mb-3">{freqLabel(habit)} · с {D.human(habit.start_date)}</p>
      {habit.description && <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-4">{habit.description}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {kpi(data.s.cur, 'текущий стрик')}
        {kpi(data.s.best, 'рекорд')}
        {kpi(`${data.c30 ? Math.round(data.c30.rate * 100) : 0}%`, '30 дней')}
        {kpi(data.total, 'всего отметок')}
      </div>

      {(habit.freezes > 0 || habit.is_negative || data.s.frozen > 0) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {habit.is_negative && <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[color-mix(in_oklab,var(--bad)_40%,transparent)] text-[var(--bad)]">🚫 привычка «не делать»: отметка = сдержался</span>}
          {habit.freezes > 0 && <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[color-mix(in_oklab,var(--acc2)_42%,transparent)] text-[var(--acc2)]">🧊 заморозок осталось: {freezesLeft(habit, logs)} из {habit.freezes}</span>}
          {data.s.frozen > 0 && <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[color-mix(in_oklab,var(--warn)_40%,transparent)] text-[var(--warn)]">🧊 стрик спасён заморозкой {data.s.frozen} раз(а)</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 my-4">
        <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[var(--stroke)]">7 дней: {data.c7 ? Math.round(data.c7.rate * 100) : 0}%</span>
        <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[var(--stroke)]">30 дней: {data.c30 ? Math.round(data.c30.rate * 100) : 0}%</span>
        <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[var(--stroke)]">всё время: {data.c90 ? Math.round(data.c90.rate * 100) : 0}%</span>
        {habit.target_unit && data.totalVal > 0 && (
          <span className="px-2 py-[3px] rounded-full text-[11px] font-extrabold border border-[color-mix(in_oklab,var(--warn)_40%,transparent)] text-[var(--warn)]">Σ {data.totalVal} {habit.target_unit}</span>
        )}
      </div>

      <div className="glass rounded-[var(--r)] p-4 mb-3">
        <h3 className="text-[15px] font-bold mb-3">По дням недели</h3>
        {data.byDow.map((d) => (
          <div key={d.i} className="grid grid-cols-[110px_1fr_46px] gap-3 items-center mb-2.5 last:mb-0">
            <div className="text-[13px] font-semibold truncate">{WD_FULL[d.i]}</div>
            <div className="h-2.5 rounded-full bg-[var(--stroke)] overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${d.due ? Math.round((d.done / d.due) * 100) : 0}%`, background: habit.color }} />
            </div>
            <div className="text-[12.5px] font-extrabold text-right text-[var(--muted)] tabular">{d.due ? Math.round((d.done / d.due) * 100) : 0}%</div>
          </div>
        ))}
      </div>

      <div className="glass rounded-[var(--r)] p-4">
        <h3 className="text-[15px] font-bold mb-3">Последние 90 дней</h3>
        <Heatmap
          values={D.range(D.add(D.today(), -89), D.today()).map((k) => ({
            key: k,
            value: dueOn(habit, k) ? (isDone(logs, habit.id, k) ? 1 : logs[habit.id]?.[k] ? 0.3 : 0) : null,
          }))}
          color={habit.color}
          onPick={onPickDay ? (k) => onPickDay(habit, k) : undefined}
        />
      </div>
      <div className="text-[11.5px] text-[var(--faint)] mt-3">
        {WD.join(' · ')} — неделя начинается с понедельника
      </div>
    </Sheet>
  );
}
