import type { Avatar, Facing } from '../game/types';
import { sanitizeAvatar } from '../game/avatar';
import { H, W } from '../game/world';
import { cleanMessage, cleanName } from './filter';

export interface PlayerState {
  id: string;
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  bike?: boolean;
}

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text: string;
  ts: number;
  kind: 'player' | 'npc' | 'system' | 'me';
}

export type NetMode = 'online' | 'local' | 'offline';

export interface NetHandlers {
  onState(p: PlayerState): void;
  onLeave(id: string): void;
  onChat(m: ChatMessage): void;
  onCount(n: number): void;
  onStatus?(s: string): void;
}

export interface Transport {
  readonly mode: NetMode;
  start(me: PlayerState, h: NetHandlers): Promise<void>;
  sendState(p: PlayerState): void;
  sendChat(m: ChatMessage): void;
  stop(): void;
}

const FACINGS: Facing[] = ['down', 'up', 'left', 'right'];

/** Never trust the wire. */
export function sanitizePlayer(raw: unknown): PlayerState | null {
  const p = raw as Partial<PlayerState> | null;
  if (!p || typeof p.id !== 'string' || p.id.length > 48 || !p.id) return null;
  const x = Number(p.x);
  const y = Number(p.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > W || y > H) return null;
  return {
    id: p.id,
    name: cleanName(String(p.name ?? '')),
    avatar: sanitizeAvatar(p.avatar),
    x,
    y,
    facing: FACINGS.includes(p.facing as Facing) ? (p.facing as Facing) : 'down',
    moving: !!p.moving,
    bike: !!p.bike,
  };
}

export function sanitizeChat(raw: unknown): ChatMessage | null {
  const m = raw as Partial<ChatMessage> | null;
  if (!m || typeof m.from !== 'string' || m.from.length > 48) return null;
  const text = cleanMessage(String(m.text ?? ''));
  if (!text) return null;
  return {
    id: typeof m.id === 'string' ? m.id.slice(0, 48) : Math.random().toString(36).slice(2),
    from: m.from,
    name: cleanName(String(m.name ?? '')),
    text,
    ts: Date.now(),
    kind: 'player',
  };
}
