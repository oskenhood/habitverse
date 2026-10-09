'use client';

/* ============================================================
   Модалка записи расхода (F-2 «Финансы»): создание и правка.
   Поля — как в реестре: дата, тип (пресет или свой), наименование
   в вольной форме, сумма. Удаление — с подтверждением на месте.
   ============================================================ */
import { useRef, useState } from 'react';
import { Modal } from '@/components/modal';
import { Icon } from '@/components/icon';
import { hv, useHv } from '@/lib/store';
import { D, EXPENSE_TYPES } from '@/lib/engine';
import { toast } from '@/lib/ui';

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' };
const labelStyle: React.CSSProperties = { marginBottom: 5, display: 'block' };

export function ExpenseModal({
  editId, defaultDate, onClose,
}: {
  editId: string | null;
  defaultDate?: string;
  onClose: () => void;
}) {
  const { state } = useHv();
  const editing = editId ? state.expenses.find((e) => e.id === editId) || null : null;
  const [date, setDate] = useState(editing?.date || defaultDate || D.today());
  const [type, setType] = useState(editing?.type || '');
  const [name, setName] = useState(editing?.name || '');
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [confirmDel, setConfirmDel] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const save = (): void => {
    const data = { date, type, name, amount: Number(amount) };
    if (editing) {
      const res = hv.updateExpenseById(editing.id, data);
      if (!res.ok) { toast(res.error, 'warn'); return; }
      toast('Запись обновлена', 'ok');
    } else {
      const res = hv.addExpenseBy(data);
      if (!res.ok) { toast(res.error, 'warn'); return; }
      toast('Запись добавлена', 'ok');
    }
    onClose();
  };

  const remove = (): void => {
    if (editing) { hv.removeExpenseById(editing.id); toast('Запись удалена', 'warn'); }
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Редактировать запись' : 'Новая запись расхода'}
      onClose={onClose}
      footer={<>
        {editing ? (
          confirmDel ? (
            <>
              <span className="label" style={{ marginRight: 'auto', textTransform: 'none', fontWeight: 400 }}>Удалить запись?</span>
              <button className="btn" onClick={() => setConfirmDel(false)}>Отмена</button>
              <button className="btn btn-danger" onClick={remove}><Icon name="trash" size={14} /> Удалить</button>
            </>
          ) : (
            <>
              <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDel(true)}>
                <Icon name="trash" size={14} /> Удалить
              </button>
              <button className="btn" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} /> Сохранить</button>
            </>
          )
        ) : (
          <>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} /> Добавить</button>
          </>
        )}
      </>}
    >
      <div style={fieldStyle}>
        <div>
          <label className="label" style={labelStyle} htmlFor="emDate">Дата</label>
          <input id="emDate" className="input" type="date" style={{ width: '100%' }} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" style={labelStyle} htmlFor="emType">Тип расхода</label>
          <input id="emType" className="input" style={{ width: '100%' }} list="fin-types-modal" maxLength={40}
            placeholder="еда, транспорт… или свой вариант" value={type}
            onChange={(e) => setType(e.target.value)} />
          <datalist id="fin-types-modal">
            {EXPENSE_TYPES.map((t) => <option key={t.name} value={t.name} />)}
          </datalist>
        </div>
        <div>
          <label className="label" style={labelStyle} htmlFor="emName">Наименование <span style={{ textTransform: 'none', fontWeight: 400 }}>(в вольной форме)</span></label>
          <input id="emName" ref={nameRef} className="input" style={{ width: '100%' }} maxLength={120}
            placeholder="Например: жёстко навернул габаджоу в китайке" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        </div>
        <div>
          <label className="label" style={labelStyle} htmlFor="emAmount">Сумма, ₽</label>
          <input id="emAmount" className="input num" style={{ width: '100%' }} type="number" min="0.01" step="0.01"
            placeholder="0" value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        </div>
      </div>
    </Modal>
  );
}
