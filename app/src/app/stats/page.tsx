import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { AppShell } from '@/components/app-shell-client';
import { StatsView } from '@/components/stats/stats-view';

export const metadata: Metadata = { title: 'Отчёты' };
export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData();
  if (!data.profile) redirect('/login');

  return (
    <AppShell profile={data.profile} title="Отчёты" subtitle="Прогресс, графики и достижения">
      <StatsView
        habits={data.habits}
        logs={data.logs}
        profile={data.profile}
        achievements={data.achievements}
        unlocked={data.unlocked}
      />
    </AppShell>
  );
}
