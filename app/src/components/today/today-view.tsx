'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, pick } from '@/lib/utils';
import { D } from '@/lib/dates';
import { dueOn } from '@/lib/schedule';
import { QUOTES, levelOf } from '@/lib/constants';
import { rateOf, streakOf, type LogMap } from '@/lib/stats';
import { createClient } from '@/lib/supabase/client';
import { reorderHabits } from '@/lib/actions';
import type { Habit, Profile } from '@/types/database';
import { HabitModal } from './habit-modal';
import { HabitRow, DayHabitSheet } from './habit-row';
import { ReminderSheet } from './reminder-sheet';
import { CatalogSheet } from './catalog-sheet';
import { ShareSheet } from './share-card';
import { useReminders } from '@/components/notifications/use-reminders';
import { useAppBadge } from '@/hooks/use-app-badge';
import { usePointerReorder } from '@/hooks/use-pointer-reorder';
import { HabitStatsSheet } from './habit-stats-sheet';
import { ProgressSphere } from '@/components/3d/progress-sphere';
import { Button, Card, CardHead, Chip, Empty } from '@/components/ui/primitives';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'due', label: 'На сегодня' },
  { id: 'left', label: 'Осталось' },
  { id: 'done', label: 'Выполнено' },
  { id: 'arch', label: 'Архив' },
] as const;

export function TodayView({
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
  const [habits, setHabits] = useState(initHabits);
  const [logs, setLogs] = useState<LogMap>(initLogs);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [modal, setModal] = useState<{ open: boolean; habit: Habit | null }>({ open: false, habit: null });
  const [statsId, setStatsId] = useState<string | null>(null);
  const [remindId, setRemindId] = useState<string | null>(null);
  const [daySel, setDaySel] = useState<{ habit: Habit; date: string } | null>(null);
  const [quote] = useState(() => pick(QUOTES));
  const [catalog, setCatalog] = useState(false);
  const [share, setShare] = useState<'week' | Habit | null>(null);
  const [live, setLive] = useState(true);
  const today = D.today();

  // локальные напоминания, пока вкладка открыта (push — через Edge Function)
  useReminders(habits, logs, profile);

  useEffect(() => setHabits(initHabits), [initHabits]);
  useEffect(() => setLogs(initLogs), [initLogs]);

  // P0-5: живой дашборд — отметки и привычки обновляются без F5
  useEffect(() => {
    if (!live || !profile) return;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void reloadRef.current?.(); }, 350);   // дебаунс серии событий
    };
    const ch = supabase
      .channel('today-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${profile.id}` }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${profile.id}` }, schedule)
      .subscribe();
    return () => { window.clearTimeout(timer); void supabase.removeChannel(ch); };
  }, [live, profile, supabase]);

  const reloadRef = useRef<(() => Promise<void>) | null>(null);
  const reload = useCallback(async () => {
    const [{ data: hs }, { data: ls }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', profile!.id).order('position'),
      supabase.from('habit_logs').select('id, habit_id, user_id, log_date, status, value, note').eq('user_id', profile!.id).gte('log_date', D.add(today, -400)),
    ]);
    setHabits((hs ?? []) as Habit[]);
    const map: LogMap = {};
    for (const l of (ls ?? []) as never[]) {
      const row = l as { habit_id: string; log_date: string };
      if (!map[row.habit_id]) map[row.habit_id] = {};
      map[row.habit_id][row.log_date] = l as never;
    }
    setLogs(map);
    router.refresh();
  }, [supabase, profile, router, today]);
  reloadRef.current = reload;

  const commitOrder = useCallback((next: string[]) => {
    setHabits((prev) => {
      const byId = new Map(prev.map((h) => [h.id, h]));
      const reordered = next
        .map((hid, i) => (byId.get(hid) ? { ...(byId.get(hid) as Habit), position: i } : null))
        .filter(Boolean) as Habit[];
      const rest = prev.filter((h) => !next.includes(h.id));
      return [...reordered, ...rest];
    });
    void reorderHabits(next)
      .then(() => toast.success('Порядок сохранён'))
      .catch(() => toast.error('Не удалось сохранить порядок'));
  }, []);

  const ghostRef = useRef<HTMLDivElement>(null);

  const active = habits.filter((h) => !h.archived);
  const due = active.filter((h) => dueOn(h, today));
  const done = due.filter((h) => logs[h.id]?.[today]?.status === 'done');
  const pct = due.length ? Math.round((done.length / due.length) * 100) : 0;
  const lv = levelOf(profile?.xp ?? 0);

  // цифра на иконке установленного PWA = сколько привычек осталось сегодня
  useAppBadge(due.length - done.length);

  const best = useMemo(
    () => active.map((h) => ({ h, s: streakOf(h, logs) })).sort((a, b) => b.s.cur - a.s.cur),
    [active, logs],
  );
  const totalChecks = useMemo(
    () => Object.values(logs).reduce((n, m) => n + Object.values(m).filter((l) => l.status === 'done').length, 0),
    [logs],
  );
  const rate30 = useMemo(() => {
    const rs = active.map((h) => rateOf(h, logs, 30)).filter((v): v is number => v !== null);
    return rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 100) : 0;
  }, [active, logs]);

  const list = filter === 'arch'
    ? habits.filter((h) => h.archived)
    : filter === 'due' ? due
    : filter === 'done' ? due.filter((h) => logs[h.id]?.[today]?.status === 'done')
    : filter === 'left' ? due.filter((h) => logs[h.id]?.[today]?.status !== 'done')
    : active;

  const listIds = list.map((h) => h.id);
  const dnd = usePointerReorder(listIds, commitOrder);

  // плавающий «призрак» перетаскиваемой строки (позиционируется в rAF, без ре-рендера на каждый пиксель)
  useEffect(() => {
    const g = ghostRef.current;
    if (!g) return;
    if (!dnd.draggingId) {
      g.style.display = 'none';
      g.innerHTML = '';
      return;
    }
    const src = document.querySelector<HTMLElement>(`[data-drag-id="${dnd.draggingId}"]`);
    if (!src) return;
    g.innerHTML = '';
    g.appendChild(src.cloneNode(true) as HTMLElement);
    g.style.display = 'block';

    let raf = 0;
    const place = () => {
      const r = src.getBoundingClientRect();
      g.style.width = `${r.width}px`;
      g.style.left = `${r.left}px`;
      g.style.top = `${r.top}px`;
    };
    place();
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = src.getBoundingClientRect();
        g.style.left = `${r.left}px`;
        g.style.top = `${e.clientY - r.height / 2}px`;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      g.innerHTML = '';
    };
  }, [dnd.draggingId]);

  return (
    <div className="p-4 lg:p-7">
      <div className="grid lg:grid-cols-[1.35fr_1fr] gap-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[28px] p-6 lg:p-7 border border-[var(--stroke2)]"
          style={{ background: 'linear-gradient(135deg, color-mix(in oklab, var(--acc) 22%, transparent), color-mix(in oklab, var(--acc3) 12%, transparent)), var(--card)' }}
        >
          <div className="absolute w-[340px] h-[340px] -right-28 -top-36 rounded-full opacity-30 blur-[30px] animate-[hv-float_18s_var(--ease)_infinite]" style={{ background: 'radial-gradient(circle, var(--acc), transparent 65%)' }} />
          <div className="relative flex flex-col sm:flex-row gap-6 items-start justify-between">
            <div className="min-w-0">
              <div className="text-[12.5px] text-[var(--muted)] uppercase tracking-[.16em]">{D.full(today)}</div>
              <div className="text-[clamp(38px,5vw,60px)] font-extrabold tracking-[-.045em] leading-none mt-2">
                {pct}<small className="text-[.42em] font-bold text-[var(--muted)]">%</small>
              </div>
              <p className="text-[var(--muted)] text-sm mt-1.5 max-w-[44ch]">
                {due.length === 0
                  ? 'На сегодня запланированных привычек нет. Отличный день, чтобы добавить новую 🌱'
                  : done.length === due.length
                    ? 'Идеальный день. Всё выполнено — ты машина! 🏆'
                    : `Осталось ${due.length - done.length} из ${due.length}. Каждый шаг считается.`}
              </p>
              <div className="flex gap-2.5 mt-5 flex-wrap">
                {[
                  [`${best[0]?.s.cur ?? 0}🔥`, 'лучший стрик'],
                  [String(totalChecks), 'всего отметок'],
                  [`${rate30}%`, 'за 30 дней'],
                  [`Lv ${lv.level}`, `${lv.into}/${lv.need} XP`],
                ].map(([v, l]) => (
                  <motion.div
                    key={l}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="flex-1 min-w-[104px] p-3 rounded-2xl bg-[var(--card)] border border-[var(--stroke)] hover:border-[var(--acc)] hover:shadow-[0_0_0_1px_var(--acc)] transition-colors"
                  >
                    <b className="block text-[21px] tracking-tight tabular">{v}</b>
                    <span className="text-[10.5px] text-[var(--muted)] uppercase tracking-[.09em]">{l}</span>
                  </motion.div>
                ))}
              </div>
            </div>
            <ProgressRing pct={pct} done={done.length} total={due.length} />
          </div>
        </motion.div>

        <div className="flex flex-col gap-4">
          <Card className="grid place-items-center py-5">
            <ProgressSphere pct={pct} habits={active.slice(0, 14)} />
            <div className="text-center mt-1">
              <b className="text-base">Сфера постоянства</b>
              <p className="text-xs text-[var(--muted)]">
                {pct >= 80 ? 'Ядро заряжено почти полностью' : pct >= 40 ? 'Энергия растёт — дожимай' : 'Заряди ядро — отметь привычки'}
              </p>
            </div>
          </Card>
          <Card className="relative overflow-hidden" style={{ background: 'linear-gradient(120deg, color-mix(in oklab, var(--acc2) 16%, transparent), transparent), var(--card)' }}>
            <span className="absolute right-3 -top-5 text-[96px] opacity-10 font-serif">“</span>
            <blockquote className="text-[16.5px] leading-snug font-semibold tracking-tight">{quote[0]}</blockquote>
            <cite className="block mt-2.5 not-italic text-[12.5px] text-[var(--muted)]">— {quote[1]}</cite>
          </Card>
        </div>
      </div>

      <div className="flex items-center gap-3 my-6">
        <h2 className="text-lg font-bold tracking-tight">Привычки</h2>
        <span className="flex-1 h-px bg-[linear-gradient(90deg,var(--stroke),transparent)]" />
        <Button size="sm" onClick={() => setShare('week')}>📤 Итог недели</Button>
        <Button size="sm" onClick={() => setCatalog(true)}>📚 Каталог</Button>
        <Button variant="primary" size="sm" onClick={() => setModal({ open: true, habit: null })}>＋ Добавить</Button>
      </div>

      <div className="flex gap-2 items-center flex-wrap mb-3.5">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</Chip>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setLive((v) => !v)}
          title="Обновление дашборда в реальном времени (Supabase Realtime)"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border border-[var(--stroke)] text-[var(--muted)] hover:border-[var(--acc)] hover:text-[var(--text)] transition-colors"
        >
          <span className={cn('w-[7px] h-[7px] rounded-full', live ? 'bg-[var(--ok)] animate-pulse' : 'bg-[var(--faint)]')} />
          {live ? 'Realtime вкл' : 'Realtime выкл'}
        </button>
        <span className="text-[11.5px] text-[var(--faint)]">{list.length} шт.</span>
      </div>

      {list.length ? (
        <div className="flex flex-col gap-3" ref={dnd.containerRef}>
          <AnimatePresence mode="popLayout">
            {list.map((h, i) => (
              <HabitRow
                key={h.id}
                habit={h}
                logs={logs}
                date={today}
                index={i}
                onChanged={() => { void reload(); }}
                onEdit={(id) => setModal({ open: true, habit: habits.find((x) => x.id === id) ?? null })}
                onStats={setStatsId}
                onRemind={setRemindId}
                onShare={(h) => setShare(h)}
                dragHandlers={dnd.handlersFor(h.id)}
                dragState={dnd.stateFor(h.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Empty
          icon="🌱"
          title={filter === 'arch' ? 'Архив пуст' : 'Пока пусто'}
          text="Добавь первую привычку — выбери эмодзи, цвет, расписание и напоминание. Дальше всё сделает стрик."
          action={<Button variant="primary" onClick={() => setModal({ open: true, habit: null })}>＋ Создать привычку</Button>}
        />
      )}

      <Card className="mt-6">
        <CardHead title="Быстрый обзор недели" sub="клик по ячейке — отметить задним числом" />
        <WeekTable habits={active.slice(0, 12)} logs={logs} onPick={(h, k) => setDaySel({ habit: h, date: k })} />
      </Card>

      <div
        ref={ghostRef}
        className="fixed z-[200] pointer-events-none opacity-95 shadow-[0_26px_60px_-16px_rgba(0,0,0,.75)] rotate-[-.7deg] scale-[1.02]"
        style={{ display: 'none' }}
        aria-hidden
      />

      <HabitModal
        open={modal.open}
        habit={modal.habit}
        accent={profile?.accent ?? 0}
        onClose={() => setModal({ open: false, habit: null })}
        onSaved={() => void reload()}
      />
      <HabitStatsSheet habitId={statsId} habits={habits} logs={logs} onClose={() => setStatsId(null)} />
      <CatalogSheet open={catalog} onClose={() => setCatalog(false)} habits={habits} onAdded={() => void reload()} />
      <ShareSheet
        open={!!share}
        onClose={() => setShare(null)}
        kind={typeof share === 'string' ? 'week' : 'habit'}
        habit={typeof share === 'string' ? null : share}
        logs={logs}
        habits={habits}
        profile={profile}
      />
      <ReminderSheet habit={habits.find((h) => h.id === remindId) ?? null} onClose={() => setRemindId(null)} onSaved={() => void reload()} />
      <DayHabitSheet
        habit={daySel?.habit ?? null}
        date={daySel?.date ?? today}
        log={daySel ? logs[daySel.habit.id]?.[daySel.date] ?? null : null}
        open={!!daySel}
        onClose={() => setDaySel(null)}
        onChanged={() => void reload()}
      />
    </div>
  );
}

function ProgressRing({ pct, done, total }: { pct: number; done: number; total: number }) {
  const R = 62;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative w-[150px] h-[150px] shrink-0 grid place-items-center">
      <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--acc)" />
            <stop offset="100%" stopColor="var(--acc2)" />
          </linearGradient>
        </defs>
        <circle cx="75" cy="75" r={R} fill="none" stroke="var(--stroke)" strokeWidth="11" />
        <motion.circle
          cx="75" cy="75" r={R} fill="none" stroke="url(#ringGrad)" strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C - (C * pct) / 100 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: 'drop-shadow(0 0 8px var(--acc))' }}
        />
      </svg>
      <div className="absolute text-center">
        <b className="block text-[29px] tracking-tight tabular">{done}/{total}</b>
        <span className="text-[10.5px] text-[var(--muted)] uppercase tracking-[.12em]">привычек</span>
      </div>
    </div>
  );
}

function WeekTable({ habits, logs, onPick }: { habits: Habit[]; logs: LogMap; onPick: (h: Habit, k: string) => void }) {
  const today = D.today();
  const keys = Array.from({ length: 7 }, (_, i) => D.add(today, -(6 - i)));
  if (!habits.length) return <p className="text-sm text-[var(--muted)]">Добавь привычки, чтобы увидеть неделю.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px] min-w-[540px]">
        <thead>
          <tr>
            <th className="text-left px-2.5 py-2 text-[var(--faint)] text-[11px] uppercase tracking-[.08em] font-bold">Привычка</th>
            {keys.map((k) => (
              <th key={k} className="px-1 py-2 text-center text-[11px] font-extrabold" style={{ color: k === today ? 'var(--acc)' : 'var(--faint)' }}>
                {WD_SHORT[D.dow(k)]}
                <br />
                <span className="font-semibold opacity-70 tabular">{D.parse(k).getDate()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {habits.map((h) => (
            <tr key={h.id} className="border-t border-[var(--stroke)]">
              <td className="px-2.5 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[190px]">
                <span style={{ color: h.color }}>{h.emoji}</span> {h.name}
              </td>
              {keys.map((k) => {
                const isDue = dueOn(h, k);
                const st = logs[h.id]?.[k]?.status ?? (isDue && k < today ? 'miss' : null);
                const bg = !isDue ? 'transparent' : st === 'done' ? h.color : st === 'skip' ? 'var(--warn)' : st === 'miss' ? 'var(--bad)' : 'var(--stroke)';
                return (
                  <td key={k} className="px-1 py-1.5 text-center">
                    <motion.button
                      whileHover={{ scale: k > today ? 1 : 1.22 }}
                      disabled={k > today}
                      onClick={() => onPick(h, k)}
                      title={`${h.name} · ${D.human(k)}${isDue ? '' : ' (не запланировано)'}`}
                      className="w-[26px] h-[26px] rounded-lg border border-[var(--stroke)] transition-colors disabled:cursor-not-allowed"
                      style={{ background: bg, opacity: !isDue ? 0.25 : st ? 0.92 : 0.5 }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
