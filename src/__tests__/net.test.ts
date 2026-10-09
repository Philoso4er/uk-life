import { describe, expect, it } from 'vitest';
import { LocalTransport } from '../net/local';
import { sanitizePlayer, sanitizeSocial, type PlayerState, type SocialWire } from '../net/types';
import { randomAvatar } from '../game/avatar';

const player = (id: string, name: string, x = 10, y = 19): PlayerState => ({ id, name, avatar: randomAvatar(), x, y, facing: 'down', moving: false });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('wire sanitising', () => {
  it('rejects junk and clamps fields', () => {
    expect(sanitizePlayer(null)).toBeNull();
    expect(sanitizePlayer({ id: 'a', x: 'NaN', y: 3 })).toBeNull();
    expect(sanitizePlayer({ id: 'a', x: 9999, y: 3 })).toBeNull();
    const p = sanitizePlayer({ id: 'a', name: 'shithead', x: 4, y: 5, facing: 'sideways', avatar: { skin: 'red', hair: 'nope' } })!;
    expect(p.name).not.toMatch(/shit/);
    expect(p.facing).toBe('down');
    expect(p.avatar.hair).toBe('short');
    expect(p.avatar.skin).toMatch(/^#/);
  });
  it('re-filters posts on receipt (never trust the sender)', () => {
    const m = sanitizeSocial({ t: 'post', id: 'p', from: 'x', name: 'Bob', text: 'oi fuck off' })!;
    expect(m.t === 'post' && m.text).toBe('oi **** off');
    expect(sanitizeSocial({ t: 'post', id: 'p', from: 'x', name: 'Bob', text: '   ' })).toBeNull();
  });
});

describe('LocalTransport (BroadcastChannel) — stand-in for the Supabase realtime path', () => {
  it('two clients see each other move, post and DM, and ignore their own echoes', async () => {
    const room = 'test-' + Math.random();
    const a = new LocalTransport(room);
    const b = new LocalTransport(room);
    const seenByA: PlayerState[] = [];
    const chatsA: SocialWire[] = [];
    const chatsB: SocialWire[] = [];
    let countA = 0;
    const pa = player('alice.1', 'Alice');
    const pb = player('bob.1', 'Bob', 30, 22);
    await a.start(pa, { onState: (p) => seenByA.push(p), onLeave: () => {}, onSocial: (m) => chatsA.push(m), onCount: (n) => (countA = n) });
    await b.start(pb, { onState: () => {}, onLeave: () => {}, onSocial: (m) => chatsB.push(m), onCount: () => {} });
    await wait(50);
    expect(seenByA.some((p) => p.id === 'bob.1')).toBe(true);
    expect(countA).toBe(2);
    b.sendState({ ...pb, x: 31.5, moving: true });
    await wait(50);
    expect(seenByA.at(-1)).toMatchObject({ id: 'bob.1', x: 31.5, moving: true });
    b.sendSocial({ t: 'post', id: 'm1', from: 'bob.1', name: 'Bob', text: 'Alright? Bloody freezing', ts: Date.now() });
    b.sendSocial({ t: 'dm', id: 'm2', from: 'bob.1', name: 'Bob', to: 'alice.1', text: 'Pint later?', ts: Date.now() });
    b.sendSocial({ t: 'post', id: 'm3', from: 'bob.1', name: 'Bob', text: 'oi fuck off', ts: 9e15 });
    await wait(50);
    expect(chatsA.map((m) => (m.t !== 'like' ? m.text : ''))).toEqual(['Alright? Bloody freezing', 'Pint later?', 'oi **** off']);
    expect(chatsA.every((m) => m.t === 'like' || m.ts <= Date.now())).toBe(true);
    expect(chatsB).toHaveLength(0); // no echo to self
    b.stop();
    await wait(50);
    expect(countA).toBe(1);
    a.stop();
  });
});
