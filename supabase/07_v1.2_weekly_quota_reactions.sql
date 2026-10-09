-- ============================================================
-- HabitVerse · 07 — v1.2.0
--   ① недельная квота «M из N» (надстройка над любой частотой)
--   ② реакции в ленте
--
-- Выполните ПОСЛЕ 01…06. Скрипт идемпотентен.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Недельная цель
--    0 / NULL = квота выключена, стрик считается днями (как раньше).
--    1…7      = сколько ПЛАНОВЫХ дней в неделю достаточно закрыть;
--               стрик считается НЕДЕЛЯМИ, сверхплановые пропуски его не рвут.
-- ------------------------------------------------------------
alter table public.habits
  add column if not exists weekly_target smallint not null default 0
    check (weekly_target between 0 and 7);

comment on column public.habits.weekly_target is
  'Недельная квота: сколько плановых дней в неделю достаточно закрыть. 0 = выключено, стрик считается днями.';

-- ------------------------------------------------------------
-- 2. Начало ISO-недели (понедельник) для даты
-- ------------------------------------------------------------
create or replace function public.week_start(p_date date)
returns date
language sql
immutable
as $$
  select (p_date - (extract(isodow from p_date)::int - 1))::date;
$$;

-- ------------------------------------------------------------
-- 3. Прогресс текущей недели по привычке с квотой
-- ------------------------------------------------------------
create or replace function public.week_progress(p_habit uuid, p_on date default current_date)
returns table (week_from date, due_days bigint, done_days bigint, goal integer, is_ok boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  h    record;
  mon  date;
  goal integer;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return; end if;

  mon  := public.week_start(p_on);
  goal := greatest(1, least(coalesce(h.weekly_target, 0), 7));

  return query
  with days as (
    select (mon + i)::date as d from generate_series(0, 6) i
  ),
  due as (
    select d from days where d <= current_date and public.is_due_on(p_habit, d)
  )
  select
    mon,
    (select count(*) from due),
    (select count(*) from due d2
      where exists (select 1 from public.habit_logs l
                    where l.habit_id = p_habit and l.log_date = d2.due and l.status = 'done')),
    goal,
    (select count(*) from due d3
      where exists (select 1 from public.habit_logs l
                    where l.habit_id = p_habit and l.log_date = d3.due and l.status = 'done')) >= least(goal, (select count(*) from due));
end;
$$;

-- ------------------------------------------------------------
-- 4. Стрик НЕДЕЛЯМИ для привычек с квотой
--    Текущая (незакрытая) неделя не учитывается — как и в клиентской логике.
-- ------------------------------------------------------------
create or replace function public.weekly_streak(p_habit uuid, p_on date default current_date)
returns table (cur_weeks integer, best_weeks integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  h       record;
  w       date;
  goal    integer;
  run     integer := 0;
  best    integer := 0;
  cur     integer := 0;
  counting boolean := true;
  due_n   bigint;
  done_n  bigint;
  verdict boolean;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return; end if;

  goal := greatest(1, least(coalesce(h.weekly_target, 0), 7));
  w    := public.week_start(p_on) - interval '7 day';      -- последняя ПОЛНАЯ неделя

  -- идём назад по полным неделям
  while w >= public.week_start(h.start_date) loop
    select count(*) into due_n
      from generate_series(0, 6) i
      where public.is_due_on(p_habit, (w + i)::date) and (w + i)::date >= h.start_date;

    if due_n = 0 then
      verdict := null;                                     -- нет плана — не рвёт и не продлевает
    else
      select count(*) into done_n
        from generate_series(0, 6) i
        where public.is_due_on(p_habit, (w + i)::date)
          and (w + i)::date >= h.start_date
          and exists (select 1 from public.habit_logs l
                      where l.habit_id = p_habit and l.log_date = (w + i)::date and l.status = 'done');
      verdict := done_n >= least(goal, due_n);
    end if;

    if verdict then
      run := run + 1;
      if run > best then best := run; end if;
    elsif verdict is false then
      if counting then cur := run; end if;
      run := 0;
      counting := false;
    end if;

    w := w - interval '7 day';
  end loop;

  if counting then cur := run; end if;
  if best < cur then best := cur; end if;

  return query select cur, best;
end;
$$;

-- ------------------------------------------------------------
-- 5. Универсальный стрик: сам выбирает дни или недели
-- ------------------------------------------------------------
create or replace function public.streak_for(p_habit uuid, p_on date default current_date)
returns table (value integer, unit text, best integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare h record; ws record;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return; end if;

  if coalesce(h.weekly_target, 0) > 0 then
    select * into ws from public.weekly_streak(p_habit, p_on);
    return query select ws.cur_weeks, 'weeks'::text, ws.best_weeks;
  else
    return query select public.current_streak(p_habit, p_on), 'days'::text,
                        (public.habit_stats(p_habit, 100000)).best_streak::integer;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 6. Реакции в ленте
-- ------------------------------------------------------------
create table if not exists public.feed_reactions (
  id          uuid primary key default gen_random_uuid(),
  event_id    bigint not null references public.feed_events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (emoji in ('🔥','👏','💪','😮','❤️')),
  created_at  timestamptz not null default now(),
  constraint feed_reactions_unique unique (event_id, user_id, emoji)
);

create index if not exists feed_reactions_event_idx on public.feed_reactions (event_id);
create index if not exists feed_reactions_user_idx  on public.feed_reactions (user_id);

alter table public.feed_reactions enable row level security;

drop policy if exists "reactions: вижу у доступных событий" on public.feed_reactions;
create policy "reactions: вижу у доступных событий" on public.feed_reactions
  for select to authenticated using (
    exists (
      select 1 from public.feed_events e
      where e.id = feed_reactions.event_id
        and (e.user_id = auth.uid() or (e.is_public and public.are_friends(e.user_id, auth.uid())))
    )
  );

drop policy if exists "reactions: ставлю свои" on public.feed_reactions;
create policy "reactions: ставлю свои" on public.feed_reactions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "reactions: убираю свои" on public.feed_reactions;
create policy "reactions: убираю свои" on public.feed_reactions
  for delete to authenticated using (user_id = auth.uid());

-- переключение реакции одним вызовом (toggle)
create or replace function public.toggle_reaction(p_event bigint, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare existed boolean;
begin
  select exists (
    select 1 from public.feed_reactions
    where event_id = p_event and user_id = auth.uid() and emoji = p_emoji
  ) into existed;

  if existed then
    delete from public.feed_reactions
      where event_id = p_event and user_id = auth.uid() and emoji = p_emoji;
  else
    insert into public.feed_reactions (event_id, user_id, emoji)
      values (p_event, auth.uid(), p_emoji)
      on conflict do nothing;
  end if;

  return not existed;      -- true = реакция поставлена
end;
$$;

revoke all on function public.toggle_reaction(bigint, text) from public;
grant execute on function public.toggle_reaction(bigint, text) to authenticated;

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.feed_reactions;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ------------------------------------------------------------
-- ПРОВЕРКА
-- ------------------------------------------------------------
-- select weekly_target from public.habits limit 1;
-- select * from public.week_progress('uuid-привычки');
-- select * from public.weekly_streak('uuid-привычки');
-- select * from public.streak_for('uuid-привычки');
-- select count(*) from public.feed_reactions;
