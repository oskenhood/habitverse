'use client';

/* Диалог подтверждения (порт confirmDialog из v2). */
import { Modal } from '@/components/modal';

export function ConfirmDialog({
  title, text, label = 'Удалить', onConfirm, onClose,
}: {
  title: string; text: string; label?: string; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Отмена</button>
        <button className="btn btn-danger" onClick={() => { onClose(); onConfirm(); }}>{label}</button>
      </>}
    >
      <p className="muted" style={{ lineHeight: 1.6 }}>{text}</p>
    </Modal>
  );
}
