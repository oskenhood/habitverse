/* ============================================================
   HabitVerse web — мини-разметка заметок md2 (фаза 5.3)
   Чистый порт md2 из v2/app.js: # заголовки, **жирный**, *курсив*,
   `код`, - списки, > цитаты, [[ГГГГ-ММ-ДД]] — дата-тег.
   Вход всегда экранируется (esc) — результат безопасно вставлять
   через dangerouslySetInnerHTML. Блочный редактор Notion-типа —
   этап 3 (см. BACKLOG), тогда md2 станет фолбэком импорта.
   ============================================================ */

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function md2(src: string): string {
  const lines = String(src || '').split('\n');
  const out: string[] = [];
  let list: string[] | null = null;
  const inline = (t: string): string => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[\[(\d{4}-\d{2}-\d{2})\]\]/g, '<span class="tag date">$1</span>');
  const flush = (): void => {
    if (list) { out.push(`<ul>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); list = null; }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-•] /.test(line)) { (list = list || []).push(line.replace(/^\s*[-•] /, '')); continue; }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { const lv = h[1].length + 2; out.push(`<h${lv}>${inline(h[2])}</h${lv}>`); continue; }
    if (/^>\s?/.test(line)) { out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('');
}
