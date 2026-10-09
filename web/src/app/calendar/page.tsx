'use client';

/* ============================================================
   Календарь (фаза 5.3) — порт renderCalendar из v2/app.js.
   Месячная сетка с точками статусов и %-дня, панель выбранного дня
   (отметки в один клик, включая прошлые даты), heatmap года,
   сводка месяца. Фильтр по привычке — как в демо.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { YearHeatmap, dayRate } from '@/components/heatmap';
import { DayHabitSheet } from '@/components/day-habit-sheet';
import { hv, useHv } from '@/lib/store';
import { D, WD, dueOn, isDone, logAt, pad, visibleHabits, type Habit } from '@/lib/engine';
import { toast } from '@/lib/ui';

interface Cell { k: string; out: boolean; }

function monthCells(month: string): Cell[] {
  const [Y, M] = month.split('-').map(Number);
  const first = new Date(Y, M - 1, 1);
  const daysInMonth = new Date(Y, M, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells: Cell[] = [];
  for (let i = 0; i < lead; i++) cells.push({ k: D.add(D.key(first), i - lead), out: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ k: `${Y}-${pad(M)}-${pad(d)}`, out: false });
  while (cells.length % 7) cells.push({ k: D.add(cells[cells.length - 1].k, 1), out: true });
  return cells;
}

const CheckSvg = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 7.4l3 3 6-6.8" />
  </svg>
);

export default function CalendarPage() {
  const { state, ready } = useHv();
  const t = D.today();
  const [month, setMonth] = useState(t.slice(0, 7));
  const [sel, setSel] = useState('all');
  const [day, setDay] = useState(t);
  const [sheet, setSheet] = useState<{ h: Habit; k: string } | null>(null);

  const [Y, M] = month.split('-').map(Number);

  /* ?month=ГГГГ-ММ&day=ГГГГ-ММ-ДД из отчётов (клик по heatmap года) */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get('month');
    const d = p.get('day');
    if (m && /^\d{4}-\d{2}$/.test(m)) setMonth(m);
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setDay(d);
  }, []);

  const habits = useMemo(() => visibleHabits(state), [state]);
  const list = sel === 'all' ? habits : habits.filter((h) => h.id === sel);
  const cells = useMemo(() => monthCells(month), [month]);

  /* сводка месяца (до сегодня) */
  const mStat = useMemo(() => {
    const keys = cells.filter((c) => !c.out).map((c) => c.k).filter((k) => k <= t);
    let due = 0, done = 0, perfect = 0, bestRun = 0, run = 0;
    keys.forEach((k) => {
      const dl = list.filter((h) => dueOn(h, k));
      due += dl.length;
      const dn = dl.filter((h) => isDone(state, h.id, k)).length;
      done += dn;
      const v = dl.length ? dn / dl.length : null;
      if (v === 1) { perfect++; run++; bestRun = Math.max(bestRun, run); } else run = 0;
    });
    return { days: keys.length, due, done, perfect, bestRun };
  }, [cells, list, state, t]);

  const shiftMonth = (delta: number): void => {
    const d = new Date(Y, M - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  };

  const cycle = (hid: string, key: string): void => {
    if (D.isFuture(key)) { toast('Отметить будущее нельзя', 'info'); return; }
    hv.cycle(hid, key);
  };

  const dayHabits = list;

  return (
    <>
      <PageHead
        title="Календарь"
        sub={ready ? D.full(t) : 'Загрузка…'}
        crumbs={[{ name: 'Календарь' }]}
      />

      <section className="page active">
        {!ready ? (
          <div className="empty card"><span className="em"><Icon name="cal" size={30} /></span><h3>Загружаем данные…</h3></div>
        ) : (
          <>
            <div className="cal-head">
              <button className="btn btn-icon btn-ghost btn-sm" aria-label="Предыдущий месяц" onClick={() => shiftMonth(-1)}>
                <Icon name="chevL" size={15} />
              </button>
              <div className="cal-title">{D.monthName(M - 1)} {Y}</div>
              <button className="btn btn-icon btn-ghost btn-sm" aria-label="Следующий месяц" onClick={() => shiftMonth(1)}>
                <Icon name="chevR" size={15} />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setMonth(t.slice(0, 7)); setDay(t); }}>Сегодня</button>
              <div style={{ flex: 1 }} />
              <select className="select" style={{ width: 'auto', maxWidth: 230 }} value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Фильтр по привычке">
                <option value="all">Все привычки</option>
                {habits.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>)}
              </select>
              <span className={`pill ${mStat.due && mStat.done / mStat.due >= 0.8 ? 'ok' : mStat.due && mStat.done / mStat.due < 0.5 ? 'bad' : ''}`}>
                {mStat.due ? Math.round((mStat.done / mStat.due) * 100) : 0}% за месяц
              </span>
            </div>

            <div className="grid g2" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', marginBottom: 'var(--page-pad, 18px)', alignItems: 'start' }}>
              <div className="card">
                <div className="cal-grid" style={{ marginBottom: 8 }}>
                  {WD.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
                </div>
                <div className="cal-grid">
                  {cells.map((c) => {
                    const dueL = list.filter((h) => dueOn(h, c.k));
                    const doneL = dueL.filter((h) => isDone(state, h.id, c.k));
                    const missedL = dueL.filter((h) => !isDone(state, h.id, c.k) && c.k < t);
                    const rate = dueL.length ? doneL.length / dueL.length : null;
                    const cls = ['cal-cell', c.out ? 'out' : '', c.k === t ? 'today' : '', c.k === day ? 'selected' : '',
                      D.isFuture(c.k) ? 'future' : '', rate === 1 ? 'full' : '', rate === 0 && dueL.length ? 'zero' : ''].filter(Boolean).join(' ');
                    return (
                      <div className={cls} key={c.k} onClick={() => { if (!D.isFuture(c.k)) setDay(c.k); }}
                        role="button" tabIndex={c.out || D.isFuture(c.k) ? -1 : 0}
                        aria-label={`${D.full(c.k)}${rate !== null ? `, ${Math.round(rate * 100)}%` : ''}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !D.isFuture(c.k)) setDay(c.k); }}>
                        <div className="cal-day">{D.parse(c.k).getDate()}</div>
                        <div className="cal-dots">
                          {sel === 'all' ? (
                            <>
                              {doneL.slice(0, 10).map((h) => <i className="d" key={h.id} style={{ ['--c' as string]: h.color }} title={h.name} />)}
                              {missedL.slice(0, 10).map((h) => <i className="m" key={h.id} style={{ ['--c' as string]: h.color }} title={`${h.name} — провал`} />)}
                            </>
                          ) : (() => {
                            const h = list[0];
                            if (!h || !dueOn(h, c.k)) return null;
                            const l = logAt(state, h.id, c.k);
                            if (l) return <i className={l.status === 'done' ? 'd' : l.status === 'skip' ? 's' : 'm'} style={{ ['--c' as string]: h.color }} />;
                            return c.k < t ? <i className="m" /> : null;
                          })()}
                        </div>
                        {rate !== null ? <div className="cal-rate">{Math.round(rate * 100)}%</div> : null}
                        <div className="fillbar" style={{ width: `${rate ? rate * 100 : 0}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card">
                  <div className="card-h">
                    <Icon name="cal" size={15} /><h3>День</h3><div className="sp" />
                    <span className="xs faint">{day === t ? 'сегодня' : D.human(day)}</span>
                  </div>
                  <div className="cal-day-panel">
                    {dayHabits.length ? dayHabits.map((h) => {
                      const d = dueOn(h, day);
                      const l = logAt(state, h.id, day);
                      const st = l ? l.status : (d && day < t ? 'miss' : null);
                      const future = D.isFuture(day);
                      return (
                        <div className="row" style={{ gap: 10, padding: '9px 0' }} key={h.id}>
                          <button
                            className={`check ${st === 'done' ? 'on' : st === 'skip' ? 'skip' : st === 'miss' ? (h.neg ? 'held' : 'miss') : ''}`}
                            style={{ ['--hc' as string]: h.color, width: 38, height: 38, borderRadius: 12 }}
                            aria-label={st === 'done' ? 'Снять отметку' : 'Отметить'}
                            title={future ? 'Будущее отмечать нельзя' : 'Выполнено → пропуск → провал → сброс'}
                            onClick={() => cycle(h.id, day)}
                          >
                            {st === 'done' ? <CheckSvg /> : st === 'skip' ? <Icon name="minus" size={15} /> : st === 'miss' ? <Icon name="x" size={14} /> : <span aria-hidden="true">{h.emoji}</span>}
                          </button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <b className="small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span aria-hidden="true">{h.emoji}</span> {h.name}
                            </b>
                            <span className="xs faint">
                              {d ? 'запланировано' : 'не в расписании'}
                              {st ? ' · ' + (st === 'done' ? 'выполнено' : st === 'skip' ? 'пропуск' : 'провал') : ''}
                            </span>
                          </div>
                          {future ? <span className="pill">будущее</span> : (
                            <button className="icon-btn" title="Заметка ко дню" aria-label={`Заметка ко дню: ${h.name}`}
                              onClick={() => setSheet({ h, k: day })}>
                              <Icon name="note" size={15} />
                            </button>
                          )}
                        </div>
                      );
                    }) : <p className="small muted">Нет привычек.</p>}
                  </div>
                  <p className="xs faint" style={{ marginTop: 8 }}>Кликните по любому дню, чтобы отметить привычки — включая прошлые даты.</p>
                </div>

                <div className="card">
                  <div className="card-h">
                    <Icon name="dash" size={15} /><h3>Heatmap года</h3><div className="sp" />
                    <span className="xs faint">{sel === 'all' ? 'все привычки' : (habits.find((h) => h.id === sel)?.name || '')}</span>
                  </div>
                  <YearHeatmap
                    state={state}
                    sel={sel}
                    onPick={(k) => {
                      if (sel !== 'all') {
                        const h = habits.find((x) => x.id === sel);
                        if (h) setSheet({ h, k });
                        return;
                      }
                      setMonth(k.slice(0, 7));
                      setDay(k);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-h"><h3>Сводка месяца</h3><div className="sp" /><span className="pill">{mStat.done} из {mStat.due}</span></div>
              <div className="grid g4" style={{ marginBottom: 6 }}>
                <div className="kpi" style={{ padding: 14 }}>
                  <div className="kpi-val mono" style={{ fontSize: 24 }}>{mStat.due ? Math.round((mStat.done / Math.max(1, mStat.due)) * 100) + '%' : '—'}</div>
                  <div className="kpi-lab">выполнение</div>
                </div>
                <div className="kpi" style={{ padding: 14 }}>
                  <div className="kpi-val mono" style={{ fontSize: 24 }}>{mStat.done}</div>
                  <div className="kpi-lab">отметок</div>
                </div>
                <div className="kpi" style={{ padding: 14 }}>
                  <div className="kpi-val mono" style={{ fontSize: 24 }}>{mStat.perfect}</div>
                  <div className="kpi-lab">идеальных дней</div>
                </div>
                <div className="kpi" style={{ padding: 14 }}>
                  <div className="kpi-val mono" style={{ fontSize: 24 }}>{mStat.bestRun}</div>
                  <div className="kpi-lab">дней подряд 100%</div>
                </div>
              </div>
              <p className="xs faint">{dayRate(state, list, t) === null ? 'На сегодня нет плановых привычек.' : `Сегодня: ${Math.round((dayRate(state, list, t) || 0) * 100)}%.`}</p>
            </div>
          </>
        )}
      </section>

      {sheet ? <DayHabitSheet h={sheet.h} dayKey={sheet.k} onClose={() => setSheet(null)} /> : null}
    </>
  );
}
