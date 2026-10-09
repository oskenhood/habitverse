import Link from 'next/link';
import { Icon } from '@/components/icon';

/* Шапка страницы: breadcrumbs + заголовок + действия (как в v2-демо). */
export function PageHead({
  title, sub, crumbs, actions,
}: {
  title: string;
  sub?: string;
  crumbs: Array<{ name: string; href?: string }>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <nav className="crumbs" aria-label="Хлебные крошки">
        <Link href="/">HabitVerse</Link>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span className="sep">/</span>
            {c.href ? <Link href={c.href}>{c.name}</Link> : <span style={{ color: 'var(--text-2)' }}>{c.name}</span>}
          </span>
        ))}
      </nav>
      <div className="page-title-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title">{title}</h1>
          {sub ? <div className="page-sub">{sub}</div> : null}
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

/* Заглушка раздела на время переноса (фазы 5.2–5.4). */
export function SectionStub({ icon, text, phase }: { icon: string; text: string; phase: string }) {
  return (
    <div className="empty">
      <span className="em"><Icon name={icon} size={30} /></span>
      <h3>{text}</h3>
      <p className="small muted">Раздел переносится из демо-эталона. {phase}</p>
    </div>
  );
}
