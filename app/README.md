# HabitVerse — социальный трекер привычек

> 📘 **Подробное руководство по подключению (Supabase + Vercel + push) — в [`../ИНСТРУКЦИЯ.md`](../ИНСТРУКЦИЯ.md).**
> Этот файл — про архитектуру и устройство кода.

**Next.js 16 (App Router, Turbopack/webpack) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) · Vercel · PWA**

Трекер привычек в духе **HabitLink**: стрики, челленджи с друзьями, лента активности, лидерборд, достижения, гибкое расписание, напоминания, отметки задним числом и кастомизация интерфейса — но **без ограничения «одна привычка бесплатно»**.

---

## 1. Что внутри

| Раздел | Возможности |
|---|---|
| **Сегодня** | Кольцо прогресса, 3D-сфера постоянства (three.js), KPI-полоса, список привычек, фильтры (все / на сегодня / осталось / выполнено / архив), таблица недели, мотивационная цитата |
| **Привычка** | Эмодзи-иконка (7 категорий × ~100 эмодзи + свой символ), 16 цветов + свой color-picker, описание, категория, сложность ★1–5, цель в единицах (страниц/минут/стаканов), предпросмотр карточки в реальном времени |
| **Расписание** | Каждый день · выбранные дни недели (5 пресетов) · каждые N дней · раз в неделю · числа месяца · дата старта и дедлайн |
| **Отметки** | 4 состояния по клику: ✓ выполнено → ⤼ осознанный пропуск → ✕ провал → сброс. Отметки **за прошлые даты** (backfill), заметка и количество к каждому дню |
| **🧊 Заморозки стрика** *(v1.1)* | «Правило двух дней»: N провалов в календарный месяц прощаются без разрыва стрика (0…31 на привычку, по умолчанию 2). Помесячный бюджет, виджет остатка, ачивка |
| **🚫 Негативные привычки** *(v1.1)* | Тип «не делать»: отметка означает «сдержался» (🛡 вместо ✓). Свои стили состояний и ачивка «7 дней „нет"» |
| **↕️ Drag-and-drop** *(v1.1)* | Перетаскивание привычек за ручку ⠿, порядок пишется в `habits.position` |
| **🟢 Realtime-дашборд** *(v1.1)* | Подписка на `habit_logs`/`habits`: отметки прилетают без F5, дебаунс 350 мс, тумблер вкл/выкл |
| **🔢 Badging API** *(v1.1)* | Цифра на иконке установленного PWA = сколько привычек осталось сегодня |
| **📅 Недельная квота «M из N»** *(v1.2)* | Надстройка над **любой** частотой: `weekly_target` 0…7 (0 = выкл). Стрик считается **неделями**, текущая незакрытая неделя не рвёт. Столбики по последним 12 неделям в статистике привычки |
| **📤 Карточки для шаринга** *(v1.2)* | Canvas 1080×1080: карточка привычки и карточка недели. Скачать PNG / скопировать текст / Web Share API с файлом |
| **📚 Каталог привычек** *(v1.2)* | 30 готовых формулировок в 7 группах с расписанием, сложностью, целью в единицах и недельной квотой. Поиск, защита от дублей, добавление в один клик |
| **🔥 Реакции в ленте** *(v1.2)* | 🔥 👏 💪 😮 ❤️ со счётчиками. Атомарное переключение через RPC `toggle_reaction()`, RLS: ставить можно только свои |
| **↕️ Тач-DnD** *(v1.2)* | Pointer Events вместо HTML5 DnD: работает мышью **и пальцем**, порог 6 px, виброотклик, «призрак» в requestAnimationFrame |
| **Напоминания** | Время на привычку, «только в дни расписания», Web Push через Service Worker (работает при закрытой вкладке), вечерняя сводка, локальный тикер как страховка |
| **Календарь** | Месячная сетка с точками по привычкам и % за день, фильтр по одной привычке, heatmap года (365 дней), клик по дню → отметка, сводка месяца |
| **Отчёты** | 6 KPI, динамика (canvas) + скользящее среднее за 7 дней, пончик статусов, столбцы по дням недели, радар сфер жизни, рейтинг привычек, стрики, карта года, **персональные инсайты**, экспорт CSV, печать |
| **Достижения** | 20 ачивок (4 уровня редкости), XP за отметки, уровни с порогом ×1.32, конфетти и звук при разблокировке |
| **Блокнот** | Заметки с тегами, закреплением, 6 цветов фона, привязкой к привычке, поиском и лёгкой markdown-разметкой (`#`, `**`, `*`, `` ` ``, `-`, `[[дата]]`) |
| **Челленджи** | Создание (привычка + срок + команда), код-приглашение, публичные/приватные, участники, автоподсчёт % и мест, определение победителя, вступление по коду |
| **Друзья** | Поиск по имени/username, заявки, принять/отклонить/удалить, «пинки мотивации», экипаж |
| **Лента** | Отметки, стрики, идеальные дни, уровни, ачивки, челленджи — свои и друзей. **Realtime** через Supabase Realtime (без перезагрузки) |
| **Кабинет** | Аватар (загрузка фото в Supabase Storage или эмодзи), имя, username, описание, **дата рождения** (возраст + «ДР через N дней»), 5 тем, 16 акцентов, плотность, звук, приватность, часовой пояс, экспорт, выход |
| **Онбординг** | 4 шага: приветствие → имя → аватар → готово |
| **UX** | Тёмные темы (Полночь / Бездна / Неон / Графит) + светлая (Paper), анти-FOUC скрипт темы, glassmorphism, 3D-tilt карточек, Framer Motion-переходы, confetti, Web Audio-звуки, хоткеи (N, 1…7, /, Esc), адаптив от 360 px, `prefers-reduced-motion`, PWA-установка |

---

## 2. Быстрый старт (локально)

```bash
cd app
npm install                     # Node 22+
cp .env.example .env.local      # и впишите ключи Supabase (см. шаг 3)
npm run dev                     # http://localhost:3000
```

> `npm run build` использует webpack-режим — он стабильнее по памяти.
> `npm run build:turbopack` — сборка на Turbopack (быстрее, но требует ≥ 2 ГБ RAM).
> `npm run typecheck` — проверка типов (сейчас 0 ошибок).

---

## 3. Настройка Supabase (10 минут)

### 3.1. Проект
1. [supabase.com](https://supabase.com) → **New project** → регион поближе (например, Frankfurt).
2. Сохраните пароль БД.

### 3.2. Схема
Откройте **SQL Editor** и выполните файлы **по порядку** (или `psql "$DATABASE_URL" -f …`):

| Файл | Что делает |
|---|---|
| `supabase/01_schema.sql` | 12 таблиц + расширения (`pgcrypto`, `pg_trgm`, `pg_cron`) + индексы |
| `supabase/02_rls.sql` | Row Level Security на все таблицы, функция `are_friends()`, политики «свои + друзья» |
| `supabase/03_functions.sql` | Триггер создания профиля, `updated_at`, XP, авто-ачивки, пересчёт челленджей, `current_streak()`, `habit_stats()`, `search_users()`, `join_challenge_by_code()`, **pg_cron для напоминаний** |
| `supabase/04_seed.sql` | 20 достижений, справочник категорий, представления `v_today` / `v_leaderboard`, доп. индексы |
| `supabase/05_storage.sql` | Бакет `avatars` (Public, 5 МБ) + 4 политики хранилища |
| `supabase/06_v1.1_freeze_negative_realtime.sql` | **v1.1.0:** `habits.is_negative`, `habits.freezes`, `freezes_used/left()`, `is_due_on()`, новые `current_streak()`/`habit_stats()`, Realtime-публикация |

Проверка: в **Table Editor** должны появиться `profiles`, `habits`, `habit_logs`, `notes`, `challenges`, `challenge_members`, `friendships`, `feed_events`, `achievements`, `user_achievements`, `push_subscriptions`, `categories`.

### 3.3. Storage (аватары)

> Быстрее всего — выполнить `supabase/05_storage.sql` в SQL Editor: он создаёт и бакет, и все 4 политики.
> Ручной вариант ниже.
**Storage → New bucket** → name: `avatars` → **Public** → в *File size limit* поставьте `5242880`, разрешённые типы: `image/png, image/jpeg, image/webp, image/gif`.

Политики доступа (Storage → Policies → `avatars` → New policy → For full customization):

```sql
-- вставка/обновление только своих файлов
create policy "avatars: своя папка" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: чтение публичное" on storage.objects
  for select to authenticated, anon using (bucket_id = 'avatars');

create policy "avatars: удаление своего" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
```

### 3.4. Auth
**Authentication → Providers**
- **Email** — включён по умолчанию. Для разработки можно выключить *Confirm email* (тогда регистрация входит сразу).
- **Google / GitHub** (по желанию): включите и впишите Client ID/Secret. В *Redirect URLs* добавьте `https://<ваш-домен>/auth/callback` и `http://localhost:3000/auth/callback`.
- **Site URL** = `https://<ваш-домен>.vercel.app` (после деплоя) или `http://localhost:3000`.

### 3.5. Ключи
**Settings → API**:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` (секрет!) → `SUPABASE_SERVICE_ROLE_KEY` — **только серверная переменная**

---

## 4. Push-уведомления (Web Push / VAPID)

```bash
npx web-push generate-vapid-keys
# → Public Key  → NEXT_PUBLIC_VAPID_PUBLIC_KEY   (Vercel + .env.local)
# → Private Key → VAPID_PRIVATE_KEY              (секрет Edge Function)
```

Деплой функции напоминаний:

```bash
npm i -g supabase          # или npx supabase
supabase login
supabase link --project-ref <ваш-ref>
supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:you@mail.com"
supabase functions deploy send-reminders --no-verify-jwt
```

**Расписание** — на выбор:
- **pg_cron** (уже настроен в `03_functions.sql`, каждые 15 минут). Если cron не подхватил URL, задайте настройки:
  ```sql
  select set_config('app.settings.functions_url', 'https://<ref>.supabase.co/functions/v1', false);
  select set_config('app.settings.service_role_key', '<service_role_key>', false);
  ```
  Лучше прописать их в **Settings → Database → Custom settings** (`app.settings.functions_url`, `app.settings.service_role_key`), чтобы значения пережили перезапуск.
- **Vercel Cron** — `vercel.json` уже содержит два задания (`/api/cron/reminders?mode=reminders` и `?mode=digest`). ⚠️ План **Hobby** поддерживает только *ежедневный* cron — для 15-минутного шага нужен **Pro** или pg_cron.

Функция умеет два режима: `reminders` (по времени конкретной привычки) и `digest` (вечерняя сводка «осталось N из M»). Мёртвые подписки (`404/410`) удаляются автоматически.

---

## 5. Деплой на Vercel

1. Запушьте проект в GitHub/GitLab.
2. [vercel.com/new](https://vercel.com/new) → **Import** → выберите репозиторий → **Root Directory: `app`**.
3. Framework: **Next.js** (определится сам). Build Command: `npm run build` (уже в `package.json`).
4. **Environment Variables** (Environment: Production + Preview):

   | Переменная | Значение |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon-ключ |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | публичный VAPID-ключ |
   | `SUPABASE_SECRET_KEY` | `sb_secret_…` (**Secret**). Legacy-вариант: `SUPABASE_SERVICE_ROLE_KEY` |
   | `VAPID_PRIVATE_KEY` | приватный VAPID-ключ (**Secret**) |
   | `CRON_SECRET` | любая длинная строка (**Secret**) |
   | `NEXT_PUBLIC_SITE_URL` | `https://<ваш-домен>` |

5. **Deploy**. После первого деплоя:
   - Supabase → **Authentication → URL Configuration**: Site URL и Redirect URLs = ваш домен + `/auth/callback`.
   - Vercel → **Settings → Domains** — привяжите свой домен (опционально).
6. Vercel → **Settings → Environment Variables**: если меняли `NEXT_PUBLIC_*`, нужен **Redeploy** (они попадают в клиентский бандл на этапе сборки).

**Проверка после деплоя:** `/register` → создать аккаунт → онбординг → `/dashboard?new=1` → добавить привычку → отметить → проверить `/stats`, `/calendar`, `/profile`.

---

## 6. Структура проекта

```
app/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              # метаданные, шрифты, анти-FOUC скрипт темы, Toaster
│  │  ├─ page.tsx                # лендинг (гостей) → редирект в /dashboard
│  │  ├─ login|register|forgot/  # вход, регистрация, сброс пароля
│  │  ├─ auth/callback/route.ts  # обмен кода на сессию (e-mail / OAuth / magic link)
│  │  ├─ dashboard/              # Сегодня
│  │  ├─ calendar/  stats/  notes/  social/  feed/  profile/
│  │  └─ api/cron/reminders/     # Vercel Cron → Edge Function
│  ├─ components/
│  │  ├─ app-shell.tsx           # фон, sidebar, topbar
│  │  ├─ app-shell-client.tsx    # клиентская оболочка + realtime профиля
│  │  ├─ landing.tsx             # промо-страница
│  │  ├─ auth-form.tsx           # 3 режима авторизации
│  │  ├─ providers.tsx           # SW-регистрация, тема, слушатель сессии
│  │  ├─ ui/                     # primitives (Button, Card, Pill, Chip, Toggle, Input…) + overlays (Modal, Sheet, Confirm)
│  │  ├─ today/                  # today-view, habit-row, habit-modal, reminder-sheet, habit-stats-sheet
│  │  ├─ calendar/               # calendar-view, heatmap
│  │  ├─ stats/                  # stats-view, charts (canvas: trend, donut, weekday, radar)
│  │  ├─ notes/  social/  feed/  profile/
│  │  ├─ 3d/                     # progress-sphere (CSS 3D) + three-sphere (three.js с CDN, по требованию)
│  │  ├─ notifications/          # push.ts (VAPID-подписка), use-reminders.ts (локальный тикер)
│  │  └─ gamification/           # XP, уровни, ачивки
│  ├─ lib/
│  │  ├─ actions.ts              # ВСЕ Server Actions (CRUD, XP, ачивки, челленджи, друзья)
│  │  ├─ data.ts                 # loadAppData() — единая загрузка данных для страниц
│  │  ├─ supabase/{client,server,middleware}.ts
│  │  ├─ dates.ts                # формат 'YYYY-MM-DD', 0=Пн, сетка месяца
│  │  ├─ schedule.ts             # dueOn() — движок расписания (5 типов частоты)
│  │  ├─ stats.ts                # стрики, completion, heatmap, инсайты
│  │  ├─ constants.ts            # цвета, категории, эмодзи, темы, XP, цитаты, ачивки
│  │  └─ utils.ts
│  ├─ proxy.ts                   # Next 16: защита маршрутов + обновление сессии
│  └─ types/database.ts          # доменные типы (Profile, Habit, HabitLog, …)
├─ supabase/
│  ├─ 01_schema.sql  02_rls.sql  03_functions.sql  04_seed.sql  05_storage.sql
│  ├─ 06_v1.1_freeze_negative_realtime.sql   07_v1.2_weekly_quota_reactions.sql
│  └─ functions/send-reminders/index.ts   # Deno Edge Function (Web Push)
├─ scripts/import-demo.ts        # CLI-импорт данных из демо (--dry/--force/--with-notes/--with-challenges)
├─ public/                       # sw.js, manifest.webmanifest, icon.svg, icon-192/512.png
├─ next.config.ts  vercel.json  tsconfig.json  .env.example
```

---

## 7. Безопасность и приватность

- **RLS включён на все таблицы.** Чужие строки недоступны: `notes` — только свои; `habits`/`habit_logs` — свои + друзья; `feed_events` — свои + публичные от друзей.
- Заметки **не видны никому**, даже друзьям.
- `privacy_profile` скрывает профиль из поиска, `privacy_feed` — отметки из ленты.
- Профиль создаётся триггером `handle_new_user()` (SECURITY DEFINER), а не политикой insert — поэтому регистрация не упирается в RLS.
- `service_role` ключ используется **только** в Edge Function и cron-роуте, никогда не попадает в клиентский бандл.
- Заголовки безопасности (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) заданы в `next.config.ts`.
- Отметки за будущие даты запрещены и в БД (`check (log_date <= current_date + 1)`), и в RLS.

---

## 8. Полезные SQL-запросы

```sql
-- статистика по одной привычке за 90 дней (функция из 03_functions.sql)
select * from habit_stats('uuid-привычки', 90);

-- текущий стрик (с учётом заморозок) и остаток заморозок
select current_streak('uuid-привычки'), freezes_left('uuid-привычки');

-- расширенная статистика: план, факт, %, рекорд, текущий стрик, заморозки
select * from habit_stats('uuid-привычки', 30);

-- запланирована ли привычка на дату
select is_due_on('uuid-привычки', date '2026-10-07');

-- сколько заморозок потрачено в текущем месяце
select freezes_used('uuid-привычки');

-- лидерборд
select * from v_leaderboard order by xp desc limit 10;

-- закрыть просроченные челленджи вручную
select finish_expired_challenges();

-- полный сброс данных пользователя
delete from public.habit_logs  where user_id = 'uuid';
delete from public.habits      where user_id = 'uuid';
delete from public.notes       where user_id = 'uuid';
delete from public.feed_events where user_id = 'uuid';
```

Официальные типы для supabase-js (опционально, для строгой типизации):
```bash
npx supabase gen types typescript --project-id <ref> --schema public > src/types/supabase.ts
```

---

## 8b. Импорт данных из демо

```bash
cd app
npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com --dry
npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com --with-notes
```

Скрипт идемпотентен (повторный запуск безопасен), поддерживает dry-run и переносит профиль,
привычки (включая тип «не делать» и число заморозок), всю историю отметок, заметки и челленджи.
Требует `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SECRET_KEY` (или legacy `SUPABASE_SERVICE_ROLE_KEY`).
Подробности — в `../ИНСТРУКЦИЯ.md`, часть 11b.

> На Node 20 нужен полифилл WebSocket (`npm i -D ws` уже в devDependencies). На Node 22+ работает из коробки.

## 8c. Логика стрика (важно понимать)

Стрик считается **только по плановым дням** привычки, а не по календарным:

1. Если сегодня плановый день ещё не закрыт — счётчик показывает стрик **по вчерашний день включительно**
   (утром вы видите свой реальный стрик, а не «0»). После отметки он вырастает на 1.
2. `✓ выполнено` и `⤼ осознанный пропуск` продолжают стрик. Пропуск даёт меньше XP, но не рвёт цепочку.
3. `✕ провал` рвёт стрик, **если** в этом календарном месяце не осталось заморозок.
   Потраченная заморозка помечается в логе (`frozen: true`) → расчёт детерминирован.
4. День **без** отметки стрик рвёт и заморозкой не спасается. Иначе старая незаполненная история
   молча съедала бы весь месячный бюджет за один проход.
5. Бюджет заморозок ведётся **по календарным месяцам**: 2 заморозки = 2 в сентябре + 2 в октябре, а не 2 на всё время.
6. Рекордный стрик (`best`) считается по тем же правилам, но сегодняшние дни в него не входят.

Клиентская реализация — `src/lib/stats.ts` (`streakOf`, `bestStreak`, `freezesLeft`).
Серверная — SQL-функции `current_streak()`, `best_streak`, `freezes_left()` из `06_v1.1_….sql`.
**Семантика должна совпадать**, иначе стрик будет «прыгать» при обновлении страницы.

## 8d. Почему three.js НЕ в зависимостях (важно!)

До v1.2 3D-сфера была на `three` + `@react-three/fiber` + `@react-three/drei`.
Из-за этого **`next build` падал с SIGKILL**: build worker убивался по памяти на машинах с <2 ГБ RAM,
а на Vercel росли время и память сборки. Проверено бисекцией: без импорта 3D-сцены сборка проходит.

**Текущая архитектура:**

| Слой | Что | Когда грузится |
|---|---|---|
| По умолчанию | CSS 3D-сфера (`orb-scene` / `orb-ring` / `orb-core` в `globals.css`) | сразу, ~0 КБ |
| Опция «3D: WebGL» | `src/components/3d/three-sphere.tsx` — «чистый» three.js без R3F | three.js тянется с CDN (`jsdelivr`, `three@0.186.1`) только после клика |

Плюсы: сборка ~30 с, `node_modules` 636 МБ вместо 801 МБ, демо и прод выглядят одинаково,
а пользователь, которому нужен полноценный WebGL, получает его одним переключателем
(выбор хранится в `localStorage` под ключом `hv.3d`).

В `three-sphere.tsx` **намеренно нет типов three** — пакет не является зависимостью.
Описаны только реально используемые поверхности API (`Obj3D`, `CameraLike`, `RendererLike`, `ThreeNS`).

> Если захотите вернуть R3F: поднимите планку памяти сборки (Vercel: `NODE_OPTIONS=--max-old-space-size=4096`)
> и убедитесь, что локально `next build` проходит. Но по умолчанию — не возвращайте.

## 9. Что можно докрутить

- [x] **Виджеты** — PWA-shortcuts + `Badging API` (`navigator.setAppBadge(n)`), сделано в v1.1.0.
- [ ] Реальные push-уведомления на мобильных iOS — нужен установленный PWA (Safari → «На экран „Домой"»).
- [x] Перенос из демо-версии — `scripts/import-demo.ts`, сделано в v1.1.0.
- [ ] Drag-and-drop на тач-устройствах (HTML5 DnD не работает на мобильных) → Framer Motion `Reorder.Group` или `@dnd-kit`.
- [ ] `supabase gen types` → строгая типизация запросов вместо приведений.
- [ ] Тесты: Vitest + React Testing Library для `schedule.ts` / `stats.ts`.
- [ ] Analytics-события (Vercel Analytics / PostHog).

---

## 10. Лицензия

MIT — делайте что хотите.
