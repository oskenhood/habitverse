import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { AppShell } from '@/components/app-shell-client';
import { FeedView } from '@/components/feed/feed-view';

export const metadata: Metadata = { title: 'Лента' };
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData({ withFeed: true, withSocial: true });
  if (!data.profile) redirect('/login');

  return (
    <AppShell profile={data.profile} title="Лента" subtitle="Что происходит у тебя и у команды">
      <FeedView
        feed={data.feed}
        habits={data.habits}
        me={data.profile}
        reactions={data.reactions}
        onReload={() => { /* серверный компонент: обновляем через router.refresh в клиенте */ }}
      />
    </AppShell>
  );
}
