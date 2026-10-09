'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D, WD } from '@/lib/dates';
import { DIFFICULTY, FREQ_PRESETS, freqLabel } from '@/lib/schedule';
import { CATEGORIES, COLORS, EMOJIS, catOf } from '@/lib/constants';
import { createHabit, updateHabit, type HabitDraft } from '@/lib/actions';
import { Button, Chip, Field, Input, Pill, Select, SettingRow, Textarea, Toggle } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/overlays';
import type { CategoryId, FreqType, Habit } from '@/types/database';

const TABS = [
  { id: 'main', label: 'Основное' },
  { id: 'look', label: 'Внешний вид' },
  { id: 'sched', label: 'Расписание' },
  { id: 'rem', label: 'Напоминания' },
] as const;

const emptyDraft = (accent: number): HabitDraft => ({
  name: '',
  emoji: '✨',
  color: COLORS[accent % COLORS.length],
  description: '',
  category: 'health',
  freq_type: 'daily',
  freq_days: [],
  freq_every: 1,
  start_date: D.today(),
  end_date: null,
  target_count: 1,
  target_unit: '',
  reminder_time: null,
  reminder_on: true,
  reminder_days: 'schedule',
  difficulty: 1,
  archived: false,
  is_negative: false,
  freezes: 2,
  weekly_target: 0,
});

const fromHabit = (h: Habit): HabitDraft => ({
  name: h.name,
  emoji: h.emoji,
  color: h.color,
  description: h.description,
  category: h.category,
  freq_type: h.freq_type,
  freq_days: h.freq_days ?? [],
  freq_every: h.freq_every ?? 1,
  start_date: h.start_date,
  end_date: h.end_date,
  target_count: Number(h.target_count) || 1,
  target_unit: h.target_unit,
  reminder_time: h.reminder_time ? h.reminder_time.slice(0, 5) : null,
  reminder_on: h.reminder_on,
  reminder_days: h.reminder_days,
  difficulty: h.difficulty,
  archived: h.archived,
  is_negative: h.is_negative,
  freezes: h.freezes ?? 2,
  weekly_target: h.weekly_target ?? 0,
});

export function HabitModal({
  open,
  onClose,
  habit,
  accent,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit | null;
  accent: number;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('main');
  const [d, setD] = useState<HabitDraft>(() => (habit ? fromHabit(habit) : emptyDraft(accent)));
  const [emojiCat, setEmojiCat] = useState('Спорт');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setD(habit ? fromHabit(habit) : emptyDraft(accent));
    setTab('main');
  }, [open, habit, accent]);

  const set = <K extends keyof HabitDraft>(k: K, v: HabitDraft[K]) => setD((p) => ({ ...p, [k]: v }));
  const preview = useMemo(() => ({ ...d, name: d.name || 'Название привычки' }), [d]);
  const cat = catOf(preview.category);

  const askNotification = async () => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    const p = await Notification.requestPermission();
    return p === 'granted';
  };

  const save = async () => {
    if (!d.name.trim()) {
      toast.error('Введи название привычки');
      setTab('main');
      return;
    }
    if (d.reminder_time && d.reminder_on) await askNotification();
    setSaving(true);
    try {
      if (habit) {
        await updateHabit(habit.id, d);
        toast.success('Изменения сохранены');
      } else {
        await createHabit(d);
        toast.success('Привычка создана · +20 XP');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={d.emoji}
      title={habit ? 'Редактировать привычку' : 'Новая привычка'}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Сохраняем…' : habit ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5 mb-5">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</Chip>
        ))}
      </div>

      {tab === 'main' && (
        <div className="hv-rise">
          <Field label="Название *">
            <Input value={d.name} onChange={(e) => set('name', e.target.value)} maxLength={60} placeholder="Например: Утренняя пробежка" autoFocus />
          </Field>
          <Field label="Описание / зачем" hint="Описание помогает не бросить в тяжёлый день.">
            <Textarea value={d.description} onChange={(e) => set('description', e.target.value)} maxLength={280} placeholder="Зачем тебе эта привычка? Как поймёшь, что получилось?" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Категория">
              <Select value={d.category} onChange={(e) => set('category', e.target.value as CategoryId)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </Select>
            </Field>
            <Field label="Сложность">
              <Select value={d.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>
                {DIFFICULTY.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
              </Select>
            </Field>
            <Field label="Цель за день">
              <Input type="number" min={1} max={99999} value={d.target_count} onChange={(e) => set('target_count', Math.max(1, Number(e.target.value)))} />
            </Field>
            <Field label="Единица">
              <Input value={d.target_unit} onChange={(e) => set('target_unit', e.target.value)} maxLength={14} placeholder="страниц, минут, стаканов" />
            </Field>
          </div>
        </div>
      )}

      {tab === 'look' && (
        <div className="hv-rise">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.keys(EMOJIS).map((c) => (
              <Chip key={c} active={emojiCat === c} onClick={() => setEmojiCat(c)}>{c}</Chip>
            ))}
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 max-h-[210px] overflow-auto p-1 mb-4">
            {EMOJIS[emojiCat].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => set('emoji', e)}
                className={cn(
                  'aspect-square rounded-[11px] text-[21px] grid place-items-center border transition-all duration-200 hover:scale-[1.22] hover:-rotate-6',
                  d.emoji === e ? 'bg-[var(--acc)] border-[var(--acc)] scale-110' : 'bg-[var(--bg2)] border-[var(--stroke)] hover:border-[var(--acc)]',
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <Field label="Своя иконка (эмодзи или символ)">
            <Input maxLength={4} placeholder="🦄" onChange={(e) => e.target.value.trim() && set('emoji', e.target.value.trim())} />
          </Field>
          <Field label="Цвет">
            <div className="flex flex-wrap gap-2 items-center">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={cn('w-[34px] h-[34px] rounded-[11px] transition-transform duration-300 hover:scale-110 hover:rotate-6 relative', d.color === c && 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--card-solid)] scale-110')}
                  style={{ background: c }}
                  aria-label={c}
                >
                  {d.color === c && <span className="absolute inset-0 grid place-items-center text-white font-black text-sm drop-shadow">✓</span>}
                </button>
              ))}
              <input type="color" value={d.color} onChange={(e) => set('color', e.target.value)} className="w-[34px] h-[34px] rounded-[11px] border-none bg-transparent cursor-pointer" title="Свой цвет" />
            </div>
          </Field>

          <div className="glass rounded-[var(--r)] p-3.5 mt-2">
            <div className="text-[10.5px] text-[var(--faint)] uppercase tracking-[.08em] mb-2.5">Предпросмотр</div>
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[var(--card)] border border-[var(--stroke)]" style={{ borderLeft: `4px solid ${d.color}` }}>
              <span className="w-10 h-10 rounded-xl grid place-items-center text-white text-lg" style={{ background: d.color }}>✓</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[15px] font-bold truncate">
                  <span>{d.emoji}</span><span className="truncate">{preview.name}</span>
                  {d.target_count > 1 && <span className="text-xs text-[var(--muted)]">0/{d.target_count} {d.target_unit}</span>}
                  {d.is_negative && <Pill tone="bad">🚫 не делать</Pill>}
                  {(d.weekly_target ?? 0) > 0 && <Pill tone="warn">📅 {d.weekly_target} из 7 / нед</Pill>}
                </div>
                {d.description && <p className="text-[12.5px] text-[var(--muted)] truncate">{d.description}</p>}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Pill style={{ color: cat.color, borderColor: `${cat.color}55` }}>{cat.emoji} {cat.name}</Pill>
                  <Pill>{freqLabel(d as never)}</Pill>
                  {d.reminder_time && <Pill tone="ok">⏰ {d.reminder_time}</Pill>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'sched' && (
        <div className="hv-rise">
          <Field label="Частота">
            <Select
              value={d.freq_type}
              onChange={(e) => {
                const t = e.target.value as FreqType;
                set('freq_type', t);
                set('freq_days', t === 'weekdays' ? [0, 1, 2, 3, 4] : t === 'monthly' ? [1] : t === 'weekly' ? [0] : []);
              }}
            >
              <option value="daily">Каждый день</option>
              <option value="weekdays">Выбранные дни недели</option>
              <option value="interval">Каждые N дней</option>
              <option value="weekly">Раз в неделю</option>
              <option value="monthly">Числа месяца</option>
            </Select>
          </Field>

          {d.freq_type === 'weekdays' && (
            <>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {WD.map((w, i) => (
                  <Chip key={w} active={d.freq_days.includes(i)} onClick={() => set('freq_days', d.freq_days.includes(i) ? d.freq_days.filter((x) => x !== i) : [...d.freq_days, i].sort())}>
                    {w}
                  </Chip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {FREQ_PRESETS.map((p) => (
                  <Chip key={p.id} onClick={() => set('freq_days', p.days)}>{p.label}</Chip>
                ))}
              </div>
            </>
          )}

          {d.freq_type === 'weekly' && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {WD.map((w, i) => (
                <Chip key={w} active={(d.freq_days[0] ?? 0) === i} onClick={() => set('freq_days', [i])}>{w}</Chip>
              ))}
            </div>
          )}

          {d.freq_type === 'interval' && (
            <Field label="Каждые N дней">
              <Input type="number" min={1} max={60} value={d.freq_every} onChange={(e) => set('freq_every', Math.max(1, Number(e.target.value)))} />
            </Field>
          )}

          {d.freq_type === 'monthly' && (
            <Field label="Числа месяца (через запятую)" hint="Например: 1, 15, 28">
              <Input
                value={d.freq_days.join(', ')}
                onChange={(e) => set('freq_days', e.target.value.split(',').map((x) => Math.min(31, Math.max(1, parseInt(x, 10) || 1))))}
              />
            </Field>
          )}

          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Дата старта" hint="Стрик считается отсюда">
              <Input type="date" max={D.today()} value={d.start_date} onChange={(e) => set('start_date', e.target.value)} />
            </Field>
            <Field label="Дата окончания (опционально)">
              <Input type="date" value={d.end_date ?? ''} onChange={(e) => set('end_date', e.target.value || null)} />
            </Field>
          </div>

          <Field
            label="📅 Недельная цель (0 = выключена)"
            hint="Сколько плановых дней в неделю достаточно закрыть. С квотой стрик считается НЕДЕЛЯМИ, а сверхплановые пропуски его не рвут. Пример: «бег по будням, 3 из 5»."
          >
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[0, 1, 2, 3, 4, 5, 7].map((n) => (
                <Chip key={n} active={(d.weekly_target ?? 0) === n} onClick={() => set('weekly_target', n)}>
                  {n === 0 ? 'выкл' : `${n} из 7`}
                </Chip>
              ))}
            </div>
            <Input
              type="number" min={0} max={7}
              value={d.weekly_target}
              onChange={(e) => set('weekly_target', Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
            />
          </Field>
          <Field label="🧊 Заморозок стрика в месяц" hint="Сколько провалов (✕) в календарный месяц прощается без разрыва стрика. 0 — жёсткий режим, рекомендация — 2. День без отметки заморозкой не спасается: поставьте ✕ вручную.">
            <Input type="number" min={0} max={31} value={d.freezes} onChange={(e) => set('freezes', Math.max(0, Math.min(31, Number(e.target.value) || 0)))} />
          </Field>
          <SettingRow title="Архивирована" desc="Скрыть из списка, но сохранить историю">
            <Toggle on={d.archived} onChange={(v) => set('archived', v)} label="Архив" />
          </SettingRow>
        </div>
      )}

      {tab === 'rem' && (
        <div className="hv-rise">
          <SettingRow title="Напоминание" desc="Web Push даже при закрытой вкладке">
            <Toggle on={d.reminder_on} onChange={async (v) => { if (v) await askNotification(); set('reminder_on', v); }} label="Напоминание" />
          </SettingRow>
          <Field label="Время">
            <Input type="time" value={d.reminder_time ?? ''} onChange={(e) => set('reminder_time', e.target.value || null)} />
          </Field>
          <Field label="Когда напоминать">
            <Select value={d.reminder_days} onChange={(e) => set('reminder_days', e.target.value as 'schedule' | 'everyday')}>
              <option value="schedule">Только в дни расписания</option>
              <option value="everyday">Каждый день</option>
            </Select>
          </Field>
          <div className="glass rounded-[var(--r)] p-4 mt-2">
            <b className="text-[13px]">Как это работает</b>
            <p className="text-[12px] text-[var(--muted)] mt-2 leading-relaxed">
              Браузер хранит подписку в таблице <code className="text-[var(--acc2)]">push_subscriptions</code>.
              Supabase Cron каждые 15 минут вызывает Edge Function <code className="text-[var(--acc2)]">send-reminders</code>,
              которая находит привычки с наступившим временем и шлёт Web Push (VAPID). Плюс ежедневная сводка в выбранное время.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
