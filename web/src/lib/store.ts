'use client';

/* ============================================================
   HabitVerse web — хранилище состояния (фаза 5.2)
   Обёртка над чистым движком engine.ts: localStorage-персист,
   подписка через useSyncExternalStore, действия для компонентов.
   Схема и ключ — как у демо (habitverse.v1), чтобы экспорт/импорт
   между демо и сайтом работал без конвертации.
   ============================================================ */
import { useEffect, useSyncExternalStore } from 'react';
import {
  blank, normalize, seedDemo, D, STORAGE_KEY,
  logAt, setLog, isDone, nextStatus, dueOn, monthOf,
  newHabit, updateHabit, removeHabit, reorderHabits, reorderByIds, visibleHabits, streakOf,
  addFeed, saveNote, removeNote, toggleNotePin, toggleReaction, simFriendActivity,
  createChallenge, removeChallenge, findChallengeByCode, buildCsv,
  addExpense, updateExpense, removeExpense, buildExpensesCsv,
  type HvState, type Habit, type LogStatus, type NewHabitData, type NoteData, type Note,
  type Challenge, type NewChallengeData, type Expense, type ExpenseData,
} from './engine';
import { download, toast } from './ui';

let state: HvState = blank();
let ready = false;                       // данные загружены из localStorage (клиент)
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function emit(): void {
  state = { ...state };                  // новая идентичность → useSyncExternalStore перерисует
  listeners.forEach((l) => l());
}
function persist(): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { /* переполнение хранилища — данные живут до перезагрузки */ }
  }, 120);
}
/** Пересчёт «потраченных» заморозок: проставляет frozen-флаги в логах (как рендер в демо).
    Вызывается только из действий (не из рендера), поэтому side-эффект безопасен. */
function recalcFreezeFlags(s: HvState): void {
  const today = D.today();
  for (const h of visibleHabits(s)) streakOf(s, h, today, { persist: true });
}

export const hv = {
  get: (): HvState => state,
  isReady: (): boolean => ready,
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },

  /** Однократная загрузка из localStorage (вызывается из useEffect — не из рендера). */
  hydrate(): void {
    if (ready || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = normalize(JSON.parse(raw));
    } catch { /* повреждённые данные — начинаем с чистого состояния */ }
    ready = true;
    recalcFreezeFlags(state);
    emit();
    persist();
  },

  /** Любое изменение состояния: fn мутирует черновик, затем emit + persist. */
  mutate(fn: (s: HvState) => void): void {
    fn(state);
    emit();
    persist();
  },

  /* ---------- действия ---------- */
  addHabit(data: NewHabitData): Habit {
    let created: Habit | null = null;
    hv.mutate((s) => { created = newHabit(s, data); addFeed(s, 'newhabit', { habitId: created!.id }); });
    return created as unknown as Habit;
  },
  updateHabitById(id: string, patch: Partial<Habit>): void {
    hv.mutate((s) => { updateHabit(s, id, patch); recalcFreezeFlags(s); });
  },
  removeHabitById(id: string): void {
    hv.mutate((s) => { removeHabit(s, id); addFeed(s, 'delhabit', {}); });
  },
  reorder(dir: -1 | 1, id: string): void {
    hv.mutate((s) => { reorderHabits(s, dir, id); });
  },
  /** DnD: зафиксировать новый порядок видимых привычек (список id). */
  setOrder(ids: string[]): void {
    hv.mutate((s) => { reorderByIds(s, ids); });
  },
  rename(id: string, name: string): void {
    const v = name.trim();
    if (v) hv.updateHabitById(id, { name: v.slice(0, 60) });
  },
  /** Отметка дня: цикл done → skip → miss → пусто (или явный статус). */
  applyStatus(hid: string, key: string, status: LogStatus | null): void {
    hv.mutate((s) => {
      const was = logAt(s, hid, key)?.status || null;
      setLog(s, hid, key, status);
      recalcFreezeFlags(s);
      if (status === 'done' && was !== 'done') addFeed(s, 'checkin', { habitId: hid, key, status: 'done' });
    });
  },
  cycle(hid: string, key: string): void {
    hv.applyStatus(hid, key, nextStatus(logAt(state, hid, key)));
  },
  /** Заметка/количество ко дню (день × привычка). Без лога создаёт статус done — семантика демо. */
  patchLog(hid: string, key: string, patch: { note?: string; val?: number | null }): void {
    hv.mutate((s) => {
      if (!s.logs[hid]) s.logs[hid] = {};
      const prev = s.logs[hid][key];
      s.logs[hid][key] = prev
        ? { ...prev, ...(patch.note !== undefined ? { note: patch.note } : {}), ...(patch.val !== undefined ? { val: patch.val } : {}) }
        : { status: 'done', val: patch.val ?? null, note: patch.note || '', ts: Date.now() };
      recalcFreezeFlags(s);
    });
  },
  toggleArchive(id: string): boolean {
    const h = state.habits.find((x) => x.id === id);
    const next = !(h && h.archived);
    hv.updateHabitById(id, { archived: next });
    return next;
  },
  duplicate(id: string): void {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    const copy: NewHabitData = { ...h, name: h.name + ' (копия)', createdAt: Date.now(), start: D.today() };
    delete (copy as Partial<Habit>).id;
    hv.addHabit(copy);
  },

  /* ---------- заметки (фаза 5.3) ---------- */
  saveNoteById(data: NoteData, id?: string | null): Note {
    let saved: Note | null = null;
    hv.mutate((s) => {
      saved = saveNote(s, data, id);
      if (!id) addFeed(s, 'note', {});
    });
    return saved as unknown as Note;
  },
  removeNoteById(id: string): void {
    hv.mutate((s) => { removeNote(s, id); });
  },
  toggleNotePinById(id: string): void {
    hv.mutate((s) => { toggleNotePin(s, id); });
  },

  /* ---------- команда: челленджи, друзья, лента (фаза 5.3, демо-режим) ---------- */
  createChallengeBy(data: NewChallengeData): Challenge {
    let c: Challenge | null = null;
    hv.mutate((s) => { c = createChallenge(s, data); addFeed(s, 'challenge', { chalId: c!.id }); });
    return c as unknown as Challenge;
  },
  removeChallengeById(id: string): void {
    hv.mutate((s) => { removeChallenge(s, id); });
  },
  joinByCode(code: string): Challenge | null {
    return findChallengeByCode(state, code);
  },
  removeFriendById(id: string): void {
    hv.mutate((s) => { s.friends = s.friends.filter((f) => f.id !== id); });
  },
  nudge(id: string): void {
    hv.mutate((s) => { addFeed(s, 'nudge', { friend: id, me: true }); });
  },
  simulateActivity(): void {
    hv.mutate((s) => { simFriendActivity(s); });
  },
  react(feedId: string, emoji: string): void {
    hv.mutate((s) => { toggleReaction(s, feedId, emoji); });
  },

  /* ---------- финансы (F-2) ---------- */
  /** Новая запись расхода. Ошибки валидации движка возвращает текстом (для тоста),
      успех — созданной записью. */
  addExpenseBy(data: ExpenseData): { ok: true; expense: Expense } | { ok: false; error: string } {
    try {
      let created: Expense | null = null;
      hv.mutate((s) => { created = addExpense(s, data); });
      return { ok: true, expense: created as unknown as Expense };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'не удалось добавить запись' };
    }
  },
  updateExpenseById(id: string, patch: Partial<Omit<Expense, 'id'>>): { ok: true } | { ok: false; error: string } {
    try {
      hv.mutate((s) => { updateExpense(s, id, patch); });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'не удалось обновить запись' };
    }
  },
  removeExpenseById(id: string): void {
    hv.mutate((s) => { removeExpense(s, id); });
  },
  exportExpensesCsv(from?: string, to?: string): void {
    download(`habitverse-finances-${D.today()}.csv`, buildExpensesCsv(state, from, to), 'text/csv');
    toast('CSV расходов экспортирован', 'ok');
  },

  /* ---------- онбординг ---------- */
  /** Финал мастера первого визита: имя + аватар-эмодзи, опционально демо-данные. */
  finishOnboarding(d: { name: string; emoji: string; withSeed: boolean }): void {
    hv.mutate((s) => {
      if (d.withSeed) Object.assign(s, seedDemo());
      s.profile.name = (d.name || '').trim().slice(0, 30) || s.profile.name || 'Пилот';
      s.profile.emoji = d.emoji || s.profile.emoji || '🙂';
      s.profile.onboarded = true;
      s.profile.joined = s.profile.joined || Date.now();
    });
  },

  /* ---------- данные ---------- */
  exportCsv(): void {
    download(`habitverse-${D.today()}.csv`, buildCsv(state), 'text/csv');
    toast('CSV экспортирован', 'ok');
  },
  /** Импорт JSON-бэкапа (файл из «Экспорт JSON» или из демо): валидация,
      normalize, полная замена состояния. Возвращает результат для тоста. */
  importJson(text: string): { ok: true; habits: number } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'файл не является JSON' };
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { habits?: unknown }).habits)) {
      return { ok: false, error: 'в файле нет списка привычек — это не экспорт HabitVerse?' };
    }
    try {
      state = normalize(parsed as Partial<HvState>);
      ready = true;
      recalcFreezeFlags(state);
      emit();
      persist();
      return { ok: true, habits: state.habits.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'файл повреждён' };
    }
  },
  /** Демо-данные: полная замена состояния (как seedDemo в демо). */
  seed(): void {
    state = seedDemo();
    ready = true;
    recalcFreezeFlags(state);
    emit();
    persist();
  },
  reset(): void {
    state = blank();
    ready = true;
    emit();
    persist();
  },
};

/* ---------- React-подписка ---------- */
const serverSnapshot = blank();
const getServer = (): HvState => serverSnapshot;
const getServerReady = (): boolean => false;

export interface HvHook { state: HvState; ready: boolean; }

/** Снимок состояния + флаг готовности (ready=false на сервере и до hydrate —
    страницы рисуют скелетон, гидратация без mismatch). */
export function useHv(): HvHook {
  const snap = useSyncExternalStore(hv.subscribe, hv.get, getServer);
  const isReady = useSyncExternalStore(hv.subscribe, hv.isReady, getServerReady);
  useEffect(() => { hv.hydrate(); }, []);
  return { state: snap, ready: isReady };
}

/** Мини-хелперы для страниц (чтобы не импортировать движок целиком). */
export const engine = {
  D, logAt, isDone, dueOn, monthOf, visibleHabits, streakOf,
};
