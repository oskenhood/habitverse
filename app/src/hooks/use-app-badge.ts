'use client';

import { useEffect } from 'react';

/**
 * Badging API — цифра на иконке установленного PWA.
 * Показывает, сколько привычек осталось выполнить сегодня.
 *
 * Поддержка: Chrome/Edge/Samsung Internet (desktop + Android).
 * Safari/iOS пока не поддерживает — вызов просто ничего не делает.
 */
export function useAppBadge(count: number) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav?.setAppBadge) return;

    const run = async () => {
      try {
        if (count > 0) await nav.setAppBadge?.(count);
        else await nav.clearAppBadge?.();
      } catch {
        /* браузер может отказать, если приложение не установлено */
      }
    };
    void run();

    return () => { void nav.clearAppBadge?.().catch(() => undefined); };
  }, [count]);
}
