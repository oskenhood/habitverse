'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const css = (v: string, fb: string) => (typeof window === 'undefined' ? fb : getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fb);

function useCanvas(h: number) {
  const ref = useRef<HTMLCanvasElement>(null);
  const setup = () => {
    const cv = ref.current;
    if (!cv) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (cv.parentElement?.clientWidth ?? 600) - 0;
    cv.style.width = '100%';
    cv.style.height = `${h}px`;
    cv.width = w * dpr;
    cv.height = h * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w };
  };
  return { ref, setup };
}

function animate(dur: number, fn: (p: number) => void) {
  const t0 = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    fn(1 - Math.pow(1 - p, 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ------------------------- Линия динамики ------------------------- */
export function TrendChart({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const { ref, setup } = useCanvas(230);

  useEffect(() => {
    const s = setup();
    if (!s) return;
    const { ctx, w } = s;
    const h = 230;
    const padL = 36;
    const padB = 24;
    const padT = 12;
    const padR = 8;
    const iw = w - padL - padR;
    const ih = h - padT - padB;
    const acc = css('--acc', '#7c5cff');
    const acc2 = css('--acc2', '#00e5c3');
    const stroke = css('--stroke', '#ffffff17');
    const faint = css('--faint', '#6b7199');
    const ok = css('--ok', '#3ddc97');

    animate(900, (p) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = '10px system-ui';
      for (let i = 0; i <= 4; i += 1) {
        const y = padT + (ih * i) / 4;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillStyle = faint;
        ctx.fillText(`${100 - i * 25}%`, 4, y + 3.5);
      }
      const n = values.length;
      if (!n) return;
      const X = (i: number) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
      const Y = (v: number | null) => padT + ih * (1 - (v ?? 0));

      const first = values.findIndex((v) => v !== null);
      const lastIdx = values.reduce<number>((a, v, i) => (v !== null ? i : a), 0);

      const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, `${acc}aa`);
      grad.addColorStop(1, `${acc}00`);
      ctx.beginPath();
      let started = false;
      values.forEach((v, i) => {
        if (v === null) return;
        const y = Y(v * p);
        if (!started) { ctx.moveTo(X(i), y); started = true; } else ctx.lineTo(X(i), y);
      });
      if (started) {
        ctx.lineTo(X(lastIdx), h - padB);
        ctx.lineTo(X(Math.max(0, first)), h - padB);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      started = false;
      values.forEach((v, i) => {
        if (v === null) return;
        const y = Y(v * p);
        if (!started) { ctx.moveTo(X(i), y); started = true; } else ctx.lineTo(X(i), y);
      });
      ctx.strokeStyle = acc;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.shadowColor = acc;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const ma = values.map((_, i) => {
        const slice = values.slice(Math.max(0, i - 6), i + 1).filter((v): v is number => v !== null);
        return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
      });
      ctx.beginPath();
      started = false;
      ma.forEach((v, i) => {
        if (v === null) return;
        const y = Y(v * p);
        if (!started) { ctx.moveTo(X(i), y); started = true; } else ctx.lineTo(X(i), y);
      });
      ctx.strokeStyle = acc2;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      const skip = n > 60 ? Math.ceil(n / 60) : 1;
      values.forEach((v, i) => {
        if (v === null || i % skip) return;
        ctx.beginPath();
        ctx.arc(X(i), Y(v * p), v === 1 ? 3.4 : 2.2, 0, 6.284);
        ctx.fillStyle = v === 1 ? ok : acc;
        ctx.fill();
      });

      ctx.fillStyle = faint;
      ctx.textAlign = 'center';
      const stepX = Math.max(1, Math.floor(n / 7));
      for (let i = 0; i < n; i += stepX) ctx.fillText(labels[i] ?? '', X(i), h - 7);
      ctx.textAlign = 'left';
    });
  });

  return <canvas ref={ref} />;
}

/* ---------------------------- Пончик ------------------------------ */
export function DonutChart({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const { ref, setup } = useCanvas(220);
  const total = parts.reduce((a, p) => a + p.value, 0);

  useEffect(() => {
    const s = setup();
    if (!s) return;
    const { ctx, w } = s;
    const h = 220;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) / 2 - 16;
    const r = R * 0.62;
    animate(850, (p) => {
      ctx.clearRect(0, 0, w, h);
      if (!total) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 6.284);
        ctx.arc(cx, cy, r, 0, 6.284, true);
        ctx.fillStyle = css('--stroke', '#ffffff17');
        ctx.fill();
        ctx.fillStyle = css('--faint', '#6b7199');
        ctx.font = '600 13px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('нет данных', cx, cy + 4);
        ctx.textAlign = 'left';
        return;
      }
      let a0 = -Math.PI / 2;
      parts.forEach((pt) => {
        if (!pt.value) return;
        const a1 = a0 + (pt.value / total) * 6.2832 * p;
        ctx.beginPath();
        ctx.arc(cx, cy, R, a0, a1);
        ctx.arc(cx, cy, r, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = pt.color;
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
        a0 = a1;
      });
      const done = parts[0]?.value ?? 0;
      ctx.fillStyle = css('--text', '#fff');
      ctx.font = '800 26px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round((done / total) * 100)}%`, cx, cy + 2);
      ctx.font = '600 11px system-ui';
      ctx.fillStyle = css('--muted', '#9aa0c3');
      ctx.fillText('успех', cx, cy + 18);
      ctx.textAlign = 'left';
    });
  });

  return (
    <div>
      <canvas ref={ref} />
      <div className="flex flex-wrap gap-3.5 mt-3">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <i className="w-2.5 h-2.5 rounded-[3px] block" style={{ background: p.color }} />
            {p.label}: <b className="text-[var(--text)]">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Столбцы по дням ------------------------ */
export function WeekdayChart({ data }: { data: { dow: number; due: number; done: number }[] }) {
  const { ref, setup } = useCanvas(220);
  const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const max = Math.max(1, ...data.map((d) => d.due));

  useEffect(() => {
    const s = setup();
    if (!s) return;
    const { ctx, w } = s;
    const h = 220;
    const padL = 30;
    const padB = 26;
    const padT = 14;
    const iw = w - padL - 10;
    const ih = h - padT - padB;
    const bw = (iw / 7) * 0.58;
    const stroke = css('--stroke', '#ffffff17');
    const faint = css('--faint', '#6b7199');
    const muted = css('--muted', '#9aa0c3');
    const ok = css('--ok', '#3ddc97');
    const acc2 = css('--acc2', '#00e5c3');
    const acc = css('--acc', '#7c5cff');
    const todayDow = (new Date().getDay() + 6) % 7;

    const rr = (x: number, y: number, ww: number, hh: number, rad: number) => {
      const r = Math.min(rad, ww / 2, Math.max(0.01, hh) / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + ww, y, x + ww, y + hh, r);
      ctx.arcTo(x + ww, y + hh, x, y + hh, r);
      ctx.arcTo(x, y + hh, x, y, r);
      ctx.arcTo(x, y, x + ww, y, r);
      ctx.closePath();
    };

    animate(800, (p) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = '10px system-ui';
      for (let i = 0; i <= 4; i += 1) {
        const y = padT + (ih * i) / 4;
        ctx.strokeStyle = stroke;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - 10, y);
        ctx.stroke();
        ctx.fillStyle = faint;
        ctx.fillText(String(Math.round(max * (1 - i / 4))), 4, y + 3.5);
      }
      data.forEach((d, i) => {
        const x = padL + (iw * (i + 0.5)) / 7 - bw / 2;
        const hDue = ih * (d.due / max) * p;
        const hDone = ih * (d.done / max) * p;
        ctx.fillStyle = css('--stroke2', '#ffffff29');
        rr(x, padT + ih - hDue, bw, hDue, 6);
        ctx.fill();
        const g = ctx.createLinearGradient(0, padT, 0, h);
        g.addColorStop(0, ok);
        g.addColorStop(1, acc2);
        ctx.fillStyle = g;
        rr(x, padT + ih - hDone, bw, hDone, 6);
        ctx.fill();
        ctx.fillStyle = d.dow === todayDow ? acc : faint;
        ctx.font = `${d.dow === todayDow ? 800 : 600} 11px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(WD[i], x + bw / 2, h - 9);
        if (d.due) {
          ctx.fillStyle = muted;
          ctx.font = '700 10px system-ui';
          ctx.fillText(`${Math.round((d.done / d.due) * 100)}%`, x + bw / 2, padT + ih - hDue - 6);
        }
        ctx.textAlign = 'left';
      });
    });
  });

  return <canvas ref={ref} />;
}

/* ----------------------------- Радар ------------------------------ */
export function RadarChart({ axes }: { axes: { label: string; value: number; count: number; color: string }[] }) {
  const { ref, setup } = useCanvas(270);

  useEffect(() => {
    const s = setup();
    if (!s) return;
    const { ctx, w } = s;
    const h = 270;
    const cx = w / 2;
    const cy = h / 2 + 4;
    const R = Math.min(w, h) / 2 - 52;
    const n = axes.length;
    const stroke = css('--stroke', '#ffffff17');
    const acc = css('--acc', '#7c5cff');
    const acc2 = css('--acc2', '#00e5c3');
    const faint = css('--faint', '#6b7199');
    const text = css('--text', '#fff');
    const muted = css('--muted', '#9aa0c3');

    animate(900, (p) => {
      ctx.clearRect(0, 0, w, h);
      for (let ring = 1; ring <= 4; ring += 1) {
        ctx.beginPath();
        for (let i = 0; i <= n; i += 1) {
          const a = -Math.PI / 2 + (i / n) * 6.2832;
          const rr = (R * ring) / 4;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
      for (let i = 0; i < n; i += 1) {
        const a = -Math.PI / 2 + (i / n) * 6.2832;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }

      ctx.beginPath();
      axes.forEach((ax, i) => {
        const a = -Math.PI / 2 + (i / n) * 6.2832;
        const rr = R * Math.max(0.04, ax.value) * p;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `${acc}cc`);
      g.addColorStop(1, `${acc2}44`);
      ctx.fillStyle = g;
      ctx.shadowColor = acc;
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = acc;
      ctx.lineWidth = 2;
      ctx.stroke();

      axes.forEach((ax, i) => {
        const a = -Math.PI / 2 + (i / n) * 6.2832;
        const lx = cx + Math.cos(a) * (R + 26);
        const ly = cy + Math.sin(a) * (R + 26);
        ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
        ctx.font = '700 11px system-ui';
        ctx.fillStyle = ax.count ? text : faint;
        ctx.fillText(ax.label, lx, ly);
        ctx.font = '600 10px system-ui';
        ctx.fillStyle = muted;
        ctx.fillText(ax.count ? `${Math.round(ax.value * 100)}% · ${ax.count}` : '—', lx, ly + 12);
        const px = cx + Math.cos(a) * R * Math.max(0.04, ax.value) * p;
        const py = cy + Math.sin(a) * R * Math.max(0.04, ax.value) * p;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, 6.284);
        ctx.fillStyle = ax.color;
        ctx.fill();
      });
      ctx.textAlign = 'left';
    });
  });

  return <canvas ref={ref} />;
}

/** Плавное появление блока при скролле */
export function Rise({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
