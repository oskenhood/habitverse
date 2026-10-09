-- ============================================================
-- HabitVerse · 06 — v1.1.0
--   ① streak freeze («правило двух дней»)
--   ② негативные привычки («не делать»)
--   ③ Realtime-публикация для живого дашборда
--
-- Выполните ПОСЛЕ 01…05. Скрипт идемпотентен — можно запускать повторно.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Новые колонки привычек
-- ------------------------------------------------------------
alter table public.habits
  add column if not exists is_negative  boolean not null default false,
  add column if not exists freezes      smallint not null default 2
    check (freezes between 0 and 31);

comment on column public.habits.is_negative is
  'true = привычка «НЕ делать» (без сахара, без телефона). Отметка ✓ означает «сдержался».';
comment on column public.habits.freezes is
  'Сколько пропусков в календарный месяц можно заморозить без разрыва стрика.';

-- ------------------------------------------------------------
-- 2. Сколько заморозок уже потрачено в текущем календарном месяце
-- ------------------------------------------------------------
create or replace function public.freezes_used(p_habit uuid, p_on date default current_date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.habit_logs l
  where l.habit_id = p_habit
    and l.status = 'miss'
    and date_trunc('month', l.log_date) = date_trunc('month', p_on)
    and l.log_date <= p_on;
$$;

create or replace function public.freezes_left(p_habit uuid, p_on date default current_date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    (select freezes from public.habits where id = p_habit)
    - (select public.freezes_used(p_habit, p_on))
  );
$$;

comment on function public.freezes_left(uuid, date) is
  'Остаток заморозок стрика на текущий календарный месяц.';

-- ------------------------------------------------------------
-- 3. Запланирована ли привычка на дату (зеркало клиентского dueOn)
-- ------------------------------------------------------------
create or replace function public.is_due_on(p_habit uuid, p_date date)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare h record;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return false; end if;
  if h.archived then return false; end if;
  if p_date < h.start_date then return false; end if;
  if h.end_date is not null and p_date > h.end_date then return false; end if;

  return case h.freq_type
    when 'daily'    then true
    when 'weekdays' then (extract(isodow from p_date)::int - 1) = any (coalesce(nullif(h.freq_days, '{}'), array[0,1,2,3,4]))
    when 'interval' then mod((p_date - h.start_date)::int, greatest(1, h.freq_every)) = 0
    when 'weekly'   then (extract(isodow from p_date)::int - 1) = coalesce(h.freq_days[1], 0)
    when 'monthly'  then extract(day from p_date)::int = any (coalesce(nullif(h.freq_days, '{}'), array[1]))
    else true
  end;
end;
$$;

-- ------------------------------------------------------------
-- 4. Стрик с учётом заморозок
--    Пропуск (status = miss) не рвёт стрик, пока есть запас freezes.
-- ------------------------------------------------------------
create or replace function public.current_streak(p_habit uuid, p_on date default current_date)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  h          record;
  budget     integer;
  k          date := p_on;
  result     integer := 0;
  guard      integer := 0;
  is_due     boolean;
  st         text;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return 0; end if;

  budget := greatest(0, h.freezes) - public.freezes_used(p_habit, p_on);

  -- если сегодня не по расписанию — откатываемся к ближайшему плановому дню
  loop
    exit when guard >= 400;
    is_due := public.is_due_on(p_habit, k);
    exit when is_due or k <= h.start_date;
    k := k - 1;
    guard := guard + 1;
  end loop;

  guard := 0;
  while k >= h.start_date and guard < 4000 loop
    guard := guard + 1;
    if public.is_due_on(p_habit, k) then
      select l.status into st from public.habit_logs l
        where l.habit_id = p_habit and l.log_date = k;

      if st in ('done', 'skip') then
        result := result + 1;
      elsif st = 'miss' then
        if budget > 0 then
          budget := budget - 1;     -- заморозка спасает стрик, но день не засчитывается
        else
          exit;                     -- запас исчерпан — стрик разорван
        end if;
      else
        exit;                       -- отметки нет и день уже прошёл
      end if;
    end if;
    k := k - 1;
  end loop;

  return result;
end;
$$;

-- ------------------------------------------------------------
-- 5. Расширенная статистика привычки (заменяет habit_stats из 03)
-- ------------------------------------------------------------
create or replace function public.habit_stats(p_habit uuid, p_days integer default 30)
returns table (
  due_days      bigint,
  done_days     bigint,
  rate          numeric,
  best_streak   bigint,
  cur_streak    integer,
  freezes_left  integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare h record;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return; end if;

  return query
  with days as (
    select d::date from generate_series(
      greatest(h.start_date, current_date - (p_days - 1)), current_date, interval '1 day') d
  ),
  due as (select d from days where public.is_due_on(p_habit, d)),
  logs as (
    select l.log_date, l.status from public.habit_logs l
    where l.habit_id = p_habit and l.log_date in (select due from due)
  ),
  seq as (
    select (l.status in ('done','skip')) as ok,
           row_number() over (order by l.log_date) as rn
    from logs l
  ),
  grp as (
    select rn - row_number() over (order by rn) as g, count(*) as len
    from seq where ok group by 1
  )
  select
    (select count(*) from due),
    (select count(*) from logs where status = 'done'),
    round(100.0 * (select count(*) from logs where status = 'done')
          / greatest(1, (select count(*) from due)), 1),
    coalesce((select max(len) from grp), 0),
    public.current_streak(p_habit),
    public.freezes_left(p_habit);
end;
$$;

-- ------------------------------------------------------------
-- 6. Realtime: публикуем таблицы, чтобы лента/дашборд обновлялись без F5
--    (Supabase Realtime → postgres_changes)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.habit_logs;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.habits;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.feed_events;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.profiles;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.challenge_members;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.notes;
    exception when duplicate_object then null; end;
  else
    raise notice 'publication supabase_realtime не найдена — включите Realtime в Settings → Database';
  end if;
end $$;

-- RLS продолжает действовать: Realtime отдаёт клиенту только те строки,
-- которые ему разрешено читать (свои + друзей).

-- ------------------------------------------------------------
-- ПРОВЕРКА
-- ------------------------------------------------------------
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_schema='public' and table_name='habits'
--    and column_name in ('is_negative','freezes');
--
-- select tablename from pg_publication_tables where pubname='supabase_realtime';
--
-- select current_streak('uuid-привычки'), freezes_left('uuid-привычки');
-- select * from habit_stats('uuid-привычки', 30);
