'use strict';
/* Смоук статического экспорта: web/out должен работать без next start.
   Предварительно: cd web && npm run export  (HV_EXPORT=1 next build --webpack).
   Поднимает static-server.js (node, без зависимостей), грузит страницы в jsdom
   С гидратацией (полифиллы как в web.smoke.test.js — грабля №52),
   проверяет маркеры данных и штамп версии в подвале.
   Запуск: npm run test:web:static  (порт: STATIC_PORT, по умолчанию 3620) */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.STATIC_PORT || 3620);
const BASE = `http://127.0.0.1:${PORT}`;
const E = require(path.join(__dirname, 'webbuild', 'engine.js'));
const SEED = JSON.stringify(E.seedDemo());

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function fakeCanvasCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop in t) return t[prop];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

async function loadPage(urlPath, readyMarker) {
  const vc = new VirtualConsole();
  const pageErrors = [];
  vc.on('jsdomError', (e) => {
    if (/Not implemented: navigation/.test(e.message)) return;
    pageErrors.push(e.message);
  });
  vc.on('error', (...a) => pageErrors.push('console.error: ' + a.join(' ')));
  const dom = await JSDOM.fromURL(BASE + urlPath, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      window.localStorage.setItem('habitverse.v1', SEED);
      const webStreams = require('stream/web');
      const util = require('util');
      window.ReadableStream = window.ReadableStream || webStreams.ReadableStream;
      window.TransformStream = window.TransformStream || webStreams.TransformStream;
      window.WritableStream = window.WritableStream || webStreams.WritableStream;
      window.TextEncoder = window.TextEncoder || util.TextEncoder;
      window.TextDecoder = window.TextDecoder || util.TextDecoder;
      window.BroadcastChannel = window.BroadcastChannel || require('worker_threads').BroadcastChannel;
      window.HTMLCanvasElement.prototype.getContext = () => fakeCanvasCtx();
      window.Element.prototype.scrollIntoView = function () {};
      window.fetch = (u, o) => fetch(new URL(u, BASE + urlPath), o);
      if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
    },
  });
  const { window } = dom;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if (window.document.querySelector(readyMarker)) break;
    await wait(200);
  }
  if (!window.document.querySelector(readyMarker)) throw new Error(`нет ${readyMarker} на ${urlPath}`);
  if (pageErrors.length) throw new Error('ошибки страницы: ' + pageErrors[0]);
  return window;
}

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, 'static-server.js'), String(PORT)], { stdio: 'ignore', detached: true });
  const killServer = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill(); } catch {} } };
  process.on('exit', killServer);
  const ping = () => new Promise((resolve) => {
    const rq = http.get(BASE + '/', (r) => { r.resume(); resolve(r.statusCode === 200); });
    rq.on('error', () => resolve(false));
    rq.setTimeout(1000, () => { rq.destroy(); resolve(false); });
  });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await wait(250); up = await ping(); }
  if (!up) { killServer(); throw new Error('статик-сервер не поднялся'); }
  let ok = 0, failed = 0;
  const step = async (name, fn) => {
    try { await fn(); ok++; console.log('  ok  ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ' — ' + e.message); }
  };
  try {
    await step('GET / → 200 (статика)', async () => {
      if (!(await ping())) throw new Error('GET / не 200');
    });
    await step('обзор (/) гидратируется: weekstrip', async () => { await loadPage('/', '.weekstrip-cell'); });
    await step('календарь (/calendar/) гидратируется: cal-cell', async () => { await loadPage('/calendar/', '.cal-cell'); });
    await step('отчёты (/reports/) гидратируются: kpi', async () => { await loadPage('/reports/', '.kpi'); });
    await step('финансы (/finance/) гидратируются: fin-kpis', async () => { await loadPage('/finance/', '.fin-kpis'); });
    await step('в подвале штамп v2.1.0', async () => {
      const win = await loadPage('/', '.weekstrip-cell');
      const text = win.document.body.textContent || '';
      if (!text.includes('v2.1.0')) throw new Error('нет v2.1.0 в тексте страницы');
    });
  } finally { killServer(); }
  console.log(`\nstatic-export: ${ok} ok, ${failed} FAIL`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
