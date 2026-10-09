import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadAppData } from '@/lib/data';
import { AppShell } from '@/components/app-shell-client';
import { ProfileView } from '@/components/profile/profile-view';
import { levelOf } from '@/lib/constants';

export const metadata: Metadata = { title: 'Личный кабинет' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await loadAppData();
  if (!data.profile) redirect('/login');
  const lv = levelOf(data.profile.xp);

  return (
    <AppShell profile={data.profile} title="Личный кабинет" subtitle={`${lv.level} уровень · ${data.profile.xp} XP`}>
      <ProfileView
        profile={data.profile}
        habits={data.habits}
        logs={data.logs}
        achievements={data.achievements}
        unlocked={data.unlocked}
      />
    </AppShell>
  );
}
