'use client';

/**
 * Web Push (VAPID) — подписка браузера и сохранение её в Supabase.
 * Ключи генерируются так:  npx web-push generate-vapid-keys
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  → в переменные Vercel (public)
 *   VAPID_PRIVATE_KEY              → в секреты Supabase Edge Functions
 */

import { createClient } from '@/lib/supabase/client';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

export async function subscribePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY не задан');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));

  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const supabase = createClient();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow',
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('[push] не удалось сохранить подписку', error.message);
    return false;
  }
  return true;
}

export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const supabase = createClient();
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

/** Локальное напоминание, когда вкладка открыта (работает даже без push-инфраструктуры) */
export function notifyLocal(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, tag, icon: '/icon.svg', badge: '/icon.svg' });
  } catch {
    /* некоторые браузеры требуют showNotification через SW */
    void navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body, tag, icon: '/icon.svg' }));
  }
}
