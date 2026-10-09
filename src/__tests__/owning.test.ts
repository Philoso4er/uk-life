import { describe, expect, it } from 'vitest';
import { ACTIONS, blockReason, completeAction, type ActionCtx } from '../game/actions';
import { migrate, newSave, weeklyHooks, type GameEvent } from '../game/economy';
import { EVENT_BY_ID, resolveChoice } from '../game/events';
import { effectiveMood } from '../game/needs';
import { BTL_DEPOSIT, BTL_FEE, BTL_MORTGAGE, BTL_RENT, CROP_BY_ID, MAX_STOCK, STATUS_ITEMS, buyStatus, btlWeek, cropLeft, flogitTick } from '../game/owning';
import { randomAvatar } from '../game/avatar';
import { london } from '../game/time';

const fresh = () => newSave('Test', randomAvatar());
const ctx = (): ActionCtx => ({ raining: false, regulars: 3, t: london() });
const act = (id: string) => ACTIONS.find((a) => a.id === id)!;
const doIt = (s: ReturnType<typeof fresh>, id: string, out: GameEvent[] = []) => completeAction(s, act(id), ctx(), out);

describe('allotment', () => {
  it('Nan gets you a plot; you plant, wait, harvest and cook', () => {
    const s = fresh();
    s.money = 50;
    expect(blockReason(s, act('plotask'), ctx())).toMatch(/Nan/);
    doIt(s, 'nan');
    s.cooldowns = {};
    const second = doIt(s, 'nan');
    expect(second.text).toMatch(/Maureen/);
    doIt(s, 'plotask');
    expect(s.owned.allotment).toEqual({ planted: 0, crop: '' });
    doIt(s, 'plant_radish');
    expect(cropLeft(s)).toBeGreaterThan(0);
    expect(act('harvest').hidden!(s, ctx())).toBe(true);
    s.owned.allotment!.planted -= CROP_BY_ID.radish.grow * 60000;
    expect(act('harvest').hidden!(s, ctx())).toBe(false);
    doIt(s, 'harvest');
    expect(s.inv.veg).toBeGreaterThanOrEqual(1);
    expect(s.owned.allotment!.crop).toBe('');
    s.inv.veg = 2;
    s.hunger = 20;
    doIt(s, 'stew');
    expect(s.inv.veg).toBe(0);
    expect(s.hunger).toBeGreaterThan(50);
  });
  it('watering speeds things up', () => {
    const s = fresh();
    s.owned.allotment = { planted: Date.now(), crop: 'spuds' };
    const before = cropLeft(s);
    doIt(s, 'water');
    expect(before - cropLeft(s)).toBeGreaterThan(10 * 60000);
  });
  it('the plot costs £3 a week and is lost if you can’t pay', () => {
    const s = fresh();
    s.owned.allotment = { planted: 0, crop: '' };
    s.money = 10;
    weeklyHooks.forEach((fn) => fn(s, []));
    expect(s.money).toBe(7);
    s.money = 1;
    weeklyHooks.forEach((fn) => fn(s, []));
    expect(s.owned.allotment).toBeNull();
  });
});

describe('Flogit hustle', () => {
  it('rummage, list, sell; stock is capped', () => {
    const s = fresh();
    s.money = 100;
    for (let i = 0; i < MAX_STOCK; i++) {
      doIt(s, 'rummage');
      s.cooldowns = {};
    }
    expect(s.owned.hustle!.stock).toHaveLength(MAX_STOCK);
    expect(blockReason(s, act('rummage'), ctx())).toMatch(/full/);
    doIt(s, 'flogit');
    expect(s.owned.hustle!.listings).toHaveLength(MAX_STOCK);
    const before = s.money;
    const out: GameEvent[] = [];
    const later = Date.now() + 3600_000;
    for (let i = 0; i < 20 && s.owned.hustle!.listings.length; i++) {
      flogitTick(s, out, later);
      if (s.flags.lowballOpen) resolveChoice(s, EVENT_BY_ID.lowball, 0, out); // take the lowball
    }
    expect(s.owned.hustle!.listings).toHaveLength(0);
    expect(s.money).toBeGreaterThan(before);
    expect(s.uc.weekEarned).toBeGreaterThan(0);
  });
});

describe('buy-to-let', () => {
  it('buying costs the deposit; the weekly statement nets rent minus fees, mortgage and repairs', () => {
    const s = fresh();
    s.money = BTL_DEPOSIT + 100;
    doIt(s, 'btlbuy');
    expect(s.owned.btl).toBe(1);
    expect(s.money).toBe(100);
    const out: GameEvent[] = [];
    btlWeek(s, out);
    const msg = out.find((e) => e.type === 'phone');
    expect(msg && msg.type === 'phone' && msg.lines?.length).toBeGreaterThanOrEqual(3);
    const best = BTL_RENT * (1 - BTL_FEE) - BTL_MORTGAGE;
    expect(s.money - 100).toBeLessThanOrEqual(best + 0.01);
    expect(effectiveMood(s)).toBeGreaterThan(0);
  });
});

describe('status items', () => {
  it('buying adds the item, a moodlet and unlocks its action', () => {
    const s = fresh();
    s.money = 100;
    expect(act('airfry').hidden!(s, ctx())).toBe(true);
    const out: GameEvent[] = [];
    expect(buyStatus(s, 'airfryer', out)).toBeNull();
    expect(s.money).toBe(40);
    expect(act('airfry').hidden!(s, ctx())).toBe(false);
    expect(buyStatus(s, 'airfryer', out)).toMatch(/Already/);
    expect(buyStatus(s, 'peloton', out)).toMatch(/declined/);
    expect(STATUS_ITEMS.every((i) => i.price > 0)).toBe(true);
  });
});

describe('save migration (phase 3)', () => {
  it('repairs a malformed hustle/allotment and keeps the rest', () => {
    const s = fresh();
    const raw = JSON.parse(JSON.stringify(s));
    raw.owned.hustle = { kind: 'old', stock: 3, lastPayKey: '' };
    raw.owned.allotment = { planted: 'yesterday', crop: 7 };
    delete raw.inv.veg;
    raw.money = 123;
    const m = migrate(raw)!;
    expect(m.owned.hustle).toBeNull();
    expect(m.owned.allotment).toBeNull();
    expect(m.inv.veg).toBe(0);
    expect(m.money).toBe(123);
  });
});
