// The in-game phone's social side: the Natter feed (posts, likes, replies) and
// Messages (one-to-one DMs). Local players and NPCs share the same data model.
import type { Avatar } from './types';
import type { SocialWire } from '../net/types';
import { cleanMessage, MAX_DM, MAX_POST } from '../net/filter';

export type AuthorKind = 'me' | 'npc' | 'player' | 'system';
export interface Author {
  id: string;
  name: string;
  handle: string;
  kind: AuthorKind;
  avatar?: Avatar;
  colour?: string;
}
export interface Post {
  id: string;
  authorId: string;
  text: string;
  ts: number;
  likes: number;
  liked: boolean;
  replyTo?: string;
}
export interface DM {
  id: string;
  from: string; // author id
  text: string;
  ts: number;
  tone?: 'good' | 'bad' | 'info';
  lines?: { label: string; amount: number }[];
}
export interface Thread {
  peerId: string;
  msgs: DM[];
  unread: number;
  typing?: number; // ms until which the peer is "typing…"
}
export interface SocialSnapshot {
  me: Author;
  authors: Record<string, Author>;
  posts: Post[]; // newest first, top-level and replies mixed (UI groups them)
  threads: Thread[]; // most recent first
  feedUnread: number;
  dmUnread: number;
  muted: string[];
  reported: string[];
  allowDMs: boolean;
}

const MAX_POSTS = 160;
const MAX_MSGS = 80;
const POST_GAP_MS = 8000;
const DM_GAP_MS = 1500;
export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
export const handleOf = (name: string) => '@' + name.replace(/[^\w]/g, '').slice(0, 14) || '@anon';

interface Persisted {
  posts: Post[];
  threads: Thread[];
  authors: Record<string, Author>;
  muted: string[];
  reported: string[];
  allowDMs: boolean;
  feedSeenAt: number;
}

export class SocialStore {
  private posts: Post[] = [];
  private threads = new Map<string, Thread>();
  private authors: Record<string, Author> = {};
  private muted = new Set<string>();
  private reported = new Set<string>();
  private allowDMs = true;
  private feedSeenAt = 0;
  private listeners = new Set<() => void>();
  private snap!: SocialSnapshot;
  private saveTimer = 0;
  private lastPostAt = 0;
  private lastDmAt = 0;
  private recvLog: number[] = [];
  private jobs: { at: number; fn: () => void }[] = [];
  /** set by the engine: sends to other players */
  sender: ((m: SocialWire) => void) | null = null;
  /** set by the engine/NPC brain: things to react to */
  onMyPost: ((p: Post) => void) | null = null;
  onMyDM: ((peerId: string, text: string) => void) | null = null;
  onIncoming: ((kind: 'dm' | 'post', author: Author, text: string) => void) | null = null;
  me: Author;

  constructor(private storageKey: string, me: { id: string; name: string; avatar: Avatar }) {
    this.me = { id: me.id, name: me.name, handle: handleOf(me.name), kind: 'me', avatar: me.avatar };
    this.load();
    this.authors[this.me.id] = this.me;
    this.rebuild();
  }

  // ---------------------------------------------------------------- store plumbing
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  private changed() {
    this.rebuild();
    this.listeners.forEach((l) => l());
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 800) as unknown as number;
  }
  private rebuild() {
    const muted = this.muted;
    const threads = [...this.threads.values()].filter((t) => !muted.has(t.peerId)).sort((a, b) => (b.msgs.at(-1)?.ts ?? 0) - (a.msgs.at(-1)?.ts ?? 0));
    const posts = this.posts.filter((p) => !muted.has(p.authorId) && !this.reported.has(p.id));
    this.snap = {
      me: this.me,
      authors: { ...this.authors },
      posts,
      threads: threads.map((t) => ({ ...t, msgs: [...t.msgs] })),
      feedUnread: posts.filter((p) => !p.replyTo && p.ts > this.feedSeenAt && p.authorId !== this.me.id).length,
      dmUnread: threads.reduce((a, t) => a + t.unread, 0),
      muted: [...muted],
      reported: [...this.reported],
      allowDMs: this.allowDMs,
    };
  }
  private load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<Persisted>;
      this.posts = Array.isArray(d.posts) ? d.posts.slice(0, MAX_POSTS) : [];
      for (const t of Array.isArray(d.threads) ? d.threads : []) if (t && t.peerId) this.threads.set(t.peerId, { ...t, typing: 0, msgs: (t.msgs ?? []).slice(-MAX_MSGS) });
      this.authors = d.authors && typeof d.authors === 'object' ? d.authors : {};
      this.muted = new Set(d.muted ?? []);
      this.reported = new Set(d.reported ?? []);
      this.allowDMs = d.allowDMs ?? true;
      this.feedSeenAt = d.feedSeenAt ?? 0;
    } catch {
      /* corrupt: start fresh */
    }
  }
  persist() {
    try {
      const d: Persisted = { posts: this.posts.slice(0, MAX_POSTS), threads: [...this.threads.values()], authors: this.authors, muted: [...this.muted], reported: [...this.reported], allowDMs: this.allowDMs, feedSeenAt: this.feedSeenAt };
      localStorage.setItem(this.storageKey, JSON.stringify(d));
    } catch {
      /* quota: fine */
    }
  }

  /** Run delayed reactions (NPC replies etc). Call every tick. */
  pump(t = Date.now()) {
    if (!this.jobs.length) return;
    const due = this.jobs.filter((j) => j.at <= t);
    if (!due.length) return;
    this.jobs = this.jobs.filter((j) => j.at > t);
    due.forEach((j) => j.fn());
  }
  later(ms: number, fn: () => void) {
    this.jobs.push({ at: Date.now() + ms, fn });
  }

  // ---------------------------------------------------------------- people
  upsertAuthor(a: Author) {
    const cur = this.authors[a.id];
    if (cur && cur.name === a.name && cur.kind === a.kind && (cur.avatar === a.avatar || !a.avatar)) return;
    this.authors[a.id] = { ...cur, ...a };
  }
  author(id: string): Author {
    return this.authors[id] ?? { id, name: 'Someone', handle: '@someone', kind: 'player' };
  }
  setMe(name: string, avatar: Avatar) {
    this.me = { ...this.me, name, handle: handleOf(name), avatar };
    this.authors[this.me.id] = this.me;
  }

  // ---------------------------------------------------------------- feed
  private addPost(p: Post) {
    if (this.posts.some((x) => x.id === p.id)) return;
    this.posts.unshift(p);
    if (this.posts.length > MAX_POSTS) this.posts.length = MAX_POSTS;
  }
  /** Returns an error message, or null when posted. */
  post(raw: string, replyTo?: string): string | null {
    const t = Date.now();
    const gap = replyTo ? 3000 : POST_GAP_MS;
    if (t - this.lastPostAt < gap) return replyTo ? 'Easy, tiger. One reply every few seconds.' : 'Easy, tiger. One post every 8 seconds.';
    const text = cleanMessage(raw, MAX_POST);
    if (!text) return 'Say something first.';
    this.lastPostAt = t;
    const p: Post = { id: newId(), authorId: this.me.id, text, ts: t, likes: 0, liked: false, replyTo };
    this.addPost(p);
    this.sender?.({ t: 'post', id: p.id, from: this.me.id, name: this.me.name, text, ts: t, replyTo, avatar: this.me.avatar });
    this.changed();
    this.onMyPost?.(p);
    return null;
  }
  npcPost(author: Author, text: string, opts: { replyTo?: string; likes?: number; ts?: number } = {}): Post {
    this.upsertAuthor(author);
    const p: Post = { id: newId(), authorId: author.id, text, ts: opts.ts ?? Date.now(), likes: opts.likes ?? 0, liked: false, replyTo: opts.replyTo };
    if (opts.ts) {
      this.posts.push(p);
      this.posts.sort((a, b) => b.ts - a.ts);
    } else this.addPost(p);
    this.changed();
    return p;
  }
  like(postId: string) {
    const p = this.posts.find((x) => x.id === postId);
    if (!p) return;
    p.liked = !p.liked;
    p.likes = Math.max(0, p.likes + (p.liked ? 1 : -1));
    if (p.liked && p.authorId !== this.me.id) this.sender?.({ t: 'like', id: newId(), from: this.me.id, post: postId });
    this.changed();
  }
  bumpLikes(postId: string, n = 1) {
    const p = this.posts.find((x) => x.id === postId);
    if (!p) return;
    p.likes += n;
    this.changed();
  }
  markFeedSeen() {
    const had = this.snap.feedUnread > 0;
    this.feedSeenAt = Date.now();
    if (had) this.changed();
  }
  postById(id: string) {
    return this.posts.find((p) => p.id === id);
  }
  myLatestPost() {
    return this.posts.find((p) => p.authorId === this.me.id && !p.replyTo);
  }

  // ---------------------------------------------------------------- DMs
  private thread(peerId: string) {
    let t = this.threads.get(peerId);
    if (!t) {
      t = { peerId, msgs: [], unread: 0 };
      this.threads.set(peerId, t);
    }
    return t;
  }
  private pushMsg(peerId: string, m: DM, unread: boolean) {
    const t = this.thread(peerId);
    if (t.msgs.some((x) => x.id === m.id)) return;
    t.msgs.push(m);
    if (t.msgs.length > MAX_MSGS) t.msgs.splice(0, t.msgs.length - MAX_MSGS);
    if (unread) t.unread++;
    t.typing = 0;
  }
  dm(peerId: string, raw: string): string | null {
    const peer = this.authors[peerId];
    if (!peer) return 'They’ve gone. Like a fox into a bin.';
    if (this.muted.has(peerId)) return 'You’ve muted them. Unmute in Settings first.';
    const t = Date.now();
    if (t - this.lastDmAt < DM_GAP_MS) return 'Slow down, you’ll sprain a thumb.';
    const text = cleanMessage(raw, MAX_DM);
    if (!text) return 'Type something first.';
    this.lastDmAt = t;
    const m: DM = { id: newId(), from: this.me.id, text, ts: t };
    this.pushMsg(peerId, m, false);
    if (peer.kind === 'player') this.sender?.({ t: 'dm', id: m.id, from: this.me.id, name: this.me.name, to: peerId, text, ts: t });
    this.changed();
    this.onMyDM?.(peerId, text);
    return null;
  }
  /** A message from an NPC or a system sender (landlord, bank, Mum). */
  incoming(author: Author, text: string, extra: Partial<DM> = {}, notify = true) {
    this.upsertAuthor(author);
    if (this.muted.has(author.id)) return;
    this.pushMsg(author.id, { id: newId(), from: author.id, text, ts: Date.now(), ...extra }, true);
    this.changed();
    if (notify) this.onIncoming?.('dm', author, text);
  }
  setTyping(peerId: string, ms: number) {
    this.thread(peerId).typing = Date.now() + ms;
    this.changed();
  }
  markThreadRead(peerId: string) {
    const t = this.threads.get(peerId);
    if (t && t.unread) {
      t.unread = 0;
      this.changed();
    }
  }
  /** Make sure a thread exists (e.g. starting a new conversation). */
  openThread(peer: Author) {
    this.upsertAuthor(peer);
    this.thread(peer.id);
    this.changed();
  }

  // ---------------------------------------------------------------- network in
  receive(m: SocialWire) {
    if (m.from === this.me.id) return;
    if (this.muted.has(m.from)) return;
    // crude flood guard: max 12 incoming items per 10s
    const t = Date.now();
    this.recvLog = this.recvLog.filter((x) => t - x < 10000);
    if (this.recvLog.length >= 12) return;
    this.recvLog.push(t);
    if (m.t === 'post') {
      this.upsertAuthor({ id: m.from, name: m.name, handle: handleOf(m.name), kind: 'player', avatar: m.avatar ?? this.authors[m.from]?.avatar });
      this.addPost({ id: m.id, authorId: m.from, text: m.text, ts: m.ts, likes: 0, liked: false, replyTo: m.replyTo });
      this.changed();
      if (!m.replyTo || this.postById(m.replyTo)?.authorId === this.me.id) this.onIncoming?.('post', this.author(m.from), m.text);
    } else if (m.t === 'like') {
      const p = this.posts.find((x) => x.id === m.post);
      if (p) {
        p.likes++;
        this.changed();
      }
    } else if (m.t === 'dm') {
      if (m.to !== this.me.id || !this.allowDMs) return;
      this.upsertAuthor({ id: m.from, name: m.name, handle: handleOf(m.name), kind: 'player', avatar: this.authors[m.from]?.avatar });
      this.pushMsg(m.from, { id: m.id, from: m.from, text: m.text, ts: m.ts }, true);
      this.changed();
      this.onIncoming?.('dm', this.author(m.from), m.text);
    }
  }

  // ---------------------------------------------------------------- safety
  mute(id: string) {
    if (id === this.me.id) return;
    this.muted.add(id);
    this.changed();
  }
  unmute(id: string) {
    this.muted.delete(id);
    this.changed();
  }
  isMuted(id: string) {
    return this.muted.has(id);
  }
  /** Hide a post (or a whole person, for DMs) and remember the report on this device. */
  report(kind: 'post' | 'person', id: string) {
    if (kind === 'post') this.reported.add(id);
    else this.muted.add(id);
    this.changed();
  }
  setAllowDMs(v: boolean) {
    this.allowDMs = v;
    this.changed();
  }
}
