> ⚠️ **АРХИВ (2026-10-08):** это инструкция для `app/` (v1.2 + Supabase) — прошлого поколения проекта.
> Основной проект теперь — `web/` (HabitVerse 2.0), его инструкция — в корне `ИНСТРУКЦИЯ.md`.
> Документ сохранён как есть и понадобится в фазе 5.4 (Supabase-слой переедет в web/).

# 🚀 HabitVerse — полная инструкция по подключению

> ⚠️ **СТАТУС (обновлено 2026-10-08, web-5.2):** эта инструкция описывает подключение **`app/` (v1.2 + Supabase)** —
> продакшн-версии прошлого поколения. Она остаётся рабочей, но активная разработка идёт в новом проекте
> **`web/`** (Next.js, перенос дизайна v2.0, фазы 5.1–5.5 по `docs/PORT_PLAN.md`). Supabase/Vercel для `web/`
> подключаются в фазах **5.4–5.5** — тогда эта инструкция будет переписана под `web/` (миграции 01–07 из
> `supabase/` будут дополнены таблицами для новых сущностей). До тех пор разворачивание `web/` не требуется:
> сайт работает локально (`cd web && npm install && npm run dev`) на localStorage.

Пошаговое руководство: от пустого места до работающего сайта на вашем домене.

**Что получится:** аккаунты с входом по e-mail/Google, облачная база Postgres с защитой на уровне строк,
аватары в хранилище, живая лента друзей, push-напоминания по расписанию и PWA, которое ставится на телефон.

**Сколько времени займёт:** 35–60 минут (без OAuth Google/GitHub — 30 минут).
**Сколько стоит:** 0 ₽. Бесплатных лимитов Supabase и Vercel хватает на личное использование и небольшой круг друзей.

---

## 📋 Содержание

- [Часть 0. Подготовка](#часть-0-подготовка)
- [Часть 1. Создание проекта Supabase](#часть-1-создание-проекта-supabase)
- [Часть 2. Создание базы данных (SQL)](#часть-2-создание-базы-данных-sql)
- [Часть 3. Хранилище аватаров](#часть-3-хранилище-аватаров)
- [Часть 4. Настройка авторизации](#часть-4-настройка-авторизации)
- [Часть 5. Копируем ключи](#часть-5-копируем-ключи)
- [Часть 6. Запуск локально](#часть-6-запуск-локально)
- [Часть 7. Деплой на Vercel](#часть-7-деплой-на-vercel)
- [Часть 8. Push-уведомления](#часть-8-push-уведомления)
- [Часть 9. Расписание напоминаний](#часть-9-расписание-напоминаний)
- [Часть 10. Финальная проверка](#часть-10-финальная-проверка)
- [Часть 11. Перенос данных из демо](#часть-11-перенос-данных-из-демо)
- [Часть 12. Troubleshooting](#часть-12-troubleshooting)
- [Часть 13. Как начать всё заново](#часть-13-как-начать-всё-заново)
- [Приложение A. Переменные окружения](#приложение-a-переменные-окружения)
- [Приложение B. Все команды одним блоком](#приложение-b-все-команды-одним-блоком)
- [Приложение C. Лимиты бесплатных планов](#приложение-c-лимиты-бесплатных-планов)

---

## Часть 0. Подготовка

### 0.1. Что понадобится

| Что | Зачем | Где взять |
|---|---|---|
| Node.js **22** или новее | сборка и запуск проекта | [nodejs.org](https://nodejs.org) → LTS |
| Git | загрузка кода на GitHub | обычно уже установлен |
| Аккаунт **GitHub** | Vercel деплоит из репозитория | [github.com](https://github.com) |
| Аккаунт **Supabase** | база данных, авторизация, хранилище | [supabase.com](https://supabase.com) |
| Аккаунт **Vercel** | хостинг | [vercel.com](https://vercel.com) |
| E-mail | на него придут подтверждения | — |

Проверьте Node:

```bash
node -v      # должно быть v22.x.x или выше
npm -v
git --version
```

> Если `node -v` показывает v18 или v20 — обновите. Библиотека `@supabase/supabase-js`
> печатает предупреждение на Node 20 и ниже, а Vercel по умолчанию использует Node 22.

### 0.2. Совет: зарегистрируйтесь через GitHub

На Vercel и Supabase удобнее всего входить **через GitHub** («Continue with GitHub»):
тогда репозиторий подхватится в один клик, не придётся вручную копировать URL.

### 0.3. Где лежат файлы

```
habitverse/
├── app/          ← это и есть сайт (Next.js). Эту папку деплоим на Vercel
├── supabase/     ← SQL-скрипты: 01_schema, 02_rls, 03_functions, 04_seed, 05_storage
├── demo/         ← автономное демо (localStorage), для деплоя не нужно
└── tests/        ← автопроверки демо
```

---

## Часть 1. Создание проекта Supabase

**1.1.** Откройте [supabase.com](https://supabase.com) → **Start your project** → войдите (лучше через GitHub).

**1.2.** Если это ваш первый проект, Supabase предложит выбрать организацию. Личная организация бесплатна — выбирайте её.

**1.3.** Нажмите **New project** и заполните:

| Поле | Что вписать |
|---|---|
| **Name** | `habitverse` (любое имя, можно потом поменять) |
| **Database Password** | придумайте длинный пароль и **сохраните его** в менеджере паролей — он понадобится для прямого подключения к БД |
| **Region** | берите географически ближайший. Для России/Европы — **Central EU (Frankfurt)** или **West EU (London)**. От региона зависит задержка при каждом запросе |
| **Pricing Plan** | **Free** |

**1.4.** Нажмите **Create new project**. Инициализация занимает 1–2 минуты.

**1.5.** Запишите **Project Ref** — это строка вроде `abcdefghijklmnop` в адресной строке:

```
https://supabase.com/dashboard/project/abcdefghijklmnop/...
                                              ^^^^^^^^^^^^^^^^ ваш ref
```

Он понадобится для команд CLI и для URL проекта (`https://<ref>.supabase.co`).

> ✅ **Чек-пойнт:** вы видите дашборд проекта с левым меню (Home, Table Editor, SQL Editor, Storage, Authentication, Edge Functions, Settings).

---

## Часть 2. Создание базы данных (SQL)

Здесь мы создаём 12 таблиц, включаем защиту строк (RLS), функции, триггеры и справочники.

### 2.1. Откройте SQL Editor

Левое меню → **SQL Editor** (иконка `</>`), либо напрямую:
`https://supabase.com/dashboard/project/<ваш-ref>/sql/new`

### 2.2. Выполните файлы ПО ПОРЯДКУ

Порядок важен: `02_rls.sql` опирается на таблицы из `01_schema.sql`, а `03_functions.sql` — на обе.

| № | Файл | Что делает | Ожидаемый результат |
|---|---|---|---|
| 1 | `supabase/01_schema.sql` | 12 таблиц, расширения `pgcrypto`/`pg_trgm`/`pg_cron`, индексы | `Success. No rows returned` |
| 2 | `supabase/02_rls.sql` | RLS на все таблицы, функция `are_friends()`, 25 политик | `Success. No rows returned` |
| 3 | `supabase/03_functions.sql` | триггер профиля, XP, авто-ачивки, пересчёт челленджей, `current_streak()`, `habit_stats()`, `search_users()`, **pg_cron** | `Success. No rows returned` |
| 4 | `supabase/04_seed.sql` | 20 достижений, 8 категорий, представления `v_today`/`v_leaderboard` | `Success. No rows returned` |
| 5 | `supabase/05_storage.sql` | бакет `avatars` + 4 политики хранилища | `Success. No rows returned` |
| 6 | `supabase/06_v1.1_freeze_negative_realtime.sql` | **v1.1.0:** колонки `is_negative` и `freezes`, функции заморозок, `is_due_on()`, обновлённые `current_streak()`/`habit_stats()`, **Realtime-публикация** | `Success. No rows returned` |
| 7 | `supabase/07_v1.2_weekly_quota_reactions.sql` | **v1.2.0:** колонка `weekly_target`, `week_start()`/`week_progress()`/`weekly_streak()`/`streak_for()`, таблица `feed_reactions` + RLS + `toggle_reaction()` | `Success. No rows returned` |

**Как выполнять каждый файл:**

1. Откройте файл в любом редакторе (или в просмотрщике) и **скопируйте всё содержимое**.
2. В SQL Editor вставьте в поле запроса.
3. Нажмите **Run** (или `Ctrl/Cmd + Enter`).
4. Дождитесь зелёной надписи **Success. No rows returned**.
5. Очистите редактор (**Clear** / `Ctrl/Cmd + L`) и переходите к следующему файлу.

> 💡 В каждом файле примерно 100–300 строк — вставляйте целиком, ничего не убирая.

### 2.3. Альтернатива: выполнить всё одной командой

Если у вас установлен `psql` (идёт с PostgreSQL или отдельно), можно залить всё сразу.
Строку подключения возьмите в **Settings → Database → Connection string → URI** (вкладка *Session mode*):

```bash
cd habitverse
export PGPASSWORD='ваш-пароль-от-БД'
PSQL="psql postgresql://postgres.<ref>:<пароль>@aws-0-<region>.pooler.supabase.com:5432/postgres"

for f in supabase/0*.sql; do
  echo "--- $f"
  $PSQL -v ON_ERROR_STOP=1 -f "$f"
done
```

> Используйте **Session pooler** (порт 5432) — он работает с DDL. Transaction pooler (порт 6543) для создания таблиц не подходит.

### 2.4. Проверьте, что всё создалось

**Способ 1 — через UI:** левое меню → **Table Editor** → схема `public`. Должны быть таблицы:

```
achievements        categories          challenge_members   challenges
feed_events         friendships         habit_logs          habits
notes               profiles            push_subscriptions  user_achievements
```

**Способ 2 — запросом.** В SQL Editor выполните:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Ожидаются те же 12 таблиц.

**Проверка v1.1.0 (заморозки, негативные привычки, Realtime):**

```sql
select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='habits'
   and column_name in ('is_negative','freezes');        -- 2 строки

select tablename from pg_publication_tables
 where pubname='supabase_realtime';                     -- habits, habit_logs, feed_events, profiles, …

select current_streak('uuid-привычки');                 -- integer
select freezes_left('uuid-привычки');                   -- integer
select * from habit_stats('uuid-привычки', 30);         -- 6 колонок, включая cur_streak и freezes_left
```

**Проверка v1.2.0 (недельная квота и реакции):**

```sql
select weekly_target from public.habits limit 1;        -- колонка существует

select * from public.week_progress('uuid-привычки');    -- week_from, due_days, done_days, goal, is_ok
select * from public.weekly_streak('uuid-привычки');    -- cur_weeks, best_weeks
select * from public.streak_for('uuid-привычки');       -- value, unit ('days'|'weeks'), best

select count(*) from public.feed_reactions;             -- 0 (таблица есть)
select proname from pg_proc where proname = 'toggle_reaction';   -- 1 строка
```

**Проверка справочников:**

```sql
select count(*) as достижений from achievements;   -- 22 (с v1.1.0)
select count(*) as категорий  from categories;     -- 8
select count(*) as политик    from pg_policies where schemaname = 'public';  -- ~25
```

**Проверка, что RLS включён везде:**

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r';
```
У всех строк `relrowsecurity` должно быть `t` (true).

> ✅ **Чек-пойнт:** 12 таблиц, 20 достижений, 8 категорий, RLS = true везде.

### 2.5. Если вылезла ошибка

| Ошибка | Причина | Решение |
|---|---|---|
| `permission denied for schema public` | запускаете не от владельца | в правом верхнем углу SQL Editor убедитесь, что подключение идёт от `postgres` (по умолчанию так и есть) |
| `extension "pg_cron" is not available` | на некоторых планах расширение недоступно | это **не критично**: в `03_functions.sql` блок с cron обёрнут в `try/catch` и печатает notice. Расписание настроим через Vercel Cron (часть 9) |
| `relation "profiles" does not exist` | запускаете файлы не по порядку | выполните сначала `01_schema.sql` |
| `policy "..." already exists` | скрипт запускали дважды | всё в порядке — в скриптах есть `drop policy if exists`; просто обновите файл и запустите заново |

---

## Часть 3. Хранилище аватаров

Если вы уже выполнили `05_storage.sql` — бакет создан, **проверьте только пункт 3.2** и переходите к части 4.

### 3.1. Ручной вариант (через UI)

1. Левое меню → **Storage**.
2. **New bucket** → имя: `avatars` → включите переключатель **Public bucket**.
3. **File size limit**: `5242880` (5 МБ).
4. **Allowed MIME types**: `image/png, image/jpeg, image/webp, image/gif, image/avif`.
5. **Save**.

### 3.2. Политики доступа (обязательно)

Без них загрузка аватара вернёт ошибку `new row violates row-level security policy`.

**Storage → выберите бакет `avatars` → вкладка Policies → New policy → For full customization** и создайте 4 политики:

| Name | Allowed operation | Target roles | WITH CHECK / USING expression |
|---|---|---|---|
| `avatars: чтение публичное` | **SELECT** | `anon`, `authenticated` | `bucket_id = 'avatars'` |
| `avatars: загрузка своего файла` | **INSERT** | `authenticated` | `(storage.foldername(name))[1] = auth.uid()::text` |
| `avatars: обновление своего` | **UPDATE** | `authenticated` | `(storage.foldername(name))[1] = auth.uid()::text` |
| `avatars: удаление своего` | **DELETE** | `authenticated` | `(storage.foldername(name))[1] = auth.uid()::text` |

> Все четыре уже прописаны в `supabase/05_storage.sql` — если выполнили его, делать ничего не нужно.
> Проверка: `select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects';` → 4 строки.

### 3.3. Проверка

**Storage → avatars** должен значиться как **Public**. Зайдите в **Кабинет** приложения позже и загрузите фото — файл появится в папке `avatars/<ваш-user-id>.jpg`.

---

## Часть 4. Настройка авторизации

### 4.1. E-mail + пароль (обязательно)

Включено по умолчанию, но на время разработки удобнее отключить подтверждение письма:

1. Левое меню → **Authentication** → **Sign In / Up** (в старых версиях — **Providers**).
2. Провайдер **Email** → включён.
3. Выключите **Confirm email** → **Save**.

> ⚠️ Если оставить включённым — после регистрации вы не попадёте в приложение, пока не перейдёте по ссылке из письма.
> Для локальной разработки на `localhost` письма часто не доходят. **Перед деплоем на прод верните переключатель обратно.**

**Ручной режим для тестов:** здесь же можно выключить **Secure email change** и **Secure password change**, чтобы не требовалось повторное подтверждение.

### 4.2. Google (по желанию)

1. Зайдите в [Google Cloud Console](https://console.cloud.google.com) → создайте проект.
2. **APIs & Services → OAuth consent screen** → External → заполните название, e-mail → Save.
   В **Audience** добавьте себя как *Test user* (иначе вход будет доступен только верифицированным доменам).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → тип **Web application**.
4. В **Authorized redirect URIs** добавьте:
   ```
   https://<ваш-ref>.supabase.co/auth/v1/callback
   ```
5. Скопируйте **Client ID** и **Client Secret**.
6. Supabase → **Authentication → Sign In / Up → Google** → включите → вставьте Client ID и Secret → **Save**.

### 4.3. GitHub (по желанию)

1. [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**.
2. **Authorization callback URL**:
   ```
   https://<ваш-ref>.supabase.co/auth/v1/callback
   ```
3. Скопируйте Client ID, сгенерируйте Client Secret.
4. Supabase → **Authentication → Sign In / Up → GitHub** → включите → вставьте ключи → **Save**.

### 4.4. URL-конфигурация (важно!)

**Authentication → URL Configuration**:

| Поле | Значение на этапе локальной разработки | Значение после деплоя |
|---|---|---|
| **Site URL** | `http://localhost:3000` | `https://ваш-проект.vercel.app` |
| **Redirect URLs** | `http://localhost:3000/auth/callback`<br>`http://localhost:3000/**` | `https://ваш-проект.vercel.app/auth/callback`<br>`https://ваш-проект.vercel.app/**` |

> 🔴 **Самая частая причина «вхожу и меня выбрасывает обратно на /login»** — Site URL или Redirect URLs не совпадают с реальным адресом.
> После каждого добавления домена возвращайтесь сюда.

---

## Часть 5. Копируем ключи

> ⚠️ **Важно про смену ключей Supabase.** До конца 2026 года Supabase выводит из обращения
> legacy-ключи `anon` и `service_role` (они начинаются с `eyJ…`) и переводит всех на
> **publishable** (`sb_publishable_…`) и **secret** (`sb_secret_…`) ключи. Работают обе схемы,
> но берите новую — она короче и не истекает.

### 5.1. Самый быстрый способ — кнопка Connect

В дашборде проекта нажмите **Connect** (справа сверху) → выберите фреймворк **Next.js**.
Supabase покажет готовый блок переменных — просто скопируйте значения.

### 5.2. Вручную

| Переменная | Где взять | Секретность |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Connect → App**, либо **Settings → Data API → Project URL**. Вид: `https://<ref>.supabase.co` | публичная |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Settings → API Keys** → вкладка *Publishable and secret API keys* → **publishable key** (`sb_publishable_…`). Либо legacy **anon public** (`eyJ…`) | публичная (доступ ограничен RLS) |
| `SUPABASE_SECRET_KEY` | там же → **secret key** (`sb_secret_…`). Либо legacy **service_role** | 🔒 **секрет** |

**Правила:**
- Переменные с префиксом `NEXT_PUBLIC_` попадают в клиентский JavaScript — туда кладём **только publishable/anon**.
- `SUPABASE_SECRET_KEY` обходит RLS полностью. Никогда не добавляйте к нему префикс `NEXT_PUBLIC_` и не коммитьте в git.
- В **Edge Functions** секретный ключ **не нужен** — Supabase автоматически подставляет `SUPABASE_SECRET_KEY` в окружение функции.

---

## Часть 6. Запуск локально

### 6.1. Установите зависимости

```bash
cd habitverse/app
npm install
```

Первый раз займёт 1–3 минуты (будет ~700 МБ в `node_modules`).

### 6.2. Создайте `.env.local`

```bash
cp .env.example .env.local
```

Откройте `.env.local` и заполните **три обязательные** строки:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` и `CRON_SECRET` для локального запуска **не обязательны** —
без них просто не будет push-уведомлений и cron. Всё остальное работает.

> `.env.local` уже в `.gitignore` — в репозиторий он не попадёт.

### 6.3. Запустите

```bash
npm run dev
```

Откройте **http://localhost:3000**.

### 6.4. Первый вход

1. На лендинге нажмите **Начать бесплатно** → попадёте на `/register`.
2. Введите имя, e-mail, пароль → **Создать аккаунт**.
   - Если **Confirm email** выключен (п. 4.1) — вы сразу попадёте в онбординг.
   - Если включён — придёт письмо; для локальной разработки проверьте [Inbucket](http://localhost:54324) (если поднимали Supabase локально) либо временно выключите подтверждение.
3. Онбординг: имя → аватар → готово.
4. Создайте первую привычку: **＋ Добавить** → название → иконка/цвет → расписание → **Создать**.
5. Отметьте её галочкой — полетят XP, конфетти, звук.

### 6.5. Проверка связи с БД

В Supabase → **Table Editor → habits** должна появиться ваша строка. В **Authentication → Users** — ваш аккаунт.

> ✅ **Чек-пойнт:** локально работает регистрация, создание привычек, отметки, календарь, отчёты.

---

## Часть 7. Деплой на Vercel

### 7.1. Загрузите код на GitHub

```bash
cd habitverse          # корень проекта, НЕ app/
git init
git add .
git commit -m "HabitVerse: трекер привычек (Next.js + Supabase)"
git branch -M main
```

Создайте репозиторий на [github.com/new](https://github.com/new) (например, `habitverse`, Public или Private), затем:

```bash
git remote add origin https://github.com/<ваш-логин>/habitverse.git
git push -u origin main
```

**Проверьте, что в репозиторий НЕ попали:**
- `app/node_modules/` (734 МБ) — в `.gitignore`
- `app/.next/` — в `.gitignore`
- `app/.env.local` — в `.gitignore` 🔒

```bash
git status --ignored | head -20     # что игнорируется
git ls-files | grep -E "node_modules|\.env" # должно быть пусто
```

> 💡 Если репозиторий получился огромным — `node_modules` случайно закоммитился. Лечится:
> ```bash
> git rm -r --cached app/node_modules app/.next && git commit -m "chore: ignore build artifacts"
> ```

### 7.2. Импорт в Vercel

1. [vercel.com/new](https://vercel.com/new) → войдите через GitHub → **Authorize Vercel** для нужного репозитория.
2. Выберите репозиторий `habitverse` → **Import**.
3. На странице настройки проекта **обязательно** раскройте **Root Directory** и укажите:
   ```
   app
   ```
   Это ключевой шаг: сам сайт лежит в подпапке `app/`, а не в корне репозитория.
4. Дальше Vercel сам определит:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build` *(уже прописан в package.json как `next build --webpack`)*
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`
5. **НЕ нажимайте Deploy сразу** — сначала добавьте переменные (7.3).

### 7.3. Переменные окружения

Раскройте **Environment Variables** и добавьте (для окружений **Production** и **Preview**):

| Key | Value | Sensitivity |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | обычная |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` | обычная |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | 🔒 **Sensitive** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | публичный VAPID-ключ (см. часть 8) | обычная |
| `CRON_SECRET` | `openssl rand -hex 32` | 🔒 **Sensitive** |
| `NEXT_PUBLIC_SITE_URL` | `https://<ваш-проект>.vercel.app` | обычная |

> Точное имя будущего домена можно увидеть заранее: Vercel показывает его на этой же странице.
> Если домен смените — обновите эту переменную и **пересоберите** проект.

> 🔴 Переменные с префиксом `NEXT_PUBLIC_` **впекаются в клиентский бандл на этапе сборки**.
> Если измените их после деплоя — обязательно нажмите **Deployments → ⋯ → Redeploy**.

### 7.4. Node.js version

**Settings → General → Node.js Version** → выберите **22.x** (или новее).

### 7.5. Deploy

Нажмите **Deploy**. Первая сборка идёт 2–4 минуты.

В логе сборки вы должны увидеть примерно такое:

```
✓ Compiled successfully
✓ Running TypeScript
✓ Collecting page data
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/cron/reminders
├ ƒ /auth/callback
├ ƒ /calendar
├ ƒ /dashboard
├ ƒ /feed
├ ƒ /forgot
├ ƒ /login
├ ƒ /notes
├ ƒ /profile
├ ƒ /register
├ ƒ /social
└ ƒ /stats
ƒ Proxy (Middleware)
```

### 7.6. Вернитесь в Supabase и пропишите боевой адрес

**Authentication → URL Configuration**:
- **Site URL**: `https://<ваш-проект>.vercel.app`
- **Redirect URLs**: добавьте `https://<ваш-проект>.vercel.app/auth/callback` и `https://<ваш-проект>.vercel.app/**`

**Authentication → Sign In / Up → Email**: верните **Confirm email** во включённое состояние (для прода).

### 7.7. Свой домен (по желанию)

**Vercel → Settings → Domains → Add** → укажите домен → Vercel выдаст DNS-записи (A или CNAME) →
добавьте их у регистратора → дождитесь зелёных галочек (обычно 5–60 минут) →
обновите `NEXT_PUBLIC_SITE_URL`, Site URL и Redirect URLs → **Redeploy**.

---

## Часть 8. Push-уведомления

Push — единственная часть, требующая отдельной настройки. Без неё всё остальное работает,
а напоминания будут приходить только в открытой вкладке.

### 8.1. Сгенерируйте VAPID-ключи

```bash
npx web-push generate-vapid-keys
```

Получите два значения:

```
=======================================
Public Key:
BJx...очень_длинная_строка...

Private Key:
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
=======================================
```

### 8.2. Public Key → Vercel

**Vercel → Settings → Environment Variables** → добавьте:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = BJx...
```

Затем **Deployments → ⋯ → Redeploy** (переменная публичная, нужна пересборка).

### 8.3. Private Key → секреты Supabase

Установите CLI (если ещё не стоит):

```bash
npm install -g supabase
supabase --version          # нужна 1.60+
```

Войдите и привяжите проект:

```bash
supabase login              # откроет браузер, подтвердите
supabase projects list      # найдите свой ref
supabase link --project-ref <ваш-ref>
```

Запишите секреты:

```bash
supabase secrets set \
  VAPID_PRIVATE_KEY="ваш-приватный-ключ" \
  VAPID_PUBLIC_KEY="ваш-публичный-ключ" \
  VAPID_SUBJECT="mailto:ваш@email.com"
```

Проверка: `supabase secrets list` — должны быть три строки (плюс автоматически инжектируемые `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`).

> 🔒 `VAPID_PRIVATE_KEY` — только в секретах Supabase. В Vercel и в git его быть не должно.

### 8.4. Задеплойте Edge Function

```bash
cd habitverse/app
supabase functions deploy send-reminders --no-verify-jwt
```

> Функция лежит в `habitverse/app/supabase/functions/send-reminders/index.ts`.
> CLI ищет её относительно текущей директории, поэтому запускать нужно из `app/`.
>
> Флаг `--no-verify-jwt` нужен, потому что функцию вызывает cron по расписанию, а не живой пользователь.
> Доступ защищён секретным ключом, который функция читает из окружения.

### 8.5. Проверьте функцию вручную

```bash
curl -X POST "https://<ваш-ref>.supabase.co/functions/v1/send-reminders" \
  -H "apikey: <ваш SUPABASE_SECRET_KEY>" \
  -H "Authorization: Bearer <ваш SUPABASE_SECRET_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"mode":"reminders"}'
```

Ожидаемый ответ:

```json
{"mode":"reminders","hhmm":"18:42","due":0,"sent":0,"skipped":0,"at":"2026-10-06T15:42:11.123Z"}
```

`due: 0` — нормально: сейчас ни у одной привычки не наступило время напоминания.
Если придёт `{"error":"..."}` — смотрите таблицу в части 12.

### 8.6. Включите push в интерфейсе

1. Откройте сайт → **Кабинет** → блок **🔔 Напоминания**.
2. Включите **Push-уведомления** → браузер спросит разрешение → **Разрешить**.
3. Нажмите **⏰ Напоминание** у любой привычки → поставьте время через 2 минуты → **Сохранить**.
4. Закройте вкладку entirely и дождитесь уведомления.

> 📱 **iOS:** push работает только если сайт установлен как PWA — Safari → «Поделиться» → «На экран „Домой"», затем включить уведомления в настройках этого ярлыка.
> 🖥 **Windows:** разрешения на уведомления должны быть разрешены в *Параметры → Система → Уведомления*, и сайт не должен быть в режиме «Инкогнито».

---

## Часть 9. Расписание напоминаний

Функция `send-reminders` умеет два режима:
- `mode=reminders` — проверяет, у каких привычек сейчас наступило `reminder_time`, и шлёт push;
- `mode=digest` — вечерняя сводка в `digest_time` из профиля («Осталось N из M»).

Оба нужно вызывать **каждые 15 минут**. Есть два способа — выберите один.

### 9.1. Вариант A: pg_cron внутри Supabase (рекомендуется, работает на Free)

Он **уже настроен** в `03_functions.sql`. Осталось сообщить ему адрес функции и ключ.

**Способ 1 — через настройки БД (надёжнее, переживает перезапуск):**

**Settings → Database → Custom settings (Postgres)** → добавьте два параметра:

| Name | Value |
|---|---|
| `app.settings.functions_url` | `https://<ваш-ref>.supabase.co/functions/v1` |
| `app.settings.service_role_key` | ваш `sb_secret_…` (или legacy service_role) |

Сохраните — база перезапустится (30–60 секунд).

**Способ 2 — одной командой в SQL Editor** (если первого варианта в меню нет):

```sql
alter database postgres set app.settings.functions_url = 'https://<ваш-ref>.supabase.co/functions/v1';
alter database postgres set app.settings.service_role_key = 'sb_secret_ВАШКЛЮЧ';
-- применить без перезапуска:
select pg_reload_conf();
```

**Проверьте, что задания созданы:**

```sql
select jobid, jobname, schedule, active from cron.job order by jobid;
```

Должны быть две строки: `hv-reminders-hourly` (`*/15 * * * *`) и `hv-finish-challenges` (`10 0 * * *`).

**Посмотрите журнал выполнения:**

```sql
select jobid, status, return_message, start_time
from cron.job_run_details
order by start_time desc
limit 10;
```

`status = 'succeeded'` — всё работает.

### 9.2. Вариант B: Vercel Cron

В `app/vercel.json` уже прописано:

```json
"crons": [
  { "path": "/api/cron/reminders?mode=reminders", "schedule": "*/15 * * * *" },
  { "path": "/api/cron/reminders?mode=digest",    "schedule": "*/15 * * * *" }
]
```

> 🔴 **Ограничение:** план **Vercel Hobby** поддерживает только **одно задание раз в сутки**.
> Расписание `*/15 * * * *` работает на плане **Pro** ($20/мес).
> На Hobby либо оставьте **pg_cron** (вариант A), либо поменяйте schedule на `0 20 * * *` —
> тогда раз в день в 20:00 UTC будет приходить только вечерняя сводка.

Для варианта B в переменных Vercel должны быть:
`SUPABASE_SECRET_KEY` и `CRON_SECRET`.

**Проверка:** Vercel → ваш проект → **Settings → Crons** — должны отображаться два задания со временем следующего запуска.
Журнал вызовов: **Deployments → Functions → /api/cron/reminders → Logs**.

**Вызвать вручную для теста:**

```bash
curl "https://<ваш-проект>.vercel.app/api/cron/reminders?mode=reminders" \
  -H "Authorization: Bearer <ваш CRON_SECRET>"
```

---

## Часть 10. Финальная проверка

Пройдитесь по списку на **боевом** адресе. Это занимает 5 минут и ловит 95% проблем.

| # | Что проверить | Как | Ожидаемый результат |
|---|---|---|---|
| 1 | Регистрация | `/register` → новый e-mail + пароль | Письмо пришло (или сразу вошли, если confirm выключен) |
| 2 | Онбординг | После входа | 4 шага, профиль сохранился |
| 3 | Создание привычки | `/dashboard` → ＋ Добавить → иконка, цвет, расписание, время | Появилась в списке |
| 4 | Отметка | Клик по кружку | ✓, XP +12, конфетти, звук |
| 5 | Данные в облаке | Supabase → Table Editor → `habits`, `habit_logs` | Строки на месте |
| 6 | Синхронизация | Откройте сайт в **другом браузере/инкогнито**, войдите тем же аккаунтом | Те же привычки и отметки |
| 7 | Календарь | `/calendar` → клик по прошлому дню → отметить | Backfill работает, heatmap окрасился |
| 8 | Отчёты | `/stats` → переключите диапазоны 7/30/90/365 | Все 4 графика рисуются, инсайты есть |
| 9 | Аватар | `/profile` → 📷 изменить → загрузите картинку | Фото появилось; в Storage → avatars лежит файл |
| 10 | Дата рождения | `/profile` → укажите дату → сохранить | Появился бейдж «🎂 N лет» |
| 11 | Темы | `/profile` → 5 тем, 16 акцентов, плотность | Меняются мгновенно; после F5 тема сохранилась (без белой вспышки) |
| 12 | Заметки | `/notes` → создайте с тегами и `**разметкой**` | Сохранилась, теги фильтруют |
| 13 | Челлендж | `/social` → ＋ Челлендж → скопируйте код | Карточка с прогрессом, код виден |
| 14 | Второй аккаунт | Инкогнито → регистрация → `/social` → найти первого по имени → заявка | Заявка появилась у первого; после «Принять» оба видят друг друга в ленте и лидерборде |
| 15 | Realtime ленты | В одном окне отметьте привычку | Во втором окне `/feed` событие появится **без перезагрузки** (в течение секунды) |
| 16 | Push | `/profile` → включить Push → у привычки время через 2 мин → закрыть вкладку | Уведомление пришло |
| 17 | PWA | В адресной строке Chrome — иконка «установить» | Приложение ставится, работает офлайн (оболочка) |
| 18 | Экспорт | `/stats` → ⬇ CSV | Файл скачался, открывается в Excel |
| 19 | Защита | Выйдите из аккаунта → откройте `/dashboard` напрямую | Редирект на `/login` |
| 20 | Чужие данные | Залогиньтесь вторым аккаунтом | Привычки и **заметки** первого не видны |
| 21 | Заморозка стрика (v1.1) | Поставьте ✕ за вчера при `🧊 ≥ 1` | Стрик не оборвался, счётчик 🧊 уменьшился на 1 |
| 22 | Негативная привычка (v1.1) | Создайте с типом «🚫 Не делать» → отметьте | Иконка 🛡, бейдж «не делать», стрик растёт |
| 23 | Drag-and-drop (v1.1) | Потяните привычку за ручку ⠿ | Порядок изменился и сохранился после F5 |
| 24 | Realtime (v1.1) | Два окна, во втором отметьте привычку | В первом цифра обновилась без F5 |
| 25 | Недельная квота (v1.2) | У привычки поставьте «3 из 7», закройте 3 дня за прошлую неделю | Стрик в **неделях**, бейдж `📅 3/3 нед.` |
| 26 | Каталог (v1.2) | 📚 Каталог → поиск «воды» → клик по карточке | Найдено 2, привычка добавлена; повторный клик — «уже есть» |
| 27 | Карточка для шаринга (v1.2) | Меню привычки ⋯ → 📤 Поделиться → Скачать PNG | Файл 1080×1080 скачался |
| 28 | Реакции (v1.2) | `/feed` → клик по 🔥 | Счётчик вырос, повторный клик снял реакцию |
| 29 | Тач-DnD (v1.2) | На телефоне потяните за ручку ⠿ | Порядок изменился и сохранился после F5 |
| 30 | WebGL-сфера (v1.2) | Переключатель «3D: CSS» → «3D: WebGL» | Сфера перерисовалась, three.js докачался с CDN |

> ✅ Если все 20 пунктов зелёные — проект полностью подключён.

---

## Часть 11. Перенос данных из демо

Если вы уже наработали историю в `HabitVerse-demo.html`, её можно перенести.

### 11.1. Экспорт из демо

Демо → **Кабинет** → **⬇ Экспорт JSON**. Скачается `habitverse-2026-10-06.json` со структурой:

```json
{
  "profile": { "name": "...", "emoji": "...", "xp": 0, "theme": "midnight", ... },
  "habits":  [ { "id": "h_abc", "name": "...", "emoji": "...", "color": "...",
                 "cat": "health", "freq": { "type": "weekdays", "days": [0,2,4] },
                 "start": "2026-07-06", "target": 1, "unit": "", "reminder": "06:40", ... } ],
  "logs":    { "h_abc": { "2026-10-05": { "status": "done", "val": null, "note": "" } } },
  "notes":   [ { "title": "...", "body": "...", "tags": ["инсайт"], "color": "", "pinned": true } ],
  "challenges": [], "friends": [], "feed": []
}
```

### 11.2. Импорт в облачную версию

**Способ 1 — полуавтоматический (рекомендую).** Сообщите мне, что вы готовы, и я напишу
`app/scripts/import-demo.ts`: скрипт читает JSON, создаёт привычки через `createHabit`,
затем проставляет отметки через `setLog` (с поправкой на новые UUID).
Запуск — `npx tsx scripts/import-demo.ts ./habitverse-2026-10-06.json`.

**Способ 2 — вручную через SQL.** Быстро, если привычек немного:

```sql
-- 1) создаём привычку
insert into public.habits
  (user_id, name, emoji, color, description, category,
   freq_type, freq_days, freq_every, start_date, target_count, target_unit,
   reminder_time, reminder_on, difficulty, position)
values
  ('ВАШ_USER_ID', 'Утренняя пробежка', '🏃', '#ff6b35', '5 км в лёгком темпе', 'health',
   'weekdays', array[0,2,4], 1, '2026-07-06', 1, '',
   '06:40', true, 3, 0)
returning id;

-- 2) заливаем отметки (скопированный id подставьте в habit_id)
insert into public.habit_logs (habit_id, user_id, log_date, status, value, note) values
  ('ID_ПРИВЫЧКИ', 'ВАШ_USER_ID', '2026-10-03', 'done', null, ''),
  ('ID_ПРИВЫЧКИ', 'ВАШ_USER_ID', '2026-10-05', 'done', null, ''),
  ('ID_ПРИВЫЧКИ', 'ВАШ_USER_ID', '2026-10-06', 'miss', null, '');
```

> Обратите внимание: `cat` в демо → `category` в БД; `freq.type` → `freq_type`; `freq.days` → `freq_days`;
> `reminder` (`"06:40"`) → `reminder_time` (`'06:40:00'`); `target` → `target_count`; `unit` → `target_unit`.

### 11.3. Перенос настроек профиля

```sql
update public.profiles set
  display_name = 'Ваше имя',
  emoji = '🦊',
  bio = '...',
  birth_date = '1996-05-14',
  theme = 'midnight',
  accent = 0,
  sound = true
where id = 'ВАШ_USER_ID';
```

---

## Часть 11b. Импорт из демо — готовый скрипт

С версии **1.1.0** переносить данные вручную не нужно: есть CLI-скрипт `app/scripts/import-demo.ts`.

```bash
cd habitverse/app
npm install                       # нужен devDependency tsx

# 1) сначала «насухо» — посмотрим, что и как смаппится, ничего не записывая
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SECRET_KEY="sb_secret_..." \
npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com --dry

# 2) боевой прогон
NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co" \
SUPABASE_SECRET_KEY="sb_secret_..." \
npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com --with-notes --with-challenges
```

| Флаг | Что делает |
|---|---|
| `--email you@mail.com` | найти пользователя по e-mail (нужен Supabase secret key) |
| `--user <uuid>` | задать пользователя напрямую, если знаете его `id` |
| `--dry` | только отчёт по маппингу, в БД ничего не пишется |
| `--force` | создавать привычки, даже если такое имя уже есть |
| `--with-notes` | перенести заметки (с привязкой к привычкам) |
| `--with-challenges` | перенести челленджи и вступить в них создателем |

Скрипт **идемпотентен**: привычки с уже существующими именами пропускаются, отметки льются
`upsert` по `(habit_id, log_date)` пачками по 500. Повторный запуск безопасен.

Что переносится: профиль (имя, эмодзи, био, дата рождения, тема, акцент), привычки
(включая расписание, напоминания, цель в единицах, негативный тип и число заморозок),
вся история отметок, заметки, челленджи.

Пример отчёта `--dry`:

```
📦 В файле: привычек 3, заметок 1
   к созданию: 3

   1. 🏃 Утренняя пробежка
      weekdays [0,2,4] · с 2026-08-28
      ✅ делать · 🧊 заморозок 2 · напоминание 06:40:00
      отметок: 7 (выполнено 7)
   2. 🚫 Без сахара
      daily · с 2026-08-28
      🚫 НЕ делать · 🧊 заморозок 3 · напоминание —
      отметок: 3 (выполнено 2)
```

> Фикстура для тренировки: `tests/fixtures/demo-export-sample.json` — на ней можно гонять `--dry` без живой базы.
>
> ⚠️ Поле `frozen` (потраченные заморозки) из демо не переносится: в БД такой колонки нет.
> Заморозки проставятся заново при следующем провале — на исторические стрики это не влияет.

## Часть 12. Troubleshooting

### Авторизация

| Симптом | Причина | Решение |
|---|---|---|
| После входа возвращает на `/login` | Неверные **Site URL** / **Redirect URLs** | Часть 4.4. Добавьте `https://<домен>/auth/callback` и `/**` |
| `Invalid login credentials` при верном пароле | Пользователь не подтвердил e-mail | Authentication → Users → найдите пользователя → **Confirm email** вручную; или выключите Confirm email |
| Письмо не приходит | Попадает в спам / лимиты бесплатного SMTP | Проверьте спам. На Free Supabase даёт ~3–4 письма в час через встроенный SMTP; для прода подключите свой SMTP: **Settings → Auth → SMTP Settings** (Resend, SendGrid, Mailgun) |
| `Email not confirmed` | То же | Подтвердите пользователя в Authentication → Users |
| Google: `redirect_uri_mismatch` | Callback URL в Google Cloud ≠ supabase | В Google Cloud → Credentials → Authorized redirect URI должен быть ровно `https://<ref>.supabase.co/auth/v1/callback` |
| `NEXT_PUBLIC_SUPABASE_URL is not defined` при сборке | Переменная не добавлена в Vercel или добавлена без пересборки | Добавьте и нажмите **Redeploy** |

### База и RLS

| Симптом | Причина | Решение |
|---|---|---|
| `new row violates row-level security policy` при создании привычки | Не выполнен `02_rls.sql` или профиль не создался | Проверьте: `select * from profiles where id = auth.uid();` Если пусто — выполните `select public.handle_new_user();` либо пересоздайте аккаунт |
| Списки пустые, хотя данные есть | RLS режет строки | Убедитесь, что вы вошли тем же аккаунтом, которым создавали данные |
| `relation "v_leaderboard" does not exist` | Не выполнен `04_seed.sql` | Выполните его |
| Ачивки не отображаются | Не выполнен `04_seed.sql` (таблица `achievements` пуста) | Выполните; в UI есть фолбэк, но лучше залить справочник |
| `permission denied for table ...` (не «violates policy») | Не выданы гранты роли `authenticated` | `grant all on all tables in schema public to authenticated, anon;`<br>`alter default privileges in schema public grant all on tables to authenticated, anon;` |

### Хранилище

| Симптом | Причина | Решение |
|---|---|---|
| Аватар не загружается, ошибка policy | Нет политик INSERT/UPDATE на `storage.objects` | Часть 3.2 или `05_storage.sql` |
| Фото загрузилось, но не отображается | Бакет не **Public** | Storage → avatars → включите Public bucket |
| `The object exceeded the maximum upload size` | Файл > 5 МБ | Сожмите изображение или поднимите лимит в настройках бакета |

### Сборка и деплой

| Симптом | Причина | Решение |
|---|---|---|
| Build failed: `Module not found: Can't resolve '@/...'` | Не указан **Root Directory = `app`** | Vercel → Settings → General → Root Directory |
| Build убит по памяти (`Killed`, exit 137) | Турбопак + мало памяти | `package.json` уже содержит `"build": "next build --webpack"`. Если переопределили Build Command в Vercel — верните `npm run build` |
| Build worker: `exited with signal: SIGKILL` без текста ошибки | ① в бандле тяжёлые 3D-пакеты, ② **побитый кэш npm** | ① с v1.2.0 three.js грузится с CDN и в зависимостях его нет — не добавляйте `three`/`@react-three/*` обратно. ② проверьте `du -sh node_modules/next` (должно быть ~200 МБ). Если 12 КБ — `rm -rf node_modules && npm cache clean --force && npm install` |
| `npm install` пишет «added N packages», но пакеты пустые | Побитый кэш npm | То же: `npm cache clean --force` и переустановка. Симптом легко принять за нехватку памяти |
| Не включается WebGL-сфера | three.js не загрузился с CDN | Нужен доступ к `cdn.jsdelivr.net`. Переключатель «3D: CSS / 3D: WebGL» на главной; при ошибке автоматически остаётся CSS-версия |
| `Type error: ...` | Изменили код | Локально `npm run typecheck`, исправьте, запушьте |
| Сайт открывается, но белый экран | Ошибка в клиентском JS | Откройте DevTools → Console. Чаще всего — не заданы `NEXT_PUBLIC_*` |
| 404 на всех страницах кроме главной | Неверный Output Directory | Должно быть `.next` (по умолчанию для Next.js) |

### Push и cron

| Симптом | Причина | Решение |
|---|---|---|
| Push не включается, ошибка в консоли | Нет `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Часть 8.2 + Redeploy |
| `PushManager:subscription failed` | Сайт не по HTTPS | Push работает только на `https://` и на `localhost` |
| Функция отвечает `{"error":"Нет секретного ключа..."}` | Не задан секрет | `supabase secrets set VAPID_PRIVATE_KEY="..."` |
| Функция 401 Unauthorized | Неверный `apikey` при вызове | Используйте `sb_secret_…` в заголовках `apikey` и `Authorization` |
| `cron.job` пустой | `pg_cron` недоступен | Используйте Vercel Cron (9.2) |
| Cron в Vercel не запускается | План Hobby | Либо pg_cron, либо schedule раз в сутки, либо Pro |
| Напоминание пришло на час раньше/позже | Функция сравнивает по UTC | В `habit_logs`/`reminder_time` время локальное; для точности задайте `timezone` в профиле — функция поддерживает его поле (можно доработать расчёт по `AT TIME ZONE`) |

### Производительность

| Симптом | Решение |
|---|---|
| Долго грузится `/stats` за 365 дней | Данные тянутся одним запросом за 400 дней — это нормально до ~50 привычек. Дальше используйте `habit_stats()` из БД |
| Много строк в `habit_logs` | Индексы уже созданы (`idx_logs_user_range`). Проверьте план: `explain analyze select ... ` |

### v1.1.0: заморозки, Realtime, бейдж

| Симптом | Причина | Решение |
|---|---|---|
| `column "is_negative" does not exist` | Не выполнена миграция `06_v1.1_…sql` | Выполните её в SQL Editor |
| `function current_streak(uuid) is not unique` | Осталась старая версия функции из `03_functions.sql` | `drop function if exists public.current_streak(uuid);` затем снова выполните `06_…sql` |
| Отметки друзей не появляются без F5 | Таблицы не в publication `supabase_realtime` | `select tablename from pg_publication_tables where pubname='supabase_realtime';` → должно быть 6 таблиц. Если Realtime выключен: Settings → Database → включите |
| В консоли `WebSocket connection failed` | Supabase Realtime не поднимается (пауза проекта на Free-плане) | Зайдите в дашборд Supabase и восстановите проект |
| Нет цифры на иконке PWA | Badging API не поддерживается | Работает в Chrome/Edge/Samsung Internet и только для **установленного** PWA. Safari/iOS — не поддерживает |
| Заморозка не сработала | День не помечен ✕, а просто не заполнен | Заморозка спасает только явный провал. Поставьте ✕ за тот день |
| Стрик «прыгает» при обновлении | Не выполнена миграция 06 (SQL-функции считают по старой логике) | Выполните `06_…sql` — клиент и БД должны использовать одну семантику |
| Импорт: `Node.js detected but native WebSocket not found` | Node 20 и ниже | Обновитесь до Node 22+ (скрипт уже содержит полифилл `ws`, но он подключается только если пакет установлен) |
| Импорт: `Пользователь ... не найден` | Нет такого e-mail в проекте | Сначала зарегистрируйтесь в приложении, потом запускайте импорт |

---

## Часть 13. Как начать всё заново

### Сбросить только данные (оставив схему)

```sql
-- порядок не важен, каскады проставлены
truncate table public.habit_logs, public.feed_events, public.user_achievements,
               public.challenge_members, public.challenges, public.notes,
               public.friendships, public.push_subscriptions, public.habits
cascade;

-- обнулить XP
update public.profiles set xp = 0;
```

### Удалить аккаунт

```sql
-- сначала данные (каскады удалят остальное), потом пользователя
delete from public.profiles where id = 'UUID_ПОЛЬЗОВАТЕЛЯ';
-- затем: Authentication → Users → ⋯ → Delete user
```

### Полностью пересоздать схему

```sql
drop table if exists public.user_achievements, public.achievements, public.push_subscriptions,
  public.feed_events, public.challenge_members, public.challenges, public.notes,
  public.habit_logs, public.habits, public.friendships, public.categories, public.profiles
cascade;
drop view if exists public.v_today, public.v_leaderboard;
```
Затем заново выполните `01_schema.sql` … `05_storage.sql`.

### Удалить проект целиком

- **Vercel**: Settings → General → Delete Project.
- **Supabase**: Settings → General → **Delete project** (необратимо, резервной копии на Free нет).

---

## Приложение A. Переменные окружения

| Переменная | Где | Обязательна | Описание |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | ✅ | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | ✅ | publishable (`sb_publishable_…`) или legacy anon |
| `SUPABASE_SECRET_KEY` | Vercel (🔒 Sensitive) | для Vercel Cron | secret (`sb_secret_…`) или legacy service_role |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel + `.env.local` | для push | публичный VAPID-ключ |
| `VAPID_PRIVATE_KEY` | **секреты Supabase** | для push | приватный VAPID-ключ |
| `VAPID_SUBJECT` | секреты Supabase | для push | `mailto:you@mail.com` |
| `CRON_SECRET` | Vercel (🔒 Sensitive) | для Vercel Cron | защита роута `/api/cron/*` |
| `NEXT_PUBLIC_SITE_URL` | Vercel + `.env.local` | рекомендуется | боевой адрес |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ❌ | legacy-замена `SUPABASE_SECRET_KEY`, код поддерживает обе |

**Получить ref и URL:**
```bash
supabase projects list
# или из адресной строки дашборда: /project/<ref>/
```

---

## Приложение B. Все команды одним блоком

```bash
# ---------- 0. Локальная разработка ----------
cd habitverse/app
npm install
cp .env.example .env.local      # заполнить 3 обязательные переменные
npm run dev                     # http://localhost:3000
npm run typecheck               # 0 ошибок
npm run build                   # проверка продакшн-сборки

# ---------- 1. Git ----------
cd habitverse
git init && git add . && git commit -m "HabitVerse"
git branch -M main
git remote add origin https://github.com/<логин>/habitverse.git
git push -u origin main

# ---------- 2. SQL (если есть psql) ----------
export PGPASSWORD='пароль-БД'
PSQL="psql postgresql://postgres.<ref>:<пароль>@aws-0-<region>.pooler.supabase.com:5432/postgres"
for f in supabase/0{1,2,3,4,5}_*.sql; do echo "--- $f"; $PSQL -v ON_ERROR_STOP=1 -f "$f"; done

# ---------- 3. Supabase CLI: push + секреты ----------
npm install -g supabase
supabase login
supabase link --project-ref <ref>
supabase secrets set VAPID_PRIVATE_KEY="..." VAPID_PUBLIC_KEY="..." VAPID_SUBJECT="mailto:you@mail.com"
cd habitverse/app
supabase functions deploy send-reminders --no-verify-jwt

# ---------- 4. Проверка Edge Function ----------
curl -X POST "https://<ref>.supabase.co/functions/v1/send-reminders" \
  -H "apikey: sb_secret_..." -H "Authorization: Bearer sb_secret_..." \
  -H "Content-Type: application/json" -d '{"mode":"reminders"}'

# ---------- 5. Обновление после правок ----------
git add . && git commit -m "fix" && git push     # Vercel пересоберёт сам
```

---

## Приложение C. Лимиты бесплатных планов

**Supabase Free:** 500 МБ БД · 1 ГБ хранилища · 50 000 MAU · 2 проекта (неактивные паузятся через 7 дней) ·
~3–4 письма в час через встроенный SMTP · 500 000 вызовов Edge Functions.

> ⚠️ **Проект на Free паузится, если к нему не обращались 7 дней.** Зайдите в дашборд и нажмите **Restore**,
> либо подключите платный план. Для постоянно работающего трекера это главный практический риск бесплатного плана.

**Vercel Hobby:** 100 ГБ трафика · бессерверные функции · **cron только раз в сутки** · только некоммерческое использование.

**Чего хватает бесплатно:** личный трекер + 5–20 друзей, тысячи отметок, аватары, push — да.
**За что придётся заплатить:** частый cron на Vercel (→ используйте pg_cron бесплатно), свой SMTP для массовой рассылки, коммерческое использование.

---

## Что делать после подключения

1. **Пригласите друзей** — `/social` → 👥 Друзья → поиск по имени. Без друзей лента и лидерборд пустые, а это половина смысла HabitLink-механик.
2. **Начните с 3–5 привычек**, а не с 15. Статистика показывает: чем меньше привычек, тем выше процент выполнения.
3. **Поставьте PWA на телефон** — иконка на рабочем столе + push делают трекер настоящим приложением.
4. **Подключите свой SMTP** (Resend бесплатно даёт 3000 писем в месяц), если планируете звать людей: Settings → Auth → SMTP.
5. **Сделайте бэкап:** Settings → Database → Backups. На Free плане автоматических бэкапов нет — периодически выгружайте данные через `/stats` → ⬇ CSV или SQL-дамп.

---

*Инструкция написана 6 октября 2026 под версии: Next.js 16.3.8, React 19.2, Supabase JS 2.117, Vercel CLI/платформа актуальная на эту дату, Supabase CLI 1.60+.*
*Пункты меню Supabase и Vercel иногда переименовываются — если чего-то нет на месте, ищите по названию раздела в поиске дашборда (`Ctrl/Cmd + K`).*
