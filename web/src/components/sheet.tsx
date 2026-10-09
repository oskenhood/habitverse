'use client';

/* Шит (нижняя панель на мобильном, центрированный на десктопе) — классы v2 .sheet-root/.sheet.
   Заголовок рисуется внутри children (div.modal-h) — как в демо. */
import { useEffect } from 'react';

export function Sheet({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-root">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
