/** Типы БД Supabase (соответствуют supabase/01_schema.sql) */

export type ThemeId = 'midnight' | 'abyss' | 'neon' | 'graphite' | 'paper';
export type DensityId = 'cozy' | 'compact';
export type FreqType = 'daily' | 'weekdays' | 'interval' | 'weekly' | 'monthly';
export type LogStatus = 'done' | 'skip' | 'miss';
export type CategoryId = 'health' | 'mind' | 'work' | 'disc' | 'social' | 'creo' | 'spirit' | 'money';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  emoji: string;
  bio: string;
  birth_date: string | null;
  xp: number;
  theme: ThemeId;
  accent: number;
  density: DensityId;
  sound: boolean;
  notif_enabled: boolean;
  digest_time: string;
  locale: string;
  timezone: string;
  privacy_feed: boolean;
  privacy_profile: boolean;
  onboarding_done: boolean;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  category: CategoryId;
  freq_type: FreqType;
  freq_days: number[];
  freq_every: number;
  start_date: string;
  end_date: string | null;
  target_count: number;
  target_unit: string;
  reminder_time: string | null;
  reminder_on: boolean;
  reminder_days: 'schedule' | 'everyday';
  difficulty: number;
  position: number;
  archived: boolean;
  /** true = привычка «НЕ делать»: отметка ✓ означает «сдержался» */
  is_negative: boolean;
  /** сколько провалов в календарный месяц прощается без разрыва стрика */
  freezes: number;
  /** недельная квота: сколько плановых дней в неделю достаточно закрыть (0 = выключено) */
  weekly_target: number;
  challenge_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  status: LogStatus;
  value: number | null;
  note: string;
  /** день «спасён» заморозкой стрика — учитывается при подсчёте месячного бюджета */
  frozen?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  habit_id: string | null;
  title: string;
  body: string;
  color: string;
  tags: string[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Challenge {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  start_date: string;
  end_date: string;
  habit_id: string | null;
  invite_code: string;
  is_public: boolean;
  status: 'active' | 'finished' | 'cancelled';
  max_members: number;
  created_at: string;
}

export interface ChallengeMember {
  challenge_id: string;
  user_id: string;
  joined_at: string;
  score: number;
  streak: number;
  place: number | null;
  profile?: Pick<Profile, 'display_name' | 'emoji' | 'avatar_url'>;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  accepted_at: string | null;
  profile?: Pick<Profile, 'id' | 'display_name' | 'emoji' | 'avatar_url' | 'xp'>;
}

export type FeedType =
  | 'checkin' | 'streak' | 'perfect' | 'level' | 'achievement'
  | 'challenge' | 'note' | 'newhabit' | 'nudge' | 'join';

export interface FeedEvent {
  id: number;
  user_id: string;
  type: FeedType;
  payload: Record<string, unknown>;
  is_public: boolean;
  created_at: string;
  profile?: Pick<Profile, 'display_name' | 'emoji' | 'avatar_url'>;
}

export interface Achievement {
  id: string;
  emoji: string;
  name: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  xp_reward: number;
  sort: number;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string;
  timezone: string;
  created_at: string;
}

export interface FeedReaction {
  id: string;
  event_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
}

export type CategoryRow = { id: CategoryId; name: string; emoji: string; color: string; sort: number };

export interface LeaderboardRow {
  id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  emoji: string;
  xp: number;
  level: number;
  done_30d: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      habits: {
        Row: Habit;
        Insert: Partial<Habit> & { user_id: string; name: string };
        Update: Partial<Habit>;
      };
      habit_logs: {
        Row: HabitLog;
        Insert: Partial<HabitLog> & { habit_id: string; user_id: string; log_date: string; status: LogStatus };
        Update: Partial<HabitLog>;
      };
      notes: { Row: Note; Insert: Partial<Note> & { user_id: string }; Update: Partial<Note> };
      challenges: {
        Row: Challenge;
        Insert: Partial<Challenge> & { creator_id: string; name: string; end_date: string };
        Update: Partial<Challenge>;
      };
      challenge_members: {
        Row: ChallengeMember;
        Insert: { challenge_id: string; user_id: string };
        Update: Partial<ChallengeMember>;
      };
      friendships: {
        Row: Friendship;
        Insert: Partial<Friendship> & { requester_id: string; addressee_id: string };
        Update: Partial<Friendship>;
      };
      feed_events: {
        Row: FeedEvent;
        Insert: Partial<FeedEvent> & { user_id: string; type: FeedType };
        Update: Partial<FeedEvent>;
      };
      achievements: { Row: Achievement; Insert: Achievement; Update: Partial<Achievement> };
      user_achievements: { Row: UserAchievement; Insert: UserAchievement; Update: Partial<UserAchievement> };
      categories: { Row: CategoryRow; Insert: never; Update: never };
      feed_reactions: {
        Row: FeedReaction;
        Insert: { event_id: number; user_id: string; emoji: string };
        Update: Partial<FeedReaction>;
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Partial<PushSubscriptionRow> & { user_id: string; endpoint: string; p256dh: string; auth: string };
        Update: Partial<PushSubscriptionRow>;
      };
    };
    Views: {
      v_today: {
        Row: Habit & {
          habit_id: string;
          today_status: LogStatus | null;
          today_value: number | null;
          today_note: string | null;
        };
      };
      v_leaderboard: { Row: LeaderboardRow };
    };
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean };
      current_streak: { Args: { p_habit: string }; Returns: number };
      habit_stats: {
        Args: { p_habit: string; p_days?: number };
        Returns: { due_days: number; done_days: number; rate: number; best_streak: number }[];
      };
      award_xp: { Args: { p_user: string; p_amount: number; p_reason?: string }; Returns: number };
      unlock_achievement: { Args: { p_user: string; p_achievement: string }; Returns: boolean };
      search_users: {
        Args: { q: string; p_limit?: number };
        Returns: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'emoji' | 'xp'>[];
      };
      join_challenge_by_code: { Args: { p_code: string }; Returns: string };
      finish_expired_challenges: { Args: Record<string, never>; Returns: number };
      recalc_challenge_score: { Args: { p_challenge: string }; Returns: undefined };
      week_start: { Args: { p_date: string }; Returns: string };
      week_progress: {
        Args: { p_habit: string; p_on?: string };
        Returns: { week_from: string; due_days: number; done_days: number; goal: number; is_ok: boolean }[];
      };
      weekly_streak: { Args: { p_habit: string; p_on?: string }; Returns: { cur_weeks: number; best_weeks: number }[] };
      streak_for: { Args: { p_habit: string; p_on?: string }; Returns: { value: number; unit: 'days' | 'weeks'; best: number }[] };
      is_due_on: { Args: { p_habit: string; p_date: string }; Returns: boolean };
      freezes_left: { Args: { p_habit: string; p_on?: string }; Returns: number };
      toggle_reaction: { Args: { p_event: number; p_emoji: string }; Returns: boolean };
    };
  };
}
