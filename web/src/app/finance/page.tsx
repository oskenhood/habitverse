'use client';

/* ============================================================
   Финансы (F-2, отзыв Максима) — «импровизированный Excel» расходов.
   Реестр: дата / тип / наименование в вольной форме / сумма.
   Итоги: день · неделя · месяц (переключатель периода + стрелки).
   Выводы: самый затратный тип, названия по убыванию, пьедестал
   топ-3 трат периода с «цитатами пользователя» (наименования —
   вольный текст, они и есть цитаты). Оформление — спокойный
   Notion-стиль по docs/DESIGN.md, без эмодзи в хроме.
   Персист: localStorage (habitverse.v1 → expenses); в 5.4 — SQL.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { ExpenseModal } from '@/components/expense-modal';
import { ConfirmDialog } from '@/components/confirm';
import { hv, useHv } from '@/lib/store';
import {
  D, EXPENSE_TYPES, capFirst, expenseTypeStyle, finLabel, finPeriod, finShift, finSummary,
  fmtMoney, type FinPeriod,
} from '@/lib/engine';
import { toast } from '@/lib/ui';

const PERIODS: Array<[FinPeriod, string, string]> = [
  ['day', 'День', 'Дневной итог'],
  ['week', 'Неделя', 'Недельный итог'],
  ['month', 'Месяц', 'Месячный итог'],
];

function TypeChip({ type }: { type: string }) {
  const st = expenseTypeStyle(type);
  return (
    <span className="fin-type" style={{ color: st.color }} title={`Тип расхода: ${type}`}>
      <Icon name={st.icon} size={12} /> {capFirst(type)}
    </span>
  );
}

export default function FinancePage() {
  const { state, ready } = useHv();
  const [period, setPeriod] = useState<FinPeriod>('month');
  const [anchor, setAnchor] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  /* быстрая форма добавления (как строка Excel: дата · тип · название · сумма) */
  const [fDate, setFDate] = useState('');
  const [fType, setFType] = useState('');
  const [fName, setFName] = useState('');
  const [fAmount, setFAmount] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  /* дата по умолчанию — сегодня, но только на клиенте (SSR рисует скелетон) */
  useEffect(() => {
    setAnchor(D.today());
    setFDate(D.today());
    const p = new URLSearchParams(window.location.search);
    const per = p.get('period');
    if (per === 'day' || per === 'week' || per === 'month') setPeriod(per);
    if (p.get('new') === '1') setTimeout(() => nameRef.current?.focus(), 60);
  }, []);

  /* грабля №53: зависимости только на верхнюю ссылку state */
  const data = useMemo(() => {
    const a = anchor || D.today();
    const range = finPeriod(period, a);
    return {
      a,
      range,
      label: finLabel(period, range),
      summary: finSummary(state, range),
      monthTotal: finSummary(state, finPeriod('month')).total,
      rows: state.expenses.slice().sort((x, y) => (x.date === y.date ? y.ts - x.ts : (x.date < y.date ? 1 : -1))),
    };
  }, [state, period, anchor]);

  const { range, summary, rows } = data;
  const isCurrent = data.a === D.today();

  const submitQuick = (): void => {
    const res = hv.addExpenseBy({ date: fDate || D.today(), type: fType, name: fName, amount: Number(fAmount) });
    if (!res.ok) { toast(res.error, 'warn'); return; }
    toast(`Записано: ${fmtMoney(res.expense.amount)}`, 'ok');
    /* как в Excel: строка добавлена — курсор в следующую, дата и тип остаются */
    setFName(''); setFAmount('');
    nameRef.current?.focus();
  };

  const delExpense = rows.find((e) => e.id === delId) || null;

  return (
    <>
      <PageHead
        title="Финансы"
        sub={ready ? `${rows.length} записей · ${fmtMoney(data.monthTotal)} за этот месяц` : 'Загрузка…'}
        crumbs={[{ name: 'Финансы' }]}
        actions={<>
          <button className="btn" title="Скачать CSV со всеми записями реестра" disabled={!ready || rows.length === 0}
            onClick={() => hv.exportExpensesCsv()}>
            <Icon name="download" size={14} /> Экспорт CSV
          </button>
          <button className="btn btn-primary" title="Фокус на форму быстрой записи"
            onClick={() => nameRef.current?.focus()}>
            <Icon name="plus" size={14} /> Новая запись
          </button>
        </>}
      />

      <section className="page active">
        {/* переключатель периода: дневной / недельный / месячный итог */}
        <div className="fin-period">
          <div className="fin-period-nav">
            <button className="icon-btn" aria-label="Предыдущий период" title="Предыдущий период"
              onClick={() => setAnchor(finShift(period, data.a, -1))}>
              <Icon name="chevL" size={15} />
            </button>
            <div className="fin-period-label">{ready ? data.label : '…'}</div>
            <button className="icon-btn" aria-label="Следующий период" title="Следующий период"
              disabled={isCurrent}
              onClick={() => setAnchor(finShift(period, data.a, 1))}>
              <Icon name="chevR" size={15} />
            </button>
            {!isCurrent && ready ? (
              <button className="btn btn-sm" onClick={() => setAnchor(D.today())}>Текущий</button>
            ) : null}
          </div>
          <div className="fin-period-chips">
            {PERIODS.map(([id, name, title]) => (
              <button key={id} className={`chip ${period === id ? 'on' : ''}`} title={title}
                onClick={() => setPeriod(id)}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {!ready ? (
          <div className="empty card"><span className="em"><Icon name="coin" size={30} /></span><h3>Загружаем данные…</h3></div>
        ) : (
          <>
            {/* KPI периода — клиентский маркер гидратации (.fin-kpis) */}
            <div className="fin-kpis">
              <div className="metric">
                <div className="label">Итого за период</div>
                <div className="val">{fmtMoney(summary.total)}</div>
                <div className="delta">{summary.count} записей · {data.label}</div>
              </div>
              <div className="metric">
                <div className="label">В среднем в день</div>
                <div className="val">{fmtMoney(summary.avgPerDay)}</div>
                <div className="delta">за {summary.days} дн. периода</div>
              </div>
              <div className="metric">
                <div className="label">Самый затратный тип</div>
                <div className="val" style={{ fontSize: 18, paddingTop: 5 }}>
                  {summary.topType ? capFirst(summary.topType.type) : '—'}
                </div>
                <div className="delta">
                  {summary.topType
                    ? `${fmtMoney(summary.topType.total)} · ${Math.round(summary.topType.share * 100)}% трат`
                    : 'нет данных за период'}
                </div>
              </div>
              <div className="metric">
                <div className="label">Рекорд периода</div>
                <div className="val">{summary.podium[0] ? fmtMoney(summary.podium[0].amount) : '—'}</div>
                <div className="delta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {summary.podium[0] ? `«${summary.podium[0].name}»` : 'нет данных за период'}
                </div>
              </div>
            </div>

            {summary.count === 0 ? (
              <div className="empty card">
                <span className="em"><Icon name="coin" size={30} /></span>
                <h3>{rows.length === 0 ? 'Пока ни одной траты' : 'За этот период трат нет'}</h3>
                <p>
                  {rows.length === 0
                    ? 'Добавьте первую запись в форме под итогами: тип расхода, наименование в вольной форме и сумма. Итоги, пьедестал и топы посчитаются сами.'
                    : 'Переключите период стрелками или добавьте запись — реестр ниже показывает все записи сразу.'}
                </p>
                {rows.length === 0 && state.habits.length === 0 ? (
                  <button className="btn" onClick={() => { hv.seed(); toast('Демо-данные загружены', 'ok'); }}>
                    <Icon name="download" size={14} /> Демо-данные
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                {/* пьедестал: топ-3 траты периода, 2-1-3, «цитаты пользователя» */}
                <div className="card fin-pod-card">
                  <div className="card-h">
                    <h3>Пьедестал периода</h3>
                    <span className="sp small muted">первое место по тратам — и цитата автора</span>
                  </div>
                  <div className="fin-podium">
                    {[1, 0, 2].map((place, i) => {
                      const e = summary.podium[place];
                      if (!e) return <div key={place} className="pedestal-slot" aria-hidden="true" />;
                      const st = expenseTypeStyle(e.type);
                      return (
                        <div key={e.id} className={`pedestal p${place + 1}`} style={{ ['--d' as string]: `${i * 70}ms` }}>
                          <div className="medal num">{place + 1}</div>
                          <div className="quote">«{e.name}»</div>
                          <div className="amt num">{fmtMoney(e.amount)}</div>
                          <div className="meta">
                            <span className="fin-type" style={{ color: st.color }}>
                              <Icon name={st.icon} size={11} /> {capFirst(e.type)}
                            </span>
                            <span className="xs faint">{D.human(e.date)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="fin-grid2">
                  {/* разбивка по типам — самый затратный сверху */}
                  <div className="card">
                    <div className="card-h">
                      <h3>Куда уходят деньги</h3>
                      <span className="sp small muted">по типам, {summary.count} записей</span>
                    </div>
                    {summary.byType.map((t) => {
                      const st = expenseTypeStyle(t.type);
                      return (
                        <div className="fin-type-row" key={t.type}>
                          <span className="fin-type" style={{ color: st.color }} title={`${t.count} записей`}>
                            <Icon name={st.icon} size={13} /> {capFirst(t.type)}
                          </span>
                          <span className="fin-track">
                            <i style={{ width: `${Math.max(2, Math.round(t.share * 100))}%`, background: st.color }} />
                          </span>
                          <span className="fin-val num">{fmtMoney(t.total)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* названия по убыванию (агрегат одинаковых имён) */}
                  <div className="card">
                    <div className="card-h">
                      <h3>Названия по убыванию</h3>
                      <span className="sp small muted">сумма одинаковых названий</span>
                    </div>
                    {summary.topNames.slice(0, 8).map((n, i) => (
                      <div className="fin-name-row" key={n.name.toLowerCase()} title={n.count > 1 ? `${n.count} записей, крупнейшая: ${fmtMoney(n.best.amount)}` : undefined}>
                        <span className="place num">{i + 1}</span>
                        <span className="q">«{n.name}»</span>
                        {n.count > 1 ? <span className="fin-count num">×{n.count}</span> : null}
                        <span className="fin-val num">{fmtMoney(n.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* реестр — «импровизированный Excel»: форма быстрой записи + таблица */}
            <div className="card fin-reg">
              <div className="card-h">
                <h3>Реестр</h3>
                <span className="sp small muted">все записи · дата, тип, наименование, сумма</span>
              </div>

              <div className="fin-add">
                <input className="input fin-f-date" type="date" aria-label="Дата траты" value={fDate}
                  onChange={(e) => setFDate(e.target.value)} />
                <input className="input fin-f-type" list="fin-types" aria-label="Тип расхода" maxLength={40}
                  placeholder="Тип расхода" value={fType} onChange={(e) => setFType(e.target.value)} />
                <datalist id="fin-types">
                  {EXPENSE_TYPES.map((t) => <option key={t.name} value={t.name} />)}
                </datalist>
                <input className="input fin-f-name" ref={nameRef} aria-label="Наименование" maxLength={120}
                  placeholder="Наименование в вольной форме…" value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitQuick(); }} />
                <input className="input fin-f-amt num" type="number" min="0.01" step="0.01" aria-label="Сумма"
                  placeholder="Сумма, ₽" value={fAmount}
                  onChange={(e) => setFAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitQuick(); }} />
                <button className="btn btn-primary" onClick={submitQuick} aria-label="Добавить запись">
                  <Icon name="plus" size={14} /> Добавить
                </button>
              </div>

              {rows.length === 0 ? (
                <p className="small muted" style={{ padding: '10px 0 2px' }}>
                  Записей пока нет — первая же строка появится здесь.
                </p>
              ) : (
                <div className="fin-table-wrap">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th className="c-date">Дата</th>
                        <th className="c-type">Тип</th>
                        <th className="c-name">Наименование</th>
                        <th className="c-amt">Сумма</th>
                        <th className="c-act" aria-label="Действия" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((e, i) => (
                        <tr className="fin-row" key={e.id} data-id={e.id} data-date={e.date}
                          style={{ animationDelay: `${Math.min(i, 14) * 14}ms` }}>
                          <td className="c-date" title={D.full(e.date)}>{D.human(e.date)}</td>
                          <td className="c-type"><TypeChip type={e.type} /></td>
                          <td className="c-name" title={e.name}>{e.name}</td>
                          <td className="c-amt num">{fmtMoney(e.amount)}</td>
                          <td className="c-act">
                            <button className="fin-act" aria-label="Редактировать" title="Редактировать"
                              onClick={() => setEditId(e.id)}>
                              <Icon name="pencil" size={13} />
                            </button>
                            <button className="fin-act danger" aria-label="Удалить" title="Удалить"
                              onClick={() => setDelId(e.id)}>
                              <Icon name="trash" size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {editId !== null ? <ExpenseModal editId={editId} onClose={() => setEditId(null)} /> : null}
      {delExpense ? (
        <ConfirmDialog
          title="Удалить запись?"
          text={`«${delExpense.name}» · ${fmtMoney(delExpense.amount)} · ${D.human(delExpense.date)}. Запись исчезнет из реестра и итогов.`}
          label="Удалить"
          onConfirm={() => { hv.removeExpenseById(delExpense.id); toast('Запись удалена', 'warn'); }}
          onClose={() => setDelId(null)}
        />
      ) : null}
    </>
  );
}
