import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { AppShell } from '@/components/app-shell-client';
import { NotesView } from '@/components/notes/notes-view';

export const metadata: Metadata = { title: 'Заметки' };
export const dynamic = 'force-dynamic';

export default async function NotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData();
  if (!data.profile) redirect('/login');

  return (
    <AppShell profile={data.profile} title="Заметки" subtitle={`${data.notes.length} записей в блокноте`} badges={{ notes: data.notes.length }}>
      <NotesView notes={data.notes} habits={data.habits} />
    </AppShell>
  );
}
