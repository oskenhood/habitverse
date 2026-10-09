/* Аватар: инициал(ы) на мягком тоне или фото (порт avatarHtml из v2, правило alpha.2 — без градиентов). */
import { hueFor } from '@/lib/ui';

export interface AvatarPerson {
  name?: string;
  display_name?: string;
  avatar_url?: string;
}

export function Avatar({ p, size = 28 }: { p: AvatarPerson | null | undefined; size?: number }) {
  if (p && p.avatar_url) {
    return (
      <span className="avatar" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.avatar_url} alt="" />
      </span>
    );
  }
  const name = (p && (p.display_name || p.name)) || '';
  const letter = [...name.trim()][0]?.toUpperCase() || '·';
  const hue = hueFor(name || letter);
  return (
    <span
      className="avatar"
      title={name}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `color-mix(in oklab, ${hue} 13%, var(--surface))`,
        color: `color-mix(in oklab, ${hue} 74%, var(--text))`,
        borderColor: `color-mix(in oklab, ${hue} 24%, var(--border))`,
      }}
    >
      {letter}
    </span>
  );
}
