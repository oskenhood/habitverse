/* HabitVerse web — общие сущности интерфейса (фаза 5.1, перенос из v2/app.js) */

import { APP_VERSION as ENGINE_VERSION } from './engine';

export const APP_VERSION = ENGINE_VERSION;

export interface Section {
  id: string;
  href: string;
  name: string;
  icon: string;
}

export const SECTIONS: Section[] = [
  { id: 'today', href: '/', name: 'Обзор', icon: 'dash' },
  { id: 'habits', href: '/habits', name: 'Привычки', icon: 'check' },
  { id: 'calendar', href: '/calendar', name: 'Календарь', icon: 'cal' },
  { id: 'stats', href: '/reports', name: 'Отчёты', icon: 'chart' },
  { id: 'finance', href: '/finance', name: 'Финансы', icon: 'coin' },
  { id: 'notes', href: '/notes', name: 'Заметки', icon: 'note' },
  { id: 'team', href: '/team', name: 'Команда', icon: 'users' },
  { id: 'settings', href: '/settings', name: 'Настройки', icon: 'sliders' },
];

export const THEME_LIST: Array<[id: string, name: string, color: string]> = [
  ['snow', 'Графит', '#6B6E76'],
  ['peach', 'Персик', '#C0714F'],
  ['sand', 'Охра', '#A9853F'],
  ['sage', 'Шалфей', '#5F8A6B'],
  ['mint', 'Мята', '#3F8A80'],
  ['sky', 'Небо', '#4A76A8'],
  ['lavender', 'Лаванда', '#7A6AA8'],
  ['rose', 'Роза', '#A85C74'],
];

/* ---------- тосты: шина событий (слушатель — <Toaster/>) ---------- */
export type ToastKind = 'ok' | 'info' | 'warn';
export function toast(msg: string, kind: ToastKind = 'info'): void {
  window.dispatchEvent(new CustomEvent('hv:toast', { detail: { msg, kind } }));
}

/* ---------- скачивание файла (CSV/JSON) ---------- */
export function download(filename: string, text: string, mime: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- глобальные события разделов ---------- */
/** Открыть каталог привычек из любого места (Shell слушает событие). */
export function openCatalog(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('hv:open-catalog'));
}

/* ---------- настройки интерфейса (localStorage) ---------- */
export interface UiPrefs {
  mode: 'light' | 'dark';
  theme: string;
  density: 'cozy' | 'compact';
  sideCollapsed: boolean;
}
export const UI_DEFAULTS: UiPrefs = { mode: 'light', theme: 'snow', density: 'cozy', sideCollapsed: false };
const UI_KEY = 'hv.web.ui';

export function loadUi(): UiPrefs {
  if (typeof window === 'undefined') return { ...UI_DEFAULTS };
  try {
    return { ...UI_DEFAULTS, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') } as UiPrefs;
  } catch {
    return { ...UI_DEFAULTS };
  }
}
export function saveUi(p: UiPrefs): void {
  try { localStorage.setItem(UI_KEY, JSON.stringify(p)); } catch { /* приватный режим — не страшно */ }
}

/* ---------- аватары: инициалы на мягком тоне (правило alpha.2) ---------- */
export const AV_HUES = ['#6B6E76', '#C0714F', '#A9853F', '#5F8A6B', '#3F8A80', '#4A76A8', '#7A6AA8', '#A85C74'];
export function hueFor(str: string): string {
  let h = 0;
  for (const ch of String(str || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV_HUES[h % AV_HUES.length];
}
export function initialsOf(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Г';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
