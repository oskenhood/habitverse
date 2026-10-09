import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { D } from '@/lib/dates';
import { dueOn } from '@/lib/schedule';
import { isDone } from '@/lib/stats';
import { AppShell } from '@/components/app-shell-client';
import { TodayView } from '@/components/today/today-view';

export const metadata: Metadata = { title: 'Сегодня' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData();
  if (!data.profile) redirect('/login');
  if (!data.profile.onboarding_done) redirect('/profile?onboarding=1');

  const today = D.today();
  const active = data.habits.filter((h) => !h.archived);
  const due = active.filter((h) => dueOn(h, today));
  const left = due.filter((h) => !isDone(data.logs, h.id, today)).length;

  return (
    <AppShell
      profile={data.profile}
      title="Сегодня"
      subtitle={`${D.full(today)} · ${due.length - left} из ${due.length} выполнено`}
      badges={{ today: left, notes: data.notes.length }}
    >
      <TodayView habits={data.habits} logs={data.logs} profile={data.profile} />
    </AppShell>
  );
}
