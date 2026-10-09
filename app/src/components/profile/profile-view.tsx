'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D } from '@/lib/dates';
import { AVATARS, COLORS, levelOf, THEMES } from '@/lib/constants';
import { streakOf, type LogMap } from '@/lib/stats';
import { completeOnboarding, updateProfile, uploadAvatar } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';
import { subscribePush, unsubscribePush } from '@/components/notifications/push';
import { Button, Card, CardHead, Chip, Field, Input, Pill, Progress, SettingRow, Textarea, Toggle } from '@/components/ui/primitives';
import { ConfirmDialog, Modal, Sheet } from '@/components/ui/overlays';
import type { Achievement, Habit, Profile, UserAchievement } from '@/types/database';

export function ProfileView({
  profile: initial,
  habits,
  logs,
  achievements,
  unlocked,
}: {
  profile: Profile;
  habits: Habit[];
  logs: LogMap;
  achievements: Achievement[];
  unlocked: UserAchievement[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [p, setP] = useState<Profile>(initial);
  const [busy, setBusy] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [onbOpen, setOnbOpen] = useState(params.get('onboarding') === '1' || !initial.onboarding_done);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setP(initial), [initial]);
  useEffect(() => {
    try { localStorage.setItem('hv.theme', JSON.stringify({ theme: p.theme, density: p.density, acc: COLORS[p.accent % COLORS.length] })); } catch {}
  }, [p.theme, p.density, p.accent]);

  const lv = levelOf(p.xp);
  const age = D.age(p.birth_date);
  const bday = D.daysUntilBirthday(p.birth_date);
  const active = habits.filter((h) => !h.archived);
  const totalDone = Object.values(logs).reduce((n, m) => n + Object.values(m).filter((l) => l.status === 'done').length, 0);
  const bestStreak = active.length ? Math.max(...active.map((h) => streakOf(h, logs).best)) : 0;
  const days = Math.max(1, Math.round((Date.now() - new Date(p.created_at).getTime()) / 86_400_000));

  const patch = async (next: Partial<Profile>, okMsg?: string) => {
    setP((prev) => ({ ...prev, ...next }));
    try {
      await updateProfile(next);
      if (okMsg) toast.success(okMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast.error('Файл больше 4 МБ — сожми изображение');
    setBusy(true);
    try {
      await uploadAvatar(f);
      toast.success('Аватар обновлён');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось загрузить');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="p-4 lg:p-7">
      {/* -------- Шапка профиля -------- */}
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="grid sm:grid-cols-[auto_1fr] gap-6 items-center p-6 rounded-[28px] border border-[var(--stroke)] mb-4"
        style={{ background: 'linear-gradient(120deg, color-mix(in oklab, var(--acc) 18%, transparent), transparent 60%), var(--card)' }}>
        <button onClick={() => fileRef.current?.click()} className="relative w-[104px] h-[104px] rounded-[32px] grid place-items-center text-5xl overflow-hidden bg-[linear-gradient(140deg,var(--acc),var(--acc3))] shadow-[0_16px_40px_-16px_var(--acc)] hover:rotate-[-5deg] hover:scale-105 transition-transform duration-300 group">
          {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span>{p.emoji}</span>}
          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">📷 изменить</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />

        <div className="min-w-0">
          <div className="flex flex-wrap gap-2.5 items-center mb-1.5">
            <h2 className="text-[25px] font-extrabold tracking-[-.03em]">{p.display_name || 'Без имени'}</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-extrabold text-white bg-[linear-gradient(120deg,var(--acc),var(--acc3))] shadow-[0_8px_20px_-10px_var(--acc)]">⚡ Уровень {lv.level}</span>
            {age !== null && <Pill>🎂 {age} лет</Pill>}
            {bday !== null && bday <= 7 && <Pill tone="warn">🎉 через {bday} дн.</Pill>}
          </div>
          <p className="text-[13.5px] text-[var(--muted)] leading-relaxed max-w-[60ch]">{p.bio || 'Расскажи о себе: зачем тебе привычки и к чему идёшь.'}</p>
          <div className="flex gap-2 flex-wrap mt-3">
            <Pill>📅 с нами {days} дн.</Pill>
            <Pill>✅ {totalDone} отметок</Pill>
            <Pill>🔥 рекорд {bestStreak} дн.</Pill>
            <Pill>🏅 {unlocked.length}/{achievements.length || 20} ачивок</Pill>
            <Pill>🎯 {active.length} привычек</Pill>
            <Pill>✨ {p.xp} XP</Pill>
          </div>
          <div className="max-w-[360px] mt-3.5"><Progress value={(lv.into / lv.need) * 100} /></div>
          <p className="text-[11.5px] text-[var(--faint)] mt-2">До уровня {lv.level + 1}: {Math.max(0, lv.need - lv.into)} XP</p>
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* -------- Профиль -------- */}
        <Card>
          <CardHead title="👤 Профиль" />
          <Field label="Имя"><Input value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} onBlur={(e) => void patch({ display_name: e.target.value })} maxLength={40} /></Field>
          <Field label="Username (для поиска друзьями)"><Input value={p.username ?? ''} onChange={(e) => setP({ ...p, username: e.target.value.replace(/[^a-z0-9_]/gi, '') })} onBlur={(e) => void patch({ username: e.target.value || null })} maxLength={24} placeholder="nickname" /></Field>
          <Field label="О себе"><Textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value })} onBlur={(e) => void patch({ bio: e.target.value })} maxLength={240} className="min-h-[80px]" /></Field>
          <Field label="Дата рождения" hint={age !== null ? `Возраст учитывается в статистике: ${age} лет` : undefined}>
            <Input type="date" max={D.today()} value={p.birth_date ?? ''} onChange={(e) => { const v = e.target.value; setP({ ...p, birth_date: v || null }); void patch({ birth_date: v || null }); }} />
          </Field>
          <Field label="Аватар-эмодзи">
            <div className="flex flex-wrap gap-2">
              {AVATARS.slice(0, 12).map((e) => (
                <button key={e} type="button" onClick={() => { setP({ ...p, emoji: e, avatar_url: null }); void patch({ emoji: e, avatar_url: null }); }}
                  className={cn('w-[34px] h-[34px] rounded-[11px] text-[17px] border transition-transform hover:scale-110 hover:-rotate-6', p.emoji === e && !p.avatar_url ? 'bg-[var(--acc)] border-[var(--acc)] scale-110' : 'bg-[var(--bg2)] border-[var(--stroke)]')}>{e}</button>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} className="w-[34px] h-[34px] rounded-[11px] text-[13px] border border-dashed border-[var(--stroke2)] hover:border-[var(--acc)] transition-colors">📷</button>
            </div>
          </Field>
          {p.avatar_url && <Button size="sm" onClick={() => void patch({ avatar_url: null }, 'Фото убрано')}>Убрать фото</Button>}
        </Card>

        {/* -------- Внешний вид -------- */}
        <Card>
          <CardHead title="🎨 Внешний вид" />
          <Field label="Тема">
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button key={t.id} type="button" onClick={() => void patch({ theme: t.id as Profile['theme'] }, `Тема: ${t.name}`)}
                  className={cn('px-3 h-[34px] rounded-[11px] text-[11.5px] font-bold border transition-all hover:-translate-y-0.5', p.theme === t.id ? 'bg-[var(--acc)] border-[var(--acc)] text-white' : 'bg-[var(--bg2)] border-[var(--stroke)] text-[var(--text)]')}>{t.name}</button>
              ))}
            </div>
          </Field>
          <Field label="Акцентный цвет">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c, i) => (
                <button key={c} type="button" onClick={() => void patch({ accent: i })}
                  className={cn('w-[34px] h-[34px] rounded-[11px] transition-transform hover:scale-110 hover:rotate-6 relative', p.accent === i && 'ring-2 ring-[var(--text)] scale-110')} style={{ background: c }}>
                  {p.accent === i && <span className="absolute inset-0 grid place-items-center text-white font-black text-sm drop-shadow">✓</span>}
                </button>
              ))}
            </div>
          </Field>
          <SettingRow title="Плотность интерфейса" desc="Компактный режим вмещает больше">
            <div className="flex gap-1.5">
              <Chip active={p.density !== 'compact'} onClick={() => void patch({ density: 'cozy' })}>Обычная</Chip>
              <Chip active={p.density === 'compact'} onClick={() => void patch({ density: 'compact' })}>Компакт</Chip>
            </div>
          </SettingRow>
          <SettingRow title="Звуковые эффекты" desc="Отклик на отметки и уровни">
            <Toggle on={p.sound} onChange={(v) => void patch({ sound: v })} label="Звук" />
          </SettingRow>
        </Card>

        {/* -------- Напоминания -------- */}
        <Card>
          <CardHead title="🔔 Напоминания" />
          <SettingRow title="Push-уведомления" desc="Web Push через Service Worker — работают при закрытой вкладке">
            <Toggle on={p.notif_enabled} onChange={async (v) => {
              if (v) { const ok = await subscribePush(); if (!ok) return toast.error('Не удалось включить push'); await patch({ notif_enabled: true }, 'Push включён'); }
              else { await unsubscribePush(); await patch({ notif_enabled: false }, 'Push выключен'); }
            }} label="Push" />
          </SettingRow>
          <Field label="Ежедневная сводка в">
            <Input type="time" value={p.digest_time?.slice(0, 5) ?? '20:00'} onChange={(e) => void patch({ digest_time: `${e.target.value}:00` })} />
          </Field>
          <Field label="Часовой пояс" hint="Для правильного времени напоминаний">
            <Input value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })} onBlur={(e) => void patch({ timezone: e.target.value })} placeholder="Europe/Moscow" />
          </Field>
          <SettingRow title="Показывать меня в ленте" desc="Друзья видят твои отметки">
            <Toggle on={p.privacy_feed} onChange={(v) => void patch({ privacy_feed: v })} label="Лента" />
          </SettingRow>
          <SettingRow title="Приватный профиль" desc="Тебя не найти в поиске">
            <Toggle on={p.privacy_profile} onChange={(v) => void patch({ privacy_profile: v })} label="Приватность" />
          </SettingRow>
        </Card>

        {/* -------- Аккаунт -------- */}
        <Card>
          <CardHead title="💾 Данные и аккаунт" />
          <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-3.5">
            Данные лежат в Supabase (Postgres + Row Level Security). Вход — e-mail/пароль, Google, GitHub или magic-link.
            Синхронизация между устройствами автоматическая, лента друзей обновляется в реальном времени.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => {
              const blob = new Blob([JSON.stringify({ profile: p, habits, exported_at: new Date().toISOString() }, null, 2)], { type: 'application/json' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `habitverse-${D.today()}.json`; a.click();
              toast.success('Экспорт готов');
            }}>⬇ Экспорт JSON</Button>
            <Button size="sm" onClick={() => setOnbOpen(true)}>🔁 Пройти онбординг</Button>
            <Button size="sm" variant="danger" onClick={() => setLogoutOpen(true)}>Выйти</Button>
          </div>
          <div className="h-px bg-[var(--stroke)] my-4" />
          <SettingRow title="E-mail" desc={initial.id.slice(0, 8) + '…'}>
            <Pill tone="ok">активен</Pill>
          </SettingRow>
        </Card>
      </div>

      <ConfirmDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} onConfirm={() => void logout()} title="Выйти из аккаунта?" text="Данные останутся в облаке — при следующем входе всё будет на месте." confirmLabel="Выйти" />

      <OnboardingModal open={onbOpen} onClose={() => { setOnbOpen(false); router.replace('/profile'); }} profile={p} onDone={() => { setOnbOpen(false); router.refresh(); }} />
    </div>
  );
}

/* ----------------------------- Онбординг ----------------------------- */
function OnboardingModal({ open, onClose, profile, onDone }: { open: boolean; onClose: () => void; profile: Profile; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile.display_name ?? '');
  const [emoji, setEmoji] = useState(profile.emoji ?? '🙂');
  const [busy, setBusy] = useState(false);
  const steps = ['Привет', 'Имя', 'Аватар', 'Готово'];

  const finish = async () => {
    setBusy(true);
    try { await completeOnboarding({ display_name: name.trim() || 'Пилот', emoji }); onDone(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={steps[step]} wide={false}>
      <div className="text-center">
        {step === 0 && (<><span className="text-6xl block mb-4 hv-bob">◈</span>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">HabitVerse — привычки, стрики, челленджи с друзьями, календарь, heatmap, отчёты и напоминания. Настроим профиль за 20 секунд.</p></>)}
        {step === 1 && (<><span className="text-6xl block mb-4 hv-bob">👋</span>
          <p className="text-sm text-[var(--muted)] mb-5">Имя появится в профиле, ленте и лидерборде.</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Имя" className="text-center text-base" autoFocus /></>)}
        {step === 2 && (<><span className="text-6xl block mb-4">{emoji}</span>
          <p className="text-sm text-[var(--muted)] mb-5">Потом можно загрузить фото в кабинете.</p>
          <div className="grid grid-cols-6 gap-2 mb-2">
            {AVATARS.slice(0, 18).map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('aspect-square text-[22px] rounded-[13px] border transition-transform hover:scale-110 hover:-rotate-6', emoji === e ? 'bg-[var(--acc)] border-[var(--acc)] scale-110' : 'bg-[var(--bg2)] border-[var(--stroke)]')}>{e}</button>
            ))}
          </div></>)}
        {step === 3 && (<><span className="text-6xl block mb-4 hv-bob">🚀</span>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-2">Всё готово, <b className="text-[var(--text)]">{name || 'Пилот'}</b> {emoji}</p>
          <p className="text-xs text-[var(--faint)]">Совет: начни с 2–3 привычек. Стабильность важнее количества.</p></>)}
      </div>

      <div className="flex gap-1.5 justify-center mt-6 mb-5">
        {steps.map((_, i) => <i key={i} className={cn('h-[7px] rounded-full transition-all duration-300', i === step ? 'w-6 bg-[var(--acc)]' : 'w-[7px] bg-[var(--stroke2)]')} />)}
      </div>

      <div className="flex gap-2">
        {step > 0 && <Button className="flex-1" onClick={() => setStep(step - 1)}>← Назад</Button>}
        {step < 3
          ? <Button variant="primary" className="flex-[2]" onClick={() => setStep(step + 1)}>Дальше →</Button>
          : <Button variant="primary" className="flex-[2]" disabled={busy} onClick={() => void finish()}>{busy ? 'Сохраняем…' : 'В приложение 🎉'}</Button>}
      </div>
      {step === 0 && <button onClick={onClose} className="w-full mt-3 text-xs text-[var(--faint)] hover:text-[var(--muted)]">Пропустить</button>}
    </Modal>
  );
}
