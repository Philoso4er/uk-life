import { describe, expect, it } from 'vitest';
import {
  ACTS,
  BROLLY_REGULARS,
  INVITE_PLACES,
  MATE,
  LEVELS,
  RateLimiter,
  SCHEDULE,
  TOPICS,
  WISHES,
  actBlocked,
  checkWishes,
  doAct,
  levelOf,
  levelUpPost,
  npcKey,
  relOf,
  staffKey,
  talkOpener,
  talkReply,
  wantedPlace,
  type PersonRef,
} from '../game/people';
import { BOT_NAMES, npcAvatar } from '../game/bots';
import { INTERIORS } from '../game/interiors';
import { newSave, migrate, type GameEvent } from '../game/economy';
import { avatarForName } from '../game/avatar';
import { addDays, london, type LondonTime } from '../game/time';
import { sanitizePlayer, sanitizeSocial } from '../net/types';

const save = () => newSave('Sam', { ...avatarForName('Sam', 'female'), gender: 'female', pronouns: 'she' });
const npc = (name: string, place: string | null = null): PersonRef => ({ key: npcKey(name), kind: 'npc', name, avatar: npcAvatar(name), place });
const at = (hh: number, dayIdx = 2): LondonTime => ({ ...london(), hh, mm: 0, dayIdx });

describe('routines', () => {
  it('every routine and invite goes somewhere you can walk into', () => {
    for (const [name, slots] of Object.entries(SCHEDULE)) {
      expect(BOT_NAMES, name).toContain(name);
      for (const s of slots) expect(INTERIORS[s.place], `${name} → ${s.place}`).toBeTruthy();
    }
    for (const p of INVITE_PLACES) expect(INTERIORS[p]).toBeTruthy();
  });
  it('Big Tel is in the pub at night (most nights), Nan at Crumbs in the morning, nobody in at 4am', () => {
    let tel = 0;
    let nan = 0;
    for (let d = 0; d < 40; d++) {
      const day = { ...at(20), dateKey: addDays('2026-01-01', d) };
      const w = wantedPlace('Big Tel', day);
      expect([null, 'pub']).toContain(w);
      if (w === 'pub') tel++;
      if (wantedPlace('Nan', { ...at(8), dateKey: day.dateKey }) === 'crumbs') nan++;
      for (const n of BOT_NAMES) expect(wantedPlace(n, { ...at(4), dateKey: day.dateKey })).toBeNull();
    }
    expect(tel).toBeGreaterThan(24);
    expect(nan).toBeGreaterThan(24);
  });
  it('the same answer all hour (no flickering in and out of the door)', () => {
    const t = at(21);
    const a = wantedPlace('Siobhan', t);
    for (let i = 0; i < 10; i++) expect(wantedPlace('Siobhan', { ...t, mm: i * 5 })).toBe(a);
  });
  it('an accepted invite overrides the routine for a while', () => {
    expect(wantedPlace('Nan', at(15), { place: 'gym', until: Date.now() + 60000 })).toBe('gym');
    expect(wantedPlace('Nan', at(15), { place: 'gym', until: Date.now() - 1 })).not.toBe('gym');
  });
});

describe('relationships & interactions', () => {
  it('levels go Stranger → Best mate', () => {
    expect(levelOf(0).name).toBe('Stranger');
    expect(levelOf(8).name).toBe('Nodding terms');
    expect(levelOf(40).i).toBe(MATE);
    expect(levelOf(999).name).toBe('Best mate');
    expect(levelOf(10).progress).toBeCloseTo((10 - 8) / (20 - 8));
    expect(LEVELS.length).toBe(6);
  });
  it('waving earns a point and Social, then cools down', () => {
    const s = save();
    const before = s.social;
    const r = doAct(s, npc('Nan'), 'wave', null);
    expect(r.tone).toBe('good');
    expect(relOf(s, npcKey('Nan')).pts).toBe(ACTS.wave.pts);
    expect(s.social).toBeGreaterThan(before - 0.001);
    expect(actBlocked(s, npc('Nan'), 'wave', null)).toMatch(/Give it/);
    expect(doAct(s, npc('Nan'), 'wave', null).tone).toBe('bad');
    relOf(s, npcKey('Nan')).cds.wave = Date.now() - 1;
    expect(actBlocked(s, npc('Nan'), 'wave', null)).toBeNull();
  });
  it('drinks need a bar, the person there, and the money', () => {
    const s = save();
    expect(actBlocked(s, npc('Big Tel', 'pub'), 'drink', null)).toMatch(/Nowhere/);
    expect(actBlocked(s, npc('Big Tel', 'crumbs'), 'drink', 'pub')).toMatch(/not here/);
    s.money = 2;
    expect(actBlocked(s, npc('Big Tel', 'pub'), 'drink', 'pub')).toMatch(/skint/);
    s.money = 20;
    const r = doAct(s, npc('Big Tel', 'pub'), 'drink', 'pub');
    expect(r.tone).toBe('good');
    expect(s.money).toBeCloseTo(14.6);
    expect(relOf(s, npcKey('Big Tel')).pts).toBe(ACTS.drink.pts);
  });
  it('levelling up is announced; favours unlock at Mate, once a day', () => {
    const s = save();
    const who = npc('Nan');
    relOf(s, who.key).pts = 7;
    const r = doAct(s, who, 'compliment', null, { compliment: 1 });
    expect(r.levelUp).toBe('Nodding terms');
    expect(r.events.some((e) => e.type === 'toast' && /Nodding terms/.test(e.text))).toBe(true);
    expect(actBlocked(s, who, 'favour', null)).toMatch(/Unlocks at Mate/);
    relOf(s, who.key).pts = 45;
    const hunger = (s.hunger = 30);
    expect(doAct(s, who, 'favour', null).tone).toBe('good');
    expect(s.hunger).toBeGreaterThan(hunger);
    expect(actBlocked(s, who, 'favour', null)).toBe('Tomorrow');
  });
  it('friendship streaks: consecutive days, bonus on day 3', () => {
    const s = save();
    const r = relOf(s, npcKey('Kev'));
    r.day = addDays(london().dateKey, -1);
    r.streak = 2;
    const res = doAct(s, npc('Kev'), 'wave', null);
    expect(relOf(s, npcKey('Kev')).streak).toBe(3);
    expect(res.events.some((e) => e.type === 'toast' && /3-day streak/.test(e.text))).toBe(true);
    expect(relOf(s, npcKey('Kev')).pts).toBe(ACTS.wave.pts + 3);
    // a gap resets it
    const r2 = relOf(s, npcKey('Hamza'));
    r2.day = addDays(london().dateKey, -3);
    r2.streak = 5;
    doAct(s, npc('Hamza'), 'wave', null);
    expect(relOf(s, npcKey('Hamza')).streak).toBe(1);
  });
  it('invites: accepted ones say so (and cost nothing)', () => {
    const s = save();
    const r = doAct(s, npc('Femi'), 'invite', null, { place: 'pub', accept: true });
    expect(r.tone).toBe('good');
    expect(r.text).toMatch(/Leaky Brolly/);
    const no = doAct(s, npc('Kev'), 'invite', null, { place: 'gym', accept: false });
    expect(no.tone).toBe('info');
  });
  it('small talk is state-aware and never leaves template tokens behind', () => {
    const s = save();
    s.money = 3;
    s.job = null;
    for (const name of [...BOT_NAMES, 'Mo']) {
      const who = name === 'Mo' ? { ...npc('Mo'), kind: 'staff' as const, key: staffKey('Mo') } : npc(name);
      for (let i = 0; i < 25; i++) {
        const ctx = { raining: i % 2 === 0, hh: (i * 5) % 24, place: i % 3 ? 'pub' : 'crumbs' };
        expect(talkOpener(who, s, ctx)).not.toMatch(/[{}]/);
        for (const t of TOPICS) expect(talkReply(who, t.id, s, ctx), `${name}/${t.id}`).not.toMatch(/[{}]/);
      }
    }
    const lines = new Set(Array.from({ length: 80 }, () => talkReply(npc('Nan'), 'you', s, { raining: false, hh: 12, place: null })));
    expect([...lines].some((l) => /Skint|Jobcentre|sofa/.test(l))).toBe(true);
  });
  it('level-up posts use your pronouns', () => {
    const s = save();
    for (let i = 0; i < 20; i++) {
      const p = levelUpPost('Acquaintance', s);
      expect(p).not.toMatch(/[{}]/);
      expect(p).toMatch(/Sam/);
      expect(p).not.toMatch(/\bthey\b|\bhe is\b/);
    }
  });
});

describe('lifetime wishes', () => {
  it('Everybody’s mate pays out once', () => {
    const s = save();
    const out: GameEvent[] = [];
    for (const n of BOT_NAMES.slice(0, 4)) relOf(s, npcKey(n)).pts = 40;
    const m = s.money;
    checkWishes(s, out);
    expect(s.wishes.mates).toBeTruthy();
    expect(s.money).toBe(m + WISHES.find((w) => w.id === 'mates')!.reward);
    checkWishes(s, out);
    expect(s.money).toBe(m + 40);
  });
  it('knowing the Brolly needs Mo and four regulars', () => {
    const s = save();
    const w = WISHES.find((x) => x.id === 'brolly')!;
    for (const n of BROLLY_REGULARS.slice(0, 4)) relOf(s, npcKey(n)).pts = 8;
    expect(w.progress(s)).toEqual([4, 5]);
    relOf(s, staffKey('Mo')).pts = 8;
    expect(w.progress(s)).toEqual([5, 5]);
  });
});

describe('multiplayer safety', () => {
  it('rate limiter: gap and window', () => {
    const r = new RateLimiter(3, 10000, 1000);
    expect(r.ok('a', 0)).toBe(true);
    expect(r.ok('a', 500)).toBe(false); // too soon
    expect(r.ok('a', 1500)).toBe(true);
    expect(r.ok('a', 3000)).toBe(true);
    expect(r.ok('a', 5000)).toBe(false); // 3 in the window
    expect(r.ok('b', 5000)).toBe(true); // per key
    expect(r.ok('a', 11000)).toBe(true);
  });
  it('acts and room chat are sanitised', () => {
    expect(sanitizeSocial({ t: 'act', id: 'x1', from: 'p1', name: 'Al', to: 'p2.ab', kind: 'wave' })).toMatchObject({ kind: 'wave' });
    expect(sanitizeSocial({ t: 'act', id: 'x1', from: 'p1', name: 'Al', to: 'p2.ab', kind: 'steal_wallet' })).toBeNull();
    expect(sanitizeSocial({ t: 'act', id: 'x1', from: 'p1', name: 'Al', to: 'p2.ab', kind: 'compliment', n: 999 })).toMatchObject({ n: undefined });
    expect(sanitizeSocial({ t: 'act', id: 'x1', from: 'p1', name: 'Al', to: 'bad id!', kind: 'wave' })).toBeNull();
    const say = sanitizeSocial({ t: 'say', id: 'x2', from: 'p1', name: 'Al', room: 'pub', text: 'oi fuck off ' + 'a'.repeat(300), ts: 9e15 });
    expect(say && say.t === 'say' && say.text.length <= 100 && !/fuck/.test(say.text) && say.ts <= Date.now()).toBe(true);
    expect(sanitizeSocial({ t: 'say', id: 'x3', from: 'p1', name: 'Al', room: '../etc', text: 'hi' })).toBeNull();
  });
  it('player state carries room, mood and a cleaned status', () => {
    const p = sanitizePlayer({ id: 'a.1', name: 'Al', avatar: {}, x: 3, y: 4, facing: 'up', room: 'pub', mood: 250, status: 'Barista ' + 'x'.repeat(80) });
    expect(p).toMatchObject({ room: 'pub', mood: 100 });
    expect(p!.status!.length).toBeLessThanOrEqual(40);
    expect(sanitizePlayer({ id: 'a.1', name: 'Al', avatar: {}, x: 3, y: 4, room: 'not ok!' })!.room).toBeUndefined();
  });
});

describe('saves', () => {
  it('older saves gain empty relationships, follows and wishes', () => {
    const s = save() as unknown as Record<string, unknown>;
    delete s.rel;
    delete s.follows;
    delete s.wishes;
    const m = migrate(JSON.parse(JSON.stringify(s)))!;
    expect(m.rel).toEqual({});
    expect(m.follows).toEqual([]);
    expect(m.wishes).toEqual({});
    const kept = migrate(JSON.parse(JSON.stringify({ ...save(), rel: { 'npc:Nan': { pts: 12, last: 1, streak: 2, day: '2026-01-01', cds: {} } } })))!;
    expect(kept.rel['npc:Nan'].pts).toBe(12);
  });
});
