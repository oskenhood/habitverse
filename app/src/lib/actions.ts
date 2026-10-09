'use server';

/**
 * Server Actions — вся работа с Supabase.
 * RLS на стороне БД гарантирует, что пользователь не тронет чужие данные.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { D } from '@/lib/dates';
import type { CategoryId, Challenge, FreqType, Habit, LogStatus, Note, Profile } from '@/types/database';

const PATHS = ['/dashboard', '/calendar', '/stats', '/notes', '/social', '/feed', '/profile'] as const;
const revalidate = () => {
  PATHS.forEach((p) => revalidatePath(p));
};

async function uid() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Не авторизован');
  return { supabase, userId: user.id };
}

/* ============================== ПРОФИЛЬ ============================== */

export async function getMe(): Promise<Profile | null> {
  const { supabase, userId } = await uid();
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

export async function updateProfile(patch: Partial<Profile>) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/profile');
  revalidatePath('/dashboard', 'layout');
  return { ok: true };
}

export async function uploadAvatar(file: File): Promise<string> {
  const { supabase, userId } = await uid();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `avatars/${userId}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  await supabase.from('profiles').update({ avatar_url: data.publicUrl } as never).eq('id', userId);
  revalidatePath('/profile');
  return data.publicUrl;
}

export async function completeOnboarding(data: { display_name: string; emoji: string }) {
  const { supabase, userId } = await uid();
  await supabase
    .from('profiles')
    .update({ display_name: data.display_name || 'Пилот', emoji: data.emoji, onboarding_done: true } as never)
    .eq('id', userId);
  revalidate();
  return { ok: true };
}

/* ============================== ПРИВЫЧКИ ============================== */

export interface HabitDraft {
  name: string;
  emoji: string;
  color: string;
  description: string;
  category: CategoryId;
  freq_type: FreqType;
  freq_days: number[];
  freq_every: number;
  start_date: string;
  end_date: string | null;
  target_count: number;
  target_unit: string;
  reminder_time: string | null;
  reminder_on: boolean;
  reminder_days: 'schedule' | 'everyday';
  difficulty: number;
  archived: boolean;
  /** «не делать» вместо «делать» */
  is_negative: boolean;
  /** заморозок стрика на календарный месяц */
  freezes: number;
  /** недельная квота: 0 = выключено, 1…7 = сколько плановых дней в неделю достаточно */
  weekly_target: number;
}

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const { supabase, userId } = await uid();
  let q = supabase.from('habits').select('*').eq('user_id', userId).order('position', { ascending: true });
  if (!includeArchived) q = q.eq('archived', false);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createHabit(draft: HabitDraft) {
  const { supabase, userId } = await uid();
  const { count } = await supabase
    .from('habits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('archived', false);
  const { data, error } = await supabase
    .from('habits')
    .insert({ ...draft, user_id: userId, position: count ?? 0 } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.rpc('award_xp', { p_user: userId, p_amount: 20, p_reason: 'new_habit' } as never);
  await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'h1' } as never);
  if ((count ?? 0) + 1 >= 5) await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'h5' } as never);
  if ((count ?? 0) + 1 >= 10) await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'h10' } as never);
  await supabase.from('feed_events').insert({ user_id: userId, type: 'newhabit', payload: { habit_id: data.id } } as never);

  revalidate();
  return data;
}

export async function updateHabit(id: string, patch: Partial<HabitDraft>) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('habits').update(patch).eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidate();
  return { ok: true };
}

export async function deleteHabit(id: string) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('habits').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidate();
  return { ok: true };
}

export async function duplicateHabit(id: string) {
  const { supabase, userId } = await uid();
  const { data: src } = await supabase.from('habits').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!src) throw new Error('Привычка не найдена');
  const copy = { ...(src as Record<string, unknown>) } as Record<string, unknown>;
  ['id', 'user_id', 'created_at', 'updated_at', 'challenge_id'].forEach((k) => delete copy[k]);
  const { data, error } = await supabase
    .from('habits')
    .insert({ ...copy, user_id: userId, name: `${(src as Habit).name} (копия)`, start_date: D.today(), position: ((src as Habit).position ?? 0) + 1 } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidate();
  return data;
}

export async function reorderHabits(ids: string[]) {
  const { supabase, userId } = await uid();
  await Promise.all(ids.map((id, i) => supabase.from('habits').update({ position: i } as never).eq('id', id).eq('user_id', userId)));
  revalidatePath('/dashboard');
  return { ok: true };
}

/* ============================== ОТМЕТКИ ============================== */

export async function listLogs(from: string, to = D.today()): Promise<{ habit_id: string; log_date: string; status: LogStatus; value: number | null; note: string; id: string }[]> {
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from('habit_logs')
    .select('id, habit_id, log_date, status, value, note')
    .eq('user_id', userId)
    .gte('log_date', from)
    .lte('log_date', to);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setLog(habitId: string, date: string, status: LogStatus | null, value?: number | null, note?: string) {
  const { supabase, userId } = await uid();
  if (date > D.today()) throw new Error('Нельзя отметить будущее');

  if (status === null) {
    const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('log_date', date).eq('user_id', userId);
    if (error) throw new Error(error.message);
    revalidate();
    return { status: null as LogStatus | null, xpDelta: 0 };
  }

  const { data, error } = await supabase
    .from('habit_logs')
    .upsert(
      { habit_id: habitId, user_id: userId, log_date: date, status, value: value ?? null, note: note ?? '' },
      { onConflict: 'habit_id,log_date' },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);

  let xpDelta = 0;
  if (status === 'done') {
    xpDelta = date === D.today() ? 12 : 14;
    await supabase.rpc('award_xp', { p_user: userId, p_amount: xpDelta, p_reason: 'checkin' } as never);
    if (date !== D.today()) await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'backfill' } as never);
    const hour = new Date().getHours();
    if (hour < 7) await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'early' } as never);
    if (hour >= 23) await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'night' } as never);

    // идеален ли день?
    const habits = await listHabits();
    const logs = await listLogs(date, date);
    const done = new Set(logs.filter((l) => l.status === 'done').map((l) => l.habit_id));
    const planned = habits.filter((h) => (h.start_date ?? date) <= date && (!h.end_date || h.end_date >= date));
    if (planned.length > 0 && planned.every((h) => done.has(h.id))) {
      await supabase.rpc('award_xp', { p_user: userId, p_amount: 25, p_reason: 'perfect_day' } as never);
      await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'perfect' } as never);
      await supabase.from('feed_events').insert({ user_id: userId, type: 'perfect', payload: { date } } as never);
    }
  } else if (status === 'skip') {
    xpDelta = 3;
    await supabase.rpc('award_xp', { p_user: userId, p_amount: xpDelta, p_reason: 'skip' } as never);
  }

  revalidate();
  return { status, xpDelta, id: data.id };
}

/* ============================== ЗАМЕТКИ ============================== */

export async function listNotes(): Promise<Note[]> {
  const { supabase, userId } = await uid();
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveNote(note: Partial<Note> & { id?: string }) {
  const { supabase, userId } = await uid();
  const payload = {
    user_id: userId,
    title: note.title ?? '',
    body: note.body ?? '',
    color: note.color ?? '',
    tags: note.tags ?? [],
    pinned: note.pinned ?? false,
    habit_id: note.habit_id ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = note.id
    ? await supabase.from('notes').update(payload).eq('id', note.id).eq('user_id', userId).select().single()
    : await supabase.from('notes').insert(payload).select().single();
  if (error) throw new Error(error.message);

  if (!note.id) {
    await supabase.rpc('award_xp', { p_user: userId, p_amount: 4, p_reason: 'note' } as never);
    const { count } = await supabase.from('notes').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if ((count ?? 0) >= 5) await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'note' } as never);
  }
  revalidatePath('/notes');
  return data;
}

export async function deleteNote(id: string) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/notes');
  return { ok: true };
}

/* ============================== ЧЕЛЛЕНДЖИ ============================== */

export async function createChallenge(input: {
  name: string;
  description: string;
  emoji: string;
  color: string;
  habit_id: string | null;
  start_date: string;
  days: number;
  is_public: boolean;
}) {
  const { supabase, userId } = await uid();
  const end = D.add(input.start_date, Math.max(1, input.days) - 1);
  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: userId,
      name: input.name,
      description: input.description,
      emoji: input.emoji,
      color: input.color,
      start_date: input.start_date,
      end_date: end,
      habit_id: input.habit_id,
      is_public: input.is_public,
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await supabase.from('challenge_members').insert({ challenge_id: data.id, user_id: userId } as never);
  if (input.habit_id) await supabase.from('habits').update({ challenge_id: data.id } as never).eq('id', input.habit_id).eq('user_id', userId);
  await supabase.rpc('award_xp', { p_user: userId, p_amount: 40, p_reason: 'challenge' } as never);
  await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'chal' } as never);
  await supabase.from('feed_events').insert({ user_id: userId, type: 'challenge', payload: { challenge_id: data.id, action: 'create' } } as never);
  revalidate();
  return data;
}

export async function joinChallenge(code: string) {
  const { supabase, userId } = await uid();
  const { data, error } = await supabase.rpc('join_challenge_by_code', { p_code: code } as never);
  if (error) throw new Error(error.message);
  await supabase.rpc('unlock_achievement', { p_user: userId, p_achievement: 'chal' } as never);
  revalidate();
  return { challengeId: data as string };
}

export async function leaveChallenge(challengeId: string) {
  const { supabase, userId } = await uid();
  await supabase.from('challenge_members').delete().eq('challenge_id', challengeId).eq('user_id', userId);
  revalidate();
  return { ok: true };
}

export async function deleteChallenge(id: string) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('challenges').delete().eq('id', id).eq('creator_id', userId);
  if (error) throw new Error(error.message);
  revalidate();
  return { ok: true };
}

/* ============================== ДРУЗЬЯ ============================== */

export async function searchUsers(q: string) {
  const { supabase } = await uid();
  if (q.trim().length < 2) return [];
  const { data, error } = await supabase.rpc('search_users', { q: q.trim(), p_limit: 20 } as never);
  if (error) return [];
  return data ?? [];
}

export async function addFriend(addresseeId: string) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('friendships').insert({ requester_id: userId, addressee_id: addresseeId } as never);
  if (error) {
    if (error.code === '23505') throw new Error('Заявка уже отправлена');
    throw new Error(error.message);
  }
  await supabase.from('feed_events').insert({ user_id: userId, type: 'join', payload: { to: addresseeId } } as never);
  revalidatePath('/social');
  return { ok: true };
}

export async function respondFriendship(id: string, accept: boolean) {
  const { supabase, userId } = await uid();
  const { error } = await supabase
    .from('friendships')
    .update(accept ? { status: 'accepted', accepted_at: new Date().toISOString() } : { status: 'blocked' })
    .eq('id', id)
    .eq('addressee_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/social');
  return { ok: true };
}

export async function removeFriend(id: string) {
  const { supabase, userId } = await uid();
  await supabase.from('friendships').delete().eq('id', id);
  revalidatePath('/social');
  return { ok: true };
}

export async function nudge(friendId: string) {
  const { supabase, userId } = await uid();
  const { error } = await supabase.from('feed_events').insert({ user_id: userId, type: 'nudge', payload: { to: friendId }, is_public: false } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ============================== ЛЕНТА ============================== */

export async function listFeed(limit = 60) {
  const { supabase, userId } = await uid();
  const { data: friends } = await supabase.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted');
  const ids = new Set<string>([userId]);
  (friends ?? []).forEach((f) => {
    ids.add(f.requester_id);
    ids.add(f.addressee_id);
  });

  const { data, error } = await supabase
    .from('feed_events')
    .select('*, profile:profiles!feed_events_user_id_fkey(display_name, emoji, avatar_url)')
    .in('user_id', [...ids])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

/* ============================== ДОСТИЖЕНИЯ ============================== */

export async function listAchievements() {
  const { supabase, userId } = await uid();
  const [{ data: defs }, { data: mine }] = await Promise.all([
    supabase.from('achievements').select('*').order('sort'),
    supabase.from('user_achievements').select('achievement_id, unlocked_at').eq('user_id', userId),
  ]);
  return { defs: defs ?? [], mine: mine ?? [] };
}


/* ============================== РЕАКЦИИ (v1.2) ============================== */

export async function toggleReaction(eventId: number, emoji: string) {
  const { supabase } = await uid();
  const { data, error } = await supabase.rpc('toggle_reaction', { p_event: eventId, p_emoji: emoji } as never);
  if (error) throw new Error(error.message);
  revalidatePath('/feed');
  revalidatePath('/dashboard');
  return { active: data as boolean };
}

export async function listReactions(eventIds: number[]) {
  const { supabase } = await uid();
  if (!eventIds.length) return [];
  const { data, error } = await supabase.from('feed_reactions').select('*').in('event_id', eventIds);
  if (error) return [];
  return data ?? [];
}

/** Массовое добавление привычек из каталога */
export async function addFromPresets(presets: HabitDraft[]) {
  const out = [];
  for (const p of presets) out.push(await createHabit(p));
  return out;
}
