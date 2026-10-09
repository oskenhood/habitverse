'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cn, clamp } from '@/lib/utils';
import { COLORS, levelOf, THEMES } from '@/lib/constants';
import { updateProfile } from '@/lib/actions';
import type { Profile } from '@/types/database';

const NAV = [
  { href: '/dashboard', label: 'Сегодня', icon: '📅' },
  { href: '/calendar', label: 'Календарь', icon: '🗓️' },
  { href: '/stats', label: 'Отчёты', icon: '📊' },
  { href: '/notes', label: 'Заметки', icon: '📓' },
  { href: '/social', label: 'Челленджи', icon: '🔥' },
  { href: '/feed', label: 'Лента', icon: '🌊' },
  { href: '/profile', label: 'Кабинет', icon: '👤' },
];

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 12% 0%, var(--bg3) 0%, transparent 55%), radial-gradient(100% 80% at 100% 100%, var(--bg2) 0%, transparent 60%), var(--bg)',
        }}
      />
      <div className="bg-orb" style={{ width: '52vw', height: '52vw', left: '-14vw', top: '-16vw', background: 'var(--acc)' }} />
      <div className="bg-orb" style={{ width: '44vw', height: '44vw', right: '-10vw', top: '6vh', background: 'var(--acc2)', animationDelay: '-8s' }} />
      <div className="bg-orb" style={{ width: '38vw', height: '38vw', left: '34vw', bottom: '-18vw', background: 'var(--acc3)', animationDelay: '-16s' }} />
      <div className="bg-grid" />
    </div>
  );
}

export function Sidebar({
  profile,
  badges,
  open,
  onNavigate,
}: {
  profile: Profile | null;
  badges: { today?: number; notes?: number };
  open: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const lv = levelOf(profile?.xp ?? 0);
  const [themeIdx, setThemeIdx] = useState(() => Math.max(0, THEMES.findIndex((t) => t.id === (profile?.theme ?? 'midnight'))));

  const cycleTheme = async () => {
    const next = THEMES[(themeIdx + 1) % THEMES.length];
    setThemeIdx(THEMES.findIndex((t) => t.id === next.id));
    document.documentElement.dataset.theme = next.id;
    try {
      localStorage.setItem('hv.theme', JSON.stringify({ theme: next.id, density: profile?.density ?? 'cozy', acc: COLORS[profile?.accent ?? 0] }));
    } catch {}
    if (profile) await updateProfile({ theme: next.id as Profile['theme'] }).catch(() => undefined);
    toast.success(`Тема: ${next.name}`);
  };

  return (
    <>
      <AnimatePresence>
        {open && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onNavigate} />}
      </AnimatePresence>
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-dvh z-50 w-[272px] shrink-0 flex flex-col gap-4 p-5 glass-strong border-r border-[var(--stroke)] overflow-auto transition-transform duration-500',
          open ? 'translate-x-0' : '-translate-x-[105%] lg:translate-x-0',
        )}
      >
        <div className="flex items-center gap-3 px-1.5">
          <div className="w-[42px] h-[42px] rounded-[14px] grid place-items-center text-xl text-white bg-[linear-gradient(140deg,var(--acc),var(--acc3))] shadow-[0_8px_22px_-8px_var(--acc)] animate-[hv-bob_5s_var(--ease)_infinite]">
            ◈
          </div>
          <div className="flex flex-col leading-tight">
            <b className="text-[17px] tracking-[-.03em]">HabitVerse</b>
            <small className="text-[var(--muted)] text-[11px] uppercase tracking-[.12em]">уровень {lv.level}</small>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            const badge = n.href === '/dashboard' ? badges.today : n.href === '/notes' ? badges.notes : 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onNavigate}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-[11px] rounded-2xl font-semibold text-[14.5px] transition-all duration-300',
                  active ? 'text-[var(--text)] bg-[linear-gradient(100deg,color-mix(in_oklab,var(--acc)_18%,transparent),transparent_80%)]' : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)] hover:translate-x-[3px]',
                )}
              >
                {active && <motion.span layoutId="navActive" className="absolute left-0 top-[22%] bottom-[22%] w-[3px] rounded-full bg-[var(--acc)] shadow-[0_0_14px_var(--acc)]" />}
                <span className={cn('text-[17px] w-[22px] text-center transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6', !active && 'grayscale-[.4] group-hover:grayscale-0')}>{n.icon}</span>
                <span>{n.label}</span>
                {!!badge && (
                  <em className="ml-auto not-italic text-[11px] font-extrabold min-w-5 h-5 px-1.5 rounded-full grid place-items-center bg-[var(--acc)] text-white">{badge}</em>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--stroke)]">
          <div className="flex justify-between items-baseline text-xs text-[var(--muted)] uppercase tracking-[.1em]">
            <span>XP</span>
            <b className="text-lg text-[var(--text)] tracking-tight tabular">{profile?.xp ?? 0}</b>
          </div>
          <div className="h-[7px] rounded-full bg-[var(--stroke)] overflow-hidden my-2.5">
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--acc),var(--acc2))] shadow-[0_0_12px_var(--acc)]"
              initial={{ width: 0 }}
              animate={{ width: `${clamp((lv.into / lv.need) * 100, 0, 100)}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <small className="text-[var(--faint)] text-[11.5px]">до уровня {lv.level + 1}: {Math.max(0, lv.need - lv.into)} XP</small>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard?new=1" onClick={onNavigate} className="btn-primary flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-[11px] text-[13px] font-bold text-white bg-[linear-gradient(135deg,var(--acc),var(--acc3))] shadow-[0_10px_26px_-12px_var(--acc)] hover:-translate-y-0.5 transition-transform">
            ＋ Привычка
          </Link>
          <button onClick={cycleTheme} title="Сменить тему" className="w-10 h-10 rounded-[11px] bg-[var(--card)] border border-[var(--stroke)] hover:border-[var(--acc)] transition-colors text-[17px]">
            🎨
          </button>
        </div>
      </aside>
    </>
  );
}

export function Topbar({
  title,
  subtitle,
  profile,
  onMenu,
  right,
}: {
  title: string;
  subtitle?: string;
  profile: Profile | null;
  onMenu: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3.5 px-4 lg:px-7 py-4 border-b border-[var(--stroke)] glass-strong">
      <button onClick={onMenu} className="lg:hidden w-10 h-10 rounded-xl bg-[var(--card)] border border-[var(--stroke)] text-[17px]" aria-label="Меню">
        ☰
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-[13px] text-[var(--muted)] mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
      <Link href="/profile" className="w-10 h-10 rounded-full grid place-items-center text-[19px] overflow-hidden bg-[linear-gradient(140deg,var(--acc),var(--acc3))] border-2 border-[var(--stroke2)] hover:scale-105 hover:-rotate-3 transition-transform duration-300" title="Профиль">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : <span>{profile?.emoji || '🙂'}</span>}
      </Link>
    </header>
  );
}
