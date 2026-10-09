import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/shell';

export const metadata: Metadata = {
  title: 'HabitVerse — личный дашборд продуктивности',
  description:
    'Спокойный трекер привычек: расписание, стрики, календарь, отчёты, заметки и челленджи. Без шума и геймификации.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FBFBFA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="snow" data-mode="light" data-density="cozy" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
