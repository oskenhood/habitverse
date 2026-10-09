'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/* ----------------------------- Button ----------------------------- */
type Variant = 'primary' | 'ghost' | 'soft' | 'danger';
type Size = 'sm' | 'md' | 'icon' | 'iconSm';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white bg-[linear-gradient(135deg,var(--acc),var(--acc3))] shadow-[0_10px_26px_-12px_var(--acc)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_var(--acc)]',
  ghost: 'bg-[var(--card)] border border-[var(--stroke)] text-[var(--text)] hover:border-[var(--acc)] hover:bg-[color-mix(in_oklab,var(--acc)_14%,transparent)] hover:-translate-y-0.5',
  soft: 'bg-[color-mix(in_oklab,var(--acc)_18%,transparent)] border border-[color-mix(in_oklab,var(--acc)_32%,transparent)] text-[var(--text)] hover:bg-[color-mix(in_oklab,var(--acc)_28%,transparent)]',
  danger: 'bg-[color-mix(in_oklab,var(--bad)_16%,transparent)] border border-[color-mix(in_oklab,var(--bad)_40%,transparent)] text-[var(--bad)] hover:bg-[var(--bad)] hover:text-white',
};
const SIZES: Record<Size, string> = {
  sm: 'px-3 py-2 text-[13px] rounded-[11px]',
  md: 'px-[18px] py-[11px] text-sm rounded-[14px]',
  icon: 'w-10 h-10 rounded-xl text-[17px] px-0',
  iconSm: 'w-8 h-8 rounded-[9px] text-sm px-0',
};

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-bold whitespace-nowrap overflow-hidden transition-all duration-300 disabled:opacity-45 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...(rest as object)}
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------ Card ------------------------------ */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass rounded-[var(--r-lg)] p-4 relative transition-colors duration-300 hover:border-[var(--stroke2)]', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHead({ title, right, sub }: { title: ReactNode; right?: ReactNode; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <h3 className="text-[15.5px] font-bold tracking-tight">{title}</h3>
      {sub && <span className="text-[11px] text-[var(--faint)]">{sub}</span>}
      <div className="flex-1" />
      {right}
    </div>
  );
}

/* ------------------------------ Pill ------------------------------ */
export function Pill({
  children,
  tone,
  className,
  style,
}: {
  children: ReactNode;
  tone?: 'ok' | 'bad' | 'warn' | 'none';
  className?: string;
  style?: React.CSSProperties;
}) {
  const tones = {
    ok: 'text-[var(--ok)] border-[color-mix(in_oklab,var(--ok)_40%,transparent)] bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]',
    bad: 'text-[var(--bad)] border-[color-mix(in_oklab,var(--bad)_40%,transparent)] bg-[color-mix(in_oklab,var(--bad)_12%,transparent)]',
    warn: 'text-[var(--warn)] border-[color-mix(in_oklab,var(--warn)_40%,transparent)] bg-[color-mix(in_oklab,var(--warn)_12%,transparent)]',
    none: 'text-[var(--muted)] border-[var(--stroke)] bg-[var(--card)]',
  };
  return (
    <span
      className={cn('inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[11px] font-extrabold border tracking-tight', tones[tone ?? 'none'], className)}
      style={style}
    >
      {children}
    </span>
  );
}

/* ------------------------------ Chip ------------------------------ */
export function Chip({
  active,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold border transition-all duration-200 hover:-translate-y-px',
        active
          ? 'bg-[var(--acc)] border-[var(--acc)] text-white shadow-[0_6px_18px_-8px_var(--acc)]'
          : 'bg-[var(--card)] border-[var(--stroke)] text-[var(--muted)] hover:border-[var(--acc)] hover:text-[var(--text)]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ----------------------------- Toggle ----------------------------- */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn(
        'relative w-[46px] h-[26px] rounded-full transition-colors duration-300 shrink-0',
        on ? 'bg-[var(--acc)]' : 'bg-[var(--stroke)]',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform duration-300',
          on && 'translate-x-5',
        )}
      />
    </button>
  );
}

/* ----------------------------- Inputs ----------------------------- */
const FIELD =
  'w-full px-3.5 py-[11px] rounded-xl bg-[var(--bg2)] border border-[var(--stroke)] text-[var(--text)] text-sm outline-none transition-all duration-200 focus:border-[var(--acc)] focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--acc)_18%,transparent)] placeholder:text-[var(--faint)]';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...rest} />;
}
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, 'resize-y min-h-24 leading-relaxed', className)} {...rest} />;
}
export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        FIELD,
        'appearance-none pr-9 bg-no-repeat bg-[right_13px_center]',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%239aa0c3' stroke-width='2'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-[11.5px] font-bold text-[var(--muted)] mb-1.5 uppercase tracking-[.08em]">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-[var(--faint)] mt-1.5 leading-snug">{hint}</span>}
    </label>
  );
}

/* ---------------------------- Progress ---------------------------- */
export function Progress({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn('h-2 rounded-full bg-[var(--stroke)] overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out relative overflow-hidden"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? 'linear-gradient(90deg,var(--acc),var(--acc2))' }}
      >
        <span className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent)] animate-[hv-shimmer_2.4s_linear_infinite]" />
      </div>
    </div>
  );
}

/* ----------------------------- Empty ------------------------------ */
export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="glass rounded-[var(--r-lg)] text-center py-14 px-5">
      <span className="text-[52px] block mb-3.5 hv-bob">{icon}</span>
      <h3 className="text-base font-bold mb-2">{title}</h3>
      {text && <p className="text-[var(--muted)] text-sm max-w-md mx-auto mb-4 leading-relaxed">{text}</p>}
      {action}
    </div>
  );
}

/* --------------------------- SettingRow --------------------------- */
export function SettingRow({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3.5 py-3 border-b border-[var(--stroke)] last:border-0">
      <div className="flex-1 min-w-0">
        <b className="block text-[13.8px]">{title}</b>
        {desc && <span className="text-xs text-[var(--faint)]">{desc}</span>}
      </div>
      {children}
    </div>
  );
}
