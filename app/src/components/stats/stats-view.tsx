'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D } from '@/lib/dates';
import { CATEGORIES, levelOf } from '@/lib/constants';
import { buildInsights, dailyRates, heatmapValues, rateOf, streakOf, totalsFor, weekdayStats, type LogMap } from '@/lib/stats';
import { listAchievements } from '@/lib/actions';
import { Button, Card, CardHead, Chip, Pill } from '@/components/ui/primitives';
import { DonutChart, RadarChart, Rise, TrendChart, WeekdayChart } from './charts';
import { Heatmap } from '@/components/calendar/heatmap';
import type { Achievement, Habit, Profile, UserAchievement } from '@/types/database';

const RANGES = [7, 30, 90, 180, 365];

export function StatsView({
  habits,
  logs,
  profile,
  achievements,
  unlocked,
}: {
  habits: Habit[];
  logs: LogMap;
  profile: Profile | null;
  achievements: Achievement[];
  unlocked: UserAchievement[];
}) {
  const router = useRouter();
  const [range, setRange] = useState(30);
  const active = habits.filter((h) => !h.archived);
  const days = useMemo(() => D.range(D.add(D.today(), -(range - 1)), D.today()), [range]);
  const prevDays = useMemo(() => D.range(D.add(D.today(), -(range * 2 - 1)), D.add(D.today(), -range)), [range]);

  const t = totalsFor(active, logs, days);
  const p = totalsFor(active, logs, prevDays);
  const delta = p.overall ? Math.round(((t.overall - p.overall) / p.overall) * 100) : t.overall ? 100 : 0;
  const ws = weekdayStats(active, logs, days);
  const lv = levelOf(profile?.xp ?? 0);
  const unlockedSet = new Set(unlocked.map((u) => u.achievement_id));
  const achList = achievements.length ? achievements : [];

  const insights = useMemo(() => buildInsights(active, logs, days, CATEGORIES), [active, logs, days]);

  const ranked = active
    .map((h) => ({ h, r: rateOf(h, logs, range) }))
    .filter((x) => x.r !== null)
    .sort((a, b) => (b.r as number) - (a.r as number)) as { h: Habit; r: number }[];

  const radar = CATEGORIES.map((c) => {
    const hs = active.filter((h) => h.category === c.id);
    const rs = hs.map((h) => rateOf(h, logs, range)).filter((v): v is number => v !== null);
    return { label: `${c.emoji} ${c.name}`, value: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0, count: hs.length, color: c.color };
  });

  const exportCsv = () => {
    const rows = [['date', 'habit', 'emoji', 'category', 'status', 'value', 'unit', 'note']];
    habits.forEach((h) => {
      Object.entries(logs[h.id] ?? {}).forEach(([k, l]) => {
        rows.push([k, h.name, h.emoji, h.category, l.status, String(l.value ?? ''), h.target_unit, (l.note ?? '').replace(/[\n;]/g, ' ')]);
      });
    });
    rows.sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitverse-${D.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV выгружен');
  };

  const refreshAch = async () => {
    const r = await listAchievements();
    void r;
    router.refresh();
  };

  const K = (icon: string, val: string | number, lab: string, sub?: string, color?: string) => (
    <div className="relative overflow-hidden p-4 rounded-[var(--r-lg)] bg-[var(--card)] border border-[var(--stroke)] hover:-translate-y-1 hover:border-[var(--stroke2)] hover:shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)] transition-all duration-300">
      <div className="absolute inset-0 opacity-50" style={{ background: `radial-gradient(120% 80% at 100% 0%, ${color ?? 'var(--acc)'}33, transparent 60%)` }} />
      <div className="relative text-xl">{icon}</div>
      <div className="relative text-[31px] font-extrabold tracking-[-.04em] leading-tight mt-1.5 tabular">{val}</div>
      <div className="relative text-[11px] text-[var(--muted)] uppercase tracking-[.1em] mt-0.5">{lab}</div>
      {sub && <div className="relative text-[11.5px] font-extrabold mt-1.5" style={{ color: delta >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{sub}</div>}
    </div>
  );

  return (
    <div className="p-4 lg:p-7">
      <div className="flex gap-2 items-center flex-wrap mb-4">
        {RANGES.map((r) => (
          <Chip key={r} active={range === r} onClick={() => setRange(r)}>{r === 365 ? 'Год' : `${r} дн`}</Chip>
        ))}
        <div className="flex-1" />
        <Button size="sm" onClick={exportCsv}>⬇ CSV</Button>
        <Button size="sm" onClick={() => window.print()}>🖨 Печать</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {K('📈', `${Math.round(t.overall * 100)}%`, 'выполнение', delta ? `${delta >= 0 ? '▲ +' : '▼ '}${delta}% к прошлому периоду` : undefined)}
        {K('🔥', t.bestCur, 'текущий стрик', `рекорд: ${t.bestEver} дн.`, 'var(--warn)')}
        {K('✅', t.done, 'отметок', `${t.missed} пропущено`, 'var(--ok)')}
        {K('🌟', t.perfectDays, 'идеальных дней', `${Math.round((t.perfectDays / Math.max(1, days.length)) * 100)}% периода`, 'var(--acc3)')}
        {K('🎚️', `Lv ${lv.level}`, 'уровень', `${lv.into}/${lv.need} XP · всего ${profile?.xp ?? 0}`, 'var(--acc2)')}
        {K('🎯', active.length, 'привычек', `${new Set(active.map((h) => h.category)).size} категорий`)}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHead title="Динамика выполнения" right={<span className="text-[11.5px] text-[var(--faint)]">{range} дней</span>} />
          <TrendChart values={t.rates.map((r) => r.rate)} labels={t.rates.map((r) => { const d = D.parse(r.key); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; })} />
          <div className="flex gap-3.5 mt-3 flex-wrap text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] block bg-[var(--acc)]" />% выполнения</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] block bg-[var(--acc2)]" />скользящее среднее (7)</span>
          </div>
        </Card>

        <Card>
          <CardHead title="Статусы отметок" />
          <DonutChart parts={[
            { label: 'Выполнено', value: t.done, color: 'var(--ok)' },
            { label: 'Пропущено осознанно', value: t.skipped, color: 'var(--warn)' },
            { label: 'Провалено', value: Math.max(0, t.missed - t.skipped), color: 'var(--bad)' },
          ]} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHead title="Рейтинг привычек" right={<span className="text-[11.5px] text-[var(--faint)]">{range} дн.</span>} />
          {ranked.length ? ranked.map(({ h, r }) => (
            <div key={h.id} className="grid grid-cols-[minmax(0,150px)_1fr_54px] gap-3 items-center mb-2.5 last:mb-0">
              <div className="text-[13px] font-semibold truncate" title={h.name}>{h.emoji} {h.name}</div>
              <div className="h-2.5 rounded-full bg-[var(--stroke)] overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.round(r * 100)}%`, background: h.color, boxShadow: `0 0 12px -2px ${h.color}` }} />
              </div>
              <div className="text-[12.5px] font-extrabold text-right text-[var(--muted)] tabular">{Math.round(r * 100)}%</div>
            </div>
          )) : <p className="text-sm text-[var(--muted)]">За период не было запланированных дней.</p>}
        </Card>

        <Card>
          <CardHead title="Активность по дням недели" />
          <WeekdayChart data={ws} />
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHead title="Баланс сфер жизни" sub="радар по категориям" />
          <RadarChart axes={radar} />
        </Card>
        <Card>
          <CardHead title="Стрики" sub="текущий / рекорд" />
          {active.length ? active
            .map((h) => ({ h, s: streakOf(h, logs) }))
            .sort((a, b) => b.s.cur - a.s.cur)
            .map(({ h, s }) => (
              <div key={h.id} className="grid grid-cols-[minmax(0,150px)_1fr_64px] gap-3 items-center mb-2.5 last:mb-0">
                <div className="text-[13px] font-semibold truncate">{h.emoji} {h.name}</div>
                <div className="h-2.5 rounded-full bg-[var(--stroke)] overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${Math.min(100, Math.max(3, (s.cur / Math.max(1, s.best)) * 100))}%`, background: h.color }} />
                </div>
                <div className="text-[12.5px] font-extrabold text-right text-[var(--muted)] tabular">{s.cur} / {s.best}</div>
              </div>
            )) : <p className="text-sm text-[var(--muted)]">Нет привычек.</p>}
        </Card>
      </div>

      <Card className="mb-4">
        <CardHead title="Карта года" sub="клик по ячейке — открыть месяц" />
        <Heatmap values={heatmapValues(active, logs, D.add(D.today(), -364), D.today())} onPick={(k) => router.push(`/calendar?m=${k.slice(0, 7)}&d=${k}`)} />
      </Card>

      <Rise>
        <div className="flex items-center gap-3 my-6">
          <h2 className="text-lg font-bold tracking-tight">Достижения</h2>
          <span className="flex-1 h-px bg-[linear-gradient(90deg,var(--stroke),transparent)]" />
          <Pill tone={unlockedSet.size === achList.length && achList.length > 0 ? 'ok' : 'none'}>{unlockedSet.size} / {achList.length || 20}</Pill>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {(achList.length ? achList : []).map((a) => {
            const got = unlockedSet.has(a.id);
            return (
              <div key={a.id} className={cn('relative overflow-hidden p-4 rounded-[var(--r)] text-center border transition-all duration-300 hover:-translate-y-1', got ? 'border-[color-mix(in_oklab,var(--warn)_45%,transparent)] bg-[color-mix(in_oklab,var(--warn)_8%,var(--card))]' : 'border-[var(--stroke)] bg-[var(--card)]')} onClick={() => void refreshAch()}>
                <span className={cn('text-[31px] block transition-all', got ? 'hv-pop' : 'grayscale opacity-40')}>{a.emoji}</span>
                <b className="block text-[12.8px] mt-2">{a.name}</b>
                <span className="block text-[11px] text-[var(--faint)] mt-1 leading-snug">{a.description}</span>
                {got && <span className="absolute inset-0 pointer-events-none bg-[linear-gradient(120deg,transparent_35%,rgba(255,255,255,.16),transparent_65%)] animate-[hv-shimmer_3.4s_linear_infinite]" />}
              </div>
            );
          })}
        </div>
      </Rise>

      <div className="flex items-center gap-3 my-6">
        <h2 className="text-lg font-bold tracking-tight">Инсайты</h2>
        <span className="flex-1 h-px bg-[linear-gradient(90deg,var(--stroke),transparent)]" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {insights.map((ins, i) => (
          <Rise key={ins.title} delay={i * 0.05}>
            <Card className="h-full">
              <div className="flex gap-3 items-start">
                <span className="text-[22px]">{ins.icon}</span>
                <div>
                  <b className="text-sm">{ins.title}</b>
                  <p className="text-[13px] text-[var(--muted)] mt-1.5 leading-relaxed">{ins.text}</p>
                </div>
              </div>
            </Card>
          </Rise>
        ))}
      </div>
    </div>
  );
}
