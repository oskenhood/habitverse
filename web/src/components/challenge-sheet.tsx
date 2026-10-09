'use client';

/* Шит челленджа (фаза 5.3) — порт challengeSheet из v2:
   код приглашения, heatmap привычки, участники. Аватары — инициалы (правило alpha.2). */
import { useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Avatar } from '@/components/avatar';
import { HabitHeatmap } from '@/components/heatmap';
import { DayHabitSheet } from '@/components/day-habit-sheet';
import { Icon } from '@/components/icon';
import { useHv } from '@/lib/store';
import { D, challengeProgress } from '@/lib/engine';
import { toast } from '@/lib/ui';

export function ChallengeSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state } = useHv();
  const c = state.challenges.find((x) => x.id === id);
  const [dayPick, setDayPick] = useState<string | null>(null);
  if (!c) return null;
  const habit = state.habits.find((h) => h.id === c.habitId) || null;
  const ms = challengeProgress(state, c);
  const code = c.invite_code || c.code || '';

  const copy = (): void => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => toast('Код скопирован', 'ok'), () => toast(code, 'info'));
    } else toast(code, 'info');
  };

  return (
    <>
      <Sheet onClose={onClose} label={`Челлендж ${c.name}`}>
        <div className="modal-h">
          <span className="sheet-ic" style={{ background: `color-mix(in oklab, ${c.color} 12%, var(--surface))`, color: c.color }} aria-hidden="true">{c.emoji}</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 17 }}>{c.name}</h2>
            <p className="small muted">{D.human(c.start)} → {D.human(c.end)} · {c.days} дней</p>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose} aria-label="Закрыть"><Icon name="x" size={15} /></button>
        </div>

        {c.desc ? <p className="small muted" style={{ lineHeight: 1.6, marginBottom: 14 }}>{c.desc}</p> : null}

        <div className="card" style={{ marginBottom: 12 }}>
          <b className="small">Код приглашения</b>
          <div className="row" style={{ marginTop: 8, gap: 8 }}>
            <code style={{ flex: 1, padding: 10, borderRadius: 10, background: 'var(--bg-sunken)', fontSize: 15, letterSpacing: '.14em', fontWeight: 800 }}>{code}</code>
            <button className="btn btn-soft btn-sm" onClick={copy}><Icon name="copy" size={13} /> Копировать</button>
          </div>
          <p className="xs faint" style={{ marginTop: 8 }}>Поделитесь кодом — друзья вступят в челлендж (в полной версии через Supabase, фаза 5.4).</p>
        </div>

        {habit ? (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-h"><h3>{habit.emoji} {habit.name}</h3><div className="sp" /><span className="pill">{ms.done}/{ms.days} дней</span></div>
            <HabitHeatmap state={state} h={habit} days={Math.min(c.days, 120)} onPick={(k) => setDayPick(k)} />
          </div>
        ) : <p className="small muted">Привычка не выбрана.</p>}

        <div className="card">
          <div className="card-h"><h3>Участники</h3><div className="sp" /><span className="label">{(c.participants || []).length}</span></div>
          {(c.participants || []).map((p, i) => {
            const score = p.id === 'me' ? ms.pct : Number(p.score) || 0;
            return (
              <div className={`lb-row ${p.id === 'me' ? 'me' : ''}`} key={p.id}>
                <span className="lb-pos num">{i + 1}</span>
                <Avatar p={{ name: p.name, avatar_url: p.avatar }} size={26} />
                <div className="lb-t"><b>{p.name}{p.id === 'me' ? ' · вы' : ''}</b></div>
                <span className="lb-score num">{score}%</span>
              </div>
            );
          })}
        </div>
      </Sheet>

      {dayPick && habit ? (
        <DayHabitSheet h={habit} dayKey={dayPick} onClose={() => setDayPick(null)} />
      ) : null}
    </>
  );
}
