-- ============================================================
-- HabitVerse · 02 — Row Level Security
-- Приватность по умолчанию: чужие данные видны только друзьям.
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.friendships       enable row level security;
alter table public.habits            enable row level security;
alter table public.habit_logs        enable row level security;
alter table public.notes             enable row level security;
alter table public.challenges        enable row level security;
alter table public.challenge_members enable row level security;
alter table public.feed_events       enable row level security;
alter table public.achievements      enable row level security;
alter table public.user_achievements enable row level security;
alter table public.push_subscriptions enable row level security;

-- ------------------------------------------------------------
-- Хелпер: являются ли два пользователя друзьями
-- SECURITY DEFINER — чтобы сама функция не упиралась в RLS
-- ------------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
drop policy if exists "profiles: своя строка" on public.profiles;
create policy "profiles: своя строка" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: друзья видят" on public.profiles;
create policy "profiles: друзья видят" on public.profiles
  for select to authenticated using (
    privacy_profile = false and public.are_friends(id, auth.uid())
  );

drop policy if exists "profiles: публичный поиск" on public.profiles;
create policy "profiles: публичный поиск" on public.profiles
  for select to authenticated using (privacy_profile = false);

drop policy if exists "profiles: создание себя" on public.profiles;
create policy "profiles: создание себя" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles: правка себя" on public.profiles;
create policy "profiles: правка себя" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------
-- FRIENDSHIPS
-- ------------------------------------------------------------
drop policy if exists "friendships: вижу свои" on public.friendships;
create policy "friendships: вижу свои" on public.friendships
  for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "friendships: заявка" on public.friendships;
create policy "friendships: заявка" on public.friendships
  for insert to authenticated with check (requester_id = auth.uid());

drop policy if exists "friendships: принять/отклонить" on public.friendships;
create policy "friendships: принять/отклонить" on public.friendships
  for update to authenticated using (addressee_id = auth.uid() or requester_id = auth.uid())
  with check (addressee_id = auth.uid() or requester_id = auth.uid());

drop policy if exists "friendships: удалить" on public.friendships;
create policy "friendships: удалить" on public.friendships
  for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

-- ------------------------------------------------------------
-- HABITS — видны владельцу и друзьям (для общих челленджей)
-- ------------------------------------------------------------
drop policy if exists "habits: свои" on public.habits;
create policy "habits: свои" on public.habits
  for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

drop policy if exists "habits: в общем челлендже" on public.habits;
create policy "habits: в общем челлендже" on public.habits
  for select to authenticated using (
    challenge_id is not null and exists (
      select 1 from public.challenge_members m
      where m.challenge_id = habits.challenge_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "habits: создаю свои" on public.habits;
create policy "habits: создаю свои" on public.habits
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "habits: правлю свои" on public.habits;
create policy "habits: правлю свои" on public.habits
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "habits: удаляю свои" on public.habits;
create policy "habits: удаляю свои" on public.habits
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- HABIT_LOGS
-- ------------------------------------------------------------
drop policy if exists "logs: свои" on public.habit_logs;
create policy "logs: свои" on public.habit_logs
  for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

drop policy if exists "logs: создаю свои" on public.habit_logs;
create policy "logs: создаю свои" on public.habit_logs
  for insert to authenticated with check (user_id = auth.uid() and log_date <= current_date);

drop policy if exists "logs: правлю свои" on public.habit_logs;
create policy "logs: правлю свои" on public.habit_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "logs: удаляю свои" on public.habit_logs;
create policy "logs: удаляю свои" on public.habit_logs
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- NOTES — строго приватные, только владелец
-- ------------------------------------------------------------
drop policy if exists "notes: только свои" on public.notes;
create policy "notes: только свои" on public.notes
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- CHALLENGES
-- ------------------------------------------------------------
drop policy if exists "challenges: участник или публичный" on public.challenges;
create policy "challenges: участник или публичный" on public.challenges
  for select to authenticated using (
    is_public
    or creator_id = auth.uid()
    or exists (select 1 from public.challenge_members m
               where m.challenge_id = challenges.id and m.user_id = auth.uid())
  );

drop policy if exists "challenges: создаю" on public.challenges;
create policy "challenges: создаю" on public.challenges
  for insert to authenticated with check (creator_id = auth.uid());

drop policy if exists "challenges: правлю свой" on public.challenges;
create policy "challenges: правлю свой" on public.challenges
  for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists "challenges: удаляю свой" on public.challenges;
create policy "challenges: удаляю свой" on public.challenges
  for delete to authenticated using (creator_id = auth.uid());

-- ------------------------------------------------------------
-- CHALLENGE_MEMBERS
-- ------------------------------------------------------------
drop policy if exists "members: вижу участников" on public.challenge_members;
create policy "members: вижу участников" on public.challenge_members
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.challenge_members m2
               where m2.challenge_id = challenge_members.challenge_id and m2.user_id = auth.uid())
  );

drop policy if exists "members: вступаю сам" on public.challenge_members;
create policy "members: вступаю сам" on public.challenge_members
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "members: обновляю свой результат" on public.challenge_members;
create policy "members: обновляю свой результат" on public.challenge_members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members: выхожу сам" on public.challenge_members;
create policy "members: выхожу сам" on public.challenge_members
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- FEED_EVENTS
-- ------------------------------------------------------------
drop policy if exists "feed: свои и друзей" on public.feed_events;
create policy "feed: свои и друзей" on public.feed_events
  for select to authenticated using (
    user_id = auth.uid()
    or (is_public and public.are_friends(user_id, auth.uid()))
  );

drop policy if exists "feed: создаю свои" on public.feed_events;
create policy "feed: создаю свои" on public.feed_events
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "feed: удаляю свои" on public.feed_events;
create policy "feed: удаляю свои" on public.feed_events
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- ACHIEVEMENTS — справочник, читают все
-- ------------------------------------------------------------
drop policy if exists "achievements: справочник" on public.achievements;
create policy "achievements: справочник" on public.achievements
  for select to authenticated using (true);

drop policy if exists "user_achievements: свои" on public.user_achievements;
create policy "user_achievements: свои" on public.user_achievements
  for select to authenticated using (user_id = auth.uid() or public.are_friends(user_id, auth.uid()));

drop policy if exists "user_achievements: получаю свои" on public.user_achievements;
create policy "user_achievements: получаю свои" on public.user_achievements
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "user_achievements: удаляю свои" on public.user_achievements;
create policy "user_achievements: удаляю свои" on public.user_achievements
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- PUSH_SUBSCRIPTIONS — только свои
-- ------------------------------------------------------------
drop policy if exists "push: свои" on public.push_subscriptions;
create policy "push: свои" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
