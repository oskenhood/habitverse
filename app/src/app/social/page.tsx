import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { AppShell } from '@/components/app-shell-client';
import { SocialView } from '@/components/social/social-view';

export const metadata: Metadata = { title: 'Челленджи и друзья' };
export const dynamic = 'force-dynamic';

export default async function SocialPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData({ withSocial: true });
  if (!data.profile) redirect('/login');

  return (
    <AppShell
      profile={data.profile}
      title="Челленджи и друзья"
      subtitle={`${data.challenges.filter((c) => c.status === 'active').length} активных · ${data.friends.filter((f) => f.relation === 'accepted').length} друзей`}
    >
      <SocialView
        profile={data.profile}
        challenges={data.challenges}
        friends={data.friends}
        leaderboard={data.leaderboard}
        habits={data.habits}
        logs={data.logs}
      />
    </AppShell>
  );
}
