'use client';

import { createClient } from '@/lib/supabase/client';
import { COLORS } from '@/lib/constants';
import { useEffect, type ReactNode } from 'react';
import type { DensityId, Profile, ThemeId } from '@/types/database';

/** Регистрируем Service Worker (PWA + Web Push) */
function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const onReady = () => navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    if (document.readyState === 'complete') onReady();
    else window.addEventListener('load', onReady, { once: true });
    return () => window.removeEventListener('load', onReady);
  }, []);
}

/** Синхронизируем тему/акцент/плотность с <html> и localStorage (для анти-FOWL скрипта) */
export function useApplyTheme(profile: Pick<Profile, 'theme' | 'accent' | 'density'> | null) {
  useEffect(() => {
    if (!profile) return;
    const root = document.documentElement;
    const theme = (profile.theme || 'midnight') as ThemeId;
    const density = (profile.density || 'cozy') as DensityId;
    root.dataset.theme = theme;
    root.dataset.density = density;
    const acc = COLORS[profile.accent % COLORS.length];
    root.style.setProperty('--acc', acc);
    try {
      localStorage.setItem('hv.theme', JSON.stringify({ theme, density, acc }));
    } catch {
      /* приватный режим */
    }
  }, [profile]);
}

/** Следим за сменой сессии (вход/выход в другой вкладке) */
function useAuthListener() {
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();
  useAuthListener();
  return <>{children}</>;
}

/** Обёртка для страниц приложения: применяет тему профиля */
export function Themed({ profile, children }: { profile: Pick<Profile, 'theme' | 'accent' | 'density'> | null; children: ReactNode }) {
  useApplyTheme(profile);
  return <>{children}</>;
}
