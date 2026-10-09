// HabitVerse · Supabase Edge Function — Web Push напоминания
// Деплой:  supabase functions deploy send-reminders --no-verify-jwt
// Секреты: supabase secrets set VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@mail.com
// Запуск:  pg_cron каждые 15 минут (см. 03_functions.sql) либо Vercel Cron.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

interface ReminderRow {
  id: string;
  name: string;
  emoji: string;
  description: string;
  reminder_time: string;
  reminder_days: 'schedule' | 'everyday';
  freq_type: string;
  freq_days: number[];
  freq_every: number;
  start_date: string;
  end_date: string | null;
  user_id: string;
  timezone: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 0 = понедельник … 6 = воскресенье (совпадает с D.dow на клиенте) */
const isoDow0 = (d: Date) => (d.getUTCDay() + 6) % 7;

function dueOnDate(h: ReminderRow, now: Date): boolean {
  const start = h.start_date;
  const key = now.toISOString().slice(0, 10);
  if (start && key < start) return false;
  if (h.end_date && key > h.end_date) return false;

  switch (h.freq_type) {
    case 'daily':
      return true;
    case 'weekdays': {
      const days = h.freq_days?.length ? h.freq_days : [0, 1, 2, 3, 4];
      return days.includes(isoDow0(now));
    }
    case 'interval': {
      const n = Math.max(1, h.freq_every || 1);
      const diff = Math.round((now.getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000);
      return diff % n === 0;
    }
    case 'weekly':
      return isoDow0(now) === ((h.freq_days?.[0] ?? 0) % 7);
    case 'monthly':
      return (h.freq_days?.length ? h.freq_days : [1]).includes(now.getUTCDate());
    default:
      return true;
  }
}
/** @deprecated оставлено для совместимости с вызовами из digest-блока */
const dueNow = (h: ReminderRow, now: Date) => dueOnDate(h, now);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = new URL(req.url);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? url.origin;
  // Supabase автоматически инжектит SUPABASE_SECRET_KEY (sb_secret_...) в Edge Functions.
  // SUPABASE_SERVICE_ROLE_KEY оставлен как fallback для старых проектов (legacy JWT-ключ).
  const serviceKey = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Нет секретного ключа: задайте SUPABASE_SECRET_KEY (или legacy SUPABASE_SERVICE_ROLE_KEY) через `supabase secrets set`' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@habitverse.app';
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  }

  let body: { mode?: string } = {};
  try { body = await req.json(); } catch { /* cron может слать пустое тело */ }
  const mode = body.mode ?? 'reminders';

  const now = new Date();
  const utcHHMM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

  /**
   * Локальное «часы:минуты» и локальная дата для указанного часового пояса.
   * Раньше сравнение шло по UTC — напоминания приходили со сдвигом.
   */
  const inZone = (tz: string) => {
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      const parts = fmt.formatToParts(now).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
      return {
        hhmm: `${parts.hour}:${parts.minute}`,
        date: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour),
        // 0 = понедельник … 6 = воскресенье
        dow0: (() => { const d = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`); return (d.getUTCDay() + 6) % 7; })(),
        day: Number(parts.day),
      };
    } catch {
      return { hhmm: utcHHMM, date: now.toISOString().slice(0, 10), hour: now.getUTCHours(), dow0: isoDow0(now), day: now.getUTCDate() };
    }
  };

  /* ---------------- режим: ежедневная сводка ---------------- */
  if (mode === 'digest') {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, display_name, digest_time, timezone')
      .eq('notif_enabled', true);

    let sent = 0;
    for (const prof of profiles ?? []) {
      const digest = (prof.digest_time ?? '20:00').slice(0, 5);
      const local = inZone(prof.timezone || 'UTC');
      if (digest !== local.hhmm) continue;

      const { data: habits } = await admin
        .from('habits')
        .select('id, name, emoji, start_date, end_date, freq_type, freq_days, freq_every, archived')
        .eq('user_id', prof.id)
        .eq('archived', false);

      const today = now.toISOString().slice(0, 10);
      const due = (habits ?? []).filter((h) => dueNow(h as unknown as ReminderRow, now));
      if (!due.length) continue;

      const { data: logs } = await admin
        .from('habit_logs')
        .select('habit_id, status')
        .eq('user_id', prof.id)
        .eq('log_date', today);
      const doneIds = new Set((logs ?? []).filter((l) => l.status === 'done').map((l) => l.habit_id));
      const left = due.filter((h) => !doneIds.has(h.id));

      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', prof.id);
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: left.length ? '📋 Итоги дня' : '🏆 Идеальный день!',
              body: left.length
                ? `Осталось ${left.length} из ${due.length}: ${left.slice(0, 4).map((h) => h.emoji).join(' ')}`
                : 'Все привычки выполнены. Так держать!',
              url: '/dashboard',
              tag: `digest-${today}`,
            }),
          );
          sent += 1;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      }
    }
    return new Response(JSON.stringify({ mode, sent, at: now.toISOString() }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  /* ---------------- режим: напоминания по времени ---------------- */
  const { data: habits } = await admin
    .from('habits')
    .select('id, name, emoji, description, reminder_time, reminder_on, reminder_days, freq_type, freq_days, freq_every, start_date, end_date, user_id, archived')
    .eq('reminder_on', true)
    .eq('archived', false)
    .not('reminder_time', 'is', null);

  // Часовой пояс берём из подписки устройства (там же хранится tz пользователя)
  const dueFor = (h: ReminderRow, tz: string) => {
    const local = inZone(tz || 'UTC');
    const time = (h.reminder_time ?? '').slice(0, 5);
    if (time !== local.hhmm) return false;
    if (h.reminder_days === 'everyday') return true;
    // расписание проверяем по локальной дате пользователя
    const asLocal = new Date(`${local.date}T12:00:00Z`);
    return dueOnDate(h, asLocal);
  };

  const userIds = [...new Set((habits ?? []).map((h: ReminderRow) => h.user_id))];
  const { data: subs } = userIds.length
    ? await admin.from('push_subscriptions').select('*').in('user_id', userIds)
    : { data: [] };

  const { data: logs } = userIds.length
    ? await admin
        .from('habit_logs')
        .select('habit_id, user_id, log_date, status')
        .in('user_id', userIds)
    : { data: [] };

  let sent = 0;
  let skipped = 0;
  for (const sub of subs ?? []) {
    const local = inZone(sub.timezone || 'UTC');
    const mine = (habits ?? []).filter((h: ReminderRow) =>
      h.user_id === sub.user_id &&
      dueFor(h, sub.timezone || 'UTC') &&
      !(logs ?? []).some((l: { user_id: string; habit_id: string; log_date: string; status: string }) =>
        l.user_id === sub.user_id && l.habit_id === h.id && l.log_date === local.date && l.status === 'done'),
    ) as ReminderRow[];
    if (!mine.length) { skipped += 1; continue; }

    const single = mine.length === 1;
    const payload = JSON.stringify({
      title: single ? `${mine[0].emoji} ${mine[0].name}` : `🔔 Осталось ${mine.length} привычек`,
      body: single
        ? mine[0].description || 'Пора отмечать — стрик ждёт 🔥'
        : mine.slice(0, 4).map((h) => `${h.emoji} ${h.name}`).join(' · '),
      url: '/dashboard',
      tag: `hv-${now.toISOString().slice(0, 13)}`,
    });

    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent += 1;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
  }

  return new Response(
    JSON.stringify({ mode, hhmm: utcHHMM, candidates: (habits ?? []).length, sent, skipped, at: now.toISOString() }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  );
});
