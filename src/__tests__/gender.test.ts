import { afterEach, describe, expect, it, vi } from 'vitest';
import { GENDER_DEFAULTS, avatarForName, randomAvatar, rng, sanitizeAvatar, withGender, HAIRS, OUTFITS, BEARDS } from '../game/avatar';
import { BOT_NAMES, NPC_GENDER, npcAvatar } from '../game/bots';
import { migrate, newSave } from '../game/economy';
import { EVENT_BY_ID } from '../game/events';
import { NpcBrain } from '../game/npcs';
import { aboutPerson, defaultPronouns, pronounText, pronounsOf } from '../game/pronouns';
import { SocialStore } from '../game/social';
import type { Avatar } from '../game/types';

const base: Avatar = { skin: '#c98e62', hair: 'short', hairColor: '#1b1b1b', outfit: 'hoodie', outfitColor: '#2d5bd1', accessory: 'none', beard: 'none' };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('pronoun text', () => {
  const line = '{me} got promoted! Drinks are on {them} ({they} {doesnt} know). {They} {has} earned it, {theyre} chuffed with {themself}. {Their} round. {they} grow{s} marrows.';
  it('he/him', () => {
    expect(pronounText(line, 'he', 'Kez')).toBe('Kez got promoted! Drinks are on him (he doesn’t know). He has earned it, he’s chuffed with himself. His round. he grows marrows.');
  });
  it('she/her', () => {
    expect(pronounText(line, 'she', 'Kez')).toBe('Kez got promoted! Drinks are on her (she doesn’t know). She has earned it, she’s chuffed with herself. Her round. she grows marrows.');
  });
  it('they/them (plural verb agreement)', () => {
    expect(pronounText(line, 'they', 'Kez')).toBe('Kez got promoted! Drinks are on them (they don’t know). They have earned it, they’re chuffed with themself. Their round. they grow marrows.');
  });
  it('leaves unknown tokens alone and replaces every {me}', () => {
    expect(pronounText('{me} and {me} {nope}', 'they', 'Mo')).toBe('Mo and Mo {nope}');
  });
  it('defaults follow gender, and Other defaults to they/them', () => {
    expect(defaultPronouns('male')).toBe('he');
    expect(defaultPronouns('female')).toBe('she');
    expect(defaultPronouns('other')).toBe('they');
    expect(defaultPronouns(undefined)).toBe('they');
    // chosen pronouns win over the gender default
    expect(pronounsOf({ gender: 'male', pronouns: 'they' })).toBe('they');
    expect(pronounsOf({ gender: 'female' })).toBe('she');
  });
});

describe('gender + pronoun save migration', () => {
  it('old saves become Other + they/them, never guessed from the name', () => {
    for (const name of ['Dave', 'Chantelle', 'Big Kev', 'Siobhan']) {
      const raw = JSON.parse(JSON.stringify({ ...newSave(name, base), avatar: { ...base, beard: 'beard' } }));
      delete raw.avatar.gender;
      delete raw.avatar.pronouns;
      const s = migrate(raw)!;
      expect(s.avatar.gender).toBe('other');
      expect(s.avatar.pronouns).toBe('they');
      expect(s.flags.identityPrompt).toBe(true);
      // the rest of the look survives
      expect(s.avatar.beard).toBe('beard');
    }
  });
  it('v1 saves migrate too', () => {
    const s = migrate({ version: 1, name: 'Old', avatar: { skin: '#c98e62', hair: 'bun', hairColor: '#1b1b1b', outfit: 'suit', outfitColor: '#222831', accessory: 'none' }, money: 50, minutes: 0 })!;
    expect(s.avatar.gender).toBe('other');
    expect(s.avatar.pronouns).toBe('they');
  });
  it('keeps a chosen gender and pronouns, with no nudge', () => {
    const s = migrate(JSON.parse(JSON.stringify(newSave('Kez', { ...base, gender: 'female', pronouns: 'they' }))))!;
    expect(s.avatar.gender).toBe('female');
    expect(s.avatar.pronouns).toBe('they');
    expect(s.flags.identityPrompt).toBeUndefined();
  });
  it('sanitises junk values from saves or the network', () => {
    const a = sanitizeAvatar({ ...base, gender: 'robot', pronouns: 'xe' });
    expect(a.gender).toBe('other');
    expect(a.pronouns).toBe('they');
    expect(sanitizeAvatar({ ...base, gender: 'male' }).pronouns).toBe('he');
  });
});

describe('creator choices', () => {
  it('switching gender sets pronouns and sensible defaults', () => {
    const m = withGender({ ...base, outfit: 'dress' }, 'male');
    expect(m).toMatchObject({ gender: 'male', pronouns: 'he', ...GENDER_DEFAULTS.male, outfit: 'hoodie' });
    const f = withGender(m, 'female');
    expect(f).toMatchObject({ gender: 'female', pronouns: 'she', hair: 'long', beard: 'none' });
    const o = withGender(f, 'other');
    expect(o).toMatchObject({ gender: 'other', pronouns: 'they' });
  });
  it('any style is valid with any gender', () => {
    for (const gender of ['male', 'female', 'other'] as const)
      for (const hair of HAIRS)
        for (const outfit of OUTFITS)
          for (const beard of BEARDS) {
            const a = sanitizeAvatar({ ...base, gender, hair, outfit, beard });
            expect(a).toMatchObject({ gender, hair, outfit, beard });
          }
  });
});

describe('who lives in Peckwell', () => {
  it('random passers-by are a deterministic mix of men, women and non-binary people', () => {
    const r = rng(42);
    const looks = Array.from({ length: 600 }, () => randomAvatar(r));
    const n = (g: string) => looks.filter((a) => a.gender === g).length;
    expect(n('male')).toBeGreaterThan(200);
    expect(n('female')).toBeGreaterThan(200);
    expect(n('other')).toBeGreaterThan(40);
    // pronouns match by default; no random dresses on men or beards on women
    for (const a of looks) expect(a.pronouns).toBe(defaultPronouns(a.gender));
    expect(looks.some((a) => a.gender === 'male' && a.outfit === 'dress')).toBe(false);
    expect(looks.some((a) => a.gender === 'female' && a.beard !== 'none')).toBe(false);
    expect(looks.filter((a) => a.gender === 'male' && a.beard !== 'none').length).toBeGreaterThan(80);
    // same seed, same crowd
    const again = Array.from({ length: 600 }, (() => { const r2 = rng(42); return () => randomAvatar(r2); })());
    expect(again).toEqual(looks);
  });
  it('named locals have a fixed gender, pronouns and look', () => {
    const genders = BOT_NAMES.map((n) => npcAvatar(n).gender);
    expect(genders.filter((g) => g === 'male').length).toBeGreaterThanOrEqual(4);
    expect(genders.filter((g) => g === 'female').length).toBeGreaterThanOrEqual(4);
    expect(genders.filter((g) => g === 'other').length).toBeGreaterThanOrEqual(2);
    for (const n of BOT_NAMES) {
      expect(npcAvatar(n)).toEqual(npcAvatar(n));
      expect(npcAvatar(n).gender).toBe(NPC_GENDER[n]);
      expect(npcAvatar(n).pronouns).toBe(defaultPronouns(NPC_GENDER[n]));
    }
    expect(avatarForName('Priya', 'female')).toEqual(avatarForName('priya', 'female'));
  });
});

describe('the game uses your pronouns', () => {
  const me = { id: 'me1', name: 'Kez', avatar: base };
  const gossipFor = (pronouns: 'he' | 'she' | 'they') => {
    vi.useFakeTimers();
    const s = new SocialStore('test.' + Math.random(), me);
    const save = newSave('Kez', { ...base, gender: 'other', pronouns });
    const b = new NpcBrain(s, save);
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    b.gossip('promo');
    vi.setSystemTime(Date.now() + 60_000);
    b.tick({ raining: false, hh: 12, dayIdx: 2, flags: {} });
    return s.getSnapshot().posts.find((p) => p.text.includes('Kez'))!.text;
  };
  it('in Natter gossip', () => {
    expect(gossipFor('he')).toBe('Heard Kez got promoted! Drinks are on him (he doesn’t know this yet).');
    expect(gossipFor('she')).toBe('Heard Kez got promoted! Drinks are on her (she doesn’t know this yet).');
    expect(gossipFor('they')).toBe('Heard Kez got promoted! Drinks are on them (they don’t know this yet).');
  });
  it('in event text', () => {
    const s = newSave('Kez', { ...base, gender: 'male', pronouns: 'he' });
    s.money = 100;
    const out = EVENT_BY_ID.birthday.choices[0].apply(s, [], undefined as never);
    const text = typeof out === 'string' ? out : out.text;
    expect(text).toContain('I like him, he’s lovely');
  });
  it('no gossip line is left with raw tokens', () => {
    for (const p of ['he', 'she', 'they'] as const) {
      const t = aboutPerson('{me} has “treated {themself}”. {They} {isnt} sorry.', { pronouns: p }, 'Kez');
      expect(t).not.toMatch(/[{}]/);
    }
  });
});
