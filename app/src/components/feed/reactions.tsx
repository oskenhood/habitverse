'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { REACTIONS } from '@/lib/constants';
import { toggleReaction } from '@/lib/actions';

export type ReactionMap = Record<number, Record<string, { count: number; mine: boolean }>>;

/**
 * Реакции на событие ленты (🔥 👏 💪 😮 ❤️).
 * Переключение одним вызовом RPC `toggle_reaction`.
 */
export function Reactions({
  eventId,
  reactions,
  onChanged,
}: {
  eventId: number;
  reactions: Record<string, { count: number; mine: boolean }>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);

  const on = async (emoji: string) => {
    if (busy) return;
    setBusy(emoji);
    setPop(emoji);
    setTimeout(() => setPop(null), 450);
    try {
      await toggleReaction(eventId, emoji);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось поставить реакцию');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      {REACTIONS.map((emoji) => {
        const r = reactions[emoji];
        return (
          <button
            key={emoji}
            type="button"
            disabled={busy === emoji}
            onClick={() => void on(emoji)}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11.5px] font-bold border transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 disabled:opacity-50',
              r?.mine
                ? 'bg-[color-mix(in_oklab,var(--acc)_18%,transparent)] border-[var(--acc)] text-[var(--text)]'
                : 'bg-[var(--bg2)] border-[var(--stroke)] text-[var(--muted)] hover:border-[var(--acc)] hover:text-[var(--text)]',
              pop === emoji && 'hv-pop',
            )}
          >
            {emoji}
            {r?.count ? <b className="tabular">{r.count}</b> : null}
          </button>
        );
      })}
    </div>
  );
}
