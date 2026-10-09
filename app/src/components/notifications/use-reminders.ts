'use client';

import { useEffect, useRef } from 'react';
import { D } from '@/lib/dates';
import { dueOn } from '@/lib/schedule';
import { isDone, type LogMap } from '@/lib/stats';
import { notifyLocal } from './push';
import type { Habit, Profile } from '@/types/database';

/**
 * Двойная страховка напоминаний:
 *  1) Web Push из Supabase Edge Function (работает при закрытом браузере);
 *  2) локальный тикер, пока вкладка открыта — мгновенно и без сервера.
 */
export function useReminders(habits: Habit[], logs: LogMap, profile: Profile | null) {
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.notif_enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const tick = () => {
      const now = new Date();
      const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = D.today();

      habits
        .filter((h) => !h.archived && h.reminder_on && h.reminder_time)
        .forEach((h) => {
          const time = (h.reminder_time ?? '').slice(0, 5);
          if (time !== hm) return;
          if (h.reminder_days === 'schedule' && !dueOn(h, today)) return;
          const key = `${h.id}|${today}|${time}`;
          if (fired.current.has(key) || isDone(logs, h.id, today)) return;
          fired.current.add(key);
          notifyLocal(`${h.emoji} ${h.name}`, h.description || 'Пора отмечать — стрик ждёт 🔥', h.id);
        });

      // вечерняя сводка
      const digest = (profile.digest_time ?? '20:00').slice(0, 5);
      const dKey = `digest|${today}`;
      if (hm === digest && !fired.current.has(dKey)) {
        fired.current.add(dKey);
        const due = habits.filter((h) => !h.archived && dueOn(h, today));
        const left = due.filter((h) => !isDone(logs, h.id, today));
        if (left.length) {
          notifyLocal(
            '📋 Итоги дня',
            left.length === due.length
              ? `Сегодня ничего не отмечено. Начни с одной: ${left[0].emoji} ${left[0].name}`
              : `Осталось ${left.length} из ${due.length}: ${left.map((h) => h.emoji).join(' ')}`,
            'digest',
          );
        } else if (due.length) {
          notifyLocal('🏆 Идеальный день!', 'Все привычки выполнены. Так держать!', 'digest');
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 20_000);
    return () => window.clearInterval(id);
  }, [habits, logs, profile]);
}
