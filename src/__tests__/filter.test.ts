import { describe, expect, it } from 'vitest';
import { cleanMessage, cleanName, MAX_CHAT } from '../net/filter';

describe('chat filter', () => {
  it('masks strong swearing, including leetspeak and stretched words', () => {
    expect(cleanMessage('what the fuck')).toBe('what the ****');
    expect(cleanMessage('sh1t happens')).toBe('**** happens');
    expect(cleanMessage('fuuuuck off')).toMatch(/^\*+ off$/);
    expect(cleanMessage('you absolute W4NKER!')).toMatch(/^you absolute \*{6,}/);
  });
  it('allows mild British banter and Scunthorpe', () => {
    expect(cleanMessage('bloody hell, you muppet')).toBe('bloody hell, you muppet');
    expect(cleanMessage('Off to Scunthorpe for a cocktail')).toBe('Off to Scunthorpe for a cocktail');
    expect(cleanMessage('Dickens is a git')).toBe('Dickens is a git');
  });
  it('removes spaced-out slurs entirely', () => {
    expect(cleanMessage('c u n t')).toMatch(/removed/);
  });
  it('enforces the length limit and strips control chars', () => {
    const long = 'a'.repeat(500);
    expect(cleanMessage(long).length).toBe(MAX_CHAT);
    expect(cleanMessage('hi\u0000\u200b there')).toBe('hi there');
    expect(cleanMessage('   ')).toBe('');
  });
  it('cleans names', () => {
    expect(cleanName('Big Dave')).toBe('Big Dave');
    expect(cleanName('fuckface')).toBe('Anon Londoner');
    expect(cleanName('x'.repeat(40)).length).toBeLessThanOrEqual(16);
  });
});
