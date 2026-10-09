'use client';

/* ============================================================
   Модалка привычки (фаза 5.2): создание и редактирование.
   Поля — как в модалке v2-демо: имя, эмодзи, категория, цвет,
   описание, расписание (5 типов), старт, недельная квота,
   заморозки, цель/единица, напоминание, тип «не делать».
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { Modal } from '@/components/modal';
import { hv, useHv } from '@/lib/store';
import {
  CATEGORIES, COLORS, EMOJIS, EMOJI_GROUP, WD, D, catOf,
  type Freq, type FreqType, type Habit,
} from '@/lib/engine';
import { toast } from '@/lib/ui';

const FREQ_TYPES: Array<[FreqType, string]> = [
  ['daily', 'Каждый день'],
  ['weekdays', 'По дням недели'],
  ['interval', 'Интервал (каждые N дней)'],
  ['weekly', 'Раз в неделю'],
  ['monthly', 'По числам месяца'],
];

interface Draft {
  name: string; emoji: string; desc: string; cat: string; color: string;
  freq: Freq; start: string; weekGoal: number; freezes: number;
  target: number; unit: string; reminder: string; neg: boolean;
}

function toDraft(h: Habit | null): Draft {
  if (h) {
    return {
      name: h.name, emoji: h.emoji, desc: h.desc || '', cat: h.cat, color: h.color,
      freq: { ...h.freq }, start: h.start || D.today(), weekGoal: h.weekGoal || 0, freezes: h.freezes ?? 2,
      target: h.target || 1, unit: h.unit || '', reminder: h.reminder || '', neg: !!h.neg,
    };
  }
  return {
    name: '', emoji: '✨', desc: '', cat: 'health', color: COLORS[0],
    freq: { type: 'daily' }, start: D.today(), weekGoal: 0, freezes: 2,
    target: 1, unit: '', reminder: '', neg: false,
  };
}

const fieldStyle: React.CSSProperties = { marginBottom: 14 };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6 };

export function HabitModal({ editId, onClose }: { editId: string | null; onClose: () => void }) {
  const { state } = useHv();
  const editing = editId ? state.habits.find((h) => h.id === editId) || null : null;
  const [d, setD] = useState<Draft>(() => toDraft(editing));
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setD(toDraft(editing)); }, [editId]);
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 40); }, []);

  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));
  const patchFreq = (p: Partial<Freq>) => setD((prev) => ({ ...prev, freq: { ...prev.freq, ...p } }));

  const setFreqType = (t: FreqType) => {
    const base: Freq = { type: t };
    if (t === 'weekdays') base.days = d.freq.days && d.freq.days.length ? d.freq.days : [0, 1, 2, 3, 4];
    if (t === 'interval') base.every = d.freq.every || 2;
    if (t === 'weekly') base.day = d.freq.day ?? 0;
    if (t === 'monthly') base.days = d.freq.type === 'monthly' ? d.freq.days : [1];
    patch({ freq: base });
  };

  const toggleDay = (i: number) => {
    const cur = d.freq.days || [];
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b);
    patchFreq({ days: next.length ? next : [i] });
  };

  const save = () => {
    const name = d.name.trim();
    if (!name) { toast('Введите название', 'warn'); nameRef.current?.focus(); return; }
    const data = {
      name: name.slice(0, 60), emoji: d.emoji.trim() || '✨', desc: d.desc.trim(), cat: d.cat, color: d.color,
      freq: d.freq, start: d.start || D.today(),
      weekGoal: Math.max(0, Math.min(7, d.weekGoal | 0)),
      freezes: Math.max(0, Math.min(5, d.freezes | 0)),
      target: Math.max(1, d.target | 0 || 1), unit: d.unit.trim(),
      reminder: d.reminder, notif: !!d.reminder, neg: d.neg,
    };
    if (editing) { hv.updateHabitById(editing.id, data); toast('Привычка обновлена', 'ok'); }
    else { hv.addHabit(data); toast('Привычка добавлена', 'ok'); }
    onClose();
  };

  const emojiSuggestions = EMOJIS[EMOJI_GROUP[d.cat] || 'Дисциплина'] || [];

  return (
    <Modal
      title={editing ? 'Редактировать привычку' : 'Новая привычка'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} /> Сохранить</button>
      </>}
    >
      <div style={fieldStyle}>
        <label className="label" style={labelStyle} htmlFor="hmName">Название</label>
        <input id="hmName" ref={nameRef} className="input" style={{ width: '100%' }} maxLength={60}
          placeholder="Например: Утренняя пробежка" value={d.name}
          onChange={(e) => patch({ name: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
      </div>

      <div style={{ ...fieldStyle, display: 'flex', gap: 10 }}>
        <div style={{ width: 92, flex: 'none' }}>
          <label className="label" style={labelStyle} htmlFor="hmEmoji">Иконка</label>
          <input id="hmEmoji" className="input" style={{ width: '100%', textAlign: 'center', fontSize: 18 }} maxLength={4}
            value={d.emoji} onChange={(e) => patch({ emoji: e.target.value })} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="label" style={labelStyle}>Варианты для категории «{catOf(d.cat).name}»</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {emojiSuggestions.slice(0, 12).map((em) => (
              <button key={em} className="btn btn-sm btn-quiet" style={{ fontSize: 15 }} title={`Иконка ${em}`}
                onClick={() => patch({ emoji: em })}>{em}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={fieldStyle}>
        <span className="label" style={labelStyle}>Категория</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map((c) => (
            <button key={c.id}
              className={`chip ${d.cat === c.id ? 'on' : ''}`}
              style={d.cat === c.id ? { borderColor: c.color, color: c.color } : undefined}
              onClick={() => patch({ cat: c.id })}>
              <Icon name={c.icon} size={13} /> {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={fieldStyle}>
        <span className="label" style={labelStyle}>Цвет</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COLORS.map((c, i) => (
            <button key={i} aria-label={`Цвет ${c}`} title={c}
              onClick={() => patch({ color: c })}
              style={{
                width: 22, height: 22, borderRadius: 7, background: c, cursor: 'pointer',
                border: d.color === c ? '2px solid var(--text)' : '2px solid transparent',
                boxShadow: d.color === c ? '0 0 0 2px var(--surface) inset' : 'none',
              }} />
          ))}
        </div>
      </div>

      <div style={fieldStyle}>
        <label className="label" style={labelStyle} htmlFor="hmDesc">Описание <span style={{ textTransform: 'none', fontWeight: 400 }}>(необязательно)</span></label>
        <input id="hmDesc" className="input" style={{ width: '100%' }} maxLength={120}
          placeholder="Короткая подсказка: что именно делать" value={d.desc}
          onChange={(e) => patch({ desc: e.target.value })} />
      </div>

      <div style={fieldStyle}>
        <label className="label" style={labelStyle} htmlFor="hmFreq">Расписание</label>
        <select id="hmFreq" className="select" style={{ width: '100%' }} value={d.freq.type}
          onChange={(e) => setFreqType(e.target.value as FreqType)}>
          {FREQ_TYPES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>

        {d.freq.type === 'weekdays' ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {WD.map((w, i) => (
              <button key={i} className={`chip ${(d.freq.days || []).includes(i) ? 'on' : ''}`} onClick={() => toggleDay(i)}>{w}</button>
            ))}
          </div>
        ) : null}
        {d.freq.type === 'interval' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span className="small muted">Каждые</span>
            <input className="input" type="number" min={2} max={30} style={{ width: 74 }} value={d.freq.every || 2}
              onChange={(e) => patchFreq({ every: Math.max(2, Math.min(30, e.target.valueAsNumber || 2)) })} />
            <span className="small muted">дн.</span>
          </div>
        ) : null}
        {d.freq.type === 'weekly' ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {WD.map((w, i) => (
              <button key={i} className={`chip ${(d.freq.day ?? 0) % 7 === i ? 'on' : ''}`} onClick={() => patchFreq({ day: i })}>{w}</button>
            ))}
          </div>
        ) : null}
        {d.freq.type === 'monthly' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span className="small muted">Числа месяца через запятую:</span>
            <input className="input" style={{ width: 140 }} value={(d.freq.days || [1]).join(', ')}
              onChange={(e) => {
                const days = e.target.value.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= 31);
                patchFreq({ days: days.length ? days : [1] });
              }} />
          </div>
        ) : null}
      </div>

      <div style={{ ...fieldStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <div>
          <label className="label" style={labelStyle} htmlFor="hmStart">Дата старта</label>
          <input id="hmStart" className="input" type="date" style={{ width: '100%' }} value={d.start}
            onChange={(e) => patch({ start: e.target.value || D.today() })} />
        </div>
        <div>
          <label className="label" style={labelStyle} htmlFor="hmWeekGoal">Квота в неделю</label>
          <input id="hmWeekGoal" className="input" type="number" min={0} max={7} style={{ width: '100%' }} value={d.weekGoal}
            onChange={(e) => patch({ weekGoal: e.target.valueAsNumber || 0 })} />
          <div className="hint">0 — без квоты; иначе «M из N» и стрик неделями</div>
        </div>
        <div>
          <label className="label" style={labelStyle} htmlFor="hmFreeze">Заморозки / мес</label>
          <input id="hmFreeze" className="input" type="number" min={0} max={5} style={{ width: '100%' }} value={d.freezes}
            onChange={(e) => patch({ freezes: e.target.valueAsNumber || 0 })} />
          <div className="hint">Спасают стрик в проваленные дни</div>
        </div>
        <div>
          <label className="label" style={labelStyle} htmlFor="hmReminder">Напоминание</label>
          <input id="hmReminder" className="input" type="time" style={{ width: '100%' }} value={d.reminder}
            onChange={(e) => patch({ reminder: e.target.value })} />
          <div className="hint">Push — с фазой 5.4 (Supabase)</div>
        </div>
      </div>

      <div style={{ ...fieldStyle, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ width: 96 }}>
          <label className="label" style={labelStyle} htmlFor="hmTarget">Цель</label>
          <input id="hmTarget" className="input" type="number" min={1} max={999} style={{ width: '100%' }} value={d.target}
            onChange={(e) => patch({ target: e.target.valueAsNumber || 1 })} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label" style={labelStyle} htmlFor="hmUnit">Единица <span style={{ textTransform: 'none', fontWeight: 400 }}>(страниц, минут…)</span></label>
          <input id="hmUnit" className="input" style={{ width: '100%' }} maxLength={24} value={d.unit}
            onChange={(e) => patch({ unit: e.target.value })} />
        </div>
        <button className={`chip ${d.neg ? 'on' : ''}`} style={{ height: 34 }}
          title="Отметка означает «сдержался»"
          onClick={() => patch({ neg: !d.neg })}>
          <Icon name="shield" size={13} /> привычка «не делать»
        </button>
      </div>
    </Modal>
  );
}
