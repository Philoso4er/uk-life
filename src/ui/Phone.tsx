import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BTL_DEPOSIT, BTL_RENT, CROP_BY_ID, PLOT_RENT, STATUS_ITEMS, buyStatus, cropLeft } from '../game/owning';
import { EMERGENCY_CREDIT, UC_SEARCHES, UC_WORK_ALLOWANCE, meterDaily, ucAward } from '../game/events';
import type { Engine, Snapshot } from '../game/engine';
import { GOALS, HOMES, JOBS, LEVEL_PAY, completeGoal, jobTitle, levelPay, money, nextLevelXp, shiftAvailability, type GameEvent } from '../game/economy';
import { NEEDS, moodPayMult } from '../game/needs';
import { CONTACTS, PERSONAS, contactAuthor } from '../game/npcs';
import type { Author, Post, SocialSnapshot } from '../game/social';
import { DOW_LONG, RENT_HOUR, fmtDuration, london, msUntilRent } from '../game/time';
import type { SaveState } from '../game/types';
import { MAX_DM, MAX_POST } from '../net/filter';
import { avatarUrl } from './avatarUrl';

export type PhoneApp = 'home' | 'natter' | 'messages' | 'new' | 'work' | 'bank' | 'goals' | 'me' | 'settings' | 'shop' | 'stuff' | `thread:${string}`;

const ago = (ts: number) => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'now';
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
};
const REPLYABLE_SYS = new Set(['sys:mum', 'sys:dave']);
const readOnly = (a: Author) => a.kind === 'system' && !REPLYABLE_SYS.has(a.id);
const bioOf = (a: Author) => PERSONAS.find((p) => p.name === a.name)?.bio ?? Object.values(CONTACTS).find((c) => c.name === a.name)?.bio ?? (a.kind === 'player' ? 'A real person, somewhere in Peckwell.' : a.kind === 'system' ? 'Automated. Does not do replies.' : '');

export function Face({ a, size = 36 }: { a: Author; size?: number }) {
  if (a.avatar) return <img className="face" src={avatarUrl(a.avatar, size)} width={size} height={size} alt="" style={{ background: a.colour ?? '#2b3550' }} />;
  return (
    <span className="face face-initial" style={{ width: size, height: size, background: a.colour ?? '#636e72', fontSize: size * 0.45 }} aria-hidden>
      {a.name[0]}
    </span>
  );
}

export function Phone({
  engine,
  snap,
  app,
  setApp,
  onClose,
  onEvents,
  toast,
  onQuit,
  onReset,
}: {
  engine: Engine;
  snap: Snapshot;
  app: PhoneApp;
  setApp: (a: PhoneApp) => void;
  onClose: () => void;
  onEvents: (ev: GameEvent[]) => void;
  toast: (t: string, tone?: 'good' | 'bad' | 'info') => void;
  onQuit: () => void;
  onReset: () => void;
}) {
  const social = useSyncExternalStore(engine.social.subscribe, engine.social.getSnapshot);
  const t = london(snap.now);
  const back = () => setApp(app.startsWith('thread:') ? 'messages' : app === 'new' ? 'messages' : 'home');
  const title: Record<string, string> = { natter: 'Natter', messages: 'Messages', new: 'New message', work: 'Work', bank: 'Bank', goals: 'Goals', me: 'Me', settings: 'Settings', shop: 'Amazin’', stuff: 'My Stuff' };
  const peer = app.startsWith('thread:') ? social.authors[app.slice(7)] ?? engine.social.author(app.slice(7)) : null;

  return (
    <div className="phone-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="phone" role="dialog" aria-modal="true" aria-label="Your phone">
        <div className="phone-status">
          <span>{t.label.slice(4)}</span>
          <span className="phone-island" />
          <span>4G ▂▄▆ 3%</span>
        </div>
        {app !== 'home' ? (
          <div className="phone-appbar">
            <button className="icon-btn" onClick={back} aria-label="Back">
              ‹
            </button>
            {peer ? (
              <ThreadHead peer={peer} engine={engine} toast={toast} onGone={() => setApp('messages')} />
            ) : (
              <h2>{app === 'natter' ? <span className="natter-logo">natter</span> : title[app]}</h2>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Close phone">
              ✕
            </button>
          </div>
        ) : null}
        <div className={'phone-screen app-' + app.split(':')[0]}>
          {app === 'home' ? (
            <Home snap={snap} social={social} setApp={setApp} onClose={onClose} />
          ) : app === 'natter' ? (
            <Natter engine={engine} social={social} onEvents={onEvents} toast={toast} openDM={(id) => setApp(`thread:${id}`)} />
          ) : app === 'messages' ? (
            <Threads social={social} setApp={setApp} />
          ) : app === 'new' ? (
            <NewMessage engine={engine} setApp={setApp} />
          ) : peer ? (
            <Thread engine={engine} social={social} peer={peer} onEvents={onEvents} toast={toast} />
          ) : app === 'work' ? (
            <Work save={engine.save} />
          ) : app === 'bank' ? (
            <Bank save={engine.save} snap={snap} />
          ) : app === 'goals' ? (
            <Goals snap={snap} />
          ) : app === 'me' ? (
            <Me save={engine.save} snap={snap} />
          ) : app === 'shop' ? (
            <Shop engine={engine} onEvents={onEvents} toast={toast} />
          ) : app === 'stuff' ? (
            <Stuff save={engine.save} />
          ) : app === 'settings' ? (
            <Settings engine={engine} social={social} onQuit={onQuit} onReset={onReset} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ home screen
function Home({ snap, social, setApp, onClose }: { snap: Snapshot; social: SocialSnapshot; setApp: (a: PhoneApp) => void; onClose: () => void }) {
  const t = london(snap.now);
  const goalsLeft = GOALS.filter((g) => !snap.goals[g.id]).length;
  const apps: { id: PhoneApp; icon: string; label: string; badge?: number; bg: string }[] = [
    { id: 'natter', icon: '💬', label: 'Natter', badge: social.feedUnread, bg: 'linear-gradient(135deg,#ff7a59,#ff3d6e)' },
    { id: 'messages', icon: '✉️', label: 'Messages', badge: social.dmUnread, bg: 'linear-gradient(135deg,#3ddc84,#11998e)' },
    { id: 'work', icon: '💼', label: 'Work', bg: 'linear-gradient(135deg,#5b8cff,#3a56d4)' },
    { id: 'bank', icon: '🏦', label: 'Bank', bg: 'linear-gradient(135deg,#2c3e50,#4ca1af)' },
    { id: 'goals', icon: '🎯', label: 'Goals', badge: goalsLeft ? undefined : 0, bg: 'linear-gradient(135deg,#ffd23f,#ff9f1c)' },
    { id: 'me', icon: '🙂', label: 'Me', bg: 'linear-gradient(135deg,#a18cd1,#7b5cc4)' },
    { id: 'shop', icon: '📦', label: 'Amazin’', bg: 'linear-gradient(135deg,#232f3e,#ff9900)' },
    { id: 'stuff', icon: '🏡', label: 'My Stuff', bg: 'linear-gradient(135deg,#56ab2f,#a8e063)' },
    { id: 'settings', icon: '⚙️', label: 'Settings', bg: 'linear-gradient(135deg,#636e72,#2d3436)' },
  ];
  return (
    <div className="phone-home">
      <div className="lock-clock">
        <div className="lock-time">{t.label.slice(4)}</div>
        <div className="lock-date">
          {DOW_LONG[t.dayIdx]} · {snap.raining ? '🌧️ Raining (obviously)' : t.hh >= 20 || t.hh < 6 ? '🌙 Clear-ish' : '⛅ Grey but dry'}
        </div>
      </div>
      <div className="app-grid">
        {apps.map((a) => (
          <button key={a.id} className="app-icon" onClick={() => setApp(a.id)} aria-label={a.label + (a.badge ? ` (${a.badge} new)` : '')}>
            <span className="app-tile" style={{ background: a.bg }}>
              {a.icon}
              {a.badge ? <span className="badge">{a.badge > 9 ? '9+' : a.badge}</span> : null}
            </span>
            <span className="app-label">{a.label}</span>
          </button>
        ))}
      </div>
      <div className="widgets">
        <button className="widget" onClick={() => setApp('bank')}>
          <span className="muted small">Rent day</span>
          <b>{snap.home === 'sofa' ? 'Free (Dave)' : `in ${fmtDuration(msUntilRent(snap.now))}`}</b>
        </button>
        <button className="widget" onClick={() => setApp('goals')}>
          <span className="muted small">Next goal</span>
          <b>{GOALS.find((g) => !snap.goals[g.id])?.label ?? 'All done. Legend.'}</b>
        </button>
      </div>
      <button className="btn btn-ghost phone-pocket" onClick={onClose}>
        Put phone away
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Natter (the feed)
function Natter({ engine, social, onEvents, toast, openDM }: { engine: Engine; social: SocialSnapshot; onEvents: (ev: GameEvent[]) => void; toast: (t: string, tone?: 'good' | 'bad' | 'info') => void; openDM: (id: string) => void }) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [limit, setLimit] = useState(25);
  useEffect(() => {
    engine.social.markFeedSeen();
  }, [engine, social.posts.length]);
  const tops = useMemo(() => social.posts.filter((p) => !p.replyTo), [social.posts]);
  const replies = useMemo(() => {
    const m = new Map<string, Post[]>();
    for (const p of social.posts) if (p.replyTo) m.set(p.replyTo, [p, ...(m.get(p.replyTo) ?? [])]);
    return m;
  }, [social.posts]);
  const send = (raw: string, parent?: string) => {
    const err = engine.social.post(raw, parent);
    if (err) {
      toast(err, 'bad');
      return false;
    }
    const s = engine.save;
    s.stats.posts++;
    if (!parent) engine.say(raw);
    const out: GameEvent[] = [];
    completeGoal(s, 'chat', out);
    onEvents(out);
    return true;
  };
  const placeholder = useMemo(() => ['What’s happening in Peckwell?', 'Moan about the weather…', 'Rate today’s sausage roll…', 'Tell the 436 how you feel…'][Math.floor(Math.random() * 4)], []);
  return (
    <div className="natter" onClick={() => menu && setMenu(null)}>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (send(text)) setText('');
        }}
      >
        <Face a={social.me} size={36} />
        <div className="composer-main">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_POST))} placeholder={placeholder} rows={2} maxLength={MAX_POST} aria-label="New post" enterKeyHint="send" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send(text) && setText(''))} />
          <div className="composer-foot">
            <span className={'muted small' + (text.length > MAX_POST - 15 ? ' warn' : '')}>{MAX_POST - text.length}</span>
            <button className="btn btn-primary btn-small" disabled={!text.trim()}>
              Post
            </button>
          </div>
        </div>
      </form>
      <ul className="feed">
        {tops.slice(0, limit).map((p) => {
          const a = social.authors[p.authorId] ?? engine.social.author(p.authorId);
          const rs = replies.get(p.id) ?? [];
          return (
            <li key={p.id} className={'post' + (a.kind === 'me' ? ' mine' : '')}>
              <PostBody p={p} a={a} engine={engine} menuOpen={menu === p.id} setMenu={setMenu} openDM={openDM} toast={toast} onReply={() => setReplyTo(replyTo === p.id ? null : p.id)} replies={rs.length} />
              {rs.length ? (
                <ul className="replies">
                  {rs.slice(-4).map((r) => {
                    const ra = social.authors[r.authorId] ?? engine.social.author(r.authorId);
                    return (
                      <li key={r.id} className="post reply">
                        <PostBody p={r} a={ra} engine={engine} menuOpen={menu === r.id} setMenu={setMenu} openDM={openDM} toast={toast} small />
                      </li>
                    );
                  })}
                  {rs.length > 4 ? <li className="muted small more-replies">+{rs.length - 4} earlier replies</li> : null}
                </ul>
              ) : null}
              {replyTo === p.id ? <ReplyBox to={a.name} onSend={(t) => send(t, p.id) && (setReplyTo(null), true)} /> : null}
            </li>
          );
        })}
      </ul>
      {tops.length > limit ? (
        <button className="btn btn-ghost load-more" onClick={() => setLimit((l) => l + 25)}>
          Show older posts
        </button>
      ) : (
        <p className="muted small feed-end">That’s everything. Go outside. (It’s raining.)</p>
      )}
    </div>
  );
}

function PostBody({ p, a, engine, menuOpen, setMenu, openDM, toast, onReply, replies = 0, small }: { p: Post; a: Author; engine: Engine; menuOpen: boolean; setMenu: (id: string | null) => void; openDM: (id: string) => void; toast: (t: string, tone?: 'good' | 'bad' | 'info') => void; onReply?: () => void; replies?: number; small?: boolean }) {
  const canDM = a.kind === 'npc' || a.kind === 'player';
  return (
    <div className="post-body">
      <button className="face-btn" onClick={() => canDM && openDM(a.id)} aria-label={canDM ? `Message ${a.name}` : a.name} disabled={!canDM}>
        <Face a={a} size={small ? 28 : 38} />
      </button>
      <div className="post-main">
        <div className="post-head">
          <b>{a.name}</b>
          {a.kind === 'player' ? <span className="tag-real">REAL</span> : null}
          <span className="muted">
            {a.handle} · {ago(p.ts)}
          </span>
          {a.kind !== 'me' ? (
            <button
              className="post-more"
              aria-label="More"
              onClick={(e) => {
                e.stopPropagation();
                setMenu(menuOpen ? null : p.id);
              }}
            >
              ⋯
            </button>
          ) : null}
          {menuOpen ? (
            <div className="post-menu" onClick={(e) => e.stopPropagation()}>
              {canDM ? <button onClick={() => (setMenu(null), openDM(a.id))}>✉️ Message {a.name.split(' ')[0]}</button> : null}
              <button
                onClick={() => {
                  setMenu(null);
                  engine.social.mute(a.id);
                  toast(`Muted ${a.name}. Peace at last. (Unmute in Settings.)`, 'info');
                }}
              >
                🔇 Mute {a.name.split(' ')[0]}
              </button>
              <button
                onClick={() => {
                  setMenu(null);
                  engine.social.report('post', p.id);
                  toast('Reported and hidden. Thanks for keeping Peckwell nice.', 'info');
                }}
              >
                🚩 Report post
              </button>
            </div>
          ) : null}
        </div>
        <div className="post-text">{p.text}</div>
        <div className="post-actions">
          <button className={'like' + (p.liked ? ' on' : '')} onClick={() => engine.social.like(p.id)} aria-pressed={p.liked} aria-label="Like">
            {p.liked ? '♥' : '♡'} {p.likes || ''}
          </button>
          {onReply ? (
            <button onClick={onReply} aria-label="Reply">
              💬 {replies || ''}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReplyBox({ to, onSend }: { to: string; onSend: (t: string) => boolean | void }) {
  const [t, setT] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      className="reply-box"
      onSubmit={(e) => {
        e.preventDefault();
        if (onSend(t)) setT('');
      }}
    >
      <input ref={ref} value={t} onChange={(e) => setT(e.target.value.slice(0, MAX_POST))} placeholder={`Reply to ${to}…`} maxLength={MAX_POST} enterKeyHint="send" />
      <button className="btn btn-primary btn-small" disabled={!t.trim()}>
        Reply
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ Messages
function Threads({ social, setApp }: { social: SocialSnapshot; setApp: (a: PhoneApp) => void }) {
  return (
    <div className="threads">
      <button className="btn btn-primary new-msg" onClick={() => setApp('new')}>
        ✏️ New message
      </button>
      {social.threads.length === 0 ? <p className="muted center">No messages. Nobody texts any more. They just send voice notes.</p> : null}
      <ul className="thread-list">
        {social.threads.map((th) => {
          const a = social.authors[th.peerId] ?? { id: th.peerId, name: 'Someone', handle: '', kind: 'player' as const };
          const last = th.msgs.at(-1);
          const typing = (th.typing ?? 0) > Date.now();
          return (
            <li key={th.peerId}>
              <button className={'thread-row' + (th.unread ? ' unread' : '')} onClick={() => setApp(`thread:${th.peerId}`)}>
                <Face a={a} size={42} />
                <span className="thread-main">
                  <span className="thread-top">
                    <b>{a.name}</b>
                    {a.kind === 'player' ? <span className="tag-real">REAL</span> : null}
                    <span className="muted small">{last ? ago(last.ts) : ''}</span>
                  </span>
                  <span className="thread-last">{typing ? <i>typing…</i> : last ? (last.from === social.me.id ? 'You: ' : '') + last.text : 'Say hello'}</span>
                </span>
                {th.unread ? <span className="badge static">{th.unread}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function NewMessage({ engine, setApp }: { engine: Engine; setApp: (a: PhoneApp) => void }) {
  const online = engine.onlinePlayers();
  const people: Author[] = [
    ...online.map((p) => ({ id: p.pid, name: p.name, handle: '@' + p.name, kind: 'player' as const, avatar: p.avatar })),
    contactAuthor('mum'),
    contactAuthor('dave'),
    ...PERSONAS.map((p) => engine.brain.author(p)),
  ];
  const go = (a: Author) => {
    engine.social.openThread(a);
    setApp(`thread:${a.id}`);
  };
  return (
    <div className="threads">
      <div className="section-label">{online.length ? 'In Peckwell right now' : 'No other players around. Open a second tab to test, or chat to the locals.'}</div>
      <ul className="thread-list">
        {people.map((a, i) => (
          <li key={a.id}>
            {i === online.length && online.length ? <div className="section-label">Locals</div> : null}
            <button className="thread-row" onClick={() => go(a)}>
              <Face a={a} size={40} />
              <span className="thread-main">
                <span className="thread-top">
                  <b>{a.name}</b>
                  {a.kind === 'player' ? <span className="tag-real">REAL</span> : null}
                </span>
                <span className="thread-last">{bioOf(a)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThreadHead({ peer, engine, toast, onGone }: { peer: Author; engine: Engine; toast: (t: string, tone?: 'good' | 'bad' | 'info') => void; onGone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="thread-head">
      <Face a={peer} size={30} />
      <div className="thread-head-name">
        <b>{peer.name}</b>
        <span className="muted small">{peer.kind === 'player' ? 'Real player' : peer.kind === 'npc' ? 'Local' : bioOf(peer).split('.')[0]}</span>
      </div>
      {peer.kind !== 'system' || REPLYABLE_SYS.has(peer.id) ? (
        <div className="thread-menu-wrap">
          <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Options">
            ⋯
          </button>
          {open ? (
            <div className="post-menu right">
              <button
                onClick={() => {
                  engine.social.mute(peer.id);
                  toast(`Muted ${peer.name}. (Unmute in Settings.)`, 'info');
                  onGone();
                }}
              >
                🔇 Mute
              </button>
              <button
                onClick={() => {
                  engine.social.report('person', peer.id);
                  engine.social.mute(peer.id);
                  toast(`Reported and muted ${peer.name}. Thanks.`, 'info');
                  onGone();
                }}
              >
                🚩 Report
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Thread({ engine, social, peer, onEvents, toast }: { engine: Engine; social: SocialSnapshot; peer: Author; onEvents: (ev: GameEvent[]) => void; toast: (t: string, tone?: 'good' | 'bad' | 'info') => void }) {
  const th = social.threads.find((x) => x.peerId === peer.id);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const typing = (th?.typing ?? 0) > Date.now();
  useEffect(() => {
    engine.social.markThreadRead(peer.id);
  }, [engine, peer.id, th?.msgs.length]);
  useLayoutEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [th?.msgs.length, typing]);
  const send = () => {
    const err = engine.social.dm(peer.id, text);
    if (err) return toast(err, 'bad');
    setText('');
    const out: GameEvent[] = [];
    completeGoal(engine.save, 'dm', out);
    onEvents(out);
  };
  const ro = readOnly(peer);
  return (
    <div className="thread">
      <div className="msgs">
        {peer.kind === 'player' ? <div className="sys-note">Messages to real players go via the game’s relay and aren’t end-to-end encrypted. Be nice. Mute or report from ⋯.</div> : null}
        {!th || th.msgs.length === 0 ? <div className="sys-note">This is the start of your chat with {peer.name}. {peer.kind === 'npc' ? 'Locals reply when they feel like it.' : ''}</div> : null}
        {th?.msgs.map((m) => (
          <div key={m.id} className={'msg ' + (m.from === social.me.id ? 'out' : 'in') + (m.tone ? ' ' + m.tone : '')}>
            <div className="msg-text">{m.text}</div>
            {m.lines ? (
              <div className="bill">
                {m.lines.map((l) => (
                  <div key={l.label} className="bill-row">
                    <span>{l.label}</span>
                    <b>{l.amount < 0 ? '+' : '-'}{money(Math.abs(l.amount))}</b>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="msg-time">{ago(m.ts)}</div>
          </div>
        ))}
        {typing ? (
          <div className="msg in typing" aria-label={`${peer.name} is typing`}>
            <i />
            <i />
            <i />
          </div>
        ) : null}
        <div ref={end} />
      </div>
      {ro ? (
        <div className="sys-note">This is an automated sender. Replies go nowhere (much like your deposit).</div>
      ) : !social.allowDMs && peer.kind === 'player' ? (
        <div className="sys-note">You’ve turned off messages from players in Settings.</div>
      ) : (
        <form
          className="msg-compose"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_DM))} placeholder={`Message ${peer.name}`} maxLength={MAX_DM} enterKeyHint="send" aria-label="Message" />
          <button className="btn btn-primary" disabled={!text.trim()} aria-label="Send">
            ➤
          </button>
        </form>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Work, Bank, Goals, Me, Settings
function UcCard({ save }: { save: SaveState }) {
  if (!save.uc.claiming) return null;
  const a = ucAward(save);
  return (
    <div className="stats uc-card">
      <div className="uc-head">📄 Universal Credit-ish journal</div>
      <Row k="This week (est.)" v={`${money(a.total)} on Monday`} />
      <Row k="Breakdown" v={`£${a.base} standard${a.housing ? ` + ${money(a.housing)} housing` : ''}${a.taper ? ` − ${money(a.taper)} taper` : ''}${a.sanction ? ` − ${money(a.sanction)} sanction` : ''}`} />
      <Row k="Earned this week" v={`${money(save.uc.weekEarned)} (first ${money(UC_WORK_ALLOWANCE)} is yours, then 55p in £1 comes off)`} />
      <Row k="Job searches" v={`${save.uc.searches}/${UC_SEARCHES}${save.uc.searches >= UC_SEARCHES ? ' ✓' : ' · library Wi-Fi or the job board'}`} />
      <Row k="Work coach" v={save.uc.appt ? `Sandra, ${save.uc.appt === london().dateKey ? 'TODAY' : save.uc.appt}` : '-'} />
    </div>
  );
}

function Work({ save }: { save: SaveState }) {
  const avail = shiftAvailability(save);
  if (!save.job)
    return (
      <div className="app-pad">
        <div className="big-card">
          <div className="big-emoji">🪑</div>
          <b>Between opportunities</b>
          <p className="muted">Pop into Jobcentre Minus on the high street to sign up for a job, or start a Universal Credit-ish claim. Odd jobs (glass collecting, the 8am rush, busking) pay cash in hand meanwhile.</p>
        </div>
        <UcCard save={save} />
      </div>
    );
  const j = JOBS[save.job];
  const next = nextLevelXp(save);
  const prev = [0, 20, 50, 95, 155][save.jobLevel - 1] ?? 0;
  const pct = next ? ((save.jobXp - prev) / (next - prev)) * 100 : 100;
  return (
    <div className="app-pad">
      <div className="big-card">
        <div className="muted small">{j.employer}</div>
        <b className="big-title">{jobTitle(save)}</b>
        <div className="muted small">
          Level {save.jobLevel}/5 · pay ×{levelPay(save).toFixed(2)}
        </div>
        <div className="xp-track">
          <div className="xp-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="muted small">{next ? `${Math.max(0, Math.round(next - save.jobXp))} XP to a performance review` : 'Top of the ladder. You now say “circle back” unironically.'}</div>
      </div>
      <div className="stats">
        <Row k="Shift" v={`${j.hours}h at ${j.employer}`} />
        <Row k="Base pay" v={j.id === 'rider' ? 'per drop + tips' : `${money(j.pay)} × ${levelPay(save).toFixed(2)}`} />
        <Row k="Next shift" v={avail.ok ? 'Ready now' : avail.reason ?? ''} />
        <Row k="Shifts worked" v={String(save.shifts)} />
        <Row k="Career ladder" v={j.titles.join(' → ')} />
        <Row k="Pay ranks" v={LEVEL_PAY.map((p) => `×${p}`).join(' ')} />
      </div>
      <p className="muted small">Good mood = better tips: pay ×{moodPayMult(save.mood).toFixed(2)} right now. Every shift earns XP; fill the bar and you’ll get called in for a review.</p>
      <UcCard save={save} />
    </div>
  );
}

function Bank({ save, snap }: { save: SaveState; snap: Snapshot }) {
  const home = HOMES[save.home];
  const weekly = save.home === 'sofa' ? 0 : save.rent + (save.flags.ctDiscount ? home.councilTax * 0.75 : home.councilTax);
  const toRent = msUntilRent(snap.now);
  return (
    <div className="app-pad">
      <div className="bank-card">
        <div className="muted small">Current account · Bank of Peckwell</div>
        <div className="bank-balance">{money(save.money)}</div>
        <div className="bank-row">
          <span>
            <span className="oyster-mini" /> Oyster {money(save.oyster)}
          </span>
          <span className={save.meter <= 0 && save.home !== 'sofa' ? 'warn-text' : undefined}>⚡ Meter {save.home === 'sofa' ? 'Dave’s' : save.meter <= 0 ? `emergency (${money(save.meter + EMERGENCY_CREDIT)} left)` : money(save.meter)}</span>
        </div>
      </div>
      <div className="stats">
        <Row k="Rent day" v={`Monday ${String(RENT_HOUR).padStart(2, '0')}:00 (real time) · in ${fmtDuration(toRent)}`} />
        <Row k="Weekly bills" v={save.home === 'sofa' ? '£0 (thanks Dave)' : `${money(save.rent)} rent + ${money(save.flags.ctDiscount ? home.councilTax * 0.75 : home.councilTax)} council tax`} />
        {save.home !== 'sofa' ? <Row k="Electric" v={`Prepayment key, about ${money(meterDaily(london(snap.now)))}/day. Top up at Kwik Mart.`} /> : null}
        {save.home !== 'sofa' ? <Row k="Damp" v={`${Math.round(save.damp)}% ${save.damp >= 60 ? '(Kevin the mould is thriving)' : save.damp >= 30 ? '(a bit musty)' : '(fine, for now)'}`} /> : null}
        {weekly ? <Row k="After bills" v={money(save.money - weekly)} /> : null}
        {save.arrears ? <Row k="⚠️ Arrears" v="One missed rent. Another and you’re out." /> : null}
        <Row k="Earned (lifetime)" v={money(save.stats.earned)} />
        <Row k="Rent paid (lifetime)" v={money(save.stats.rentPaid)} />
      </div>
      <p className="muted small">Statements from your bank and landlord land in Messages.</p>
    </div>
  );
}

function Goals({ snap }: { snap: Snapshot }) {
  const done = GOALS.filter((g) => snap.goals[g.id]).length;
  return (
    <div className="app-pad">
      <div className="muted small">
        {done}/{GOALS.length} done
      </div>
      <ul className="goals">
        {GOALS.map((g) => (
          <li key={g.id} className={snap.goals[g.id] ? 'done' : ''}>
            <span className="tick">{snap.goals[g.id] ? '✓' : ''}</span>
            {g.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Me({ save, snap }: { save: SaveState; snap: Snapshot }) {
  const val: Record<string, number> = { energy: snap.energy, hunger: snap.hunger, social: snap.social, hygiene: snap.hygiene, warmth: snap.warmth };
  return (
    <div className="app-pad">
      <div className="me-needs">
        {NEEDS.map((n) => (
          <div key={n.id} className="me-need">
            <span>
              {n.icon} {n.label}
            </span>
            <b>{Math.round(val[n.id])}</b>
          </div>
        ))}
        <div className="me-need">
          <span>🙂 Mood</span>
          <b>{Math.round(snap.mood)}</b>
        </div>
      </div>
      <div className="section-label">How you’re feeling</div>
      <ul className="moodlet-list">
        {snap.moodlets.length === 0 ? <li className="muted small">Nothing in particular. Very British.</li> : null}
        {snap.moodlets.map((m) => (
          <li key={m.id} className={m.mood >= 0 ? 'good' : 'bad'}>
            <span className="moodlet-emoji">{m.emoji}</span>
            <div>
              <b>{m.name}</b> <span className="muted small">{m.mood > 0 ? '+' : ''}{m.mood} mood{m.dynamic ? '' : ` · ${fmtDuration(m.left * 60000)} (life time)`}</span>
              <div className="muted small">{m.desc}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="section-label">Skills</div>
      <div className="stats">
        <Row k="💪 Fitness" v={`${save.skills.fitness.toFixed(1)} (slower energy drain)`} />
        <Row k="😏 Charm" v={`${save.skills.charm.toFixed(1)} (busking, quiz banter)`} />
        <Row k="🧠 Brains" v={`${save.skills.brains.toFixed(1)} (quiz nights, office)`} />
        <Row k="🛠️ Graft" v={`${save.skills.graft.toFixed(1)} (cash-in-hand pay)`} />
      </div>
      <div className="section-label">Life so far</div>
      <div className="stats">
        <Row k="Daily streak" v={`${save.streak.count} day${save.streak.count === 1 ? '' : 's'} (best ${save.streak.best})`} />
        <Row k="Sausage rolls" v={String(save.stats.sausageRolls)} />
        <Row k="Pints" v={String(save.stats.pints)} />
        <Row k="Ducks fed" v={String(save.stats.ducksFed)} />
        <Row k="Quiz wins" v={String(save.stats.quizWins)} />
        <Row k="Things done" v={String(save.stats.actions)} />
        <Row k="Natter posts" v={String(save.stats.posts)} />
      </div>
    </div>
  );
}

function Settings({ engine, social, onQuit, onReset }: { engine: Engine; social: SocialSnapshot; onQuit: () => void; onReset: () => void }) {
  return (
    <div className="app-pad">
      <label className="toggle-row">
        <span>
          <b>Messages from players</b>
          <span className="muted small">Let real players DM you. Locals can always text.</span>
        </span>
        <input type="checkbox" checked={social.allowDMs} onChange={(e) => engine.social.setAllowDMs(e.target.checked)} />
      </label>
      <div className="section-label">Muted ({social.muted.length})</div>
      {social.muted.length === 0 ? <p className="muted small">Nobody. You’re very tolerant.</p> : null}
      <ul className="thread-list">
        {social.muted.map((id) => {
          const a = social.authors[id] ?? engine.social.author(id);
          return (
            <li key={id} className="muted-row">
              <Face a={a} size={28} />
              <span>{a.name}</span>
              <button className="btn btn-ghost btn-small" onClick={() => engine.social.unmute(id)}>
                Unmute
              </button>
            </li>
          );
        })}
      </ul>
      <div className="section-label">How to play</div>
      <div className="help">
        <p>
          <b>Move:</b> tap where you want to go, or WASD / arrows. <b>Go in:</b> tap a building or a floating 🦆 marker, or press <kbd>E</kbd>.
        </p>
        <p>
          <b>Time is real:</b> Peckwell runs on UK time. Rent leaves your account on the real Monday at 09:00. Your needs tick faster while you’re out and about, and things you do take a few seconds but use up “life minutes”.
        </p>
        <p>
          <b>Needs:</b> ⚡ energy, 🍔 fullness, 💬 social, 🫧 hygiene, 🧣 warmth. Keep them up and your 🙂 mood (and your pay) follows. Moodlets like “Had a Crumbs” or “Soaked” nudge your mood for a while.
        </p>
        <p>
          <b>Phone:</b> Natter is the local feed: post, like and reply. Messages are one-to-one with locals and other players. <kbd>T</kbd> opens Natter.
        </p>
      </div>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onQuit}>
          Title screen
        </button>
        <button
          className="btn btn-danger"
          onClick={() => {
            if (confirm('Start again from scratch? Your save will be deleted.')) onReset();
          }}
        >
          Reset save
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Phase 3: shopping + owning
function Shop({ engine, onEvents, toast }: { engine: Engine; onEvents: (ev: GameEvent[]) => void; toast: (t: string, tone?: 'good' | 'bad' | 'info') => void }) {
  const save = engine.save;
  const [, force] = useState(0);
  return (
    <div className="app-pad">
      <p className="muted small">Next-day delivery*. Free returns**. <i>*Some day. **Not free.</i> Balance: <b>{money(save.money)}</b></p>
      <ul className="item-list shop-list">
        {STATUS_ITEMS.map((it) => {
          const got = save.owned.items.includes(it.id);
          return (
            <li key={it.id} className="item">
              <div className="shop-emoji">{it.emoji}</div>
              <div className="item-main">
                <div className="item-name">{it.name}</div>
                <div className="item-note">{it.blurb}</div>
              </div>
              <button
                className={'btn ' + (got ? 'btn-ghost' : 'btn-primary')}
                disabled={got || save.money < it.price}
                onClick={() => {
                  const out: GameEvent[] = [];
                  const why = buyStatus(save, it.id, out);
                  if (why) return toast(why, 'bad');
                  onEvents(out);
                  force((n) => n + 1);
                }}
              >
                {got ? 'Owned' : money(it.price)}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Pretend money only. Nothing here costs real money, ever.</p>
    </div>
  );
}

function Stuff({ save }: { save: SaveState }) {
  const a = save.owned.allotment;
  const h = save.owned.hustle;
  const left = cropLeft(save);
  const items = STATUS_ITEMS.filter((i) => save.owned.items.includes(i.id));
  return (
    <div className="app-pad">
      <div className="stats">
        <div className="uc-head">🌱 Allotment</div>
        {a ? (
          <>
            <Row k="Plot" v={`Maureen’s old plot · £${PLOT_RENT}/wk`} />
            <Row k="Growing" v={a.crop ? `${CROP_BY_ID[a.crop].emoji} ${CROP_BY_ID[a.crop].name} · ${left ? `ready in ${fmtDuration(left)}` : 'READY to harvest'}` : 'Nothing. Kenneth the gnome is lonely.'} />
          </>
        ) : (
          <Row k="Plot" v="None yet. Help Nan at the allotments: she knows people." />
        )}
        <Row k="Veg in the cupboard" v={String(save.inv.veg)} />
      </div>
      <div className="stats">
        <div className="uc-head">📸 Flogit</div>
        <Row k="Stock in the hallway" v={h?.stock.length ? `${h.stock.length} (list it at home)` : 'None. Rummage at Second Chances.'} />
        {h?.listings.map((l, i) => <Row key={i} k={money(l.price)} v={l.item} />)}
        <Row k="Sold" v={String(save.flags.flips ?? 0)} />
      </div>
      <div className="stats">
        <div className="uc-head">🏘️ Property</div>
        <Row k="Buy-to-let flats" v={save.owned.btl ? `${save.owned.btl} · about ${money(BTL_RENT * save.owned.btl)}/wk in, before everything breaks` : `None. ${money(BTL_DEPOSIT)} deposit at Fleecems Lettings.`} />
      </div>
      <div className="stats">
        <div className="uc-head">✨ Nice things</div>
        {items.length ? items.map((i) => <Row key={i.id} k={i.emoji} v={i.name} />) : <Row k="—" v="Nothing yet. The Amazin’ app is right there." />}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat-row">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
