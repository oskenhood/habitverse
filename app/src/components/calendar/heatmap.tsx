'use client';

import { useMemo } from 'react';
import { D } from '@/lib/dates';
import { heatLevel } from '@/lib/stats';
import { cn } from '@/lib/utils';

export interface HeatCell {
  key: string;
  value: number | null;
}

/**
 * Heatmap в стиле GitHub: колонки = недели, строки = дни (Пн → Вс).
 * onPick — клик по дню (для отметки задним числом).
 */
export function Heatmap({
  values,
  color,
  onPick,
  cellSize = 13,
}: {
  values: HeatCell[];
  color?: string;
  onPick?: (key: string) => void;
  cellSize?: number;
}) {
  const weeks = useMemo(() => {
    if (!values.length) return [] as HeatCell[][];
    let start = values[0].key;
    while (D.dow(start) !== 0) start = D.add(start, -1);
    const byKey = new Map(values.map((v) => [v.key, v]));
    const cols: HeatCell[][] = [];
    let k = start;
    const last = values[values.length - 1].key;
    while (k <= last) {
      const col: HeatCell[] = [];
      for (let i = 0; i < 7; i += 1) {
        const kk = D.add(k, i);
        col.push(byKey.get(kk) ?? { key: kk, value: null });
      }
      cols.push(col);
      k = D.add(k, 7);
    }
    return cols;
  }, [values]);

  const today = D.today();
  const lvlColor = (lvl: number) => {
    const c = color ?? 'var(--acc)';
    if (lvl <= 0) return 'var(--stroke)';
    if (lvl === 1) return `color-mix(in oklab, ${c} 26%, var(--stroke))`;
    if (lvl === 2) return `color-mix(in oklab, ${c} 50%, var(--stroke))`;
    if (lvl === 3) return `color-mix(in oklab, ${c} 76%, var(--stroke))`;
    return c;
  };

  return (
    <div>
      <div className="overflow-x-auto no-scrollbar pb-1">
        <div className="flex gap-[3px] min-w-max">
          {weeks.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((cell) => {
                const lvl = heatLevel(cell.value);
                const future = cell.key > today;
                const isZero = cell.value !== null && cell.value === 0;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={future || !onPick}
                    onClick={() => onPick?.(cell.key)}
                    title={`${D.full(cell.key)}${cell.value !== null ? ` · ${Math.round(cell.value * 100)}%` : ' · нет плана'}`}
                    className={cn('rounded-[3.5px] transition-transform duration-200', onPick && !future && 'hover:scale-[1.5] hover:z-10 relative')}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: isZero ? 'color-mix(in oklab, var(--bad) 52%, transparent)' : lvlColor(lvl),
                      opacity: cell.value === null && !future ? 0.4 : future ? 0.18 : 1,
                      boxShadow: lvl === 4 ? `0 0 8px ${color ?? 'var(--acc)'}` : undefined,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 items-center text-[11px] text-[var(--faint)] mt-2.5">
        <span>меньше</span>
        {[0, 1, 2, 3, 4].map((l) => <i key={l} className="w-[13px] h-[13px] rounded-[3.5px] block" style={{ background: lvlColor(l) }} />)}
        <span>больше</span>
        <span className="ml-2.5 text-[var(--bad)]">■ провал</span>
      </div>
    </div>
  );
}
