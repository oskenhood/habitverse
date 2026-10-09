'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D } from '@/lib/dates';
import { NOTE_COLORS } from '@/lib/constants';
import { deleteNote, saveNote } from '@/lib/actions';
import { Button, Card, Chip, Empty, Field, Input, Select, SettingRow, Textarea, Toggle } from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import type { Habit, Note } from '@/types/database';

/** Лёгкая markdown-разметка: # заголовок, **жирный**, *курсив*, `код`, - список, [[дата]] */
export function mdLite(src: string) {
  const safe = (src || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safe
    .replace(/^### (.*)$/gm, '<b class="block text-sm mt-1.5 mb-0.5">$1</b>')
    .replace(/^## (.*)$/gm, '<b class="block text-[15px] mt-2 mb-1">$1</b>')
    .replace(/^# (.*)$/gm, '<b class="block text-base mt-2 mb-1">$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    .replace(/`(.+?)`/g, '<code class="bg-[var(--stroke)] px-1.5 py-px rounded text-[.92em]">$1</code>')
    .replace(/^- (.*)$/gm, '<div class="pl-2.5">• $1</div>')
    .replace(/\[\[(\d{4}-\d{2}-\d{2})\]\]/g, '<span class="px-2 py-px rounded-full text-[11px] font-extrabold border border-[var(--stroke)] bg-[var(--card)]">$1</span>')
    .replace(/\n/g, '<br>');
}

export function NotesView({ notes: init, habits }: { notes: Note[]; habits: Habit[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState(init);
  const [tag, setTag] = useState('all');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Note | 'new' | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags ?? []))], [notes]);
  let list = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.updated_at) - +new Date(a.updated_at));
  if (tag !== 'all') list = list.filter((n) => (n.tags ?? []).includes(tag));
  if (q) list = list.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q.toLowerCase()));

  const reload = async () => { router.refresh(); };

  return (
    <div className="p-4 lg:p-7">
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <Button variant="primary" size="sm" onClick={() => setEdit('new')}>＋ Заметка</Button>
        <Chip active={tag === 'all'} onClick={() => setTag('all')}>Все</Chip>
        {tags.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(t)}>#{t}</Chip>)}
        <div className="flex-1" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по заметкам…" className="w-auto sm:w-[220px]" />
        <span className="text-[11.5px] text-[var(--faint)]">{list.length} записей</span>
      </div>

      {list.length ? (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          <AnimatePresence mode="popLayout">
            {list.map((n, i) => {
              const habit = n.habit_id ? habits.find((h) => h.id === n.habit_id) : null;
              return (
                <motion.article
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 16, rotate: -1 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.4, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -5, rotate: -0.7 }}
                  onClick={() => setEdit(n)}
                  className="relative min-h-[130px] flex flex-col p-4 rounded-[var(--r)] border border-[var(--stroke)] cursor-pointer overflow-hidden hover:border-[var(--stroke2)] hover:shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)] transition-colors"
                  style={{ background: n.color || 'var(--card)' }}
                >
                  <span className={cn('absolute right-3 top-3 text-sm transition-all', n.pinned ? 'opacity-100 rotate-[18deg] drop-shadow-[0_0_6px_var(--warn)]' : 'opacity-35')}>📌</span>
                  <h4 className="text-[14.5px] font-bold mb-1.5 pr-6">{n.title || 'Без названия'}</h4>
                  <div className="text-[12.8px] text-[var(--muted)] leading-relaxed flex-1 overflow-hidden [&>*]:inline" dangerouslySetInnerHTML={{ __html: mdLite(n.body.slice(0, 400)) }} />
                  <div className="flex gap-1.5 items-center mt-3 text-[10.5px] text-[var(--faint)] flex-wrap">
                    <span>{D.ago(n.updated_at)}</span>
                    {(n.tags ?? []).map((t) => <span key={t} className="px-1.5 py-px rounded-md bg-[var(--stroke)] font-bold">#{t}</span>)}
                    {habit && <span className="px-1.5 py-px rounded-md bg-[var(--stroke)] font-bold" style={{ color: habit.color }}>{habit.emoji} {habit.name}</span>}
                    <div className="flex-1" />
                    <button
                      onClick={(e) => { e.stopPropagation(); void saveNote({ ...n, pinned: !n.pinned }).then(() => { toast.success(n.pinned ? 'Откреплено' : 'Закреплено'); void reload(); }); }}
                      className="w-7 h-7 rounded-lg grid place-items-center hover:bg-[var(--stroke)] transition-colors"
                      title="Закрепить"
                    >📌</button>
                    <button onClick={(e) => { e.stopPropagation(); setDelId(n.id); }} className="w-7 h-7 rounded-lg grid place-items-center hover:bg-[color-mix(in_oklab,var(--bad)_20%,transparent)] transition-colors" title="Удалить">🗑️</button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <Empty
          icon="📓"
          title="Блокнот пуст"
          text="Записывай инсайты, причины срывов и победы. Поддерживается разметка: # заголовок, **жирный**, *курсив*, - список, `код`, [[2026-10-06]]."
          action={<Button variant="primary" onClick={() => setEdit('new')}>＋ Первая заметка</Button>}
        />
      )}

      <NoteModal
        note={edit === 'new' ? null : edit}
        habits={habits}
        open={!!edit}
        onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); void reload(); }}
      />
      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={async () => { if (delId) { await deleteNote(delId); toast.success('Заметка удалена'); void reload(); } }}
        title="Удалить заметку?"
        text="Действие необратимо."
      />
    </div>
  );
}

function NoteModal({ note, habits, open, onClose, onSaved }: { note: Note | null; habits: Habit[]; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState('');
  const [pinned, setPinned] = useState(false);
  const [habitId, setHabitId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useMemo(() => {
    if (!open) return;
    setTitle(note?.title ?? '');
    setBody(note?.body ?? '');
    setTags((note?.tags ?? []).join(', '));
    setColor(note?.color ?? '');
    setPinned(note?.pinned ?? false);
    setHabitId(note?.habit_id ?? '');
  }, [open, note]);

  const save = async () => {
    setBusy(true);
    try {
      await saveNote({
        id: note?.id,
        title: title.trim(),
        body,
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        color,
        pinned,
        habit_id: habitId || null,
      });
      toast.success(note ? 'Заметка обновлена' : 'Заметка создана · +4 XP');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note ? 'Заметка' : 'Новая заметка'}
      footer={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save} disabled={busy}>Сохранить</Button></>}
    >
      <Field label="Заголовок">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="Например: Почему я сорвался в пятницу" />
      </Field>
      <Field label="Текст" hint="Поддержка: # заголовок, **жирный**, *курсив*, - список, `код`, [[2026-10-06]] — дата">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[190px]" placeholder={'## Мысль\n- пункт\n**важное**'} />
      </Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Теги (через запятую)">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="инсайт, неделя, здоровье" />
        </Field>
        <Field label="Привязать к привычке">
          <Select value={habitId} onChange={(e) => setHabitId(e.target.value)}>
            <option value="">—</option>
            {habits.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Цвет фона">
        <div className="flex flex-wrap gap-2">
          {NOTE_COLORS.map((c) => (
            <button key={c || 'none'} type="button" onClick={() => setColor(c)} className={cn('w-[34px] h-[34px] rounded-[11px] border transition-transform hover:scale-110 hover:rotate-6', color === c && 'ring-2 ring-[var(--text)] scale-110')} style={{ background: c || 'var(--bg2)', borderColor: 'var(--stroke)' }} />
          ))}
        </div>
      </Field>
      <Card className="mt-2">
        <SettingRow title="Закрепить сверху" desc="Важные заметки всегда первые">
          <Toggle on={pinned} onChange={setPinned} label="Закрепить" />
        </SettingRow>
      </Card>
      {body && (
        <Card className="mt-3">
          <div className="text-[10.5px] text-[var(--faint)] uppercase tracking-[.08em] mb-2">Предпросмотр</div>
          <div className="text-[13px] text-[var(--muted)] leading-relaxed" dangerouslySetInnerHTML={{ __html: mdLite(body) }} />
        </Card>
      )}
    </Modal>
  );
}
