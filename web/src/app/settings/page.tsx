'use client';

/* Настройки: профиль, оформление, данные (демо, экспорт/импорт JSON-бэкапа, сброс).
   Полные настройки (приватность, напоминания, Supabase-синк) — фаза 5.4. */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { hv, useHv } from '@/lib/store';
import { toast } from '@/lib/ui';

export default function SettingsPage() {
  const { state, ready } = useHv();
  const [name, setName] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { if (ready) setName(state.profile.name || ''); }, [ready, state.profile.name]);

  const saveName = () => {
    const v = name.trim().slice(0, 40);
    hv.mutate((s) => { s.profile.name = v; });
    toast(v ? 'Имя сохранено' : 'Имя очищено', 'ok');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(hv.get(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `habitverse-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Экспорт JSON скачан', 'ok');
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';   // повторный выбор того же файла должен срабатывать
    if (!file) return;
    let text = '';
    try { text = await file.text(); } catch { toast('Не удалось прочитать файл', 'warn'); return; }
    // Импорт полностью заменяет данные — просим подтверждение, показав, что за файл
    setPendingText(text);
    setConfirmImport(true);
  };

  const doImport = () => {
    setConfirmImport(false);
    if (pendingText == null) return;
    const r = hv.importJson(pendingText);
    setPendingText(null);
    if (r.ok) toast(`Импорт выполнен: ${r.habits} привычек`, 'ok');
    else toast(`Импорт не удался: ${r.error}`, 'warn');
  };

  const bytes = ready ? new Blob([JSON.stringify(state)]).size : 0;

  return (
    <>
      <PageHead title="Настройки" sub="Профиль, оформление и данные (бэкап: экспорт/импорт JSON)" crumbs={[{ name: 'Настройки' }]} />
      <section className="page active">
        <div className="stack" style={{ maxWidth: 640 }}>
          <div className="card">
            <div className="card-h"><Icon name="users" size={15} /><h3>Профиль</h3></div>
            <label className="label" htmlFor="setName" style={{ display: 'block', marginBottom: 6 }}>Имя</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="setName" className="input" style={{ flex: 1 }} maxLength={40} placeholder="Как вас зовут?"
                value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} />
              <button className="btn btn-primary" onClick={saveName} disabled={!ready}>Сохранить</button>
            </div>
            <div className="hint">Имя используется для аватара-инициалов в шапке и сайдбаре. Полноценный профиль (био, дата рождения, приватность) — фаза 5.4.</div>
          </div>

          <div className="card">
            <div className="card-h"><Icon name="dash" size={15} /><h3>Оформление</h3></div>
            <p className="hint" style={{ marginTop: 0 }}>Режим (светлый/тёмный), 8 мягких акцентов и плотность переключаются в меню <Icon name="theme" size={12} /> в шапке или через ⌘K → «Оформление».</p>
          </div>

          <div className="card">
            <div className="card-h"><Icon name="download" size={15} /><h3>Данные</h3><div className="sp" /><span className="num" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ready ? `${(bytes / 1024).toFixed(1)} КБ в localStorage` : '…'}</span></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => { hv.seed(); toast('Демо-данные загружены', 'ok'); }}>
                <Icon name="spark" size={14} /> Загрузить демо-данные
              </button>
              <button className="btn" onClick={exportJson} disabled={!ready}>
                <Icon name="upload" size={14} /> Экспорт JSON
              </button>
              {confirmImport ? (
                <>
                  <button className="btn btn-primary" onClick={doImport}>
                    <Icon name="check" size={14} /> Точно импортировать
                  </button>
                  <button className="btn btn-quiet" onClick={() => { setConfirmImport(false); setPendingText(null); }}>Отмена</button>
                </>
              ) : (
                <button className="btn" onClick={() => fileRef.current?.click()} disabled={!ready}>
                  <Icon name="download" size={14} /> Импорт JSON
                </button>
              )}
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => { void onFile(e); }} />
              {confirmReset ? (
                <>
                  <button className="btn btn-danger" onClick={() => { hv.reset(); setConfirmReset(false); toast('Данные удалены', 'warn'); }}>
                    <Icon name="trash" size={14} /> Точно удалить
                  </button>
                  <button className="btn btn-quiet" onClick={() => setConfirmReset(false)}>Отмена</button>
                </>
              ) : (
                <button className="btn btn-danger" onClick={() => setConfirmReset(true)} disabled={!ready}>
                  <Icon name="trash" size={14} /> Сбросить всё
                </button>
              )}
            </div>
            <div className="hint">Данные хранятся локально в браузере (ключ habitverse.v1 — тот же, что у демо). «Экспорт JSON» — бэкап: файл можно вернуть через «Импорт JSON» (полностью заменит текущие данные) или открыть в демо. Синхронизация с облаком (Supabase) — фаза 5.4.</div>
          </div>
        </div>
      </section>
    </>
  );
}
