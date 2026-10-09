'use client';

/* Каркас HabitVerse web: шапка + сайдбар + контент. Перенесён из v2/app.js (фаза 5.1). */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { CmdK } from '@/components/cmdk';
import { Catalog } from '@/components/catalog';
import { NotesWidget } from '@/components/notes-widget';
import { Onboarding } from '@/components/onboarding';
import { Toaster } from '@/components/toaster';
import { useHv } from '@/lib/store';
import { todayCounts } from '@/lib/engine';
import {
  APP_VERSION, SECTIONS, THEME_LIST, hueFor, initialsOf, loadUi, saveUi, toast,
  type UiPrefs,
} from '@/lib/ui';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, ready } = useHv();
  const leftToday = ready ? todayCounts(state).left : 0;
  const userName = ready && state.profile.name ? state.profile.name : 'Гость';
  const [ui, setUi] = useState<UiPrefs | null>(null);
  const [cmdk, setCmdk] = useState(false);
  const [themeMenu, setThemeMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const themeBtn = useRef<HTMLButtonElement>(null);
  const menuHost = useRef<HTMLDivElement>(null);

  /* восстановление настроек + применение темы к <html> */
  useEffect(() => {
    const p = loadUi();
    setUi(p);
  }, []);
  useEffect(() => {
    if (!ui) return;
    const root = document.documentElement;
    root.dataset.theme = ui.theme;
    root.dataset.mode = ui.mode;
    root.dataset.density = ui.density;
    saveUi(ui);
  }, [ui]);

  /* закрытие меню темы кликом вне */
  useEffect(() => {
    if (!themeMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (themeBtn.current?.contains(t) || menuHost.current?.contains(t)) return;
      setThemeMenu(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [themeMenu]);

  /* каталог привычек: открывается из сайдбара, страниц и ⌘K (событие hv:open-catalog) */
  useEffect(() => {
    const onOpen = () => setCatalogOpen(true);
    window.addEventListener('hv:open-catalog', onOpen);
    return () => window.removeEventListener('hv:open-catalog', onOpen);
  }, []);

  /* ⌘K / Ctrl+K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk((v) => !v); }
      if (e.key === 'Escape') setCmdk(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const patch = (p: Partial<UiPrefs>) => setUi((prev) => (prev ? { ...prev, ...p } : prev));
  const active = SECTIONS.find((s) => (s.href === '/' ? pathname === '/' : pathname.startsWith(s.href)))?.id || 'today';
  const accent = THEME_LIST.find(([id]) => id === (ui?.theme || 'snow')) || THEME_LIST[0];

  const sideLink = (s: (typeof SECTIONS)[number]) => (
    <Link
      key={s.id}
      href={s.href}
      className={`side-link ${active === s.id ? 'active' : ''}`}
      onClick={() => setMobileOpen(false)}
    >
      <span className="ic"><Icon name={s.icon} size={15} /></span>
      <span className="tx">{s.name}</span>
      {s.id === 'today' && leftToday > 0 ? <span className="ct num">{leftToday}</span> : null}
    </Link>
  );

  return (
    <>
      <div className="shell">
        <header className="header">
          <button
            className="icon-btn only-mobile"
            aria-label="Меню"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <Icon name="dash" size={16} />
          </button>

          <Link className="brand" href="/" title="HabitVerse">
            <span className="brand-mark"><Icon name="check" size={14} /></span>
            <span className="brand-name">HabitVerse</span>
          </Link>

          <nav className="nav" aria-label="Разделы">
            {SECTIONS.filter((s) => s.id !== 'settings').map((s) => (
              <Link key={s.id} className={`nav-item ${active === s.id ? 'active' : ''}`} href={s.href}>
                {s.name}
                {s.id === 'today' && leftToday > 0 ? <span className="nav-badge">{leftToday}</span> : null}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <button className="search-trigger" title="Поиск и команды" onClick={() => setCmdk(true)}>
              <Icon name="search" size={15} />
              <span className="placeholder">Поиск или команда…</span>
              <span className="kbd">⌘K</span>
            </button>
            <button
              ref={themeBtn}
              className="icon-btn"
              title="Тема и оформление"
              onClick={() => setThemeMenu((v) => !v)}
            >
              <Icon name="theme" size={16} />
            </button>
            <button
              className="icon-btn"
              title="Напоминания (фаза 5.4)"
              onClick={() => toast('Напоминания приедут вместе с Supabase — фаза 5.4', 'info')}
            >
              <Icon name="bell" size={16} />
            </button>
            <Link className="avatar-btn" href="/settings" title="Профиль и настройки">
              <span
                className="avatar"
                style={{ background: `${hueFor(userName)}22`, color: hueFor(userName), width: 24, height: 24, fontSize: 11 }}
              >
                {initialsOf(userName)}
              </span>
            </Link>
          </div>
        </header>

        <div className={`body ${ui?.sideCollapsed ? 'collapsed' : ''}`}>
          <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Навигация">
            <div className="side-section">
              <div className="side-title">
                <span>Рабочее пространство</span>
                <button
                  className="side-toggle"
                  title={ui?.sideCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
                  onClick={() => patch({ sideCollapsed: !ui?.sideCollapsed })}
                >
                  <Icon name={ui?.sideCollapsed ? 'chevR' : 'chevL'} size={13} />
                </button>
              </div>
              {SECTIONS.map(sideLink)}
            </div>

            <div className="side-section">
              <div className="side-title"><span>Быстрые действия</span></div>
              <button className="side-link" onClick={() => { setMobileOpen(false); router.push('/habits?new=1'); }}>
                <span className="ic"><Icon name="plus" size={15} /></span><span className="tx">Новая привычка</span>
              </button>
              <button className="side-link" onClick={() => { setMobileOpen(false); setCatalogOpen(true); }}>
                <span className="ic"><Icon name="book" size={15} /></span><span className="tx">Каталог</span>
              </button>
              <button className="side-link" onClick={() => { setMobileOpen(false); router.push('/notes'); }}>
                <span className="ic"><Icon name="note" size={15} /></span><span className="tx">Заметки</span>
              </button>
              <button className="side-link" onClick={() => setCmdk(true)}>
                <span className="ic"><Icon name="search" size={15} /></span><span className="tx">Команды</span>
                <span className="ct kbd-hint">⌘K</span>
              </button>
            </div>

            <div className="side-foot">
              <span className="avatar" style={{ background: `${hueFor(userName)}22`, color: hueFor(userName), width: 26, height: 26, fontSize: 11 }}>
                {initialsOf(userName)}
              </span>
              <div className="side-foot-tx">
                <b>{userName}</b>
                <span>v{APP_VERSION} · Next.js</span>
              </div>
            </div>
          </aside>

          <main className="main">{children}</main>
        </div>
      </div>

      {/* меню темы */}
      {themeMenu && ui && (
        <div className="menu" ref={menuHost} style={{ position: 'fixed', top: 52, right: 16 }}>
          <div className="label small muted">Режим</div>
          <button onClick={() => patch({ mode: ui.mode === 'dark' ? 'light' : 'dark' })}>
            <Icon name="theme" size={14} />
            <span>{ui.mode === 'dark' ? 'Светлый режим' : 'Тёмный режим'}</span>
          </button>
          <hr />
          <div className="label small muted">Акцент</div>
          <div className="swatches" style={{ padding: '4px 8px 8px' }}>
            {THEME_LIST.map(([id, name, col]) => (
              <button
                key={id}
                className={`sw ${ui.theme === id ? 'on' : ''}`}
                style={{ background: col }}
                title={name}
                aria-label={`Акцент: ${name}`}
                onClick={() => patch({ theme: id })}
              />
            ))}
          </div>
        </div>
      )}

      {catalogOpen ? <Catalog onClose={() => setCatalogOpen(false)} /> : null}
      <NotesWidget />
      {/* первый визит: полноэкранный мастер (ready — только клиент, гидратация без mismatch) */}
      {ready && !state.profile.onboarded ? <Onboarding /> : null}

      <CmdK open={cmdk} onClose={() => setCmdk(false)} onPatch={patch} ui={ui} accentName={accent[1]} />
      <Toaster />
    </>
  );
}
