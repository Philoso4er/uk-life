import type { NeedId, SaveState } from './types';
import { london } from './time';

export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export interface NeedDef {
  id: NeedId;
  icon: string;
  label: string;
  /** points lost per life-hour */
  rate: number;
}
export const NEEDS: NeedDef[] = [
  { id: 'hunger', icon: '🍔', label: 'Fullness', rate: 6 },
  { id: 'energy', icon: '⚡', label: 'Energy', rate: 4.5 },
  { id: 'social', icon: '💬', label: 'Social', rate: 4 },
  { id: 'hygiene', icon: '🫧', label: 'Hygiene', rate: 3.5 },
  { id: 'warmth', icon: '🧣', label: 'Warm & dry', rate: 0 }, // weather does the damage
];

export interface MoodletDef {
  id: string;
  name: string;
  emoji: string;
  mood: number;
  /** life minutes it lasts */
  mins: number;
  desc: string;
  /** multipliers on need decay while active */
  decay?: Partial<Record<NeedId, number>>;
}

const M = (id: string, emoji: string, name: string, mood: number, mins: number, desc: string, decay?: MoodletDef['decay']): MoodletDef => ({ id, emoji, name, mood, mins, desc, decay });

export const MOODLETS: Record<string, MoodletDef> = Object.fromEntries(
  [
    M('soaked', '🌧️', 'Soaked', -12, 60, 'Wet to the pants. Warmth drains twice as fast.', { warmth: 2 }),
    M('had_crumbs', '🥐', 'Had a Crumbs', 8, 90, 'Pastry flakes in places pastry should not be. Stays full longer.', { hunger: 0.7 }),
    M('smug', '😌', 'Smug', 6, 120, 'You mentioned it twice. You will mention it again.'),
    M('hungover', '🤕', 'Hungover', -12, 240, 'Never again. (Until Friday.) Energy drains faster.', { energy: 1.4 }),
    M('tipsy', '🍻', 'Tipsy', 10, 60, 'Everyone is your best mate. Energy drains a bit faster.', { energy: 1.2 }),
    M('natter', '🗣️', 'Proper Natter', 6, 120, 'Had a good chinwag. Social stays topped up longer.', { social: 0.5 }),
    M('quiz_champs', '🏆', 'Quiz Champions', 15, 240, 'Your team, "Quiz Akabusi", won. You will tell everyone.'),
    M('quiz_shame', '📉', 'Came Fourth', -5, 90, 'Beaten by a team called "Les Quizerables". Again.'),
    M('duck_whisperer', '🦆', 'Duck Whisperer', 8, 120, 'The ducks respect you now. Peckwell does not.'),
    M('swanned', '🦢', 'Swanned', -8, 60, 'A swan chased you. It has a criminal record.'),
    M('end_of_line', '🚌', 'End of the Line', -10, 240, 'Passed out on the 436 and woke up in a depot in Croydon.'),
    M('endorphins', '💪', 'Endorphins', 10, 90, 'You went to the gym. Your body is a temple (a small one).', { energy: 0.85 }),
    M('fresh_laundry', '👕', 'Fresh Laundry', 6, 180, 'Smells like a Lenor advert. Hygiene lasts longer.', { hygiene: 0.6 }),
    M('toasty', '♨️', 'Toasty', 6, 90, 'Warm right through. Warmth holds up in the cold.', { warmth: 0.4 }),
    M('well_rested', '😴', 'Well Rested', 10, 360, 'Eight whole hours. A British miracle.', { energy: 0.8 }),
    M('sofa_back', '🛋️', 'Sofa Back', -6, 240, 'Slept on Dave’s sofa. Your spine is now shaped like a question mark.'),
    M('rent_paid', '🏠', 'Rent Paid', 6, 180, 'Survived another Monday. The relief is physical.'),
    M('got_a_seat', '💺', 'Got a Seat', 8, 60, 'Got a seat on the Tube. At rush hour. Tell your grandchildren.'),
    M('signal_failure', '🚦', 'Signal Failure', -6, 60, '“We are being held at a red signal.” For your whole life.'),
    M('wired', '⚡', 'Wired', 4, 45, 'Heart going like a drum and bass track. Energy drains slower, for now.', { energy: 0.5 }),
    M('fresh_trim', '💈', 'Fresh Trim', 10, 300, 'You keep catching yourself in shop windows.'),
    M('burnt_gob', '🔥', 'Burnt Gob', -4, 30, 'The steak bake was the temperature of the sun. As warned.'),
    M('last_leg', '💔', 'Lost on the Last Leg', -8, 90, 'Four out of five came in. The fifth was the one you were sure about.'),
    M('winner', '🤑', 'Bookies Winner', 12, 120, 'You are now insufferable.'),
    M('pigeon_pal', '🐦', 'Pigeon Pal', 4, 60, 'A pigeon with one foot now follows you everywhere.'),
    M('generous', '🍺', 'Got a Round In', 10, 180, 'Legend status at the Brolly. Social decays slower.', { social: 0.6 }),
    M('digital_nomad', '💻', 'Digital Nomad', 5, 90, 'Sat in a café for three hours on one coffee. Power move.'),
    M('hit_different', '🍗', '2am Wings', 9, 90, 'PFC wings at 2am hit different.'),
    M('cold_shower', '🥶', 'Cold Shower', -10, 60, 'The meter ran out halfway through. You screamed a bit.'),
    M('cold_flat', '🧊', 'Cold Flat', -8, 120, 'You can see your breath indoors. Warmth drains faster.', { warmth: 1.6 }),
    M('mouldy', '🍄', 'Damp Smell', -7, 240, 'The black spot in the corner is growing. You named it Kevin.'),
    M('heatwave', '🥵', 'Melting', -6, 240, 'It’s 24°C. A national emergency. Hygiene drains faster.', { hygiene: 1.5 }),
    M('rail_replacement', '🚌', 'Rail Replacement Despair', -9, 90, 'The bus took 40 minutes to go 2 stops. You saw a man age.'),
    M('scammed', '😬', 'Scammed', -10, 180, 'It said Royal Mall. With two Ls. You knew. You KNEW.'),
    M('mums_dinner', '🍲', 'Mum’s Dinner', 14, 240, 'Fed like a king. Sent home with leftovers and guilt.', { hunger: 0.6 }),
    M('stag_legend', '🎉', 'Stag Do Legend', 14, 300, 'What happens in Bournemouth stays in the group chat forever.'),
    M('promoted', '📈', 'Promoted', 15, 360, 'New title, slightly bigger lanyard.'),
    M('sanctioned', '📄', 'Sanctioned', -10, 360, 'The Department for Waiting & Paperwork is disappointed in you.'),
    M('grew_it', '🥕', 'Grew It Myself', 9, 240, 'You grew a vegetable. You are basically a farmer now.'),
    M('landlord_life', '🧐', 'Landlord Energy', 5, 240, 'You said “it’s the market” out loud. You are becoming Nigel.'),
    M('new_kettle', '✨', 'Treated Yourself', 9, 240, 'New thing! Brief, perfect happiness.'),
    M('telly_tax', '📺', 'Licence Paranoia', -5, 180, 'You flinch every time a van drives past.'),
  ].map((m) => [m.id, m]),
);

/** Mood conditions worked out from your current state (not stored, can't be dodged). */
export function dynamicMoodlets(s: SaveState, raining = false): MoodletDef[] {
  const out: MoodletDef[] = [];
  if (s.hunger < 15) out.push(M('hangry', '😤', 'Hangry', -10, 0, 'Fullness is very low. Eat something before you bite someone.'));
  if (s.energy < 15) out.push(M('knackered', '🥱', 'Running on Fumes', -8, 0, 'Energy is very low. Sleep, or at least a coffee.'));
  if (s.social < 15) out.push(M('lonely', '🫥', 'Bit Lonely', -8, 0, 'Social is very low. Natter to someone, even a pigeon.'));
  if (s.hygiene < 20) out.push(M('whiffy', '🦨', 'Whiffy', -8, 0, 'Hygiene is very low. People are moving seats.'));
  if (s.warmth < 20) out.push(M('brass', '🥶', 'Brass Monkeys', -10, 0, 'Warmth is very low. Get inside, have a cuppa, find a radiator.'));
  if (s.money < 5) out.push(M('skint', '🪙', 'Skint', -6, 0, 'Under a fiver to your name. Sapa, British edition.'));
  const t = london();
  if (t.dayIdx === 0 && t.hh < 12) out.push(M('monday', '📅', 'Monday Morning', -4, 0, 'It’s Monday. That’s it, that’s the moodlet.'));
  if (t.dayIdx === 4 && t.hh >= 16) out.push(M('friday', '🥳', 'Friday Feeling', 6, 0, 'It’s Friday after 4pm. Legally the weekend.'));
  if (raining && s.umbrellaUntil > s.life) out.push(M('brolly', '☂️', 'Brolly Smug', 2, 0, 'You have an umbrella and it’s raining. Victory.'));
  return out;
}

export function hasMoodlet(s: SaveState, id: string) {
  return s.moodlets.some((m) => m.id === id && m.until > s.life);
}

/** Add (or refresh) a moodlet. Returns true if it's new. */
export function addMoodlet(s: SaveState, id: string, mins?: number): boolean {
  const def = MOODLETS[id];
  if (!def) return false;
  const until = s.life + (mins ?? def.mins);
  const cur = s.moodlets.find((m) => m.id === id);
  if (cur) {
    const fresh = cur.until <= s.life;
    cur.until = Math.max(cur.until, until);
    return fresh;
  }
  s.moodlets.push({ id, until });
  return true;
}
export function removeMoodlet(s: SaveState, id: string) {
  s.moodlets = s.moodlets.filter((m) => m.id !== id);
}

export function activeMoodlets(s: SaveState, raining = false): { def: MoodletDef; left: number; dynamic: boolean }[] {
  const stored = s.moodlets.filter((m) => m.until > s.life && MOODLETS[m.id]).map((m) => ({ def: MOODLETS[m.id], left: m.until - s.life, dynamic: false }));
  return [...stored, ...dynamicMoodlets(s, raining).map((def) => ({ def, left: 0, dynamic: true }))];
}

export function effectiveMood(s: SaveState, raining = false) {
  return clamp(s.mood + activeMoodlets(s, raining).reduce((a, m) => a + m.def.mood, 0));
}

export function decayMult(s: SaveState, need: NeedId) {
  let k = 1;
  for (const m of s.moodlets) if (m.until > s.life) k *= MOODLETS[m.id]?.decay?.[need] ?? 1;
  // fitter people tire slower
  if (need === 'energy') k *= 1 - Math.min(0.2, s.skills.fitness * 0.02);
  return k;
}

export interface TimeCtx {
  raining: boolean;
  outdoors: boolean;
  /** 0-1 scale on decay, e.g. while asleep */
  rate?: number;
  /** needs won't be pushed below this by passive decay (offline catch-up) */
  floor?: number;
  sleeping?: boolean;
}

/** Let `mins` life-minutes pass: needs decay, weather bites, base mood drifts. Mutates s. */
export function passTime(s: SaveState, mins: number, ctx: TimeCtx) {
  if (mins <= 0) return;
  s.life += mins;
  const h = mins / 60;
  const rate = ctx.rate ?? 1;
  const floor = ctx.floor ?? 0;
  for (const n of NEEDS) {
    if (n.id === 'warmth') continue;
    if (ctx.sleeping && n.id === 'energy') continue;
    const before = s[n.id];
    const after = before - n.rate * h * rate * decayMult(s, n.id);
    s[n.id] = clamp(before <= floor ? after : Math.max(floor, after));
  }
  // warmth: Britain does this bit
  const t = london();
  let w = 0;
  if (ctx.outdoors) {
    const brolly = s.umbrellaUntil > s.life;
    if (ctx.raining && !brolly) w -= s.inv.coat ? 22 : 40;
    else if (ctx.raining) w -= 4;
    if (t.hh < 7 || t.hh >= 20) w -= 6;
    if (t.month >= 11 || t.month <= 2) w -= s.inv.coat ? 2 : 5;
    if (!ctx.raining && w === 0) w = 3; // a dry, mild moment: you dry off slowly
  } else w = 8; // indoors drifts warmer
  if (hasMoodlet(s, 'heatwave')) w = Math.max(w, 5);
  const wk = w < 0 ? decayMult(s, 'warmth') : 1;
  s.warmth = clamp(s.warmth + w * h * wk * (w < 0 ? rate : 1));
  if (floor && s.warmth < floor) s.warmth = Math.max(s.warmth, Math.min(floor, s.warmth + 30));
  // base mood drifts towards how well you're looking after yourself
  const avg = (s.hunger + s.energy + s.social + s.hygiene + s.warmth) / 5;
  const target = 28 + avg * 0.62;
  const k = 1 - Math.pow(0.94, h);
  s.mood = clamp(s.mood + (target - s.mood) * k);
  // tidy expired moodlets now and then
  if (s.moodlets.length > 12 || Math.random() < 0.05) s.moodlets = s.moodlets.filter((m) => m.until > s.life);
}

/** Apply direct need changes, e.g. from eating. */
export function applyFx(s: SaveState, fx: Partial<Record<NeedId | 'mood', number>>) {
  for (const [k, v] of Object.entries(fx)) {
    if (!v) continue;
    const key = k as NeedId | 'mood';
    s[key] = clamp(s[key] + v);
  }
}

/** Mood shifts pay: 0.85x when miserable, up to 1.15x when buzzing. */
export const moodPayMult = (mood: number) => 0.85 + 0.3 * (clamp(mood) / 100);
