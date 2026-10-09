import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, fmtDuration, london, msUntilRent, rentKey } from '../game/time';

describe('real London clock', () => {
  it('handles GMT and BST', () => {
    expect(london(Date.UTC(2026, 0, 12, 9, 0)).label).toBe('Mon 09:00'); // GMT in January
    expect(london(Date.UTC(2026, 6, 13, 8, 0)).label).toBe('Mon 09:00'); // BST in July
    expect(london(Date.UTC(2026, 6, 13, 8, 0)).dateKey).toBe('2026-07-13');
  });
  it('rent key flips exactly at Monday 09:00 London', () => {
    expect(rentKey(Date.UTC(2026, 6, 13, 7, 59))).toBe('2026-07-06'); // Mon 08:59 BST: still last week
    expect(rentKey(Date.UTC(2026, 6, 13, 8, 0))).toBe('2026-07-13'); // Mon 09:00 BST
    expect(rentKey(Date.UTC(2026, 6, 19, 22, 0))).toBe('2026-07-13'); // Sunday night
    expect(rentKey(Date.UTC(2026, 2, 30, 8, 0))).toBe('2026-03-30'); // first Monday after the clocks go forward
  });
  it('counts down to the next rent day', () => {
    expect(msUntilRent(Date.UTC(2026, 6, 13, 7, 0))).toBe(60 * 60000);
    expect(msUntilRent(Date.UTC(2026, 6, 13, 8, 0))).toBe(7 * 24 * 60 * 60000);
    expect(fmtDuration(90 * 60000)).toBe('1h 30m');
    expect(fmtDuration(3 * 1440 * 60000 + 120 * 60000)).toBe('3d 2h');
  });
  it('date keys add up across month ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-10-01', '2026-10-09')).toBe(8);
  });
});
