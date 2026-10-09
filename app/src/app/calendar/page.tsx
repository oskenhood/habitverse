import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { AppShell } from '@/components/app-shell-client';
import { CalendarView } from '@/components/calendar/calendar-view';

export const metadata: Metadata = { title: 'Календарь' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData();
  if (!data.profile) redirect('/login');

  return (
    <AppShell profile={data.profile} title="Календарь" subtitle="История, heatmap и отметки задним числом">
      <CalendarView habits={data.habits} logs={data.logs} profile={data.profile} />
    </AppShell>
  );
}
