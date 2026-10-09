'use client';

/* ============================================================
   Строка привычки (фаза 5.2, DnD-ручка — 5.3) — порт habitRow из v2/app.js.
   Отличия от демо (осознанные):
   - вместо текстовых глифов ▲/↻/🧊/✎/⋯ — stroke-SVG из набора v2 (правило: UI-хром без эмодзи);
   - drag-ручка (grip) появляется только когда страница передала drag-хелпер
     (Pointer Events — работают и мышью, и пальцем; HTML5 DnD на тач не работает).
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { hv, useHv } from '@/lib/store';
import {
  D, WD, catOf, dueOn, freqLabel, freezesLeft, logAt, streakOf, weekProgress,
  type Habit,
} from '@/lib/engine';
import { toast } from '@/lib/ui';

const CheckSvg = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 7.4l3 3 6-6.8" />
  </svg>
);

export interface RowDrag {
  onDown: (e: React.PointerEvent) => void;
  dragging: boolean;
  enabled: boolean;
}

export function HabitRow({ h, dayKey, index = 0, drag }: { h: Habit; dayKey: string; index?: number; drag?: RowDrag }) {
  const { state } = useHv();
  const router = useRouter();
  const [menu, setMenu] = useState<'closed' | 'open' | 'confirm'>('closed');
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(h.name);
  const menuHost = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  /* закрытие меню кликом вне */
  useEffect(() => {
    if (menu === 'closed') return;
    const onDown = (e: MouseEvent) => {
      if (menuHost.current && !menuHost.current.contains(e.target as Node)) setMenu('closed');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  useEffect(() => {
    if (renaming) { setNameDraft(h.name); setTimeout(() => { nameInput.current?.focus(); nameInput.current?.select(); }, 0); }
  }, [renaming, h.name]);

  const l = logAt(state, h.id, dayKey);
  const st = l ? l.status : (dueOn(h, dayKey) && dayKey < D.today() ? 'miss' : null);
  const due = dueOn(h, dayKey);
  const s = streakOf(state, h, undefined, { persist: false });   // рендер чист: флаги заморозок проставляет store
  const frz = freezesLeft(state, h, dayKey);
  const neg = !!h.neg;
  const cat = catOf(h.cat);

  const cls = ['hv-row', st === 'done' ? 'done' : '', st === 'miss' && !neg ? 'missed' : '', h.archived ? 'archived' : '', drag?.dragging ? 'dragging' : ''].filter(Boolean).join(' ');

  /* последние 14 дней */
  const hist: string[] = [];
  for (let d = 13; d >= 0; d--) {
    const k = D.add(dayKey, -d);
    const lg = logAt(state, h.id, k);
    hist.push(lg ? (lg.status === 'done' ? 'd' : lg.status === 'skip' ? 's' : 'm') : (dueOn(h, k) && k < dayKey ? 'm' : ''));
  }

  const wp = h.weekGoal > 0 ? (s.week || weekProgress(state, h, dayKey)) : null;

  const commitRename = () => {
    setRenaming(false);
    const v = nameDraft.trim();
    if (v && v !== h.name) { hv.rename(h.id, v); toast('Название обновлено', 'ok'); }
  };

  const checkCls = st === 'done' ? 'on' : st === 'skip' ? 'skip' : st === 'miss' ? (neg ? 'held' : 'miss') : '';

  return (
    <article className={cls} style={{ ['--hc' as string]: h.color, animationDelay: `${Math.min(index, 12) * 18}ms` }} data-id={h.id}>
      <button
        className={`check ${checkCls}`}
        aria-label={st === 'done' ? 'Снять отметку' : 'Отметить'}
        title={neg ? 'Привычка «не делать»: сдержался → не уверен → сорвался' : 'Выполнено → пропуск → провал → сброс'}
        onClick={() => hv.cycle(h.id, dayKey)}
      >
        <CheckSvg />
      </button>

      <div className="hv-body">
        <div className="hv-name">
          <span className="em" aria-hidden="true">{h.emoji}</span>
          {renaming ? (
            <input
              ref={nameInput}
              className="nm-edit"
              value={nameDraft}
              maxLength={60}
              aria-label="Новое название"
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            />
          ) : (
            <span className="nm" title="Двойной клик — переименовать" onDoubleClick={() => setRenaming(true)}>{h.name}</span>
          )}
          {h.target > 1 ? <span className="num" style={{ fontSize: 12, color: 'var(--text-3)' }}>{(l && l.val) || 0}/{h.target} {h.unit || ''}</span> : null}
          {neg ? <span className="tag bad">не делать</span> : null}
          {h.archived ? <span className="tag">архив</span> : null}
          {!due && !st ? <span className="tag">не сегодня</span> : null}
        </div>
        {h.desc ? <div className="hv-desc">{h.desc}</div> : null}
        <div className="hv-meta">
          <span className="tag" title={cat.name}><Icon name={cat.icon || 'dash'} size={12} /> {cat.name}</span>
          {h.cat === 'money' ? (
            <button className="tag fin-tag" title="Открыть реестр трат (раздел «Финансы»)"
              onClick={(e) => { e.stopPropagation(); router.push('/finance'); }}>
              <Icon name="coin" size={12} /> Реестр трат
            </button>
          ) : null}
          <span className="tag">{freqLabel(h)}</span>
          {h.reminder ? <span className={`tag ${h.notif ? 'ok' : ''}`}><Icon name="clock" size={12} /> {h.reminder}</span> : null}
          {wp ? (
            <span className="quota" title={`Недельная квота: ${wp.done} из ${wp.goal}`}>
              <span className="cells">
                {Array.from({ length: Math.min(7, wp.goal) }, (_, j) => <i key={j} className={j < wp.done ? 'on' : ''} />)}
              </span>
              <span className="num">{wp.done}/{wp.goal}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="hv-side">
        <div className="hist" title="последние 14 дней">{hist.map((c, j) => <i key={j} className={c} />)}</div>
        {h.freezes > 0 ? (
          <span className={`freeze-pill ${frz === 0 ? 'spent' : ''}`} title={`Заморозок стрика в этом месяце: ${frz} из ${h.freezes}${s.frozen ? ` · спасено ${s.frozen}` : ''}`}>
            <Icon name="snow" size={12} /><b className="num">{frz}</b>
          </span>
        ) : null}
        <span className={`streak-pill ${s.cur >= 7 ? 'hot' : ''}`} title={s.weekly ? 'Недель подряд' : 'Дней подряд'}>
          <Icon name={s.weekly ? 'cal' : 'trend'} size={12} />
          <b>{s.cur}</b><span style={{ color: 'var(--text-4)' }}>/{s.best}</span>
        </span>
        <div className="weekdots">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => {
            const f = h.freq || { type: 'daily' };
            const on = f.type === 'daily' || (f.days || []).includes(d) || (f.type === 'weekly' && d === (f.day ?? 0) % 7);
            return <i key={d} className={`${on ? 'on' : ''} ${D.dow(dayKey) === d ? 'today' : ''}`}>{WD[d][0]}</i>;
          })}
        </div>
        <div className="hv-acts" style={{ position: 'relative' }} ref={menuHost}>
          {drag && drag.enabled ? (
            <button
              className="drag-handle"
              aria-label="Перетащить"
              title="Перетащить"
              onPointerDown={drag.onDown}
            >
              <Icon name="grip" size={14} />
            </button>
          ) : null}
          <button aria-label="Редактировать" title="Редактировать" onClick={() => { setMenu('closed'); window.dispatchEvent(new CustomEvent('hv:edit-habit', { detail: h.id })); }}>
            <Icon name="pencil" size={14} />
          </button>
          <button aria-label="Ещё" title="Ещё" onClick={() => setMenu(menu === 'closed' ? 'open' : 'closed')}>
            <Icon name="dots" size={14} />
          </button>

          {menu !== 'closed' ? (
            <div className="menu" style={{ right: 0, top: '100%', marginTop: 4 }}>
              {menu === 'open' ? (
                <>
                  {h.cat === 'money' ? (
                    <button onClick={() => { setMenu('closed'); router.push('/finance'); }}>
                      <Icon name="coin" size={14} /> Финансы: открыть реестр
                    </button>
                  ) : null}
                  <button onClick={() => { setMenu('closed'); window.dispatchEvent(new CustomEvent('hv:edit-habit', { detail: h.id })); }}>
                    <Icon name="pencil" size={14} /> Редактировать
                  </button>
                  <button onClick={() => { setMenu('closed'); hv.duplicate(h.id); toast('Привычка дублирована', 'ok'); }}>
                    <Icon name="copy" size={14} /> Дублировать
                  </button>
                  <hr />
                  <button onClick={() => { setMenu('closed'); hv.reorder(-1, h.id); }}>
                    <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevD" size={14} /></span> Выше
                  </button>
                  <button onClick={() => { setMenu('closed'); hv.reorder(1, h.id); }}>
                    <Icon name="chevD" size={14} /> Ниже
                  </button>
                  <button onClick={() => { setMenu('closed'); const arch = hv.toggleArchive(h.id); toast(arch ? 'Перенесено в архив' : 'Возвращено из архива', 'ok'); }}>
                    <Icon name={h.archived ? 'upload' : 'download'} size={14} /> {h.archived ? 'Вернуть из архива' : 'В архив'}
                  </button>
                  <hr />
                  <button className="danger" onClick={() => setMenu('confirm')}>
                    <Icon name="trash" size={14} /> Удалить
                  </button>
                </>
              ) : (
                <>
                  <div className="label">«{h.name}» и вся история будут удалены безвозвратно.</div>
                  <button className="danger" onClick={() => { setMenu('closed'); hv.removeHabitById(h.id); toast('Привычка удалена', 'warn'); }}>
                    <Icon name="trash" size={14} /> Да, удалить
                  </button>
                  <button onClick={() => setMenu('closed')}>
                    <Icon name="x" size={14} /> Отмена
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
