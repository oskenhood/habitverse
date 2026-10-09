/* ============================================================
   HabitVerse web — canvas-чарты отчётов (фаза 5.3)
   Порт drawTrend/drawDonut/drawDow/drawRadar из v2/app.js.
   Отличия (осознанные):
   - данные готовит страница (чистые вычисления), чарты только рисуют;
   - prefers-reduced-motion → без анимации (сразу финальный кадр);
   - подписи радара без эмодзи (правило UI-хрома DESIGN.md).
   Модуль клиентский: вызывается из useEffect, когда document есть.
   ============================================================ */

export function cssVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const reduceMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

export interface Ctx { ctx: CanvasRenderingContext2D; w: number; h: number; }

export function setupCanvas(cv: HTMLCanvasElement, h: number): Ctx {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = (cv.parentElement ? cv.parentElement.clientWidth : cv.clientWidth) - 32;
  cv.style.width = '100%'; cv.style.height = h + 'px';
  cv.width = Math.max(10, w * dpr); cv.height = h * dpr;
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { ctx, w: Math.max(10, w), h };
}

export function animate(dur: number, fn: (p: number) => void): void {
  if (reduceMotion()) { fn(1); return; }
  const t0 = performance.now();
  const step = (now: number): void => {
    const p = Math.min(1, Math.max(0, (now - t0) / dur));
    fn(1 - Math.pow(1 - p, 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2); if (h <= 0) h = 0.01;
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/* ---------- динамика выполнения: линия + область + скользящее среднее ---------- */
export interface TrendPoint { k: string; rate: number | null; }
export function drawTrend(cv: HTMLCanvasElement | null, perDay: TrendPoint[]): void {
  if (!cv) return;
  const { ctx, w, h } = setupCanvas(cv, 230);
  const data = perDay.map((d) => d.rate);
  const padL = 34, padB = 24, padT = 12, padR = 8;
  const iw = w - padL - padR, ih = h - padT - padB;
  const acc = cssVar('--acc', '#6B6E76'), acc2 = cssVar('--info', '#4A76A8');
  const stroke = cssVar('--border', '#e5e5e2'), faint = cssVar('--text-3', '#999');
  const okCol = cssVar('--ok', '#5F8A6B');
  animate(900, (p) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.font = '10px system-ui'; ctx.fillStyle = faint;
    for (let i = 0; i <= 4; i++) {
      const y = padT + ih * i / 4;
      ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.globalAlpha = 1; ctx.fillText((100 - i * 25) + '%', 4, y + 3.5);
    }
    const n = data.length; if (!n) return;
    const X = (i: number): number => padL + (n === 1 ? iw / 2 : iw * i / (n - 1));
    const Y = (v: number): number => padT + ih * (1 - v);
    // область под линией
    const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
    grad.addColorStop(0, acc + 'aa'); grad.addColorStop(1, acc + '00');
    ctx.beginPath();
    let started = false;
    data.forEach((v, i) => { if (v === null) return; const y = Y(v * p); if (!started) { ctx.moveTo(X(i), y); started = true; } else ctx.lineTo(X(i), y); });
    const lastIdx = data.reduce<number>((a, v, i) => (v !== null ? i : a), 0);
    const firstIdx = data.findIndex((v) => v !== null);
    if (started) { ctx.lineTo(X(lastIdx), h - padB); ctx.lineTo(X(Math.max(0, firstIdx)), h - padB); ctx.closePath(); ctx.fillStyle = grad; ctx.fill(); }
    // линия
    ctx.beginPath(); started = false;
    data.forEach((v, i) => { if (v === null) return; const y = Y(v * p); if (!started) { ctx.moveTo(X(i), y); started = true; } else ctx.lineTo(X(i), y); });
    ctx.strokeStyle = acc; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
    // скользящее среднее (7)
    const ma = data.map((_, i) => {
      const s = data.slice(Math.max(0, i - 6), i + 1).filter((v): v is number => v !== null);
      return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
    });
    ctx.beginPath(); started = false;
    ma.forEach((v, i) => { if (v === null) return; const y = Y(v * p); if (!started) { ctx.moveTo(X(i), y); started = true; } else ctx.lineTo(X(i), y); });
    ctx.strokeStyle = acc2; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    // точки
    data.forEach((v, i) => {
      if (v === null) return; if (n > 60 && i % Math.ceil(n / 60)) return;
      ctx.beginPath(); ctx.arc(X(i), Y(v * p), v === 1 ? 3.4 : 2.2, 0, 6.284);
      ctx.fillStyle = v === 1 ? okCol : acc; ctx.fill();
    });
    // подписи дат
    ctx.fillStyle = faint; ctx.textAlign = 'center';
    const stepX = Math.max(1, Math.floor(n / 7));
    for (let i = 0; i < n; i += stepX) {
      const [yy, mm, dd] = perDay[i].k.split('-').map(Number);
      ctx.fillText(`${dd}.${String(mm).padStart(2, '0')}`, X(i), h - 7);
      void yy;
    }
    ctx.textAlign = 'left';
  });
}

/* ---------- донат статусов ---------- */
export interface DonutVals { done: number; skipped: number; missed: number; }
export const DONUT_COLORS_VARS = ['--ok', '--warn', '--bad'];
export function drawDonut(cv: HTMLCanvasElement | null, vals: DonutVals): void {
  if (!cv) return;
  const { ctx, w, h } = setupCanvas(cv, 230);
  const total = vals.done + vals.skipped + vals.missed;
  const cols = DONUT_COLORS_VARS.map((v, i) => cssVar(v, ['#5F8A6B', '#A9853F', '#B0574F'][i]));
  const data = [vals.done, vals.skipped, vals.missed];
  const cx = w / 2, cy = h / 2 - 4, R = Math.min(w, h) / 2 - 22, r = R * 0.62;
  animate(850, (p) => {
    ctx.clearRect(0, 0, w, h);
    if (!total) {
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.284); ctx.arc(cx, cy, r, 0, 6.284, true);
      ctx.fillStyle = cssVar('--border', '#e5e5e2'); ctx.fill();
      ctx.fillStyle = cssVar('--text-3', '#999'); ctx.font = '600 13px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('нет данных', cx, cy + 4); ctx.textAlign = 'left';
      return;
    }
    let a0 = -Math.PI / 2;
    data.forEach((v, i) => {
      if (!v) return;
      const a1 = a0 + (v / total) * 6.2832 * p;
      ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.arc(cx, cy, r, a1, a0, true); ctx.closePath();
      ctx.fillStyle = cols[i]; ctx.fill();
      a0 = a1;
    });
    ctx.fillStyle = cssVar('--text', '#222'); ctx.font = '800 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(Math.round(vals.done / Math.max(1, total) * 100) + '%', cx, cy + 2);
    ctx.font = '600 11px system-ui'; ctx.fillStyle = cssVar('--text-2', '#666');
    ctx.fillText('успех', cx, cy + 18); ctx.textAlign = 'left';
  });
}

/* ---------- столбцы по дням недели ---------- */
export interface DowStat { due: number; done: number; }
export function drawDow(cv: HTMLCanvasElement | null, stats: DowStat[], todayDow: number): void {
  if (!cv) return;
  const { ctx, w, h } = setupCanvas(cv, 220);
  const max = Math.max(1, ...stats.map((s) => s.due));
  const padL = 30, padB = 26, padT = 12; const iw = w - padL - 10, ih = h - padT - padB;
  const bw = iw / 7 * 0.58;
  const okCol = cssVar('--ok', '#5F8A6B'), acc2 = cssVar('--info', '#4A76A8'), acc = cssVar('--acc', '#6B6E76');
  animate(800, (p) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px system-ui'; ctx.fillStyle = cssVar('--text-3', '#999');
    for (let i = 0; i <= 4; i++) {
      const y = padT + ih * i / 4;
      ctx.strokeStyle = cssVar('--border', '#e5e5e2'); ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - 10, y); ctx.stroke();
      ctx.fillText(String(Math.round(max * (1 - i / 4))), 4, y + 3.5);
    }
    stats.forEach((s, i) => {
      const x = padL + iw * (i + 0.5) / 7 - bw / 2;
      const hDue = ih * (s.due / max) * p, hDone = ih * (s.done / max) * p;
      ctx.fillStyle = cssVar('--border-strong', '#d8d8d4');
      roundRect(ctx, x, padT + ih - hDue, bw, hDue, 6); ctx.fill();
      const g = ctx.createLinearGradient(0, padT, 0, h); g.addColorStop(0, okCol); g.addColorStop(1, acc2);
      ctx.fillStyle = g; roundRect(ctx, x, padT + ih - hDone, bw, hDone, 6); ctx.fill();
      ctx.fillStyle = todayDow === i ? acc : cssVar('--text-3', '#999');
      ctx.font = (todayDow === i ? '800 ' : '600 ') + '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(WD[i], x + bw / 2, h - 9);
      if (s.due) {
        ctx.fillStyle = cssVar('--text-2', '#666'); ctx.font = '700 10px system-ui';
        ctx.fillText(Math.round(s.done / Math.max(1, s.due) * 100) + '%', x + bw / 2, padT + ih - hDue - 6);
      }
      ctx.textAlign = 'left';
    });
  });
}

/* ---------- радар сфер жизни (подписи без эмодзи — UI-хром) ---------- */
export interface RadarCat { name: string; color: string; n: number; v: number; }
export function drawRadar(cv: HTMLCanvasElement | null, cats: RadarCat[]): void {
  if (!cv || !cats.length) return;
  const { ctx, w, h } = setupCanvas(cv, 260);
  const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 46;
  const acc = cssVar('--acc', '#6B6E76'), acc2 = cssVar('--info', '#4A76A8'), stroke = cssVar('--border', '#e5e5e2');
  animate(900, (p) => {
    ctx.clearRect(0, 0, w, h);
    const n = cats.length;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = -Math.PI / 2 + i / n * 6.2832; const rr = R * ring / 4;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.strokeStyle = stroke; ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i / n * 6.2832;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.strokeStyle = stroke; ctx.stroke();
    }
    ctx.beginPath();
    cats.forEach((c, i) => {
      const a = -Math.PI / 2 + i / n * 6.2832; const rr = R * Math.max(0.04, c.v) * p;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, acc + 'cc'); g.addColorStop(1, acc2 + '44');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = acc; ctx.lineWidth = 2; ctx.stroke();
    cats.forEach((c, i) => {
      const a = -Math.PI / 2 + i / n * 6.2832;
      const x = cx + Math.cos(a) * (R + 22), y = cy + Math.sin(a) * (R + 22);
      ctx.textAlign = Math.cos(a) > 0.3 ? 'left' : Math.cos(a) < -0.3 ? 'right' : 'center';
      ctx.font = '700 11px system-ui';
      ctx.fillStyle = c.n ? cssVar('--text', '#222') : cssVar('--text-3', '#999');
      ctx.fillText(c.name, x, y);
      ctx.font = '600 10px system-ui'; ctx.fillStyle = cssVar('--text-2', '#666');
      ctx.fillText(c.n ? Math.round(c.v * 100) + '% · ' + c.n : '—', x, y + 12);
      const px = cx + Math.cos(a) * R * Math.max(0.04, c.v) * p, py = cy + Math.sin(a) * R * Math.max(0.04, c.v) * p;
      ctx.beginPath(); ctx.arc(px, py, 3.2, 0, 6.284); ctx.fillStyle = c.color; ctx.fill();
    });
    ctx.textAlign = 'left';
  });
}
