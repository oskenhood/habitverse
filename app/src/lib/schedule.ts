import { D } from './dates';
import type { FreqType, Habit } from '@/types/database';

const WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export interface Freq {
  type: FreqType;
  /** weekdays: 0=Пн…6=Вс · monthly: 1..31 · weekly: [0..6] */
  days: number[];
  every: number;
}

export const habitFreq = (h: Pick<Habit, 'freq_type' | 'freq_days' | 'freq_every'>): Freq => ({
  type: h.freq_type,
  days: h.freq_days ?? [],
  every: h.freq_every ?? 1,
});

/** Запланирована ли привычка на конкретную дату */
export function dueOn(h: Pick<Habit, 'freq_type' | 'freq_days' | 'freq_every' | 'start_date' | 'archived' | 'end_date'>, key: string): boolean {
  if (h.archived) return false;
  const start = h.start_date || key;
  if (key < start) return false;
  if (h.end_date && key > h.end_date) return false;

  switch (h.freq_type) {
    case 'daily':
      return true;
    case 'weekdays': {
      const days = h.freq_days?.length ? h.freq_days : [0, 1, 2, 3, 4];
      return days.includes(D.dow(key));
    }
    case 'interval': {
      const n = Math.max(1, h.freq_every || 1);
      return D.diff(start, key) % n === 0;
    }
    case 'weekly':
      return D.dow(key) === ((h.freq_days?.[0] ?? 0) % 7);
    case 'monthly': {
      const days = h.freq_days?.length ? h.freq_days : [1];
      return days.includes(D.parse(key).getDate());
    }
    default:
      return true;
  }
}

export const dueDays = (h: Habit, from: string, to: string) => D.range(from, to).filter((k) => dueOn(h, k));

export function freqLabel(h: Pick<Habit, 'freq_type' | 'freq_days' | 'freq_every'>): string {
  switch (h.freq_type) {
    case 'daily':
      return 'Каждый день';
    case 'weekdays': {
      const days = h.freq_days ?? [];
      if (days.length === 7) return 'Каждый день';
      return days.slice().sort().map((i) => WD_SHORT[i]).join(', ');
    }
    case 'interval':
      return `Каждые ${h.freq_every || 1} дн.`;
    case 'weekly':
      return `Раз в неделю, ${WD_SHORT[(h.freq_days?.[0] ?? 0) % 7]}`;
    case 'monthly':
      return (h.freq_days?.length ? h.freq_days : [1]).map((d) => `${d}-е число`).join(', ');
    default:
      return 'Каждый день';
  }
}

/** Пресеты расписания для модалки */
export const FREQ_PRESETS: { id: string; label: string; days: number[] }[] = [
  { id: 'all', label: 'Каждый день', days: [0, 1, 2, 3, 4, 5, 6] },
  { id: 'work', label: 'Будни', days: [0, 1, 2, 3, 4] },
  { id: 'wkd', label: 'Выходные', days: [5, 6] },
  { id: 'mwf', label: 'Пн / Ср / Пт', days: [0, 2, 4] },
  { id: 'tts', label: 'Вт / Чт / Сб', days: [1, 3, 5] },
];

export const DIFFICULTY = [
  { v: 1, label: '★☆☆☆☆ лёгкая' },
  { v: 2, label: '★★☆☆☆ обычная' },
  { v: 3, label: '★★★☆☆ заметная' },
  { v: 4, label: '★★★★☆ тяжёлая' },
  { v: 5, label: '★★★★★ хардкор' },
];
