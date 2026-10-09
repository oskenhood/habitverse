'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button, Field, Input } from '@/components/ui/primitives';
import { Background } from '@/components/app-shell';

type Mode = 'login' | 'register' | 'forgot';

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const titles: Record<Mode, [string, string]> = {
    login: ['С возвращением', 'Войди, чтобы продолжить стрик'],
    register: ['Создать аккаунт', 'Первая привычка — через 30 секунд'],
    forgot: ['Восстановить пароль', 'Пришлём ссылку на e-mail'],
  };
  const [title, sub] = titles[mode];

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const next = params.get('next') || '/dashboard';
      const redirectBase = typeof window !== 'undefined' ? window.location.origin : '';

      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split('@')[0], emoji: '🙂' },
            emailRedirectTo: `${redirectBase}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success('Проверь почту — нужно подтвердить e-mail');
          return;
        }
        toast.success('Аккаунт создан');
        router.push('/dashboard?onboarding=1');
        router.refresh();
        return;
      }

      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirectBase}/auth/callback?next=/profile`,
        });
        if (error) throw error;
        setSent(true);
        toast.success('Ссылка для сброса отправлена');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success('С возвращением!');
      router.push(next);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      const ru = /invalid login credentials/i.test(msg)
        ? 'Неверный e-mail или пароль'
        : /already registered/i.test(msg)
          ? 'Такой e-mail уже зарегистрирован'
          : /password.*6/i.test(msg)
            ? 'Пароль должен быть не короче 6 символов'
            : msg;
      toast.error(ru);
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: 'google' | 'github') {
    setLoading(true);
    const redirectBase = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${redirectBase}/auth/callback?next=/dashboard` },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  }

  async function magicLink() {
    if (!email.includes('@')) return toast.error('Введи e-mail');
    setLoading(true);
    const redirectBase = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${redirectBase}/auth/callback?next=/dashboard` },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success('Ссылка для входа отправлена на почту');
  }

  return (
    <div className="min-h-dvh relative grid place-items-center px-5 py-10">
      <Background />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[430px] glass rounded-[28px] p-8 border-[var(--stroke2)] shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)]"
      >
        <Link href="/" className="inline-flex items-center gap-2.5 mb-7 group">
          <span className="w-10 h-10 rounded-[13px] grid place-items-center text-lg text-white bg-[linear-gradient(140deg,var(--acc),var(--acc3))] shadow-[0_8px_22px_-8px_var(--acc)] group-hover:rotate-6 transition-transform">◈</span>
          <b className="text-[17px] tracking-[-.03em]">HabitVerse</b>
        </Link>

        <h1 className="text-[26px] font-extrabold tracking-[-.035em]">{title}</h1>
        <p className="text-[var(--muted)] text-sm mt-1.5 mb-7">{sub}</p>

        {sent && mode !== 'login' ? (
          <div className="text-center py-6">
            <span className="text-5xl block mb-4 hv-bob">📬</span>
            <b className="block text-base mb-2">Письмо отправлено</b>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
              Проверь <b>{email}</b> и перейди по ссылке из письма.
            </p>
            <Button className="w-full" onClick={() => setSent(false)}>← Назад</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-1">
            {mode === 'register' && (
              <Field label="Как тебя звать?">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" maxLength={40} autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" autoComplete="email" />
            </Field>
            {mode !== 'forgot' && (
              <Field label="Пароль" hint={mode === 'register' ? 'Минимум 6 символов' : undefined}>
                <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </Field>
            )}

            <Button type="submit" variant="primary" disabled={loading} className="w-full mt-2 hv-shimmer">
              {loading ? 'Подожди…' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Создать аккаунт' : 'Отправить ссылку'}
            </Button>
          </form>
        )}

        {mode !== 'forgot' && !sent && (
          <>
            <div className="flex items-center gap-3 my-6">
              <span className="flex-1 h-px bg-[var(--stroke)]" />
              <span className="text-[11px] uppercase tracking-[.1em] text-[var(--faint)]">или</span>
              <span className="flex-1 h-px bg-[var(--stroke)]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button disabled={loading} onClick={() => oauth('google')}>Google</Button>
              <Button disabled={loading} onClick={() => oauth('github')}>GitHub</Button>
              <Button disabled={loading} onClick={magicLink}>🔗 Ссылка</Button>
            </div>
          </>
        )}

        <div className="mt-7 pt-5 border-t border-[var(--stroke)] text-[13px] text-[var(--muted)] flex flex-wrap gap-x-2 gap-y-1 justify-center">
          {mode === 'login' && (
            <>
              <Link href="/register" className="text-[var(--acc2)] font-semibold hover:underline">Создать аккаунт</Link>
              <span>·</span>
              <Link href="/forgot" className="hover:underline">Забыли пароль?</Link>
            </>
          )}
          {mode === 'register' && (
            <>
              <span>Уже есть аккаунт?</span>
              <Link href="/login" className="text-[var(--acc2)] font-semibold hover:underline">Войти</Link>
            </>
          )}
          {mode === 'forgot' && <Link href="/login" className="text-[var(--acc2)] font-semibold hover:underline">← Вернуться ко входу</Link>}
        </div>
      </motion.div>
    </div>
  );
}
