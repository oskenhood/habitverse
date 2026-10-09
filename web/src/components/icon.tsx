import { ICON_PATHS } from '@/lib/icons';

/* Stroke-иконка из набора v2 (24×24, 1.7px). Неизвестное имя деградирует в «spark»,
   но никогда — в текст (урок alpha.3, грабля №46). */
export function Icon({ name, size = 16, className = '' }: { name: string; size?: number; className?: string }) {
  const path = ICON_PATHS[name] ?? ICON_PATHS.spark;
  return (
    <svg
      className={`ic-svg ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}
