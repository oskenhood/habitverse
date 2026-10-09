'use client';

import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D, WD } from '@/lib/dates';
import { dueOn, freqLabel } from '@/lib/schedule';
import { catOf } from '@/lib/constants';
import { freezesLeft, streakOf, type LogMap } from '@/lib/stats';
import { deleteHabit, duplicateHabit, setLog, updateHabit } from '@/lib/actions';
import { Button, Pill } from '@/components/ui/primitives';
import { ConfirmDialog, Sheet } from '@/components/ui/overlays';
import type { Habit } from '@/types/database';
import { Textarea, Input } from '@/components/ui/primitives';

const STATUS_NEXT: Record<string, 'done' | 'skip' | 'miss' | null> = { '': 'done', done: 'skip', skip: 'miss', miss: null };
const STATUS_ICON = { done: '✓', skip: '⤼', miss: '✕' } as const;

export function CheckButton({
  status,
  color,
  emoji,
  size = 'md',
  disabled,
  negative,
  onClick,
}: {
  status: 'done' | 'skip' | 'miss' | null;
  color: string;
  emoji: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
  negative?: boolean;
  onClick: () => void;
}) {
  const dim = size === 'sm' ? 'w-9 h-9 rounded-xl text-[15px]' : 'w-[46px] h-[46px] rounded-[15px] text-[22px]';
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.1, rotate: disabled ? 0 : -6 }}
      whileTap={{ scale: 0.9 }}
      disabled={disabled}
      onClick={onClick}
      aria-label={status === 'done' ? 'Снять отметку' : 'Отметить'}
      className={cn(
        dim,
        'grid place-items-center shrink-0 border-2 transition-all duration-300 disabled:opacity-40',
        status === 'done' && 'text-white border-transparent shadow-[0_8px_22px_-8px_var(--hc)]',
        status === 'skip' && 'text-[var(--warn)] border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_20%,transparent)]',
        status === 'miss' && 'text-[var(--bad)] border-[var(--bad)] bg-[color-mix(in_oklab,var(--bad)_18%,transparent)]',
        !status && 'bg-[var(--bg2)] border-[var(--stroke2)] text-[var(--muted)] hover:border-[var(--hc)]',
      )}
      style={{ ...(status === 'done' ? { background: color, ['--hc' as string]: color } : { ['--hc' as string]: color }) }}
    >
      <span className={status ? 'hv-pop' : 'opacity-90'}>{status ? (status === 'done' && negative ? '🛡' : STATUS_ICON[status]) : emoji}</span>
    </motion.button>
  );
}

export function WeekDots({ habit, today }: { habit: { freq_type: string; freq_days: number[] }; today: string }) {
  const active = habit.freq_type === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : habit.freq_type === 'weekdays' ? habit.freq_days : [];
  return (
    <div className="flex gap-1">
      {WD.map((d, i) => (
        <i
          key={d}
          className={cn(
            'w-[19px] h-[19px] rounded-md grid place-items-center text-[9.5px] not-italic font-extrabold transition-all duration-300',
            active.includes(i) ? 'text-white bg-[var(--hc)]' : 'bg-[var(--bg2)] border border-[var(--stroke)] text-[var(--faint)]',
            D.dow(today) === i && 'scale-110 shadow-[0_0_0_2px_var(--hc)]',
          )}
        >
          {d[0]}
        </i>
      ))}
    </div>
  );
}

export function HistoryStrip({ habit, logs, days = 14 }: { habit: { id: string }; logs: LogMap; days?: number }) {
  const today = D.today();
  return (
    <div className="flex gap-[3px] items-end" title={`последние ${days} дней`}>
      {Array.from({ length: days }, (_, i) => D.add(today, -(days - 1 - i))).map((k) => {
        const st = logs[habit.id]?.[k]?.status;
        const h = st === 'done' ? 20 : st === 'skip' ? 12 : st === 'miss' ? 7 : 20;
        return (
          <i
            key={k}
            title={`${D.human(k)}${st ? ` · ${st}` : ''}`}
            className={cn('w-[9px] rounded-[3px] transition-all duration-300', st === 'done' ? 'bg-[var(--hc)]' : st === 'skip' ? 'bg-[var(--warn)]' : st === 'miss' ? 'bg-[var(--bad)] opacity-60' : 'bg-[var(--stroke)]')}
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}

export function HabitRow({
  habit,
  logs,
  date,
  onChanged,
  onEdit,
  onStats,
  onRemind,
  onShare,
  index,
  dragHandlers,
  dragState,
}: {
  habit: import('@/types/database').Habit;
  logs: LogMap;
  date: string;
  onChanged: () => void;
  onEdit: (id: string) => void;
  onStats: (id: string) => void;
  onRemind: (id: string) => void;
  onShare?: (habit: Habit) => void;
  index: number;
  dragHandlers?: {
    onPointerDown?: (e: React.PointerEvent) => void;
    onPointerMove?: (e: React.PointerEvent) => void;
    onPointerUp?: (e: React.PointerEvent) => void;
    onPointerCancel?: (e: React.PointerEvent) => void;
  };
  dragState?: 'dragging' | 'before' | 'after' | null;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [menu, setMenu] = useState(false);
  const log = logs[habit.id]?.[date];
  const status = log?.status ?? null;
  const st = streakOf(habit, logs);
  const cat = catOf(habit.category);
  const isDue = dueOn(habit, date);

  const cycle = async () => {
    if (busy) return;
    const next = STATUS_NEXT[status ?? ''];
    setBusy(true);
    const prev = logs[habit.id]?.[date];
    const makeRow = (status: 'done' | 'skip' | 'miss') => ({
      id: prev?.id ?? 'tmp',
      habit_id: habit.id,
      user_id: habit.user_id,
      log_date: date,
      status,
      value: prev?.value ?? null,
      note: prev?.note ?? '',
      created_at: prev?.created_at ?? '',
      updated_at: prev?.updated_at ?? '',
    });
    if (!logs[habit.id]) logs[habit.id] = {};
    if (next) logs[habit.id][date] = makeRow(next);
    else delete logs[habit.id][date];
    onChanged();
    try {
      const res = await setLog(habit.id, date, next, prev?.value ?? null, prev?.note ?? '');
      if (next === 'done') {
        toast.success(`+${res.xpDelta} XP · ${habit.emoji} ${habit.name}${st.cur + 1 >= 3 ? ` · 🔥 ${st.cur + 1}` : ''}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    /* Framer Motion перехватывает onDrag* собственными типами (PanInfo),
       поэтому для HTML5 drag-and-drop используем обычный элемент:
       анимацию появления/исключения делает AnimatePresence в родителе. */
    <article
      data-index={index}
      data-drag-id={habit.id}
      onPointerMove={dragHandlers?.onPointerMove}
      onPointerUp={dragHandlers?.onPointerUp}
      onPointerCancel={dragHandlers?.onPointerCancel}
      className={cn(
        'relative grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-4 items-center p-4 rounded-[var(--r-lg)] border overflow-hidden transition-all duration-300 hover:-translate-y-[3px] hover:shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)]',
        habit.archived ? 'opacity-45 grayscale-[.7]' : '',
        status === 'done' ? 'border-[var(--stroke2)]' : 'border-[var(--stroke)]',
        status === 'miss' && !isDue ? 'opacity-60' : '',
        dragState === 'dragging' && 'opacity-30 border-dashed border-[var(--acc)]',
        dragState === 'before' && 'shadow-[0_-3px_0_0_var(--acc)] translate-y-1',
        dragState === 'after' && 'shadow-[0_3px_0_0_var(--acc)] -translate-y-1',
      )}
      style={{
        ['--hc' as string]: habit.color,
        background: status === 'done'
          ? `linear-gradient(100deg, color-mix(in oklab, ${habit.color} 14%, transparent), transparent 60%), var(--card)`
          : 'var(--card)',
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300" style={{ background: habit.color }} />

      <CheckButton status={status} color={habit.color} emoji={habit.emoji} negative={habit.is_negative} onClick={cycle} disabled={busy} />

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15.5px] font-bold tracking-tight truncate">
            <span className="mr-1.5 inline-block transition-transform duration-300 hover:scale-125">{habit.emoji}</span>
            {habit.name}
          </span>
          {habit.target_count > 1 && (
            <span className="text-xs text-[var(--muted)] font-bold tabular">
              {log?.value ?? 0}/{habit.target_count} {habit.target_unit}
            </span>
          )}
          {habit.is_negative && <Pill tone="bad">🚫 не делать</Pill>}
          {habit.archived && <Pill>архив</Pill>}
          {!isDue && !status && <Pill>не сегодня</Pill>}
        </div>
        {habit.description && <p className="text-[12.8px] text-[var(--muted)] mt-1 truncate">{habit.description}</p>}
        <div className="flex gap-1.5 items-center mt-2 flex-wrap">
          <Pill style={{ color: cat.color, borderColor: `${cat.color}55` }}>{cat.emoji} {cat.name}</Pill>
          <Pill>{freqLabel(habit)}</Pill>
          {habit.reminder_time && <Pill tone={habit.reminder_on ? 'ok' : 'none'}>⏰ {habit.reminder_time.slice(0, 5)}</Pill>}
          <Pill tone="warn">🔥 {st.cur}{st.weekly ? ' нед.' : ''}</Pill>
          {st.weekly && st.week && (
            <Pill tone={st.week.ok ? 'ok' : st.week.done >= st.week.goal - 1 ? 'warn' : 'none'}>
              📅 {st.week.done}/{st.week.goal} нед.
            </Pill>
          )}
          <div className="hidden sm:block ml-1"><HistoryStrip habit={habit} logs={logs} /></div>
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 justify-between sm:justify-end">
        <div className="flex flex-col items-center min-w-[52px] px-2 py-1.5 rounded-[13px] bg-[var(--bg2)] border border-[var(--stroke)]"
          style={st.cur >= 7 ? { borderColor: 'color-mix(in oklab, var(--warn) 50%, transparent)', background: 'color-mix(in oklab, var(--warn) 12%, transparent)' } : undefined}>
          <b className={cn('text-base leading-none tabular', !st.weekly && st.cur >= 7 && 'text-[var(--warn)]')}>{st.cur}</b>
          <span className="text-[9px] text-[var(--faint)] uppercase tracking-[.08em] mt-1">{st.weekly ? 'недель' : 'стрик'}</span>
        </div>
        <div className="hidden md:block"><WeekDots habit={habit} today={date} /></div>

        <span
          data-drag-handle={habit.id}
          onPointerDown={dragHandlers?.onPointerDown}
          title="Перетащите, чтобы изменить порядок (работает и пальцем)"
          className="grid place-items-center w-[26px] h-[34px] cursor-grab active:cursor-grabbing text-[var(--faint)] opacity-40 hover:opacity-100 hover:text-[var(--acc)] hover:bg-[var(--card)] rounded-lg transition-all select-none shrink-0"
          style={{ touchAction: 'none' }}
        >⠿</span>
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="w-[34px] h-[34px] rounded-[11px] grid place-items-center text-[var(--faint)] hover:bg-[var(--card)] hover:text-[var(--text)] hover:scale-110 transition-all" aria-label="Меню">⋯</button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[210px] p-1.5 rounded-[14px] bg-[var(--card-solid)] border border-[var(--stroke2)] shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)]">
                {[
                  ['✏️ Редактировать', () => onEdit(habit.id)],
                  ['📋 Дублировать', async () => { await duplicateHabit(habit.id); toast.success('Скопировано'); onChanged(); }],
                  ['📈 История и статистика', () => onStats(habit.id)],
                  ['📤 Поделиться карточкой', () => onShare?.(habit)],
                  ['⏰ Напоминание', () => onRemind(habit.id)],
                  [habit.archived ? '📤 Вернуть из архива' : '📥 В архив', async () => { await updateHabit(habit.id, { archived: !habit.archived }); toast.success(habit.archived ? 'Возвращено' : 'В архиве'); onChanged(); }],
                  ['🗑️ Удалить', () => setConfirmDel(true)],
                ].map(([label, fn]) => (
                  <button
                    key={label as string}
                    onClick={() => { setMenu(false); (fn as () => void)(); }}
                    className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[13.5px] font-semibold text-left transition-colors',
                      label === '🗑️ Удалить' ? 'text-[var(--bad)] hover:bg-[color-mix(in_oklab,var(--bad)_18%,transparent)]' : 'text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--acc)_16%,transparent)] hover:text-[var(--text)]')}
                  >
                    {label as string}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={async () => { await deleteHabit(habit.id); toast.success('Привычка удалена'); onChanged(); }}
        title="Удалить привычку?"
        text={`«${habit.name}» и вся её история отметок будут удалены безвозвратно.`}
      />
    </article>
  );
}

/** Отметка конкретной привычки за произвольную дату (backfill) */
export function DayHabitSheet({
  habit,
  date,
  log,
  open,
  onClose,
  onChanged,
}: {
  habit: import('@/types/database').Habit | null;
  date: string;
  log: { status?: string; value?: number | null; note?: string } | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [value, setValue] = useState<number>(log?.value ?? 0);
  const [note, setNote] = useState<string>(log?.note ?? '');

  if (!habit) return null;
  const save = async (status: 'done' | 'skip' | 'miss' | null) => {
    try {
      await setLog(habit.id, date, status, habit.target_count > 1 ? value : null, note);
      if (status === 'done') toast.success(`${habit.emoji} Отмечено за ${D.human(date)}`);
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} icon={habit.emoji} title={habit.name}>
      <p className="text-sm text-[var(--muted)] -mt-2 mb-4">{D.full(date)}{dueOn(habit, date) ? '' : ' · не запланировано'}</p>
      {habit.target_count > 1 && (
        <label className="block mb-3.5">
          <span className="block text-[11.5px] font-bold text-[var(--muted)] mb-1.5 uppercase tracking-[.08em]">Количество ({habit.target_unit || 'шт'})</span>
          <Input type="number" min={0} step={1} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </label>
      )}
      <label className="block mb-4">
        <span className="block text-[11.5px] font-bold text-[var(--muted)] mb-1.5 uppercase tracking-[.08em]">Заметка ко дню</span>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Как прошло? Что мешало?" />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button variant={log?.status === 'done' ? 'primary' : 'ghost'} onClick={() => save('done')}>✓ Выполнено</Button>
        <Button variant={log?.status === 'skip' ? 'primary' : 'ghost'} onClick={() => save('skip')}>⤼ Пропуск</Button>
        <Button variant={log?.status === 'miss' ? 'primary' : 'ghost'} onClick={() => save('miss')}>✕ Провал</Button>
        <Button onClick={() => save(null)}>Сбросить</Button>
      </div>
      <p className="text-[11.5px] text-[var(--faint)] mt-4">Отметки за прошлые даты влияют на стрик и статистику — как в HabitLink 2.0.</p>
    </Sheet>
  );
}
