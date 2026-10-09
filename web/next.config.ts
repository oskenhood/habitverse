import type { NextConfig } from 'next';

// Внимание: в песочнице ~1 ГБ RAM, поэтому сборка только через `next build --webpack`
// (Turbopack ловит SIGKILL). Не добавлять сюда webpack-конфиг — ломает сборку (см. HANDOFF, грабли Next.js).
//
// Два режима сборки (переключаются переменной окружения, по умолчанию — серверный):
//   npm run build   → обычная серверная сборка (.next), запуск `next start`
//   npm run export  → HV_EXPORT=1, статический экспорт в out/ (любой статический хостинг)
// trailingSlash в режиме экспорта: маршруты становятся папками с index.html —
// работает на любом статик-хостинге без rewrite-правил.
// Статический экспорт возможен, потому что все страницы клиентские ('use client'),
// данные живут в localStorage, useSearchParams/next-headers не используются.
const nextConfig: NextConfig =
  process.env.HV_EXPORT === '1'
    ? { output: 'export', trailingSlash: true, images: { unoptimized: true } }
    : {};

export default nextConfig;
