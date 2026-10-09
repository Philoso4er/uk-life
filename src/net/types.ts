import type { Avatar, Facing } from '../game/types';
import { sanitizeAvatar } from '../game/avatar';
import { H, W } from '../game/world';
import { cleanMessage, cleanName, MAX_DM, MAX_POST } from './filter';

export interface PlayerState {
  id: string; // per-tab network id
  pid?: string; // stable player id (save id) used to address DMs
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  bike?: boolean;
  /** building id when inside one (x/y are then room coordinates) */
  room?: string;
  /** 0-100, shown on your profile card */
  mood?: number;
  /** short status line (job etc.), shown on your profile card */
  status?: string;
}

/** Things you can do to another player. Canned only: no free text crosses the wire here. */
export const WIRE_ACTS = ['wave', 'compliment', 'drink', 'follow', 'invite', 'accept', 'decline', 'nod'] as const;
export type WireAct = (typeof WIRE_ACTS)[number];

/** Everything social that crosses the wire: Natter posts/replies/likes and private messages. */
export type SocialWire =
  | { t: 'post'; id: string; from: string; name: string; text: string; ts: number; replyTo?: string; avatar?: Avatar }
  | { t: 'like'; id: string; from: string; post: string }
  | { t: 'dm'; id: string; from: string; name: string; to: string; text: string; ts: number }
  /** a tap-to-interact action aimed at one player (to = their network id) */
  | { t: 'act'; id: string; from: string; name: string; to: string; kind: WireAct; n?: number; place?: string }
  /** room chat: a short line said out loud inside a building, to whoever's in there */
  | { t: 'say'; id: string; from: string; name: string; room: string; text: string; ts: number };

export const MAX_SAY = 100;

export type NetMode = 'online' | 'local' | 'offline';

export interface NetHandlers {
  onState(p: PlayerState): void;
  onLeave(id: string): void;
  onSocial(m: SocialWire): void;
  onCount(n: number): void;
  onStatus?(s: string): void;
}

export interface Transport {
  readonly mode: NetMode;
  start(me: PlayerState, h: NetHandlers): Promise<void>;
  sendState(p: PlayerState): void;
  sendSocial(m: SocialWire): void;
  stop(): void;
}

const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];
const okId = (v: unknown, max = 48): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && /^[\w.:-]+$/.test(v);

/** Never trust the wire. */
export function sanitizePlayer(raw: unknown): PlayerState | null {
  const p = raw as Partial<PlayerState> | null;
  if (!p || !okId(p.id)) return null;
  const x = Number(p.x);
  const y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > W || y > H) return null;
  return {
    id: p.id,
    pid: okId(p.pid) ? p.pid : undefined,
    name: cleanName(String(p.name ?? '')),
    avatar: sanitizeAvatar(p.avatar),
    x,
    y,
    facing: FACINGS.includes(p.facing as Facing) ? (p.facing as Facing) : 'down',
    moving: !!p.moving,
    bike: !!p.bike,
    room: okId(p.room, 24) ? p.room : undefined,
    mood: Number.isFinite(Number(p.mood)) && p.mood != null ? Math.max(0, Math.min(100, Math.round(Number(p.mood)))) : undefined,
    status: typeof p.status === 'string' ? cleanMessage(p.status, 40) || undefined : undefined,
  };
}

export function sanitizeSocial(raw: unknown): SocialWire | null {
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== 'object' || !okId(m.id) || !okId(m.from)) return null;
  // the sender's own idea of time is ignored: stamp on receipt, so nobody can pin a post to the top forever
  const ts = Date.now();
  if (m.t === 'post') {
    const text = cleanMessage(String(m.text ?? ''), MAX_POST);
    if (!text) return null;
    return { t: 'post', id: m.id, from: m.from, name: cleanName(String(m.name ?? '')), text, ts, replyTo: okId(m.replyTo) ? m.replyTo : undefined, avatar: m.avatar ? sanitizeAvatar(m.avatar) : undefined };
  }
  if (m.t === 'like') return okId(m.post) ? { t: 'like', id: m.id, from: m.from, post: m.post } : null;
  if (m.t === 'dm') {
    if (!okId(m.to)) return null;
    const text = cleanMessage(String(m.text ?? ''), MAX_DM);
    if (!text) return null;
    return { t: 'dm', id: m.id, from: m.from, name: cleanName(String(m.name ?? '')), to: m.to, text, ts };
  }
  if (m.t === 'act') {
    if (!okId(m.to) || !WIRE_ACTS.includes(m.kind as WireAct)) return null;
    const n = Number(m.n);
    return { t: 'act', id: m.id, from: m.from, name: cleanName(String(m.name ?? '')), to: m.to, kind: m.kind as WireAct, n: Number.isInteger(n) && n >= 0 && n < 20 ? n : undefined, place: okId(m.place, 24) ? m.place : undefined };
  }
  if (m.t === 'say') {
    if (!okId(m.room, 24)) return null;
    const text = cleanMessage(String(m.text ?? ''), MAX_SAY);
    if (!text) return null;
    return { t: 'say', id: m.id, from: m.from, name: cleanName(String(m.name ?? '')), room: m.room, text, ts };
  }
  return null;
}
