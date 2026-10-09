import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialStore, type Author } from '../game/social';
import { NpcBrain, PERSONAS } from '../game/npcs';
import { newSave } from '../game/economy';
import { randomAvatar } from '../game/avatar';
import { sanitizeSocial } from '../net/types';

const me = { id: 'me1', name: 'Me', avatar: randomAvatar() };
const store = () => new SocialStore('test.' + Math.random(), me);
const bob: Author = { id: 'bob1', name: 'Bob', handle: '@Bob', kind: 'player' };

afterEach(() => vi.useRealTimers());

describe('social wire', () => {
  it('re-filters and re-stamps everything on receipt', () => {
    const p = sanitizeSocial({ t: 'post', id: 'p1', from: 'bob1', name: 'Bob', text: 'oi fuck off', ts: 9e15 })!;
    expect(p.t === 'post' && p.text).toBe('oi **** off');
    expect(p.t === 'post' && p.ts).toBeLessThanOrEqual(Date.now());
    expect(sanitizeSocial({ t: 'post', id: 'p1', from: 'bob1', text: '  ' })).toBeNull();
    expect(sanitizeSocial({ t: 'dm', id: 'd1', from: 'bob1', name: 'Bob', text: 'hi' })).toBeNull(); // no recipient
    expect(sanitizeSocial({ t: 'dm', id: 'd1', from: 'bob 1', to: 'me1', text: 'hi' })).toBeNull(); // bad id
    expect(sanitizeSocial({ t: 'nope', id: 'x', from: 'y' })).toBeNull();
  });
});

describe('SocialStore', () => {
  it('posts, rate-limits, likes', () => {
    const s = store();
    const sent: unknown[] = [];
    s.sender = (m) => sent.push(m);
    expect(s.post('Lovely weather')).toBeNull();
    expect(s.post('Again')).toMatch(/Easy/);
    expect(s.getSnapshot().posts[0].text).toBe('Lovely weather');
    expect(sent).toHaveLength(1);
    s.like(s.getSnapshot().posts[0].id);
    expect(s.getSnapshot().posts[0].likes).toBe(1);
  });
  it('only accepts DMs addressed to me, and honours mute and the DM toggle', () => {
    const s = store();
    s.receive({ t: 'dm', id: 'a', from: 'bob1', name: 'Bob', to: 'someone-else', text: 'psst', ts: 1 });
    expect(s.getSnapshot().threads).toHaveLength(0);
    s.receive({ t: 'dm', id: 'b', from: 'bob1', name: 'Bob', to: 'me1', text: 'alright?', ts: 1 });
    expect(s.getSnapshot().threads[0].msgs[0].text).toBe('alright?');
    expect(s.getSnapshot().dmUnread).toBe(1);
    s.mute('bob1');
    s.receive({ t: 'post', id: 'c', from: 'bob1', name: 'Bob', text: 'muted post', ts: 1 });
    expect(s.getSnapshot().posts).toHaveLength(0);
    expect(s.getSnapshot().threads).toHaveLength(0);
    s.unmute('bob1');
    s.setAllowDMs(false);
    s.receive({ t: 'dm', id: 'd', from: 'bob1', name: 'Bob', to: 'me1', text: 'again', ts: 1 });
    expect(s.getSnapshot().threads[0].msgs).toHaveLength(1);
  });
  it('sends DMs to players over the wire, but not to NPCs', () => {
    const s = store();
    const sent: { t: string; to?: string }[] = [];
    s.sender = (m) => sent.push(m);
    s.openThread(bob);
    expect(s.dm('bob1', 'hiya')).toBeNull();
    expect(sent).toEqual([expect.objectContaining({ t: 'dm', to: 'bob1' })]);
    s.openThread({ id: 'npc:nan', name: 'Nan', handle: '@Nan', kind: 'npc' });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 5000);
    s.dm('npc:nan', 'hello Nan');
    expect(sent).toHaveLength(1);
  });
});

describe('NPC brain', () => {
  it('seeds a believable feed and a welcome DM', () => {
    const s = store();
    const b = new NpcBrain(s, newSave('Me', me.avatar));
    b.seed({ raining: true, hh: 9, dayIdx: 0, flags: {} });
    expect(s.getSnapshot().posts.length).toBeGreaterThanOrEqual(9);
    expect(s.getSnapshot().threads[0].msgs[0].text).toMatch(/Welcome to Peckwell/);
  });
  it('Big Tel can’t complain. Then complains.', () => {
    vi.useFakeTimers();
    const s = store();
    const b = new NpcBrain(s, newSave('Me', me.avatar));
    const tel = PERSONAS[0];
    const post = s.npcPost(b.author(tel), 'Can’t complain 👍');
    b.complain(post.id);
    vi.setSystemTime(Date.now() + 200_000);
    s.pump(Date.now());
    const replies = s.getSnapshot().posts.filter((p) => p.replyTo === post.id).reverse();
    expect(replies.every((r) => r.authorId === post.authorId)).toBe(true);
    expect(replies.length).toBeGreaterThanOrEqual(2);
    expect(replies.at(-1)!.text).toMatch(/apart from that, can.t complain/i);
  });
  it('replies to your posts and DMs (eventually)', () => {
    vi.useFakeTimers();
    const s = store();
    new NpcBrain(s, newSave('Me', me.avatar));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    s.post('Is it me or is the 436 never on time');
    vi.setSystemTime(Date.now() + 60_000);
    s.pump(Date.now());
    const mine = s.getSnapshot().posts.find((p) => p.authorId === 'me1')!;
    expect(mine.likes).toBeGreaterThan(0);
    s.openThread({ id: 'sys:mum', name: 'Mum', handle: '@Mum', kind: 'system' });
    vi.setSystemTime(Date.now() + 5000);
    s.dm('sys:mum', 'hi mum');
    vi.setSystemTime(Date.now() + 60_000);
    s.pump(Date.now());
    const th = s.getSnapshot().threads.find((t) => t.peerId === 'sys:mum')!;
    expect(th.msgs.length).toBe(2);
    expect(th.msgs[1].text).toMatch(/Mum x|👍/);
    vi.restoreAllMocks();
  });
});
