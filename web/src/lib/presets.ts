/* ============================================================
   HabitVerse web — каталог готовых привычек (фаза 5.3)
   Порт PRESETS из v2/app.js (30 пресетов в 7 группах).
   Эмодзи пресета — контент привычки (можно); заголовки групп —
   текст без эмодзи (правило UI-хрома, DESIGN.md).
   ============================================================ */
import type { Freq, NewHabitData } from './engine';

export interface Preset {
  name: string; emoji: string; color: string; cat: string; desc?: string;
  freq: Freq; difficulty?: number; weekGoal?: number; target?: number; unit?: string; neg?: boolean;
}
export interface PresetGroup { group: string; items: Preset[]; }

export const PRESETS: PresetGroup[] = [
  { group: 'Утренняя рутина', items: [
    { name: 'Стакан воды после пробуждения', emoji: '💧', color: '#4A76A8', cat: 'health', desc: 'Запускает обмен веществ. 300–400 мл.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
    { name: 'Зарядка 10 минут', emoji: '🤸', color: '#5F8A6B', cat: 'health', desc: 'Суставы, спина, пять минут дыхания.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
    { name: 'Утренняя пробежка', emoji: '🏃', color: '#C0714F', cat: 'health', desc: 'Лёгкий темп, пульс до 145.', freq: { type: 'weekdays', days: [0, 2, 4, 5] }, difficulty: 3, weekGoal: 3 },
    { name: 'Медитация 10 минут', emoji: '🧘', color: '#3F8A80', cat: 'spirit', desc: 'Дыхание 4-7-8, затем наблюдение.', freq: { type: 'daily' }, difficulty: 2, weekGoal: 0 },
    { name: 'Утренние страницы', emoji: '✍️', color: '#7A6AA8', cat: 'mind', desc: '3 страницы потока сознания до завтрака.', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4] }, difficulty: 3, weekGoal: 3 },
    { name: 'Холодный душ', emoji: '🚿', color: '#3F8A80', cat: 'disc', desc: 'Финальные 30 секунд холодной водой.', freq: { type: 'daily' }, difficulty: 3, weekGoal: 0 },
  ] },
  { group: 'Разум и учёба', items: [
    { name: 'Чтение 20 страниц', emoji: '📚', color: '#7A6AA8', cat: 'mind', desc: 'Бумажная книга, телефон в другой комнате.', freq: { type: 'daily' }, difficulty: 2, weekGoal: 5 },
    { name: 'Английский 15 минут', emoji: '🗣️', color: '#A9853F', cat: 'mind', desc: 'Карточки + один подкаст.', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4, 5] }, difficulty: 2, weekGoal: 4 },
    { name: 'Один урок курса', emoji: '🎓', color: '#4A76A8', cat: 'mind', desc: 'Модуль + конспект в три строки.', freq: { type: 'weekdays', days: [1, 3, 5] }, difficulty: 3, weekGoal: 2 },
    { name: 'Дневник вечера', emoji: '📓', color: '#5F6B8A', cat: 'mind', desc: '3 победы дня и 1 вывод.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
    { name: 'Без телефона за едой', emoji: '📵', color: '#6B6E76', cat: 'disc', desc: 'Осознанное питание.', freq: { type: 'daily' }, difficulty: 2, weekGoal: 0, neg: true },
  ] },
  { group: 'Работа и фокус', items: [
    { name: 'Глубокая работа 2 блока', emoji: '💻', color: '#6B6E76', cat: 'work', desc: 'По 50 минут без мессенджеров.', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4] }, difficulty: 4, weekGoal: 4 },
    { name: 'План дня с вечера', emoji: '📝', color: '#A9853F', cat: 'work', desc: 'Три главные задачи на завтра.', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4] }, difficulty: 1, weekGoal: 0 },
    { name: 'Разбор входящих до нуля', emoji: '📥', color: '#3F8A80', cat: 'work', desc: 'Inbox zero раз в день.', freq: { type: 'weekdays', days: [0, 1, 2, 3, 4] }, difficulty: 2, weekGoal: 3 },
    { name: 'Учёт расходов', emoji: '💰', color: '#A85C74', cat: 'money', desc: 'Записать все траты за день.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
  ] },
  { group: 'Тело и здоровье', items: [
    { name: '2 литра воды', emoji: '💧', color: '#4A76A8', cat: 'health', desc: '8 стаканов, первый — сразу после пробуждения.', freq: { type: 'daily' }, target: 8, unit: 'стаканов', difficulty: 1, weekGoal: 0 },
    { name: 'Тренировка', emoji: '🏋️', color: '#A85C74', cat: 'health', desc: 'Силовая или функциональная.', freq: { type: 'weekdays', days: [0, 2, 4] }, difficulty: 4, weekGoal: 3 },
    { name: '8000 шагов', emoji: '🚶', color: '#5F8A6B', cat: 'health', desc: 'Прогулка вместо части транспорта.', freq: { type: 'daily' }, target: 8000, unit: 'шагов', difficulty: 2, weekGoal: 5 },
    { name: 'Без сахара', emoji: '🚫', color: '#A85C74', cat: 'disc', desc: 'Ноль добавленного сахара. Фрукты можно.', freq: { type: 'daily' }, difficulty: 4, weekGoal: 0, neg: true },
    { name: 'Отбой до 23:30', emoji: '😴', color: '#5F6B8A', cat: 'health', desc: 'Экраны off за 40 минут до сна.', freq: { type: 'daily' }, difficulty: 3, weekGoal: 5 },
    { name: 'Овощи в каждый приём пищи', emoji: '🥗', color: '#5F8A6B', cat: 'health', desc: 'Минимум половина тарелки.', freq: { type: 'daily' }, difficulty: 2, weekGoal: 0 },
  ] },
  { group: 'Люди и душа', items: [
    { name: 'Звонок близким', emoji: '📞', color: '#5F8A6B', cat: 'social', desc: 'Минимум 10 минут живого разговора.', freq: { type: 'weekdays', days: [2, 5, 6] }, difficulty: 1, weekGoal: 2 },
    { name: 'Комплимент или благодарность', emoji: '💌', color: '#A85C74', cat: 'social', desc: 'Кому-то конкретно, вслух или текстом.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
    { name: 'Прогулка без наушников', emoji: '🌳', color: '#3F8A80', cat: 'spirit', desc: '20 минут тишины и наблюдения.', freq: { type: 'weekdays', days: [5, 6] }, difficulty: 1, weekGoal: 1 },
  ] },
  { group: 'Творчество', items: [
    { name: 'Скетч дня', emoji: '🎨', color: '#3F8A80', cat: 'creo', desc: '10 минут, без оценки результата.', freq: { type: 'weekdays', days: [1, 3, 5] }, difficulty: 2, weekGoal: 2 },
    { name: 'Инструмент 15 минут', emoji: '🎸', color: '#A9853F', cat: 'creo', desc: 'Гаммы или разбор одного такта.', freq: { type: 'daily' }, difficulty: 2, weekGoal: 4 },
    { name: 'Фото дня', emoji: '📷', color: '#7A6AA8', cat: 'creo', desc: 'Один осознанный кадр.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
  ] },
  { group: 'Дом и порядок', items: [
    { name: 'Уборка 10 минут', emoji: '🧹', color: '#6B6E76', cat: 'disc', desc: 'Таймер и одна зона.', freq: { type: 'weekdays', days: [1, 4] }, difficulty: 1, weekGoal: 2 },
    { name: 'Заправить кровать', emoji: '🛏️', color: '#5F6B8A', cat: 'disc', desc: 'Первая победа дня.', freq: { type: 'daily' }, difficulty: 1, weekGoal: 0 },
    { name: 'Разгрузить одну поверхность', emoji: '🗂️', color: '#5F8A6B', cat: 'disc', desc: 'Стол, подоконник, стул — до нуля.', freq: { type: 'weekdays', days: [0, 2, 4] }, difficulty: 1, weekGoal: 2 },
  ] },
];

export const PRESET_COUNT = PRESETS.reduce((n, g) => n + g.items.length, 0);

/** Пресет → данные новой привычки (start — сегодня, 2 заморозки, как в демо). */
export function presetToHabit(p: Preset, today: string): NewHabitData {
  return {
    name: p.name, emoji: p.emoji, color: p.color, cat: p.cat, desc: p.desc || '',
    freq: p.freq, difficulty: p.difficulty ?? 2, target: p.target || 1, unit: p.unit || '',
    weekGoal: p.weekGoal || 0, neg: !!p.neg, start: today, freezes: 2,
  };
}

/** Поиск по каталогу: название + описание, регистронезависимо. */
export function filterPresets(q: string): PresetGroup[] {
  const s = q.trim().toLowerCase();
  return PRESETS
    .map((g) => ({ ...g, items: g.items.filter((it) => !s || (it.name + ' ' + (it.desc || '')).toLowerCase().includes(s)) }))
    .filter((g) => g.items.length);
}
