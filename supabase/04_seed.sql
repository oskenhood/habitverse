-- ============================================================
-- HabitVerse · 04 — справочник достижений + демо-данные
-- ============================================================

insert into public.achievements (id, emoji, name, description, tier, xp_reward, sort) values
  ('first',    '🌱', 'Первый шаг',        'Отметь первую привычку',              'bronze',   10,  1),
  ('s3',       '🔥', '3 дня подряд',      'Стрик 3 дня',                         'bronze',   15,  2),
  ('s7',       '⚡', 'Неделя силы',       'Стрик 7 дней',                        'silver',   30,  3),
  ('s21',      '🧠', 'Перепрошивка',      'Стрик 21 день',                       'silver',   60,  4),
  ('s30',      '👑', 'Месяц дисциплины',  'Стрик 30 дней',                       'gold',    120,  5),
  ('s100',     '💎', 'Сотня',             'Стрик 100 дней',                      'platinum',400,  6),
  ('h1',       '🎯', 'Поехали',           'Создай первую привычку',              'bronze',   10,  7),
  ('h5',       '🗂️', 'Система',           '5 активных привычек',                 'bronze',   20,  8),
  ('h10',      '🏗️', 'Архитектор жизни',  '10 активных привычек',                'silver',   50,  9),
  ('perfect',  '🌟', 'Идеальный день',    '100% выполнение за день',             'silver',   25, 10),
  ('perfect7', '🏆', 'Идеальная неделя',  '7 дней подряд по 100%',               'gold',    150, 11),
  ('c100',     '✅', 'Сотня отметок',     '100 выполнений всего',                'silver',   50, 12),
  ('c500',     '🚀', '500 отметок',       '500 выполнений всего',                'gold',    200, 13),
  ('early',    '🌅', 'Ранняя пташка',     'Отметь привычку до 7:00',             'bronze',   15, 14),
  ('night',    '🌙', 'Ночной режим',      'Отметь привычку после 23:00',         'bronze',   15, 15),
  ('note',     '📓', 'Летописец',         'Напиши 5 заметок',                    'bronze',   20, 16),
  ('chal',     '🤝', 'В игре',            'Создай или вступи в челлендж',        'silver',   40, 17),
  ('chalwin',  '🥇', 'Победитель',        'Выиграй челлендж',                    'gold',    250, 18),
  ('backfill', '⏪', 'Властелин времени', 'Отметь привычку задним числом',       'bronze',   10, 19),
  ('allcats',  '🌈', 'Баланс',            'Привычки в 5 разных категориях',      'gold',    100, 20)
on conflict (id) do update set
  emoji = excluded.emoji, name = excluded.name, description = excluded.description,
  tier = excluded.tier, xp_reward = excluded.xp_reward, sort = excluded.sort;

-- ------------------------------------------------------------
-- Демо-пользователь (пароль: Demo1234!) — удобно проверить деплой.
-- В продакшене удалите:  delete from auth.users where email = 'demo@habitverse.app';
-- ------------------------------------------------------------
-- insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
-- values ('00000000-0000-0000-0000-000000000000',
--         gen_random_uuid(), 'authenticated', 'authenticated',
--         'demo@habitverse.app', crypt('Demo1234!', gen_salt('bf')), now(),
--         '{"display_name":"Демо Пилот","emoji":"🦊"}'::jsonb);

-- ------------------------------------------------------------
-- Категории привычек (справочник для UI — дублируется в lib/constants.ts)
-- ------------------------------------------------------------
create table if not exists public.categories (
  id    text primary key,
  name  text not null,
  emoji text not null,
  color text not null,
  sort  integer not null default 0
);

alter table public.categories enable row level security;
drop policy if exists "categories: читают все" on public.categories;
create policy "categories: читают все" on public.categories for select to authenticated, anon using (true);

insert into public.categories (id, name, emoji, color, sort) values
  ('health', 'Здоровье',   '💪', '#3ddc97', 1),
  ('mind',   'Разум',      '🧠', '#4aa8ff', 2),
  ('work',   'Работа',     '💼', '#ffb020', 3),
  ('disc',   'Дисциплина', '⚡', '#ff5c8a', 4),
  ('social', 'Общение',    '🫂', '#a78bfa', 5),
  ('creo',   'Творчество', '🎨', '#22d3ee', 6),
  ('spirit', 'Душа',       '🌱', '#34d399', 7),
  ('money',  'Финансы',    '💰', '#facc15', 8)
on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, color = excluded.color, sort = excluded.sort;

-- ------------------------------------------------------------
-- Полезные представления для дашборда
-- ------------------------------------------------------------
create or replace view public.v_today as
select
  h.id            as habit_id,
  h.user_id,
  h.name, h.emoji, h.color, h.category, h.freq_type, h.freq_days, h.freq_every,
  h.start_date, h.target_count, h.target_unit, h.reminder_time, h.position,
  l.status        as today_status,
  l.value         as today_value,
  l.note          as today_note
from public.habits h
left join public.habit_logs l
  on l.habit_id = h.id and l.log_date = current_date
where h.archived = false;

create or replace view public.v_leaderboard as
select
  p.id, p.display_name, p.username, p.avatar_url, p.emoji, p.xp,
  floor(ln(greatest(p.xp, 1) / 100.0 + 1) / ln(1.32)) + 1 as level,
  (select count(*) from public.habit_logs l
    where l.user_id = p.id and l.status = 'done'
      and l.log_date >= current_date - 29) as done_30d
from public.profiles p
where p.privacy_profile = false;

-- ------------------------------------------------------------
-- Индексы под типовые запросы дашборда
-- ------------------------------------------------------------
create index if not exists idx_logs_user_range on public.habit_logs (user_id, log_date) include (status, value);
create index if not exists idx_members_user    on public.challenge_members (user_id);
create index if not exists idx_ua_user         on public.user_achievements (user_id, unlocked_at desc);
