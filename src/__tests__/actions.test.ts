import { describe, expect, it } from 'vitest';
import { ACTIONS, actionsFor, blockReason, completeAction, secsFor, type ActionCtx } from '../game/actions';
import { newSave, type GameEvent } from '../game/economy';
import { MOODLETS } from '../game/needs';
import { randomAvatar } from '../game/avatar';
import { london } from '../game/time';
import { places } from '../game/world';

const fresh = () => newSave('Test', randomAvatar());
const at = (utc: number): ActionCtx => ({ raining: false, regulars: 3, t: london(utc) });
const TUE_1930 = Date.UTC(2026, 6, 14, 18, 30); // BST
const WED_2300 = Date.UTC(2026, 6, 15, 22, 0);
const WED_1100 = Date.UTC(2026, 6, 15, 10, 0);

describe('timed actions', () => {
  it('every action lives somewhere real and lasts 4–40 seconds', () => {
    const ids = new Set(places.map((p) => p.id).concat('home'));
    for (const a of ACTIONS) {
      for (const p of [a.place].flat()) expect(ids.has(p), `${a.id} @ ${p}`).toBe(true);
      expect(secsFor(a)).toBeGreaterThanOrEqual(4);
      expect(secsFor(a)).toBeLessThanOrEqual(40);
      if (a.moodlet) expect(MOODLETS[a.moodlet], a.moodlet).toBeTruthy();
    }
  });
  it('every proper building and spot has something to do', () => {
    for (const p of places) {
      if (p.kind === 'decor' && p.id.startsWith('terrace') === false && !['laundry', 'charity', 'library', 'pawn'].includes(p.id)) continue;
      expect(actionsFor(p.id, p.kind).length, p.id).toBeGreaterThan(0);
    }
    for (const id of ['pub', 'library', 'pond', 'laundry', 'crumbs', 'kwik', 'gym', 'bookies', 'jobcentre', 'busstop', 'broadway']) expect(actionsFor(id, '').length, id).toBeGreaterThanOrEqual(2);
  });
  it('a sausage roll costs money, fills you up and ticks the goal', () => {
    const s = fresh();
    s.hunger = 30;
    const a = ACTIONS.find((x) => x.id === 'sroll')!;
    const out: GameEvent[] = [];
    const o = completeAction(s, a, at(WED_1100), out);
    expect(s.money).toBeCloseTo(120 - 1.35);
    expect(s.hunger).toBeGreaterThan(45);
    expect(s.goals.sausage).toBe(true);
    expect(o.deltas.find((d) => d.money)?.v).toBeCloseTo(-1.35);
    expect(o.text.length).toBeGreaterThan(5);
  });
  it('respects opening hours, cooldowns and an empty wallet', () => {
    const s = fresh();
    const read = ACTIONS.find((x) => x.id === 'read')!;
    expect(blockReason(s, read, at(WED_2300), WED_2300)).toMatch(/Open/);
    expect(blockReason(s, read, at(WED_1100), WED_1100)).toBeNull();
    const ducks = ACTIONS.find((x) => x.id === 'donate')!;
    completeAction(s, ducks, at(WED_1100), []);
    expect(blockReason(s, ducks, at(WED_1100))).toMatch(/recently/);
    s.money = 0.5;
    expect(blockReason(s, ACTIONS.find((x) => x.id === 'pint')!, at(WED_1100), 0)).toMatch(/declined/);
  });
  it('the pub quiz is a Tuesday-night thing', () => {
    const s = fresh();
    const quiz = ACTIONS.find((x) => x.id === 'quiz')!;
    expect(blockReason(s, quiz, at(WED_1100), WED_1100)).not.toBeNull();
    expect(blockReason(s, quiz, at(TUE_1930), TUE_1930)).toBeNull();
  });
  it('the bookies turns you away when you are skint', () => {
    const s = fresh();
    s.money = 15;
    const horse = ACTIONS.find((x) => x.id === 'horse')!;
    expect(blockReason(s, horse, at(WED_1100), WED_1100)).not.toBeNull();
  });
});
