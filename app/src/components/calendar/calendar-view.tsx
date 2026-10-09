'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D, WD } from '@/lib/dates';
import { dueOn } from '@/lib/schedule';
import { heatmapValues, isDone, type LogMap } from '@/lib/stats';
import { setLog } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardHead, Chip, Pill, Select } from '@/components/ui/primitives';
import { Heatmap } from './heatmap';
import { DayHabitSheet } from '@/components/today/habit-row';
import type { Habit, Profile } from '@/types/database';

export function CalendarView({
  habits: initHabits,
  logs: initLogs,
  profile,
}: {
  habits: Habit[];
  logs: LogMap;
  profile: Profile | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = D.today();
  const [habits, setHabits] = useState(initHabits);
  const [logs, setLogs] = useState<LogMap>(initLogs);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [habitId, setHabitId] = useState('all');
  const [selDay, setSelDay] = useState<string>(today);
  const [sheet, setSheet] = useState<{ habit: Habit; date: string } | null>(null);

  const active = habits.filter((h) => !h.archived);
  const list = habitId === 'all' ? active : active.filter((h) => h.id === habitId);
  const [Y, M] = month.split('-').map(Number);
  const cells = useMemo(() => D.monthGrid(Y, M), [Y, M]);

  const reload = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('habit_logs')
      .select('id, habit_id, user_id, log_date, status, value, note')
      .eq('user_id', profile.id)
      .gte('log_date', D.add(today, -400));
    const map: LogMap = {};
    for (const l of (data ?? []) as never[]) {
      const row = l as { habit_id: string; log_date: string };
      if (!map[row.habit_id]) map[row.habit_id] = {};
      map[row.habit_id][row.log_date] = l as never;
    }
    setLogs(map);
    router.refresh();
  };

  const monthKeys = cells.filter((c) => !c.out && c.key <= today).map((c) => c.key);
  let mDue = 0;
  let mDone = 0;
  monthKeys.forEach((k) => list.forEach((h) => { if (dueOn(h, k)) { mDue += 1; if (isDone(logs, h.id, k)) mDone += 1; } }));
  const mRate = mDue ? Math.round((mDone / mDue) * 100) : 0;

  const shift = (n: number) => {
    const d = new Date(Y, M - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const dayHabits = list.map((h) => ({ h, due: dueOn(h, selDay), st: logs[h.id]?.[selDay]?.status ?? null }));

  const quick = async (h: Habit, status: 'done' | null) => {
    try {
      await setLog(h.id, selDay, status);
      toast.success(status ? `${h.emoji} Отмечено за ${D.human(selDay)}` : 'Отметка снята');
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  return (
    <div className="p-4 lg:p-7">
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <Button size="iconSm" onClick={() => shift(-1)} aria-label="Предыдущий месяц">‹</Button>
        <div className="text-xl font-extrabold tracking-tight min-w-[190px]">{D.monthName(M - 1)} {Y}</div>
        <Button size="iconSm" onClick={() => shift(1)} aria-label="Следующий месяц">›</Button>
        <Button size="sm" onClick={() => { setMonth(today.slice(0, 7)); setSelDay(today); }}>Сегодня</Button>
        <div className="flex-1" />
        <Select value={habitId} onChange={(e) => setHabitId(e.target.value)} className="w-auto max-w-[240px]">
          <option value="all">Все привычки</option>
          {active.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
        </Select>
        <Pill tone={mRate >= 80 ? 'ok' : mRate < 50 ? 'bad' : 'warn'}>{mRate}% за месяц</Pill>
      </div>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-4 mb-4">
        <Card>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {WD.map((d) => <div key={d} className="text-center text-[11px] uppercase tracking-[.1em] text-[var(--faint)] font-bold pb-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((c) => {
              const dueL = list.filter((h) => dueOn(h, c.key));
              const doneL = dueL.filter((h) => isDone(logs, h.id, c.key));
              const rate = dueL.length ? doneL.length / dueL.length : null;
              const future = c.key > today;
              return (
                <motion.button
                  key={c.key}
                  whileHover={future ? {} : { y: -4, scale: 1.03 }}
                  disabled={future}
                  onClick={() => setSelDay(c.key)}
                  className={cn(
                    'relative aspect-[1/.92] min-h-[74px] rounded-[14px] p-2 flex flex-col gap-1.5 text-left border transition-colors overflow-hidden',
                    c.out && 'opacity-30',
                    future && 'opacity-40 cursor-not-allowed',
                    c.key === today ? 'border-[var(--acc)] shadow-[0_0_0_1px_var(--acc),0_10px_30px_-14px_var(--acc)]' : 'border-[var(--stroke)]',
                    selDay === c.key && !future && 'border-[var(--acc2)]',
                    'bg-[var(--card)] hover:border-[var(--acc)]',
                  )}
                >
                  <span className={cn('text-[12.5px] font-extrabold', c.key === today ? 'text-[var(--acc)]' : 'text-[var(--muted)]')}>{D.parse(c.key).getDate()}</span>
                  <span className="flex flex-wrap gap-[3px]">
                    {habitId === 'all'
                      ? doneL.slice(0, 10).map((h) => <i key={h.id} className="w-2 h-2 rounded-[3px] block" style={{ background: h.color, boxShadow: `0 0 7px ${h.color}` }} title={h.name} />)
                          .concat(dueL.filter((h) => !isDone(logs, h.id, c.key) && c.key < today).slice(0, 10).map((h) => <i key={`m${h.id}`} className="w-2 h-2 rounded-[3px] block bg-[var(--bad)] opacity-70" title={`${h.name} — провал`} />))
                      : (() => {
                          const h = list[0];
                          if (!h || !dueOn(h, c.key)) return null;
                          const st = logs[h.id]?.[c.key]?.status;
                          return <i className="w-2 h-2 rounded-[3px] block" style={{ background: st === 'done' ? h.color : st === 'skip' ? 'var(--warn)' : st === 'miss' ? 'var(--bad)' : 'var(--stroke2)' }} />;
                        })()}
                  </span>
                  {rate !== null && (
                    <span className={cn('mt-auto text-[10px] font-extrabold tracking-tight', rate === 1 ? 'text-[var(--ok)]' : rate === 0 ? 'text-[var(--bad)]' : 'text-[var(--faint)]')}>
                      {Math.round(rate * 100)}%
                    </span>
                  )}
                  <span className="absolute left-0 bottom-0 h-[3px] bg-[linear-gradient(90deg,var(--acc),var(--acc2))] transition-[width] duration-500" style={{ width: `${(rate ?? 0) * 100}%` }} />
                </motion.button>
              );
            })}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHead title="📆 День" right={<span className="text-[11.5px] text-[var(--faint)]">{D.human(selDay)}</span>} />
            <div className="max-h-[320px] overflow-auto pr-1">
              {dayHabits.length ? dayHabits.map(({ h, due, st }) => (
                <div key={h.id} className="flex items-center gap-2.5 py-2 border-b border-[var(--stroke)] last:border-0">
                  <button
                    onClick={() => quick(h, st === 'done' ? null : 'done')}
                    disabled={selDay > today}
                    className={cn('w-9 h-9 rounded-xl grid place-items-center text-[15px] border-2 transition-all shrink-0 disabled:opacity-40',
                      st === 'done' ? 'text-white border-transparent' : 'bg-[var(--bg2)] border-[var(--stroke2)] text-[var(--muted)]')}
                    style={st === 'done' ? { background: h.color } : undefined}
                  >
                    {st === 'done' ? '✓' : h.emoji}
                  </button>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13px] truncate">{h.emoji} {h.name}</b>
                    <span className="text-[11px] text-[var(--faint)]">{due ? 'запланировано' : 'не в расписании'}{st ? ` · ${st === 'done' ? 'выполнено' : st === 'skip' ? 'пропуск' : 'провал'}` : ''}</span>
                  </div>
                  <button onClick={() => setSheet({ habit: h, date: selDay })} className="w-8 h-8 rounded-[10px] grid place-items-center text-[var(--faint)] hover:text-[var(--text)] hover:bg-[var(--card)] transition-colors" title="Подробнее">📝</button>
                </div>
              )) : <p className="text-sm text-[var(--muted)] py-4">Нет привычек.</p>}
            </div>
          </Card>

          <Card>
            <CardHead title="🔥 Heatmap года" sub={habitId === 'all' ? 'все привычки' : list[0]?.name} />
            <Heatmap
              values={heatmapValues(list, logs, D.add(today, -364), today)}
              color={habitId === 'all' ? undefined : list[0]?.color}
              onPick={(k) => { setMonth(k.slice(0, 7)); setSelDay(k); }}
            />
          </Card>
        </div>
      </div>

      <Card>
        <CardHead title="Сводка месяца" right={<Pill>{mDone} из {mDue}</Pill>} />
        <MonthSummary habits={list} logs={logs} year={Y} month={M} />
      </Card>

      <DayHabitSheet
        habit={sheet?.habit ?? null}
        date={sheet?.date ?? today}
        log={sheet ? logs[sheet.habit.id]?.[sheet.date] ?? null : null}
        open={!!sheet}
        onClose={() => setSheet(null)}
        onChanged={() => void reload()}
      />
    </div>
  );
}

function MonthSummary({ habits, logs, year, month }: { habits: Habit[]; logs: LogMap; year: number; month: number }) {
  const today = D.today();
  const last = new Date(year, month, 0).getDate();
  const keys = D.range(`${year}-${String(month).padStart(2, '0')}-01`, `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`).filter((k) => k <= today);

  let due = 0;
  let done = 0;
  const perDay: (number | null)[] = [];
  keys.forEach((k) => {
    const dl = habits.filter((h) => dueOn(h, k));
    due += dl.length;
    const dn = dl.filter((h) => isDone(logs, h.id, k));
    done += dn.length;
    perDay.push(dl.length ? dn.length / dl.length : null);
  });
  const perfect = perDay.filter((v) => v === 1).length;
  let bestRun = 0;
  let run = 0;
  perDay.forEach((v) => { if (v === 1) { run += 1; bestRun = Math.max(bestRun, run); } else run = 0; });

  const kpi = (v: string | number, l: string) => (
    <div className="p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--stroke)]">
      <div className="text-[24px] font-extrabold tracking-tight tabular leading-none">{v}</div>
      <div className="text-[10.5px] text-[var(--muted)] uppercase tracking-[.09em] mt-1.5">{l}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {kpi(due ? `${Math.round((done / due) * 100)}%` : '—', 'выполнение')}
      {kpi(done, 'отметок')}
      {kpi(perfect, 'идеальных дней')}
      {kpi(bestRun, 'дней подряд 100%')}
    </div>
  );
}
