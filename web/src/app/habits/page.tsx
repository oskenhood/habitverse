'use client';

/* ============================================================
   Привычки (фаза 5.2, DnD-сортировка — 5.3) — порт renderHabits из v2/app.js:
   чипы-фильтры со счётчиками, поиск, список строк, пустые состояния,
   перетаскивание за ручку (Pointer Events — мышь и палец, как bindTouchDnD
   в демо; живое перемещение строк, коммит при отпускании).
   Сортировка включена только на нефильтрованном списке (иначе порядок
   неоднозначен) — в остальных видах через меню «Выше/Ниже».
   Виды «таблица/доска» — этап 4 (см. BACKLOG).
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { HabitRow } from '@/components/habit-row';
import { HabitModal } from '@/components/habit-modal';
import { hv, useHv } from '@/lib/store';
import { D, catOf, dueOn, isDone, visibleHabits, type Habit } from '@/lib/engine';
import { openCatalog, toast } from '@/lib/ui';

type FilterId = 'active' | 'due' | 'left' | 'done' | 'arch' | 'all';
const FILTERS: Array<[FilterId, string]> = [
  ['active', 'Активные'], ['due', 'На сегодня'], ['left', 'Осталось'],
  ['done', 'Выполнено'], ['arch', 'Архив'], ['all', 'Все'],
];

const DRAG_THRESHOLD = 6;   // px — порог, чтобы не мешать скроллу на тач

export default function HabitsPage() {
  const { state, ready } = useHv();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>('active');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });

  /* DnD: dragId — кого тащим; order — локальный порядок строк во время перетаскивания */
  const [dragId, setDragId] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const dragRef = useRef<{ id: string; startY: number; active: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ?filter=left из Обзора («Только оставшиеся»), ?new=1 из ⌘K, ?focus=<id> из ⌘K */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const f = p.get('filter');
    if (f && FILTERS.some(([id]) => id === f)) setFilter(f as FilterId);
    if (p.get('new') === '1') setModal({ open: true, editId: null });
    const focus = p.get('focus');
    if (focus) {
      // строка появится после гидратации и ready — пробуем несколько раз, а не одним таймаутом
      let tries = 0;
      const tm = setInterval(() => {
        const el = document.querySelector(`[data-id="${CSS.escape(focus)}"]`) as HTMLElement | null;
        if (el) {
          clearInterval(tm);
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.style.boxShadow = '0 0 0 2px var(--acc)';
          setTimeout(() => { el.style.boxShadow = ''; }, 1400);
        } else if (++tries > 20) clearInterval(tm);
      }, 100);
    }
  }, []);

  /* событие из строки привычки: «Редактировать» */
  useEffect(() => {
    const onEdit = (e: Event) => setModal({ open: true, editId: String((e as CustomEvent).detail || '') });
    window.addEventListener('hv:edit-habit', onEdit);
    return () => window.removeEventListener('hv:edit-habit', onEdit);
  }, []);

  const t = D.today();
  const { list, counts } = useMemo(() => {
    const vis = visibleHabits(state);
    const counts: Record<FilterId, number> = {
      all: state.habits.length,
      active: vis.length,
      due: vis.filter((h) => dueOn(h, t)).length,
      left: vis.filter((h) => dueOn(h, t) && !isDone(state, h.id, t)).length,
      done: vis.filter((h) => dueOn(h, t) && isDone(state, h.id, t)).length,
      arch: state.habits.filter((h) => h.archived).length,
    };
    const base = filter === 'arch' ? state.habits.filter((h) => h.archived) : vis;
    let l = base.slice();
    if (filter === 'due') l = l.filter((h) => dueOn(h, t));
    if (filter === 'left') l = l.filter((h) => dueOn(h, t) && !isDone(state, h.id, t));
    if (filter === 'done') l = l.filter((h) => dueOn(h, t) && isDone(state, h.id, t));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter((h) => `${h.name} ${h.desc || ''} ${catOf(h.cat).name}`.toLowerCase().includes(q));
    }
    return { list: l, counts };
  }, [state, filter, search, t]);

  /* сортировка доступна только на полном видимом списке без поиска */
  const canSort = ready && !search.trim() && (filter === 'active' || filter === 'all');

  /* строки в порядке локального DnD-черновика (если идёт перетаскивание) */
  const shown: Habit[] = useMemo(() => {
    if (!order || !dragId) return list;
    const byId = new Map(list.map((h) => [h.id, h]));
    return order.map((id) => byId.get(id)).filter((h): h is Habit => !!h);
  }, [list, order, dragId]);

  const onHandleDown = (id: string) => (e: React.PointerEvent): void => {
    if (!canSort) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { id, startY: e.clientY, active: false };
    setDragId(id);
    setOrder(list.map((h) => h.id));
  };

  const onHandleMove = (e: React.PointerEvent): void => {
    const d = dragRef.current;
    if (!d || !listRef.current) return;
    if (!d.active) {
      if (Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
      d.active = true;
      document.body.classList.add('dragging-active');
    }
    e.preventDefault();
    const rows = [...listRef.current.querySelectorAll<HTMLElement>('[data-id]')];
    const cur = order ? [...order] : rows.map((r) => r.dataset.id as string);
    const from = cur.indexOf(d.id);
    if (from < 0) return;
    // ищем строку, под которой сейчас указатель
    let to = from;
    for (let i = 0; i < rows.length; i++) {
      const id = rows[i].dataset.id as string;
      if (id === d.id) continue;
      const r = rows[i].getBoundingClientRect();
      if (e.clientY > r.top && e.clientY < r.bottom) { to = cur.indexOf(id); break; }
    }
    if (to === from || to < 0) return;
    cur.splice(to, 0, cur.splice(from, 1)[0]);
    setOrder(cur);
  };

  const onHandleUp = (): void => {
    const d = dragRef.current;
    dragRef.current = null;
    document.body.classList.remove('dragging-active');
    if (d && d.active && order) {
      hv.setOrder(order);
      toast('Порядок сохранён', 'ok');
    }
    setDragId(null);
    setOrder(null);
  };

  return (
    <>
      <PageHead
        title="Привычки"
        sub={ready ? `${counts.active} активных · ${counts.due} на сегодня` : 'Загрузка…'}
        crumbs={[{ name: 'Привычки' }]}
        actions={<>
          {ready && state.habits.some((h) => h.cat === 'money' && !h.archived) ? (
            <button className="btn" title="Реестр трат — раздел «Финансы»" onClick={() => router.push('/finance')}>
              <Icon name="coin" size={14} /> Реестр трат
            </button>
          ) : null}
          <button className="btn" onClick={openCatalog}>
            <Icon name="book" size={14} /> Каталог
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ open: true, editId: null })}>
            <Icon name="plus" size={14} /> Новая привычка
          </button>
        </>}
      />

      <section className="page active">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {FILTERS.map(([id, name]) => (
            <button key={id} className={`chip ${filter === id ? 'on' : ''}`} onClick={() => setFilter(id)}>
              {name} <span className="num" style={{ opacity: 0.6 }}>{counts[id]}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', display: 'inline-flex', pointerEvents: 'none' }}>
              <Icon name="search" size={13} />
            </span>
            <input className="input" placeholder="Фильтр по названию…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 210, height: 30, paddingLeft: 28 }} aria-label="Поиск привычек" />
          </div>
        </div>

        {!ready ? (
          <div className="empty card"><span className="em"><Icon name="check" size={30} /></span><h3>Загружаем данные…</h3></div>
        ) : shown.length ? (
          <div className="stack" style={{ gap: 8 }} ref={listRef}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}>
            {shown.map((h, i) => (
              <HabitRow
                key={h.id}
                h={h}
                dayKey={t}
                index={i}
                drag={canSort ? {
                  enabled: true,
                  dragging: dragId === h.id,
                  // движение/отпускание ловим на уровне списка: события с ручки всплывают до него
                  onDown: onHandleDown(h.id),
                } : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="empty card">
            <span className="em"><Icon name="filter" size={30} /></span>
            <h3>{filter === 'arch' ? 'Архив пуст' : 'Ничего не найдено'}</h3>
            <p>
              {search
                ? 'Попробуйте другой запрос или сбросьте фильтр.'
                : filter === 'arch'
                  ? 'Сюда попадают привычки, скрытые из активного списка через меню «⋯ → В архив».'
                  : 'Добавьте первую привычку — или загрузите демо-данные, чтобы посмотреть на заполненный список.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {state.habits.length === 0 ? (
                <button className="btn" onClick={() => { hv.seed(); toast('Демо-данные загружены', 'ok'); }}>
                  <Icon name="download" size={14} /> Демо-данные
                </button>
              ) : null}
              <button className="btn" onClick={openCatalog}>
                <Icon name="book" size={14} /> Каталог
              </button>
              <button className="btn btn-primary" onClick={() => setModal({ open: true, editId: null })}>Новая привычка</button>
            </div>
          </div>
        )}

        {canSort && ready && shown.length > 1 ? (
          <p className="xs faint" style={{ marginTop: 10 }}>Порядок можно менять перетаскиванием за ручку <Icon name="grip" size={11} /> — работает и мышью, и пальцем.</p>
        ) : null}
      </section>

      {modal.open ? <HabitModal editId={modal.editId} onClose={() => setModal({ open: false, editId: null })} /> : null}
    </>
  );
}
