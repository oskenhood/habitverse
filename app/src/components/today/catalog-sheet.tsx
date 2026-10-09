'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PRESETS, type Preset } from '@/lib/constants';
import { freqLabel } from '@/lib/schedule';
import { D } from '@/lib/dates';
import { createHabit, type HabitDraft } from '@/lib/actions';
import { Button, Empty, Input, Pill } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/overlays';
import type { Habit } from '@/types/database';

const toDraft = (p: Preset): HabitDraft => ({
  name: p.name,
  emoji: p.emoji,
  color: p.color,
  description: p.description,
  category: p.category,
  freq_type: p.freq_type,
  freq_days: p.freq_days,
  freq_every: p.freq_every ?? 1,
  start_date: D.today(),
  end_date: null,
  target_count: p.target_count ?? 1,
  target_unit: p.target_unit ?? '',
  reminder_time: p.reminder_time ?? null,
  reminder_on: !!p.reminder_time,
  reminder_days: 'schedule',
  difficulty: p.difficulty,
  archived: false,
  is_negative: !!p.is_negative,
  freezes: 2,
  weekly_target: p.weekly_target ?? 0,
});

/** Каталог готовых привычек: 30 формулировок в 7 группах, добавление в один клик */
export function CatalogSheet({
  open,
  onClose,
  habits,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  habits: Habit[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const existing = useMemo(() => new Set(habits.map((h) => h.name.toLowerCase())), [habits]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PRESETS.map((g) => ({
      ...g,
      items: g.items.filter((it) => !needle || `${it.name} ${it.description}`.toLowerCase().includes(needle)),
    })).filter((g) => g.items.length);
  }, [q]);

  const total = PRESETS.reduce((n, g) => n + g.items.length, 0);

  const add = async (p: Preset) => {
    if (existing.has(p.name.toLowerCase())) {
      toast.info('Такая привычка уже есть');
      return;
    }
    setBusy(p.name);
    try {
      await createHabit(toDraft(p));
      toast.success(`${p.emoji} «${p.name}» добавлена · +20 XP`);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось добавить');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} icon="📚" title="Каталог привычек">
      <p className="text-[13px] text-[var(--muted)] -mt-1 mb-4 leading-relaxed">
        Готовые формулировки с расписанием, сложностью и недельной целью. Клик — и привычка добавлена, потом можно докрутить.
      </p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Поиск по ${total} привычкам…`} className="mb-4" />

      {groups.length ? (
        <div className="max-h-[52vh] overflow-auto pr-1">
          {groups.map((g) => (
            <div key={g.group} className="mb-4">
              <h4 className="text-[12px] uppercase tracking-[.09em] text-[var(--faint)] font-bold mb-2">{g.group}</h4>
              {g.items.map((it) => {
                const has = existing.has(it.name.toLowerCase());
                return (
                  <button
                    key={it.name}
                    type="button"
                    disabled={busy === it.name}
                    onClick={() => void add(it)}
                    className="w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3.5 py-2.5 rounded-[14px] bg-[var(--card)] border border-[var(--stroke)] mb-1.5 text-left transition-all duration-300 hover:border-[var(--acc)] hover:translate-x-1 hover:shadow-[0_10px_26px_-16px_var(--acc)] disabled:opacity-50"
                    style={has ? { opacity: 0.5 } : undefined}
                  >
                    <span className="text-[22px]">{it.emoji}</span>
                    <span className="min-w-0">
                      <b className="block text-[13.5px] truncate">
                        {it.name} {has && <Pill className="ml-1">уже есть</Pill>}
                      </b>
                      <small className="block text-[11.5px] text-[var(--muted)] mt-0.5 truncate">
                        {it.description} · {freqLabel({ freq_type: it.freq_type, freq_days: it.freq_days, freq_every: it.freq_every ?? 1 })}
                        {it.weekly_target ? ` · ${it.weekly_target} из 7 в неделю` : ''}
                      </small>
                    </span>
                    <span className="text-lg font-extrabold text-[var(--acc)]">{busy === it.name ? '…' : has ? '✓' : '＋'}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <Empty icon="🔍" title="Ничего не нашлось" text={`По запросу «${q}» совпадений нет. Попробуйте другое слово.`} />
      )}

      <div className="flex justify-end mt-4">
        <Button onClick={onClose}>Готово</Button>
      </div>
    </Sheet>
  );
}
