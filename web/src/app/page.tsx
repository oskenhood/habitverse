'use client';

/* ============================================================
   Обзор (фаза 5.2) — живая страница: порт renderToday из v2/app.js.
   Метрики дня/недели/30 дней, список «На сегодня» с отметками,
   полоса недели, стрики, мысль дня, сводка.
   ============================================================ */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { HabitRow } from '@/components/habit-row';
import { HabitModal } from '@/components/habit-modal';
import { hv, useHv } from '@/lib/store';
import {
  CATEGORIES, D, QUOTES, WD, dueOn, isDone, rateOf, streakOf, visibleHabits,
} from '@/lib/engine';
import { openCatalog, toast } from '@/lib/ui';

export default function OverviewPage() {
  const router = useRouter();
  const { state, ready } = useHv();
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * QUOTES.length));

  /* событие из строки привычки: «Редактировать» */
  useEffect(() => {
    const onEdit = (e: Event) => setModal({ open: true, editId: String((e as CustomEvent).detail || '') });
    window.addEventListener('hv:edit-habit', onEdit);
    return () => window.removeEventListener('hv:edit-habit', onEdit);
  }, []);

  const t = D.today();
  const m = useMemo(() => {
    const habits = visibleHabits(state);
    const due = habits.filter((h) => dueOn(h, t));
    const done = due.filter((h) => isDone(state, h.id, t));
    const pct = due.length ? Math.round((done.length / due.length) * 100) : 0;
    const left = due.filter((h) => !isDone(state, h.id, t));

    // 30-дневная консистентность и лучшие стрики
    const rates = habits.map((h) => rateOf(state, h, 30)).filter((v): v is number => v !== null);
    const rate30 = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0;
    const best = habits.map((h) => ({ h, s: streakOf(state, h, undefined, { persist: false }) })).sort((a, b) => b.s.cur - a.s.cur);
    const totalDone = Object.values(state.logs).reduce((n, mm) => n + Object.values(mm).filter((l) => l.status === 'done').length, 0);

    // неделя: 7 последних дней
    const weekKeys: string[] = [];
    for (let i = 6; i >= 0; i--) weekKeys.push(D.add(t, -i));
    const weekData = weekKeys.map((k) => {
      const dl = habits.filter((h) => dueOn(h, k));
      const dn = dl.filter((h) => isDone(state, h.id, k)).length;
      return { k, due: dl.length, done: dn, rate: dl.length ? dn / dl.length : null };
    });
    const vals = weekData.filter((d) => d.rate !== null) as Array<{ rate: number }>;
    const weekPct = vals.length ? Math.round((vals.reduce((a, b) => a + b.rate, 0) / vals.length) * 100) : 0;
    const fullDays = weekData.filter((d) => d.rate === 1).length;

    return { habits, due, done, pct, left, rate30, best, totalDone, weekData, weekPct, fullDays };
  }, [state, t]);

  const q = QUOTES[quoteIdx % QUOTES.length];

  return (
    <>
      <PageHead
        title="Обзор"
        sub={ready ? D.full(t) : 'Загрузка…'}
        crumbs={[{ name: 'Обзор' }]}
        actions={<>
          <button className="btn" onClick={openCatalog}>
            <Icon name="book" size={14} /> Каталог
          </button>
          <button className="btn btn-primary" onClick={() => setModal({ open: true, editId: null })}>
            <Icon name="plus" size={14} /> Новая привычка
          </button>
        </>}
      />

      {!ready ? (
        <section className="page active"><div className="empty card"><span className="em"><Icon name="dash" size={30} /></span><h3>Загружаем данные…</h3></div></section>
      ) : m.habits.length === 0 ? (
        <section className="page active">
          <div className="empty card">
            <span className="em"><Icon name="spark" size={30} /></span>
            <h3>Добро пожаловать в HabitVerse</h3>
            <p>Добавьте первую привычку сами — или загрузите демо-данные, чтобы посмотреть, как всё работает: 13 привычек с трёхмесячной историей.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { hv.seed(); toast('Демо-данные загружены', 'ok'); }}>
                <Icon name="download" size={14} /> Демо-данные
              </button>
              <button className="btn btn-primary" onClick={() => setModal({ open: true, editId: null })}>
                <Icon name="plus" size={14} /> Новая привычка
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="page active">
          <div className="grid g4" style={{ marginBottom: 18 }}>
            <div className="metric">
              <div className="label">Сегодня</div>
              <div className="val">{m.done.length}<small>/{m.due.length}</small></div>
              <div className="delta">{m.due.length ? (m.left.length ? `осталось ${m.left.length}` : 'всё закрыто') : 'нет плановых привычек'}</div>
            </div>
            <div className="metric">
              <div className="label">Эта неделя</div>
              <div className="val">{m.weekPct}<small>%</small></div>
              <div className="delta">{m.fullDays} из 7 дней полностью</div>
            </div>
            <div className="metric">
              <div className="label">30 дней</div>
              <div className="val">{m.rate30}<small>%</small></div>
              <div className="delta">консистентность</div>
            </div>
            <div className="metric">
              <div className="label">Лучший стрик</div>
              <div className="val">{m.best[0] ? m.best[0].s.cur : 0}<small>{m.best[0] && m.best[0].s.weekly ? 'нед' : 'дн'}</small></div>
              <div className="delta">{m.best[0] ? m.best[0].h.name : '—'}</div>
            </div>
          </div>

          <div className="today-grid">
            <div className="stack">
              <div className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="label" style={{ marginBottom: 7 }}>Прогресс дня</div>
                    <div className="progress"><i style={{ width: `${m.pct}%` }} /></div>
                  </div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 600 }}>{m.pct}%</div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 600 }}>На сегодня</h2>
                  <span className="tag">{m.due.length}</span>
                  <div style={{ flex: 1 }} />
                  {m.left.length ? (
                    <button className="btn btn-sm btn-quiet" onClick={() => router.push('/habits?filter=left')}>Только оставшиеся</button>
                  ) : null}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  {m.due.length ? (
                    m.due.map((h, i) => <HabitRow key={h.id} h={h} dayKey={t} index={i} />)
                  ) : (
                    <div className="empty card">
                      <span className="em"><Icon name="cal" size={28} /></span>
                      <h3>На сегодня ничего не запланировано</h3>
                      <p>Хороший день, чтобы добавить новую привычку или перенести её расписание.</p>
                      <button className="btn btn-primary" onClick={() => setModal({ open: true, editId: null })}>Новая привычка</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="stack">
              <div className="card">
                <div className="card-h"><h3>Неделя</h3><div className="sp" /><span className="num" style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.weekPct}%</span></div>
                <div className="weekstrip">
                  {m.weekData.map((d) => {
                    const lvl = d.rate === null ? '' : d.rate >= 1 ? 'full' : d.rate >= 0.5 ? 'half' : d.rate > 0 ? 'low' : 'zero';
                    return (
                      <button key={d.k} className={`weekstrip-cell ${lvl}`}
                        title={`${D.full(d.k)}${d.rate !== null ? ` · ${d.done}/${d.due}` : ' · нет плана'}`}
                        onClick={() => router.push('/calendar')}>
                        <span className="wd">{WD[D.dow(d.k)]}</span>
                        <span className="bar"><i style={{ height: `${d.rate === null ? 0 : Math.max(4, d.rate * 100)}%` }} /></span>
                        <span className="dn">{D.parse(d.k).getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <div className="card-h"><h3>Стрики</h3><div className="sp" /><span className="label">текущий / рекорд</span></div>
                {m.best.length ? m.best.slice(0, 6).map(({ h, s: st }) => (
                  <div className="row-line" key={h.id} style={{ padding: '8px 0' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: h.color, flex: 'none', display: 'inline-block' }} />
                    <div className="tx"><b style={{ fontWeight: 500 }}>{h.name}</b></div>
                    <div className="num" style={{ fontSize: 13, fontWeight: 600 }}>{st.cur}<span style={{ color: 'var(--text-4)', fontWeight: 400 }}> / {st.best}</span></div>
                  </div>
                )) : <p className="hint">Добавьте привычки — здесь появятся стрики.</p>}
              </div>

              <div className="card">
                <div className="card-h"><h3>Мысль дня</h3></div>
                <blockquote style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>{q[0]}</blockquote>
                <cite style={{ display: 'block', marginTop: 8, fontStyle: 'normal', fontSize: 12, color: 'var(--text-3)' }}>— {q[1]}</cite>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-sm btn-quiet" onClick={() => setQuoteIdx((i) => (i + 1 + Math.floor(Math.random() * (QUOTES.length - 1))) % QUOTES.length)}>
                    Другая <Icon name="trend" size={12} />
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="card-h"><h3>Сводка</h3></div>
                <div className="row-line" style={{ padding: '7px 0' }}><div className="tx"><b>Всего отметок</b></div><div className="num" style={{ fontSize: 13 }}>{m.totalDone}</div></div>
                <div className="row-line" style={{ padding: '7px 0' }}><div className="tx"><b>Активных привычек</b></div><div className="num" style={{ fontSize: 13 }}>{m.habits.length}</div></div>
                <div className="row-line" style={{ padding: '7px 0' }}><div className="tx"><b>Категорий задействовано</b></div><div className="num" style={{ fontSize: 13 }}>{new Set(m.habits.map((h) => h.cat)).size} из {CATEGORIES.length}</div></div>
                <div className="row-line" style={{ padding: '7px 0' }}><div className="tx"><b>Заметок</b></div><div className="num" style={{ fontSize: 13 }}>{state.notes.length}</div></div>
              </div>
            </div>
          </div>
        </section>
      )}

      {modal.open ? <HabitModal editId={modal.editId} onClose={() => setModal({ open: false, editId: null })} /> : null}
    </>
  );
}
