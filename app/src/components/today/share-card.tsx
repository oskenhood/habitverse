'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { D, WD } from '@/lib/dates';
import { dueOn } from '@/lib/schedule';
import { levelOf } from '@/lib/constants';
import { isDone, rateOf, streakOf, type LogMap } from '@/lib/stats';
import { Button } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/overlays';
import type { Habit, Profile } from '@/types/database';

const W = 1080;
const H = 1080;

const css = (v: string, fb: string) =>
  typeof window === 'undefined' ? fb : getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb;

const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (c.roundRect) {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
};

/** Рисуем карточку 1080×1080 — формат, который не режется в сторис и соцсетях */
function draw(c: CanvasRenderingContext2D, kind: 'habit' | 'week', data: { habit?: Habit; logs: LogMap; habits: Habit[]; profile: Profile | null }) {
  const { logs, habits, profile } = data;
  const acc = css('--acc', '#7c5cff');
  const acc2 = css('--acc2', '#00e5c3');
  const acc3 = css('--acc3', '#ff5c8a');
  const text = css('--text', '#eef0ff');
  const muted = css('--muted', '#9aa0c3');

  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#12142a');
  bg.addColorStop(1, '#07080f');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  const glow = (x: number, y: number, r: number, col: string, a: number) => {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col);
    g.addColorStop(1, 'transparent');
    c.globalAlpha = a;
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 1;
  };
  glow(W * 0.85, H * 0.1, 460, acc, 0.34);
  glow(W * 0.1, H * 0.95, 420, acc3, 0.22);
  glow(W * 0.5, H * 0.5, 380, acc2, 0.1);

  c.strokeStyle = 'rgba(255,255,255,.14)';
  c.lineWidth = 3;
  roundRect(c, 28, 28, W - 56, H - 56, 44);
  c.stroke();

  const cx = W / 2;
  c.textAlign = 'center';
  const lv = levelOf(profile?.xp ?? 0);

  const cell = (x: number, y: number, w: number, h: number, value: string, label: string) => {
    c.fillStyle = 'rgba(255,255,255,.06)';
    roundRect(c, x, y, w, h, 26);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.12)';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = text;
    c.font = '800 46px system-ui, sans-serif';
    c.fillText(value, x + w / 2, y + h / 2 + 6);
    c.fillStyle = muted;
    c.font = '600 19px system-ui, sans-serif';
    c.fillText(label.toUpperCase(), x + w / 2, y + h - 22);
  };

  if (kind === 'habit' && data.habit) {
    const h = data.habit;
    const st = streakOf(h, logs);
    const r30 = rateOf(h, logs, 30);

    c.font = '150px serif';
    c.fillText(h.emoji, cx, 265);
    c.fillStyle = text;
    c.font = '800 54px system-ui, sans-serif';
    c.fillText(h.name.length > 26 ? `${h.name.slice(0, 25)}…` : h.name, cx, 355);
    c.fillStyle = muted;
    c.font = '600 26px system-ui, sans-serif';
    c.fillText(st.weekly ? 'НЕДЕЛЬ ПОДРЯД' : 'ДНЕЙ ПОДРЯД', cx, 405);

    c.fillStyle = h.color || acc;
    c.font = '900 210px system-ui, sans-serif';
    c.shadowColor = h.color || acc;
    c.shadowBlur = 60;
    c.fillText(String(st.cur), cx, 610);
    c.shadowBlur = 0;

    const cw = 250;
    const gap = 22;
    const x0 = cx - (3 * cw + 2 * gap) / 2;
    cell(x0, 680, cw, 130, String(st.best), 'рекорд');
    cell(x0 + cw + gap, 680, cw, 130, r30 === null ? '—' : `${Math.round(r30 * 100)}%`, '30 дней');
    cell(x0 + 2 * (cw + gap), 680, cw, 130, String(lv.level), 'уровень');

    const t = D.today();
    const bw = 46;
    for (let i = 13; i >= 0; i -= 1) {
      const key = D.add(t, -i);
      const ok = isDone(logs, h.id, key);
      const planned = dueOn(h, key);
      const x = cx - (14 * bw + 13 * 8) / 2 + (13 - i) * (bw + 8);
      c.fillStyle = ok ? h.color || acc : planned ? 'rgba(255,90,110,.55)' : 'rgba(255,255,255,.08)';
      roundRect(c, x, 850, bw, 46, 12);
      c.fill();
    }
  } else {
    const t = D.today();
    const keys = D.range(D.add(t, -6), t);
    const active = habits.filter((h) => !h.archived);
    let due = 0;
    let done = 0;
    const perDay: { k: string; d: number; n: number }[] = [];
    keys.forEach((k) => {
      let d = 0;
      let n = 0;
      active.forEach((h) => {
        if (dueOn(h, k)) {
          d += 1;
          if (isDone(logs, h.id, k)) n += 1;
        }
      });
      due += d;
      done += n;
      perDay.push({ k, d, n });
    });

    c.fillStyle = text;
    c.font = '800 60px system-ui, sans-serif';
    c.fillText('МОЯ НЕДЕЛЯ', cx, 210);
    c.fillStyle = muted;
    c.font = '600 26px system-ui, sans-serif';
    c.fillText(`${D.human(keys[0]).toUpperCase()} — ${D.human(keys[keys.length - 1]).toUpperCase()}`, cx, 258);

    c.fillStyle = acc2;
    c.font = '900 200px system-ui, sans-serif';
    c.shadowColor = acc2;
    c.shadowBlur = 60;
    c.fillText(`${due ? Math.round((done / due) * 100) : 0}%`, cx, 480);
    c.shadowBlur = 0;
    c.fillStyle = muted;
    c.font = '600 26px system-ui, sans-serif';
    c.fillText(`${done} ИЗ ${due} ОТМЕТОК`, cx, 528);

    const best = active.length ? Math.max(...active.map((h) => streakOf(h, logs).cur)) : 0;
    const cw = 250;
    const gap = 22;
    const x0 = cx - (3 * cw + 2 * gap) / 2;
    cell(x0, 600, cw, 130, `${best}🔥`, 'лучший стрик');
    cell(x0 + cw + gap, 600, cw, 130, String(active.length), 'привычек');
    cell(x0 + 2 * (cw + gap), 600, cw, 130, String(lv.level), 'уровень');

    perDay.forEach((d, i) => {
      const bw = 108;
      const x = cx - (7 * bw + 6 * 14) / 2 + i * (bw + 14);
      const rate = d.d ? d.n / d.d : 0;
      c.fillStyle = 'rgba(255,255,255,.07)';
      roundRect(c, x, 780, bw, 120, 18);
      c.fill();
      c.fillStyle = rate >= 1 ? acc2 : rate > 0 ? acc : 'rgba(255,90,110,.5)';
      const hh = Math.max(6, 112 * rate);
      roundRect(c, x + 8, 780 + 120 - hh - 4, bw - 16, hh, 12);
      c.fill();
      c.fillStyle = muted;
      c.font = '700 20px system-ui, sans-serif';
      c.fillText(WD[D.dow(d.k)], x + bw / 2, 934);
    });
  }

  c.fillStyle = muted;
  c.font = '600 24px system-ui, sans-serif';
  c.fillText(`◈ HabitVerse · ${profile?.display_name || 'Пилот'} · ${D.today()}`, cx, 1000);
  c.textAlign = 'left';
}

export function shareText(
  kind: 'habit' | 'week',
  data: { habit?: Habit; logs: LogMap; habits: Habit[]; profile: Profile | null },
): string {
  const name = data.profile?.display_name || 'HabitVerse';
  if (kind === 'habit' && data.habit) {
    const h = data.habit;
    const st = streakOf(h, data.logs);
    const r30 = rateOf(h, data.logs, 30);
    return `${h.emoji} ${h.name}\n🔥 ${st.cur}${st.weekly ? ' недель' : ' дней'} подряд (рекорд ${st.best})\n📈 ${r30 === null ? '—' : `${Math.round(r30 * 100)}%`} за 30 дней\n— ${name}`;
  }
  const t = D.today();
  const keys = D.range(D.add(t, -6), t);
  const active = data.habits.filter((h) => !h.archived);
  let due = 0;
  let done = 0;
  keys.forEach((k) => active.forEach((h) => { if (dueOn(h, k)) { due += 1; if (isDone(data.logs, h.id, k)) done += 1; } }));
  const best = active.length ? Math.max(...active.map((h) => streakOf(h, data.logs).cur)) : 0;
  return `📊 Моя неделя в HabitVerse\n✅ ${done} из ${due} отметок (${due ? Math.round((done / due) * 100) : 0}%)\n🔥 лучший стрик: ${best}\n⚡ уровень ${levelOf(data.profile?.xp ?? 0).level} · ${data.profile?.xp ?? 0} XP\n— ${name}`;
}

export function ShareSheet({
  open,
  onClose,
  kind,
  habit,
  logs,
  habits,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  kind: 'habit' | 'week';
  habit?: Habit | null;
  logs: LogMap;
  habits: Habit[];
  profile: Profile | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [txt, setTxt] = useState('');

  useEffect(() => {
    if (!open) return;
    const c = ref.current?.getContext('2d');
    if (c) draw(c, kind, { habit: habit ?? undefined, logs, habits, profile });
    setTxt(shareText(kind, { habit: habit ?? undefined, logs, habits, profile }));
  }, [open, kind, habit, logs, habits, profile]);

  const download = () => {
    const cv = ref.current;
    if (!cv) return;
    try {
      const a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = `habitverse-${kind}-${D.today()}.png`;
      a.click();
      toast.success('PNG сохранён');
    } catch {
      toast.error('Не удалось сохранить PNG');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(txt);
      toast.success('Текст скопирован');
    } catch {
      toast.info(txt, { duration: 8000 });
    }
  };

  const nativeShare = async () => {
    const cv = ref.current;
    if (!cv) return;
    try {
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'));
      if (blob && navigator.canShare?.({ files: [new File([blob], 'habitverse.png', { type: 'image/png' })] })) {
        await navigator.share({ files: [new File([blob], 'habitverse.png', { type: 'image/png' })], text: txt });
      } else {
        await navigator.share({ text: txt });
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') toast.error('Не удалось поделиться');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} icon="📤" title={kind === 'habit' ? 'Карточка привычки' : 'Карточка недели'}>
      <canvas ref={ref} width={W} height={H} className="w-full rounded-[18px] border border-[var(--stroke)] block" />
      <div className="flex flex-wrap gap-2 mt-3.5">
        <Button variant="primary" size="sm" onClick={download}>⬇ Скачать PNG</Button>
        <Button size="sm" onClick={() => void copy()}>📋 Скопировать текст</Button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <Button size="sm" onClick={() => void nativeShare()}>📲 Поделиться</Button>
        )}
      </div>
      <div className="h-px bg-[var(--stroke)] my-4" />
      <div className="glass rounded-[var(--r)] p-3.5">
        <div className="text-[10.5px] text-[var(--faint)] uppercase tracking-[.08em] mb-2">Текст карточки</div>
        <pre className="whitespace-pre-wrap m-0 text-[13px] leading-relaxed font-sans">{txt}</pre>
      </div>
    </Sheet>
  );
}
