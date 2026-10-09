'use client';

import { useEffect, useState } from 'react';
import type { Habit } from '@/types/database';

const KEY = 'hv.3d';

/**
 * 3D-визуализация прогресса.
 *
 * По умолчанию — лёгкая CSS 3D-сфера (три вращающихся кольца, пульсирующее ядро,
 * частицы по числу привычек). Она ничего не весит и работает везде.
 *
 * Полноценный WebGL включается переключателем «3D»: тогда three.js догружается
 * с CDN и в сборку Next.js не попадает вообще. См. `three-sphere.tsx` — там
 * подробно расписано, почему мы отказались от @react-three/fiber в бандле.
 */
export function ProgressSphere({ pct, habits }: { pct: number; habits: Habit[] }) {
  const [webgl, setWebgl] = useState(false);
  const [Scene, setScene] = useState<React.ComponentType<{ pct: number; colors: string[] }> | null>(null);

  useEffect(() => {
    try {
      setWebgl(localStorage.getItem(KEY) === '1');
    } catch {
      /* приватный режим */
    }
  }, []);

  useEffect(() => {
    if (!webgl) {
      setScene(null);
      return;
    }
    let alive = true;
    import('./three-sphere')
      .then((m) => { if (alive) setScene(() => m.ThreeJsSphere); })
      .catch(() => { if (alive) setWebgl(false); });
    return () => { alive = false; };
  }, [webgl]);

  const toggle = () => {
    const next = !webgl;
    setWebgl(next);
    try {
      localStorage.setItem(KEY, next ? '1' : '0');
    } catch {
      /* игнорируем */
    }
  };

  return (
    <div className="relative w-[210px] h-[210px] grid place-items-center">
      {/* CSS-сфера: всегда в DOM, при включённом WebGL просто гаснет */}
      <div className={`orb-scene w-[200px] h-[200px] absolute transition-opacity duration-700 ${webgl && Scene ? 'opacity-0' : 'opacity-100'}`}>
        <div className="orb w-[130px] h-[130px]">
          <div className="orb-ring" />
          <div className="orb-ring" style={{ transform: 'rotateY(60deg)', borderColor: 'var(--acc2)' }} />
          <div className="orb-ring" style={{ transform: 'rotateY(120deg)', borderColor: 'var(--acc3)' }} />
          <div className="orb-core" />
          {habits.slice(0, 10).map((h, i) => (
            <span
              key={h.id}
              className="absolute left-1/2 top-1/2 w-[6px] h-[6px] rounded-full"
              style={{
                background: h.color,
                boxShadow: `0 0 10px ${h.color}`,
                transform: `rotateY(${(i / Math.max(1, habits.length)) * 360}deg) translateZ(${70 + (i % 3) * 14}px)`,
              }}
            />
          ))}
        </div>
      </div>

      {webgl && Scene ? <Scene pct={pct} colors={habits.map((h) => h.color)} /> : null}

      <button
        type="button"
        onClick={toggle}
        title={webgl ? 'Выключить WebGL (three.js с CDN)' : 'Включить WebGL-сферу (three.js догрузится с CDN)'}
        className="absolute bottom-0 right-0 px-2 py-1 rounded-lg text-[10.5px] font-bold border border-[var(--stroke)] bg-[var(--card)] text-[var(--faint)] hover:text-[var(--text)] hover:border-[var(--acc)] transition-colors"
      >
        {webgl ? '3D: WebGL' : '3D: CSS'}
      </button>
    </div>
  );
}
