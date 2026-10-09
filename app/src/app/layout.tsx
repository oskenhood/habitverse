import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { Providers } from '@/components/providers';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'cyrillic'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'HabitVerse — трекер привычек', template: '%s · HabitVerse' },
  description:
    'Социальный трекер привычек: стрики, челленджи с друзьями, календарь, heatmap, отчёты и диаграммы, напоминания, блокнот и достижения.',
  keywords: ['привычки', 'трекер', 'habit tracker', 'челленджи', 'стрики', 'самодисциплина'],
  authors: [{ name: 'HabitVerse' }],
  manifest: '/manifest.webmanifest',
  applicationName: 'HabitVerse',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'HabitVerse' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  openGraph: {
    title: 'HabitVerse — привычки, которые держатся',
    description: 'Стрики, челленджи с друзьями, отчёты и напоминания. Тёмная тема, 3D-визуализация прогресса.',
    type: 'website',
    locale: 'ru_RU',
  },
};

export const viewport: Viewport = {
  themeColor: '#07080f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Тема применяется до гидратации — без «белой вспышки» */
const themeScript = `
(function(){
  try{
    var raw = localStorage.getItem('hv.theme');
    var t = raw ? JSON.parse(raw) : 'midnight';
    document.documentElement.dataset.theme = t.theme || 'midnight';
    document.documentElement.dataset.density = t.density || 'cozy';
    if (t.acc) document.documentElement.style.setProperty('--acc', t.acc);
  }catch(e){ document.documentElement.dataset.theme = 'midnight'; }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="midnight" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: 'var(--card-solid)',
              border: '1px solid var(--stroke2)',
              color: 'var(--text)',
              borderRadius: '15px',
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
            },
          }}
        />
      </body>
    </html>
  );
}
