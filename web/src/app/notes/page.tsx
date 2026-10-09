'use client';

/* ============================================================
   Заметки (фаза 5.3) — порт renderNotes из v2/app.js.
   Сетка карточек с md2-разметкой, поиск, фильтры по тегам,
   закрепление, удаление с подтверждением. Блочный редактор
   Notion-типа — этап 3 (BACKLOG); md2 останется фолбэком.
   ?new=1 — сразу открыть редактор (⌘K, виджет F-3), ?open=<id> — заметку.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { NoteModal } from '@/components/note-modal';
import { ConfirmDialog } from '@/components/confirm';
import { hv, useHv } from '@/lib/store';
import { D, sortedNotes } from '@/lib/engine';
import { md2 } from '@/lib/md';
import { toast } from '@/lib/ui';

function notesWord(n: number): string {
  if (n === 1) return 'запись';
  if (n > 1 && n < 5) return 'записи';
  return 'записей';
}

export default function NotesPage() {
  const { state, ready } = useHv();
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('all');
  const [modal, setModal] = useState<{ editId: string | null } | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  /* ?new=1 / ?open=<id> — из ⌘K и виджета заметок (F-3) */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('new') === '1') setModal({ editId: null });
    const open = p.get('open');
    if (open) setModal({ editId: open });
  }, []);

  const tags = useMemo(() => [...new Set(state.notes.flatMap((n) => n.tags || []))], [state]);

  const list = useMemo(() => {
    let l = sortedNotes(state);
    if (tag !== 'all') l = l.filter((n) => (n.tags || []).includes(tag));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter((n) => `${n.title} ${n.body} ${(n.tags || []).join(' ')}`.toLowerCase().includes(q));
    }
    return l;
  }, [state, tag, search]);

  const delNote = state.notes.find((n) => n.id === delId) || null;

  return (
    <>
      <PageHead
        title="Заметки"
        sub={ready ? `${state.notes.length} ${notesWord(state.notes.length)} · разметка: # заголовок, **жирный**, - список, [[дата]]` : 'Загрузка…'}
        crumbs={[{ name: 'Заметки' }]}
        actions={
          <button className="btn btn-primary" onClick={() => setModal({ editId: null })} disabled={!ready}>
            <Icon name="plus" size={14} /> Заметка
          </button>
        }
      />

      <section className="page active">
        {!ready ? (
          <div className="empty card"><span className="em"><Icon name="note" size={30} /></span><h3>Загружаем данные…</h3></div>
        ) : (
          <>
            <div className="toolbar">
              <button className="btn btn-primary" onClick={() => setModal({ editId: null })}>
                <Icon name="plus" size={14} /> Заметка
              </button>
              <div className="toolbar-search">
                <Icon name="search" size={14} />
                <input placeholder="Поиск по заметкам…" value={search} aria-label="Поиск по заметкам"
                  onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="chips">
                <button className={`chip ${tag === 'all' ? 'on' : ''}`} onClick={() => setTag('all')}>Все</button>
                {tags.map((tg) => (
                  <button key={tg} className={`chip ${tag === tg ? 'on' : ''}`} onClick={() => setTag(tg)}>#{tg}</button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <span className="count">{list.length} {notesWord(list.length)}</span>
            </div>

            {list.length ? (
              <div className="notes-grid">
                {list.map((n, i) => {
                  const habit = n.habitId ? state.habits.find((h) => h.id === n.habitId) : null;
                  return (
                    <article
                      key={n.id}
                      className={`note-card ${n.pinned ? 'pinned' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 12) * 20}ms`, ...(n.color ? { ['--nc' as string]: n.color } : {}) }}
                      onClick={() => setModal({ editId: n.id })}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') setModal({ editId: n.id }); }}
                    >
                      <header>
                        <h4>{n.title || 'Без названия'}</h4>
                        <div className="nc-acts">
                          <button
                            className={n.pinned ? 'on' : ''}
                            title={n.pinned ? 'Открепить' : 'Закрепить'}
                            aria-label={n.pinned ? 'Открепить' : 'Закрепить'}
                            onClick={(e) => { e.stopPropagation(); hv.toggleNotePinById(n.id); }}
                          >
                            <Icon name="pin" size={13} />
                          </button>
                          <button
                            title="Удалить" aria-label="Удалить заметку"
                            onClick={(e) => { e.stopPropagation(); setDelId(n.id); }}
                          >
                            <Icon name="trash" size={13} />
                          </button>
                        </div>
                      </header>
                      <div className="md" dangerouslySetInnerHTML={{ __html: md2(n.body.slice(0, 700)) }} />
                      <footer>
                        <span className="when">{D.ago(n.updated)}</span>
                        {(n.tags || []).map((tg) => <span className="tag" key={tg}>#{tg}</span>)}
                        {habit ? (
                          <span className="tag habit-tag" style={{
                            color: `color-mix(in oklab, ${habit.color} 74%, var(--text-2))`,
                            borderColor: `color-mix(in oklab, ${habit.color} 26%, var(--border))`,
                          }}>
                            <span aria-hidden="true">{habit.emoji}</span> {habit.name}
                          </span>
                        ) : null}
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty card-flat">
                <span className="em"><Icon name="note" size={30} /></span>
                <h3>{search || tag !== 'all' ? 'Ничего не нашлось' : 'Заметок пока нет'}</h3>
                <p>
                  {search || tag !== 'all'
                    ? 'Попробуйте другой запрос или сбросьте фильтр.'
                    : 'Фиксируйте инсайты, причины срывов и победы. Разметка: # заголовок, **жирный**, список через «-», код в обратных кавычках, [[дата]].'}
                </p>
                {search || tag !== 'all' ? (
                  <button className="btn" onClick={() => { setSearch(''); setTag('all'); }}>Сбросить фильтры</button>
                ) : (
                  <button className="btn btn-primary" onClick={() => setModal({ editId: null })}>
                    <Icon name="plus" size={14} /> Первая заметка
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {modal ? <NoteModal editId={modal.editId} onClose={() => setModal(null)} /> : null}
      {delId && delNote ? (
        <ConfirmDialog
          title="Удалить заметку?"
          text={`«${delNote.title || 'Без названия'}» будет удалена безвозвратно.`}
          onClose={() => setDelId(null)}
          onConfirm={() => { hv.removeNoteById(delId); toast('Заметка удалена', 'warn'); }}
        />
      ) : null}
    </>
  );
}
