-- ============================================================
-- HabitVerse · 03 — функции, триггеры, статистика, cron
-- ============================================================

-- ------------------------------------------------------------
-- 1. Авто-создание профиля при регистрации
--    SECURITY DEFINER: обходим RLS на insert в момент sign-up
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, username, avatar_url, emoji)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name',
             new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1),
             'Пилот'),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'emoji', '🙂')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. updated_at для всех таблиц
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','habits','habit_logs','notes'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. last_seen_at при любой активности
-- ------------------------------------------------------------
create or replace function public.touch_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_seen_at = now() where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists habits_touch on public.habits;
create trigger habits_touch after insert or update on public.habits
  for each row execute function public.touch_profile();

-- ------------------------------------------------------------
-- 4. Запись события в ленту при отметке / стрике / достижении
-- ------------------------------------------------------------
create or replace function public.log_feed_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  p_privacy boolean;
begin
  select privacy_feed into p_privacy from public.profiles where id = new.user_id;

  insert into public.feed_events (user_id, type, payload, is_public)
  values (
    new.user_id,
    'checkin',
    jsonb_build_object('habit_id', new.habit_id, 'date', new.log_date, 'status', new.status),
    coalesce(p_privacy, true) and new.status = 'done'
  );
  return new;
end;
$$;

drop trigger if exists habit_logs_feed on public.habit_logs;
create trigger habit_logs_feed
  after insert on public.habit_logs
  for each row when (new.status = 'done')
  execute function public.log_feed_event();

-- ------------------------------------------------------------
-- 5. Пересчёт результата участника челленджа
-- ------------------------------------------------------------
create or replace function public.recalc_challenge_score(p_challenge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c record; h uuid; total int; done_cnt int;
begin
  select * into c from public.challenges where id = p_challenge;
  if not found then return; end if;
  h := c.habit_id;

  update public.challenge_members m set
    score = case
      when h is null then 0
      else round(
        100.0 * coalesce((
          select count(*) from public.habit_logs l
          where l.habit_id = h and l.user_id = m.user_id and l.status = 'done'
            and l.log_date between c.start_date and least(c.end_date, current_date)
        ), 0)
        / greatest(1, (c.end_date - c.start_date + 1)::int), 1)
    end
  where m.challenge_id = p_challenge;

  -- места
  with ranked as (
    select user_id, row_number() over (order by score desc, joined_at asc) as rn
    from public.challenge_members where challenge_id = p_challenge
  )
  update public.challenge_members m set place = r.rn
  from ranked r where r.user_id = m.user_id and m.challenge_id = p_challenge;
end;
$$;

create or replace function public.recalc_on_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ch uuid;
begin
  select challenge_id into ch from public.habits where id = coalesce(new.habit_id, old.habit_id);
  if ch is not null then perform public.recalc_challenge_score(ch); end if;
  return null;
end;
$$;

drop trigger if exists habit_logs_challenge on public.habit_logs;
create trigger habit_logs_challenge
  after insert or update or delete on public.habit_logs
  for each row execute function public.recalc_on_log();

-- ------------------------------------------------------------
-- 6. Закрытие завершившихся челленджей
-- ------------------------------------------------------------
create or replace function public.finish_expired_challenges()
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with expired as (
    select id from public.challenges
    where status = 'active' and end_date < current_date
  )
  update public.challenges c set status = 'finished'
  from expired e where e.id = c.id;
  get diagnostics n = row_count;

  perform public.recalc_challenge_score(id)
  from public.challenges where status = 'finished' and end_date >= current_date - 2;

  return n;
end;
$$;

-- ------------------------------------------------------------
-- 7. Статистика: стрик и процент выполнения на стороне БД
--    (быстрее, чем тянуть все логи на клиент)
-- ------------------------------------------------------------
create or replace function public.current_streak(p_habit uuid)
returns integer language sql stable security definer set search_path = public as $$
  with due as (
    select d::date
    from generate_series(
           (select start_date from public.habits where id = p_habit),
           current_date, interval '1 day') d
    where (select freq_type from public.habits where id = p_habit) = 'daily'
       or ((select freq_type from public.habits where id = p_habit) = 'weekdays'
           and (extract(isodow from d)::int - 1) = any (select freq_days from public.habits where id = p_habit))
  ),
  flagged as (
    select d.d::date,
           coalesce(l.status in ('done','skip'), false) as ok
    from due d
    left join public.habit_logs l on l.habit_id = p_habit and l.log_date = d.d::date
    order by d.d::date desc
  ),
  runlen as (
    select ok, row_number() over (order by d desc) as rn
    from flagged f, lateral (select f.date as d) x
  )
  select coalesce(max(rn), 0) from runlen where ok;
$$;

create or replace function public.habit_stats(p_habit uuid, p_days integer default 30)
returns table (due_days bigint, done_days bigint, rate numeric, best_streak bigint)
language plpgsql stable security definer set search_path = public as $$
declare h record;
begin
  select * into h from public.habits where id = p_habit;
  if not found then return; end if;

  return query
  with days as (
    select d::date from generate_series(greatest(h.start_date, current_date - (p_days - 1)),
                                        current_date, interval '1 day') d
  ),
  due as (
    select d from days where
      h.freq_type = 'daily'
      or (h.freq_type = 'weekdays' and (extract(isodow from d)::int - 1) = any (h.freq_days))
      or (h.freq_type = 'interval' and mod((d - h.start_date)::int, greatest(1, h.freq_every)) = 0)
      or (h.freq_type = 'weekly'  and (extract(isodow from d)::int - 1) = coalesce(h.freq_days[1], 0))
      or (h.freq_type = 'monthly' and extract(day from d)::int = any (h.freq_days))
  ),
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
    coalesce((select max(len) from grp), 0);
end;
$$;

-- ------------------------------------------------------------
-- 8. XP и автовыдача достижений
-- ------------------------------------------------------------
create or replace function public.award_xp(p_user uuid, p_amount integer, p_reason text default '')
returns integer language plpgsql security definer set search_path = public as $$
declare new_xp int; old_level int; new_level int;
begin
  update public.profiles set xp = xp + p_amount where id = p_user returning xp into new_xp;

  -- уровень: 100, 132, 174, 230 … (×1.32)
  old_level := greatest(1, floor(ln(greatest(new_xp - p_amount, 0) / 100.0 + 1) / ln(1.32)) + 1)::int;
  new_level := greatest(1, floor(ln(greatest(new_xp, 1) / 100.0 + 1) / ln(1.32)) + 1)::int;

  if new_level > old_level then
    insert into public.feed_events (user_id, type, payload)
    values (p_user, 'level', jsonb_build_object('level', new_level, 'reason', p_reason));
  end if;

  return new_xp;
end;
$$;

create or replace function public.unlock_achievement(p_user uuid, p_achievement text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean := false; reward int;
begin
  insert into public.user_achievements (user_id, achievement_id)
  values (p_user, p_achievement)
  on conflict do nothing;

  if found then
    select xp_reward into reward from public.achievements where id = p_achievement;
    perform public.award_xp(p_user, coalesce(reward, 0), 'achievement:' || p_achievement);
    insert into public.feed_events (user_id, type, payload)
    values (p_user, 'achievement', jsonb_build_object('achievement', p_achievement));
    ok := true;
  end if;
  return ok;
end;
$$;

-- выдача «первый шаг» и «сотня отметок» автоматически
create or replace function public.check_log_achievements()
returns trigger language plpgsql security definer set search_path = public as $$
declare total bigint;
begin
  perform public.unlock_achievement(new.user_id, 'first');
  perform public.award_xp(new.user_id, 12, 'checkin');

  select count(*) into total from public.habit_logs
    where user_id = new.user_id and status = 'done';
  if total >= 100 then perform public.unlock_achievement(new.user_id, 'c100'); end if;
  if total >= 500 then perform public.unlock_achievement(new.user_id, 'c500'); end if;
  return new;
end;
$$;

drop trigger if exists habit_logs_achievements on public.habit_logs;
create trigger habit_logs_achievements
  after insert on public.habit_logs
  for each row when (new.status = 'done')
  execute function public.check_log_achievements();

-- ------------------------------------------------------------
-- 9. Поиск пользователей (для добавления в друзья)
-- ------------------------------------------------------------
create or replace function public.search_users(q text, p_limit integer default 20)
returns table (id uuid, display_name text, username text, avatar_url text, emoji text, xp integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.username, p.avatar_url, p.emoji, p.xp
  from public.profiles p
  where p.privacy_profile = false
    and p.id <> auth.uid()
    and (p.display_name ilike '%' || q || '%' or p.username ilike '%' || q || '%')
  order by p.xp desc
  limit p_limit;
$$;

-- вступить в челлендж по коду
create or replace function public.join_challenge_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select * into c from public.challenges where upper(invite_code) = upper(p_code);
  if not found then raise exception 'Челлендж с кодом % не найден', p_code using errcode = 'P0002'; end if;
  if c.status <> 'active' then raise exception 'Челлендж уже завершён' using errcode = 'P0003'; end if;

  insert into public.challenge_members (challenge_id, user_id)
  values (c.id, auth.uid())
  on conflict do nothing;

  insert into public.feed_events (user_id, type, payload)
  values (auth.uid(), 'challenge', jsonb_build_object('challenge_id', c.id, 'action', 'join'));

  return c.id;
end;
$$;

-- ------------------------------------------------------------
-- 10. CRON: ежедневные push-напоминания и закрытие челленджей
--     Edge Function `send-reminders` шлёт Web Push по подпискам.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('hv-finish-challenges');
    perform cron.schedule('hv-finish-challenges', '10 0 * * *',
      $$select public.finish_expired_challenges()$$);

    perform cron.unschedule('hv-reminders-hourly');
    perform cron.schedule('hv-reminders-hourly', '*/15 * * * *',
      $cron$
        select net.http_post(
          url := current_setting('app.settings.functions_url', true) || '/send-reminders',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'),
          body := jsonb_build_object('mode', 'reminders')
        );
      $cron$);
  end if;
exception when others then
  raise notice 'pg_cron недоступен — расписание настраивается через Vercel Cron (см. vercel.json)';
end $$;

-- настройки для cron (замените значения в Supabase → Settings → Database → custom settings
-- либо выполните: select set_config('app.settings.functions_url','https://<ref>.supabase.co/functions/v1',false);)
