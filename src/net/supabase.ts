import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { sanitizeChat, sanitizePlayer, type ChatMessage, type NetHandlers, type PlayerState, type Transport } from './types';

/**
 * Real multiplayer via Supabase Realtime: Presence (who's online + count) and
 * Broadcast (positions + chat). No database tables needed.
 */
export class SupabaseTransport implements Transport {
  readonly mode = 'online' as const;
  private client: SupabaseClient | null = null;
  private ch: RealtimeChannel | null = null;
  private me!: PlayerState;
  private ready = false;

  constructor(private url: string, private key: string, private room = 'uklife:peckwell') {}

  async start(me: PlayerState, h: NetHandlers) {
    this.me = me;
    const { createClient } = await import('@supabase/supabase-js');
    this.client = createClient(this.url, this.key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 15 } },
    });
    const ch = this.client.channel(this.room, {
      config: { presence: { key: me.id }, broadcast: { self: false, ack: false } },
    });
    this.ch = ch;
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ p: PlayerState }>();
      h.onCount(Math.max(1, Object.keys(state).length));
      for (const [key, metas] of Object.entries(state)) {
        if (key === this.me.id) continue;
        const p = sanitizePlayer(metas[metas.length - 1]?.p);
        if (p) h.onState(p);
      }
    });
    ch.on('presence', { event: 'leave' }, ({ key }) => {
      if (key && key !== this.me.id) h.onLeave(key);
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      const p = sanitizePlayer(payload);
      if (p && p.id !== this.me.id) h.onState(p);
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const m = sanitizeChat(payload);
      if (m && m.from !== this.me.id) h.onChat(m);
    });
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      ch.subscribe(async (status) => {
        h.onStatus?.(status);
        if (status === 'SUBSCRIBED') {
          this.ready = true;
          await ch.track({ p: this.me, at: Date.now() });
          finish();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.ready = false;
          finish();
        }
      });
      setTimeout(finish, 8000);
    });
  }

  sendState(p: PlayerState) {
    this.me = p;
    if (!this.ready || !this.ch) return;
    void this.ch.send({ type: 'broadcast', event: 'pos', payload: p });
  }

  /** Presence payload refresh (name/avatar changes); cheap to call occasionally. */
  retrack(p: PlayerState) {
    this.me = p;
    if (this.ready) void this.ch?.track({ p, at: Date.now() });
  }

  sendChat(m: ChatMessage) {
    if (!this.ready || !this.ch) return;
    void this.ch.send({ type: 'broadcast', event: 'chat', payload: m });
  }

  stop() {
    if (this.ch) void this.client?.removeChannel(this.ch);
    this.ch = null;
    this.ready = false;
  }
}
