import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Инлайновый CSS-кастом-проперти для цвета привычки (Tailwind не умеет динамические цвета) */
export const hc = (color: string) => ({ '--hc': color } as React.CSSProperties);

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

/** Детерминированный ПСЧ — для стабильных демо-данных */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
