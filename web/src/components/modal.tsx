'use client';

/* Универсальная модалка (фаза 5.2): разметка и классы — как в v2-демо. */
import { useEffect } from 'react';
import { Icon } from '@/components/icon';

export function Modal({
  title, onClose, children, footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть" title="Закрыть (Esc)">
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
        {footer ? <div className="modal-f">{footer}</div> : null}
      </div>
    </div>
  );
}
