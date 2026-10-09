'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Background, Sidebar, Topbar } from '@/components/app-shell';
import { Themed } from '@/components/providers';
import type { Profile } from '@/types/database';

/**
 * Клиентская оболочка для всех страниц приложения:
 * sidebar + topbar + живой профиль (тема подхватывается мгновенно).
 */
export function AppShell({
  profile: initial,
  title,
  subtitle,
  badges,
  right,
  children,
}: {
  profile: Profile;
  title: string;
  subtitle?: string;
  badges?: { today?: number; notes?: number };
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile>(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const ch = supabase
      .channel(`profile-${initial.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${initial.id}` }, (p) => {
        setProfile((prev) => ({ ...prev, ...(p.new as Profile) }));
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase, initial.id]);

  return (
    <Themed profile={profile}>
      <Background />
      <div className="flex min-h-dvh">
        <Sidebar profile={profile} badges={badges ?? {}} open={open} onNavigate={() => setOpen(false)} />
        <main className="flex-1 min-w-0 flex flex-col">
          <Topbar title={title} subtitle={subtitle} profile={profile} onMenu={() => setOpen((v) => !v)} right={right} />
          <div className="flex-1 min-w-0">{children}</div>
          <footer className="px-4 lg:px-7 pb-8 pt-2 text-[11.5px] text-[var(--faint)] flex flex-wrap gap-x-3 gap-y-1">
            <span>HabitVerse · Next.js + Supabase</span>
            <Link href="/profile" className="hover:text-[var(--acc2)]">Настройки</Link>
            <Link href="/stats" className="hover:text-[var(--acc2)]">Отчёты</Link>
            <span className="ml-auto">Горячие клавиши: N — новая привычка, 1…7 — разделы</span>
          </footer>
        </main>
      </div>
    </Themed>
  );
}
