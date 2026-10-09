import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Обработчик кода подтверждения (e-mail confirm / OAuth / magic link / reset password) */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDesc = searchParams.get('error_description');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorDesc ?? 'Не удалось завершить вход')}`);
}
