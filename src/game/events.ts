// Phase 2: British life happens to you. Random choice cards, the prepayment meter, damp,
// careers (performance reviews + mid-shift dilemmas) and a Universal Credit-ish claim.
import type { JobId, SaveState } from './types';
import { HOMES, JOBS, LEVEL_XP, chance, completeGoal, dailyHooks, gainMoodlet, gainSkill, jobTitle, levelPay, money, tickHooks, weeklyHooks, type GameEvent, type Tone } from './economy';
import { addMoodlet, applyFx, effectiveMood, removeMoodlet } from './needs';
import { worldFeed } from './shared';
import { DOW_LONG, addDays, isWinter, london, now, type LondonTime } from './time';

export interface ShiftMods {
  bonus: number;
  mult: number;
}
export interface Outcome {
  text: string;
  tone?: Tone;
}
export interface EventChoice {
  label: string;
  note?: string;
  cost?: number;
  req?: (s: SaveState) => string | null;
  apply: (s: SaveState, out: GameEvent[], mods: ShiftMods) => string | Outcome;
}
export interface EventDef {
  id: string;
  emoji: string;
  kicker: string;
  title: string | ((s: SaveState) => string);
  text: (s: SaveState) => string;
  /** random deck: relative weight (0 / undefined = only triggered directly) */
  weight?: number;
  when?: (s: SaveState, t: LondonTime) => boolean;
  /** real days before it can come round again */
  cooldownDays?: number;
  choices: EventChoice[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** "3am", "half 11", "quarter past midnight": how people actually say the time. */
export function clockWords(t: { hh: number; mm: number }) {
  const h12 = (h: number) => (h % 12 === 0 ? (h === 0 || h === 24 ? 'midnight' : 'midday') : String(h % 12));
  const ampm = (h: number) => (h % 12 === 0 ? '' : h < 12 || h === 24 ? 'am' : 'pm');
  if (t.mm < 8) return h12(t.hh) + ampm(t.hh);
  if (t.mm < 23) return 'quarter past ' + h12(t.hh) + (h12(t.hh).length > 2 ? '' : ampm(t.hh));
  if (t.mm < 38) return 'half ' + (t.hh % 12 || 12);
  if (t.mm < 53) return 'quarter to ' + h12(t.hh + 1) + (h12(t.hh + 1).length > 2 ? '' : ampm(t.hh + 1));
  return h12(t.hh + 1) + ampm(t.hh + 1);
}
const pay = (s: SaveState, n: number) => {
  s.money = r2(s.money - n);
};
const earn = (s: SaveState, n: number) => {
  s.money = r2(s.money + n);
  s.stats.earned = r2(s.stats.earned + n);
  s.uc.weekEarned = r2(s.uc.weekEarned + n);
};
const today = () => london().dateKey;
const renting = (s: SaveState) => s.home !== 'sofa';
const afford = (n: number) => (s: SaveState) => (s.money < n ? 'Card declined.' : null);

// ------------------------------------------------------------------ the deck
export const EVENTS: EventDef[] = [
  {
    id: 'strike',
    emoji: '🚇',
    kicker: 'Travel news',
    title: 'Tube strike today',
    text: () => 'The Underground-ish is on strike. All lines. The Overground is “running a reduced service”, which means one train, somewhere, possibly. A rail replacement bus will run from outside each station.',
    // strike days are shared: everyone in Peckwell gets the same one (see shared.ts)
    weight: 25,
    cooldownDays: 1,
    when: (_s, t) => worldFeed().day(t.dateKey).strike,
    choices: [
      { label: 'Fair play to them', note: 'Solidarity. No Tube today.', apply: (s) => { s.flags.strike = today(); applyFx(s, { mood: 2 }); return 'You nod respectfully at a man with a placard. He nods back. A very British exchange.'; } },
      { label: 'Moan about it on Natter', note: 'No Tube today. Social +', apply: (s, out) => { s.flags.strike = today(); applyFx(s, { social: 8 }); out.push({ type: 'gossip', key: 'strike' }); return 'You posted “absolute joke” with a train emoji. Eleven people agreed. Nothing changed. Bliss.'; } },
    ],
  },
  {
    id: 'tvlicence',
    emoji: '📺',
    kicker: 'Post',
    title: 'A letter from TV Licensing-ish',
    text: () => '“OUR RECORDS SHOW THIS ADDRESS IS NOT LICENSED. AN ENFORCEMENT OFFICER MAY VISIT.” It’s addressed to “The Legal Occupier”. You feel personally targeted.',
    weight: 2,
    cooldownDays: 14,
    when: (s) => renting(s) && !s.flags.tvLicence,
    choices: [
      { label: 'Buy a licence (£13.25)', note: 'One month. Peace of mind.', req: afford(13.25), apply: (s, out) => { pay(s, 13.25); s.flags.tvLicence = true; gainMoodlet(s, 'smug', out); return 'Licensed! You can now legally watch Bake Off-ish live. You still watch it on catch-up.'; } },
      { label: 'Declare you don’t watch live telly', note: 'Free. No iPlayer-ish, ever.', apply: (s) => { s.flags.tvLicence = true; return 'You filled in a form. You will now hide behind the sofa every time Bake Off-ish is mentioned.'; } },
      { label: 'Ignore it', note: 'They’ll write again. They always write again.', apply: (s, out) => { gainMoodlet(s, 'telly_tax', out); return { text: 'You put it in the drawer with the other ones. The drawer is getting full.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'boiler',
    emoji: '🔥',
    kicker: 'At home',
    title: 'The boiler’s packed in',
    text: () => 'The little blue flame has gone out. There’s a red light blinking “E119” at you. The internet says “bleed the radiators”. The internet always says that.',
    weight: 2,
    cooldownDays: 7,
    when: (s) => renting(s),
    choices: [
      { label: 'Text the landlord', note: 'Free. Results… vary.', apply: (s, out) => { if (chance(0.45)) { out.push({ type: 'phone', from: HOMES[s.home].landlord, text: 'Sorted, sending my mate Steve round. He’s “basically a plumber”. 👍', tone: 'good', quiet: true }); return 'Steve came, hit it with a spanner, and it works. Steve is a genius. Steve also ate your biscuits.'; } gainMoodlet(s, 'cold_flat', out); out.push({ type: 'phone', from: HOMES[s.home].landlord, text: 'Have you tried turning it off and on again? Will look at it “next week”.', tone: 'bad', quiet: true }); return { text: '“Next week.” You are now wearing a coat indoors. Classic.', tone: 'bad' }; } },
      { label: 'Get a plumber yourself (£60)', note: 'Expensive. Fixed today.', req: afford(60), apply: (s) => { pay(s, 60); return 'He sucked his teeth for ten minutes, said “who installed THIS?”, and fixed it in four. Worth it.'; } },
      { label: 'Kettle baths for a week', note: 'Free. Character-building.', apply: (s, out) => { gainMoodlet(s, 'cold_shower', out); applyFx(s, { hygiene: -10 }); return { text: 'You boiled the kettle six times to have a bath with the depth of a puddle. Victorian.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'parcel',
    emoji: '📦',
    kicker: 'Sorry we missed you',
    title: 'Missed parcel',
    text: () => 'You were in. You were RIGHT THERE. The card says “We tried to deliver but no one was home.” The knock was quieter than a moth.',
    weight: 3,
    cooldownDays: 3,
    choices: [
      { label: 'Trek to the depot', note: '⚡ -10. It’s in an industrial estate.', apply: (s, out) => { applyFx(s, { energy: -10 }); const r = Math.random(); if (r < 0.4) { earn(s, 10); return 'It was a birthday card from Nan with a tenner in it. It isn’t your birthday. Nan doesn’t care. +£10'; } if (r < 0.7) { gainMoodlet(s, 'new_kettle', out); return 'It was a new kettle you forgot you ordered at 2am. Sleek. Matte black. Life-changing.'; } return 'It was for your neighbour. You carried it home anyway. You are a good person (with sore arms).'; } },
      { label: 'Rebook delivery', note: 'They’ll miss you again.', apply: () => 'Rebooked for Thursday between 7am and 9pm. You will be watching the door like a guard dog.' },
    ],
  },
  {
    id: 'scamtext',
    emoji: '📱',
    kicker: 'Text message',
    title: '“Royal Mall: your parcel is held”',
    text: () => '“Royal Mall: Your parcel could not be delivered due to an unpaid £1.45 fee. Pay now: royal-mall-redeliverry.co/uk-pay”. Two Ls in “Mall”. Two Rs in “redeliverry”.',
    weight: 2,
    cooldownDays: 10,
    choices: [
      { label: 'Report it (forward to 7726)', note: 'Free. The right thing.', apply: (s, out) => { gainMoodlet(s, 'smug', out); return 'Forwarded to 7726 and blocked. You feel like a one-person cyber security department.'; } },
      { label: 'Pay the £1.45', note: 'It’s only £1.45…', apply: (s, out) => { pay(s, Math.min(s.money, 45)); gainMoodlet(s, 'scammed', out); out.push({ type: 'phone', from: 'Bank of Peckwell', text: 'We’ve frozen your card after a suspicious £43.55 payment to “TOTALLY LEGIT LTD”. Call us. (Never pay fees from a text, love.)', tone: 'bad', quiet: true }); return { text: 'It wasn’t £1.45. Your bank has frozen your card and you’ve learned a £45 lesson. Real parcel companies don’t text you for fees.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'stag',
    emoji: '🎉',
    kicker: 'WhatsApp group: “GAZZA’S STAG 🍻🍻”',
    title: 'Stag do in Bournemouth',
    text: () => 'Dave’s mate Gazza is getting married. The stag do is a weekend in Bournemouth. There are matching T-shirts. There is a spreadsheet. The spreadsheet has a tab called “FINES”.',
    weight: 2,
    cooldownDays: 14,
    choices: [
      { label: 'I’m in (£60)', note: 'Social ++, ⚡ --, legend status', req: afford(60), apply: (s, out) => { pay(s, 60); applyFx(s, { social: 40, energy: -30, hygiene: -20 }); gainMoodlet(s, 'stag_legend', out); gainMoodlet(s, 'hungover', out); out.push({ type: 'gossip', key: 'stag' }); return 'You dressed as a banana. Gazza cried. Someone lost a shoe in the sea. Best weekend of your life.'; } },
      { label: 'Just come for the meal (£25)', note: 'Compromise. Social +', req: afford(25), apply: (s) => { pay(s, 25); applyFx(s, { social: 20 }); return 'You did the meal and left before the inflatable came out. Wise. Slightly boring.'; } },
      { label: 'Can’t, skint', note: 'Free. Social -', apply: (s) => { applyFx(s, { social: -12 }); return { text: 'You left the group. Then got re-added. Then muted it. The FINES tab now has your name in it.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'heatwave',
    emoji: '🥵',
    kicker: 'Met Office-ish: amber warning',
    title: 'Heatwave! (24°C)',
    text: () => 'It is 24 degrees. The nation is in crisis. The Tube is a sauna, the shops have sold out of fans, and a man on the news is frying an egg on a bin.',
    weight: 20,
    cooldownDays: 1,
    when: (_s, t) => worldFeed().day(t.dateKey).heatwave,
    choices: [
      { label: 'Beer garden (£7.20)', note: 'Mood +, 🫧 -', req: afford(7.2), apply: (s, out) => { s.flags.heatwave = today(); pay(s, 7.2); applyFx(s, { mood: 12, social: 12, hygiene: -10 }); gainMoodlet(s, 'heatwave', out); return 'You sat in the Brolly’s beer garden (four benches and a bin) until you turned the colour of a postbox.'; } },
      { label: 'Hide in the Kwik Mart freezer aisle', note: 'Free. Cool. Weird.', apply: (s, out) => { s.flags.heatwave = today(); applyFx(s, { warmth: -5, mood: 3 }); gainMoodlet(s, 'heatwave', out); return 'You “browsed the frozen peas” for 40 minutes. The shopkeeper understood. He was in there too.'; } },
    ],
  },
  {
    id: 'counciltax',
    emoji: '🏛️',
    kicker: 'Peckwell Council',
    title: 'Council tax reminder',
    text: (s) => `“Dear Resident, you are in Band B. Your council tax is ${money(HOMES[s.home].councilTax)}/week.” Small print: if you live alone you might get a 25% single person discount. You live with a damp patch. Does that count?`,
    weight: 2,
    cooldownDays: 21,
    when: (s) => renting(s) && !s.flags.ctDiscount,
    choices: [
      { label: 'Fill in the 14-page form', note: '⚡ -8. 25% off council tax.', apply: (s) => { applyFx(s, { energy: -8 }); s.flags.ctDiscount = true; return 'Page 9 asked for your “previous previous address”. You persevered. 25% off council tax from now on.'; } },
      { label: 'Bin it', note: 'Easier.', apply: () => 'You binned it. In the wrong bin. Auntie Bev saw.' },
    ],
  },
  {
    id: 'mumcall',
    emoji: '☎️',
    kicker: 'Incoming call: MUM',
    title: 'Mum’s ringing',
    text: () => 'Not a text. A CALL. Either someone’s died or she wants to tell you about a programme she watched about Cornwall.',
    weight: 3,
    cooldownDays: 2,
    when: (_s, t) => t.hh >= 9 && t.hh < 22,
    choices: [
      { label: 'Pick up', note: 'Social ++. About 40 minutes.', apply: (s, out) => { applyFx(s, { social: 25, energy: -4 }); if (chance(0.5)) { gainMoodlet(s, 'mums_dinner', out); applyFx(s, { hunger: 30 }); return 'It was the Cornwall programme. Then she sent a Tupperware of shepherd’s pie round with your cousin. You are loved.'; } return 'Nobody died. Your cousin got engaged. The neighbour’s cat got a new hip. You said “aw” fourteen times.'; } },
      { label: 'Text “can’t talk, all OK x”', note: 'Free. Guilt.', apply: (s, out) => { applyFx(s, { mood: -4 }); out.push({ type: 'phone', from: 'Mum', text: 'OK love. Just wanted to hear your voice. Mum x', tone: 'info', quiet: true }); return { text: 'She replied “OK love. Just wanted to hear your voice. Mum x”. Devastating.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'fox',
    emoji: '🦊',
    kicker: 'In the dead of night',
    title: 'A fox is in the bins',
    text: () => 'There is a noise outside like someone being murdered. It is a fox. It has a chicken bone. It is looking at you like YOU’RE the problem.',
    weight: 2,
    cooldownDays: 4,
    when: (_s, t) => t.hh >= 22 || t.hh < 5,
    choices: [
      { label: 'Film it for Natter', note: 'Content!', apply: (s, out) => { out.push({ type: 'post', text: `Fox in the bins at ${clockWords(london())}. He looked me dead in the eye and took a chicken bone. Respect 🦊` }); applyFx(s, { social: 6 }); return 'You posted it. The locals went wild. The fox did not care.'; } },
      { label: 'Shout “OI!” from the window', note: 'Classic.', apply: (s) => { applyFx(s, { energy: -4, mood: 2 }); return 'The fox stared at you, finished the bone, and left at a leisurely pace. He won. He always wins.'; } },
    ],
  },
  {
    id: 'pigeon',
    emoji: '🐦',
    kicker: 'High street',
    title: 'A pigeon nicked your lunch',
    text: () => 'You looked away for one second. A pigeon with one foot has your sausage roll. It’s making eye contact while it eats it.',
    weight: 2,
    cooldownDays: 3,
    when: (s, t) => s.stats.sausageRolls > 0 && t.hh >= 7 && t.hh < 20,
    choices: [
      { label: 'Let it go', note: 'Make a friend.', apply: (s, out) => { gainMoodlet(s, 'pigeon_pal', out); applyFx(s, { hunger: -10 }); return 'You let it have it. The pigeon now follows you everywhere. You’ve named him Colin.'; } },
      { label: 'Chase it', note: '⚡ -6. You won’t win.', apply: (s) => { applyFx(s, { energy: -6, hunger: -10, mood: -3 }); return { text: 'You chased a pigeon down the high street. It flew off. Three people filmed you.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'party',
    emoji: '🔊',
    kicker: 'Late night',
    title: 'Upstairs are having a party',
    text: () => {
      const t = london();
      // after midnight it's still "last night" as far as anyone's concerned
      const day = DOW_LONG[t.hh < 5 ? (t.dayIdx + 6) % 7 : t.dayIdx];
      const vibe = day === 'Friday' || day === 'Saturday' ? 'Fair enough, it’s a ' + day : 'It’s a ' + day;
      return `The bass is coming through the ceiling. ${vibe}. Someone is singing Mr Brightside. Everyone is singing Mr Brightside.`;
    },
    weight: 2,
    cooldownDays: 5,
    when: (s, t) => renting(s) && (t.hh >= 21 || t.hh < 2),
    choices: [
      { label: 'Go up and join in', note: 'Social ++, ⚡ --', apply: (s, out) => { applyFx(s, { social: 30, energy: -20, mood: 8 }); gainMoodlet(s, 'tipsy', out); return 'You went up to complain and left at 4am with three new best friends and someone’s jacket.'; } },
      { label: 'Bang on the ceiling with a broom', note: 'British protest.', apply: (s) => { applyFx(s, { energy: -8, mood: -3 }); return 'They turned it down by 2%. You both pretended this was a victory.'; } },
      { label: 'Earplugs and suffer', note: '⚡ -', apply: (s) => { applyFx(s, { energy: -12 }); return 'You lay awake mouthing along to Mr Brightside. Coming out of your cage. You were not doing just fine.'; } },
    ],
  },
  {
    id: 'bins',
    emoji: '🗑️',
    kicker: 'Thursday morning',
    title: 'It’s bin day. Which bin?',
    text: () => 'Blue, black, brown or green? The council calendar is a colour-coded nightmare. Auntie Bev is watching from her window.',
    weight: 2,
    cooldownDays: 6,
    when: (_s, t) => t.dayIdx === 3 && t.hh >= 6 && t.hh < 12,
    choices: ['Blue (recycling)', 'Black (general)', 'Brown (food waste)'].map((label, i) => ({
      label,
      apply: (s: SaveState, out: GameEvent[]) => {
        if (i === Math.floor(Math.random() * 3)) {
          gainMoodlet(s, 'smug', out);
          return 'Correct bin! The binmen nodded at you. Auntie Bev gave you a thumbs up. Peak citizenship.';
        }
        out.push({ type: 'gossip', key: 'bins' });
        return { text: 'Wrong bin. It’s been left with a sticker on it saying “INCORRECT WASTE”. Auntie Bev has posted about it.', tone: 'bad' as Tone };
      },
    })),
  },
  {
    id: 'inspection',
    emoji: '🧐',
    kicker: 'Text from your landlord',
    title: '“Popping round in 30 mins”',
    text: (s) => `${HOMES[s.home].landlord}: “Just popping round in 30 mins for a quick inspection, hope that’s OK 😊”. It is not a question.`,
    weight: 2,
    cooldownDays: 10,
    when: (s) => renting(s),
    choices: [
      { label: 'Frantic tidy', note: '⚡ -10. 🫧 +', apply: (s) => { applyFx(s, { energy: -10, hygiene: 10 }); s.damp = Math.max(0, s.damp - 10); return 'You shoved everything in the wardrobe. He opened the wardrobe. He said “lovely” in a way that wasn’t lovely.'; } },
      { label: 'Show him the damp', note: 'Might get fixed…', apply: (s) => { if (s.damp > 20 && chance(0.5)) { s.damp = 0; return 'He looked at the damp patch, said “that’s condensation”, then sent Steve with a bucket of paint. Fixed (ish).'; } return { text: 'He said “that’s just condensation, open a window” and left. You opened a window. It was raining.', tone: 'bad' }; } },
    ],
  },
  {
    id: 'birthday',
    emoji: '🎂',
    kicker: 'Office / group chat',
    title: 'Someone’s leaving do',
    text: () => 'There’s a card going round for Brenda from Accounts’ leaving do. You don’t know Brenda. Everyone has put a fiver in the envelope. Everyone is looking at you.',
    weight: 2,
    cooldownDays: 7,
    when: (s) => !!s.job,
    choices: [
      { label: 'Put a fiver in', note: '£5. Social +', req: afford(5), apply: (s) => { pay(s, 5); applyFx(s, { social: 10 }); return 'You wrote “All the best! x” like you’ve known her for years. Brenda hugged you. You still don’t know who Brenda is.'; } },
      { label: 'Sign it and pass it on', note: 'Free. Slightly shifty.', apply: (s) => { applyFx(s, { social: -4 }); return 'You signed it and passed it on quickly. Someone counted the money. Someone always counts the money.'; } },
    ],
  },
  {
    id: 'meterlow',
    emoji: '🔌',
    kicker: 'Power company-ish',
    title: 'Your meter is running low',
    text: (s) => `Your prepayment meter has ${money(Math.max(0, s.meter))} left. When it hits zero you get £5 of emergency credit, then the lights go out. Top up the key at Kwik Mart.`,
    choices: [{ label: 'Right. Kwik Mart.', apply: () => 'You make a mental note. You will forget the mental note.' }],
  },
];

// ------------------------------------------------------------------ careers
export const REVIEW: EventDef = {
  id: 'review',
  emoji: '📈',
  kicker: 'Performance review',
  title: (s) => `A quick chat with ${s.job === 'barista' ? 'the area manager' : s.job === 'temp' ? 'Linda' : s.job === 'bus' ? 'the garage supervisor' : 'Dispatch'}`,
  text: (s) => {
    const j = JOBS[s.job ?? 'barista'];
    return `“So… we’ve been really impressed.” They’re offering you a step up to ${j.titles[Math.min(4, s.jobLevel)]}. Pay ×${levelPayAt(s.jobLevel + 1).toFixed(2)} (from ×${levelPay(s).toFixed(2)}).`;
  },
  choices: [
    { label: 'Smile, nod, accept', note: 'Promotion.', apply: (s, out) => promote(s, out, 0) },
    { label: 'Negotiate (😏 Charm)', note: 'Promotion + a chance of a signing bonus.', apply: (s, out) => { const ok = chance(0.3 + s.skills.charm * 0.08); return promote(s, out, ok ? 25 * s.jobLevel : 0, ok ? 'You said “I’ve had other offers” (you haven’t). It WORKED.' : '“The budget’s frozen, but we can do a new lanyard.” Fair enough.'); } },
    { label: 'Not ready yet', note: 'Stay put. They’ll ask again.', apply: (s) => { s.flags.reviewPending = false; s.jobXp = Math.max(0, s.jobXp - 5); return 'You said you’d like to “grow into the role first”. They looked relieved. So did you.'; } },
  ],
};
const levelPayAt = (lvl: number) => [1, 1.25, 1.55, 1.9, 2.35][Math.max(0, Math.min(4, lvl - 1))];
function promote(s: SaveState, out: GameEvent[], bonus: number, extra = ''): Outcome {
  s.jobLevel = Math.min(5, s.jobLevel + 1);
  s.flags.reviewPending = false;
  if (bonus) earn(s, bonus);
  gainMoodlet(s, 'promoted', out);
  completeGoal(s, 'promo', out);
  out.push({ type: 'gossip', key: 'promo' });
  return { text: `${extra ? extra + ' ' : ''}You’re now ${jobTitle(s)}.${bonus ? ` Signing bonus: ${money(bonus)}.` : ''} Pay ×${levelPay(s).toFixed(2)}. You immediately update LinkedIn.`, tone: 'good' };
}
/** Called after every shift: XP, and a performance review when you've earned one. */
export function shiftXp(s: SaveState, score: number, out: GameEvent[]) {
  if (!s.job) return;
  s.jobXp += 6 + Math.round(Math.max(0, Math.min(1, score)) * 8);
  if (s.jobLevel < 5 && s.jobXp >= LEVEL_XP[s.jobLevel] && !s.flags.reviewPending) {
    s.flags.reviewPending = true;
    out.push({ type: 'card', id: 'review' });
  }
}

/** Dilemmas that interrupt a shift (the mini-game pauses while you decide). */
export const SHIFT_CARDS: Record<JobId, EventDef[]> = {
  barista: [
    { id: 'sb_oat', emoji: '🥛', kicker: 'Mid-shift', title: 'We’re out of oat milk', text: () => 'A queue of eleven people, nine of whom want oat. The delivery is “on its way”. A woman in Lululemon is already making a face.', choices: [
      { label: 'Run to Kwik Mart (£2)', note: 'Lose time, save the day', apply: (s, _o, m) => { pay(s, 2); m.mult += 0.1; return 'You sprinted to Kwik Mart in your apron. Hero of the oat people. +10% pay.'; } },
      { label: '“Have you tried it with whole milk?”', note: 'Risky', apply: (_s, _o, m) => { if (chance(0.5)) { m.mult += 0.05; return 'She tried it. She loved it. She’s questioning everything.'; } m.mult -= 0.1; return { text: 'She left a one-star review titled “ASSAULTED BY DAIRY”. -10% pay.', tone: 'bad' }; } },
    ] },
    { id: 'sb_name', emoji: '✍️', kicker: 'Mid-shift', title: 'The customer’s name is “Siobhan”', text: () => 'You have the pen. You have the cup. You have no idea how to spell it.', choices: [
      { label: 'Write “Shivorn”', note: 'Tradition', apply: (_s, out, m) => { m.bonus += 1; out.push({ type: 'gossip', key: 'cupname' }); return 'She photographed it for Natter. Free advertising. +£1 tip, out of pity.'; } },
      { label: 'Ask her to spell it', note: 'Professional', apply: (s, _o, m) => { gainSkill(s, 'charm', 0.1); m.bonus += 2; return '“S-I-O-B-H-A-N.” You learned something today. +£2 tip.'; } },
    ] },
    { id: 'sb_laptop', emoji: '💻', kicker: 'Mid-shift', title: 'Laptop man, hour four', text: () => 'A man has been on one flat white for four hours, using three plug sockets. There’s a queue for tables.', choices: [
      { label: 'Ask him nicely to move', note: 'Confrontation (British)', apply: (_s, _o, m) => { m.mult += 0.05; return 'You said “sorry, sorry, are you nearly…?” He left. You apologised four times. Efficiency +5%.'; } },
      { label: 'Leave him be', note: 'He might be writing a novel', apply: () => 'He’s writing a screenplay about a barista. You may be in it. You hope you’re played by someone fit.' },
    ] },
  ],
  temp: [
    { id: 'st_cake', emoji: '🍰', kicker: 'Mid-shift', title: 'Cake in the kitchen', text: () => 'An email: “Cake in the kitchen!! 🎂”. Thirty people are speed-walking. Linda has asked for the quarterly report “by end of play”.', choices: [
      { label: 'Get cake', note: '🍔 +, focus -', apply: (s, _o, m) => { applyFx(s, { hunger: 12, mood: 5 }); m.mult -= 0.05; return 'Lemon drizzle. Worth it. The report is now “nearly there”.'; } },
      { label: 'Stay and work', note: 'Linda notices', apply: (s, _o, m) => { m.mult += 0.1; gainSkill(s, 'graft', 0.1); return 'Linda said “great stuff”. The highest honour. +10% pay. There was no cake left.'; } },
    ] },
    { id: 'st_replyall', emoji: '📧', kicker: 'Mid-shift', title: 'The reply-all apocalypse', text: () => 'Someone replied-all to the whole company asking “who took my yoghurt”. 400 people are now replying-all “please remove me from this list”.', choices: [
      { label: 'Reply-all “please stop replying-all”', note: 'Join the chaos', apply: (_s, out, m) => { m.mult -= 0.05; out.push({ type: 'gossip', key: 'replyall' }); return { text: 'You became part of the problem. IT have been called. HR have been called.', tone: 'bad' }; } },
      { label: 'Quietly set up a filter', note: 'Galaxy brain', apply: (s, _o, m) => { gainSkill(s, 'brains', 0.15); m.mult += 0.05; return 'Your inbox is calm. You are the eye of the storm. +5% pay.'; } },
    ] },
    { id: 'st_call', emoji: '📞', kicker: 'Mid-shift', title: '“Quick call? 5 mins?”', text: () => 'Linda wants a “quick call”. It is never 5 minutes. It is never quick.', choices: [
      { label: 'Camera on', note: 'Professional', apply: (_s, _o, m) => { m.mult += 0.05; return '47 minutes. You nodded 312 times. Linda says you’re “very engaged”. +5%.'; } },
      { label: 'Camera off, “my wifi’s bad”', note: 'Classic', apply: (s) => { applyFx(s, { mood: 4 }); return 'You ate a whole sandwich during the call. Nobody knew. Living the dream.'; } },
    ] },
  ],
  bus: [
    { id: 'sbus_run', emoji: '🏃', kicker: 'Mid-shift', title: 'Someone running for the bus', text: () => 'A man is sprinting for the 436, waving, shouting “WAIT!”. You’re already pulling away. Rules say you can’t reopen the doors.', choices: [
      { label: 'Open the doors', note: 'Kindness', apply: (s) => { applyFx(s, { mood: 6 }); gainSkill(s, 'charm', 0.1); return 'He got on, out of breath, and said “cheers drive” with his whole soul. The whole top deck clapped.'; } },
      { label: 'Stick to the rules', note: 'Timetable', apply: (_s, _o, m) => { m.mult += 0.05; return 'He made the face. You know the face. But you’re on time, for once. +5%.'; } },
    ] },
    { id: 'sbus_note', emoji: '💷', kicker: 'Mid-shift', title: '“Does this go to Peckwell?”', text: () => 'A tourist asks if this bus goes to Peckwell. The bus says PECKWELL on the front, the side and the back, in letters a metre high.', choices: [
      { label: '“Yes, love.”', note: 'Saintly patience', apply: (_s, _o, m) => { m.bonus += 3; return 'They gave you a Toblerone as thanks. Customer service legend. (+£3 worth of chocolate.)'; } },
      { label: 'Point at the sign. Slowly.', note: 'Petty', apply: (s) => { applyFx(s, { mood: 3 }); return 'They looked at the sign. They looked at you. “So… is that a yes?”'; } },
    ] },
  ],
  rider: [
    { id: 'sr_bins', emoji: '🗑️', kicker: 'At the door', title: '“Could you take the bins out while you’re here?”', text: () => 'The customer opens the door in a dressing gown, takes the chicken, and asks if you could “just pop the bins out” on your way.', choices: [
      { label: 'Go on then', note: '+tip, time -', apply: (_s, _o, m) => { m.bonus += 4; return 'You took the bins out. They tipped £4. You are now a delivery rider AND a waste management consultant.'; } },
      { label: '“That’s not really my job, sorry”', note: 'Boundaries', apply: () => 'They said “fair enough” and shut the door. Boundaries: respected. Tip: none.' },
    ] },
    { id: 'sr_dog', emoji: '🐕', kicker: 'At the door', title: 'There is a very good dog', text: () => 'A golden retriever answers the door before the human does. It is holding a slipper. It wants you to have the slipper.', choices: [
      { label: 'Pat the dog', note: 'Mood +', apply: (s) => { applyFx(s, { mood: 10, social: 6 }); return 'Best 30 seconds of your week. The human tipped you for “making Barry’s day”.'; } },
      { label: 'Professional nod and leave', note: 'On schedule', apply: (_s, _o, m) => { m.bonus += 1; return 'You were professional. Barry was devastated. You were 30 seconds quicker.'; } },
    ] },
  ],
};

// ------------------------------------------------------------------ resolving
export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries([...EVENTS, REVIEW, ...Object.values(SHIFT_CARDS).flat()].map((e) => [e.id, e]));
export const titleOf = (e: EventDef, s: SaveState) => (typeof e.title === 'function' ? e.title(s) : e.title);
export function choiceBlocked(s: SaveState, c: EventChoice) {
  return c.req?.(s) ?? null;
}
export function resolveChoice(s: SaveState, e: EventDef, idx: number, out: GameEvent[], mods: ShiftMods = { bonus: 0, mult: 1 }): Outcome {
  const c = e.choices[idx];
  const why = choiceBlocked(s, c);
  if (why) return { text: why, tone: 'bad' };
  const r = c.apply(s, out, mods);
  return typeof r === 'string' ? { text: r, tone: 'info' } : r;
}

/** Pick a random eligible event from the deck (or null). */
export function rollEvent(s: SaveState, t = now()): EventDef | null {
  const lt = london(t);
  const pool = EVENTS.filter((e) => e.weight && (!e.when || e.when(s, lt)) && t - (s.eventLog[e.id] ?? 0) > (e.cooldownDays ?? 3) * 86400000);
  const total = pool.reduce((a, e) => a + (e.weight ?? 0), 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight ?? 0;
    if (r <= 0) return e;
  }
  return null;
}

/** Live play: a card every 5-9 minutes of actively playing; one shortly after you start a new day. */
/** debug harness switch: stop random cards popping up mid-screenshot */
export const eventDebug = { off: false };
tickHooks.push((s, ctx, out) => {
  if (!ctx.active || ctx.onShift || eventDebug.off) return;
  const t = now();
  if (t < s.nextEventAt) return;
  s.nextEventAt = t + (5 + Math.random() * 4) * 60000;
  const e = rollEvent(s, t);
  if (!e) return;
  s.eventLog[e.id] = t;
  out.push({ type: 'card', id: e.id });
});
dailyHooks.push((s) => {
  s.nextEventAt = Math.min(s.nextEventAt, now() + 45000);
});

// ------------------------------------------------------------------ prepayment meter + damp
export const EMERGENCY_CREDIT = 5;
export const meterDaily = (t: LondonTime) => 1.8 + (isWinter(t) ? 0.9 : 0);
dailyHooks.push((s, out, key, missed) => {
  if (!renting(s)) return;
  const t = london(new Date(key + 'T12:00:00Z').getTime());
  const before = s.meter;
  // days you weren't around still use power (the fridge doesn't stop), but they never eat into emergency credit
  const floor = missed ? Math.min(before, 0) : -EMERGENCY_CREDIT;
  s.meter = r2(Math.max(floor, s.meter - meterDaily(t)));
  if (missed) {
    if (before > 0 && s.meter <= 0) out.push({ type: 'phone', from: 'Power company-ish', text: 'Your meter ran dry while you were away. Top up at any PayPoint-ish (Kwik Mart) or you’ll be on emergency credit.', tone: 'bad', quiet: true });
  } else if (before > 3 && s.meter <= 3 && s.meter > 0) out.push({ type: 'card', id: 'meterlow' });
  else if ((before > 0 || (before === 0 && s.meter < 0)) && s.meter <= 0) out.push({ type: 'phone', from: 'Power company-ish', text: `Your meter’s run dry, so you’re on emergency credit (£${EMERGENCY_CREDIT}). Top up at any PayPoint-ish (Kwik Mart). The emergency credit gets paid back first.`, tone: 'bad' });
  else if (!missed && before > -EMERGENCY_CREDIT && s.meter <= -EMERGENCY_CREDIT) out.push({ type: 'phone', from: 'Power company-ish', text: 'Emergency credit used up. Your electric is OFF: no heating, no kettle, cold showers. Top up the key at Kwik Mart.', tone: 'bad' });
  // damp creeps in, faster in winter and if you never put the heating on
  const heated = s.flags.heatedDay === addDays(key, -1) || s.flags.heatedDay === key;
  // an empty flat gets damp too, but slower than one you're breathing and showering in
  s.damp = Math.min(100, s.damp + HOMES[s.home].dampRate * (isWinter(t) ? 1.5 : 1) * (heated ? 0.5 : 1.2) * (missed ? 0.6 : 1));
  if (s.damp >= 60 && !s.flags.dampWarned) {
    s.flags.dampWarned = true;
    out.push({ type: 'phone', from: 'Auntie Bev', text: 'Love, is that black mould on your window? Bleach, open the window every morning, and nag your landlord. In that order. x', tone: 'info', quiet: true });
  }
});
export const hasPower = (s: SaveState) => !renting(s) || s.meter > -EMERGENCY_CREDIT;

// ------------------------------------------------------------------ Universal Credit-ish
export const UC_BASE = 92;
export const UC_WORK_ALLOWANCE = 100;
export const UC_TAPER = 0.55;
export const UC_SEARCHES = 2;
export function nextWeekday(key: string, add: number) {
  let k = addDays(key, add);
  for (let i = 0; i < 3; i++) {
    const d = new Date(k + 'T12:00:00Z').getUTCDay(); // 0 Sun, 6 Sat
    if (d !== 0 && d !== 6) break;
    k = addDays(k, 1);
  }
  return k;
}
/** This week's award, before it's paid. */
export function ucAward(s: SaveState) {
  const housing = renting(s) ? Math.round(s.rent * 0.5) : 0;
  const taper = Math.max(0, s.uc.weekEarned - UC_WORK_ALLOWANCE) * UC_TAPER;
  const sanction = s.uc.sanctioned ? UC_BASE * 0.5 : 0;
  return { base: UC_BASE, housing, taper: r2(taper), sanction, total: r2(Math.max(0, UC_BASE + housing - taper - sanction)) };
}
weeklyHooks.push((s, out) => {
  const met = s.uc.searches >= UC_SEARCHES;
  if (s.uc.claiming) {
    if (!met) {
      if (s.flags.ucWarned) {
        s.uc.sanctioned = true;
        addMoodlet(s, 'sanctioned');
      } else s.flags.ucWarned = true;
    }
    const a = ucAward(s);
    s.money = r2(s.money + a.total);
    const lines = [{ label: 'Standard allowance', amount: -a.base }];
    if (a.housing) lines.push({ label: 'Housing element', amount: -a.housing });
    if (a.taper) lines.push({ label: `Earnings taper (55% over ${money(UC_WORK_ALLOWANCE)})`, amount: a.taper });
    if (a.sanction) lines.push({ label: 'Sanction (missed commitments)', amount: a.sanction });
    out.push({ type: 'phone', from: 'Universal Credit-ish journal', text: `Your payment of ${money(a.total)} is in your account.${s.uc.searches < UC_SEARCHES ? `\n\nYou logged ${s.uc.searches}/${UC_SEARCHES} job searches this week. ${s.uc.sanctioned ? 'A sanction has been applied.' : 'This is a warning.'} (Use the library Wi-Fi or the Jobcentre job board.)` : ''}`, tone: a.sanction ? 'bad' : 'good', lines, quiet: false });
  }
  s.uc.weekEarned = 0;
  s.uc.searches = 0;
  if (met) s.flags.ucWarned = false;
  s.uc.sanctioned = false;
});
dailyHooks.push((s, out, key, missed) => {
  // missed days are judged once, on the day you're back (one sanction, not one per day)
  if (missed || !s.uc.claiming || !s.uc.appt) return;
  if (s.uc.appt < key && !s.uc.attended) {
    s.uc.sanctioned = true;
    addMoodlet(s, 'sanctioned');
    s.uc.appt = nextWeekday(key, 1);
    out.push({ type: 'phone', from: 'Universal Credit-ish journal', text: `You missed your work coach appointment. A sanction will be applied to your next payment. Your new appointment is ${s.uc.appt} at Jobcentre Minus, between 9am and 5pm.`, tone: 'bad' });
  } else if (s.uc.appt === key && !s.uc.attended) {
    out.push({ type: 'phone', from: 'Universal Credit-ish journal', text: 'Reminder: you have a work coach appointment at Jobcentre Minus TODAY. Any time between 9am and 5pm (or whenever Sandra goes for lunch).', tone: 'info', quiet: true });
  }
});
export const ucFns = {
  claim(s: SaveState) {
    s.uc = { claiming: true, appt: nextWeekday(today(), 1), attended: false, searches: 0, weekEarned: s.uc.weekEarned, sanctioned: false };
  },
  attend(s: SaveState) {
    s.uc.searches += 1;
    removeMoodlet(s, 'sanctioned');
    // next one in a week (attended resets for the new appointment)
    s.uc.appt = nextWeekday(today(), 7);
    s.uc.attended = false;
    s.flags.ucLastAttended = today();
  },
  close(s: SaveState) {
    s.uc.claiming = false;
    s.uc.appt = '';
  },
};

// pay mood into the economy (used by the UI for shift pay)
export const moodNow = (s: SaveState, raining: boolean) => effectiveMood(s, raining);
