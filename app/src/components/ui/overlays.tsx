'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { Button } from './primitives';

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[rgba(3,4,10,.72)] backdrop-blur-[9px]"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 26, scale: 0.94, rotateX: 6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-[620px]'} max-h-[88dvh] overflow-auto rounded-[var(--r-lg)] bg-[var(--card-solid)] border border-[var(--stroke2)] shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)] p-6`}
          >
            <div className="flex items-center gap-3 mb-5">
              {icon && <span className="text-[28px] leading-none">{icon}</span>}
              <h2 className="text-[19px] font-bold tracking-tight flex-1">{title}</h2>
              <Button size="iconSm" onClick={onClose} aria-label="Закрыть">✕</Button>
            </div>
            {children}
            {footer && (
              <div className="flex gap-2.5 justify-end mt-6 pt-4 border-t border-[var(--stroke)] sticky bottom-0 bg-[var(--card-solid)] -mx-6 px-6 -mb-6 pb-6 pt-5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-end sm:place-items-center p-0 sm:p-5">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[rgba(3,4,10,.72)] backdrop-blur-[9px]" onClick={onClose} />
          <motion.div
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full sm:max-w-[560px] max-h-[86dvh] overflow-auto rounded-t-[var(--r-lg)] sm:rounded-[var(--r-lg)] bg-[var(--card-solid)] border border-[var(--stroke2)] p-6"
          >
            <div className="absolute left-1/2 -translate-x-1/2 top-2.5 w-11 h-1 rounded-full bg-[var(--stroke2)] sm:hidden" />
            <div className="flex items-center gap-3 mb-4">
              {icon && <span className="text-[26px] leading-none">{icon}</span>}
              <h2 className="text-[17px] font-bold tracking-tight flex-1">{title}</h2>
              <Button size="iconSm" onClick={onClose} aria-label="Закрыть">✕</Button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = 'Удалить',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text: string;
  confirmLabel?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-[var(--muted)] leading-relaxed text-sm">{text}</p>
    </Modal>
  );
}
