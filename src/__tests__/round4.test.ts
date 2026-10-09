import { describe, expect, it } from 'vitest';
import { ACTIONS, PLACE_HOURS, blockReason, placeOpen, type ActionCtx } from '../game/actions';
import { HOMES, MAX_MISSED_DAYS, dailyHooks, migrate, newSave, runDailies, type GameEvent } from '../game/economy';
import { EMERGENCY_CREDIT, EVENT_BY_ID, clockWords } from '../game/events';
import { avatarForName, randomAvatar, sanitizeAvatar, HAIRS, OUTFITS, ACCESSORIES, frameFor } from '../game/avatar';
import { GUIDE_STEPS, guideFinished, guideStep, skipGuide } from '../game/guide';
import { LocalWorldFeed, setWorldFeed, worldFeed } from '../game/shared';
import { addDays, london, type LondonTime } from '../game/time';
import { BLINK, IDLE0, PHONE } from '../game/character';

const T = (dayIdx: number, hh: number, mm = 0): LondonTime => ({ dayIdx, day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][dayIdx], hh, mm, month: 10, dateKey: '2026-10-0' + (5 + dayIdx), label: `X ${hh}:${mm}` });
const ctx = (t: LondonTime): ActionCtx => ({ raining: false, regulars: 3, t });
const renter = () => {
  const s = newSave('Test', randomAvatar());
  s.home = 'flatshare';
  s.rent = HOMES.flatshare.rent;
  return s;
};

describe('time-of-day events', () => {
  const when = (id: string, t: LondonTime) => {
    const s = renter();
    s.stats.sausageRolls = 3;
    return EVENT_BY_ID[id].when?.(s, t) ?? true;
  };
  it('the fox only turns up at night', () => {
    expect(when('fox', T(2, 3))).toBe(true);
    expect(when('fox', T(2, 23))).toBe(true);
    expect(when('fox', T(2, 14))).toBe(false);
    expect(EVENT_BY_ID.fox.kicker).not.toMatch(/\d/);
  });
  it('parties are late, bins are Thursday mornings, Mum rings at sociable hours', () => {
    expect(when('party', T(1, 23))).toBe(true);
    expect(when('party', T(1, 10))).toBe(false);
    expect(when('bins', T(3, 8))).toBe(true);
    expect(when('bins', T(3, 15))).toBe(false);
    expect(when('bins', T(1, 8))).toBe(false);
    expect(when('mumcall', T(0, 3))).toBe(false);
    expect(when('mumcall', T(0, 18))).toBe(true);
    expect(when('pigeon', T(0, 2))).toBe(false);
  });
  it('says the time like a person', () => {
    expect(clockWords({ hh: 3, mm: 2 })).toBe('3am');
    expect(clockWords({ hh: 0, mm: 0 })).toBe('midnight');
    expect(clockWords({ hh: 23, mm: 30 })).toBe('half 11');
    expect(clockWords({ hh: 22, mm: 15 })).toBe('quarter past 10pm');
    expect(clockWords({ hh: 23, mm: 50 })).toBe('quarter to midnight');
  });
  it('the party text names the actual night', () => {
    const txt = EVENT_BY_ID.party.text(renter());
    expect(txt).toMatch(/Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/);
  });
});

describe('Jobcentre opening hours', () => {
  const s = newSave('Test', randomAvatar());
  const a = (id: string) => ACTIONS.find((x) => x.id === id)!;
  it('is open weekdays 9 to 5 only', () => {
    expect(placeOpen('jobcentre', T(0, 10))).toBe(true);
    expect(placeOpen('jobcentre', T(0, 8))).toBe(false);
    expect(placeOpen('jobcentre', T(4, 17))).toBe(false);
    expect(placeOpen('jobcentre', T(5, 12))).toBe(false);
    expect(PLACE_HOURS.jobcentre.label).toMatch(/9am/);
  });
  it('blocks the counter when shut, but the window board and online claim still work', () => {
    expect(blockReason(s, a('ticket'), ctx(T(6, 12)))).toMatch(/Shut/);
    expect(blockReason(s, a('ticket'), ctx(T(1, 12)))).toBeNull();
    expect(blockReason(s, a('jobboard'), ctx(T(6, 22)))).toBeNull();
    expect(blockReason(s, a('ucclaim'), ctx(T(6, 22)))).toBeNull();
  });
});

describe('coming back after days away', () => {
  it('replays missed days gently: meter floors at 0, damp grows slower, then today runs normally', () => {
    const s = renter();
    s.meter = 6;
    s.damp = 0;
    const today = london().dateKey;
    s.lastDailyKey = addDays(today, -10);
    const out: GameEvent[] = [];
    runDailies(s, out, today);
    expect(s.lastDailyKey).toBe(today);
    // 9 missed days drained it to 0 without touching emergency credit; today dips into it
    expect(s.meter).toBeLessThan(0);
    expect(s.meter).toBeGreaterThan(-EMERGENCY_CREDIT);
    expect(out.filter((e) => e.type === 'phone' && /away/.test(e.text)).length).toBe(1);
    // one live day of damp on a busy flat vs 10 days: proportionate, not 10x
    const live = renter();
    dailyHooks.forEach((fn) => fn(live, [], today, false));
    expect(s.damp).toBeGreaterThan(live.damp * 5);
    expect(s.damp).toBeLessThan(live.damp * 10);
  });
  it('caps how many days get replayed', () => {
    const s = renter();
    s.meter = 1000;
    const today = london().dateKey;
    s.lastDailyKey = addDays(today, -200);
    let calls = 0;
    const spy = () => {
      calls++;
    };
    dailyHooks.push(spy);
    runDailies(s, [], today);
    dailyHooks.splice(dailyHooks.indexOf(spy), 1);
    expect(calls).toBe(MAX_MISSED_DAYS + 1);
  });
  it('a missed work-coach appointment is one sanction, not one a day', () => {
    const s = renter();
    const today = london().dateKey;
    s.uc = { claiming: true, appt: addDays(today, -6), attended: false, searches: 0, weekEarned: 0, sanctioned: false };
    s.lastDailyKey = addDays(today, -7);
    const out: GameEvent[] = [];
    runDailies(s, out, today);
    expect(out.filter((e) => e.type === 'phone' && /missed your work coach/.test(e.text)).length).toBe(1);
  });
});

describe('first-session guide', () => {
  it('walks a new player through three goals, then finishes once', () => {
    const s = newSave('New', randomAvatar());
    expect(guideStep(s)).toBe(0);
    expect(GUIDE_STEPS[0].place(s)).toBe('crumbs');
    s.goals.sausage = true;
    expect(guideStep(s)).toBe(1);
    s.goals.job = true;
    s.job = 'rider';
    expect(GUIDE_STEPS[guideStep(s)].place(s)).toBe('pfc');
    s.goals.shift = true;
    expect(guideFinished(s)).toBe(true);
    expect(guideFinished(s)).toBe(false);
    expect(guideStep(s)).toBe(-1);
  });
  it('can be skipped, and older saves never see it', () => {
    const s = newSave('New', randomAvatar());
    skipGuide(s);
    expect(guideStep(s)).toBe(-1);
    const old = JSON.parse(JSON.stringify(newSave('Old', randomAvatar())));
    delete old.flags.guide;
    expect(guideStep(migrate(old)!)).toBe(-1);
    const fresh = migrate(JSON.parse(JSON.stringify(newSave('Fresh', randomAvatar()))))!;
    expect(guideStep(fresh)).toBe(0);
  });
});

describe('characters', () => {
  it('old avatars migrate (no beard field, unknown styles)', () => {
    const a = sanitizeAvatar({ skin: '#e8b58f', hair: 'quiff', hairColor: '#1b1b1b', outfit: 'hoodie', outfitColor: '#2d5bd1', accessory: 'cap' });
    expect(a.beard).toBe('none');
    expect(a.hair).toBe('short');
    expect(a.accessory).toBe('cap');
    const raw = JSON.parse(JSON.stringify(newSave('Old', randomAvatar())));
    delete raw.avatar.beard;
    raw.avatar.outfit = 'onesie';
    const s = migrate(raw)!;
    expect(s.avatar.beard).toBe('none');
    expect(OUTFITS).toContain(s.avatar.outfit);
  });
  it('random looks are always valid and names map to the same face every time', () => {
    for (let i = 0; i < 200; i++) {
      const a = randomAvatar();
      expect(sanitizeAvatar(a)).toEqual(a);
      expect(HAIRS).toContain(a.hair);
      expect(ACCESSORIES).toContain(a.accessory);
    }
    expect(avatarForName('Priya')).toEqual(avatarForName('Priya'));
    expect(avatarForName('Priya')).not.toEqual(avatarForName('Big Tel'));
  });
  it('picks walk, idle, blink and phone frames', () => {
    const a = avatarForName('Kev');
    const walk = new Set<number>();
    for (let t = 0; t < 1; t += 0.01) walk.add(frameFor(a, { facing: 'down', moving: true, t }));
    expect([...walk].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const idle = new Set<number>();
    for (let t = 0; t < 8; t += 0.03) idle.add(frameFor(a, { facing: 'down', moving: false, t }));
    expect(idle.has(BLINK)).toBe(true);
    expect([IDLE0, IDLE0 + 1, IDLE0 + 2, IDLE0 + 3].every((f) => idle.has(f))).toBe(true);
    expect(frameFor(a, { facing: 'down', moving: false, t: 1.9, phone: true })).toBeOneOf([PHONE, BLINK]);
  });
});

describe('shared world days', () => {
  it('are the same for everyone and swappable', () => {
    const f = new LocalWorldFeed();
    expect(f.day('2026-07-14')).toEqual(new LocalWorldFeed().day('2026-07-14'));
    let strikes = 0;
    let heat = 0;
    for (let i = 0; i < 365; i++) {
      const d = f.day(addDays('2026-01-01', i));
      strikes += +d.strike;
      heat += +d.heatwave;
      if (d.heatwave) expect(Number(addDays('2026-01-01', i).slice(5, 7))).toBeGreaterThanOrEqual(5);
    }
    expect(strikes).toBeGreaterThan(10);
    expect(strikes).toBeLessThan(50);
    expect(heat).toBeGreaterThan(5);
    const fake = { name: 'test', day: () => ({ strike: true, heatwave: false }) };
    setWorldFeed(fake);
    expect(worldFeed().day('2026-01-01').strike).toBe(true);
    setWorldFeed(f);
  });
});
