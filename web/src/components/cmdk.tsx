'use client';

/* Палитра команд ⌘K (фаза 5.1): навигация, режим, акценты.
   Правило alpha.3 (грабля №46): иконка — только имя из ICON_PATHS или цветная точка, никогда не текст. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/icon';
import { SECTIONS, THEME_LIST, download, openCatalog, toast, type UiPrefs } from '@/lib/ui';
import { APP_VERSION, D, freqLabel, sortedNotes, visibleHabits } from '@/lib/engine';
import { hv, useHv } from '@/lib/store';

interface Cmd { group: string; icon?: string; dot?: string; title: string; sub?: string; run: () => void }

interface Props {
  open: boolean;
  onClose: () => void;
  onPatch: (p: Partial<UiPrefs>) => void;
  ui: UiPrefs | null;
  accentName: string;
}

export function CmdK({ open, onClose, onPatch, ui, accentName }: Props) {
  const router = useRouter();
  const { state, ready } = useHv();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Cmd[]>(() => {
    const out: Cmd[] = [];
    SECTIONS.forEach((s) => out.push({ group: 'Перейти', icon: s.icon, title: s.name, sub: 'раздел', run: () => router.push(s.href) }));
    if (ui) {
      out.push({
        group: 'Оформление', icon: 'theme',
        title: ui.mode === 'dark' ? 'Светлый режим' : 'Тёмный режим',
        run: () => onPatch({ mode: ui.mode === 'dark' ? 'light' : 'dark' }),
      });
      THEME_LIST.forEach(([id, name, col]) =>
        out.push({ group: 'Оформление', dot: col, title: 'Акцент: ' + name, sub: id === ui.theme ? 'сейчас' : '', run: () => onPatch({ theme: id }) }));
      out.push({
        group: 'Оформление', icon: 'sliders',
        title: ui.density === 'compact' ? 'Обычная плотность' : 'Компактная плотность',
        run: () => onPatch({ density: ui.density === 'compact' ? 'cozy' : 'compact' }),
      });
    }
    out.push({ group: 'Создать', icon: 'plus', title: 'Новая привычка', sub: 'открыть форму', run: () => router.push('/habits?new=1') });
    out.push({ group: 'Создать', icon: 'coin', title: 'Новая запись расходов', sub: 'финансы', run: () => router.push('/finance?new=1') });
    out.push({ group: 'Создать', icon: 'book', title: 'Каталог привычек', sub: '30 готовых', run: () => openCatalog() });
    out.push({ group: 'Создать', icon: 'note', title: 'Новая заметка', sub: '', run: () => router.push('/notes?new=1') });
    out.push({ group: 'Создать', icon: 'flag', title: 'Новый челлендж', sub: '', run: () => router.push('/team?new=1') });
    if (ready) {
      visibleHabits(state).slice(0, 30).forEach((h) => out.push({
        group: 'Привычки', dot: h.color, title: h.name, sub: freqLabel(h),
        run: () => router.push(`/habits?focus=${encodeURIComponent(h.id)}`),
      }));
      sortedNotes(state).slice(0, 20).forEach((n) => out.push({
        group: 'Заметки', icon: 'note', title: n.title || 'Без названия', sub: (n.tags || []).map((t) => '#' + t).join(' '),
        run: () => router.push(`/notes?open=${encodeURIComponent(n.id)}`),
      }));
    }
    out.push({ group: 'Данные', icon: 'download', title: 'Загрузить демо-данные', sub: '13 привычек с историей', run: () => { hv.seed(); toast('Демо-данные загружены', 'ok'); } });
    out.push({ group: 'Данные', icon: 'upload', title: 'Экспорт JSON', sub: '', run: () => { download(`habitverse-export-${D.today()}.json`, JSON.stringify(hv.get(), null, 2), 'application/json'); toast('Экспорт JSON скачан', 'ok'); } });
    out.push({ group: 'Данные', icon: 'download', title: 'Экспорт CSV', sub: 'все отметки', run: () => hv.exportCsv() });
    out.push({ group: 'Справка', icon: 'info', title: 'Версия', sub: APP_VERSION, run: () => toast(`HabitVerse web ${APP_VERSION}: Обзор, Привычки, Календарь, Отчёты, Финансы, Заметки, Команда`, 'info') });
    return out;
  }, [router, ui, onPatch, state, ready]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => !query || (it.title + ' ' + (it.sub || '') + ' ' + it.group).toLowerCase().includes(query));
  }, [items, q]);

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => { setSel((s) => Math.min(s, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  if (!open) return null;

  const run = (it?: Cmd) => { if (!it) return; onClose(); it.run(); };
  let lastGroup: string | null = null;

  return (
    <div className="cmdk">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="cmdk-box" role="dialog" aria-modal="true" aria-label="Поиск и команды">
        <div className="cmdk-input">
          <span style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center' }}><Icon name="search" size={15} /></span>
          <input
            ref={inputRef}
            placeholder="Поиск, разделы, команды…"
            value={q}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); run(filtered[sel]); }
              else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            }}
          />
        </div>
        <div className="cmdk-list" ref={listRef}>
          {filtered.length ? filtered.map((it, i) => {
            const head = it.group !== lastGroup ? <div key={'g' + it.group + i} className="cmdk-group">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={i}>
                {head}
                <div
                  className={`cmdk-item ${i === sel ? 'sel' : ''}`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => run(it)}
                >
                  <span className="ic">
                    {it.dot ? <i className="dot" style={{ background: it.dot }} /> : <Icon name={it.icon || 'spark'} size={15} />}
                  </span>
                  <span className="tx">{it.title}</span>
                  {it.sub ? <span className="sub">{it.sub}</span> : null}
                </div>
              </div>
            );
          }) : (
            <div className="empty" style={{ padding: '34px 16px' }}>
              <span className="em"><Icon name="search" size={26} /></span>
              <p>Ничего не нашлось по запросу «{q}»</p>
            </div>
          )}
        </div>
        <div className="cmdk-foot">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> навигация</span>
          <span><span className="kbd">↵</span> выбрать</span>
          <span><span className="kbd">esc</span> закрыть</span>
          <span style={{ marginLeft: 'auto' }}>акцент: {accentName}</span>
        </div>
      </div>
    </div>
  );
}
