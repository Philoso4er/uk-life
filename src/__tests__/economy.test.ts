import { describe, expect, it } from 'vitest';
import { DAY, WEEK, billWeek, clock, newSave, processBills, sleep, tick, HOMES, applyItem, SHOPS, type GameEvent } from '../game/economy';
import { randomAvatar } from '../game/avatar';

const fresh = () => newSave('Test', randomAvatar());

describe('economy', () => {
  it('starts Monday 08:00, week 1, on Dave\u2019s sofa', () => {
    const s = fresh();
    expect(clock(s.minutes).label).toBe('Mon 08:00');
    expect(s.home).toBe('sofa');
  });
  it('bills rent + council tax at Monday 09:00 of the next week', () => {
    const s = fresh();
    s.home = 'flatshare';
    s.rent = HOMES.flatshare.rent;
    s.money = 1000;
    const out: GameEvent[] = [];
    s.minutes = WEEK + 8 * 60;
    processBills(s, 0, out);
    expect(out).toHaveLength(0); // 08:00, not yet
    s.minutes = WEEK + 9 * 60 + 1;
    processBills(s, 0, out);
    expect(s.money).toBe(1000 - 165 - 21);
    expect(out.some((e) => e.type === 'phone')).toBe(true);
    expect(s.goals.rentday).toBe(true);
    // not billed twice in the same week
    processBills(s, 0, out);
    expect(s.money).toBe(1000 - 165 - 21);
  });
  it('arrears then eviction back to the sofa', () => {
    const s = fresh();
    s.home = 'studio';
    s.rent = 295;
    s.money = 10;
    const out: GameEvent[] = [];
    billWeek(s, out);
    expect(s.arrears).toBe(1);
    billWeek(s, out);
    expect(s.home).toBe('sofa');
  });
  it('sleep wakes you at 07:00 the next day', () => {
    const s = fresh();
    s.minutes = 23 * 60;
    sleep(s, []);
    expect(s.minutes).toBe(DAY + 7 * 60);
    expect(s.energy).toBeGreaterThanOrEqual(HOMES.sofa.sleepEnergy);
  });
  it('needs decay over time and rain hurts without a brolly', () => {
    const a = fresh();
    const b = fresh();
    b.umbrellaUntil = b.minutes + DAY;
    tick(a, 120, { raining: true, inPark: false, onShift: false }, []);
    tick(b, 120, { raining: true, inPark: false, onShift: false }, []);
    expect(a.hunger).toBeLessThan(60);
    expect(a.mood).toBeLessThan(b.mood);
  });
  it('a sausage roll ticks the goal; no money, no roll', () => {
    const s = fresh();
    const roll = SHOPS.crumbs.items.find((i) => i.id === 'sroll')!;
    expect(applyItem(s, roll, [])).toBe(true);
    expect(s.goals.sausage).toBe(true);
    s.money = 0;
    expect(applyItem(s, roll, [])).toBe(false);
  });
});
