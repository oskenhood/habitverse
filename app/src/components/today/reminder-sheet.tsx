'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { freqLabel } from '@/lib/schedule';
import { updateHabit } from '@/lib/actions';
import { Button, Field, Input, SettingRow, Toggle } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/overlays';
import { subscribePush } from '@/components/notifications/push';
import type { Habit } from '@/types/database';

export function ReminderSheet({
  habit,
  onClose,
  onSaved,
}: {
  habit: Habit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [time, setTime] = useState('');
  const [on, setOn] = useState(true);
  const [onlySchedule, setOnlySchedule] = useState(true);

  useEffect(() => {
    if (!habit) return;
    setTime(habit.reminder_time ? habit.reminder_time.slice(0, 5) : '');
    setOn(habit.reminder_on);
    setOnlySchedule(habit.reminder_days !== 'everyday');
  }, [habit]);

  if (!habit) return null;

  const save = async () => {
    try {
      if (on && time) {
        const ok = await subscribePush();
        if (!ok) toast.error('Не удалось включить push — проверь разрешение браузера');
      }
      await updateHabit(habit.id, {
        reminder_time: time ? `${time}:00` : null,
        reminder_on: on,
        reminder_days: onlySchedule ? 'schedule' : 'everyday',
      });
      toast.success(time ? `Напоминание в ${time}` : 'Напоминание выключено');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  return (
    <Sheet open={!!habit} onClose={onClose} icon="⏰" title="Напоминание">
      <p className="text-sm text-[var(--muted)] -mt-2 mb-4">{habit.emoji} {habit.name} · {freqLabel(habit)}</p>
      <Field label="Время" hint="Оставь пустым, чтобы выключить напоминание">
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Field>
      <SettingRow title="Push-уведомления" desc="Придут даже при закрытой вкладке">
        <Toggle on={on} onChange={setOn} label="Push" />
      </SettingRow>
      <SettingRow title="Только в дни расписания" desc="Иначе — каждый день">
        <Toggle on={onlySchedule} onChange={setOnlySchedule} label="Дни расписания" />
      </SettingRow>
      <div className="flex justify-end gap-2 mt-5">
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="primary" onClick={save}>Сохранить</Button>
      </div>
    </Sheet>
  );
}
