'use client';

/* ============================================================
   Челленджи (фаза 5.3) — порт challengeModal/joinByCode из v2.
   Демо-режим: код приглашения ищется только по локальным данным;
   реальные приглашения между пользователями приедут в фазе 5.4.
   ============================================================ */
import { useState } from 'react';
import { Modal } from '@/components/modal';
import { Icon } from '@/components/icon';
import { hv, useHv } from '@/lib/store';
import { COLORS, D, visibleHabits } from '@/lib/engine';
import { toast } from '@/lib/ui';

export function ChallengeModal({ onClose }: { onClose: () => void }) {
  const { state } = useHv();
  const habits = visibleHabits(state);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [emoji, setEmoji] = useState('🔥');
  const [color, setColor] = useState(COLORS[1]);
  const [habitId, setHabitId] = useState(habits[0]?.id || '');
  const [days, setDays] = useState(30);
  const [start, setStart] = useState(D.today());
  const [code, setCode] = useState('HV-' + Math.random().toString(36).slice(2, 6).toUpperCase());

  const save = (): void => {
    if (!name.trim()) { toast('Введите название челленджа', 'warn'); return; }
    const c = hv.createChallengeBy({ name: name.trim(), desc: desc.trim(), emoji: emoji.trim() || '🔥', color, habitId: habitId || null, days, start, code });
    toast(`Челлендж «${c.name}» создан. Код: ${c.code}`, 'ok');
    onClose();
  };

  return (
    <Modal
      title="Новый челлендж"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={save}><Icon name="flag" size={14} /> Создать</button>
      </>}
    >
      <label className="fld"><span>Название *</span>
        <input className="input" maxLength={60} placeholder="30 дней без сахара" value={name}
          onChange={(e) => setName(e.target.value)} autoFocus /></label>
      <label className="fld"><span>Описание</span>
        <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Правила, ставка, приз"
          value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <div className="grid g2">
        <label className="fld"><span>Иконка (эмодзи)</span>
          <input className="input" maxLength={4} value={emoji} onChange={(e) => setEmoji(e.target.value)} /></label>
        <label className="fld"><span>Цвет</span>
          <div className="swatches">
            {COLORS.slice(0, 10).map((x, i) => (
              <button type="button" key={i} className={`sw ${color === x ? 'on' : ''}`} style={{ background: x }}
                aria-label={`Цвет ${x}`} onClick={() => setColor(x)} />
            ))}
          </div></label>
      </div>
      <div className="grid g2">
        <label className="fld"><span>Привычка</span>
          <select className="select" value={habitId} onChange={(e) => setHabitId(e.target.value)}>
            {habits.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
            {habits.length ? null : <option value="">— сначала создайте привычку —</option>}
          </select></label>
        <label className="fld"><span>Длительность</span>
          <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 21, 30, 60, 90].map((d) => <option key={d} value={d}>{d} дней</option>)}
          </select></label>
      </div>
      <div className="grid g2">
        <label className="fld"><span>Старт</span>
          <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="fld"><span>Код приглашения</span>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></label>
      </div>
    </Modal>
  );
}

export function JoinCodeModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const join = (): void => {
    const c = hv.joinByCode(code);
    if (!c) { toast('Челлендж с таким кодом не найден', 'warn'); return; }
    toast(`Вы в челлендже «${c.name}»`, 'ok');
    onClose();
  };
  return (
    <Modal
      title="Вступить по коду"
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-primary" onClick={join}><Icon name="link" size={14} /> Вступить</button>
      </>}
    >
      <label className="fld"><span>Код приглашения</span>
        <input className="input" placeholder="HV-XXXX" value={code} autoFocus
          style={{ textTransform: 'uppercase', letterSpacing: '.14em', fontWeight: 800 }}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') join(); }} /></label>
      <p className="hint">В демо-режиме ищутся только ваши локальные челленджи. Приглашения между пользователями — фаза 5.4 (Supabase).</p>
    </Modal>
  );
}
