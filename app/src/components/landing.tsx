'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Background } from './app-shell';
import { Button } from './ui/primitives';

const FEATURES = [
  { icon: '🎯', title: 'Гибкое расписание', text: 'Каждый день, выбранные дни недели, каждые N дней, числа месяца. Цель в единицах: страниц, минут, стаканов.' },
  { icon: '🔥', title: 'Стрики и уровни', text: 'XP за каждую отметку, уровни с растущим порогом, рекорды и 20 достижений от «Первого шага» до «Сотни».' },
  { icon: '🗓️', title: 'Календарь и heatmap', text: 'Месячная сетка, карта года в стиле GitHub и отметки задним числом — как в HabitLink 2.0.' },
  { icon: '📊', title: 'Отчёты и диаграммы', text: 'Динамика, скользящее среднее, распределение по дням недели, радар сфер жизни, персональные инсайты.' },
  { icon: '🔥', title: 'Челленджи и лидерборд', text: 'Привычка + срок + команда. Код-приглашение, места, живой рейтинг по XP за 30 дней.' },
  { icon: '🌊', title: 'Лента активности', text: 'Отметки друзей, их стрики и победы — в одной ленте. Прогресс виден, отсутствие тоже.' },
  { icon: '🔔', title: 'Напоминания', text: 'Web Push через Service Worker: уведомление в нужное время даже при закрытой вкладке, плюс вечерняя сводка.' },
  { icon: '📓', title: 'Блокнот', text: 'Заметки с тегами, закреплением, цветами и привязкой к привычке. Лёгкая markdown-разметка.' },
  { icon: '🎨', title: 'Кастомизация', text: '5 тем, 16 акцентных цветов, эмодзи-иконки, свой цвет, плотность интерфейса, звуки.' },
];

export function Landing() {
  return (
    <div className="min-h-dvh relative">
      <Background />
      <div className="relative max-w-6xl mx-auto px-5 py-14 lg:py-24">
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-[12.5px] text-[var(--muted)] mb-7">
            <span className="w-2 h-2 rounded-full bg-[var(--ok)] animate-pulse" />
            Next.js 16 · Supabase · Vercel · PWA
          </div>
          <h1 className="text-[clamp(38px,7vw,74px)] font-extrabold tracking-[-.045em] leading-[1.02]">
            Привычки,{' '}
            <span className="bg-[linear-gradient(120deg,var(--acc),var(--acc2),var(--acc3))] bg-clip-text text-transparent">которые держатся</span>
          </h1>
          <p className="mt-6 text-[17px] text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
            HabitVerse — социальный трекер: стрики, челленджи с друзьями, календарь, heatmap, отчёты, напоминания и блокнот.
            Тёмные темы, 3D-визуализация прогресса и никакой платы за вторую привычку.
          </p>
          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            <Link href="/register">
              <Button variant="primary" size="md" className="hv-shimmer px-7 py-3.5 text-[15px]">
                Начать бесплатно →
              </Button>
            </Link>
            <Link href="/login">
              <Button size="md" className="px-7 py-3.5 text-[15px]">У меня есть аккаунт</Button>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40, rotateX: 12 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-16 relative"
            style={{ perspective: '1200px' }}
          >
            <div className="glass rounded-[28px] p-5 lg:p-7 shadow-[0_40px_90px_-30px_rgba(0,0,0,.7)] border-[var(--stroke2)]">
              <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5 text-left">
                <div className="rounded-[20px] p-6 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--acc)_22%,transparent),color-mix(in_oklab,var(--acc3)_12%,transparent)),var(--card)] border border-[var(--stroke2)]">
                  <div className="text-[12px] uppercase tracking-[.16em] text-[var(--muted)]">вторник, 6 октября</div>
                  <div className="text-[clamp(38px,6vw,58px)] font-extrabold tracking-[-.045em] leading-none mt-2">86<small className="text-[.42em] font-bold text-[var(--muted)]">%</small></div>
                  <p className="text-[var(--muted)] text-sm mt-2">Осталось 2 из 14. Каждый шаг считается.</p>
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[['21🔥', 'лучший стрик'], ['1 284', 'отметок'], ['87%', 'за 30 дней'], ['Lv 9', '320/720 XP']].map(([v, l]) => (
                      <div key={l} className="p-3 rounded-2xl bg-[var(--card)] border border-[var(--stroke)] hover:-translate-y-1 hover:border-[var(--acc)] transition-all duration-300">
                        <b className="block text-xl tracking-tight tabular">{v}</b>
                        <span className="text-[10.5px] text-[var(--muted)] uppercase tracking-[.09em]">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid place-items-center rounded-[20px] glass p-6">
                  <div className="orb-scene w-[200px] h-[200px]">
                    <div className="orb w-[130px] h-[130px]">
                      <div className="orb-ring" />
                      <div className="orb-ring" style={{ transform: 'rotateY(60deg)', borderColor: 'var(--acc2)' }} />
                      <div className="orb-ring" style={{ transform: 'rotateY(120deg)', borderColor: 'var(--acc3)' }} />
                      <div className="orb-core" />
                    </div>
                  </div>
                  <div className="text-center mt-2">
                    <b className="text-base">Сфера постоянства</b>
                    <p className="text-xs text-[var(--muted)]">Ядро заряжается твоими отметками</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                {[
                  { e: '🏃', n: 'Утренняя пробежка', c: '#ff6b35', s: 21, p: 100 },
                  { e: '💧', n: '2 литра воды', c: '#4aa8ff', s: 44, p: 100 },
                  { e: '📚', n: 'Чтение 20 страниц', c: '#a78bfa', s: 9, p: 0 },
                  { e: '🧘', n: 'Медитация', c: '#00e5c3', s: 12, p: 100 },
                ].map((h, i) => (
                  <motion.div
                    key={h.n}
                    initial={{ opacity: 0, x: -24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center gap-3.5 p-3 rounded-2xl bg-[var(--card)] border border-[var(--stroke)] hover:-translate-y-0.5 transition-transform"
                    style={{ borderLeft: `4px solid ${h.c}` }}
                  >
                    <span className={cnCheck(h.p)}>{h.p ? '✓' : h.e}</span>
                    <span className="flex-1 min-w-0">
                      <b className="block text-sm truncate">{h.e} {h.n}</b>
                      <span className="text-[11px] text-[var(--faint)]">🔥 {h.s} дней подряд</span>
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        <div className="mt-24">
          <h2 className="text-center text-[clamp(26px,4vw,38px)] font-extrabold tracking-[-.035em]">Всё, что есть в HabitLink — и больше</h2>
          <p className="text-center text-[var(--muted)] mt-3 max-w-xl mx-auto text-[15px]">
            Социальные механики, кастомизация и аналитика. Без ограничения «одна привычка бесплатно».
          </p>
          <div className="mt-11 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: (i % 3) * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="glass rounded-[var(--r-lg)] p-5 hover:-translate-y-1.5 hover:border-[var(--acc)] hover:shadow-[0_20px_50px_-20px_var(--acc)] transition-all duration-300"
              >
                <span className="text-[26px]">{f.icon}</span>
                <h3 className="mt-3 text-[15.5px] font-bold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-[13px] text-[var(--muted)] leading-relaxed">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-24 text-center glass rounded-[28px] p-10 lg:p-14">
          <blockquote className="text-[clamp(20px,3.4vw,30px)] font-bold tracking-[-.03em] leading-snug max-w-3xl mx-auto">
            «Сила воли заставляет начать. Привычка заставляет продолжать. Друзья не дают сойти с дистанции.»
          </blockquote>
          <div className="mt-8">
            <Link href="/register">
              <Button variant="primary" className="px-8 py-3.5 text-[15px] hv-shimmer">Создать аккаунт</Button>
            </Link>
          </div>
        </div>

        <footer className="mt-16 text-center text-xs text-[var(--faint)]">
          HabitVerse · Next.js 16 + Supabase + Vercel · данные в Postgres с Row Level Security
        </footer>
      </div>
    </div>
  );
}

const cnCheck = (done: number) =>
  done
    ? 'w-[42px] h-[42px] rounded-[13px] grid place-items-center text-[19px] text-white bg-[var(--ok)] shadow-[0_8px_22px_-8px_var(--ok)] shrink-0'
    : 'w-[42px] h-[42px] rounded-[13px] grid place-items-center text-[19px] bg-[var(--bg2)] border-2 border-[var(--stroke2)] text-[var(--muted)] shrink-0';
