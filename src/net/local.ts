import { sanitizeChat, sanitizePlayer, type ChatMessage, type NetHandlers, type PlayerState, type Transport } from './types';

/**
 * Same-browser "multiplayer" over BroadcastChannel. Used when Supabase isn't configured,
 * so two tabs on one machine can see each other. It is also the test double for the
 * realtime code path (same message shapes as the Supabase transport).
 */
export class LocalTransport implements Transport {
  readonly mode = 'local' as const;
  private ch: BroadcastChannel | null = null;
  private seen = new Map<string, number>();
  private h!: NetHandlers;
  private me!: PlayerState;
  private timer = 0;
  /** test hook */
  get peers() {
    return this.seen.size;
  }

  constructor(private channelName = 'uklife-peckwell') {}

  async start(me: PlayerState, h: NetHandlers) {
    this.me = me;
    this.h = h;
    if (typeof BroadcastChannel === 'undefined') {
      h.onCount(1);
      return;
    }
    this.ch = new BroadcastChannel(this.channelName);
    this.ch.onmessage = (e: MessageEvent) => this.onMessage(e.data);
    this.post({ t: 'state', p: me });
    this.timer = setInterval(() => this.sweep(), 2000) as unknown as number;
    h.onCount(1);
  }

  private onMessage(d: { t: string; p?: unknown; m?: unknown; id?: string }) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'state') {
      const p = sanitizePlayer(d.p);
      if (!p || p.id === this.me.id) return;
      const isNew = !this.seen.has(p.id);
      this.seen.set(p.id, Date.now());
      this.h.onState(p);
      if (isNew) {
        this.h.onCount(this.seen.size + 1);
        this.post({ t: 'state', p: this.me }); // say hello back so they see us immediately
      }
    } else if (d.t === 'chat') {
      const m = sanitizeChat(d.m);
      if (m && m.from !== this.me.id) this.h.onChat(m);
    } else if (d.t === 'bye' && typeof d.id === 'string') {
      this.seen.delete(d.id);
      this.h.onLeave(d.id);
      this.h.onCount(this.seen.size + 1);
    }
  }

  private sweep() {
    const now = Date.now();
    for (const [id, t] of this.seen)
      if (now - t > 7000) {
        this.seen.delete(id);
        this.h.onLeave(id);
      }
    this.h.onCount(this.seen.size + 1);
  }

  private post(msg: unknown) {
    try {
      this.ch?.postMessage(msg);
    } catch {
      /* channel closed */
    }
  }

  sendState(p: PlayerState) {
    this.me = p;
    this.post({ t: 'state', p });
  }
  sendChat(m: ChatMessage) {
    this.post({ t: 'chat', m });
  }
  stop() {
    this.post({ t: 'bye', id: this.me?.id });
    clearInterval(this.timer);
    this.ch?.close();
    this.ch = null;
  }
}
