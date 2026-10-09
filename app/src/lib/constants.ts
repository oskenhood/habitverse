import type { CategoryId, FreqType } from '@/types/database';

export const COLORS = [
  '#7c5cff', '#00e5c3', '#ff5c8a', '#ffb020', '#4aa8ff', '#3ddc97', '#ff6b35', '#a78bfa',
  '#f472b6', '#22d3ee', '#facc15', '#fb7185', '#34d399', '#818cf8', '#e879f9', '#94a3b8',
] as const;

export const CATEGORIES: { id: CategoryId; name: string; emoji: string; color: string }[] = [
  { id: 'health', name: 'Здоровье', emoji: '💪', color: '#3ddc97' },
  { id: 'mind', name: 'Разум', emoji: '🧠', color: '#4aa8ff' },
  { id: 'work', name: 'Работа', emoji: '💼', color: '#ffb020' },
  { id: 'disc', name: 'Дисциплина', emoji: '⚡', color: '#ff5c8a' },
  { id: 'social', name: 'Общение', emoji: '🫂', color: '#a78bfa' },
  { id: 'creo', name: 'Творчество', emoji: '🎨', color: '#22d3ee' },
  { id: 'spirit', name: 'Душа', emoji: '🌱', color: '#34d399' },
  { id: 'money', name: 'Финансы', emoji: '💰', color: '#facc15' },
];

export const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export const EMOJIS: Record<string, string[]> = {
  'Спорт': ['🏃', '💪', '🏋️', '🧘', '🚴', '🏊', '⚽', '🥊', '🤸', '🎯', '🧗', '🛹', '🏄', '⛹️', '🚶', '🤺'],
  'Еда и вода': ['💧', '🥗', '🍎', '🥑', '🍳', '🫖', '☕', '🚫', '🍫', '🥤', '🍵', '🧃', '🍽️', '🥦'],
  'Сон и отдых': ['😴', '🛌', '🌙', '⭐', '🛀', '🕯️', '🌅', '🏖️', '💤', '🧖'],
  'Учёба и работа': ['📚', '💻', '✍️', '🧠', '📝', '🎓', '🔬', '🗣️', '📖', '🧮', '⌨️', '📊', '🎧', '🔎'],
  'Творчество': ['🎨', '🎸', '🎹', '🎤', '📷', '🎬', '✂️', '🧶', '🪄', '🖌️', '🎭', '🪕'],
  'Дисциплина': ['⏰', '✅', '🔥', '⚡', '🧹', '💊', '🪥', '🚿', '👔', '📵', '💸', '🧾'],
  'Люди и душа': ['🫂', '❤️', '🙏', '🌱', '🐕', '📞', '💌', '🤝', '👶', '🧓', '😊', '🌻'],
};

export const AVATARS = [
  '🙂', '😎', '🦊', '🐺', '🐼', '🦁', '🐯', '🦄', '🐸', '🐙', '🦉', '🐝', '🚀', '⚡', '🔥',
  '🌙', '☀️', '🌊', '🏔️', '🎯', '🧠', '💎', '👑', '🎧', '🥷', '🧙', '🦾', '🌸', '🍀', '🎨',
];

export const NOTE_COLORS = ['', '#7c5cff22', '#00e5c322', '#ff5c8a22', '#ffb02022', '#4aa8ff22', '#34d39922'];

export const THEMES: { id: string; name: string }[] = [
  { id: 'midnight', name: '🌌 Полночь' },
  { id: 'abyss', name: '🌊 Бездна' },
  { id: 'neon', name: '💜 Неон' },
  { id: 'graphite', name: '🖤 Графит' },
  { id: 'paper', name: '📄 Светлая' },
];

export const XP = {
  done: 12,
  skip: 3,
  perfectDay: 25,
  habit: 20,
  note: 4,
  challenge: 40,
  backfillBonus: 2,
} as const;

export const levelOf = (xp: number) => {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = Math.round(need * 1.32);
  }
  return { level, into: xp - acc, need, acc };
};

export const QUOTES: [string, string][] = [
  ['Мы есть то, что постоянно делаем. Совершенство — не действие, а привычка.', 'Аристотель'],
  ['Маленькие ежедневные победы важнее редких подвигов.', 'HabitVerse'],
  ['Ты не поднимаешься до уровня своих целей — ты опускаешься до уровня своих систем.', 'Джеймс Клир'],
  ['Дисциплина — это мост между целями и достижениями.', 'Джим Рон'],
  ['Не считай дни. Делай так, чтобы дни считались.', 'Мухаммед Али'],
  ['Успех — это сумма небольших усилий, повторяющихся день за днём.', 'Роберт Кольер'],
  ['Лучшее время посадить дерево было 20 лет назад. Второе лучшее — сегодня.', 'Китайская пословица'],
  ['Мотивация запускает. Привычка удерживает.', 'Джим Рюн'],
  ['Провал — это просто возможность начать заново, но уже умнее.', 'Генри Форд'],
  ['Сложнее всего начать. Остальное — дело инерции.', 'HabitVerse'],
  ['Один пропущенный день — случайность. Два — начало новой привычки.', 'Джеймс Клир'],
  ['Твой будущий ты наблюдает за тобой сейчас через воспоминания.', 'HabitVerse'],
  ['Постоянство важнее интенсивности.', 'HabitVerse'],
  ['Делай то, что можешь, с тем, что имеешь, там, где ты есть.', 'Теодор Рузвельт'],
  ['Привычка — это канат. Мы вплетаем в него по нитке каждый день.', 'Хорас Манн'],
  ['Если хочешь идти быстро — иди один. Если далеко — идите вместе.', 'Африканская пословица'],
  ['Не цель делает тебя сильнее. Делает тебя сильнее путь к ней.', 'HabitVerse'],
  ['Каждое «сделано» — это голос за того человека, которым ты хочешь стать.', 'Джеймс Клир'],
  ['Сила воли конечна. Сила расписания — нет.', 'HabitVerse'],
  ['Стрик ломается один раз. Главное — не ломать его дважды.', 'Правило двух дней'],
];

export const ACHIEVEMENTS_FALLBACK = [
  { id: 'first', emoji: '🌱', name: 'Первый шаг', description: 'Отметь первую привычку', tier: 'bronze', xp_reward: 10, sort: 1 },
  { id: 's3', emoji: '🔥', name: '3 дня подряд', description: 'Стрик 3 дня', tier: 'bronze', xp_reward: 15, sort: 2 },
  { id: 's7', emoji: '⚡', name: 'Неделя силы', description: 'Стрик 7 дней', tier: 'silver', xp_reward: 30, sort: 3 },
  { id: 's21', emoji: '🧠', name: 'Перепрошивка', description: 'Стрик 21 день', tier: 'silver', xp_reward: 60, sort: 4 },
  { id: 's30', emoji: '👑', name: 'Месяц дисциплины', description: 'Стрик 30 дней', tier: 'gold', xp_reward: 120, sort: 5 },
  { id: 's100', emoji: '💎', name: 'Сотня', description: 'Стрик 100 дней', tier: 'platinum', xp_reward: 400, sort: 6 },
  { id: 'h1', emoji: '🎯', name: 'Поехали', description: 'Создай первую привычку', tier: 'bronze', xp_reward: 10, sort: 7 },
  { id: 'h5', emoji: '🗂️', name: 'Система', description: '5 активных привычек', tier: 'bronze', xp_reward: 20, sort: 8 },
  { id: 'h10', emoji: '🏗️', name: 'Архитектор жизни', description: '10 активных привычек', tier: 'silver', xp_reward: 50, sort: 9 },
  { id: 'perfect', emoji: '🌟', name: 'Идеальный день', description: '100% выполнение за день', tier: 'silver', xp_reward: 25, sort: 10 },
  { id: 'perfect7', emoji: '🏆', name: 'Идеальная неделя', description: '7 дней подряд по 100%', tier: 'gold', xp_reward: 150, sort: 11 },
  { id: 'c100', emoji: '✅', name: 'Сотня отметок', description: '100 выполнений всего', tier: 'silver', xp_reward: 50, sort: 12 },
  { id: 'c500', emoji: '🚀', name: '500 отметок', description: '500 выполнений всего', tier: 'gold', xp_reward: 200, sort: 13 },
  { id: 'early', emoji: '🌅', name: 'Ранняя пташка', description: 'Отметь привычку до 7:00', tier: 'bronze', xp_reward: 15, sort: 14 },
  { id: 'night', emoji: '🌙', name: 'Ночной режим', description: 'Отметь привычку после 23:00', tier: 'bronze', xp_reward: 15, sort: 15 },
  { id: 'note', emoji: '📓', name: 'Летописец', description: 'Напиши 5 заметок', tier: 'bronze', xp_reward: 20, sort: 16 },
  { id: 'chal', emoji: '🤝', name: 'В игре', description: 'Создай или вступи в челлендж', tier: 'silver', xp_reward: 40, sort: 17 },
  { id: 'chalwin', emoji: '🥇', name: 'Победитель', description: 'Выиграй челлендж', tier: 'gold', xp_reward: 250, sort: 18 },
  { id: 'backfill', emoji: '⏪', name: 'Властелин времени', description: 'Отметь привычку задним числом', tier: 'bronze', xp_reward: 10, sort: 19 },
  { id: 'allcats', emoji: '🌈', name: 'Баланс', description: 'Привычки в 5 разных категориях', tier: 'gold', xp_reward: 100, sort: 20 },
] as const;

/* ============================================================
   Каталог готовых привычек (v1.2)
   freq_days: 0 = Пн … 6 = Вс — та же нумерация, что в dueOn()
   ============================================================ */
export interface Preset {
  name: string;
  emoji: string;
  color: string;
  category: CategoryId;
  description: string;
  freq_type: FreqType;
  freq_days: number[];
  freq_every?: number;
  difficulty: number;
  target_count?: number;
  target_unit?: string;
  weekly_target?: number;
  is_negative?: boolean;
  reminder_time?: string | null;
}
export interface PresetGroup { group: string; items: Preset[] }

export const PRESETS: PresetGroup[] = [
  { group: '🌅 Утренняя рутина', items: [
    { name: 'Стакан воды после пробуждения', emoji: '💧', color: '#4aa8ff', category: 'health', description: 'Запускает обмен веществ. 300–400 мл.', freq_type: 'daily', freq_days: [], difficulty: 1 },
    { name: 'Зарядка 10 минут', emoji: '🤸', color: '#3ddc97', category: 'health', description: 'Суставы, спина, пять минут дыхания.', freq_type: 'daily', freq_days: [], difficulty: 1 },
    { name: 'Утренняя пробежка', emoji: '🏃', color: '#ff6b35', category: 'health', description: 'Лёгкий темп, пульс до 145.', freq_type: 'weekdays', freq_days: [0, 2, 4, 5], difficulty: 3, weekly_target: 3, reminder_time: '06:40:00' },
    { name: 'Медитация 10 минут', emoji: '🧘', color: '#00e5c3', category: 'spirit', description: 'Дыхание 4-7-8, затем наблюдение.', freq_type: 'daily', freq_days: [], difficulty: 2, reminder_time: '07:10:00' },
    { name: 'Утренние страницы', emoji: '✍️', color: '#a78bfa', category: 'mind', description: '3 страницы потока сознания до завтрака.', freq_type: 'weekdays', freq_days: [0, 1, 2, 3, 4], difficulty: 3, weekly_target: 3 },
    { name: 'Холодный душ', emoji: '🚿', color: '#22d3ee', category: 'disc', description: 'Финальные 30 секунд холодной водой.', freq_type: 'daily', freq_days: [], difficulty: 3 },
  ]},
  { group: '🧠 Разум и учёба', items: [
    { name: 'Чтение 20 страниц', emoji: '📚', color: '#a78bfa', category: 'mind', description: 'Бумажная книга, телефон в другой комнате.', freq_type: 'daily', freq_days: [], difficulty: 2, target_count: 20, target_unit: 'страниц', weekly_target: 5, reminder_time: '22:00:00' },
    { name: 'Английский 15 минут', emoji: '🗣️', color: '#facc15', category: 'mind', description: 'Карточки + один подкаст.', freq_type: 'weekdays', freq_days: [0, 1, 2, 3, 4, 5], difficulty: 2, target_count: 15, target_unit: 'минут', weekly_target: 4, reminder_time: '13:00:00' },
    { name: 'Один урок курса', emoji: '🎓', color: '#4aa8ff', category: 'mind', description: 'Модуль + конспект в три строки.', freq_type: 'weekdays', freq_days: [1, 3, 5], difficulty: 3, weekly_target: 2 },
    { name: 'Дневник вечера', emoji: '📓', color: '#818cf8', category: 'mind', description: '3 победы дня и 1 вывод.', freq_type: 'daily', freq_days: [], difficulty: 1, reminder_time: '21:30:00' },
    { name: 'Без телефона за едой', emoji: '📵', color: '#94a3b8', category: 'disc', description: 'Осознанное питание.', freq_type: 'daily', freq_days: [], difficulty: 2, is_negative: true },
  ]},
  { group: '💼 Работа и фокус', items: [
    { name: 'Глубокая работа 2 блока', emoji: '💻', color: '#7c5cff', category: 'work', description: 'По 50 минут без мессенджеров.', freq_type: 'weekdays', freq_days: [0, 1, 2, 3, 4], difficulty: 4, target_count: 2, target_unit: 'блока по 50 мин', weekly_target: 4, reminder_time: '09:30:00' },
    { name: 'План дня с вечера', emoji: '📝', color: '#ffb020', category: 'work', description: 'Три главные задачи на завтра.', freq_type: 'weekdays', freq_days: [0, 1, 2, 3, 4], difficulty: 1, reminder_time: '21:00:00' },
    { name: 'Разбор входящих до нуля', emoji: '📥', color: '#22d3ee', category: 'work', description: 'Inbox zero раз в день.', freq_type: 'weekdays', freq_days: [0, 1, 2, 3, 4], difficulty: 2, weekly_target: 3 },
    { name: 'Учёт расходов', emoji: '💰', color: '#f472b6', category: 'money', description: 'Записать все траты за день.', freq_type: 'daily', freq_days: [], difficulty: 1, reminder_time: '21:30:00' },
  ]},
  { group: '💪 Тело и здоровье', items: [
    { name: '2 литра воды', emoji: '💧', color: '#4aa8ff', category: 'health', description: '8 стаканов, первый — сразу после пробуждения.', freq_type: 'daily', freq_days: [], difficulty: 1, target_count: 8, target_unit: 'стаканов' },
    { name: 'Тренировка', emoji: '🏋️', color: '#ff5c8a', category: 'health', description: 'Силовая или функциональная.', freq_type: 'weekdays', freq_days: [0, 2, 4], difficulty: 4, weekly_target: 3 },
    { name: '8000 шагов', emoji: '🚶', color: '#34d399', category: 'health', description: 'Прогулка вместо части транспорта.', freq_type: 'daily', freq_days: [], difficulty: 2, target_count: 8000, target_unit: 'шагов', weekly_target: 5 },
    { name: 'Без сахара', emoji: '🚫', color: '#ff5c8a', category: 'disc', description: 'Ноль добавленного сахара. Фрукты можно.', freq_type: 'daily', freq_days: [], difficulty: 4, is_negative: true },
    { name: 'Отбой до 23:30', emoji: '😴', color: '#818cf8', category: 'health', description: 'Экраны off за 40 минут до сна.', freq_type: 'daily', freq_days: [], difficulty: 3, weekly_target: 5, reminder_time: '22:45:00' },
    { name: 'Овощи в каждый приём пищи', emoji: '🥗', color: '#3ddc97', category: 'health', description: 'Минимум половина тарелки.', freq_type: 'daily', freq_days: [], difficulty: 2 },
  ]},
  { group: '🫂 Люди и душа', items: [
    { name: 'Звонок близким', emoji: '📞', color: '#34d399', category: 'social', description: 'Минимум 10 минут живого разговора.', freq_type: 'weekdays', freq_days: [2, 5, 6], difficulty: 1, weekly_target: 2, reminder_time: '19:00:00' },
    { name: 'Комплимент или благодарность', emoji: '💌', color: '#f472b6', category: 'social', description: 'Кому-то конкретно, вслух или текстом.', freq_type: 'daily', freq_days: [], difficulty: 1 },
    { name: 'Прогулка без наушников', emoji: '🌳', color: '#00e5c3', category: 'spirit', description: '20 минут тишины и наблюдения.', freq_type: 'weekdays', freq_days: [5, 6], difficulty: 1, weekly_target: 1 },
  ]},
  { group: '🎨 Творчество', items: [
    { name: 'Скетч дня', emoji: '🎨', color: '#22d3ee', category: 'creo', description: '10 минут, без оценки результата.', freq_type: 'weekdays', freq_days: [1, 3, 5], difficulty: 2, weekly_target: 2 },
    { name: 'Инструмент 15 минут', emoji: '🎸', color: '#ffb020', category: 'creo', description: 'Гаммы или разбор одного такта.', freq_type: 'daily', freq_days: [], difficulty: 2, weekly_target: 4 },
    { name: 'Фото дня', emoji: '📷', color: '#a78bfa', category: 'creo', description: 'Один осознанный кадр.', freq_type: 'daily', freq_days: [], difficulty: 1 },
  ]},
  { group: '🏠 Дом и порядок', items: [
    { name: 'Уборка 10 минут', emoji: '🧹', color: '#94a3b8', category: 'disc', description: 'Таймер и одна зона.', freq_type: 'weekdays', freq_days: [1, 4], difficulty: 1, weekly_target: 2 },
    { name: 'Заправить кровать', emoji: '🛏️', color: '#818cf8', category: 'disc', description: 'Первая победа дня.', freq_type: 'daily', freq_days: [], difficulty: 1 },
    { name: 'Разгрузить одну поверхность', emoji: '🗂️', color: '#34d399', category: 'disc', description: 'Стол, подоконник, стул — до нуля.', freq_type: 'weekdays', freq_days: [0, 2, 4], difficulty: 1, weekly_target: 2 },
  ]},
];

export const REACTIONS = ['🔥', '👏', '💪', '😮', '❤️'] as const;
