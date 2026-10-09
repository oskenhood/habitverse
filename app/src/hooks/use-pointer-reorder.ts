'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type DragHandlers = {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
};

/**
 * Перетаскивание списка на Pointer Events.
 * Работает и мышью, и пальцем — в отличие от HTML5 Drag-and-Drop,
 * который на тач-устройствах не поддерживается.
 *
 * Как пользоваться:
 *   const { draggingId, overId, containerRef, handlersFor } = usePointerReorder(ids, onCommit);
 *   <div ref={containerRef}>{ids.map(id => <Row {...handlersFor(id)} />)}</div>
 *
 * `onCommit(newOrder)` вызывается один раз после отпускания.
 */
export function usePointerReorder(ids: string[], onCommit: (next: string[]) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overSide, setOverSide] = useState<'before' | 'after' | null>(null);
  const [offset, setOffset] = useState(0);

  const state = useRef<{ id: string | null; startY: number; active: boolean; pointerId: number | null }>({
    id: null,
    startY: 0,
    active: false,
    pointerId: null,
  });

  const reset = useCallback(() => {
    state.current = { id: null, startY: 0, active: false, pointerId: null };
    setDraggingId(null);
    setOverId(null);
    setOverSide(null);
    setOffset(0);
  }, []);

  const handlersFor = useCallback(
    (id: string): DragHandlers => ({
      onPointerDown: (e) => {
        // реагируем только на нажатие по ручке, чтобы не мешать скроллу и кликам
        const target = e.target as HTMLElement;
        if (!target.closest('[data-drag-handle]')) return;
        state.current = { id, startY: e.clientY, active: false, pointerId: e.pointerId };
        e.preventDefault();
      },
      onPointerMove: (e) => {
        const st = state.current;
        if (st.id !== id) return;
        if (!st.active) {
          if (Math.abs(e.clientY - st.startY) < 6) return; // порог срабатывания
          st.active = true;
          setDraggingId(id);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(12);
        }
        e.preventDefault();
        setOffset((prev) => { const v = e.clientY - st.startY; return Math.abs(prev - v) < 2 ? prev : v; });

        const container = containerRef.current;
        if (!container) return;
        const nodes = [...container.querySelectorAll<HTMLElement>('[data-drag-id]')].filter(
          (n) => n.dataset.dragId !== id,
        );
        let found: { id: string; side: 'before' | 'after' } | null = null;
        for (const n of nodes) {
          const r = n.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            found = { id: n.dataset.dragId as string, side: e.clientY < r.top + r.height / 2 ? 'before' : 'after' };
            break;
          }
        }
        setOverId(found?.id ?? null);
        setOverSide(found?.side ?? null);
      },
      onPointerUp: () => {
        const st = state.current;
        if (st.id !== id || !st.active) {
          if (st.id === id) reset();
          return;
        }
        if (overId && overId !== id) {
          const next = ids.filter((x) => x !== id);
          let idx = next.indexOf(overId);
          if (overSide === 'after') idx += 1;
          next.splice(idx < 0 ? next.length : idx, 0, id);
          onCommit(next);
        }
        reset();
      },
      onPointerCancel: () => {
        if (state.current.id === id) reset();
      },
    }),
    [ids, onCommit, overId, overSide, reset],
  );

  // страховка: если указатель ушёл за пределы окна
  useEffect(() => {
    if (!draggingId) return;
    const up = () => {
      if (state.current.active && overId && overId !== state.current.id) {
        const next = ids.filter((x) => x !== state.current.id);
        let idx = next.indexOf(overId);
        if (overSide === 'after') idx += 1;
        next.splice(idx < 0 ? next.length : idx, 0, state.current.id as string);
        onCommit(next);
      }
      reset();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [draggingId, overId, overSide, ids, onCommit, reset]);

  return {
    draggingId,
    overId,
    overSide,
    offset,
    containerRef,
    handlersFor,
    /** визуальное состояние конкретной строки */
    stateFor: (id: string): 'dragging' | 'before' | 'after' | null => {
      if (draggingId === id) return 'dragging';
      if (overId === id && draggingId) return overSide;
      return null;
    },
  };
}
