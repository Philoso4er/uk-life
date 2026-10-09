// Every door in Peckwell has a menu of quick, timed things to do. Each action has
// nominal in-game minutes (which age your needs) but completes in 4-40 real seconds.
import type { GoalId, NeedId, SaveState, SkillId } from './types';
import { HOMES, weeklyHooks, actionSecs, chance, completeGoal, gainMoodlet, gainSkill, money, pick, type GameEvent, type Tone } from './economy';
import { MOODLETS, applyFx, effectiveMood, hasMoodlet, passTime, removeMoodlet } from './needs';
import { london, now, type LondonTime } from './time';
import { OWNING_ACTIONS } from './owning';
import { EMERGENCY_CREDIT, UC_SEARCHES, hasPower, ucAward, ucFns } from './events';

export interface ActionCtx {
  raining: boolean;
  /** NPC regulars about (for rounds) */
  regulars: number;
  t: LondonTime;
}

type Fx = Partial<Record<NeedId | 'mood', number>>;

export interface ActionDef {
  id: string;
  place: string | string[];
  emoji: string;
  label: string;
  note: string;
  mins: number;
  cost?: number;
  /** label for the price column when it isn't paid in cash (e.g. meter credit) */
  price?: string;
  costFn?: (s: SaveState, c: ActionCtx) => number;
  fx?: Fx;
  skill?: [SkillId, number];
  moodlet?: string;
  /** real minutes before you can do it again */
  cooldown?: number;
  /** London opening hours [from, to); wraps past midnight if from > to */
  hours?: [number, number];
  /** still available when the building itself is shut (online, a board in the window…) */
  anytime?: boolean;
  outdoors?: boolean;
  gig?: [number, number];
  goal?: GoalId;
  gossip?: string;
  lines: string[];
  progress?: string[];
  req?: (s: SaveState, c: ActionCtx) => string | null;
  hidden?: (s: SaveState, c: ActionCtx) => boolean;
  /** custom outcome; return text to replace the stock line */
  run?: (s: SaveState, c: ActionCtx, out: GameEvent[], r: RunInfo) => string | void;
  /** skip the generic need decay for `mins` (the action handles time itself) */
  noPass?: boolean;
}
export interface RunInfo {
  tone: Tone;
  refund: boolean;
  extraPay: number;
}

const A = (d: ActionDef) => d;
const openNow = (h: [number, number] | undefined, t: LondonTime) => {
  if (!h) return true;
  const [a, b] = h;
  return a < b ? t.hh >= a && t.hh < b : t.hh >= a || t.hh < b;
};
const hh = (n: number) => `${String(n % 24).padStart(2, '0')}:00`;

/** Buildings that shut as a whole (every action inside, unless it's marked `anytime`). */
export const PLACE_HOURS: Record<string, { hours: [number, number]; days: number[]; label: string }> = {
  jobcentre: { hours: [9, 17], days: [0, 1, 2, 3, 4], label: 'Mon–Fri, 9am–5pm' },
};
export function placeOpen(placeId: string, t: LondonTime) {
  const ph = PLACE_HOURS[placeId];
  return !ph || (ph.days.includes(t.dayIdx) && openNow(ph.hours, t));
}
const member = (s: SaveState) => s.owned.items.includes('gym');
const todayCount = (s: SaveState, key: string) => {
  const k = `${key}:${london().dateKey}`;
  return Number(s.flags[k] ?? 0);
};
const bumpToday = (s: SaveState, key: string) => {
  const k = `${key}:${london().dateKey}`;
  s.flags[k] = Number(s.flags[k] ?? 0) + 1;
  return s.flags[k] as number;
};

const QUIZ_TEAMS = ['Quiz Akabusi', 'Les Quizerables', 'Universally Challenged', 'Agatha Quiztie', 'Tequila Mockingbird', 'Quiztopher Columbus', 'The Usual Suspects (Big Tel & Co)', 'Smarty Pints', 'Norfolk & Chance', 'E=MC Hammer'];
const HORSES = [
  { name: 'Clive’s Revenge', odds: 8 },
  { name: 'Rain Delayed', odds: 3 },
  { name: 'Signal Failure', odds: 12 },
  { name: 'Mind The Gap', odds: 5 },
  { name: 'Two Wings And Chips', odds: 2 },
  { name: 'Nigel’s Deposit', odds: 20 },
  { name: 'Lovely Weather', odds: 6 },
];
const HEADLINES = ['“LOCAL MAN SEES SUN, CALLS 999”', '“PECKWELL PIGEON NOW RUNNING FOR COUNCIL”', '“HOUSE PRICES UP 4%. YOUR HOUSE: STILL NONE”', '“RAIN EXPECTED. EXPERTS: ‘YEAH, OBVIOUSLY’”', '“436 BUS SPOTTED ON TIME, WITNESSES IN SHOCK”', '“SAUSAGE ROLL SHORTAGE ‘NOT A CRISIS’ SAYS NO ONE”'];

export const ACTIONS: ActionDef[] = [
  // ------------------------------------------------------------ Crumbs & Co. (bakery)
  A({ id: 'sroll', place: 'crumbs', emoji: '🥐', label: 'Sausage roll', note: 'Flaky. Iconic. Gets everywhere.', mins: 10, cost: 1.35, fx: { hunger: 28, mood: 3 }, moodlet: 'had_crumbs', goal: 'sausage', gossip: 'sausage', progress: ['Joining the queue…', '“Next please!”', 'Pastry incoming…'], lines: ['You ate it on the walk out. Pastry on your coat until Thursday.', '“Warm one, love?” It is perfect. You are perfect.', 'Gone in four bites. You considered a second. You are only human.'], run: (s) => { s.stats.sausageRolls++; } }),
  A({ id: 'vroll', place: 'crumbs', emoji: '🌱', label: 'Vegan sausage roll', note: 'Smugness included free. If they have any.', mins: 10, cost: 1.45, fx: { hunger: 26, mood: 4 }, goal: 'sausage', lines: ['Honestly? Better than the real one. You will be telling people this.'], run: (s, _c, out, r) => { if (chance(0.3)) { r.refund = true; r.tone = 'bad'; return '“We’re out of the vegan ones. We’re always out of the vegan ones.” No charge, no roll.'; } s.stats.sausageRolls++; gainMoodlet(s, 'smug', out); } }),
  A({ id: 'steak', place: 'crumbs', emoji: '🥩', label: 'Steak bake', note: 'Lava-hot for 45 minutes.', mins: 12, cost: 2.15, fx: { hunger: 38, mood: 2, warmth: 6 }, lines: ['You waited for it to cool. Wisdom.', 'Proper filling. You won’t need lunch. (You will have lunch.)'], run: (s, _c, out, r) => { if (chance(0.35)) { gainMoodlet(s, 'burnt_gob', out); r.tone = 'bad'; return 'You bit straight in. The filling was the temperature of the sun. As warned.'; } } }),
  A({ id: 'coffee', place: 'crumbs', emoji: '☕', label: 'Filter coffee', note: 'Tastes like a warm Tuesday.', mins: 8, cost: 1.6, fx: { energy: 14, warmth: 8 }, lines: ['Hot, brown, adequate. Like Britain.', 'You burnt your tongue. You’ll do it again tomorrow.'] }),
  A({ id: 'donut', place: 'crumbs', emoji: '🍩', label: 'Iced ring doughnut', note: 'Pink icing, sprinkles, regret.', mins: 6, cost: 1.1, fx: { hunger: 10, mood: 7, energy: 4 }, lines: ['Sprinkles on your chin for the rest of the day. Nobody tells you.'] }),
  A({ id: 'warmones', place: 'crumbs', emoji: '🙏', label: 'Ask if there’s any warm ones', note: 'Free. Bold. Very British.', mins: 4, cooldown: 60, lines: ['“They’re ALL warm, love. It’s a bakery.” Fair.', '“Give it five minutes.” You do not have five minutes.'], run: (s, _c, out, r) => { if (chance(0.25)) { applyFx(s, { hunger: 20 }); gainMoodlet(s, 'had_crumbs', out); r.tone = 'good'; return 'She slides a free warm one across the counter. “Don’t tell anyone.” You will tell everyone.'; } } }),
  A({ id: 'rush', place: 'crumbs', emoji: '🧹', label: 'Help with the 8am rush', note: 'Cash in hand. Mornings only.', mins: 90, gig: [9, 14], hours: [6, 11], cooldown: 120, fx: { energy: -12, social: 10 }, skill: ['graft', 0.2], lines: ['You handed out 214 sausage rolls. You can hear them when you close your eyes.', 'A man tried to pay with a Scottish tenner. You coped.'] }),

  // ------------------------------------------------------------ Kwik Mart (corner shop)
  A({ id: 'mealdeal', place: 'kwik', emoji: '🥪', label: 'Meal deal', note: 'Sandwich, crisps, drink. Peak British engineering.', mins: 15, cost: 3.5, fx: { hunger: 36, mood: 5 }, lines: ['Chicken & bacon, prawn cocktail crisps, a Ribena-ish. Correct.', 'You agonised over the drink for four minutes. Classic.'] }),
  A({ id: 'energydrink', place: 'kwik', emoji: '⚡', label: 'Energy drink (500ml)', note: 'Your heart will remember this.', mins: 4, cost: 1.49, fx: { energy: 30, mood: -2 }, moodlet: 'wired', lines: ['You can hear colours now.', 'Tastes like a melted Haribo. Works though.'] }),
  A({ id: 'teabags', place: 'kwik', emoji: '🫖', label: 'Teabags (80)', note: '+20 cuppas at home. Basic human right.', mins: 4, cost: 2.2, lines: ['Stocked up. Crisis averted.'], run: (s) => { s.inv.teabags += 20; } }),
  A({ id: 'crisps', place: 'kwik', emoji: '🥔', label: 'Prawn cocktail crisps', note: 'Correct flavour. Fight me.', mins: 4, cost: 0.9, fx: { hunger: 8, mood: 3 }, lines: ['Pink dust on your fingers. Worth it.'] }),
  A({ id: 'brolly', place: 'kwik', emoji: '☂️', label: 'Umbrella', note: 'Keeps you dry. Lost within 3 days. It’s the law.', mins: 4, cost: 8, hidden: (s) => s.umbrellaUntil > s.life, lines: ['Brolly acquired. Rain-proof for about 3 days, until you leave it on a bus.'], run: (s) => { s.umbrellaUntil = s.life + 3 * 1440; removeMoodlet(s, 'soaked'); } }),
  A({ id: 'scratch', place: 'kwik', emoji: '🎟️', label: 'Scratchcard', note: 'Could win £500! (Will not win £500.)', mins: 4, cost: 2, cooldown: 5, lines: [''], run: (_s, _c, _o, r) => { const win = pick([0, 0, 0, 0, 0, 0, 1, 2, 2, 5, 10, 50]); r.extraPay = win; r.tone = win ? 'good' : 'bad'; return win ? `You won ${money(win)}! Don’t spend it all at once. (You will spend it on scratchcards.)` : 'Nothing. Two matching symbols and then a picture of a fish. Shocking.'; } }),
  A({ id: 'oystertop', place: ['kwik', 'broadway', 'albion', 'common'], emoji: '💳', label: 'Oyster top-up £10', note: 'For the Tube and the 436.', mins: 4, cost: 10, lines: ['Oyster topped up. The machine took your card, thought about it, and gave it back.'], run: (s) => { s.oyster = Math.round((s.oyster + 10) * 100) / 100; } }),
  A({ id: 'meter10', place: 'kwik', emoji: '🔌', label: 'Top up the electric key (£10)', note: 'Pays back emergency credit first.', mins: 4, cost: 10, hidden: (s) => s.home === 'sofa', lines: ['The PayPoint-ish machine beeped, thought about it, and printed a receipt the length of your arm. Topped up.'], run: (s) => { s.meter = Math.round((s.meter + 10) * 100) / 100; } }),
  A({ id: 'meter20', place: 'kwik', emoji: '🔋', label: 'Top up the electric key (£20)', note: 'For the heating-on lifestyle.', mins: 4, cost: 20, hidden: (s) => s.home === 'sofa', lines: ['£20 on the key. You feel like an oligarch.'], run: (s) => { s.meter = Math.round((s.meter + 20) * 100) / 100; } }),
  A({ id: 'shopnatter', place: 'kwik', emoji: '🗞️', label: 'Chat to the shopkeeper about the weather', note: 'Free. Twenty minutes. Nothing resolved.', mins: 20, cooldown: 30, fx: { social: 16, mood: 3 }, moodlet: 'natter', lines: ['“Nippy out.” “It is nippy.” “Proper nippy.” A profound exchange.', 'You learned about his cousin’s van, his knee, and a shortcut to Croydon you will never use.'] }),

  // ------------------------------------------------------------ Prêt-à-Pricey (café)
  A({ id: 'flatwhite', place: 'pret', emoji: '☕', label: 'Oat flat white', note: 'Microfoam. Macro-price.', mins: 10, cost: 3.95, fx: { energy: 26, mood: 4, warmth: 6 }, lines: ['They wrote “Jhon” on it. You are not John.', 'It has a leaf on it. You photographed the leaf.'] }),
  A({ id: 'avo', place: 'pret', emoji: '🥑', label: 'Smashed avo on sourdough', note: 'Why you can’t afford a house, apparently.', mins: 20, cost: 6.95, fx: { hunger: 30, mood: 10 }, lines: ['Delicious. A newspaper columnist somewhere felt a disturbance.'] }),
  A({ id: 'crayfish', place: 'pret', emoji: '🌯', label: 'Crayfish & rocket wrap', note: 'Nobody has ever wanted this.', mins: 15, cost: 5.25, fx: { hunger: 26, mood: 2 }, lines: ['You bought it anyway. Mostly rocket.'] }),
  A({ id: 'cookie', place: 'pret', emoji: '🍪', label: 'Dark choc cookie', note: 'Size of a dinner plate.', mins: 6, cost: 2.4, fx: { hunger: 10, mood: 9 }, lines: ['Still warm. Briefly, life is good.'] }),
  A({ id: 'laptop', place: 'pret', emoji: '💻', label: 'Nurse one coffee for three hours', note: 'Wi-Fi, warmth, the judgement of staff.', mins: 180, cost: 3.95, cooldown: 90, fx: { energy: 10, warmth: 20 }, skill: ['brains', 0.3], moodlet: 'digital_nomad', lines: ['You typed “the” in a document, then checked your phone 140 times.', 'You updated your LinkedIn headline to “Visionary”. Bold.'] }),

  // ------------------------------------------------------------ PFC
  A({ id: 'wings', place: 'pfc', emoji: '🍗', label: '2 wings & chips', note: 'Greatest value in the UK.', mins: 12, cost: 2.99, fx: { hunger: 40, mood: 4, energy: -2 }, lines: ['A national treasure. Should be on the £5 note.', 'Extra hot sauce. You were not consulted.'], run: (s, c, out) => { if (c.t.hh >= 22 || c.t.hh < 4) { gainMoodlet(s, 'hit_different', out); return 'Late-night PFC. It hits different. Spiritual, almost.'; } } }),
  A({ id: 'boxmeal', place: 'pfc', emoji: '🍔', label: 'Box meal (+ can)', note: 'Burger, wings, chips, a Tango-ish.', mins: 15, cost: 5.5, fx: { hunger: 60, mood: 7, energy: -4 }, lines: ['You are now 60% chips. Happy though.'] }),
  A({ id: 'gravy', place: 'pfc', emoji: '🍟', label: 'Chips & gravy', note: 'Northern visitors approve.', mins: 10, cost: 2.2, fx: { hunger: 22, mood: 5, warmth: 6 }, lines: ['Warm hands, warm heart, gravy on your sleeve.'] }),

  // ------------------------------------------------------------ The Leaky Brolly (pub)
  A({ id: 'pint', place: 'pub', emoji: '🍺', label: 'Pint of lager', note: '£7.20. Nobody knows why.', mins: 30, cost: 7.2, fx: { mood: 16, social: 10, energy: -6 }, goal: 'pint', progress: ['Catching the barmaid’s eye…', 'Pouring…', 'Finding somewhere to stand…'], lines: ['Cold, fizzy, slightly overpriced. Perfect.', 'Big Tel nodded at you from across the bar. You’re in.'], run: (s, _c, out) => { s.stats.pints++; const n = bumpToday(s, 'pints'); if (chance(0.3)) gainMoodlet(s, 'tipsy', out); if (n >= 3) { gainMoodlet(s, 'hungover', out); return 'Pint number three. Your future self has lodged a formal complaint.'; } } }),
  A({ id: 'round', place: 'pub', emoji: '🍻', label: 'Get a round in', note: 'For you and the regulars. Legend behaviour.', mins: 45, costFn: (_s, c) => Math.round(7.2 * (Math.max(2, Math.min(5, c.regulars)) + 1) * 100) / 100, cooldown: 30, fx: { social: 35, mood: 12, energy: -6 }, moodlet: 'generous', gossip: 'round', goal: 'pint', lines: ['“Cheers!” x5. Your name is now spoken with respect at the Brolly.', 'You carried six pints in a triangle formation. Not one drop spilled. Mostly.'], run: (s, _c, out) => { s.stats.pints++; if (chance(0.35)) { applyFx(s, { mood: 8 }); gainMoodlet(s, 'tipsy', out); return 'You got a round in. Then Big Tel got the next one in. Then it was 11pm somehow.'; } } }),
  A({ id: 'quiz', place: 'pub', emoji: '🧠', label: 'Pub quiz (£2 entry)', note: 'Tuesdays: the Big Quiz, £50 prize. Other nights: £20.', mins: 120, cost: 2, hours: [18, 24], cooldown: 120, fx: { social: 20 }, skill: ['brains', 0.2], progress: ['Picking a team name…', 'Round 1: General Knowledge…', 'Picture round (who IS that?)…', 'Arguing about the capital of Australia…', 'Marking…'], lines: [''], run: (s, c, out, r) => { const tue = c.t.dayIdx === 1; const p = Math.min(0.75, 0.22 + s.skills.brains * 0.05 + (s.social > 60 ? 0.05 : 0)); const team = pick(QUIZ_TEAMS); const prize = tue ? 50 : 20; if (chance(p)) { r.extraPay = prize; r.tone = 'good'; s.stats.quizWins++; gainMoodlet(s, 'quiz_champs', out); completeGoal(s, 'quiz', out); out.push({ type: 'gossip', key: 'quiz_win' }); return `Your team, "${team}", WON by one point (the capital of Australia is Canberra, Kev). Prize: ${money(prize)} bar tab, paid in cash because the card machine’s down.`; } r.tone = 'bad'; gainMoodlet(s, 'quiz_shame', out); out.push({ type: 'gossip', key: 'quiz_lose' }); return `Fourth out of five. Beaten by "${pick(QUIZ_TEAMS.filter((x) => x !== team))}". You knew the answer to the music round. You said nothing. Why did you say nothing.`; } }),
  A({ id: 'quizmachine', place: 'pub', emoji: '🎰', label: 'Quiz machine (£1)', note: 'The quiz is 6pm-midnight. The machine never sleeps.', mins: 10, cost: 1, cooldown: 5, hidden: (_s, c) => c.t.hh >= 18, lines: [''], run: (s, _c, _o, r) => { if (chance(0.2 + s.skills.brains * 0.03)) { r.extraPay = 5; r.tone = 'good'; return 'You knew the year of the Battle of Hastings (1066, the only date anyone knows). Won £5.'; } r.tone = 'bad'; return 'Question: “Who won the 1987 Eurovision?” Nobody knows. The machine knows. The machine always knows.'; } }),
  A({ id: 'pool', place: 'pub', emoji: '🎱', label: 'Game of pool', note: '£1 on the table.', mins: 20, cost: 1, fx: { social: 8, mood: 4 }, lines: [''], run: (s, _c, _o, r) => { if (chance(0.4 + s.skills.fitness * 0.02 + s.skills.charm * 0.02)) { r.tone = 'good'; return 'You potted the black off three cushions. Nobody saw. You will describe it for years.'; } r.tone = 'bad'; return 'You lost to a 70-year-old called Pat who didn’t take her coat off.'; } }),
  A({ id: 'fire', place: 'pub', emoji: '🔥', label: 'Dry off by the fire', note: 'With a lime & soda (50p). Nobody minds.', mins: 25, cost: 0.5, fx: { warmth: 40, mood: 4 }, moodlet: 'toasty', lines: ['Your coat steamed gently. Clive the dog joined you.', 'Toasty. You may never leave.'], run: (s) => { removeMoodlet(s, 'soaked'); } }),
  A({ id: 'roast', place: 'pub', emoji: '🍖', label: 'Sunday roast', note: 'Yorkshire pudding the size of your head.', mins: 60, cost: 18.5, fx: { hunger: 70, mood: 20, warmth: 10 }, lines: [''], run: (s, c, out) => { if (c.t.dayIdx === 6) { gainMoodlet(s, 'smug', out); return 'A proper Sunday roast, on a Sunday. Correct, and very British. Gravy everywhere.'; } return `A roast on a ${c.t.day === 'Mon' ? 'Monday' : 'weekday'}. Rebellious. The Yorkshires are slightly suspicious.`; } }),
  A({ id: 'clive', place: 'pub', emoji: '🐕', label: 'Pat Clive the dog', note: 'Free. Clive is a good boy.', mins: 5, cooldown: 20, fx: { mood: 6, social: 5 }, lines: ['Clive leant his whole weight on your leg. An honour.', 'Clive rolled over. Best part of your week.'] }),
  A({ id: 'justone', place: 'pub', emoji: '🥴', label: '“Just the one”', note: 'It is never just the one.', mins: 150, cost: 21.6, cooldown: 120, fx: { mood: 26, social: 30, energy: -20, hunger: -6 }, moodlet: 'tipsy', gossip: 'justone', lines: ['It was not just the one. It was three and a packet of Scampi Fries.'], run: (s, _c, out) => { s.stats.pints += 3; gainMoodlet(s, 'hungover', out); } }),
  A({ id: 'glasses', place: 'pub', emoji: '🧽', label: 'Collect glasses (cash in hand)', note: 'Noon till close.', mins: 90, gig: [10, 16], hours: [12, 24], cooldown: 60, fx: { energy: -10, social: 6 }, skill: ['graft', 0.15], lines: ['You found a fiver, a set of keys and someone’s dignity under table 6.', 'Twelve “cheers love”s and a tip in coins. Lovely.'] }),

  // ------------------------------------------------------------ Peckwell Library
  A({ id: 'wifi', place: 'library', emoji: '📶', label: 'Free Wi-Fi job search', note: 'Counts as a job search for the Jobcentre.', mins: 30, hours: [9, 20], cooldown: 10, skill: ['brains', 0.1], lines: ['You applied for 3 jobs. One wants 5 years’ experience for an entry-level role. Classic.', 'You found a job ad for “Chief Happiness Officer”. You closed the tab.'], run: (s) => { s.uc.searches++; } }),
  A({ id: 'wifisteps', place: 'library', emoji: '🪜', label: 'Leech the Wi-Fi from the steps', note: 'Library’s shut. The Wi-Fi isn’t.', mins: 30, outdoors: true, cooldown: 10, hidden: (_s, c) => openNow([9, 20], c.t), lines: ['One bar of signal if you hold your phone above your head. You did 2 job searches like the Statue of Liberty.'], run: (s) => { s.uc.searches++; } }),
  A({ id: 'read', place: 'library', emoji: '📚', label: 'Read a book', note: 'Free. Quiet. Warm.', mins: 45, hours: [9, 20], fx: { mood: 5, warmth: 10 }, skill: ['brains', 0.3], lines: ['You read half a history of the Tudors. Henry VIII: what a guy.', 'You read a whole cookbook. You will make none of it.'] }),
  A({ id: 'warmspace', place: 'library', emoji: '♨️', label: 'Warm Space: sit by the radiator', note: 'Free, warm, nobody asks questions.', mins: 40, hours: [9, 20], fx: { warmth: 35, social: 5 }, moodlet: 'toasty', lines: ['The radiator is on full. You are one with the radiator.', 'You and three pensioners shared a silent, warm understanding.'], run: (s) => { removeMoodlet(s, 'soaked'); } }),
  A({ id: 'course', place: 'library', emoji: '🎓', label: 'Free course: “Excel for Absolute Beginners”', note: 'Once a day. Brains +1.', mins: 240, hours: [9, 20], cooldown: 24 * 60, fx: { energy: -10 }, skill: ['brains', 1], lines: ['You learned VLOOKUP. You are now dangerous.', 'You made a pie chart. Then another pie chart. Power.'] }),
  A({ id: 'cv', place: 'library', emoji: '🖨️', label: 'Print your CV', note: '20p a page. Impresses work coaches.', mins: 10, cost: 0.2, hours: [9, 20], lines: ['The printer jammed. You fixed it. You are now the library’s IT department.'], run: (s) => { s.flags.cv = true; } }),
  A({ id: 'rhymetime', place: 'library', emoji: '🎵', label: 'Volunteer at Rhyme Time', note: 'Unpaid. Paid in toddler hugs and a biscuit.', mins: 60, hours: [9, 17], cooldown: 120, fx: { social: 20, mood: 8 }, skill: ['charm', 0.3], lines: ['You sang “Wind the Bobbin Up” eleven times. You will hear it in your sleep.'] }),

  // ------------------------------------------------------------ Spin City Launderette
  A({ id: 'wash', place: 'laundry', emoji: '🧺', label: 'Service wash', note: 'Clean everything. Lose one sock.', mins: 60, cost: 4.5, fx: { hygiene: 40, mood: 4 }, moodlet: 'fresh_laundry', gossip: 'laundry', lines: ['Clean clothes! One sock is missing. It always will be.', 'Machine 4 works. Nobody knew machine 4 worked. You are a pioneer.'] }),
  A({ id: 'dryers', place: 'laundry', emoji: '🌀', label: 'Stand next to the tumble dryers', note: 'Free central heating.', mins: 15, fx: { warmth: 28 }, lines: ['Warm, slightly linty, totally free.'], run: (s) => { removeMoodlet(s, 'soaked'); } }),
  A({ id: 'watchmachines', place: 'laundry', emoji: '👀', label: 'Watch the machines go round', note: 'Better than telly.', mins: 20, fx: { mood: 6, energy: 4 }, lines: ['Hypnotic. You saw a red sock go into a white wash. You said nothing.'] }),
  A({ id: 'towels', place: 'laundry', emoji: '🧻', label: 'Help the towel man fold', note: 'He has been folding since 2011.', mins: 60, gig: [6, 9], cooldown: 60, fx: { social: 10 }, lines: ['He told you his name is Ray. Ray has never said his name before. Huge moment.'] }),

  // ------------------------------------------------------------ The park: pond, bandstand, allotments
  A({ id: 'ducks', place: 'pond', emoji: '🦆', label: 'Feed the ducks (peas, not bread)', note: 'The sign is very clear about bread.', mins: 15, cost: 0.4, outdoors: true, fx: { mood: 8, social: 3 }, goal: 'ducks', gossip: 'ducks', lines: [''], run: (s, _c, out, r) => { s.stats.ducksFed++; if (chance(0.13)) { gainMoodlet(s, 'swanned', out); r.tone = 'bad'; out.push({ type: 'gossip', key: 'swanned' }); return 'A swan has entered the chat. It chased you round the pond twice. The ducks ate your peas while you were busy.'; } gainMoodlet(s, 'duck_whisperer', out); return pick(['The ducks went absolutely feral for the peas. A moorhen gave you a nod.', 'A duck called Gerald (you named him) ate from your hand. Spiritual.', 'You fed the ducks. A toddler watched you with deep respect.']); } }),
  A({ id: 'bench', place: 'pond', emoji: '🪑', label: 'Sit on a bench and watch the world', note: 'Free. Sometimes a pigeon joins.', mins: 30, outdoors: true, fx: { mood: 6, energy: 5 }, lines: ['A dog stole a whole baguette. Best thing you’ve seen all week.', 'You watched a man try to fold a map for 20 minutes.'], run: (s, _c, out) => { if (chance(0.25)) { gainMoodlet(s, 'pigeon_pal', out); return 'A one-footed pigeon sat next to you. You are friends now. You call him Steve.'; } } }),
  A({ id: 'trolley', place: 'pond', emoji: '🛒', label: 'Fish the trolley out of the pond', note: 'Council bounty: £5. It’ll be back by Friday.', mins: 40, gig: [5, 5], outdoors: true, cooldown: 180, fx: { hygiene: -15, mood: 4 }, skill: ['fitness', 0.2], gossip: 'trolley', lines: ['You got the trolley out. A duck was living in it. You put the duck back.'] }),
  A({ id: 'busk', place: 'bandstand', emoji: '🎸', label: 'Busk with Tez', note: 'Pay depends on your Charm.', mins: 60, outdoors: true, cooldown: 45, fx: { social: 10, energy: -6 }, skill: ['charm', 0.2], gossip: 'busk', lines: [''], run: (s, _c, _o, r) => { const pay = Math.round((2 + Math.random() * 6 + s.skills.charm * 1.2) * 100) / 100; r.extraPay = pay; return `You and Tez did “Wonderwall” three times. ${money(pay)} in the hat, plus a button and a Polo mint.`; } }),
  A({ id: 'fiveaside', place: 'bandstand', emoji: '⚽', label: 'Five-a-side on the grass', note: 'Jumpers for goalposts.', mins: 60, outdoors: true, fx: { social: 20, energy: -18, hygiene: -15, mood: 8 }, skill: ['fitness', 0.4], gossip: 'five', lines: ['You scored a worldie. Then pulled a hamstring celebrating.', 'Lost 7-3. Blamed the pitch. The pitch is a park.'] }),
  A({ id: 'jog', place: 'bandstand', emoji: '🏃', label: 'Couch-to-5K (couch-to-500m)', note: 'Free. Sweaty.', mins: 30, outdoors: true, fx: { energy: -12, hygiene: -10 }, skill: ['fitness', 0.3], moodlet: 'endorphins', lines: ['You ran one lap of the pond, then walked “to cool down” for 25 minutes.'] }),
  A({ id: 'nan', place: 'allotments', emoji: '👵', label: 'Help Nan with her marrows', note: 'Paid in vegetables and gossip.', mins: 60, outdoors: true, cooldown: 120, fx: { hunger: 15, social: 18, energy: -8 }, skill: ['charm', 0.1], gossip: 'nan', lines: ['Nan gave you a marrow the size of a baby and the full history of the 1987 allotment feud.', 'Nan says you’re “a good one”. Highest honour in Peckwell.'], run: (s) => { s.flags.nanHelps = Number(s.flags.nanHelps ?? 0) + 1; if (s.flags.nanHelps === 2 && !s.owned.allotment) return 'Nan leans in: “Maureen’s giving up her plot. Her knees. I could have a word with the committee…” (Ask about a plot.)'; } }),
  A({ id: 'admireveg', place: 'allotments', emoji: '🥕', label: 'Admire the vegetables', note: 'Free.', mins: 10, outdoors: true, fx: { mood: 4 }, lines: ['A man with a flask explained his compost system for nine minutes. You nodded throughout.'] }),

  // ------------------------------------------------------------ PureGrind 24/7 (gym)
  A({ id: 'workout', place: 'gym', emoji: '🏋️', label: 'Workout', note: 'Day pass £6 (free for members).', mins: 45, costFn: (s) => (member(s) ? 0 : 6), fx: { energy: -16, hygiene: -18, mood: 6 }, skill: ['fitness', 0.5], moodlet: 'endorphins', lines: ['Leg day. You will walk like a cowboy until Thursday.', 'You did one pull-up. Technically half. You’re counting it.'] }),
  A({ id: 'gymshower', place: 'gym', emoji: '🚿', label: 'Use the showers', note: '£2 (free for members). Hot water guaranteed-ish.', mins: 15, costFn: (s) => (member(s) ? 0 : 2), fx: { hygiene: 45, warmth: 12 }, lines: ['Hot, powerful, and nobody’s hair in the drain. A good day.'] }),
  A({ id: 'selfie', place: 'gym', emoji: '📸', label: 'Mirror selfie', note: 'Free. Essential.', mins: 5, cooldown: 30, fx: { social: 6 }, moodlet: 'smug', gossip: 'gym', lines: ['Posted. 3 likes. One from your mum.'] }),
  A({ id: 'sauna', place: 'gym', emoji: '🧖', label: 'Sauna', note: '£3. The warmest you’ll be all winter.', mins: 20, cost: 3, fx: { warmth: 45, hygiene: 5 }, moodlet: 'toasty', lines: ['A man in the sauna told you about his divorce. Very warm, emotionally and literally.'], run: (s) => { removeMoodlet(s, 'soaked'); } }),
  A({ id: 'joingym', place: 'gym', emoji: '💳', label: 'Join (£20 a week, cancel any time*)', note: '*Cancel by fax, in person, during a full moon.', mins: 10, cost: 20, hidden: member, lines: ['You’re a member! Free workouts and showers. Billed every Monday. You’ll definitely use it.'], run: (s) => { s.owned.items.push('gym'); } }),
  A({ id: 'cancelgym', place: 'gym', emoji: '✂️', label: 'Try to cancel your membership', note: 'Good luck.', mins: 30, hidden: (s) => !member(s), lines: [''], run: (s, _c, _o, r) => { if (chance(0.5)) { s.owned.items = s.owned.items.filter((x) => x !== 'gym'); return 'After 30 minutes and two forms, it is done. You feel lighter. Not from exercise.'; } r.tone = 'bad'; return '“You need to cancel in writing, with 30 days’ notice, on a Tuesday.” Still a member.'; } }),

  // ------------------------------------------------------------ LadBroke Bookmakers
  A({ id: 'horse', place: 'bookies', emoji: '🐎', label: '£2 on a horse', note: 'The 3:40 at Kempton-ish.', mins: 10, cost: 2, cooldown: 5, req: (s) => (s.money < 20 ? 'The cashier’s own advice: “You’re nearly skint, love. Come back when you’re not.”' : todayCount(s, 'bets') >= 6 ? 'Six bets today. The cashier has cut you off “for your own good”. Fair.' : null), progress: ['They’re under starter’s orders…', 'And they’re off!', 'Coming round the final bend…'], lines: [''], run: (s, _c, out, r) => { bumpToday(s, 'bets'); const h = pick(HORSES); if (chance((1 / (h.odds + 1)) * 0.85)) { const win = 2 * (h.odds + 1); r.extraPay = win; r.tone = 'good'; gainMoodlet(s, 'winner', out); out.push({ type: 'gossip', key: 'bookies_win' }); return `${h.name} (${h.odds}/1) WON! You collect ${money(win)}. You are now unbearable.`; } r.tone = 'bad'; return `${h.name} (${h.odds}/1) came ${pick(['fourth', 'last', 'second, by a nostril', 'in eventually, after the others went home'])}. The house always wins.`; } }),
  A({ id: 'acca', place: 'bookies', emoji: '⚽', label: '£5 five-fold accumulator', note: 'Pays £80. Will not pay £80.', mins: 20, cost: 5, cooldown: 30, req: (s) => (s.money < 20 ? 'The cashier: “Rent first, love.” You know she’s right.' : null), lines: [''], run: (s, _c, out, r) => { bumpToday(s, 'bets'); if (chance(0.04)) { r.extraPay = 80; r.tone = 'good'; gainMoodlet(s, 'winner', out); out.push({ type: 'gossip', key: 'bookies_win' }); return 'ALL FIVE CAME IN. £80! You screamed. The man next to you did not look up.'; } r.tone = 'bad'; if (chance(0.6)) { gainMoodlet(s, 'last_leg', out); out.push({ type: 'gossip', key: 'bookies_lose' }); return 'Four came in. The fifth was the “banker”. Lost to a penalty in the 94th minute.'; } return 'First leg lost in the 3rd minute. Quickest £5 you’ve ever spent.'; } }),
  A({ id: 'dogs', place: 'bookies', emoji: '🐕', label: 'Watch the virtual greyhounds', note: 'Free. Weirdly gripping.', mins: 15, fx: { mood: 2, social: 4 }, lines: ['None of the dogs are real. The emotion is.'] }),
  A({ id: 'tactics', place: 'bookies', emoji: '🗣️', label: 'Talk tactics with the regulars', note: 'Free. Opinions guaranteed.', mins: 20, fx: { social: 14 }, skill: ['charm', 0.1], lines: ['A man in a flat cap explained the offside rule using salt and vinegar packets.'] }),

  // ------------------------------------------------------------ Jobcentre Minus
  A({ id: 'ucclaim', place: 'jobcentre', emoji: '📝', label: 'Start a Universal Credit-ish claim', anytime: true, note: `Online, any time. About £92/wk + help with rent. 55% taper on earnings over £100/wk. Weekly work coach appointments, ${UC_SEARCHES} job searches a week.`, mins: 60, hidden: (s) => s.uc.claiming, progress: ['Creating an account…', 'Verifying your identity (a photo of your passport, your face, and your soul)…', 'Answering “have you ever been a goat farmer?”…', 'Submitted!'], lines: [''], run: (s, _c, out) => { ucFns.claim(s); out.push({ type: 'phone', from: 'Universal Credit-ish journal', text: `Welcome to your journal. Your first work coach appointment is ${s.uc.appt} at Jobcentre Minus (any time between 9am and 5pm). Commitments: ${UC_SEARCHES} job searches a week (library Wi-Fi or the job board). Payments land on Mondays.`, tone: 'info', quiet: true }); return `Claim made. Your work coach is Sandra. First appointment: ${s.uc.appt}. Don’t miss it, or it’s a sanction.`; } }),
  A({ id: 'ucappt', place: 'jobcentre', emoji: '🤝', label: 'Work coach appointment with Sandra', note: 'Today! Counts as a job search too.', mins: 30, hidden: (s, c) => !s.uc.claiming || s.uc.appt !== c.t.dateKey, fx: { social: 8 }, progress: ['“Take a seat.”', '“So… how’s the job search going?”', 'Sandra types for a very long time…'], lines: [''], run: (s) => { ucFns.attend(s); return pick(['Sandra asked if you’d “considered a career in logistics”. You have now. Next appointment: one week.', 'Sandra was lovely. She showed you a photo of her cat. You agreed to apply for three jobs. Next appointment: one week.', 'Sandra said your CV “has a lot of white space”. Fair. Next appointment: one week.']) + (s.flags.cv ? ' She liked that you printed your CV.' : ''); } }),
  A({ id: 'ucstatus', place: 'jobcentre', emoji: '💷', label: 'Check your claim', anytime: true, note: 'Online. This week’s estimate.', mins: 4, hidden: (s) => !s.uc.claiming, lines: [''], run: (s) => { const a = ucAward(s); return `This week: £${a.base} standard${a.housing ? ` + £${a.housing} housing` : ''}${a.taper ? ` − £${a.taper.toFixed(2)} taper (you earned £${s.uc.weekEarned.toFixed(2)})` : ''}${a.sanction ? ` − £${a.sanction} sanction` : ''} = £${a.total.toFixed(2)}, paid Monday. Job searches: ${s.uc.searches}/${UC_SEARCHES}. Next appointment: ${s.uc.appt}.`; } }),
  A({ id: 'ucclose', place: 'jobcentre', emoji: '🚪', label: 'Close your claim', anytime: true, note: 'Off you go.', mins: 10, hidden: (s) => !s.uc.claiming, lines: ['Sandra said “good luck, love”. She meant it.'], run: (s) => { ucFns.close(s); } }),
  A({ id: 'jobboard', place: 'jobcentre', emoji: '📋', label: 'Browse the job board', anytime: true, note: 'It’s in the window, so any time. Counts as a job search.', mins: 20, cooldown: 10, skill: ['brains', 0.05], lines: ['“Wanted: Self-starter. Must start themself.” Riveting.', 'One job listing is from 2014. You applied anyway.'], run: (s) => { s.uc.searches++; } }),
  A({ id: 'ticket', place: 'jobcentre', emoji: '🎟️', label: 'Take a ticket and wait', note: 'You are #412. Now serving: #9.', mins: 60, fx: { social: 6, mood: -2 }, lines: ['Number 9… 10… 412! That’s you! They’ve gone to lunch.', 'You made friends with a man called Den. Den has been here since Tuesday.'] }),
  A({ id: 'jcoffee', place: 'jobcentre', emoji: '☕', label: 'Free coffee machine', note: 'Free!', mins: 5, cooldown: 15, lines: ['It’s broken. It’s been broken since 2012. You pressed the button anyway. Hope is free.'] }),

  // ------------------------------------------------------------ Tube stations
  A({ id: 'paper', place: ['broadway', 'albion', 'common'], emoji: '📰', label: 'Read the free paper', note: 'Brains, sort of.', mins: 15, fx: { mood: 2 }, skill: ['brains', 0.1], lines: [''], run: () => `Headline: ${pick(HEADLINES)}. Riveting stuff.` }),
  A({ id: 'tubebusk', place: ['broadway', 'albion', 'common'], emoji: '🎻', label: 'Busk in the ticket hall', note: 'Pay depends on Charm.', mins: 45, cooldown: 60, fx: { social: 8, energy: -6 }, skill: ['charm', 0.2], gossip: 'busk', lines: [''], run: (s, _c, _o, r) => { const pay = Math.round((3 + Math.random() * 5 + s.skills.charm) * 100) / 100; r.extraPay = pay; return `You played the only song you know for 45 minutes. ${money(pay)} and a lot of avoided eye contact.`; } }),
  A({ id: 'escalator', place: ['broadway', 'albion', 'common'], emoji: '🧍', label: 'Stand on the left of the escalator', note: 'A crime against London.', mins: 5, fx: { social: -5, mood: -3 }, lines: ['You were tutted at by 47 people. A record. Someone wrote to the Evening Standard-ish.'] }),

  // ------------------------------------------------------------ 436 bus stop
  A({ id: 'waitbus', place: 'busstop', emoji: '⏳', label: 'Wait for the 436', note: 'Every 8 minutes, allegedly.', mins: 20, outdoors: true, fx: { social: 3 }, lines: ['Nothing for 20 minutes. Then three came at once. All said “Not in service”.', 'The display said “2 min” for 11 minutes. Then “Due”. Then it vanished.', 'It came! You didn’t have anywhere to go. You just wanted to see one.'] }),
  A({ id: 'pensioner', place: 'busstop', emoji: '👵', label: 'Chat with a pensioner about the buses', note: '“It was better when it was the 36.”', mins: 20, outdoors: true, cooldown: 30, fx: { social: 16, mood: 4 }, moodlet: 'natter', lines: ['She told you about the 1987 storm, her late husband Ron, and that you need a coat. She’s right about the coat.'] }),

  // ------------------------------------------------------------ Second Chances (charity shop)
  A({ id: 'paperback', place: 'charity', emoji: '📕', label: 'Mystery paperback', note: '£1. It’s The Da Vinci Code.', mins: 10, cost: 1, fx: { mood: 4 }, skill: ['brains', 0.2], lines: ['It was The Da Vinci Code. Copy number 18. Inside: a bus ticket from 2006.'] }),
  A({ id: 'coat', place: 'charity', emoji: '🧥', label: '“Vintage” wax jacket', note: '£12. Halves the rain’s bite, forever.', mins: 15, cost: 12, hidden: (s) => s.inv.coat, lines: ['It smells faintly of a Labrador and 1994. It is extremely warm. You look like you own a farm.'], run: (s) => { s.inv.coat = true; } }),
  A({ id: 'donate', place: 'charity', emoji: '🛍️', label: 'Donate a bag of clothes', note: 'Once a day. Feels nice.', mins: 10, cooldown: 24 * 60, moodlet: 'smug', fx: { social: 4 }, lines: ['The volunteer said “ooh, lovely” about a jumper you hated. Validation.'] }),
  A({ id: 'pricing', place: 'charity', emoji: '🏷️', label: 'Volunteer: price the donations', note: 'Unpaid. Wholesome.', mins: 60, cooldown: 120, fx: { social: 15, mood: 6 }, skill: ['charm', 0.2], lines: ['You priced a wedding dress at £8 and a broken Furby at £3.50. Power.'] }),

  // ------------------------------------------------------------ Pawnderful
  A({ id: 'pawnknock', place: 'pawn', emoji: '🚪', label: 'Knock on the door', note: '“Back in 5 mins.”', mins: 5, lines: ['The sign still says “Back in 5 mins”. It has said that since 2019.', 'A man appears, sells you nothing, and disappears again.'] }),
  A({ id: 'sellgames', place: 'pawn', emoji: '🎮', label: 'Sell your old video games', note: 'Once only. Emergency cash.', mins: 15, gig: [18, 18], hidden: (s) => !!s.flags.soldGames, lines: ['£18 for 14 games. One was FIFA 09. He looked at it like it owed him money.'], run: (s) => { s.flags.soldGames = true; } }),
  A({ id: 'speaker', place: 'pawn', emoji: '📻', label: 'Buy a dodgy Bluetooth speaker', note: '£15. A status item. Plays only Magic FM.', mins: 10, cost: 15, hidden: (s) => s.owned.items.includes('speaker'), moodlet: 'new_kettle', lines: ['It connects to every phone in the building except yours. Still, it’s YOURS.'], run: (s) => { s.owned.items.push('speaker'); } }),

  // ------------------------------------------------------------ Fade to Grey Barbers (the new look is handled by the UI)
  A({ id: 'trim', place: 'barber', emoji: '✂️', label: 'Just a trim', note: '£8. Feel like a new person.', mins: 20, cost: 8, fx: { hygiene: 10 }, moodlet: 'fresh_trim', lines: ['“Just a trim” became a skin fade. You love it. You are scared of it.'] }),
  A({ id: 'football', place: 'barber', emoji: '⚽', label: 'Talk about the football', note: 'Free. Strong opinions.', mins: 15, cooldown: 30, fx: { social: 14 }, lines: ['“Don’t talk to me about the match.” He talked to you about the match for 15 minutes.'] }),

  // ------------------------------------------------------------ Fleecems Lettings
  A({ id: 'deposit', place: 'fleecems', emoji: '💸', label: 'Ask about deposits', note: 'Free. Educational.', mins: 10, fx: { mood: -3 }, lines: ['Josh laughed for a full minute, then said “sorry, sorry, go on”.'] }),
  A({ id: 'viewing', place: 'fleecems', emoji: '🏚️', label: 'View a “cosy” studio', note: 'Free. 9 other people are also viewing it.', mins: 30, fx: { social: 4, mood: -2 }, lines: ['The “bedroom” was a cupboard with a hob. Josh called it “very bijou”. Nine people offered over asking.'] }),

  // ------------------------------------------------------------ Synergy House, Bus Garage
  A({ id: 'biscuits', place: 'synergy', emoji: '🍪', label: 'Raid the meeting room biscuits', note: 'Leftovers from “Q3 Alignment”.', mins: 5, cooldown: 60, fx: { hunger: 8, mood: 3 }, lines: ['Only the bourbons are left. Always the bourbons.'] }),
  A({ id: 'poshloo', place: 'synergy', emoji: '🚽', label: 'Use the posh loos', note: 'Hand cream. Heated seats. Wow.', mins: 10, fx: { hygiene: 12, warmth: 6 }, lines: ['There’s a scented candle in here. In a toilet. Business is booming.'] }),
  A({ id: 'buswash', place: 'garage', emoji: '🧽', label: 'Watch the buses get washed', note: 'Oddly soothing.', mins: 15, fx: { mood: 5 }, lines: ['The big brushes. The suds. You are 6 years old again.'] }),

  // ------------------------------------------------------------ Inkerman Terrace
  A({ id: 'bell1', place: 'terrace1', emoji: '🔔', label: 'Ring the doorbell', note: 'Why though.', mins: 4, fx: { mood: -1 }, lines: ['A Ring doorbell records you. The neighbourhood WhatsApp has been informed.'] }),
  A({ id: 'bell2', place: 'terrace2', emoji: '🔔', label: 'Ring the doorbell', note: 'Why though.', mins: 4, fx: { mood: 1 }, lines: ['A dog barks. A baby wakes. You run away.'] }),
  A({ id: 'bell3', place: 'terrace3', emoji: '🔔', label: 'Ring the doorbell', note: 'Why though.', mins: 4, lines: ['A builder answers. “Not till next Tuesday, mate.” You didn’t ask anything.'] }),

  // ------------------------------------------------------------ Home (your own place)
  A({ id: 'sleep', place: 'home', emoji: '😴', label: 'Sleep', note: 'Full night’s kip. Best between 9pm and 9am.', mins: 480, noPass: true, lines: [''], progress: ['Brushing teeth…', 'Scrolling “for five minutes”…', 'Zzz…', 'Zzzzzz…', 'Alarm. Snooze. Alarm.'], run: (s, c, out) => sleepAction(s, c, out) }),
  A({ id: 'nap', place: 'home', emoji: '💤', label: 'Power nap', note: '40 minutes. Wake up confused.', mins: 40, cooldown: 60, fx: { energy: 20 }, lines: ['You woke up not knowing what year it is. Energised though.'] }),
  A({ id: 'cuppa', place: 'home', emoji: '🫖', label: 'Put the kettle on', note: 'Uses a teabag. Fixes most things.', mins: 15, fx: { mood: 6, warmth: 12, energy: 4 }, req: (s) => (s.inv.teabags < 1 ? 'No teabags. A national emergency. Kwik Mart sells them.' : !hasPower(s) ? 'The kettle needs electric. The meter’s empty: top up at Kwik Mart.' : null), lines: ['You have a cup of tea. Everything is, briefly, fine.', 'Milk in after. Correct. Biscuit dunked. Perfect.'], run: (s) => { s.inv.teabags--; } }),
  A({ id: 'shower', place: 'home', emoji: '🚿', label: 'Shower', note: 'The water pressure of a sad sigh.', mins: 15, fx: { hygiene: 50, warmth: 4 }, lines: ['Clean! The shower went hot-cold-hot like a game show.'], run: (s, _c, out, r) => { if (s.home !== 'sofa' && s.meter <= 0) { gainMoodlet(s, 'cold_shower', out); applyFx(s, { warmth: -20 }); r.tone = 'bad'; return 'The meter’s on emergency credit so the immersion’s off. Freezing. You screamed a bit. Clean though.'; } } }),
  A({ id: 'heating', place: 'home', emoji: '♨️', label: 'Stick the heating on', note: 'Uses £1.20 of meter credit. Keeps the damp down.', price: '⚡£1.20', mins: 60, fx: { warmth: 40, mood: 4 }, moodlet: 'toasty', hidden: (s) => s.home === 'sofa', req: (s) => (s.meter < 1.2 ? 'Not enough on the meter. Top up at Kwik Mart.' : null), lines: ['The radiators clank like a ghost in chains, then: warmth. Glorious, expensive warmth.', 'You stood with your back against the radiator like a lizard on a rock.'], run: (s) => { s.meter = Math.round((s.meter - 1.2) * 100) / 100; s.flags.heatedDay = london().dateKey; s.damp = Math.max(0, s.damp - 4); } }),
  A({ id: 'window', place: 'home', emoji: '🪟', label: 'Open the windows', note: 'Airs out the damp. Lets the cold in.', mins: 10, cooldown: 30, fx: { warmth: -12 }, hidden: (s) => s.home === 'sofa', lines: ['A gust of fresh(ish) Peckwell air. Diesel, chicken shop, rain. The damp retreats slightly.'], run: (s) => { s.damp = Math.max(0, s.damp - 10); } }),
  A({ id: 'bleach', place: 'home', emoji: '🧴', label: 'Bleach the mould', note: '£3 of bleach. Smells like a swimming pool.', mins: 30, cost: 3, hidden: (s) => s.home === 'sofa' || s.damp < 20, lines: ['You scrubbed Kevin the mould patch off the window frame. He’ll be back. They always come back.'], run: (s) => { s.damp = Math.max(0, s.damp - 35); removeMoodlet(s, 'mouldy'); } }),
  A({ id: 'damptext', place: 'home', emoji: '💬', label: 'Text the landlord about the damp', note: 'Free. Hope springs eternal.', mins: 5, cooldown: 24 * 60, hidden: (s) => s.home === 'sofa' || s.damp < 30, lines: [''], run: (s, _c, out, r) => { const ll = HOMES[s.home].landlord; if (chance(0.25)) { s.damp = 0; out.push({ type: 'phone', from: ll, text: 'Sending Steve round with a dehumidifier and some anti-mould paint. Don’t say I never do anything for you.', tone: 'good', quiet: true }); r.tone = 'good'; return 'Miracle: he sent Steve. Steve painted over it. Fixed! (For now.)'; } out.push({ type: 'phone', from: ll, text: pick(['That’s condensation mate. Open a window. And stop breathing so much.', 'Have you tried drying your clothes outside? (It’s raining, I know.)', 'Will get someone to look at it. (He will not.)']), tone: 'bad', quiet: true }); r.tone = 'bad'; return 'He replied. It was not helpful.'; } }),
  A({ id: 'checkmeter', place: 'home', emoji: '🔌', label: 'Check the meter', note: 'Squint at a tiny screen in a cupboard.', mins: 4, hidden: (s) => s.home === 'sofa', lines: [''], run: (s) => (s.meter > 0 ? `£${s.meter.toFixed(2)} credit. That’s about ${Math.max(1, Math.floor(s.meter / 2.2))} day(s) of lights and fridge, or ${Math.floor(s.meter / 1.2)} goes of the heating. Damp: ${Math.round(s.damp)}%.` : s.meter > -EMERGENCY_CREDIT ? `EMERGENCY CREDIT: £${(s.meter + EMERGENCY_CREDIT).toFixed(2)} left. It’s flashing at you. Top up at Kwik Mart.` : 'The screen says “OFF”. So is your electric. Kwik Mart, now.') }),
  A({ id: 'beans', place: 'home', emoji: '🥫', label: 'Beans on toast', note: '80p from the cupboard.', mins: 15, cost: 0.8, fx: { hunger: 30, mood: 3, warmth: 4 }, lines: ['Cheese on top. You are a gourmet.', 'Beans on toast. The national dish of “I can’t be bothered”.'] }),
  ...OWNING_ACTIONS,
  A({ id: 'doomscroll', place: 'home', emoji: '📱', label: 'Doomscroll in bed', note: 'Social-ish. Mood-ish.', mins: 60, fx: { social: 8, mood: -4, energy: -2 }, lines: ['You watched 40 videos of people pressure-washing patios. No regrets. Some regrets.'] }),
];

// PureGrind bills members every Monday, used or not. Mostly not.
weeklyHooks.push((s, out) => {
  if (!s.owned.items.includes('gym')) return;
  if (s.money >= 20) {
    s.money = Math.round((s.money - 20) * 100) / 100;
    out.push({ type: 'phone', from: 'PureGrind 24/7', text: pick(['Your weekly membership (£20) has been taken. We noticed you haven’t been in. We’re not angry, just disappointed. 💪', '£20 membership collected! Remember: the only bad workout is the one you didn’t do (which is all of them, this week).', 'Membership renewed (£20). Fun fact: you’ve paid £2.86 per day to own a lanyard.']), tone: 'info', quiet: true });
  } else {
    s.owned.items = s.owned.items.filter((x) => x !== 'gym');
    out.push({ type: 'phone', from: 'PureGrind 24/7', text: 'Your payment failed so your membership’s been frozen. Honestly? Probably for the best.', tone: 'bad', quiet: true });
  }
});

export const ACTION_BY_ID: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

/** Which action list a building uses (homes share one list). */
export function placeKey(placeId: string, kind: string) {
  return kind === 'home' ? 'home' : placeId;
}
export function actionsFor(placeId: string, kind: string): ActionDef[] {
  const key = placeKey(placeId, kind);
  return ACTIONS.filter((a) => (Array.isArray(a.place) ? a.place.includes(key) : a.place === key));
}
export const actionCost = (s: SaveState, a: ActionDef, c: ActionCtx) => (a.costFn ? a.costFn(s, c) : a.cost ?? 0);

/** Why you can't do it right now (or null if you can). */
export function blockReason(s: SaveState, a: ActionDef, c: ActionCtx, t = now()): string | null {
  if (!a.anytime && typeof a.place === 'string' && !placeOpen(a.place, c.t)) return `Shut. Open ${PLACE_HOURS[a.place].label}. It’s ${c.t.label}.`;
  if (!openNow(a.hours, c.t)) return `Open ${hh(a.hours![0])}–${hh(a.hours![1])}. It’s ${c.t.label.slice(4)}.`;
  const cd = s.cooldowns[a.id] ?? 0;
  if (cd > t) return `Done that recently. Again in ${Math.ceil((cd - t) / 60000)} min.`;
  const cost = actionCost(s, a, c);
  if (cost > s.money) return 'Card declined. The cashier gives you The Look.';
  return a.req?.(s, c) ?? null;
}
export const isHidden = (s: SaveState, a: ActionDef, c: ActionCtx) => !!a.hidden?.(s, c);
export const secsFor = (a: ActionDef) => actionSecs(a.mins);

export interface ActionOutcome {
  text: string;
  tone: Tone;
  deltas: { k: string; v: number; money?: boolean }[];
  moodlets: string[];
}

/** Do it. Mutates s, pushes events, returns what happened (for the result card). */
export function completeAction(s: SaveState, a: ActionDef, c: ActionCtx, out: GameEvent[]): ActionOutcome {
  const before = { money: s.money, hunger: s.hunger, energy: s.energy, social: s.social, hygiene: s.hygiene, warmth: s.warmth, mood: effectiveMood(s, c.raining) };
  const mBefore = new Set(s.moodlets.filter((m) => m.until > s.life).map((m) => m.id));
  const cost = actionCost(s, a, c);
  const r: RunInfo = { tone: a.gig ? 'good' : 'info', refund: false, extraPay: 0 };
  if (!a.noPass) passTime(s, a.mins, { raining: c.raining, outdoors: !!a.outdoors });
  s.money = Math.round((s.money - cost) * 100) / 100;
  if (a.fx) applyFx(s, a.fx);
  if (a.skill) gainSkill(s, a.skill[0], a.skill[1]);
  if (a.moodlet) gainMoodlet(s, a.moodlet, out);
  const custom = a.run?.(s, c, out, r);
  if (r.refund) s.money = Math.round((s.money + cost) * 100) / 100;
  let pay = r.extraPay;
  if (a.gig) pay += Math.round((a.gig[0] + Math.random() * (a.gig[1] - a.gig[0])) * 100) / 100;
  if (pay) {
    s.money = Math.round((s.money + pay) * 100) / 100;
    s.stats.earned += pay;
    s.uc.weekEarned += pay;
  }
  if (a.cooldown && !r.refund) s.cooldowns[a.id] = now() + a.cooldown * 60000;
  if (a.goal && !r.refund) completeGoal(s, a.goal, out);
  if (a.gossip && !r.refund) out.push({ type: 'gossip', key: a.gossip });
  s.stats.actions++;
  const text = (typeof custom === 'string' && custom) || pick(a.lines) || 'Done.';
  const deltas: ActionOutcome['deltas'] = [];
  const dm = Math.round((s.money - before.money) * 100) / 100;
  if (dm) deltas.push({ k: '£', v: dm, money: true });
  const icon: Record<string, string> = { hunger: '🍔', energy: '⚡', social: '💬', hygiene: '🫧', warmth: '🧣' };
  for (const k of ['hunger', 'energy', 'social', 'hygiene', 'warmth'] as const) {
    const d = Math.round(s[k] - before[k]);
    // skip the background drift of needs the action didn't touch
    if (Math.abs(d) >= (a.fx?.[k] ? 1 : 4)) deltas.push({ k: icon[k], v: d });
  }
  const md = Math.round(effectiveMood(s, c.raining) - before.mood);
  if (Math.abs(md) >= 1) deltas.push({ k: '🙂', v: md });
  const moodlets = s.moodlets.filter((m) => m.until > s.life && !mBefore.has(m.id) && MOODLETS[m.id]).map((m) => m.id);
  return { text, tone: r.tone, deltas, moodlets };
}

// ------------------------------------------------------------------ sleep
function sleepAction(s: SaveState, c: ActionCtx, out: GameEvent[]): string {
  const home = HOMES[s.home];
  const night = c.t.hh >= 21 || c.t.hh < 9;
  const cold = s.home !== 'sofa' && s.meter <= 0;
  passTime(s, 480, { raining: false, outdoors: false, sleeping: true, rate: 0.35 });
  const target = home.sleepEnergy * (night ? 1 : 0.75) * (cold ? 0.8 : 1);
  s.energy = Math.max(s.energy, Math.min(100, target));
  applyFx(s, { mood: home.sleepMood + 4 });
  removeMoodlet(s, 'hungover');
  if (s.home === 'sofa') {
    gainMoodlet(s, 'sofa_back', out);
    return 'You slept on Dave’s sofa. The cat sat on your face at 4am.';
  }
  if (cold) {
    gainMoodlet(s, 'cold_flat', out);
    return 'You slept in a coat because the meter’s run dry. Top up at Kwik Mart.';
  }
  if (hasMoodlet(s, 'mouldy') || s.damp >= 60) {
    gainMoodlet(s, 'mouldy', out);
    return 'You slept, but the damp patch watched you all night.';
  }
  if (night) {
    gainMoodlet(s, 'well_rested', out);
    return 'Eight hours. Actual, proper sleep. You feel like a new person (a tired new person).';
  }
  return 'A daytime sleep. You woke up at dusk feeling like a Victorian ghost. Less restful than a proper night.';
}
