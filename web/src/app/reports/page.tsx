'use client';

/* ============================================================
   Отчёты (фаза 5.3) — порт renderStats из v2/app.js.
   Диапазоны 7/30/90/180/365, 5 KPI, 4 canvas-чарта (динамика,
   донат статусов, дни недели, радар сфер), рейтинг привычек,
   стрики, карта года, инсайты, экспорт CSV и печать.
   Чарты — lib/charts.ts (уважают prefers-reduced-motion).
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { YearHeatmap } from '@/components/heatmap';
import { hv, useHv } from '@/lib/store';
import {
  CATEGORIES, D, WD_FULL, avg, clamp, dueOn, isDone, logAt, rateOf, streakOf, sum, visibleHabits,
  type Habit, type HvState,
} from '@/lib/engine';
import { drawDonut, drawDow, drawRadar, drawTrend, cssVar, type DowStat, type RadarCat, type TrendPoint } from '@/lib/charts';

const RANGES = [7, 30, 90, 180, 365];

interface PerDay { k: string; due: number; done: number; rate: number | null; }

function perDayOf(s: HvState, habits: Habit[], keys: string[]): PerDay[] {
  return keys.map((k) => {
    const dl = habits.filter((h) => dueOn(h, k));
    const dn = dl.filter((h) => isDone(s, h.id, k)).length;
    return { k, due: dl.length, done: dn, rate: dl.length ? dn / dl.length : null };
  });
}

interface Insight { icon: string; title: string; text: string; }

function buildInsights(s: HvState, habits: Habit[], N: number, perDay: PerDay[]): Insight[] {
  const out: Insight[] = [];
  const valid = perDay.filter((d) => d.rate !== null) as Array<{ k: string; rate: number }>;
  const overall = valid.length ? avg(valid.map((d) => d.rate)) : 0;
  const dowAgg = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const ks = valid.filter((d) => D.dow(d.k) === i);
    return { i, r: ks.length ? avg(ks.map((d) => d.rate)) : 0, n: ks.length };
  }).filter((x) => x.n);
  const dowBest = [...dowAgg].sort((a, b) => b.r - a.r)[0];
  const dowWorst = [...dowAgg].sort((a, b) => a.r - b.r)[0];
  const sorted = habits.map((h) => ({ h, r: rateOf(s, h, N) })).filter((x): x is { h: Habit; r: number } => x.r !== null).sort((a, b) => a.r - b.r);
  const weak = sorted[0], strong = sorted[sorted.length - 1];
  const longest = habits.map((h) => ({ h, st: streakOf(s, h, undefined, { persist: false }) })).sort((a, b) => b.st.best - a.st.best)[0];
  const cat = CATEGORIES.map((c) => {
    const hs = habits.filter((h) => h.cat === c.id);
    const rs = hs.map((h) => rateOf(s, h, N)).filter((v): v is number => v !== null);
    return { c, n: hs.length, r: rs.length ? avg(rs) : null };
  }).filter((x): x is { c: (typeof CATEGORIES)[number]; n: number; r: number } => x.r !== null).sort((a, b) => b.r - a.r);
  const unusedCat = CATEGORIES.find((c) => !habits.some((h) => h.cat === c.id));

  if (overall >= 0.85) out.push({ icon: 'award', title: 'Вы в отличной форме', text: `${Math.round(overall * 100)}% выполнения за ${N} дней. Пора повышать планку: добавьте сложность или новую привычку.` });
  else if (overall >= 0.5) out.push({ icon: 'trend', title: 'Хороший рабочий ритм', text: `${Math.round(overall * 100)}% за период. До стабильных 85% не хватает совсем немного — попробуйте сократить число привычек до 3–5 ключевых.` });
  else if (valid.length) out.push({ icon: 'target', title: 'Нужна перезагрузка системы', text: `${Math.round(overall * 100)}% выполнения. Скорее всего привычек слишком много или они слишком крупные. Разбейте одну на шаги по 2 минуты.` });
  else out.push({ icon: 'leaf', title: 'Данных пока мало', text: 'Добавьте привычки и отметьте пару дней — здесь появятся персональные инсайты.' });

  if (dowBest && dowWorst && dowBest.i !== dowWorst.i) {
    out.push({ icon: 'cal', title: `${WD_FULL[dowBest.i]} — ваш день`, text: `В ${WD_FULL[dowBest.i].toLowerCase()} вы выполняете ${Math.round(dowBest.r * 100)}%, а в ${WD_FULL[dowWorst.i].toLowerCase()} — всего ${Math.round(dowWorst.r * 100)}%. Перенесите тяжёлые привычки на сильные дни.` });
  }
  if (weak && weak.r < 0.6) out.push({ icon: 'warn', title: 'Слабое звено', text: `${weak.h.emoji} «${weak.h.name}» — ${Math.round(weak.r * 100)}%. Уменьшите цель (минимум 2 минуты) или привяжите к уже существующей привычке.` });
  if (strong && strong.r >= 0.8) out.push({ icon: 'heart', title: 'Опора', text: `${strong.h.emoji} «${strong.h.name}» — ${Math.round(strong.r * 100)}%. Используйте её как «якорь»: после неё запускайте слабую привычку.` });
  if (longest && longest.st.best >= 7) out.push({ icon: 'bolt', title: 'Рекорд стрика', text: `«${longest.h.name}» — ${longest.st.best} дней подряд. Текущий: ${longest.st.cur}. Цель — превзойти рекорд.` });
  if (cat[0] && cat.length > 1) out.push({ icon: 'sliders', title: 'Баланс сфер', text: `Сильнее всего ${cat[0].c.name.toLowerCase()} (${Math.round(cat[0].r * 100)}%), слабее — ${cat[cat.length - 1].c.name.toLowerCase()} (${Math.round(cat[cat.length - 1].r * 100)}%).` });
  if (unusedCat) out.push({ icon: 'palette', title: 'Слепая зона', text: `Категория «${unusedCat.name}» не задействована. Одна привычка там добавит жизни баланса.` });
  let bestRun = 0, run = 0;
  perDay.forEach((d) => { if (d.rate === 1) { run++; bestRun = Math.max(bestRun, run); } else run = 0; });
  if (bestRun >= 2) out.push({ icon: 'spark', title: 'Серия идеальных дней', text: `${bestRun} дней со 100% выполнением подряд. Это ваш эталон — держите его в голове в тяжёлые дни.` });
  return out;
}

export default function ReportsPage() {
  const { state, ready } = useHv();
  const router = useRouter();
  const [range, setRange] = useState(30);
  const trendRef = useRef<HTMLCanvasElement>(null);
  const donutRef = useRef<HTMLCanvasElement>(null);
  const dowRef = useRef<HTMLCanvasElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);

  const m = useMemo(() => {
    const t = D.today();
    const habits = visibleHabits(state);
    const keys = D.daysBetween(D.add(t, -(range - 1)), t);
    const perDay = perDayOf(state, habits, keys);
    const valid = perDay.filter((d): d is PerDay & { rate: number } => d.rate !== null);
    const overall = valid.length ? avg(valid.map((d) => d.rate)) : 0;
    const prevKeys = D.daysBetween(D.add(t, -(2 * range - 1)), D.add(t, -range));
    const prevValid = perDayOf(state, habits, prevKeys).filter((d): d is PerDay & { rate: number } => d.rate !== null);
    const prev = prevValid.length ? avg(prevValid.map((d) => d.rate)) : 0;
    const delta = prev ? Math.round(((overall - prev) / prev) * 100) : (overall ? 100 : 0);

    const totalDone = sum(perDay.map((d) => d.done));
    const totalMissed = sum(perDay.map((d) => d.due - d.done));
    const skipped = keys.reduce((n, k) => n + habits.filter((h) => logAt(state, h.id, k)?.status === 'skip').length, 0);
    const streaks = habits.map((h) => streakOf(state, h, undefined, { persist: false }));
    const bestStreak = Math.max(0, ...streaks.map((x) => x.best));
    const curStreak = Math.max(0, ...streaks.map((x) => x.cur));
    const perfectDays = perDay.filter((d) => d.rate === 1).length;

    const dowStats: DowStat[] = [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const ks = keys.filter((k) => D.dow(k) === i);
      let due = 0, done = 0;
      ks.forEach((k) => habits.forEach((h) => { if (dueOn(h, k)) { due++; if (isDone(state, h.id, k)) done++; } }));
      return { due, done };
    });

    const radarCats: RadarCat[] = CATEGORIES.map((c) => {
      const hs = habits.filter((h) => h.cat === c.id);
      const rs = hs.map((h) => rateOf(state, h, range)).filter((v): v is number => v !== null);
      return { name: c.name, color: c.color, n: hs.length, v: rs.length ? avg(rs) : 0 };
    });

    const bars = habits.map((h) => ({ h, r: rateOf(state, h, range) })).filter((x): x is { h: Habit; r: number } => x.r !== null).sort((a, b) => b.r - a.r);
    const streakRows = habits.map((h) => ({ h, s: streakOf(state, h, undefined, { persist: false }) })).sort((a, b) => b.s.cur - a.s.cur);
    const insights = buildInsights(state, habits, range, perDay);

    return { t, habits, keys, perDay, overall, delta, totalDone, totalMissed, skipped, bestStreak, curStreak, perfectDays, dowStats, radarCats, bars, streakRows, insights };
  }, [state, range]);

  /* отрисовка чартов (клиент, после гидратации) + перерисовка при resize/смене темы */
  useEffect(() => {
    if (!ready) return;
    const draw = (): void => {
      drawTrend(trendRef.current, m.perDay.map((d) => ({ k: d.k, rate: d.rate }) as TrendPoint));
      drawDonut(donutRef.current, { done: m.totalDone, skipped: m.skipped, missed: Math.max(0, m.totalMissed - m.skipped) });
      drawDow(dowRef.current, m.dowStats, D.dow(D.today()));
      drawRadar(radarRef.current, m.radarCats);
    };
    draw();
    let tm: ReturnType<typeof setTimeout> | undefined;
    const onResize = (): void => { clearTimeout(tm); tm = setTimeout(draw, 180); };
    window.addEventListener('resize', onResize);
    const mo = new MutationObserver(() => draw());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
    return () => { window.removeEventListener('resize', onResize); clearTimeout(tm); mo.disconnect(); };
  }, [ready, m, range]);

  const kpi = (icon: string, val: React.ReactNode, lab: string, delta?: { text: string; color: string; arrow?: boolean }): React.ReactNode => (
    <div className="kpi" key={lab}>
      <div className="kpi-ic"><Icon name={icon} size={15} /></div>
      <div className="kpi-val mono">{val}</div>
      <div className="kpi-lab">{lab}</div>
      {delta ? <div className="kpi-delta" style={{ color: delta.color, display: 'flex', alignItems: 'center', gap: 4 }}>
        {delta.arrow ? (
          <span style={{ display: 'inline-flex', transform: delta.text.startsWith('−') ? 'scaleY(-1)' : undefined }}><Icon name="trend" size={12} /></span>
        ) : null}
        {delta.text}
      </div> : null}
    </div>
  );

  const donutLegend: Array<[string, string, number]> = [
    [cssVarSafe('--ok', '#5F8A6B'), 'Выполнено', m.totalDone],
    [cssVarSafe('--warn', '#A9853F'), 'Пропущено осознанно', m.skipped],
    [cssVarSafe('--bad', '#B0574F'), 'Провалено', Math.max(0, m.totalMissed - m.skipped)],
  ];

  return (
    <>
      <PageHead
        title="Отчёты"
        sub={ready ? `Период: ${m.keys.length} дней · ${m.habits.length} привычек` : 'Загрузка…'}
        crumbs={[{ name: 'Отчёты' }]}
        actions={<>
          <button className="btn" onClick={() => hv.exportCsv()} disabled={!ready}>
            <Icon name="download" size={14} /> CSV
          </button>
          <button className="btn" onClick={() => window.print()}>
            <Icon name="print" size={14} /> Печать
          </button>
        </>}
      />

      <section className="page active">
        {!ready ? (
          <div className="empty card"><span className="em"><Icon name="chart" size={30} /></span><h3>Загружаем данные…</h3></div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {RANGES.map((n) => (
                <button key={n} className={`chip ${range === n ? 'on' : ''}`} onClick={() => setRange(n)}>
                  {n === 365 ? 'Год' : `${n} дн`}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <span className="xs faint">сравнение с предыдущими {range} днями</span>
            </div>

            <div className="kpis">
              {kpi('trend', `${Math.round(m.overall * 100)}%`, 'выполнение', {
                text: m.delta >= 0 ? `+${m.delta}% к прошлому периоду` : `−${Math.abs(m.delta)}% к прошлому периоду`,
                color: m.delta >= 0 ? 'var(--ok)' : 'var(--bad)',
                arrow: true,
              })}
              {kpi('bolt', m.curStreak, 'текущий стрик', { text: `рекорд: ${m.bestStreak} дн.`, color: 'var(--text-3)' })}
              {kpi('check', m.totalDone, 'отметок', { text: `${m.totalMissed} пропущено`, color: 'var(--text-3)' })}
              {kpi('spark', m.perfectDays, 'идеальных дней', { text: `${Math.round((m.perfectDays / Math.max(1, m.keys.length)) * 100)}% периода`, color: 'var(--text-3)' })}
              {kpi('target', m.habits.length, 'привычек', { text: `${new Set(m.habits.map((h) => h.cat)).size} категорий`, color: 'var(--text-3)' })}
            </div>

            <div className="grid g2" style={{ marginBottom: 14 }}>
              <div className="card chart-box">
                <div className="card-h"><h3>Динамика выполнения</h3><div className="sp" /><span className="xs faint">{range} дней</span></div>
                <canvas ref={trendRef} height={230} />
                <div className="legend">
                  <span><i style={{ background: 'var(--acc)' }} />% выполнения</span>
                  <span><i style={{ background: 'var(--info)' }} />скользящее среднее (7)</span>
                </div>
              </div>
              <div className="card chart-box">
                <div className="card-h"><h3>Статусы отметок</h3><div className="sp" /></div>
                <canvas ref={donutRef} height={230} />
                <div className="legend">
                  {donutLegend.map(([c, lab, v]) => <span key={lab}><i style={{ background: c }} />{lab}: <b>{v}</b></span>)}
                </div>
              </div>
            </div>

            <div className="grid g2" style={{ marginBottom: 14 }}>
              <div className="card">
                <div className="card-h"><h3>Привычки: рейтинг выполнения</h3><div className="sp" /><span className="xs faint">{range} дн.</span></div>
                {m.bars.length ? m.bars.map(({ h, r }) => (
                  <div className="bar-row" key={h.id}>
                    <div className="bar-name" title={h.name}>{h.emoji} {h.name}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ ['--bc' as string]: h.color, width: `${Math.round(r * 100)}%` }} /></div>
                    <div className="bar-val">{Math.round(r * 100)}%</div>
                  </div>
                )) : <p className="small muted">За период не было запланированных дней.</p>}
              </div>
              <div className="card chart-box">
                <div className="card-h"><h3>Активность по дням недели</h3></div>
                <canvas ref={dowRef} height={220} />
                <div className="legend">
                  <span><i style={{ background: 'var(--ok)' }} />выполнено</span>
                  <span><i style={{ background: 'var(--border-strong)' }} />запланировано</span>
                </div>
              </div>
            </div>

            <div className="grid g2" style={{ marginBottom: 14 }}>
              <div className="card chart-box">
                <div className="card-h"><h3>Баланс сфер жизни</h3><div className="sp" /><span className="xs faint">радар по категориям</span></div>
                <canvas ref={radarRef} height={260} />
              </div>
              <div className="card">
                <div className="card-h"><h3>Стрики по привычкам</h3><div className="sp" /><span className="xs faint">текущий / рекорд</span></div>
                {m.streakRows.length ? m.streakRows.map(({ h, s }) => (
                  <div className="bar-row" key={h.id}>
                    <div className="bar-name">{h.emoji} {h.name}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ ['--bc' as string]: h.color, width: `${clamp((s.cur / Math.max(1, s.best)) * 100, 3, 100)}%` }} /></div>
                    <div className="bar-val">{s.cur} / {s.best}</div>
                  </div>
                )) : <p className="small muted">Нет привычек.</p>}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-h"><h3>Карта года</h3><div className="sp" /><span className="xs faint">клик по ячейке — открыть день в календаре</span></div>
              <YearHeatmap state={state} onPick={(k) => router.push(`/calendar?month=${k.slice(0, 7)}&day=${k}`)} />
            </div>

            <div className="section-title"><h2>Инсайты</h2><div className="line" /></div>
            <div className="grid g2">
              {m.insights.map((ins, i) => (
                <div className="card" key={i}>
                  <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
                    <span className="ins-ic"><Icon name={ins.icon} size={16} /></span>
                    <div>
                      <b style={{ fontSize: 14 }}>{ins.title}</b>
                      <p className="small muted" style={{ marginTop: 5, lineHeight: 1.55 }}>{ins.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

/* cssVar для.legend во время рендера (SSR-безопасно: фолбэк без document). */
function cssVarSafe(name: string, fallback: string): string {
  return cssVar(name, fallback);
}
