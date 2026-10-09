import { describe, expect, it } from 'vitest';
import { ACTIONS, completeAction, blockReason, type ActionCtx } from '../game/actions';
import { HOMES, LEVEL_XP, dailyHooks, newSave, processBills, weeklyHooks, type GameEvent } from '../game/economy';
import { EMERGENCY_CREDIT, EVENTS, EVENT_BY_ID, REVIEW, SHIFT_CARDS, UC_BASE, hasPower, nextWeekday, resolveChoice, rollEvent, shiftXp, ucAward, ucFns } from '../game/events';
import { MOODLETS } from '../game/needs';
import { randomAvatar } from '../game/avatar';
import { london, rentKey } from '../game/time';

const fresh = () => newSave('Test', randomAvatar());
const ctx = (): ActionCtx => ({ raining: false, regulars: 3, t: london() });
const act = (id: string) => ACTIONS.find((a) => a.id === id)!;
const renter = () => {
  const s = fresh();
  s.home = 'flatshare';
  s.rent = HOMES.flatshare.rent;
  return s;
};

describe('event cards', () => {
  it('every card has choices that resolve to text and valid moodlets', () => {
    for (const e of Object.values(EVENT_BY_ID)) {
      expect(e.choices.length, e.id).toBeGreaterThan(0);
      e.choices.forEach((_c, i) => {
        const s = renter();
        s.money = 500;
        s.job = 'barista';
        const out: GameEvent[] = [];
        const r = resolveChoice(s, e, i, out);
        expect(r.text.length, `${e.id}#${i}`).toBeGreaterThan(5);
        for (const x of out) if (x.type === 'moodlet') expect(MOODLETS[x.id], x.id).toBeTruthy();
        expect(Number.isFinite(s.money)).toBe(true);
      });
    }
  });
  it('the deck respects conditions and cooldowns', () => {
    const s = fresh(); // on the sofa: no renter-only cards
    for (let i = 0; i < 200; i++) {
      const e = rollEvent(s);
      if (e) expect(['tvlicence', 'boiler', 'counciltax', 'inspection', 'damp'].includes(e.id), e.id).toBe(false);
    }
    for (const e of EVENTS) s.eventLog[e.id] = Date.now();
    expect(rollEvent(s)).toBeNull();
  });
  it('blocked choices do nothing', () => {
    const s = renter();
    s.money = 0;
    const tv = EVENT_BY_ID.tvlicence;
    const r = resolveChoice(s, tv, 0, []);
    expect(r.tone).toBe('bad');
    expect(s.money).toBe(0);
    expect(s.flags.tvLicence).toBeFalsy();
  });
  it('council tax discount knocks 25% off the bill', () => {
    const s = renter();
    s.money = 1000;
    resolveChoice(s, EVENT_BY_ID.counciltax, 0, []);
    const MON_0859 = Date.UTC(2026, 6, 13, 7, 59);
    s.lastBillKey = rentKey(MON_0859);
    processBills(s, [], MON_0859 + 60_000);
    expect(s.money).toBeCloseTo(1000 - 165 - 21 * 0.75, 2);
  });
  it('mid-shift cards change pay through the mods', () => {
    for (const cards of Object.values(SHIFT_CARDS)) expect(cards.length).toBeGreaterThanOrEqual(2);
    const s = fresh();
    s.money = 50;
    const mods = { bonus: 0, mult: 1 };
    resolveChoice(s, EVENT_BY_ID.st_cake, 1, [], mods);
    expect(mods.mult).toBeCloseTo(1.1);
  });
});

describe('careers', () => {
  it('shifts earn XP and trigger exactly one review', () => {
    const s = fresh();
    s.job = 'temp';
    s.jobLevel = 1;
    const out: GameEvent[] = [];
    for (let i = 0; i < 5; i++) shiftXp(s, 1, out);
    expect(s.jobXp).toBeGreaterThanOrEqual(LEVEL_XP[1]);
    expect(out.filter((e) => e.type === 'card')).toHaveLength(1);
    const r = resolveChoice(s, REVIEW, 0, out);
    expect(s.jobLevel).toBe(2);
    expect(r.text).toMatch(/now/);
    expect(s.goals.promo).toBe(true);
  });
  it('turning a review down resets the flag so it can come again', () => {
    const s = fresh();
    s.job = 'barista';
    s.jobXp = LEVEL_XP[1];
    s.flags.reviewPending = true;
    resolveChoice(s, REVIEW, 2, []);
    expect(s.jobLevel).toBe(1);
    expect(s.flags.reviewPending).toBe(false);
  });
});

describe('prepayment meter and damp', () => {
  it('drains daily, dips into emergency credit, then cuts off', () => {
    const s = renter();
    s.meter = 4;
    const out: GameEvent[] = [];
    let k = '2026-01-05';
    for (let i = 0; i < 6; i++) {
      dailyHooks.forEach((fn) => fn(s, out, k));
      k = nextWeekday(k, 1);
    }
    expect(s.meter).toBe(-EMERGENCY_CREDIT);
    expect(hasPower(s)).toBe(false);
    expect(out.some((e) => e.type === 'card' && e.id === 'meterlow')).toBe(true);
    s.inv.teabags = 5;
    expect(blockReason(s, act('cuppa'), ctx())).toMatch(/meter/);
    // top up pays back the emergency credit first
    s.money = 50;
    completeAction(s, act('meter10'), ctx(), []);
    expect(s.meter).toBe(5);
    expect(hasPower(s)).toBe(true);
  });
  it('damp creeps up, bleach knocks it back, the sofa is immune', () => {
    const s = renter();
    const sofa = fresh();
    for (let i = 0; i < 6; i++) {
      dailyHooks.forEach((fn) => fn(s, [], '2026-02-0' + (i + 1)));
      dailyHooks.forEach((fn) => fn(sofa, [], '2026-02-0' + (i + 1)));
    }
    expect(s.damp).toBeGreaterThan(30);
    expect(sofa.damp).toBe(0);
    s.money = 10;
    const before = s.damp;
    completeAction(s, act('bleach'), ctx(), []);
    expect(s.damp).toBe(Math.max(0, before - 35));
  });
  it('heating costs meter credit and warms you up', () => {
    const s = renter();
    s.meter = 3;
    s.warmth = 20;
    completeAction(s, act('heating'), ctx(), []);
    expect(s.meter).toBeCloseTo(1.8);
    expect(s.warmth).toBeGreaterThan(50);
    expect(s.moodlets.some((m) => m.id === 'toasty')).toBe(true);
  });
});

describe('Universal Credit-ish', () => {
  it('the taper takes 55p of each £1 over the work allowance', () => {
    const s = fresh();
    ucFns.claim(s);
    expect(ucAward(s).total).toBe(UC_BASE);
    s.uc.weekEarned = 200;
    expect(ucAward(s).total).toBeCloseTo(UC_BASE - 55, 2);
    s.uc.weekEarned = 10_000;
    expect(ucAward(s).total).toBe(0);
    const r = renter();
    ucFns.claim(r);
    expect(ucAward(r).housing).toBe(Math.round(165 / 2));
  });
  it('pays weekly, warns then sanctions for missed job searches', () => {
    const s = fresh();
    s.money = 0;
    ucFns.claim(s);
    const out: GameEvent[] = [];
    weeklyHooks.forEach((fn) => fn(s, out));
    expect(s.money).toBe(UC_BASE); // first miss: warning only
    expect(s.flags.ucWarned).toBe(true);
    weeklyHooks.forEach((fn) => fn(s, out));
    expect(s.money).toBe(UC_BASE + UC_BASE / 2); // second miss: 50% sanction
    s.uc.searches = 2;
    weeklyHooks.forEach((fn) => fn(s, out));
    expect(s.money).toBe(UC_BASE * 2.5);
    expect(s.flags.ucWarned).toBe(false);
  });
  it('missing the work coach appointment sanctions you and books another', () => {
    const s = fresh();
    ucFns.claim(s);
    const appt = s.uc.appt;
    const out: GameEvent[] = [];
    dailyHooks.forEach((fn) => fn(s, out, nextWeekday(appt, 1)));
    expect(s.uc.sanctioned).toBe(true);
    expect(s.uc.appt > appt).toBe(true);
    expect(out.some((e) => e.type === 'phone' && /missed/.test(e.text))).toBe(true);
  });
  it('the job board counts as a search', () => {
    const s = fresh();
    ucFns.claim(s);
    completeAction(s, act('jobboard'), ctx(), []);
    expect(s.uc.searches).toBe(1);
  });
  it('appointments skip weekends', () => {
    expect(nextWeekday('2026-10-09', 1)).toBe('2026-10-12'); // Fri -> Mon
  });
});
