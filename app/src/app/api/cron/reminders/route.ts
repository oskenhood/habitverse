import { NextResponse } from 'next/server';

/**
 * Vercel Cron → вызывает Supabase Edge Function `send-reminders`.
 * Расписание задаётся в vercel.json.
 *
 * ⚠️ План Vercel Hobby поддерживает только ежедневный cron.
 *    Для 15-минутного шага используйте pg_cron внутри Supabase
 *    (он уже настроен в supabase/03_functions.sql) — тогда этот
 *    роут можно удалить, а vercel.json оставить без crons.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);

  // защита: Vercel передаёт этот заголовок автоматически
  const auth = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const mode = url.searchParams.get('mode') ?? 'reminders';
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Новая схема: SUPABASE_SECRET_KEY (sb_secret_...). Legacy: SUPABASE_SERVICE_ROLE_KEY (eyJ...).
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !serviceKey) {
    return NextResponse.json(
      { error: 'Не заданы NEXT_PUBLIC_SUPABASE_URL и/или SUPABASE_SECRET_KEY (или SUPABASE_SERVICE_ROLE_KEY)' },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${base}/functions/v1/send-reminders`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ mode, status: res.status, data, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ mode, error: e instanceof Error ? e.message : 'unknown' }, { status: 502 });
  }
}
