// Who's where, and what you can do with them: locals' daily routines, relationships,
// tap-to-interact actions (wave, compliment, small talk, buy a round, invite…), favours,
// friendship streaks and lifetime wishes. Pure logic: the engine and UI call into this.
import { BOT_NAMES, NPC_GENDER, npcAvatar } from './bots';
import { avatarForName } from './avatar';
import { clamp } from './needs';
import { PERSONAS, personaAuthor } from './npcs';
import { aboutPerson, pronounText, pronounsOf, PRONOUN_LABEL } from './pronouns';
import { addDays, london, type LondonTime } from './time';
import { INTERIORS, type Staff } from './interiors';
import type { Avatar, Rel, SaveState } from './types';
import { buildingById } from './world';
import { placeOpen } from './actions';
import { handleOf, type Author } from './social';
import type { GameEvent } from './economy';

export type PersonKind = 'npc' | 'staff' | 'player';
export interface PersonRef {
  /** npc:Name, staff:Name or player:pid */
  key: string;
  kind: PersonKind;
  name: string;
  avatar: Avatar;
  /** players: per-tab network id (for addressing actions) and stable id (for DMs) */
  netId?: string;
  pid?: string;
  /** building id they're in (null = out on the street) */
  place?: string | null;
  role?: string;
  /** players: their mood (0-100) and status line */
  mood?: number;
  status?: string;
}

export const npcKey = (name: string) => 'npc:' + name;
export const staffKey = (name: string) => 'staff:' + name;
export const playerKey = (pid: string) => 'player:' + pid;

// ------------------------------------------------------------------ routines
interface Slot {
  place: string;
  from: number;
  to: number;
  /** 0 = Monday */
  days?: number[];
}
/** Where each local likes to be, by the (real London) clock. Outside these hours they're out and about. */
export const SCHEDULE: Record<string, Slot[]> = {
  'Big Tel': [{ place: 'bookies', from: 12, to: 15 }, { place: 'pub', from: 17, to: 24 }],
  'Auntie Bev': [{ place: 'laundry', from: 9, to: 11 }, { place: 'charity', from: 13, to: 15 }, { place: 'crumbs', from: 16, to: 17 }, { place: 'pub', from: 19, to: 21, days: [4, 5] }],
  Tomasz: [{ place: 'kwik', from: 7, to: 8 }, { place: 'crumbs', from: 12, to: 13 }, { place: 'pub', from: 18, to: 20 }],
  Priya: [{ place: 'pret', from: 8, to: 10 }, { place: 'synergy', from: 10, to: 16, days: [0, 1, 2, 3, 4] }, { place: 'gym', from: 18, to: 19 }],
  'Gary & dog': [{ place: 'kwik', from: 9, to: 10 }, { place: 'pub', from: 15, to: 18 }],
  'Josh (Fleecems)': [{ place: 'pret', from: 8, to: 9 }, { place: 'fleecems', from: 9, to: 18 }, { place: 'gym', from: 19, to: 20 }],
  Nan: [{ place: 'crumbs', from: 7, to: 11 }, { place: 'charity', from: 11, to: 12 }, { place: 'library', from: 13, to: 16 }],
  Kev: [{ place: 'gym', from: 6, to: 9 }, { place: 'gym', from: 17, to: 19 }, { place: 'pfc', from: 21, to: 24 }],
  Siobhan: [{ place: 'pfc', from: 7, to: 8 }, { place: 'laundry', from: 10, to: 11 }, { place: 'barber', from: 14, to: 15 }, { place: 'pub', from: 20, to: 23 }],
  Femi: [{ place: 'barber', from: 11, to: 13 }, { place: 'pub', from: 19, to: 22 }, { place: 'pfc', from: 22, to: 24 }],
  Hamza: [{ place: 'crumbs', from: 8, to: 9 }, { place: 'library', from: 10, to: 17 }, { place: 'pfc', from: 18, to: 19 }],
  'Posh Rupert': [{ place: 'pret', from: 7, to: 9 }, { place: 'pub', from: 12, to: 14 }, { place: 'gym', from: 17, to: 18 }],
};

/** Places you can invite people to. */
export const INVITE_PLACES = ['pub', 'crumbs', 'pret', 'gym', 'library'];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

/** Where a local wants to be right now (null = the street). Mostly follows the routine; some days they skip it. */
export function wantedPlace(name: string, t: LondonTime, override?: { place: string; until: number } | null, nowMs = Date.now()): string | null {
  if (override && override.until > nowMs && placeOpen(override.place, t)) return override.place;
  for (const s of SCHEDULE[name] ?? []) {
    if (s.days && !s.days.includes(t.dayIdx)) continue;
    if (t.hh < s.from || t.hh >= s.to) continue;
    if (!placeOpen(s.place, t)) continue;
    // 80% of the time they turn up (the same answer all hour, so they don't flicker in and out)
    if (hash(`${name}|${t.dateKey}|${s.place}|${t.hh}`) < 0.8) return s.place;
  }
  return null;
}

// ------------------------------------------------------------------ relationships
export type { Rel };
export const LEVELS = [
  { at: 0, name: 'Stranger', emoji: '👤' },
  { at: 8, name: 'Nodding terms', emoji: '🙂' },
  { at: 20, name: 'Acquaintance', emoji: '👋' },
  { at: 40, name: 'Mate', emoji: '🤝' },
  { at: 70, name: 'Good mate', emoji: '🍻' },
  { at: 110, name: 'Best mate', emoji: '💛' },
];
export const MATE = 3;
export function levelOf(pts: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && pts >= LEVELS[i + 1].at) i++;
  const next = LEVELS[i + 1];
  return { i, ...LEVELS[i], next: next?.at ?? null, progress: next ? (pts - LEVELS[i].at) / (next.at - LEVELS[i].at) : 1 };
}
export function relOf(s: SaveState, key: string): Rel {
  s.rel ??= {};
  return (s.rel[key] ??= { pts: 0, last: 0, streak: 0, day: '', cds: {} });
}
export const peekRel = (s: SaveState, key: string): Rel | null => s.rel?.[key] ?? null;

// ------------------------------------------------------------------ actions
export type ActKind = 'wave' | 'compliment' | 'talk' | 'drink' | 'follow' | 'invite' | 'favour';
export const ACTS: Record<ActKind, { label: string; emoji: string; cd: number; pts: number; social: number }> = {
  wave: { label: 'Wave', emoji: '👋', cd: 20, pts: 1, social: 2 },
  compliment: { label: 'Compliment', emoji: '💐', cd: 120, pts: 3, social: 4 },
  talk: { label: 'Small talk', emoji: '💬', cd: 180, pts: 5, social: 10 },
  drink: { label: 'Buy them a drink', emoji: '🍺', cd: 600, pts: 8, social: 8 },
  follow: { label: 'Follow on Natter', emoji: '➕', cd: 0, pts: 2, social: 0 },
  invite: { label: 'Invite to…', emoji: '📍', cd: 900, pts: 3, social: 2 },
  favour: { label: 'Ask a favour', emoji: '🎁', cd: 0, pts: 1, social: 4 },
};
/** What a drink costs where you are (null = nowhere to buy one here). */
export function drinkHere(place: string | null | undefined): { what: string; emoji: string; cost: number } | null {
  if (place === 'pub') return { what: 'a pint', emoji: '🍺', cost: 5.4 };
  if (place === 'crumbs') return { what: 'a cuppa', emoji: '☕', cost: 2.2 };
  if (place === 'pret') return { what: 'a flat white', emoji: '☕', cost: 3.85 };
  if (place === 'pfc') return { what: 'a can of pop', emoji: '🥤', cost: 1.2 };
  return null;
}

export const COMPLIMENTS = ['Love the trainers.', 'You’ve got great taste in pubs.', 'That jacket’s doing a lot of good work.', 'You always know the bus times. Legend.', 'Your Natter posts are elite.', 'You’ve got a very trustworthy face.'];
const COMPLIMENT_BACK = ['Stop it. (Don’t stop it.)', 'Oh! Well. Ta very much.', 'You’re only saying that. Say it again.', 'Cheers! You’re not so bad yourself.', 'Ha! Made my day, that.'];
const WAVE_BACK = ['👋', '👋 Alright?', '👋 Hiya!', '🙂', '*nods*', '👋 You alright?'];

export function cooldownLeft(s: SaveState, key: string, kind: ActKind, nowMs = Date.now()) {
  const r = peekRel(s, key);
  return Math.max(0, Math.ceil(((r?.cds[kind] ?? 0) - nowMs) / 1000));
}

/** Why you can't do this right now (null = go ahead). */
export function actBlocked(s: SaveState, who: PersonRef, kind: ActKind, here: string | null, nowMs = Date.now()): string | null {
  const left = cooldownLeft(s, who.key, kind, nowMs);
  if (left > 0) return left > 90 ? `Give it ${Math.ceil(left / 60)} min` : `Give it ${left}s`;
  if (kind === 'drink') {
    const d = drinkHere(here);
    if (!d) return 'Nowhere to get one here';
    if (who.place !== here) return 'They’re not here';
    if (s.money < d.cost) return 'You’re skint';
  }
  if (kind === 'follow' && (s.follows ?? []).includes(authorIdOf(who))) return 'Already following';
  if (kind === 'favour') {
    if (who.kind === 'player') return 'Locals only';
    if (levelOf(relOf(s, who.key).pts).i < MATE) return `Unlocks at ${LEVELS[MATE].name}`;
    if (relOf(s, who.key).fav === london().dateKey) return 'Tomorrow';
  }
  return null;
}

export interface ActResult {
  text: string;
  tone: 'good' | 'bad' | 'info';
  /** what they say back (a bubble over their head) */
  reply?: string;
  /** level reached, if this pushed them up one */
  levelUp?: string;
  events: GameEvent[];
}

/** How people refer to them in passing: "Bev"-style names keep their title ("Auntie Bev", "Big Tel"). */
export const shortName = (name: string) => name.replace(/ \(.*\)| & dog/g, '');
const r2 = (n: number) => Math.round(n * 100) / 100;
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Record an interaction: points, streak, cooldown, Social. Returns any level-up. */
export function touchRel(s: SaveState, key: string, pts: number, kind: ActKind, out: GameEvent[], name: string, nowMs = Date.now()): string | undefined {
  const r = relOf(s, key);
  const before = levelOf(r.pts).i;
  const today = london().dateKey;
  if (r.day !== today) {
    r.streak = r.day === addDays(today, -1) ? r.streak + 1 : 1;
    r.day = today;
    if (r.streak === 3 || r.streak === 7 || (r.streak > 7 && r.streak % 7 === 0)) {
      const bonus = r.streak >= 7 ? 8 : 3;
      pts += bonus;
      out.push({ type: 'toast', text: `🔥 ${r.streak}-day streak with ${name}! +${bonus} friendship`, tone: 'good' });
    }
  }
  r.pts = Math.min(999, r.pts + pts);
  r.last = nowMs;
  r.name = name;
  if (ACTS[kind].cd) r.cds[kind] = nowMs + ACTS[kind].cd * 1000;
  const after = levelOf(r.pts);
  return after.i > before ? after.name : undefined;
}

/** Do something nice to a local or a member of staff. (Players go through the network instead.) */
export function doAct(s: SaveState, who: PersonRef, kind: ActKind, here: string | null, extra: { compliment?: number; place?: string; accept?: boolean } = {}): ActResult {
  const out: GameEvent[] = [];
  const def = ACTS[kind];
  const why = actBlocked(s, who, kind, here);
  if (why) return { text: why, tone: 'bad', events: out };
  const first = shortName(who.name);
  let text = '';
  let reply: string | undefined;
  let tone: ActResult['tone'] = 'good';
  let pts = def.pts;
  s.social = clamp(s.social + def.social);
  switch (kind) {
    case 'wave':
      reply = pick(WAVE_BACK);
      text = `You wave at ${first}. ${reply}`;
      break;
    case 'compliment':
      reply = pick(COMPLIMENT_BACK);
      text = `“${COMPLIMENTS[(extra.compliment ?? 0) % COMPLIMENTS.length]}” ${first}: “${reply}”`;
      break;
    case 'talk':
      text = `You have a proper natter with ${first}.`;
      break;
    case 'drink': {
      const d = drinkHere(here)!;
      s.money = r2(s.money - d.cost);
      reply = who.kind === 'staff' ? 'For me? Go on then, I’ll have it after my shift.' : pick(['Oh go on then! Cheers!', 'You’re a diamond. Next one’s on me. (It won’t be.)', 'Lovely! Sit down, sit down.', 'Ooh, ta! Didn’t have to do that.']);
      text = `You get ${first} ${d.what} (${d.emoji} £${d.cost.toFixed(2)}). “${reply}”`;
      break;
    }
    case 'follow':
      s.follows = [...(s.follows ?? []), authorIdOf(who)];
      reply = 'Followed back 🙌';
      text = `You followed ${who.name} on Natter. They followed you back.`;
      break;
    case 'invite': {
      const place = extra.place ?? 'pub';
      const pname = buildingById(place)?.name.split(' · ')[0] ?? place;
      const lvl = levelOf(relOf(s, who.key).pts).i;
      const yes = extra.accept ?? Math.random() < 0.35 + lvl * 0.12;
      if (yes) {
        reply = pick(['Go on then. See you there!', 'Twist my arm. Be there in a bit.', 'Yeah alright! First one’s yours.']);
        text = `${first} is heading to ${pname}. “${reply}”`;
      } else {
        reply = pick(['Can’t today, love. Another time?', 'Ah, I’m skint till Friday.', 'Next time, yeah? Promise.']);
        text = `${first}: “${reply}”`;
        tone = 'info';
        pts = 1;
      }
      break;
    }
    case 'favour': {
      const f = favourFor(who);
      text = f.apply(s);
      relOf(s, who.key).fav = london().dateKey;
      reply = f.reply;
      break;
    }
  }
  const levelUp = touchRel(s, who.key, pts, kind, out, who.name);
  if (levelUp) out.push({ type: 'toast', text: `${LEVELS.find((l) => l.name === levelUp)?.emoji} You and ${who.name} are now: ${levelUp}`, tone: 'good' });
  checkWishes(s, out);
  return { text, tone, reply, levelUp, events: out };
}

// ------------------------------------------------------------------ favours (Mate and up, once a day)
interface Favour {
  label: string;
  reply: string;
  apply: (s: SaveState) => string;
}
const FAVOURS: Record<string, Favour> = {
  'Big Tel': { label: 'A pint on Tel', reply: 'Put it on my tab. I don’t have a tab. Mo!', apply: (s) => ((s.social = clamp(s.social + 15)), (s.hunger = clamp(s.hunger + 5)), 'Big Tel gets a pint in for you. First time in recorded history. 💬 +15') },
  'Auntie Bev': { label: 'Borrow a spare brolly', reply: 'Bring it back. I have its serial number.', apply: (s) => ((s.umbrellaUntil = Math.max(s.umbrellaUntil, s.life) + 2 * 1440), 'Bev lends you a brolly “from the lost property”. ☂️ Rain-proof for 2 days.') },
  Tomasz: { label: 'Have a look at the damp', reply: 'Is not damp. Is character. (Is damp.)', apply: (s) => ((s.damp = Math.max(0, s.damp - 30)), 'Tomasz has a look at your damp and does something with a tub of sealant. 🍄 -30 damp.') },
  Priya: { label: 'Beta-test her app', reply: 'Your feedback is so valuable 🚀 (it isn’t)', apply: (s) => ((s.money = r2(s.money + 15)), 'You click around Woof for ten minutes. Priya pays you £15 “from the marketing budget”. +£15') },
  'Gary & dog': { label: 'Walk Biscuit', reply: 'He likes you. He likes everyone. But he likes you.', apply: (s) => ((s.social = clamp(s.social + 12)), (s.energy = clamp(s.energy - 5)), (s.skills.fitness += 0.3), 'You walk Biscuit round the pond. He barks at the swan. The swan wins. 💬 +12, 💪 Fitness up') },
  'Josh (Fleecems)': { label: 'Referral fee', reply: 'Don’t tell my manager. Or do. He won’t care.', apply: (s) => ((s.money = r2(s.money + 20)), 'Josh slips you £20 for “referring a friend”. You didn’t. +£20') },
  Nan: { label: 'Tupperware of stew', reply: 'Bring the box back. I count them.', apply: (s) => ((s.hunger = clamp(s.hunger + 35)), 'Nan hands over a Tupperware of stew still warm from the oven. 🍔 +35') },
  Kev: { label: 'Spot me, bro', reply: 'LIGHT WEIGHT. (It wasn’t.)', apply: (s) => ((s.skills.fitness += 0.4), (s.energy = clamp(s.energy - 6)), 'Kev spots you on the bench. You both shout a lot. 💪 Fitness up') },
  Siobhan: { label: 'Night-shift tea', reply: 'Hospital-grade. Strong enough to stand a spoon in.', apply: (s) => ((s.energy = clamp(s.energy + 20)), 'Siobhan makes you a tea so strong your eyes water. ⚡ +20') },
  Femi: { label: 'Get on the guest list', reply: 'You’re on. Plus one. Plus Big Tel apparently.', apply: (s) => ((s.social = clamp(s.social + 20)), (s.mood = clamp(s.mood + 6)), 'Femi puts you on the guest list for Friday. 💬 +20 · 🙂 +6') },
  Hamza: { label: 'Borrow revision notes', reply: 'Colour-coded. Don’t smudge them.', apply: (s) => ((s.skills.brains += 0.4), 'Hamza lends you their notes. You understand 40% of them. 🧠 Brains up') },
  'Posh Rupert': { label: 'Spare sourdough', reply: 'It’s a 72-hour ferment. Don’t toast it, you animal.', apply: (s) => ((s.hunger = clamp(s.hunger + 25)), 'Rupert gives you a sourdough loaf “that didn’t rise”. It’s better than anything you’ve ever eaten. 🍔 +25') },
};
const STAFF_FAVOUR: Favour = { label: 'One on the house', reply: 'Don’t tell the others.', apply: (s) => ((s.hunger = clamp(s.hunger + 15)), (s.social = clamp(s.social + 8)), 'They sneak you something on the house. 🍔 +15 · 💬 +8') };
export const favourFor = (who: PersonRef): Favour => FAVOURS[who.name] ?? STAFF_FAVOUR;

// ------------------------------------------------------------------ small talk
export type Topic = 'you' | 'them' | 'weather' | 'gossip';
export const TOPICS: { id: Topic; label: string }[] = [
  { id: 'them', label: 'How are you?' },
  { id: 'you', label: 'Moan about your day' },
  { id: 'weather', label: 'The weather' },
  { id: 'gossip', label: 'Heard anything?' },
];
const ABOUT: Record<string, string[]> = {
  'Big Tel': ['Can’t complain. Knee’s gone, Clive bit me, the telly’s on the blink. But can’t complain.', 'Been coming here since ’91. Same stool. They’ll bury me on it.'],
  'Auntie Bev': ['Busy, love. The WhatsApp group’s kicked off about the bins again.', 'I’ve been on the phone to the council for three hours. On hold. Vivaldi.'],
  Tomasz: ['Busy, my friend. Three jobs, one van, zero Tuesdays.', 'Good! Somebody paid me on time. I nearly cried.'],
  Priya: ['Honestly? Crushing it. Pre-revenue, but crushing it.', 'Just had a call with an investor. Well. My uncle. But he’s thinking about it.'],
  'Gary & dog': ['Biscuit’s been sick on the sofa, so: up and down, really.', 'All good. Biscuit says hello. (He’s sniffing your shoes. That’s hello.)'],
  'Josh (Fleecems)': ['Mad busy. Everything’s going fast. Well, nothing’s going. But fast.', 'Living the dream! (I live with my mum.)'],
  Nan: ['Oh, mustn’t grumble. My hip’s playing up, Doris is being Doris.', 'Lovely, dear. Won £4 at bingo. Spent it on bingo.'],
  Kev: ['Bro. Hit a PB this morning. Then I had a kebab. Balance.', 'Crypto’s down again. But gains are up. Life’s a seesaw, innit.'],
  Siobhan: ['Knackered. Did four nights. My body thinks it’s in Australia.', 'Alright! Got a whole two days off. I’m going to sleep for both.'],
  Femi: ['Working on a new mix. It’s just the 436 bus noises. It slaps.', 'Good, good. Got a set at the Brolly Friday. Come through.'],
  Hamza: ['Revising. Always revising. I dream in flashcards.', 'Got a B on my coursework! My mum asked why it wasn’t an A.'],
  'Posh Rupert': ['Splendid. The sourdough starter survived the weekend. Barely.', 'Oh, frightful week. The Waitrose was out of my preferred quinoa.'],
};
const STAFF_ABOUT = ['Busy. It’s always busy. Or dead. Never in between.', 'Can’t complain. Well, I can. I’m not allowed to, on shift.', 'Been on since 7. My feet have filed a complaint.', 'Not bad! Boss is off today, so it’s basically a holiday.'];

/** A state-aware opener: what they say when you stop for a chat. */
export function talkOpener(who: PersonRef, s: SaveState, ctx: { raining: boolean; hh: number; place: string | null }): string {
  const first = s.name.split(' ')[0];
  const lines: string[] = [];
  if (ctx.raining) lines.push(`${first}! You look like you’ve been through a car wash.`, 'Grim out there, isn’t it? Biblical.');
  if (ctx.hh < 9) lines.push('Bit early for this, isn’t it?', 'Morning! Don’t talk to me till I’ve had a tea. Go on then.');
  if (ctx.hh >= 22) lines.push('You’re out late. Up to no good?', 'Shouldn’t you be in bed? I should be in bed.');
  if (ctx.place === 'pub') lines.push('Alright! Pull up a stool.', 'Ey! Look who it is. Whose round is it?');
  if (ctx.place === 'crumbs') lines.push('Did you get the last sausage roll? Tell me you didn’t get the last sausage roll.');
  if (ctx.place === 'laundry') lines.push('Which machine did you get? Not number 3. Never number 3.');
  if (ctx.place === 'gym') lines.push('You training? Or just here for the showers? No judgement.');
  if (ctx.place === 'library') lines.push('*whispers* Alright?');
  const lvl = levelOf(peekRel(s, who.key)?.pts ?? 0).i;
  if (lvl >= MATE) lines.push(`${first}! My favourite person. Don’t tell the others.`, 'There they are! I was just talking about you. Good things. Mostly.');
  else if (lvl === 0) lines.push('Hello… do I know you? You’ve got one of those faces.', 'Alright? You’re new round here, aren’t you?');
  if (!lines.length) lines.push('Alright? You good?', 'Ey up! How’s things?');
  return pick(lines);
}

/** Their answer to a topic. Uses your actual situation (and your pronouns when they gossip). */
export function talkReply(who: PersonRef, topic: Topic, s: SaveState, ctx: { raining: boolean; hh: number; place: string | null }): string {
  if (topic === 'them') return pick(ABOUT[who.name] ?? STAFF_ABOUT);
  if (topic === 'weather') {
    if (ctx.raining) return pick(['Bucketing it down. My brolly turned inside out and flew off towards Croydon.', 'Rain again. If it stops I’ll assume something’s wrong.']);
    if (ctx.hh >= 20 || ctx.hh < 6) return pick(['Nippy tonight. Proper nippy.', 'Clear night. You can almost see a star. Almost.']);
    return pick(['Lovely out, isn’t it? It won’t last.', 'Bit of sun! Get the barbecue out. No, it’s gone.', 'Close, isn’t it? Muggy. Or is that just me.']);
  }
  if (topic === 'you') {
    const lines: string[] = [];
    if (s.money < 10) lines.push('Skint? Join the club. We meet at the Brolly. You can’t afford it.');
    if (s.hunger < 30) lines.push('You look half-starved. Get a sausage roll down you, for God’s sake.');
    if (s.energy < 30) lines.push('You look shattered. Have you tried sleeping? It’s great.');
    if (!s.job) lines.push('Still looking for work? Sandra at the Jobcentre’s lovely. Take a book, mind.');
    if (s.job) lines.push(`How’s the job going? ${s.job === 'rider' ? 'Mind the potholes on Albion Road.' : s.job === 'barista' ? 'Do they let you have the free pastries?' : s.job === 'bus' ? 'Do you get to drive the 436? Don’t tell me, I’ll only complain.' : 'Is it all spreadsheets? Sounds awful. Is it nice?'}`);
    if (s.home === 'sofa') lines.push('Still on Dave’s sofa? Bless. He’s a good lad, Dave. Smells of Lynx.');
    else if (s.damp > 40) lines.push('Damp still bad? Get Tomasz round. He’ll come next Tuesday.');
    if (s.arrears > 0) lines.push('Behind on rent? Happens to everyone, love. Talk to your landlord before they talk to you.');
    if (!lines.length) lines.push('Sounds like you’re doing alright, actually. Annoying.');
    return pick(lines);
  }
  // gossip: about another local (with their pronouns), or about you
  const others = BOT_NAMES.filter((n) => n !== who.name);
  const n = pick(others);
  const p = pronounsOf(npcAvatar(n));
  const g = pick([
    `Did you hear about ${n}? {They} {was} in the Brolly till closing. On a Tuesday!`,
    `${n} owes me a tenner. Don’t tell {them} I told you.`,
    `I saw ${n} at the bookies. {They} said {they} {was} “just getting change”.`,
    `${n}’s been very quiet lately. In love, or lost a lot at the bookies. One of the two.`,
    `Apparently ${n} won the quiz machine. {They} {has} been insufferable since.`,
  ]);
  if (Math.random() < 0.25) return aboutPerson(pick([`Everyone’s talking about {me}. Something about {their} Natter posts. Not saying it’s bad. Not saying it’s good.`, `Someone said {me} is alright, actually. I said I’d reserve judgement.`]), s.avatar, s.name);
  return pronounText(g, p, n);
}

// ------------------------------------------------------------------ profiles
const persona = (name: string) => PERSONAS.find((p) => p.name === name);
export function staffByName(name: string): (Staff & { place: string }) | null {
  for (const r of Object.values(INTERIORS)) for (const st of r.staff) if (st.name === name) return { ...st, place: r.id };
  return null;
}
export function bioOf(who: PersonRef): string {
  if (who.kind === 'npc') return persona(who.name)?.bio ?? 'A Peckwell local.';
  if (who.kind === 'staff') return staffByName(who.name)?.bio ?? who.role ?? 'Works here.';
  return who.status || 'Another real person in Peckwell.';
}
export const pronounLabel = (a: Avatar) => PRONOUN_LABEL[pronounsOf(a)];
/** An NPC's mood right now: changes through the day, worse in the rain. */
export function npcMood(name: string, t: LondonTime, raining: boolean): { emoji: string; word: string; v: number } {
  const v = Math.round(clamp(55 + (hash(name + t.dateKey + t.hh) - 0.5) * 50 - (raining ? 12 : 0) + (name === 'Big Tel' ? -5 : 0)));
  return v >= 75 ? { emoji: '😄', word: 'Buzzing', v } : v >= 58 ? { emoji: '🙂', word: 'Alright', v } : v >= 42 ? { emoji: '😐', word: 'Can’t complain', v } : { emoji: '😩', word: 'Fed up', v };
}
export const moodWord = (v: number) => (v >= 75 ? { emoji: '😄', word: 'Buzzing' } : v >= 58 ? { emoji: '🙂', word: 'Alright' } : v >= 42 ? { emoji: '😐', word: 'Meh' } : { emoji: '😩', word: 'Fed up' });

/** The Natter author for a person (staff get their own little accounts). */
export function authorOf(who: PersonRef): Author {
  const p = persona(who.name);
  if (who.kind === 'npc' && p) return personaAuthor(p, who.avatar);
  if (who.kind === 'player') return { id: who.pid ?? who.key, name: who.name, handle: handleOf(who.name), kind: 'player', avatar: who.avatar };
  const place = staffByName(who.name)?.place;
  const where = place ? buildingById(place)?.name.split(' · ')[0] : '';
  return { id: 'npc:staff' + who.name.toLowerCase().replace(/[^\w]/g, ''), name: `${who.name}${where ? ` (${where})` : ''}`, handle: handleOf(who.name + 'works'), kind: 'npc', colour: '#636e72', avatar: who.avatar };
}
export const authorIdOf = (who: PersonRef) => authorOf(who).id;

/** A level-up line they post on Natter (about you, with your pronouns). */
export function levelUpPost(level: string, s: SaveState): string {
  const lines: Record<string, string[]> = {
    'Nodding terms': ['Nodded at {me} today. {They} nodded back. That’s how it starts.', 'There’s a new face round here: {me}. Seem alright.'],
    Acquaintance: ['Had a natter with {me}. {They} {is} alright, {they} {is}.', 'Bumped into {me} again. Starting to think {they} {is} following me. Joking. Mostly.'],
    Mate: ['Shout out to {me}. Proper Peckwell, {they} {is}. 🍻', '{me} is officially a mate now. {They} doesn’t get a say in it.'],
    'Good mate': ['If anyone has a problem with {me} they have a problem with me.', '{me} remembered my birthday. I didn’t tell {them} my birthday. Spooky but nice.'],
    'Best mate': ['Me and {me}: best mates. Don’t @ me.', 'Wouldn’t swap {me} for a winning lottery ticket. Maybe a big one. Not a small one.'],
  };
  return aboutPerson(pick(lines[level] ?? lines.Acquaintance).replace('{They} doesn’t', '{They} {doesnt}'), s.avatar, s.name);
}

// ------------------------------------------------------------------ lifetime wishes
const lvl = (s: SaveState, key: string) => levelOf(peekRel(s, key)?.pts ?? 0).i;
export const BROLLY_REGULARS = ['Big Tel', 'Siobhan', 'Tomasz', 'Femi', 'Gary & dog', 'Posh Rupert', 'Auntie Bev'];
export interface Wish {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  reward: number;
  progress: (s: SaveState) => [number, number];
}
export const WISHES: Wish[] = [
  { id: 'brolly', emoji: '🍺', label: 'Where everybody knows your name', desc: 'Get on nodding terms with Mo and 4 Leaky Brolly regulars.', reward: 20, progress: (s) => [Math.min(1, lvl(s, staffKey('Mo'))) + Math.min(4, BROLLY_REGULARS.filter((n) => lvl(s, npcKey(n)) >= 1).length), 5] },
  { id: 'mates', emoji: '🤝', label: 'Everybody’s mate', desc: 'Get 4 locals up to Mate.', reward: 40, progress: (s) => [Math.min(4, BOT_NAMES.filter((n) => lvl(s, npcKey(n)) >= MATE).length), 4] },
  { id: 'staff', emoji: '🛎️', label: 'Knows the staff', desc: 'Be on Acquaintance terms with 5 members of staff.', reward: 25, progress: (s) => [Math.min(5, Object.keys(s.rel ?? {}).filter((k) => k.startsWith('staff:') && lvl(s, k) >= 2).length), 5] },
  { id: 'streak', emoji: '🔥', label: 'Seven days straight', desc: 'Keep a 7-day friendship streak going with someone.', reward: 30, progress: (s) => [Math.min(7, Math.max(0, ...Object.values(s.rel ?? {}).map((r) => r.streak))), 7] },
  { id: 'friend', emoji: '💛', label: 'A real friend', desc: 'Become Mates with another real player, or Best mates with a local.', reward: 50, progress: (s) => [Object.entries(s.rel ?? {}).some(([k, r]) => (k.startsWith('player:') && levelOf(r.pts).i >= MATE) || levelOf(r.pts).i >= 5) ? 1 : 0, 1] },
  { id: 'quiz', emoji: '🏆', label: 'Quiz legend', desc: 'Win 5 pub quizzes at the Leaky Brolly.', reward: 30, progress: (s) => [Math.min(5, s.stats.quizWins), 5] },
  { id: 'career', emoji: '📈', label: 'Top of the ladder', desc: 'Reach level 5 in any job.', reward: 50, progress: (s) => [Math.min(5, s.job ? s.jobLevel : 0), 5] },
];
export function checkWishes(s: SaveState, out: GameEvent[]) {
  s.wishes ??= {};
  for (const w of WISHES) {
    if (s.wishes[w.id]) continue;
    const [a, b] = w.progress(s);
    if (a >= b) {
      s.wishes[w.id] = Date.now();
      s.money = r2(s.money + w.reward);
      out.push({ type: 'toast', text: `🌟 Lifetime wish: ${w.label}! +£${w.reward}`, tone: 'good' });
    }
  }
}

// ------------------------------------------------------------------ rate limiting (multiplayer)
/** Sliding-window limiter: at most `max` per `windowMs` per key, and at least `gapMs` apart. */
export class RateLimiter {
  private log = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number, private gapMs = 0) {}
  ok(key: string, t = Date.now()) {
    const l = (this.log.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (l.length >= this.max || (l.length && t - l[l.length - 1] < this.gapMs)) {
      this.log.set(key, l);
      return false;
    }
    l.push(t);
    this.log.set(key, l);
    return true;
  }
}

export const genderOfNpc = (name: string) => NPC_GENDER[name];

/** Staff look: seeded by name and gender, plus their work clothes. */
export const staffAvatar = (st: Staff): Avatar => ({ ...avatarForName(st.name, st.gender), ...st.look, gender: st.gender });

// ------------------------------------------------------------------ room chatter ("chat spot")
const CHATTER: Record<string, string[]> = {
  pub: ['Whose round is it?', 'Clive! CLIVE. Drop it.', 'Quiz Tuesday. We need a geography person.', 'Same again, Mo?', 'Who put Lionel Richie on the jukebox? Again.', 'Last orders my foot, it’s half nine.'],
  crumbs: ['Two sausage rolls and a coffee, ta.', 'Are the steak bakes out yet?', 'Is that the last vegan one? Course it is.', 'Can I get a bag? No? Fine.'],
  pret: ['Oat, not soya. Oat.', 'Is the Wi-Fi password still “artisanal”?', 'It’s how much for a sandwich??', 'Name for the cup? …No, it’s Siobhan. S-I-O… never mind.'],
  kwik: ['Have you got any single onions, Raj?', 'Just the scratchcard, ta. Feeling lucky.', 'Card machine working? Cash it is.'],
  jobcentre: ['Number 9. Still number 9.', 'Has anyone got a pen that works?', 'They’ve lost my form. Again.', 'Is the coffee machine free? It’s free. It’s also hot water.'],
  laundry: ['Which one works? Number 4? Liar.', 'Someone’s left a single sock in the dryer. Again.', 'This towel’s been folded since I was born.'],
  gym: ['You using this? I’ll work in.', 'Leg day. Unfortunately.', 'Who left the dumbbells on the floor?', 'Is the sauna on? It’s always on.'],
  library: ['*whispers* Has anyone seen the printer card?', 'Shhh.', 'Is the Wi-Fi down or is it me?', 'Rhyme time in ten minutes. Brace yourselves.'],
  bookies: ['Come on my son! …No. Not my son.', 'Each way, on number 4.', 'That dog’s running backwards.'],
  pfc: ['Two wings and chips, boss.', 'Extra gravy. EXTRA.', 'Is my order ready? Name’s Kev. Kev. K-E-V.'],
  barber: ['Just a tidy-up. Not too short.', 'Did you see the match? Robbery.', 'Same as last time, yeah?'],
  charity: ['Is this jacket £2.50 or £25?', 'Seventeen copies of the same book. Classic.', 'Has anyone tried on the wedding dress? Asking for a friend.'],
  fleecems: ['It’s going fast, so…', 'Does it have a window? Like, a real one?', 'Deposit’s how much??'],
  synergy: ['Can we circle back on that?', 'Who microwaved the fish?', 'Lunch-and-learn in the breakout space.'],
  garage: ['436 is running late. Shocking, I know.', 'Who’s on the night route?', 'Bus is on diversion. Via Wales.'],
};
const STAFF_LINES = ['Next please!', 'Who’s next?', 'Two minutes, love.', 'Card or cash?', 'You alright there?'];
export function chatterLine(place: string, staff = false): string {
  if (staff && Math.random() < 0.6) return pick(STAFF_LINES);
  return pick(CHATTER[place] ?? ['Alright?', 'You good?', 'Can’t complain.']);
}
