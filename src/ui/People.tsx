import { useEffect, useRef, useState } from 'react';
import type { Engine, Snapshot } from '../game/engine';
import { money, type GameEvent } from '../game/economy';
import {
  ACTS,
  COMPLIMENTS,
  INVITE_PLACES,
  LEVELS,
  TOPICS,
  actBlocked,
  authorOf,
  bioOf,
  doAct,
  drinkHere,
  favourFor,
  levelOf,
  levelUpPost,
  moodWord,
  npcMood,
  peekRel,
  pronounLabel,
  shortName,
  talkOpener,
  talkReply,
  touchRel,
  type ActKind,
  type PersonRef,
  type Topic,
} from '../game/people';
import { london } from '../game/time';
import { buildingById } from '../game/world';
import { placeOpen } from '../game/actions';
import { sfx } from '../game/audio';
import { AvatarCanvas } from './AvatarCanvas';
import { Modal } from './Dialogs';

const placeName = (id: string | null | undefined) => (id ? buildingById(id)?.name.split(' · ')[0] ?? id : null);
const kindTag = (p: PersonRef) => (p.kind === 'player' ? 'Real player' : p.kind === 'staff' ? p.role ?? 'Staff' : 'Local');

/** Top-of-screen strip while you're inside: where you are, who's here, chat & leave. */
export function RoomBar({ engine, snap, onOpen, onPerson }: { engine: Engine; snap: Snapshot; onOpen: () => void; onPerson: (p: PersonRef) => void }) {
  const here = engine.hereNow();
  const last = engine.roomLog.at(-1);
  const fresh = last && Date.now() - last.ts < 9000;
  return (
    <div className="roombar panel" data-testid="roombar">
      <div className="roombar-row">
        <button className="roombar-title" onClick={onOpen} aria-label="Who's here">
          <b>{snap.scene?.title}</b>
          <span className="here-count" data-testid="here-count">
            👥 {here.length} here
          </span>
        </button>
        <div className="here-faces">
          {here.slice(0, 5).map((p) => (
            <button key={p.key} className={'here-face ' + p.kind} onClick={() => onPerson(p)} aria-label={p.name} title={p.name}>
              <AvatarCanvas avatar={p.avatar} size={30} head />
            </button>
          ))}
          {here.length > 5 ? <span className="here-more">+{here.length - 5}</span> : null}
        </div>
        <button className="btn btn-ghost btn-small" onClick={onOpen} data-testid="open-here">
          💬
        </button>
        <button className="btn btn-ghost btn-small" onClick={() => engine.leaveBuilding()} aria-label="Leave" title="Leave">
          🚪
        </button>
      </div>
      {fresh ? (
        <div className="roombar-chat" key={last.id}>
          <b>{last.name}:</b> {last.text}
        </div>
      ) : null}
    </div>
  );
}

/** The "Here now" sheet: everyone in the room, plus the room's chat spot. */
export function HereSheet({ engine, snap, onClose, onPerson, onMenu, toast }: { engine: Engine; snap: Snapshot; onClose: () => void; onPerson: (p: PersonRef) => void; onMenu: () => void; toast: (t: string, tone?: 'good' | 'bad' | 'info') => void }) {
  const here = engine.hereNow();
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: 99999 });
  }, [snap.chatN]);
  const s = engine.save;
  const send = () => {
    const err = engine.sayInRoom(text);
    if (err) toast(err, 'bad');
    else setText('');
  };
  return (
    <Modal title={<>📍 {snap.scene?.title}</>} sub="Here now. Tap anyone to say hello." onClose={onClose} className="here-modal">
      <ul className="here-list" data-testid="here-list">
        {here.map((p) => {
          const r = peekRel(s, p.key);
          const lv = levelOf(r?.pts ?? 0);
          return (
            <li key={p.key}>
              <button className="here-row" onClick={() => onPerson(p)}>
                <AvatarCanvas avatar={p.avatar} size={40} head />
                <span className="here-main">
                  <b>{p.name}</b>
                  <span className="muted small">
                    {kindTag(p)} · {pronounLabel(p.avatar)}
                    {r ? ` · ${lv.emoji} ${lv.name}` : ''}
                  </span>
                </span>
                {p.kind === 'player' ? <span className="pill pill-on">live</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="section-label">💬 Chat spot · everyone in here can see it</div>
      <div className="room-log" ref={logRef} data-testid="room-log">
        {engine.roomLog.length ? (
          engine.roomLog.map((l) => (
            <div key={l.id} className={'room-line ' + l.kind}>
              <b>{l.kind === 'me' ? 'You' : l.name}</b> {l.text}
            </div>
          ))
        ) : (
          <div className="muted small">Quiet in here. Say something?</div>
        )}
      </div>
      <form
        className="room-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder="Say something to the room…" aria-label="Say something to the room" />
        <button className="btn btn-primary" disabled={!text.trim()}>
          Say
        </button>
      </form>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onMenu}>
          📋 Everything to do here
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            onClose();
            engine.leaveBuilding();
          }}
        >
          🚪 Leave
        </button>
      </div>
    </Modal>
  );
}

type View = 'main' | 'talk' | 'invite' | 'compliment';

/** Tap a person: who they are, how well you know them, and things to do together. */
export function ProfileCard({
  engine,
  who: initial,
  snap,
  onClose,
  onEvents,
  openDM,
}: {
  engine: Engine;
  who: PersonRef;
  snap: Snapshot;
  onClose: () => void;
  onEvents: (ev: GameEvent[]) => void;
  openDM: (authorId: string) => void;
}) {
  const s = engine.save;
  const who = engine.personByKey(initial.key) ?? initial;
  const here = snap.scene?.id ?? null;
  const [view, setView] = useState<View>('main');
  const [said, setSaid] = useState<{ text: string; tone: string } | null>(null);
  const [talk, setTalk] = useState<{ me?: string; them: string }[]>([]);
  const [used, setUsed] = useState<Topic[]>([]);
  const [, force] = useState(0);
  useEffect(() => {
    engine.faceTowards(who);
    const i = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rel = peekRel(s, who.key);
  const lv = levelOf(rel?.pts ?? 0);
  const t = london();
  const mood = who.kind === 'player' ? (who.mood != null ? { ...moodWord(who.mood), v: who.mood } : null) : npcMood(who.name, t, snap.raining);
  const ctx = { raining: snap.raining, hh: t.hh, place: here };
  const isPlayer = who.kind === 'player';
  const gone = isPlayer && !engine.personByKey(who.key);

  const result = (text: string, tone: string, ev: GameEvent[] = []) => {
    setSaid({ text, tone });
    onEvents(ev);
    engine.touch();
  };

  /** Do it with a local / member of staff. */
  const local = (kind: ActKind, extra: { compliment?: number; place?: string } = {}) => {
    const r = doAct(s, who, kind, here, extra);
    if (r.reply) engine.emote(who, r.reply);
    if (kind === 'drink' && r.tone === 'good') sfx.till();
    else if (r.tone === 'good') sfx.pop();
    if (kind === 'invite' && r.tone === 'good' && extra.place) engine.inviteLocal(who.name, extra.place);
    if (r.levelUp && who.kind !== 'player') {
      const post = levelUpPost(r.levelUp, s);
      engine.social.later(2500 + Math.random() * 4000, () => engine.social.npcPost(authorOf(who), post, { likes: 1 + Math.floor(Math.random() * 4) }));
    }
    result(r.text, r.tone, r.events);
    return r;
  };
  /** Do it with another real player (over the network). */
  const player = (kind: ActKind, extra: { compliment?: number; place?: string } = {}) => {
    const why = actBlocked(s, who, kind, here);
    if (why) return result(why, 'bad');
    const err = engine.sendAct(who, kind === 'talk' || kind === 'favour' ? 'nod' : kind, { n: extra.compliment, place: extra.place });
    if (err) return result(err, 'bad');
    const out: GameEvent[] = [];
    const first = shortName(who.name);
    let text = '';
    if (kind === 'drink') {
      const d = drinkHere(here)!;
      s.money = Math.round((s.money - d.cost) * 100) / 100;
      sfx.till();
      text = `You get ${first} ${d.what} (${money(d.cost)}). They’ll get a ping.`;
    } else if (kind === 'follow') {
      s.follows = [...(s.follows ?? []), authorOf(who).id];
      text = `You followed ${who.name} on Natter.`;
    } else if (kind === 'invite') text = `Invite sent: ${placeName(extra.place)}. Fingers crossed.`;
    else if (kind === 'compliment') text = `You told ${first}: “${COMPLIMENTS[extra.compliment ?? 0]}”`;
    else text = `You wave at ${first}. 👋`;
    s.social = Math.min(100, s.social + ACTS[kind].social);
    engine.say(kind === 'wave' ? '👋' : kind === 'drink' ? '🍺 On me!' : kind === 'compliment' ? '💐' : kind === 'invite' ? '📍 Coming?' : '➕');
    const up = touchRel(s, who.key, ACTS[kind].pts, kind, out, who.name);
    if (up) out.push({ type: 'toast', text: `You and ${who.name} are now: ${up}`, tone: 'good' });
    sfx.pop();
    result(text, 'good', out);
  };
  const act = (kind: ActKind, extra: { compliment?: number; place?: string } = {}) => (isPlayer ? player(kind, extra) : local(kind, extra));

  const chat = () => {
    const a = authorOf(who);
    engine.social.openThread(a);
    openDM(a.id);
  };
  const startTalk = () => {
    const r = local('talk');
    if (r.tone === 'bad') return;
    const opener = talkOpener(who, s, ctx);
    engine.emote(who, opener);
    setTalk([{ them: opener }]);
    setUsed([]);
    setView('talk');
  };
  const topic = (tp: Topic) => {
    const line = talkReply(who, tp, s, ctx);
    engine.emote(who, line);
    s.social = Math.min(100, s.social + 2);
    setUsed((u) => [...u, tp]);
    setTalk((x) => [...x, { me: TOPICS.find((q) => q.id === tp)!.label, them: line }]);
    engine.touch();
  };

  const btn = (kind: ActKind, label: React.ReactNode, onClick: () => void, opts: { hide?: boolean; why?: string | null } = {}) => {
    if (opts.hide) return null;
    const why = opts.why !== undefined ? opts.why : actBlocked(s, who, kind, here);
    return (
      <button key={kind} className="act-btn" disabled={!!why || gone} onClick={onClick} data-testid={'act-' + kind}>
        <span className="act-emoji">{ACTS[kind].emoji}</span>
        <span className="act-label">{label}</span>
        {why ? <span className="act-why">{why}</span> : null}
      </button>
    );
  };
  const d = drinkHere(here);
  const fav = who.kind !== 'player' ? favourFor(who) : null;

  let body: React.ReactNode;
  if (view === 'talk')
    body = (
      <div className="talk" data-testid="small-talk">
        {talk.map((l, i) => (
          <div key={i}>
            {l.me ? <div className="talk-line me">{l.me}</div> : null}
            <div className="talk-line them">
              <b>{shortName(who.name)}</b> {l.them}
            </div>
          </div>
        ))}
        <div className="talk-topics">
          {TOPICS.filter((q) => !used.includes(q.id)).map((q) => (
            <button key={q.id} className="chip" onClick={() => topic(q.id)} data-testid={'topic-' + q.id}>
              {q.label}
            </button>
          ))}
          <button className="chip ghost" onClick={() => setView('main')}>
            {used.length ? 'Right, I’d better be off' : 'Back'}
          </button>
        </div>
      </div>
    );
  else if (view === 'invite')
    body = (
      <div className="invite-list">
        <div className="section-label">Invite {shortName(who.name)} to…</div>
        {INVITE_PLACES.map((id) => {
          const open = placeOpen(id, t);
          return (
            <button
              key={id}
              className="here-row"
              disabled={!open}
              onClick={() => {
                act('invite', { place: id });
                setView('main');
              }}
            >
              <span className="here-main">
                <b>{placeName(id)}</b>
                <span className="muted small">{open ? 'Open now' : 'Shut right now'}</span>
              </span>
            </button>
          );
        })}
        <button className="btn btn-ghost wide" onClick={() => setView('main')}>
          Back
        </button>
      </div>
    );
  else if (view === 'compliment')
    body = (
      <div className="invite-list">
        <div className="section-label">Say something nice</div>
        {COMPLIMENTS.map((c, i) => (
          <button
            key={c}
            className="here-row"
            onClick={() => {
              act('compliment', { compliment: i });
              setView('main');
            }}
          >
            “{c}”
          </button>
        ))}
        <button className="btn btn-ghost wide" onClick={() => setView('main')}>
          Back
        </button>
      </div>
    );
  else
    body = (
      <>
        {said ? (
          <p className={'act-result ' + said.tone} data-testid="act-result">
            {said.text}
          </p>
        ) : null}
        <div className="act-grid">
          <button className="act-btn primary" onClick={chat} disabled={gone} data-testid="act-chat">
            <span className="act-emoji">✉️</span>
            <span className="act-label">Chat</span>
          </button>
          {btn('wave', isPlayer ? 'Wave' : 'Wave / nod', () => act('wave'))}
          {btn('talk', 'Small talk', startTalk, { hide: isPlayer })}
          {btn('compliment', 'Compliment', () => setView('compliment'))}
          {btn('drink', d ? `Buy ${d.what} · ${money(d.cost)}` : 'Buy them a drink', () => act('drink'))}
          {btn('follow', (s.follows ?? []).includes(authorOf(who).id) ? 'Following ✓' : 'Follow on Natter', () => act('follow'))}
          {btn('invite', 'Invite to…', () => setView('invite'), { hide: who.kind === 'staff' })}
          {fav ? btn('favour', fav.label, () => act('favour')) : null}
        </div>
      </>
    );

  return (
    <Modal
      title={
        <span className="profile-title">
          {who.name}
          <span className="chip-pronoun">{pronounLabel(who.avatar)}</span>
        </span>
      }
      onClose={onClose}
      className="profile-modal"
    >
      <div className="profile-head" data-testid="profile-card">
        <div className="profile-av">
          <AvatarCanvas avatar={who.avatar} size={84} />
        </div>
        <div className="profile-info">
          <div className="profile-tags">
            <span className={'tag ' + who.kind}>{isPlayer ? '🟢 ' : ''}{kindTag(who)}</span>
            {mood ? (
              <span className="tag">
                {mood.emoji} {mood.word}
              </span>
            ) : null}
          </div>
          <div className="muted small">{gone ? 'Just left.' : who.place ? `At ${placeName(who.place)}` : 'Out and about'}</div>
          <p className="profile-bio">{bioOf(who)}</p>
          <div className="rel">
            <div className="rel-row">
              <span>
                {lv.emoji} <b>{lv.name}</b>
              </span>
              {rel && rel.streak > 1 ? <span className="streak-chip">🔥 {rel.streak} days</span> : null}
            </div>
            <div className="rel-track" aria-label="Friendship">
              <div className="rel-fill" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </div>
            <div className="muted small">{lv.next != null ? `Next: ${LEVELS[lv.i + 1].name}${lv.i + 1 === 3 && !isPlayer ? ' (unlocks a daily favour)' : ''}` : 'As good as it gets.'}</div>
          </div>
        </div>
      </div>
      {body}
    </Modal>
  );
}
