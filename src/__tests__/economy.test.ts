import { describe, expect, it } from 'vitest';
import { CATCHUP_CAP_MIN, HOMES, catchUp, checkStreak, migrate, newSave, processBills, tick, type GameEvent } from '../game/economy';
import { activeMoodlets, addMoodlet, effectiveMood, passTime } from '../game/needs';
import { randomAvatar } from '../game/avatar';
import { rentKey } from '../game/time';
import '../game/actions'; // registers the gym weekly hook

const fresh = () => newSave('Test', randomAvatar());
const MON_0859 = Date.UTC(2026, 6, 13, 7, 59);
const MON_0900 = Date.UTC(2026, 6, 13, 8, 0);
const WEEK = 7 * 24 * 3600 * 1000;

describe('rent day (real Monday 09:00)', () => {
  it('bills rent + council tax once, at 09:00, not before', () => {
    const s = fresh();
    s.lastBillKey = rentKey(MON_0859);
    s.home = 'flatshare';
    s.rent = HOMES.flatshare.rent;
    s.money = 1000;
    const out: GameEvent[] = [];
    processBills(s, out, MON_0859);
    expect(out).toHaveLength(0);
    processBills(s, out, MON_0900);
    const after = s.money;
    expect(after).toBe(1000 - 165 - 21);
    expect(out.some((e) => e.type === 'phone')).toBe(true);
    expect(s.goals.rentday).toBe(true);
    processBills(s, out, MON_0900 + 3600_000);
    expect(s.money).toBe(after);
  });
  it('only bills one week even after a month away', () => {
    const s = fresh();
    s.lastBillKey = rentKey(MON_0859);
    s.home = 'studio';
    s.rent = 295;
    s.money = 2000;
    processBills(s, [], MON_0900 + 4 * WEEK);
    expect(s.money).toBe(2000 - 295 - 29);
  });
  it('two missed rents and you are back on the sofa', () => {
    const s = fresh();
    s.lastBillKey = rentKey(MON_0859);
    s.home = 'flatshare';
    s.rent = 165;
    s.money = 10;
    const out: GameEvent[] = [];
    processBills(s, out, MON_0900);
    expect(s.arrears).toBe(1);
    processBills(s, out, MON_0900 + WEEK);
    expect(s.home).toBe('sofa');
  });
  it('gym members pay £20 on Mondays', () => {
    const s = fresh();
    s.lastBillKey = rentKey(MON_0859);
    s.owned.items.push('gym');
    s.money = 50;
    processBills(s, [], MON_0900);
    expect(s.money).toBe(30);
  });
});

describe('needs and moodlets', () => {
  it('needs decay with life time, and the rain makes you cold', () => {
    const s = fresh();
    passTime(s, 120, { raining: false, outdoors: true });
    expect(s.hunger).toBeLessThan(60);
    const w = s.warmth;
    passTime(s, 60, { raining: true, outdoors: true });
    expect(s.warmth).toBeLessThan(w);
    s.inv.coat = true;
    const w2 = s.warmth;
    passTime(s, 60, { raining: true, outdoors: true });
    expect(w2 - s.warmth).toBeLessThan(w - w2);
  });
  it('moodlets add to mood, then expire', () => {
    const s = fresh();
    const base = effectiveMood(s);
    addMoodlet(s, 'had_crumbs');
    expect(effectiveMood(s)).toBeGreaterThan(base);
    expect(activeMoodlets(s).some((m) => m.def.id === 'had_crumbs')).toBe(true);
    passTime(s, 24 * 60, { raining: false, outdoors: false });
    expect(activeMoodlets(s).some((m) => m.def.id === 'had_crumbs')).toBe(false);
  });
  it('dynamic moodlets appear when needs are low', () => {
    const s = fresh();
    s.hunger = 5;
    expect(activeMoodlets(s).some((m) => m.def.id === 'hangry')).toBe(true);
  });
  it('the live tick runs life time 4x while playing', () => {
    const a = fresh();
    const b = fresh();
    tick(a, { raining: false, outdoors: true, inPark: false, onShift: false, dtMs: 60000, active: true }, []);
    tick(b, { raining: false, outdoors: true, inPark: false, onShift: false, dtMs: 60000, active: false }, []);
    expect(a.life).toBeCloseTo(4);
    expect(b.life).toBeCloseTo(1);
  });
});

describe('coming back', () => {
  it('catch-up is capped and gentle', () => {
    const s = fresh();
    const t = s.lastSeen + 5 * 24 * 3600_000;
    const out: GameEvent[] = [];
    const mins = catchUp(s, out, t);
    expect(mins).toBe(CATCHUP_CAP_MIN);
    for (const k of ['hunger', 'social', 'hygiene'] as const) expect(s[k]).toBeGreaterThanOrEqual(20);
    expect(out.some((e) => e.type === 'summary')).toBe(true);
    expect(s.energy).toBeGreaterThan(60); // you slept at some point
  });
  it('a quick tab switch is not a catch-up', () => {
    const s = fresh();
    expect(catchUp(s, [], s.lastSeen + 60_000)).toBe(0);
  });
  it('daily streak continues, rewards, and resets after a gap', () => {
    const s = fresh();
    const day = 24 * 3600_000;
    const out: GameEvent[] = [];
    checkStreak(s, out, MON_0900);
    checkStreak(s, out, MON_0900 + 3600_000); // same day: nothing
    checkStreak(s, out, MON_0900 + day);
    expect(s.streak.count).toBe(2);
    expect(out.filter((e) => e.type === 'streak')).toHaveLength(2);
    checkStreak(s, out, MON_0900 + 4 * day);
    expect(s.streak.count).toBe(1);
    expect(s.streak.best).toBe(2);
  });
});

describe('save migration', () => {
  it('upgrades a v1 save without losing progress', () => {
    const v1 = { version: 1, name: 'Old Timer', avatar: randomAvatar(), money: 321.5, oyster: 3, energy: 40, hunger: 70, mood: 55, minutes: 20000, job: 'barista', shifts: 5, home: 'studio', rent: 295, arrears: 0, lastBillWeek: 3, umbrellaUntil: 21000, goals: { job: true, chat: true }, pos: { x: 10, y: 20 }, stats: { earned: 400, rentPaid: 295, sausageRolls: 3, pints: 1, tubeTrips: 2 } };
    const s = migrate(v1)!;
    expect(s.version).toBe(2);
    expect(s.money).toBe(321.5);
    expect(s.job).toBe('barista');
    expect(s.home).toBe('studio');
    expect(s.jobLevel).toBe(2);
    expect(s.goals.chat).toBe(true);
    expect(s.social).toBeGreaterThan(0);
    expect(s.stats.ducksFed).toBe(0);
    expect(s.umbrellaUntil).toBeGreaterThan(0);
    expect(Array.isArray(s.moodlets)).toBe(true);
  });
  it('repairs partial or wonky v2 saves and rejects junk', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate({ name: 3 })).toBeNull();
    const s = migrate({ version: 2, name: 'X', avatar: randomAvatar(), money: 'lots', home: 'castle', energy: 900, skills: { charm: 2 } })!;
    expect(s.money).toBe(120);
    expect(s.home).toBe('sofa');
    expect(s.energy).toBe(100);
    expect(s.skills.charm).toBe(2);
    expect(s.skills.fitness).toBe(0);
  });
});
