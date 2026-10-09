'use client';

/* ============================================================
   Команда (фаза 5.3) — порт renderTeam + ленты из v2/app.js.
   Челленджи (карточки, создание, код приглашения, детали),
   лидерборд за 30 дней, экипаж с поддержкой, живая лента
   с реакциями. Демо-режим: команда смоделирована; реальные
   друзья и приглашения — фаза 5.4 (Supabase).
   UI-хром без эмодзи; эмодзи — только контент (иконки челленджей,
   реакции, аватары привычек).
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { ChallengeModal, JoinCodeModal } from '@/components/challenge-modal';
import { ChallengeSheet } from '@/components/challenge-sheet';
import { ConfirmDialog } from '@/components/confirm';
import { Icon } from '@/components/icon';
import { PageHead } from '@/components/page-head';
import { hv, useHv } from '@/lib/store';
import {
  D, REACTIONS, acceptedFriends, addFeed, challengeProgress, friendById, incomingFriends,
  isDone, streakOf, visibleHabits,
  type Challenge, type FeedItem, type Friend,
} from '@/lib/engine';
import { toast } from '@/lib/ui';

function daysWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
  return 'дней';
}
function membersWord(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'участник';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'участника';
  return 'участников';
}

/* ---------- карточка челленджа ---------- */
function ChalCard({ c, index, onOpen }: { c: Challenge; index: number; onOpen: () => void }) {
  const { state } = useHv();
  const [menu, setMenu] = useState<'closed' | 'open' | 'confirm'>('closed');
  const menuHost = useRef<HTMLDivElement>(null);
  const today = D.today();

  useEffect(() => {
    if (menu === 'closed') return;
    const onDown = (e: MouseEvent) => { if (menuHost.current && !menuHost.current.contains(e.target as Node)) setMenu('closed'); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  const ms = challengeProgress(state, c);
  const parts = c.participants || [];
  const scores = parts
    .map((p) => ({ ...p, score: p.id === 'me' ? ms.pct : Number(p.score) || 0 }))
    .sort((a, b) => b.score - a.score);
  const myPos = scores.findIndex((x) => x.id === 'me') + 1;
  const left = D.diff(today, c.end);
  const winner = left <= 0 ? scores[0] : null;
  const code = c.invite_code || c.code || '';

  const copyCode = (): void => {
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast(`Код скопирован: ${code}`, 'ok'), () => toast(code, 'info'));
    else toast(code, 'info');
  };

  return (
    <article className="chal-card" style={{ animationDelay: `${index * 30}ms` }} onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}>
      <header>
        <span className="cc-em" style={{
          color: c.color,
          background: `color-mix(in oklab, ${c.color} 12%, var(--surface))`,
          borderColor: `color-mix(in oklab, ${c.color} 26%, var(--border))`,
        }} aria-hidden="true">{c.emoji}</span>
        <div className="cc-t">
          <h3>{c.name}</h3>
          {c.desc ? <p>{c.desc}</p> : null}
        </div>
        <div ref={menuHost} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button className="cc-menu" title="Действия" aria-label="Действия с челленджем"
            onClick={() => setMenu(menu === 'closed' ? 'open' : 'closed')}>
            <Icon name="dots" size={15} />
          </button>
          {menu !== 'closed' ? (
            <div className="menu" style={{ right: 0, top: '100%', marginTop: 4 }}>
              {menu === 'open' ? (
                <>
                  <button onClick={() => { setMenu('closed'); onOpen(); }}><Icon name="chevR" size={14} /> Открыть</button>
                  <button onClick={() => { setMenu('closed'); copyCode(); }}><Icon name="copy" size={14} /> Скопировать код</button>
                  <hr />
                  <button className="danger" onClick={() => setMenu('confirm')}><Icon name="trash" size={14} /> Удалить</button>
                </>
              ) : (
                <>
                  <div className="label">«{c.name}» и прогресс участников будут удалены.</div>
                  <button className="danger" onClick={() => { setMenu('closed'); hv.removeChallengeById(c.id); toast('Челлендж удалён', 'warn'); }}>
                    <Icon name="trash" size={14} /> Да, удалить
                  </button>
                  <button onClick={() => setMenu('closed')}><Icon name="x" size={14} /> Отмена</button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className="cc-tags">
        <span className={`tag ${left > 0 ? (left <= 3 ? 'warn' : 'ok') : ''}`}>{left > 0 ? `осталось ${left} дн.` : 'завершён'}</span>
        <span className="tag">{D.human(c.start)} → {D.human(c.end)}</span>
        <span className="tag">{parts.length} {membersWord(parts.length)}</span>
        <button className="tag" title="Скопировать код приглашения" onClick={(e) => { e.stopPropagation(); copyCode(); }}>
          <Icon name="link" size={11} /> {code}
        </button>
        {myPos ? <span className={`tag ${myPos === 1 ? 'ok' : ''}`}>место {myPos}</span> : null}
      </div>

      <div className="cc-prog">
        <div className="progress"><i style={{ width: `${ms.pct}%`, background: c.color }} /></div>
        <span className="num">{ms.pct}%</span>
      </div>

      <footer onClick={(e) => e.stopPropagation()}>
        <div className="avstack">
          {parts.slice(0, 5).map((p) => <Avatar key={p.id} p={{ name: p.name, avatar_url: p.avatar }} size={24} />)}
        </div>
        <span className="cc-me">мой прогресс: <b className="num">{ms.done}/{ms.days}</b> дней</span>
      </footer>

      {winner ? (
        <div className="cc-win"><Icon name="award" size={14} /> Победитель: <b>{winner.name}</b> — {Math.round(winner.score)}%</div>
      ) : null}
    </article>
  );
}

/* ---------- элемент ленты ---------- */
function FeedRow({ f, isNew }: { f: FeedItem; isNew: boolean }) {
  const { state } = useHv();
  const isMe = f.who === 'me';
  const who = isMe
    ? { name: state.profile.name || 'Вы', avatar_url: state.profile.avatar }
    : (() => { const fr = friendById(state, f.who); return { name: fr.display_name || fr.name, avatar_url: fr.avatar_url }; })();
  const p = f.data || {};
  const habit = p.habitId ? state.habits.find((h) => h.id === p.habitId) : null;
  const date = p.key ? D.human(p.key) : '';

  let txt: React.ReactNode = 'обновляет прогресс';
  switch (f.type) {
    case 'checkin':
      txt = habit
        ? <>отмечает <span aria-hidden="true">{habit.emoji}</span> <b>{habit.name}</b>{date && date !== 'сегодня' ? <> за {date}</> : null}</>
        : 'отмечает привычку';
      break;
    case 'uncheck': txt = habit ? <>снимает отметку: {habit.name}</> : 'снимает отметку'; break;
    case 'newhabit': txt = habit ? <>создаёт привычку <span aria-hidden="true">{habit.emoji}</span> <b>{habit.name}</b></> : 'создаёт привычку'; break;
    case 'delhabit': txt = 'архивирует привычку'; break;
    case 'streak': txt = p.days ? <>держит стрик <b className="num">{p.days}</b> {daysWord(p.days)}</> : 'обновляет стрик'; break;
    case 'perfect': txt = 'закрывает день полностью'; break;
    case 'level': txt = 'закрывает неделю по квоте'; break;
    case 'note': txt = 'добавляет заметку'; break;
    case 'challenge': txt = p.action === 'join' ? 'вступает в челлендж' : 'запускает челлендж'; break;
    case 'nudge': txt = isMe ? 'поддерживает команду' : 'шлёт вам поддержку'; break;
    case 'join': txt = 'присоединяется к команде'; break;
    default: break;
  }

  const reacts = state.reactions[f.id] || {};

  return (
    <div className={`feed-item ${isNew ? 'new' : ''}`}>
      <Avatar p={who} size={30} />
      <div className="fi-b">
        <div className="fi-t"><b>{who.name}</b> {txt}</div>
        <div className="fi-time">{D.ago(f.ts)}</div>
        <div className="reacts">
          {REACTIONS.map((em) => {
            const arr = reacts[em] || [];
            const mine = arr.includes('me');
            const names = arr.map((x) => (x === 'me' ? 'вы' : friendById(state, x).name)).join(', ');
            return (
              <button key={em} className={`react ${mine ? 'on' : ''}`} title={names || 'Поставить реакцию'}
                onClick={() => hv.react(f.id, em)}>
                <span aria-hidden="true">{em}</span>{arr.length ? <b> {arr.length}</b> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- страница ---------- */
export default function TeamPage() {
  const { state, ready } = useHv();
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [modal, setModal] = useState<'new' | 'join' | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'friend' | 'request'; f: Friend } | null>(null);

  /* ?new=1 — из ⌘K */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('new') === '1') setModal('new');
  }, []);

  /* фоновая имитация активности команды (как в демо: раз в 2 мин, 45%) */
  useEffect(() => {
    const tm = setInterval(() => { if (Math.random() < 0.45) hv.simulateActivity(); }, 120000);
    return () => clearInterval(tm);
  }, []);

  const today = D.today();
  const active = state.challenges.filter((c) => c.status === 'active');
  const finished = state.challenges.filter((c) => c.status !== 'active');
  const accepted = acceptedFriends(state);
  const incoming = incomingFriends(state);

  const board = useMemo(() => {
    if (!ready) return [];
    const keys30 = D.daysBetween(D.add(today, -29), today);
    const habits = visibleHabits(state);
    const myMarks = keys30.reduce((n, k) => n + habits.filter((h) => isDone(state, h.id, k)).length, 0);
    const myStreak = Math.max(0, ...habits.map((h) => streakOf(state, h, undefined, { persist: false }).cur), 0);
    const rows = [
      { id: 'me', name: state.profile.name || 'Вы', avatar_url: state.profile.avatar, score: myMarks, me: true, streak: myStreak },
      ...accepted.map((f) => ({
        id: f.id, name: f.display_name || f.name, avatar_url: f.avatar_url,
        score: Math.round((f.xp ?? 0) * 0.3) || 12 + ((f.id.charCodeAt(2) || 0) % 40),
        me: false, streak: f.streak || 0,
      })),
    ];
    return rows.sort((a, b) => b.score - a.score);
  }, [state, ready, today, accepted]);

  const feed = state.feed.slice(0, 50);

  return (
    <>
      <PageHead
        title="Команда"
        sub={ready ? `${accepted.length} в экипаже · ${active.length} активных челленджей` : 'Загрузка…'}
        crumbs={[{ name: 'Команда' }]}
      />

      <section className="page active">
        {!ready ? (
          <div className="empty card"><span className="em"><Icon name="users" size={30} /></span><h3>Загружаем данные…</h3></div>
        ) : (
          <>
            {incoming.length ? (
              <div className="banner">
                <Icon name="users" size={16} />
                <div><b>Заявки в друзья: {incoming.length}</b><span>{incoming.map((f) => f.display_name || f.name).join(', ')}</span></div>
                <div style={{ flex: 1 }} />
                {incoming.map((f) => (
                  <span key={f.id} style={{ display: 'inline-flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => { hv.mutate((s) => { const x = s.friends.find((y) => y.id === f.id); if (x) x.relation = 'accepted'; }); toast(`${f.display_name || f.name} в экипаже`, 'ok'); }}>
                      <Icon name="check" size={13} /> Принять
                    </button>
                    <button className="btn btn-sm btn-quiet" onClick={() => setConfirm({ kind: 'request', f })}>Отклонить</button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="sec-h">
              <h2>Активные челленджи</h2><span className="tag">{active.length}</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={() => setModal('join')}><Icon name="link" size={13} /> Ввести код</button>
              <button className="btn btn-sm btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={13} /> Челлендж</button>
            </div>
            {active.length ? (
              <div className="chal-grid">
                {active.map((c, i) => <ChalCard key={c.id} c={c} index={i} onOpen={() => setSheetId(c.id)} />)}
              </div>
            ) : (
              <div className="empty card-flat">
                <span className="em"><Icon name="flag" size={30} /></span>
                <h3>Челленджей пока нет</h3>
                <p>Челлендж — это привычка, срок и команда. Создайте свой или вступите по коду приглашения.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn" onClick={() => setModal('join')}>Ввести код</button>
                  <button className="btn btn-primary" onClick={() => setModal('new')}>Создать</button>
                </div>
              </div>
            )}

            {finished.length ? (
              <>
                <div className="sec-h" style={{ marginTop: 26 }}><h2>Завершённые</h2><span className="tag">{finished.length}</span></div>
                <div className="chal-grid">
                  {finished.map((c, i) => <ChalCard key={c.id} c={c} index={i} onOpen={() => setSheetId(c.id)} />)}
                </div>
              </>
            ) : null}

            <div className="grid g2" style={{ marginTop: 26, alignItems: 'start' }}>
              <div className="card">
                <div className="card-h"><h3>Лидерборд</h3><div style={{ flex: 1 }} /><span className="label">отметок за 30 дней</span></div>
                {board.length ? board.map((r, i) => (
                  <div className={`lb-row ${r.me ? 'me' : ''}`} key={r.id}>
                    <span className="lb-pos num">{i + 1}</span>
                    <Avatar p={{ name: r.name, avatar_url: r.avatar_url }} size={30} />
                    <div className="lb-t">
                      <b>{r.name}{r.me ? <span className="tag" style={{ marginLeft: 6 }}>вы</span> : null}</b>
                      <span>стрик {r.streak}</span>
                    </div>
                    <span className="lb-score num">{r.score}</span>
                  </div>
                )) : <p className="hint">Добавьте друзей, чтобы увидеть сравнение.</p>}
              </div>

              <div className="card">
                <div className="card-h">
                  <h3>Экипаж</h3><div style={{ flex: 1 }} />
                  <button className="btn btn-sm" onClick={() => toast('Поиск друзей приедет с Supabase — фаза 5.4', 'info')}>
                    <Icon name="search" size={13} /> Найти
                  </button>
                  <button className="btn btn-sm" title="Отправить поддержку всем" aria-label="Отправить поддержку всем"
                    onClick={() => {
                      if (!accepted.length) { toast('Сначала добавьте друзей', 'info'); return; }
                      hv.mutate((s) => { accepted.forEach((f) => addFeed(s, 'nudge', { friend: f.id, me: true })); });
                      toast('Поддержка отправлена команде', 'ok');
                    }}>
                    <Icon name="send" size={13} />
                  </button>
                </div>
                {accepted.length ? accepted.map((f) => (
                  <div className="crew-row" key={f.id}>
                    <Avatar p={f} size={30} />
                    <div className="lb-t"><b>{f.display_name || f.name}</b><span>{f.bio || 'в команде'}</span></div>
                    <span className="tag"><Icon name="trend" size={11} /> {f.streak || 0}</span>
                    <div className="crew-acts">
                      <button title="Поддержать" aria-label={`Поддержать: ${f.name}`}
                        onClick={() => { hv.nudge(f.id); toast(`${f.display_name || f.name}: поддержка отправлена`, 'ok'); }}>
                        <Icon name="send" size={13} />
                      </button>
                      <button title="Убрать из друзей" aria-label={`Убрать из друзей: ${f.name}`} onClick={() => setConfirm({ kind: 'friend', f })}>
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="empty card-flat" style={{ padding: '28px 16px' }}>
                    <span className="em"><Icon name="users" size={26} /></span>
                    <h3>Пока один</h3>
                    <p>В демо-режиме экипаж можно загрузить вместе с демо-данными. Реальные друзья — фаза 5.4.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => { hv.seed(); toast('Демо-данные загружены', 'ok'); }}>Демо-данные</button>
                  </div>
                )}
              </div>
            </div>

            <div className="sec-h" style={{ marginTop: 26 }}>
              <h2>Лента</h2>
              <div style={{ flex: 1 }} />
              <button className="btn btn-sm" title="Симулировать активность команды"
                onClick={() => { hv.simulateActivity(); toast('Лента обновлена', 'ok'); }}>
                <Icon name="spark" size={13} /> Обновить
              </button>
            </div>
            <div className="card feed-card">
              {feed.length ? feed.map((f, i) => <FeedRow key={f.id} f={f} isNew={i === 0} />) : (
                <div className="empty" style={{ padding: '30px 16px' }}>
                  <span className="em"><Icon name="spark" size={26} /></span>
                  <h3>Лента пуста</h3>
                  <p>Отметьте привычку — здесь появится событие.</p>
                </div>
              )}
            </div>

            <p className="xs faint" style={{ marginTop: 14 }}>
              Команда работает в демо-режиме: экипаж и события смоделированы. Реальные друзья, приглашения и живой лидерборд приедут в фазе 5.4 вместе с Supabase.
            </p>
          </>
        )}
      </section>

      {sheetId ? <ChallengeSheet id={sheetId} onClose={() => setSheetId(null)} /> : null}
      {modal === 'new' ? <ChallengeModal onClose={() => setModal(null)} /> : null}
      {modal === 'join' ? <JoinCodeModal onClose={() => setModal(null)} /> : null}
      {confirm ? (
        <ConfirmDialog
          title={confirm.kind === 'friend' ? 'Убрать из друзей?' : 'Отклонить заявку?'}
          text={confirm.kind === 'friend' ? 'Вы перестанете видеть отметки друг друга.' : `${confirm.f.display_name || confirm.f.name} не присоединится к экипажу.`}
          label={confirm.kind === 'friend' ? 'Убрать' : 'Отклонить'}
          onClose={() => setConfirm(null)}
          onConfirm={() => { hv.removeFriendById(confirm.f.id); toast(confirm.kind === 'friend' ? 'Убрано из друзей' : 'Заявка отклонена', 'warn'); }}
        />
      ) : null}
    </>
  );
}
