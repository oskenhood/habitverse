'use client';

/* ============================================================
   F-3: плавающий виджет заметок (отзыв Максима, 2026-10-08).
   Иконка следует за пользователем на всех страницах; при наведении
   выпадают актуальные заметки (закреплённые + свежие); клик ведёт
   в раздел /opens конкретную заметку. На тач-устройствах — тап
   по иконке фиксирует панель. Живёт в Shell (фаза 5.3).
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { useHv } from '@/lib/store';
import { D, sortedNotes } from '@/lib/engine';

const OPEN_DELAY = 120;   // мс — открытие при наведении
const CLOSE_DELAY = 260;  // мс — запас, чтобы дотянуть курсор до панели
const MAX_ITEMS = 6;

export function NotesWidget() {
  const { state, ready } = useHv();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);   // зафиксирован тапом (тач-режим)
  const openT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { clearTimeout(openT.current); clearTimeout(closeT.current); }, []);

  const hover = (): void => {
    clearTimeout(closeT.current);
    openT.current = setTimeout(() => setOpen(true), OPEN_DELAY);
  };
  const leave = (): void => {
    clearTimeout(openT.current);
    closeT.current = setTimeout(() => { if (!pinned) setOpen(false); }, CLOSE_DELAY);
  };

  const notes = ready ? sortedNotes(state).slice(0, MAX_ITEMS) : [];
  const total = ready ? state.notes.length : 0;

  const go = (href: string): void => {
    setOpen(false); setPinned(false);
    router.push(href);
  };

  return (
    <div
      className={`notes-widget ${open ? 'open' : ''}`}
      onMouseEnter={hover}
      onMouseLeave={leave}
      data-testid="notes-widget"
    >
      <div className="nw-pop" role={open ? 'dialog' : 'presentation'} aria-label="Актуальные заметки" aria-hidden={!open}>
        <div className="nw-head">
          <b>Заметки</b>
          <span className="tag">{total}</span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm btn-quiet" onClick={() => go('/notes')}>Все</button>
        </div>
        {notes.length ? (
          <div className="nw-list">
            {notes.map((n) => (
              <button key={n.id} className="nw-item" onClick={() => go(`/notes?open=${n.id}`)}>
                <span className="nw-t">
                  {n.pinned ? <Icon name="pin" size={11} /> : null}
                  {n.title || 'Без названия'}
                </span>
                <span className="nw-x">{n.body.replace(/[#*>`[\]-]/g, '').slice(0, 84) || 'Пусто'}</span>
                <span className="nw-meta">
                  {D.ago(n.updated)}
                  {(n.tags || []).slice(0, 2).map((t) => <span className="tag" key={t}>#{t}</span>)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="nw-empty">
            <p className="small muted">Заметок пока нет. Фиксируйте инсайты и причины срывов — они останутся под рукой на любой странице.</p>
          </div>
        )}
        <div className="nw-foot">
          <button className="btn btn-sm btn-primary" onClick={() => go('/notes?new=1')}>
            <Icon name="plus" size={13} /> Заметка
          </button>
        </div>
      </div>

      <button
        className="nw-btn"
        aria-label="Заметки"
        title="Заметки"
        onClick={() => {
          clearTimeout(openT.current); clearTimeout(closeT.current);
          if (open && pinned) { setPinned(false); setOpen(false); }
          else { setPinned(true); setOpen(true); }
        }}
      >
        <Icon name="note" size={18} />
        {total > 0 ? <span className="nw-ct num">{total}</span> : null}
      </button>
    </div>
  );
}
