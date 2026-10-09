/** Утилиты дат. Формат ключа — 'YYYY-MM-DD' (совпадает с date в Postgres). */

const pad = (n: number) => String(n).padStart(2, '0');

export const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
export const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WD_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

export const D = {
  today(): string {
    return D.key(new Date());
  },
  key(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },
  parse(k: string): Date {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  },
  add(k: string, n: number): string {
    const d = D.parse(k);
    d.setDate(d.getDate() + n);
    return D.key(d);
  },
  diff(a: string, b: string): number {
    return Math.round((D.parse(b).getTime() - D.parse(a).getTime()) / 86_400_000);
  },
  /** 0 = понедельник … 6 = воскресенье (как в БД: extract(isodow) - 1) */
  dow(k: string): number {
    return (D.parse(k).getDay() + 6) % 7;
  },
  isFuture(k: string): boolean {
    return k > D.today();
  },
  range(from: string, to: string): string[] {
    const out: string[] = [];
    for (let k = from; k <= to; k = D.add(k, 1)) out.push(k);
    return out;
  },
  monthName(m: number, short = false): string {
    const name = MONTHS[m] ?? '';
    return short ? name.slice(0, 3) : name;
  },
  human(k: string): string {
    const d = D.parse(k);
    const t = D.today();
    if (k === t) return 'сегодня';
    if (k === D.add(t, -1)) return 'вчера';
    if (k === D.add(t, 1)) return 'завтра';
    return `${d.getDate()} ${D.monthName(d.getMonth(), true)}`;
  },
  full(k: string): string {
    const d = D.parse(k);
    return `${WD_FULL[D.dow(k)]}, ${d.getDate()} ${D.monthName(d.getMonth())} ${d.getFullYear()}`;
  },
  ago(iso: string | number): string {
    const ts = typeof iso === 'number' ? iso : new Date(iso).getTime();
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    if (s < 3600) return `${Math.floor(s / 60)} мин назад`;
    if (s < 86_400) return `${Math.floor(s / 3600)} ч назад`;
    if (s < 604_800) return `${Math.floor(s / 86_400)} дн назад`;
    return new Date(ts).toLocaleDateString('ru-RU');
  },
  age(birth: string | null): number | null {
    if (!birth) return null;
    const b = new Date(birth);
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a -= 1;
    return a;
  },
  daysUntilBirthday(birth: string | null): number | null {
    if (!birth) return null;
    const b = new Date(birth);
    const t = new Date();
    const next = new Date(t.getFullYear(), b.getMonth(), b.getDate());
    if (next < t) next.setFullYear(t.getFullYear() + 1);
    return Math.round((next.getTime() - t.getTime()) / 86_400_000);
  },
  /** Сетка месяца для календаря: всегда начинается с понедельника */
  monthGrid(year: number, month1: number): { key: string; out: boolean }[] {
    const first = new Date(year, month1 - 1, 1);
    const daysInMonth = new Date(year, month1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const cells: { key: string; out: boolean }[] = [];
    for (let i = 0; i < lead; i += 1) cells.push({ key: D.add(D.key(first), i - lead), out: true });
    for (let d = 1; d <= daysInMonth; d += 1) cells.push({ key: `${year}-${pad(month1)}-${pad(d)}`, out: false });
    while (cells.length % 7 !== 0) cells.push({ key: D.add(cells[cells.length - 1].key, 1), out: true });
    return cells;
  },
};
