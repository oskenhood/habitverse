/* HabitVerse service worker — офлайн-кэш + основа для Web Push */
const CACHE = 'habitverse-v1';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* network-first для навигации, cache-first для статики */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});

/* ---- Web Push (для полной версии на Supabase) ----
   Edge Function шлёт: { title, body, url, tag }
   Подписка хранится в таблице public.push_subscriptions. */
self.addEventListener('push', e => {
  let data = { title: 'HabitVerse', body: 'Пора отмечать привычки 🔥', url: './', tag: 'hv' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    icon: './manifest.webmanifest',
    badge: './manifest.webmanifest',
    data: { url: data.url },
    vibrate: [60, 40, 60],
    renotify: true,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'done', title: '✓ Готово' }
    ]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'done') {
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(cl => {
        if (cl[0]) { cl[0].postMessage({ type: 'quick-done' }); return cl[0].focus(); }
        return self.clients.openWindow(e.notification.data.url || './');
      })
    );
    return;
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(cl => {
      if (cl[0]) return cl[0].focus();
      return self.clients.openWindow(e.notification.data.url || './');
    })
  );
});
