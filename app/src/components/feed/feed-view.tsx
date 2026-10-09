'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { D } from '@/lib/dates';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardHead, Empty } from '@/components/ui/primitives';
import type { FeedEvent, Habit, Profile } from '@/types/database';
import { Reactions, type ReactionMap } from './reactions';

function Avatar({ p }: { p?: { display_name: string; emoji: string; avatar_url: string | null } }) {
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" className="w-[38px] h-[38px] rounded-full object-cover border-2 border-[var(--stroke2)]" />
    : <span className="w-[38px] h-[38px] rounded-full grid place-items-center text-[17px] bg-[linear-gradient(140deg,var(--acc),var(--acc3))] border-2 border-[var(--stroke2)]">{p?.emoji ?? '🙂'}</span>;
}

export function FeedView({
  feed: initial,
  habits,
  me,
  reactions: initialReactions,
  onReload,
}: {
  feed: FeedEvent[];
  habits: Habit[];
  me: Profile | null;
  reactions: ReactionMap;
  onReload: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState<FeedEvent[]>(initial);
  const [live, setLive] = useState(true);

  useEffect(() => setItems(initial), [initial]);

  // Realtime: лента друзей обновляется без перезагрузки страницы
  useEffect(() => {
    if (!live || !me) return;
    const ch = supabase
      .channel('feed-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'feed_events' },
        (payload) => {
          const row = payload.new as FeedEvent;
          setItems((prev) => (prev.some((x) => x.id === row.id) ? prev : [row, ...prev].slice(0, 80)));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase, live, me]);

  const text = (f: FeedEvent) => {
    const who = f.profile?.display_name ?? (f.user_id === me?.id ? (me?.display_name || 'Ты') : 'Кто-то');
    const isMe = f.user_id === me?.id;
    const p = f.payload as Record<string, string | number | undefined>;
    const habit = p.habit_id ? habits.find((h) => h.id === p.habit_id) : null;
    const date = p.date ? D.human(String(p.date)) : '';
    switch (f.type) {
      case 'checkin': return <><b>{who}</b> отметил{isMe ? '(а)' : ''} {habit ? <>{habit.emoji} <b>{habit.name}</b></> : 'привычку'}{date && date !== 'сегодня' ? ` за ${date}` : ''}</>;
      case 'newhabit': return <><b>{who}</b> создал{isMe ? '(а)' : ''} новую привычку {habit ? <>{habit.emoji} <b>{habit.name}</b></> : ''}</>;
      case 'perfect': return <><b>{who}</b> закрыл{isMe ? '(а)' : ''} день на <b>100%</b> 🌟</>;
      case 'level': return <><b>{who}</b> получил{isMe ? '(а)' : ''} уровень <b>{String(p.level ?? '?')}</b> 🎉</>;
      case 'achievement': return <><b>{who}</b> открыл{isMe ? '(а)' : ''} достижение <b>{String(p.achievement ?? '')}</b> 🏅</>;
      case 'challenge': return <><b>{who}</b> {p.action === 'join' ? 'вступил(а) в челлендж' : 'запустил(а) челлендж'} 🔥</>;
      case 'note': return <><b>{who}</b> добавил{isMe ? '(а)' : ''} заметку 📓</>;
      case 'nudge': return <><b>{who}</b> отправил{isMe ? '(а)' : ''} мотивационный пинок 📨</>;
      case 'join': return <><b>{who}</b> присоединился(ась) к команде 👋</>;
      case 'streak': return <><b>{who}</b> держит стрик <b>{String(p.days ?? '?')}</b> дней 🔥</>;
      default: return <><b>{who}</b> что-то сделал(а)</>;
    }
  };

  return (
    <div className="p-4 lg:p-7">
      <Card>
        <CardHead
          title="Лента активности"
          sub={`${items.length} событий`}
          right={
            <div className="flex gap-2">
              <Button size="sm" variant={live ? 'soft' : 'ghost'} onClick={() => setLive((v) => !v)}>
                {live ? '🟢 Realtime вкл' : '⚪ Realtime выкл'}
              </Button>
            </div>
          }
        />
        {items.length ? (
          <div className="flex flex-col">
            {items.map((f, i) => (
              <motion.div
                key={f.id}
                initial={i === 0 ? { opacity: 0, x: -18 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative grid grid-cols-[38px_1fr] gap-3.5 px-3 py-3 rounded-[14px] hover:bg-[var(--card)] transition-colors"
              >
                {i < items.length - 1 && <span className="absolute left-[30px] top-[44px] -bottom-2 w-0.5 bg-[var(--stroke)]" />}
                <div className="relative z-10"><Avatar p={f.profile ?? (f.user_id === me?.id ? { display_name: me?.display_name ?? '', emoji: me?.emoji ?? '🙂', avatar_url: me?.avatar_url ?? null } : undefined)} /></div>
                <div>
                  <div className="text-[13.5px] leading-relaxed">{text(f)}</div>
                  <div className="text-[11px] text-[var(--faint)] mt-1">{D.ago(f.created_at)}</div>
                  <Reactions
                    eventId={f.id}
                    reactions={initialReactions[f.id] ?? {}}
                    onChanged={() => { onReload(); router.refresh(); }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <Empty icon="🌊" title="Лента пуста" text="Отметь привычку — здесь появится событие. Добавь друзей, чтобы видеть их прогресс." />
        )}
      </Card>
    </div>
  );
}
