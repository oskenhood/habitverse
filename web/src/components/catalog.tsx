'use client';

/* ============================================================
   Каталог готовых привычек (фаза 5.3) — порт catalogSheet из v2.
   30 пресетов в 7 группах, поиск, защита от дублей по названию.
   Живёт в Shell: открывается сайдбаром, кнопками страниц, ⌘K
   (событие hv:open-catalog → ui.ts openCatalog()).
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/modal';
import { Icon } from '@/components/icon';
import { hv, useHv } from '@/lib/store';
import { D, catOf, freqLabel } from '@/lib/engine';
import { filterPresets, presetToHabit, PRESET_COUNT } from '@/lib/presets';
import { toast } from '@/lib/ui';

export function Catalog({ onClose }: { onClose: () => void }) {
  const { state } = useHv();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const groups = useMemo(() => filterPresets(search), [search]);
  // БЕЗ useMemo по state.habits: mutate() меняет ссылку только на верхний объект state,
  // массив habits мутируется на месте — мемо по ссылке на массив не пересчитался бы (баг, найден смоуком 5.3)
  const existing = new Set(state.habits.map((h) => h.name.toLowerCase()));

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 40); }, []);

  const add = (gi: number, ii: number): void => {
    const it = groups[gi]?.items[ii];
    if (!it) return;
    if (existing.has(it.name.toLowerCase())) { toast('Такая привычка уже есть', 'info'); return; }
    hv.addHabit(presetToHabit(it, D.today()));
    toast(`«${it.name}» добавлена`, 'ok');
  };

  return (
    <Modal title="Каталог привычек" onClose={onClose}>
      <p className="small muted" style={{ marginTop: -8, marginBottom: 12 }}>
        {PRESET_COUNT} готовых формулировок с расписанием и недельной целью. Клик — и привычка добавлена, потом можно докрутить.
      </p>
      <label className="input-ic">
        <Icon name="search" size={14} />
        <input ref={inputRef} className="input" placeholder="Поиск по каталогу…" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Поиск по каталогу" />
      </label>

      <div className="cat-list">
        {groups.length ? groups.map((g, gi) => (
          <div className="cat-group" key={g.group}>
            <div className="cat-head"><span>{g.group}</span><span className="ct">{g.items.length}</span></div>
            {g.items.map((it, ii) => {
              const has = existing.has(it.name.toLowerCase());
              const c = catOf(it.cat);
              return (
                <button type="button" key={it.name} className={`preset ${has ? 'has' : ''}`}
                  style={{ ['--d' as string]: `${Math.min(ii, 10) * 16}ms` }}
                  onClick={() => add(gi, ii)} disabled={has}
                  title={has ? 'Уже в списке' : 'Добавить привычку'}>
                  <span className="tile" style={{ ['--tc' as string]: it.color }}>
                    <Icon name={c.icon || 'dash'} size={15} />
                  </span>
                  <span className="px"><b>{it.name}</b><small>{it.desc || ''}</small></span>
                  <span className="chips">
                    <span className="chip">{freqLabel(it)}</span>
                    {it.weekGoal ? <span className="chip">{it.weekGoal}/7</span> : null}
                  </span>
                  <span className="add"><Icon name={has ? 'check' : 'plus'} size={14} /></span>
                </button>
              );
            })}
          </div>
        )) : (
          <div className="empty">
            <span className="em"><Icon name="search" size={26} /></span>
            <p className="muted">Ничего не нашлось по запросу «{search}»</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
