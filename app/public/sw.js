/* HabitVerse — Service Worker: офлайн-кэш оболочки + Web Push */
const CACHE = 'habitverse-v1';
const APP_SHELL = ['/', '/dashboard', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(APP_SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* stale-while-revalidate для GET: мгновенная отрисовка + фоновое обновление */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isApi = url.pathname.startsWith('/api') || url.hostname.endsWith('.supabase.co');

  if (!sameOrigin && !isApi) return;
  if (isApi) return; // запросы к Supabase не кэшируем — данные должны быть свежими

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.url, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/dashboard') || caches.match('/'))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});

/* ---------------- Web Push ---------------- */
self.addEventListener('push', (event) => {
  let data = { title: 'HabitVerse', body: 'Пора отмечать привычки 🔥', url: '/dashboard', tag: 'hv' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* не-JSON payload */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: data.url },
      vibrate: [60, 40, 60],
      renotify: true,
      requireInteraction: false,
      actions: [
        { action: 'open', title: 'Открыть' },
        { action: 'done', title: '✓ Готово' },
      ],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';

  if (event.action === 'done') {
    // передаём в приложение команду «отметить первую невыполненную привычку»
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        const client = list[0];
        if (client) {
          client.postMessage({ type: 'quick-done' });
          return client.focus();
        }
        return self.clients.openWindow(`${target}?quickDone=1`);
      }),
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
