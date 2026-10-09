'use client';

/* ============================================================
   Шит «день × привычка» (фаза 5.3) — порт dayHabitSheet из v2.
   Количество (target > 1), заметка ко дню, статусы done/skip/miss/сброс.
   Семантика демо: ввод заметки без отметки создаёт статус «done».
   ============================================================ */
import { useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Icon } from '@/components/icon';
import { hv, useHv } from '@/lib/store';
import { D, dueOn, freqLabel, logAt, type Habit } from '@/lib/engine';
import { toast } from '@/lib/ui';

const STATUS_BTNS: Array<[string, string, string]> = [
  ['done', 'check', 'Выполнено'],
  ['skip', 'minus', 'Пропуск'],
  ['miss', 'x', 'Провал'],
];

export function DayHabitSheet({ h, dayKey, onClose }: { h: Habit; dayKey: string; onClose: () => void }) {
  const { state } = useHv();
  const l = logAt(state, h.id, dayKey);
  const [note, setNote] = useState((l && l.note) || '');
  const [val, setVal] = useState<string>(String((l && l.val) || 0));

  const patchDetails = (n: string, v: string): void => {
    hv.patchLog(h.id, dayKey, { note: n, ...(h.target > 1 ? { val: Number(v) || 0 } : {}) });
  };

  const setStatus = (st: string | null): void => {
    if (st) {
      if (D.isFuture(dayKey)) { toast('Отметить будущее нельзя', 'info'); return; }
      hv.applyStatus(h.id, dayKey, st as 'done' | 'skip' | 'miss');
      patchDetails(note, val);
      toast(st === 'done' ? 'Отмечено' : st === 'skip' ? 'Осознанный пропуск' : 'Записан провал', 'ok');
    } else {
      hv.applyStatus(h.id, dayKey, null);
    }
    onClose();
  };

  return (
    <Sheet onClose={onClose} label={`${h.name} — ${D.full(dayKey)}`}>
      <div className="modal-h">
        <span className="sheet-ic" style={{ background: `color-mix(in oklab, ${h.color} 14%, var(--surface))`, color: h.color }} aria-hidden="true">{h.emoji}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 17 }}>{h.name}</h2>
          <p className="small muted">{D.full(dayKey)}{dueOn(h, dayKey) ? '' : ' · не запланировано'} · {freqLabel(h)}</p>
        </div>
        <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть">
          <Icon name="x" size={15} />
        </button>
      </div>

      {h.target > 1 ? (
        <label className="fld">
          <span>Количество ({h.unit || 'шт'})</span>
          <input
            className="input" type="number" min={0} step={1} value={val}
            onChange={(e) => { setVal(e.target.value); patchDetails(note, e.target.value); }}
          />
        </label>
      ) : null}

      <label className="fld">
        <span>Заметка ко дню</span>
        <textarea
          className="textarea" placeholder="Как прошло? Что мешало?" value={note}
          onChange={(e) => { setNote(e.target.value); patchDetails(e.target.value, val); }}
        />
      </label>

      <div className="row wrap" style={{ gap: 8 }}>
        {STATUS_BTNS.map(([st, ic, label]) => (
          <button key={st} className={`btn ${l?.status === st ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setStatus(st)}>
            <Icon name={ic} size={14} /> {label}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => setStatus(null)}>Сбросить</button>
      </div>

      <div className="divider" />
      <p className="xs faint">Отметки за прошлые даты влияют на стрик и статистику. Будущее отмечать нельзя — день ещё не наступил.</p>
    </Sheet>
  );
}
