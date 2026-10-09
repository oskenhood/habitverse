'use client';

/* ============================================================
   Модалка заметки (фаза 5.3) — порт noteModal из v2.
   Заголовок, текст с md2-разметкой, теги, цвет фона, привязка
   к привычке, закрепление. Блочный редактор — этап 3 (BACKLOG).
   ============================================================ */
import { useState } from 'react';
import { Modal } from '@/components/modal';
import { ConfirmDialog } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { hv, useHv } from '@/lib/store';
import { NOTE_COLORS, visibleHabits } from '@/lib/engine';
import { toast } from '@/lib/ui';

export function NoteModal({
  editId, preset, onClose,
}: {
  editId?: string | null;
  preset?: { title?: string; body?: string; habitId?: string | null };
  onClose: () => void;
}) {
  const { state } = useHv();
  const n = editId ? state.notes.find((x) => x.id === editId) : null;
  const [title, setTitle] = useState(n?.title || preset?.title || '');
  const [body, setBody] = useState(n?.body || preset?.body || '');
  const [tags, setTags] = useState((n?.tags || []).join(', '));
  const [color, setColor] = useState(n?.color || '');
  const [pinned, setPinned] = useState(!!n?.pinned);
  const [habitId, setHabitId] = useState<string>(n?.habitId || preset?.habitId || '');
  const [confirmDel, setConfirmDel] = useState(false);

  const save = (): void => {
    hv.saveNoteById({
      title: title.trim().slice(0, 90),
      body,
      tags: tags.split(',').map((x) => x.trim()).filter(Boolean),
      color,
      pinned,
      habitId: habitId || null,
    }, editId || null);
    toast('Заметка сохранена', 'ok');
    onClose();
  };

  return (
    <>
      <Modal
        title={editId ? 'Заметка' : 'Новая заметка'}
        onClose={onClose}
        footer={<>
          {editId ? <button className="btn btn-danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={14} /> Удалить</button> : null}
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} /> Сохранить</button>
        </>}
      >
        <label className="fld">
          <span>Заголовок</span>
          <input className="input" maxLength={90} value={title} placeholder="Например: Почему я сорвался в пятницу"
            onChange={(e) => setTitle(e.target.value)} autoFocus={!editId} />
        </label>
        <label className="fld">
          <span>Текст</span>
          <textarea className="textarea" style={{ minHeight: 190 }} value={body}
            placeholder={'## Мысль\n- пункт\n**важное**'}
            onChange={(e) => setBody(e.target.value)} />
          <div className="hint">Поддержка: # заголовок, **жирный**, *курсив*, - список, `код`, [[2026-10-06]] — дата.</div>
        </label>
        <label className="fld">
          <span>Теги (через запятую)</span>
          <input className="input" value={tags} placeholder="инсайт, неделя, здоровье"
            onChange={(e) => setTags(e.target.value)} />
        </label>
        <div className="grid g2">
          <label className="fld">
            <span>Цвет фона</span>
            <div className="swatches">
              {NOTE_COLORS.map((c) => (
                <button type="button" key={c || 'none'} className={`sw ${color === c ? 'on' : ''}`}
                  style={{ background: c || 'var(--bg-sunken)', border: '1px solid var(--border)' }}
                  title={c ? 'Оттенок' : 'Без цвета'} aria-label={c ? 'Цвет фона' : 'Без цвета'}
                  onClick={() => setColor(c)} />
              ))}
            </div>
          </label>
          <label className="fld">
            <span>Привязать к привычке</span>
            <select className="select" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
              <option value="">—</option>
              {visibleHabits(state).map((h) => (
                <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="setting-row">
          <div className="txt"><b>Закрепить сверху</b><span>Важные заметки всегда первые</span></div>
          <button className={`toggle ${pinned ? 'on' : ''}`} role="switch" aria-checked={pinned}
            aria-label="Закрепить сверху" onClick={() => setPinned((v) => !v)} />
        </div>
      </Modal>

      {confirmDel && editId ? (
        <ConfirmDialog
          title="Удалить заметку?"
          text="Действие необратимо."
          onClose={() => setConfirmDel(false)}
          onConfirm={() => { hv.removeNoteById(editId); toast('Заметка удалена', 'warn'); onClose(); }}
        />
      ) : null}
    </>
  );
}
