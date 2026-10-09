'use client';

/* Тосты: слушают шину событий hv:toast (lib/ui.ts). Иконка — по типу, как в alpha.3. */
import { useEffect, useState } from 'react';
import { Icon } from '@/components/icon';
import type { ToastKind } from '@/lib/ui';

const TOAST_ICON: Record<ToastKind, string> = { ok: 'check', info: 'info', warn: 'warn' };

interface Item { id: number; msg: string; kind: ToastKind }
let seq = 1;

export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const onToast = (e: Event) => {
      const { msg, kind } = (e as CustomEvent<{ msg: string; kind: ToastKind }>).detail;
      const id = seq++;
      setItems((prev) => [...prev, { id, msg, kind }]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 3200);
    };
    window.addEventListener('hv:toast', onToast);
    return () => window.removeEventListener('hv:toast', onToast);
  }, []);

  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="ti"><Icon name={TOAST_ICON[t.kind]} size={15} /></span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
