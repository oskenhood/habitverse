-- ============================================================
-- HabitVerse · 01 — расширения и таблицы
-- Запуск: Supabase Studio → SQL Editor → New query → вставить → Run
--         либо `supabase db push` / `psql $DATABASE_URL -f supabase/schema.sql`
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";          -- поиск по названию привычки
create extension if not exists "pg_cron";          -- расписание push-рассылок

-- ------------------------------------------------------------
-- ПРОФИЛИ (1:1 с auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text unique,
  display_name    text not null default '',
  avatar_url      text,
  emoji           text not null default '🙂',
  bio             text not null default '',
  birth_date      date,
  xp              integer not null default 0,
  theme           text not null default 'midnight'
                  check (theme in ('midnight','abyss','neon','graphite','paper')),
  accent          integer not null default 0,
  density         text not null default 'cozy' check (density in ('cozy','compact')),
  sound           boolean not null default true,
  notif_enabled   boolean not null default false,
  digest_time     time not null default '20:00',
  locale          text not null default 'ru',
  timezone        text not null default 'Europe/Moscow',
  privacy_feed    boolean not null default true,
  privacy_profile boolean not null default false,
  onboarding_done boolean not null default false,
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.profiles is 'Публичный профиль пользователя: аватар, описание, дата рождения, настройки темы и уведомлений';

-- ------------------------------------------------------------
-- ДРУЗЬБА
-- ------------------------------------------------------------
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending'
                check (status in ('pending','accepted','blocked')),
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_pair_unique unique (requester_id, addressee_id)
);

create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx    on public.friendships (status);

-- ------------------------------------------------------------
-- ПРИВЫЧКИ
-- ------------------------------------------------------------
create table if not exists public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 60),
  emoji          text not null default '✨',
  color          text not null default '#7c5cff',
  description    text not null default '',
  category       text not null default 'health',
  -- daily | weekdays | interval | weekly | monthly
  freq_type      text not null default 'daily'
                 check (freq_type in ('daily','weekdays','interval','weekly','monthly')),
  freq_days      integer[] not null default '{}',   -- weekdays: 0=Пн … 6=Вс; monthly: 1..31
  freq_every     integer not null default 1,        -- interval: каждые N дней
  start_date     date not null default current_date,
  end_date       date,                              -- необязательный дедлайн
  target_count   numeric not null default 1 check (target_count between 1 and 100000),
  target_unit    text not null default '',
  reminder_time  time,
  reminder_on    boolean not null default true,
  reminder_days  text not null default 'schedule'
                 check (reminder_days in ('schedule','everyday')),
  difficulty     smallint not null default 1 check (difficulty between 1 and 5),
  position       integer not null default 0,
  archived       boolean not null default false,
  challenge_id   uuid,                              -- заполняется после создания challenges
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists habits_user_idx          on public.habits (user_id) where archived = false;
create index if not exists habits_user_archived_idx on public.habits (user_id, archived);
create index if not exists habits_name_trgm_idx     on public.habits using gin (name gin_trgm_ops);

-- ------------------------------------------------------------
-- ОТМЕТКИ (выполнение привычки за конкретный день)
-- ------------------------------------------------------------
create table if not exists public.habit_logs (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid not null references public.habits (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  log_date    date not null,
  status      text not null check (status in ('done','skip','miss')),
  value       numeric,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint habit_logs_unique unique (habit_id, log_date),
  constraint habit_logs_not_future check (log_date <= current_date + 1)
);

create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc);
create index if not exists habit_logs_habit_idx     on public.habit_logs (habit_id, log_date desc);

-- ------------------------------------------------------------
-- ЗАМЕТКИ / БЛОКНОТ
-- ------------------------------------------------------------
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  habit_id    uuid references public.habits (id) on delete set null,
  title       text not null default '',
  body        text not null default '',
  color       text not null default '',
  tags        text[] not null default '{}',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_user_idx      on public.notes (user_id, pinned desc, updated_at desc);
create index if not exists notes_tags_idx      on public.notes using gin (tags);
create index if not exists notes_body_trgm_idx on public.notes using gin (body gin_trgm_ops);

-- ------------------------------------------------------------
-- ЧЕЛЛЕНДЖИ
-- ------------------------------------------------------------
create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  description  text not null default '',
  emoji        text not null default '🔥',
  color        text not null default '#ff5c8a',
  start_date   date not null default current_date,
  end_date     date not null,
  habit_id     uuid references public.habits (id) on delete set null,
  invite_code  text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8)),
  is_public    boolean not null default false,
  status       text not null default 'active' check (status in ('active','finished','cancelled')),
  max_members  integer not null default 50,
  created_at   timestamptz not null default now(),
  constraint challenges_dates check (end_date >= start_date)
);

create index if not exists challenges_creator_idx on public.challenges (creator_id);
create index if not exists challenges_status_idx  on public.challenges (status, end_date);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  score        numeric not null default 0,      -- % выполнения за период
  streak       integer not null default 0,
  place        integer,
  primary key (challenge_id, user_id)
);

-- ------------------------------------------------------------
-- ЛЕНТА АКТИВНОСТИ
-- ------------------------------------------------------------
create table if not exists public.feed_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  -- checkin | streak | perfect | level | achievement | challenge | note | newhabit | nudge | join
  payload     jsonb not null default '{}'::jsonb,
  is_public   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists feed_events_user_idx    on public.feed_events (user_id, created_at desc);
create index if not exists feed_events_created_idx on public.feed_events (created_at desc);

-- ------------------------------------------------------------
-- ДОСТИЖЕНИЯ
-- ------------------------------------------------------------
create table if not exists public.achievements (
  id          text primary key,          -- 's7', 'perfect', 'c500' …
  emoji       text not null,
  name        text not null,
  description text not null,
  tier        text not null default 'bronze' check (tier in ('bronze','silver','gold','platinum')),
  xp_reward   integer not null default 0,
  sort        integer not null default 0
);

create table if not exists public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ------------------------------------------------------------
-- PUSH-ПОДПИСКИ (Web Push / VAPID)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text not null default '',
  timezone   text not null default 'Europe/Moscow',
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ------------------------------------------------------------
-- FOREIGN KEY, который мы отложили (habits.challenge_id)
-- ------------------------------------------------------------
alter table public.habits
  drop constraint if exists habits_challenge_fk;
alter table public.habits
  add constraint habits_challenge_fk foreign key (challenge_id)
  references public.challenges (id) on delete set null;

create index if not exists habits_challenge_idx on public.habits (challenge_id);
