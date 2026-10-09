'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { D } from '@/lib/dates';
import { COLORS, levelOf } from '@/lib/constants';
import { dueOn } from '@/lib/schedule';
import { isDone, type LogMap } from '@/lib/stats';
import { addFriend, createChallenge, deleteChallenge, joinChallenge, leaveChallenge, nudge, removeFriend, respondFriendship, searchUsers } from '@/lib/actions';
import { Button, Card, CardHead, Chip, Empty, Field, Input, Pill, Select, SettingRow, Textarea, Toggle } from '@/components/ui/primitives';
import { ConfirmDialog, Modal, Sheet } from '@/components/ui/overlays';
import type { Challenge, Habit, Profile } from '@/types/database';

type Member = { user_id: string; score: number; place: number | null; joined_at: string; profile?: { display_name: string; emoji: string; avatar_url: string | null } };
type Friend = { id: string; display_name: string; emoji: string; avatar_url: string | null; xp: number; relation: 'incoming' | 'outgoing' | 'accepted'; friendship_id: string };

export function SocialView({
  profile,
  challenges,
  friends,
  leaderboard,
  habits,
  logs,
}: {
  profile: Profile | null;
  challenges: (Challenge & { members: Member[] })[];
  friends: Friend[];
  leaderboard: { id: string; display_name: string; emoji: string; avatar_url: string | null; xp: number; level: number; done_30d: number }[];
  habits: Habit[];
  logs: LogMap;
}) {
  const router = useRouter();
  const me = profile!;
  const [newOpen, setNewOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [detail, setDetail] = useState<(Challenge & { members: Member[] }) | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  const active = challenges.filter((c) => c.status === 'active');
  const finished = challenges.filter((c) => c.status !== 'active');
  const today = D.today();

  const myScore = (c: Challenge) => {
    const h = habits.find((x) => x.id === c.habit_id);
    if (!h) return 0;
    const keys = D.range(c.start_date, c.end_date < today ? c.end_date : today);
    const due = keys.filter((k) => dueOn(h, k));
    if (!due.length) return 0;
    return Math.round((due.filter((k) => isDone(logs, h.id, k)).length / due.length) * 100);
  };

  const board = useMemo(() => {
    const myXp30 = (() => {
      const keys = D.range(D.add(today, -29), today);
      let n = 0;
      habits.filter((h) => !h.archived).forEach((h) => keys.forEach((k) => { if (isDone(logs, h.id, k)) n += 12; }));
      return n;
    })();
    const rows = [
      { id: me.id, display_name: me.display_name || 'Ты', emoji: me.emoji, avatar_url: me.avatar_url, score: myXp30, level: levelOf(me.xp).level, me: true },
      ...leaderboard.filter((r) => r.id !== me.id).map((r) => ({ id: r.id, display_name: r.display_name, emoji: r.emoji, avatar_url: r.avatar_url, score: r.done_30d * 12, level: r.level, me: false })),
      ...friends.filter((f) => f.relation === 'accepted' && !leaderboard.some((r) => r.id === f.id)).map((f) => ({ id: f.id, display_name: f.display_name, emoji: f.emoji, avatar_url: f.avatar_url, score: Math.round(f.xp * 0.3), level: levelOf(f.xp).level, me: false })),
    ];
    const uniq = new Map<string, (typeof rows)[number]>();
    rows.forEach((r) => { const prev = uniq.get(r.id); if (!prev || r.score > prev.score) uniq.set(r.id, r); });
    return [...uniq.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  }, [leaderboard, friends, habits, logs, me, today]);

  return (
    <div className="p-4 lg:p-7">
      <div className="flex gap-2 items-center flex-wrap mb-4">
        <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>＋ Челлендж</Button>
        <Button size="sm" onClick={() => setJoinOpen(true)}>🔑 Ввести код</Button>
        <Button size="sm" onClick={() => setFriendsOpen(true)}>👥 Друзья {friends.filter((f) => f.relation === 'accepted').length ? `(${friends.filter((f) => f.relation === 'accepted').length})` : ''}</Button>
        <div className="flex-1" />
        <span className="text-[11.5px] text-[var(--faint)]">социальные механики в стиле HabitLink</span>
      </div>

      {friends.some((f) => f.relation === 'incoming') && (
        <Card className="mb-4 border-[color-mix(in_oklab,var(--acc)_40%,transparent)]">
          <CardHead title="📨 Заявки в друзья" />
          <div className="flex flex-col gap-2">
            {friends.filter((f) => f.relation === 'incoming').map((f) => (
              <div key={f.friendship_id} className="flex items-center gap-3">
                <Avatar name={f.display_name} emoji={f.emoji} url={f.avatar_url} />
                <b className="text-sm flex-1">{f.display_name}</b>
                <Button size="sm" variant="primary" onClick={async () => { await respondFriendship(f.friendship_id, true); toast.success(`${f.display_name} теперь в команде`); router.refresh(); }}>Принять</Button>
                <Button size="sm" onClick={async () => { await respondFriendship(f.friendship_id, false); router.refresh(); }}>Отклонить</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 my-5">
        <h2 className="text-lg font-bold tracking-tight">Активные челленджи</h2>
        <span className="flex-1 h-px bg-[linear-gradient(90deg,var(--stroke),transparent)]" />
      </div>

      {active.length ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {active.map((c, i) => (
            <ChallengeCard key={c.id} c={c} index={i} myScore={myScore(c)} meId={me.id} onOpen={() => setDetail(c)} onDelete={() => setDelId(c.id)} onLeave={async () => { await leaveChallenge(c.id); toast.success('Ты покинул челлендж'); router.refresh(); }} />
          ))}
        </div>
      ) : (
        <Empty icon="🔥" title="Челленджей пока нет" text="Челлендж — это привычка + срок + команда. В HabitLink именно «друзья смотрят» заставляет не сдаваться." action={<Button variant="primary" onClick={() => setNewOpen(true)}>＋ Создать челлендж</Button>} />
      )}

      {finished.length > 0 && (
        <>
          <div className="flex items-center gap-3 my-5">
            <h2 className="text-lg font-bold tracking-tight">Завершённые</h2>
            <span className="flex-1 h-px bg-[linear-gradient(90deg,var(--stroke),transparent)]" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            {finished.map((c, i) => <ChallengeCard key={c.id} c={c} index={i} myScore={myScore(c)} meId={me.id} onOpen={() => setDetail(c)} onDelete={() => setDelId(c.id)} />)}
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHead title="🏅 Лидерборд" sub="по XP за 30 дней" />
          <div className="flex flex-col gap-1.5">
            {board.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={cn('grid grid-cols-[26px_34px_1fr_auto] gap-3 items-center px-3 py-2 rounded-[13px] border transition-all hover:translate-x-1',
                  r.me ? 'border-[color-mix(in_oklab,var(--acc)_40%,transparent)] bg-[linear-gradient(100deg,color-mix(in_oklab,var(--acc)_16%,transparent),transparent),var(--card)]' : 'border-[var(--stroke)] bg-[var(--card)]')}>
                <div className={cn('font-extrabold text-sm text-center', i === 0 ? 'text-[#ffd447] drop-shadow-[0_0_8px_#ffd44780]' : i === 1 ? 'text-[#cfd6e6]' : i === 2 ? 'text-[#e0a06a]' : 'text-[var(--faint)]')}>{i + 1}</div>
                <Avatar name={r.display_name} emoji={r.emoji} url={r.avatar_url} size={34} />
                <div className="min-w-0">
                  <div className="text-[13.5px] font-bold truncate">{r.display_name} {r.me && <Pill tone="ok" className="ml-1">ты</Pill>}</div>
                  <div className="text-[11px] text-[var(--faint)]">уровень {r.level}</div>
                </div>
                <div className="text-[15px] font-extrabold tabular">{r.score}<span className="text-[10.5px] text-[var(--faint)] font-semibold ml-1">XP</span></div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="👥 Экипаж" right={
            <Button size="sm" onClick={async () => {
              const accepted = friends.filter((f) => f.relation === 'accepted');
              await Promise.all(accepted.map((f) => nudge(f.id)));
              toast.success(accepted.length ? `Мотивация отправлена ${accepted.length} чел.` : 'Сначала добавь друзей');
            }}>📨 Пнуть всех</Button>
          } />
          {friends.filter((f) => f.relation === 'accepted').length ? (
            <div className="flex flex-col gap-1.5">
              {friends.filter((f) => f.relation === 'accepted').map((f) => (
                <div key={f.id} className="grid grid-cols-[34px_1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-[13px] border border-[var(--stroke)] bg-[var(--card)] hover:translate-x-1 transition-transform">
                  <Avatar name={f.display_name} emoji={f.emoji} url={f.avatar_url} size={34} />
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold truncate">{f.display_name}</div>
                    <div className="text-[11px] text-[var(--faint)]">уровень {levelOf(f.xp).level} · {f.xp} XP</div>
                  </div>
                  <Button size="iconSm" onClick={async () => { await nudge(f.id); toast.success(`${f.emoji} ${f.display_name} получил пинок мотивации`); }} title="Отправить мотивацию">📨</Button>
                  <Button size="iconSm" onClick={async () => { await removeFriend(f.friendship_id); toast.success('Удалён из друзей'); router.refresh(); }} title="Удалить">🗑️</Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl block mb-3 hv-bob">🫂</span>
              <p className="text-sm text-[var(--muted)] mb-4">Добавь друзей — вместе держать стрик легче.</p>
              <Button variant="primary" size="sm" onClick={() => setFriendsOpen(true)}>Найти друзей</Button>
            </div>
          )}
        </Card>
      </div>

      <NewChallengeModal open={newOpen} onClose={() => setNewOpen(false)} habits={habits} onSaved={() => { setNewOpen(false); router.refresh(); }} />
      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} onDone={() => { setJoinOpen(false); router.refresh(); }} />
      <FriendsSheet open={friendsOpen} onClose={() => setFriendsOpen(false)} friends={friends} onChanged={() => router.refresh()} />
      <ChallengeDetail challenge={detail} myScore={detail ? myScore(detail) : 0} meId={me.id} onClose={() => setDetail(null)} />
      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={async () => { if (delId) { await deleteChallenge(delId); toast.success('Челлендж удалён'); router.refresh(); } }} title="Удалить челлендж?" text="Прогресс участников будет потерян." />
    </div>
  );
}

function Avatar({ name, emoji, url, size = 34 }: { name: string; emoji: string; url: string | null; size?: number }) {
  return url ? (
    <img src={url} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover border-2 border-[var(--stroke2)]" />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.47 }} className="rounded-full grid place-items-center bg-[linear-gradient(140deg,var(--acc),var(--acc3))] border-2 border-[var(--stroke2)]">{emoji || '🙂'}</span>
  );
}

function ChallengeCard({ c, index, myScore, meId, onOpen, onDelete, onLeave }: { c: Challenge & { members: Member[] }; index: number; myScore: number; meId: string; onOpen: () => void; onDelete: () => void; onLeave?: () => void }) {
  const left = D.diff(today0(), c.end_date);
  const scores = [...c.members].map((m) => ({ ...m, score: m.user_id === meId ? myScore : Number(m.score) })).sort((a, b) => b.score - a.score);
  const myPos = scores.findIndex((s) => s.user_id === meId) + 1;
  const winner = left <= 0 ? scores[0] : null;
  const imCreator = c.creator_id === meId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      className="relative overflow-hidden p-5 rounded-[var(--r-lg)] border border-[var(--stroke)] cursor-pointer hover:shadow-[0_18px_50px_-12px_rgba(0,0,0,.55)] transition-shadow"
      style={{ background: `linear-gradient(135deg, ${c.color}33, transparent 65%), var(--card)` }}
    >
      <div className="flex gap-3 items-start mb-3">
        <span className="text-[30px]">{c.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[16.5px] font-bold tracking-tight truncate">{c.name}</h3>
          {c.description && <p className="text-[12.5px] text-[var(--muted)] mt-1 line-clamp-2">{c.description}</p>}
        </div>
        {imCreator && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-8 h-8 rounded-[10px] grid place-items-center text-[var(--faint)] hover:text-[var(--bad)] hover:bg-[var(--card)] transition-colors">🗑️</button>}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Pill tone={left <= 0 ? 'none' : left <= 3 ? 'warn' : 'ok'}>{left > 0 ? `⏳ ${left} дн. осталось` : '✅ завершён'}</Pill>
        <Pill>{D.human(c.start_date)} → {D.human(c.end_date)}</Pill>
        <Pill>👥 {c.members.length}</Pill>
        <Pill tone="warn">🔑 {c.invite_code}</Pill>
        {myPos > 0 && <Pill tone={myPos === 1 ? 'ok' : 'none'}>место: {myPos}</Pill>}
        {c.status !== 'active' && <Pill>архив</Pill>}
      </div>

      <div className="h-2 rounded-full bg-[var(--stroke)] overflow-hidden mb-2">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${myScore}%`, background: `linear-gradient(90deg,${c.color},${c.color}88)` }} />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[11.5px] text-[var(--muted)]">Мой прогресс: <b className="text-[var(--text)]">{myScore}%</b></span>
        <div className="flex -space-x-2">
          {scores.slice(0, 5).map((m) => (
            <span key={m.user_id} title={m.profile?.display_name ?? '—'} className="w-[30px] h-[30px] rounded-full grid place-items-center text-sm border-2 border-[var(--bg2)] hover:-translate-y-1 hover:scale-110 transition-transform z-10" style={{ background: `linear-gradient(140deg,${c.color},${c.color}88)` }}>
              {m.profile?.avatar_url ? <img src={m.profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" /> : m.profile?.emoji ?? '🙂'}
            </span>
          ))}
        </div>
      </div>

      {winner && (
        <>
          <div className="h-px bg-[var(--stroke)] my-3" />
          <p className="text-[13px]"><b>🏆 Победитель:</b> {winner.profile?.emoji ?? '🙂'} {winner.profile?.display_name ?? '—'} — {Math.round(winner.score)}%</p>
        </>
      )}
      {onLeave && c.status === 'active' && !imCreator && (
        <Button size="sm" className="mt-3" onClick={(e) => { e.stopPropagation(); onLeave(); }}>Покинуть</Button>
      )}
    </motion.div>
  );
}
const today0 = () => D.today();

function NewChallengeModal({ open, onClose, habits, onSaved }: { open: boolean; onClose: () => void; habits: Habit[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [emoji, setEmoji] = useState('🔥');
  const [color, setColor] = useState<string>(COLORS[2]);
  const [habitId, setHabitId] = useState(habits[0]?.id ?? '');
  const [days, setDays] = useState(30);
  const [start, setStart] = useState(D.today());
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error('Введи название челленджа');
    setBusy(true);
    try {
      await createChallenge({ name: name.trim(), description: desc, emoji, color, habit_id: habitId || null, start_date: start, days, is_public: isPublic });
      toast.success(`Челлендж «${name}» создан · +40 XP`);
      setName(''); setDesc('');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Новый челлендж" footer={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" onClick={save} disabled={busy}>Создать</Button></>}>
      <Field label="Название *"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="30 дней без сахара" /></Field>
      <Field label="Описание" hint="Правила, ставка, приз"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-[70px]" /></Field>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Иконка"><Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} /></Field>
        <Field label="Цвет">
          <div className="flex flex-wrap gap-2">
            {COLORS.slice(0, 10).map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} className={cn('w-[34px] h-[34px] rounded-[11px] transition-transform hover:scale-110 hover:rotate-6', color === c && 'ring-2 ring-[var(--text)] scale-110')} style={{ background: c }} />
            ))}
          </div>
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Привычка">
          <Select value={habitId} onChange={(e) => setHabitId(e.target.value)}>
            {habits.length ? habits.map((h) => <option key={h.id} value={h.id}>{h.emoji} {h.name}</option>) : <option value="">— сначала создай привычку —</option>}
          </Select>
        </Field>
        <Field label="Длительность">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 14, 21, 30, 60, 90].map((d) => <option key={d} value={d}>{d} дней</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Старт"><Input type="date" value={start} max={D.add(D.today(), 60)} onChange={(e) => setStart(e.target.value)} /></Field>
      <Card><SettingRow title="Публичный челлендж" desc="Виден всем пользователям в поиске"><Toggle on={isPublic} onChange={setIsPublic} label="Публичный" /></SettingRow></Card>
    </Modal>
  );
}

function JoinModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} icon="🔑" title="Вступить по коду">
      <Field label="Код приглашения"><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXXXXXX" className="uppercase tracking-[.14em] font-extrabold" /></Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="primary" disabled={busy || !code.trim()} onClick={async () => {
          setBusy(true);
          try { await joinChallenge(code.trim()); toast.success('Ты в челлендже!'); onDone(); }
          catch (e) { toast.error(e instanceof Error ? e.message : 'Не удалось вступить'); }
          finally { setBusy(false); }
        }}>Вступить</Button>
      </div>
    </Sheet>
  );
}

function FriendsSheet({ open, onClose, friends, onChanged }: { open: boolean; onClose: () => void; friends: Friend[]; onChanged: () => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ id: string; display_name: string; emoji: string; avatar_url: string | null; xp: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const search = async () => { setBusy(true); setRes(await searchUsers(q)); setBusy(false); };
  const known = new Set(friends.map((f) => f.id));

  return (
    <Sheet open={open} onClose={onClose} icon="👥" title="Друзья">
      <Field label="Поиск по имени или e-mail">
        <div className="flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search()} placeholder="минимум 2 символа" />
          <Button variant="primary" onClick={() => void search()} disabled={busy || q.trim().length < 2}>Найти</Button>
        </div>
      </Field>
      {res.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-4">
          {res.map((u) => (
            <div key={u.id} className="grid grid-cols-[34px_1fr_auto] gap-3 items-center px-3 py-2 rounded-[13px] border border-[var(--stroke)] bg-[var(--card)]">
              <Avatar name={u.display_name} emoji={u.emoji} url={u.avatar_url} size={34} />
              <div className="min-w-0"><div className="text-[13.5px] font-bold truncate">{u.display_name}</div><div className="text-[11px] text-[var(--faint)]">{u.xp} XP</div></div>
              {known.has(u.id) ? <Pill>в друзьях</Pill> : <Button size="sm" variant="soft" onClick={async () => { try { await addFriend(u.id); toast.success('Заявка отправлена'); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Ошибка'); } }}>＋ Добавить</Button>}
            </div>
          ))}
        </div>
      )}
      <div className="h-px bg-[var(--stroke)] my-4" />
      <div className="text-[11.5px] font-bold text-[var(--muted)] uppercase tracking-[.08em] mb-2.5">Мои друзья</div>
      {friends.filter((f) => f.relation === 'accepted').length ? (
        <div className="flex flex-col gap-1.5">
          {friends.filter((f) => f.relation === 'accepted').map((f) => (
            <div key={f.id} className="grid grid-cols-[34px_1fr_auto] gap-3 items-center px-3 py-2 rounded-[13px] border border-[var(--stroke)] bg-[var(--card)]">
              <Avatar name={f.display_name} emoji={f.emoji} url={f.avatar_url} size={34} />
              <div className="min-w-0"><div className="text-[13.5px] font-bold truncate">{f.display_name}</div><div className="text-[11px] text-[var(--faint)]">{f.xp} XP</div></div>
              <Button size="iconSm" onClick={async () => { await removeFriend(f.friendship_id); toast.success('Удалён'); onChanged(); }}>🗑️</Button>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-[var(--muted)]">Пока никого. Найди друга по имени — он должен быть зарегистрирован.</p>}
      <div className="flex justify-end mt-5"><Button onClick={onClose}>Готово</Button></div>
    </Sheet>
  );
}

function ChallengeDetail({ challenge, myScore, meId, onClose }: { challenge: (Challenge & { members: Member[] }) | null; myScore: number; meId: string; onClose: () => void }) {
  if (!challenge) return null;
  const c = challenge;
  const scores = [...c.members].map((m) => ({ ...m, score: m.user_id === meId ? myScore : Number(m.score) })).sort((a, b) => b.score - a.score);
  const keys = D.range(c.start_date, c.end_date < D.today() ? c.end_date : D.today());
  return (
    <Sheet open={!!challenge} onClose={onClose} icon={c.emoji} title={c.name}>
      <p className="text-sm text-[var(--muted)] -mt-2 mb-3">{D.human(c.start_date)} → {D.human(c.end_date)} · {D.diff(c.start_date, c.end_date) + 1} дней</p>
      {c.description && <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-4">{c.description}</p>}
      <Card className="mb-3">
        <b className="text-[13px]">🔑 Код приглашения</b>
        <div className="flex gap-2 mt-2">
          <code className="flex-1 px-3 py-2.5 rounded-[10px] bg-[var(--bg2)] text-[15px] tracking-[.14em] font-extrabold">{c.invite_code}</code>
          <Button size="sm" variant="soft" onClick={() => { void navigator.clipboard?.writeText(c.invite_code); toast.success('Код скопирован'); }}>Копировать</Button>
        </div>
        <p className="text-[11.5px] text-[var(--faint)] mt-2">Поделись кодом — друзья вступят в челлендж.</p>
      </Card>
      <Card>
        <CardHead title="Участники" sub={`${keys.length} дней прошло`} />
        <div className="flex flex-col gap-1.5">
          {scores.map((m, i) => (
            <div key={m.user_id} className={cn('grid grid-cols-[26px_34px_1fr_auto] gap-3 items-center px-3 py-2 rounded-[13px] border', m.user_id === meId ? 'border-[color-mix(in_oklab,var(--acc)_40%,transparent)] bg-[var(--acc-soft)]' : 'border-[var(--stroke)] bg-[var(--card)]')}>
              <div className={cn('font-extrabold text-sm text-center', i === 0 ? 'text-[#ffd447]' : 'text-[var(--faint)]')}>{i + 1}</div>
              <Avatar name={m.profile?.display_name ?? ''} emoji={m.profile?.emoji ?? '🙂'} url={m.profile?.avatar_url ?? null} size={34} />
              <div className="text-[13.5px] font-bold truncate">{m.profile?.display_name ?? '—'} {m.user_id === meId && <Pill tone="ok" className="ml-1">ты</Pill>}</div>
              <div className="text-[15px] font-extrabold tabular">{Math.round(m.score)}%</div>
            </div>
          ))}
        </div>
      </Card>
    </Sheet>
  );
}
