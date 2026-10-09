import { createClient } from '@/lib/supabase/server';
import { D } from '@/lib/dates';
import { buildLogMap, type LogMap } from '@/lib/stats';
import type { Achievement, Challenge, ChallengeMember, FeedEvent, Habit, Note, Profile, UserAchievement } from '@/types/database';

export interface AppData {
  profile: Profile | null;
  habits: Habit[];
  logs: LogMap;
  notes: Note[];
  challenges: (Challenge & { members: (ChallengeMember & { profile?: Pick<Profile, 'display_name' | 'emoji' | 'avatar_url'> })[] })[];
  feed: FeedEvent[];
  achievements: Achievement[];
  unlocked: UserAchievement[];
  friends: { id: string; display_name: string; emoji: string; avatar_url: string | null; xp: number; relation: 'incoming' | 'outgoing' | 'accepted'; friendship_id: string }[];
  leaderboard: { id: string; display_name: string; emoji: string; avatar_url: string | null; xp: number; level: number; done_30d: number }[];
  /** реакции ленты: event_id → { emoji → { count, mine } } */
  reactions: Record<number, Record<string, { count: number; mine: boolean }>>;
}

const HISTORY_DAYS = 400;

/** Единая точка загрузки данных для всех страниц приложения */
export async function loadAppData(opts: { withFeed?: boolean; withSocial?: boolean } = {}): Promise<AppData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, habits: [], logs: {}, notes: [], challenges: [], feed: [], achievements: [], unlocked: [], friends: [], leaderboard: [], reactions: {} };
  }

  const from = D.add(D.today(), -HISTORY_DAYS);

  const [profileRes, habitsRes, logsRes, notesRes, achRes, unlockedRes, challengesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('habits').select('*').eq('user_id', user.id).order('position', { ascending: true }),
    supabase.from('habit_logs').select('id, habit_id, user_id, log_date, status, value, note').eq('user_id', user.id).gte('log_date', from),
    supabase.from('notes').select('*').eq('user_id', user.id).order('pinned', { ascending: false }).order('updated_at', { ascending: false }),
    supabase.from('achievements').select('*').order('sort'),
    supabase.from('user_achievements').select('*').eq('user_id', user.id),
    supabase.from('challenges').select('*, members:challenge_members(*, profile:profiles(display_name, emoji, avatar_url))').order('created_at', { ascending: false }),
  ]);

  const challenges = (challengesRes.data ?? []) as AppData['challenges'];

  let feed: FeedEvent[] = [];
  let friends: AppData['friends'] = [];
  let leaderboard: AppData['leaderboard'] = [];
  let reactions: AppData['reactions'] = {};

  if (opts.withFeed || opts.withSocial) {
    const friendRes = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, profiles!friendships_requester_id_fkey(id, display_name, emoji, avatar_url, xp)')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const rows = (friendRes.data ?? []) as unknown as {
      id: string;
      requester_id: string;
      addressee_id: string;
      status: string;
      profiles?: Pick<Profile, 'id' | 'display_name' | 'emoji' | 'avatar_url' | 'xp'> | Pick<Profile, 'id' | 'display_name' | 'emoji' | 'avatar_url' | 'xp'>[] | null;
    }[];

    friends = rows
      .map((r) => {
        const otherId = r.requester_id === user.id ? r.addressee_id : r.requester_id;
        const p = Array.isArray(r.profiles) ? r.profiles.find((x) => x.id === otherId) : r.profiles;
        if (!p || p.id !== otherId) return null;
        return {
          id: p.id,
          display_name: p.display_name,
          emoji: p.emoji,
          avatar_url: p.avatar_url,
          xp: p.xp,
          friendship_id: r.id,
          relation: r.status === 'accepted' ? ('accepted' as const) : r.requester_id === user.id ? ('outgoing' as const) : ('incoming' as const),
        };
      })
      .filter(Boolean) as AppData['friends'];

    const lbRes = await supabase.from('v_leaderboard').select('*').order('xp', { ascending: false }).limit(25);
    leaderboard = (lbRes.data ?? []) as AppData['leaderboard'];

    if (opts.withFeed) {
      const ids = [user.id, ...friends.filter((f) => f.relation === 'accepted').map((f) => f.id)];
      const feedRes = await supabase
        .from('feed_events')
        .select('*, profile:profiles!feed_events_user_id_fkey(display_name, emoji, avatar_url)')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(80);
      feed = (feedRes.data ?? []) as unknown as FeedEvent[];

      if (feed.length) {
        const ids = feed.map((f) => f.id);
        const { data: rx } = await supabase.from('feed_reactions').select('*').in('event_id', ids);
        for (const r of (rx ?? []) as { event_id: number; user_id: string; emoji: string }[]) {
          if (!reactions[r.event_id]) reactions[r.event_id] = {};
          const cell = (reactions[r.event_id][r.emoji] ??= { count: 0, mine: false });
          cell.count += 1;
          if (r.user_id === user.id) cell.mine = true;
        }
      }
    }
  }

  return {
    profile: profileRes.data,
    habits: habitsRes.data ?? [],
    logs: buildLogMap((logsRes.data ?? []) as never),
    notes: notesRes.data ?? [],
    challenges,
    feed,
    achievements: achRes.data ?? [],
    unlocked: unlockedRes.data ?? [],
    friends,
    leaderboard,
    reactions,
  };
}
