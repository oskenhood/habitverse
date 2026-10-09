/**
 * Импорт данных из автономного демо (HabitVerse-demo.html) в Supabase.
 *
 *   Демо → Кабинет → «⬇ Экспорт JSON»  →  habitverse-2026-10-06.json
 *
 * Запуск (из папки app/):
 *   npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com
 *   npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --user  <uuid>     # если знаете id
 *   npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com --dry   # только отчёт
 *   npx tsx scripts/import-demo.ts ... --with-notes --with-challenges
 *
 * Переменные окружения (или .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SECRET_KEY        (sb_secret_…)  либо SUPABASE_SERVICE_ROLE_KEY (legacy eyJ…)
 *
 * Скрипт идемпотентен в пределах запуска: если привычка с таким именем уже есть —
 * она пропускается (флаг --force создаст дубликат).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/*
 * supabase-js при инициализации создаёт RealtimeClient, которому нужен WebSocket.
 * В Node 22+ он встроенный; в Node 20 — нет. Подставляем полифилл `ws`,
 * чтобы скрипт работал на обеих версиях (сам realtime здесь не используется).
 */
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ws = require('ws') as unknown;
  (globalThis as { WebSocket?: unknown }).WebSocket = ws;
}

/* ----------------------------- типы демо ----------------------------- */

interface DemoFreq { type: string; days?: number[]; every?: number; day?: number }
interface DemoHabit {
  id: string; name: string; emoji: string; color: string; desc?: string; cat?: string;
  freq?: DemoFreq; start?: string; target?: number; unit?: string;
  reminder?: string; notif?: boolean; difficulty?: number; archived?: boolean; neg?: boolean; freezes?: number;
}
interface DemoLog { status: 'done' | 'skip' | 'miss'; val?: number | null; note?: string; frozen?: boolean }
interface DemoNote { title?: string; body?: string; tags?: string[]; color?: string; pinned?: boolean; habitId?: string | null }
interface DemoState {
  profile?: { name?: string; emoji?: string; bio?: string; birth?: string; theme?: string; accent?: number };
  habits?: DemoHabit[];
  logs?: Record<string, Record<string, DemoLog>>;
  notes?: DemoNote[];
  challenges?: unknown[];
}

/* --------------------------- маппинг полей --------------------------- */

const NEG_HINTS = ['без ', 'не ', '🚫', 'отказ', 'бросить'];
const looksNegative = (h: DemoHabit) => h.neg === true || NEG_HINTS.some((t) => h.name.toLowerCase().includes(t) || h.emoji === '🚫');

function mapHabit(h: DemoHabit) {
  const f = h.freq ?? { type: 'daily' };
  const freq_type = ['daily', 'weekdays', 'interval', 'weekly', 'monthly'].includes(f.type) ? f.type : 'daily';
  const freq_days =
    freq_type === 'weekdays' ? (f.days ?? [0, 1, 2, 3, 4])
    : freq_type === 'monthly' ? (f.days ?? [1])
    : freq_type === 'weekly' ? [f.day ?? f.days?.[0] ?? 0]
    : [];

  return {
    name: h.name.slice(0, 60),
    emoji: (h.emoji || '✨').slice(0, 8),
    color: h.color || '#7c5cff',
    description: (h.desc ?? '').slice(0, 500),
    category: h.cat || 'health',
    freq_type,
    freq_days,
    freq_every: Math.max(1, f.every ?? 1),
    start_date: h.start || new Date().toISOString().slice(0, 10),
    target_count: Math.max(1, h.target ?? 1),
    target_unit: (h.unit ?? '').slice(0, 14),
    reminder_time: h.reminder ? `${h.reminder.length === 5 ? h.reminder : h.reminder.slice(0, 5)}:00` : null,
    reminder_on: h.notif !== false && !!h.reminder,
    reminder_days: 'schedule',
    difficulty: Math.min(5, Math.max(1, h.difficulty ?? 1)),
    archived: !!h.archived,
    position: 0,
    is_negative: looksNegative(h),
    freezes: Math.min(31, Math.max(0, h.freezes ?? 2)),
  };
}

/* ------------------------------- CLI ------------------------------- */

const args = process.argv.slice(2);
const get = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const has = (k: string) => args.includes(k);

const file = args.find((a) => !a.startsWith('--'));
const DRY = has('--dry');
const FORCE = has('--force');
const WITH_NOTES = has('--with-notes');
const WITH_CHALLENGES = has('--with-challenges');

function die(msg: string): never { console.error(`\n✖ ${msg}\n`); process.exit(1); }
function log(...a: unknown[]) { console.log(...a); }

async function main() {
  if (!file) die('Укажите путь к JSON-экспорту демо.\n  Пример: npx tsx scripts/import-demo.ts ../habitverse-2026-10-06.json --email you@mail.com');
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) die(`Файл не найден: ${path}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) die('Не задана NEXT_PUBLIC_SUPABASE_URL');
  if (!key) die('Не задан SUPABASE_SECRET_KEY (или legacy SUPABASE_SERVICE_ROLE_KEY)');

  let state: DemoState;
  try { state = JSON.parse(readFileSync(path, 'utf8')) as DemoState; }
  catch (e) { die(`Не удалось разобрать JSON: ${(e as Error).message}`); }

  const db: SupabaseClient = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'x-application-name': 'habitverse-import' } },
  });

  /* --- определяем пользователя --- */
  const email = get('--email');
  const userId = get('--user');
  let uid = userId;

  if (!uid) {
    if (!email) die('Нужно указать --email you@mail.com или --user <uuid>');
    const { data, error } = await db.auth.admin.listUsers();
    if (error) die(`Не удалось получить список пользователей: ${error.message}`);
    const u = data?.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (!u) die(`Пользователь ${email} не найден. Зарегистрируйтесь в приложении и повторите.`);
    uid = u.id;
    log(`👤 Найден пользователь: ${email} → ${uid}`);
  }

  if (!DRY) {
    const { data: profile } = await db.from('profiles').select('id').eq('id', uid).maybeSingle();
    if (!profile) die(`Профиль ${uid} не найден — выполните supabase/01…06 и зарегистрируйтесь в приложении`);
  } else {
    log('   (dry run: профиль в БД не проверяется)');
  }

  /* --- существующие привычки (идемпотентность) --- */
  const { data: existing } = await db.from('habits').select('id, name').eq('user_id', uid);
  const existingNames = new Set((existing ?? []).map((h) => h.name));

  const habits = state.habits ?? [];
  const toCreate = habits.filter((h) => FORCE || !existingNames.has(h.name));
  const skipped = habits.length - toCreate.length;

  log(`\n📦 В файле: привычек ${habits.length}, заметок ${(state.notes ?? []).length}`);
  log(`   к созданию: ${toCreate.length}${skipped ? `, пропускаем (уже есть): ${skipped}` : ''}`);

  if (DRY) {
    log('\n— DRY RUN: ничего не записываем —\n');
    toCreate.forEach((h, i) => {
      const m = mapHabit(h);
      const logs = state.logs?.[h.id] ?? {};
      const done = Object.values(logs).filter((l) => l.status === 'done').length;
      log(`  ${String(i + 1).padStart(2)}. ${h.emoji} ${h.name}`);
      log(`      ${m.freq_type}${m.freq_days.length ? ` [${m.freq_days}]` : ''}${m.freq_every > 1 ? ` каждые ${m.freq_every}` : ''} · с ${m.start_date}`);
      log(`      ${m.is_negative ? '🚫 НЕ делать' : '✅ делать'} · 🧊 заморозок ${m.freezes} · напоминание ${m.reminder_time ?? '—'}`);
      log(`      отметок: ${Object.keys(logs).length} (выполнено ${done})`);
    });
    if (WITH_NOTES) log(`\n  заметок к переносу: ${(state.notes ?? []).length}`);
    log('\nСнимите --dry, чтобы записать.');
    return;
  }

  /* --- создаём привычки --- */
  const idMap = new Map<string, string>();     // demo id → db id
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 1) {
    const h = toCreate[i];
    const row = { ...mapHabit(h), user_id: uid, position: i };
    const { data, error } = await db.from('habits').insert(row as never).select('id').single();
    if (error) { log(`  ✖ ${h.name}: ${error.message}`); continue; }
    idMap.set(h.id, (data as { id: string }).id);
    created += 1;
  }
  log(`\n✅ Привычек создано: ${created}`);

  // привычки, которые уже существовали, — сопоставляем по имени для переноса логов
  for (const h of habits) {
    if (idMap.has(h.id)) continue;
    const found = (existing ?? []).find((x) => x.name === h.name);
    if (found) idMap.set(h.id, found.id);
  }

  /* --- переносим отметки --- */
  const today = new Date().toISOString().slice(0, 10);
  const logRows: Record<string, unknown>[] = [];
  let frozenCount = 0;
  for (const h of habits) {
    const dbId = idMap.get(h.id);
    if (!dbId) continue;
    for (const [date, l] of Object.entries(state.logs?.[h.id] ?? {})) {
      if (date > today) continue;
      if (!['done', 'skip', 'miss'].includes(l.status)) continue;
      if (l.frozen) frozenCount += 1;
      logRows.push({
        habit_id: dbId, user_id: uid, log_date: date,
        status: l.status, value: typeof l.val === 'number' ? l.val : null,
        note: (l.note ?? '').slice(0, 2000),
      });
    }
  }

  let logsInserted = 0;
  for (let i = 0; i < logRows.length; i += 500) {
    const chunk = logRows.slice(i, i + 500);
    const { error } = await db.from('habit_logs').upsert(chunk as never, { onConflict: 'habit_id,log_date' });
    if (error) log(`  ✖ пачка отметок ${i}…${i + chunk.length}: ${error.message}`);
    else logsInserted += chunk.length;
  }
  log(`✅ Отметок перенесено: ${logsInserted}${frozenCount ? ` (из них спасено заморозкой: ${frozenCount} — поле frozen переносится вручную, см. README)` : ''}`);

  /* --- заметки --- */
  if (WITH_NOTES && (state.notes ?? []).length) {
    const rows = (state.notes ?? []).map((n) => ({
      user_id: uid,
      title: (n.title ?? '').slice(0, 200),
      body: n.body ?? '',
      color: n.color ?? '',
      tags: n.tags ?? [],
      pinned: !!n.pinned,
      habit_id: n.habitId && idMap.has(n.habitId) ? idMap.get(n.habitId) : null,
    }));
    const { error } = await db.from('notes').insert(rows as never);
    log(error ? `✖ Заметки: ${error.message}` : `✅ Заметок перенесено: ${rows.length}`);
  } else if ((state.notes ?? []).length) {
    log(`ℹ️  Заметок в файле ${(state.notes ?? []).length} — добавьте флаг --with-notes, чтобы перенести`);
  }

  /* --- челленджи --- */
  if (WITH_CHALLENGES) {
    const ch = (state.challenges ?? []) as { name?: string; emoji?: string; color?: string; desc?: string; start?: string; days?: number; habitId?: string }[];
    let n = 0;
    for (const c of ch) {
      if (!c.name) continue;
      const start = c.start || today;
      const end = new Date(new Date(start).getTime() + ((c.days ?? 30) - 1) * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await db.from('challenges').insert({
        creator_id: uid, name: c.name.slice(0, 80), description: c.desc ?? '',
        emoji: c.emoji ?? '🔥', color: c.color ?? '#ff5c8a',
        start_date: start, end_date: end < start ? start : end,
        habit_id: c.habitId && idMap.has(c.habitId) ? idMap.get(c.habitId) : null,
      } as never).select('id').single();
      if (error) { log(`  ✖ челлендж «${c.name}»: ${error.message}`); continue; }
      await db.from('challenge_members').insert({ challenge_id: (data as { id: string }).id, user_id: uid } as never);
      n += 1;
    }
    if (n) log(`✅ Челленджей перенесено: ${n}`);
  }

  /* --- профиль --- */
  const p = state.profile;
  if (p && (p.name || p.bio || p.birth)) {
    const patch: Record<string, unknown> = {};
    if (p.name) patch.display_name = String(p.name).slice(0, 40);
    if (p.emoji) patch.emoji = String(p.emoji).slice(0, 8);
    if (p.bio) patch.bio = String(p.bio).slice(0, 240);
    if (p.birth) patch.birth_date = p.birth;
    if (p.theme) patch.theme = p.theme;
    if (typeof p.accent === 'number') patch.accent = p.accent;
    const { error } = await db.from('profiles').update(patch as never).eq('id', uid);
    log(error ? `✖ Профиль: ${error.message}` : '✅ Профиль обновлён');
  }

  /* --- XP и ачивки --- */
  const { error: xpErr } = await db.rpc('award_xp', { p_user: uid, p_amount: 20, p_reason: 'import' } as never);
  if (!xpErr) await db.rpc('unlock_achievement', { p_user: uid, p_achievement: 'h1' } as never);

  log('\n🎉 Готово. Откройте /dashboard и проверьте данные.');
  log('   Если что-то пошло не так — повторный запуск безопасен: уже существующие привычки пропускаются.');
}

main().catch((e) => die(e instanceof Error ? e.stack ?? e.message : String(e)));
