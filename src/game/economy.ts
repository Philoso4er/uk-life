import type { Avatar, GoalId, HomeId, JobId, SaveState } from './types';
import { SPAWN } from './world';

export const GAME_MIN_PER_SEC = 8; // 1 real second = 8 game minutes → a day is 3 real minutes
export const DAY = 1440;
export const WEEK = DAY * 7;
export const START_MINUTES = 8 * 60; // Monday 08:00, week 1
export const RENT_DUE_MIN = 9 * 60; // Monday 09:00

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const clock = (m: number) => {
  const week = Math.floor(m / WEEK) + 1;
  const dayIdx = Math.floor((m % WEEK) / DAY);
  const mins = m % DAY;
  const hh = Math.floor(mins / 60);
  const mm = Math.floor(mins % 60);
  return { week, dayIdx, day: DAYS[dayIdx], hh, mm, label: `${DAYS[dayIdx]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
};

export const money = (n: number) => (n < 0 ? '-' : '') + '£' + Math.abs(n).toFixed(2).replace(/\.00$/, '');
export const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ homes
export interface Home {
  id: HomeId;
  name: string;
  building: string;
  rent: number;
  councilTax: number;
  sleepEnergy: number;
  sleepMood: number;
  landlord: string;
  pitch: string;
}
export const HOMES: Record<HomeId, Home> = {
  sofa: { id: 'sofa', name: "Dave's sofa", building: 'kestrel', rent: 0, councilTax: 0, sleepEnergy: 75, sleepMood: -6, landlord: 'Dave', pitch: 'Free, if you count your dignity as free. Dave pays the council tax and mentions it often.' },
  flatshare: { id: 'flatshare', name: 'Box room, Grimewood Court', building: 'grimewood', rent: 165, councilTax: 21, sleepEnergy: 100, sleepMood: 0, landlord: 'Nigel (Landlord)', pitch: '"Cosy" box room in a 6-bed flatshare. Bills not included. Window faces a wall. Deposit: one week.' },
  studio: { id: 'studio', name: 'Studio, Victoria Terrace', building: 'victoria', rent: 295, councilTax: 29, sleepEnergy: 100, sleepMood: 8, landlord: 'PropertyHub Solutions Ltd', pitch: 'Your own front door! The kitchen is also the bedroom is also the lounge. Deposit: one week.' },
  onebed: { id: 'onebed', name: 'One-bed, The Vantage', building: 'vantage', rent: 520, councilTax: 44, sleepEnergy: 100, sleepMood: 20, landlord: 'Marcus (Concierge)', pitch: 'Floor-to-ceiling windows, a gym, a concierge called Marcus. You can finally host a dinner party for nobody. Deposit: one week.' },
};

// ------------------------------------------------------------------ jobs
export interface Job {
  id: JobId;
  title: string;
  employer: string;
  building: string;
  pay: number;
  hours: number;
  unlockShifts: number;
  energy: number;
  hunger: number;
  desc: string;
}
export const JOBS: Record<JobId, Job> = {
  barista: { id: 'barista', title: 'Barista', employer: 'Prêt-à-Pricey', building: 'pret', pay: 52, hours: 4, unlockShifts: 0, energy: 22, hunger: 16, desc: 'Make oat flat whites for people who are "literally dying". Spell their names wrong.' },
  rider: { id: 'rider', title: 'Delivery Rider', employer: 'PFC Fried Chicken', building: 'pfc', pay: 0, hours: 3, unlockShifts: 0, energy: 26, hunger: 18, desc: 'Cycle chicken to doors around Peckwell. Paid per drop, plus tips if the chips are still warm.' },
  temp: { id: 'temp', title: 'Office Temp', employer: 'Synergy House', building: 'synergy', pay: 68, hours: 5, unlockShifts: 1, energy: 20, hunger: 18, desc: 'Triage the inbox. Reply to the boss, archive the cake emails, report the phishing.' },
  bus: { id: 'bus', title: 'Bus Driver', employer: 'Peckwell Bus Garage', building: 'garage', pay: 86, hours: 6, unlockShifts: 3, energy: 28, hunger: 22, desc: 'Drive the 436. Stop at the stops. Answer "does this go to Peckwell?" with saintly patience.' },
};

// ------------------------------------------------------------------ shops
export interface Item {
  id: string;
  name: string;
  price: number;
  hunger?: number;
  energy?: number;
  mood?: number;
  note: string;
  special?: 'oyster' | 'umbrella' | 'scratchcard' | 'haircut';
}
export const SHOPS: Record<string, { title: string; greeting: string[]; items: Item[] }> = {
  crumbs: {
    title: 'Crumbs & Co.',
    greeting: ['"Next please!"', '"Warm ones just out, love."', '"We\u2019re out of the vegan ones. We\u2019re always out of the vegan ones."'],
    items: [
      { id: 'sroll', name: 'Sausage roll', price: 1.35, hunger: 28, mood: 3, note: 'Flaky. Iconic. Gets everywhere.' },
      { id: 'vroll', name: 'Vegan sausage roll', price: 1.45, hunger: 26, mood: 6, note: 'Smugness included free.' },
      { id: 'steak', name: 'Steak bake', price: 2.15, hunger: 38, mood: 2, note: 'Lava-hot for 45 minutes.' },
      { id: 'coffee', name: 'Filter coffee', price: 1.6, energy: 14, note: 'Tastes like a warm tuesday.' },
      { id: 'donut', name: 'Iced ring doughnut', price: 1.1, hunger: 10, mood: 7, energy: 4, note: 'Pink icing, sprinkles, regret.' },
    ],
  },
  kwik: {
    title: 'Kwik Mart Food & Wine',
    greeting: ['"Alright boss?"', '"Card machine\u2019s £5 minimum, sorry."', '"We do phone unlocking as well, if you need."'],
    items: [
      { id: 'mealdeal', name: 'Meal deal', price: 3.5, hunger: 36, mood: 5, note: 'Sandwich, crisps, drink. The pinnacle of British engineering.' },
      { id: 'energy', name: 'Energy drink (500ml)', price: 1.49, energy: 30, mood: -4, note: 'Your heart will remember this.' },
      { id: 'tea', name: 'Teabags (80)', price: 2.2, mood: 9, energy: 6, note: 'Have a cuppa. Everything is fine.' },
      { id: 'crisps', name: 'Prawn cocktail crisps', price: 0.9, hunger: 8, mood: 3, note: 'Correct flavour. Fight me.' },
      { id: 'brolly', name: 'Umbrella', price: 8, special: 'umbrella', note: 'Stops rain ruining your mood. Will be lost within 3 days. It\u2019s the law.' },
      { id: 'scratch', name: 'Scratchcard', price: 2, special: 'scratchcard', note: 'Could win £500! (Will not win £500.)' },
      { id: 'oyster', name: 'Oyster top-up £10', price: 10, special: 'oyster', note: 'Adds £10 to your Oyster card.' },
    ],
  },
  pret: {
    title: 'Prêt-à-Pricey',
    greeting: ['"Hi! Eat in or take away? It\u2019s 20p more to sit down."', '"Our oat milk is hand-milked from organic oats."'],
    items: [
      { id: 'flatwhite', name: 'Oat flat white', price: 3.95, energy: 26, mood: 4, note: 'Microfoam. Macro-price.' },
      { id: 'avo', name: 'Smashed avo on sourdough', price: 6.95, hunger: 30, mood: 10, note: 'Why you can\u2019t afford a house, apparently.' },
      { id: 'crayfish', name: 'Crayfish & rocket wrap', price: 5.25, hunger: 26, mood: 2, note: 'Nobody has ever wanted this. You bought it anyway.' },
      { id: 'cookie', name: 'Dark choc cookie', price: 2.4, hunger: 10, mood: 9, note: 'Size of a dinner plate.' },
    ],
  },
  pfc: {
    title: 'PFC · Peckwell Fried Chicken',
    greeting: ['"Wings and chips, yeah?"', '"Hot sauce? You want hot sauce? I\u2019m putting hot sauce."', '"Free drink with the box meal, boss."'],
    items: [
      { id: 'wings', name: '2 wings & chips', price: 2.99, hunger: 40, mood: 4, energy: -2, note: 'Greatest value in the UK. A national treasure.' },
      { id: 'box', name: 'Box meal (+ can)', price: 5.5, hunger: 60, mood: 7, energy: -4, note: 'Burger, wings, chips, a can of Tango-ish.' },
      { id: 'gravy', name: 'Chips & gravy', price: 2.2, hunger: 22, mood: 5, note: 'Northern visitors approve.' },
    ],
  },
  pub: {
    title: 'The Leaky Brolly',
    greeting: ['"What can I get you, love?"', '"Card behind the bar? Go on then."', 'Clive the dog looks at you. Clive approves.'],
    items: [
      { id: 'pint', name: 'Pint of lager', price: 7.2, mood: 22, energy: -8, note: 'When did a pint become £7.20? Nobody knows.' },
      { id: 'ale', name: 'Pint of real ale', price: 6.4, mood: 20, energy: -7, note: 'Tastes like a cardigan. In a good way.' },
      { id: 'roast', name: 'Sunday roast', price: 18.5, hunger: 70, mood: 22, note: 'Yorkshire pudding the size of your head. Available every day here, don\u2019t tell anyone.' },
      { id: 'scampi', name: 'Scampi Fries', price: 1.2, hunger: 8, mood: 4, note: 'Smells like a harbour. Tastes like victory.' },
      { id: 'lime', name: 'Lime & soda', price: 0.5, mood: 2, energy: 2, note: 'The designated driver special.' },
    ],
  },
  barber: {
    title: 'Fade to Grey Barbers',
    greeting: ['"What we doing today, boss?"', '"Saw the match? Don\u2019t talk to me about the match."'],
    items: [{ id: 'cut', name: 'New look (hair, outfit, the lot)', price: 12, special: 'haircut', mood: 15, note: 'Walk out a new person. Same bank balance, minus £12.' }],
  },
};

export const SCRATCH_PRIZES = [0, 0, 0, 0, 0, 0, 1, 2, 2, 5, 10, 50];

// ------------------------------------------------------------------ goals
export const GOALS: { id: GoalId; label: string }[] = [
  { id: 'job', label: 'Get a job at Jobcentre Minus' },
  { id: 'shift', label: 'Finish your first shift' },
  { id: 'sausage', label: 'Eat a sausage roll from Crumbs & Co.' },
  { id: 'tube', label: 'Tap in with your Oyster at a station' },
  { id: 'rent', label: 'Rent your own place (sorry, Dave)' },
  { id: 'rentday', label: 'Survive rent day' },
  { id: 'pint', label: 'Have a pint at The Leaky Brolly' },
  { id: 'chat', label: 'Say hello in the local chat' },
];

// ------------------------------------------------------------------ state
export const SAVE_KEY = 'uklife.save.v1';

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newSave(name: string, avatar: Avatar): SaveState {
  return {
    version: 1,
    id: rid(),
    name,
    avatar,
    money: 120,
    oyster: 5.6,
    energy: 80,
    hunger: 60,
    mood: 70,
    minutes: START_MINUTES,
    job: null,
    shifts: 0,
    home: 'sofa',
    rent: 0,
    arrears: 0,
    lastBillWeek: 1,
    umbrellaUntil: 0,
    goals: {},
    pos: { ...SPAWN },
    stats: { earned: 0, rentPaid: 0, sausageRolls: 0, pints: 0, tubeTrips: 0 },
  };
}

export function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveState;
    if (s?.version !== 1 || typeof s.name !== 'string') return null;
    return s;
  } catch {
    return null;
  }
}
export function writeSave(s: SaveState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota: carry on regardless */
  }
}

// ------------------------------------------------------------------ events
export type GameEvent =
  | { type: 'toast'; text: string; tone?: 'good' | 'bad' | 'info' }
  | { type: 'phone'; from: string; text: string; tone?: 'good' | 'bad' | 'info'; lines?: { label: string; amount: number }[] }
  | { type: 'goal'; id: GoalId }
  | { type: 'passout' };

export function completeGoal(s: SaveState, id: GoalId, out: GameEvent[]) {
  if (s.goals[id]) return;
  s.goals[id] = true;
  out.push({ type: 'goal', id });
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const LANDLORD_OK: Record<Exclude<HomeId, 'sofa'>, string[]> = {
  flatshare: [
    'Hiya! Rent received, cheers 👍 Just FYI the boiler is "being looked at". Also I\u2019m putting the rent up a bit because of The Market. Nigel',
    'Payment received. Please stop leaving passive aggressive notes about the bins on the fridge, it\u2019s upsetting Tomasz. Nigel',
    'Ta for the rent. Someone will come round to look at the damp at some point between 8am and the heat death of the universe. N',
  ],
  studio: [
    'Dear Tenant, your rent has been received. Please note: hanging pictures, cooking fish, and "having guests" are not permitted. Kind regards, PropertyHub Solutions Ltd',
    'Dear Tenant, payment received. A routine inspection will occur Thursday. Please hide any evidence of joy. PropertyHub',
  ],
  onebed: [
    'Good morning! Rent received with thanks. Marcus at the concierge desk has signed for 14 of your parcels. He would like to know what you are doing with that many oat milks.',
    'Rent received. A gentle reminder that the rooftop terrace is closed for "the season", which is all of them. — The Vantage Management',
  ],
};
export const LANDLORD_LATE: Record<Exclude<HomeId, 'sofa'>, string> = {
  flatshare: 'Mate. Rent hasn\u2019t come through?? I have a mortgage on my third property to pay you know. Sort it by next week or I\u2019m getting the locks changed. Nigel',
  studio: 'Dear Tenant, your payment FAILED. A late fee may or may not apply. A second missed payment will result in termination of your tenancy. PropertyHub Solutions Ltd',
  onebed: 'Marcus here. Management asked me to "have a word". I don\u2019t want to have a word. Please just pay the rent. Second strike and you\u2019re out.',
};

/** Advance needs/clock and process bills. Mutates s. */
export function tick(s: SaveState, gameMinutes: number, ctx: { raining: boolean; inPark: boolean; onShift: boolean }, out: GameEvent[]) {
  const before = s.minutes;
  s.minutes += gameMinutes;
  const h = gameMinutes / 60;
  s.hunger = clamp(s.hunger - 4 * h);
  s.energy = clamp(s.energy - 3.2 * h);
  let moodDelta = -0.8 * h;
  if (ctx.raining && s.umbrellaUntil < s.minutes && !ctx.onShift) moodDelta -= 3 * h;
  if (ctx.inPark && !ctx.raining) moodDelta += 7 * h;
  if (s.hunger < 20) moodDelta -= 3 * h;
  if (s.energy < 15) moodDelta -= 2 * h;
  s.mood = clamp(s.mood + moodDelta);
  if (s.umbrellaUntil > 0 && s.umbrellaUntil < s.minutes) {
    s.umbrellaUntil = 0;
    out.push({ type: 'toast', text: 'You left your umbrella on the bus. Classic.', tone: 'bad' });
  }
  if (s.energy <= 0) out.push({ type: 'passout' });
  processBills(s, before, out);
}

export function processBills(s: SaveState, before: number, out: GameEvent[]) {
  // Bills land every Monday at 09:00 from week 2 onwards.
  const week = Math.floor(s.minutes / WEEK) + 1;
  const intoWeek = s.minutes % WEEK;
  if (week > s.lastBillWeek && intoWeek >= RENT_DUE_MIN) {
    s.lastBillWeek = week;
    void before;
    billWeek(s, out);
  }
}

export function billWeek(s: SaveState, out: GameEvent[]) {
  if (s.home === 'sofa') {
    out.push({ type: 'phone', from: 'Dave', text: pick(['Morning! No rent obviously, you\u2019re family. But you DID finish my cereal. And the milk. And my oat milk. 🙃', 'Yo, the cat\u2019s started sleeping on your pillow when you\u2019re out. Just so you know. Also any chance you could find your own place this side of Christmas? x', 'Council tax came through. I paid it. Again. No pressure. (Some pressure.)']), tone: 'info' });
    return;
  }
  const home = HOMES[s.home];
  const total = s.rent + home.councilTax;
  const lines = [
    { label: `Rent · ${home.name}`, amount: s.rent },
    { label: 'Council tax (Band B, feels like Band Z)', amount: home.councilTax },
  ];
  if (s.money >= total) {
    s.money -= total;
    s.stats.rentPaid += s.rent;
    s.arrears = 0;
    const rise = Math.random() < 0.45;
    let text = pick(LANDLORD_OK[s.home]);
    if (rise) {
      const old = s.rent;
      s.rent = Math.round(s.rent * 1.04);
      text += `\n\n(Rent going up from ${money(old)} to ${money(s.rent)}/week. "It\u2019s the market.")`;
    }
    out.push({ type: 'phone', from: home.landlord, text, tone: 'info', lines });
    completeGoal(s, 'rentday', out);
  } else {
    s.arrears += 1;
    if (s.arrears >= 2) {
      out.push({ type: 'phone', from: home.landlord, text: `That\u2019s two missed payments. You\u2019ve been evicted. Your stuff is in bin bags on the pavement. Dave says you can have the sofa back.`, tone: 'bad', lines });
      s.home = 'sofa';
      s.rent = 0;
      s.arrears = 0;
    } else {
      out.push({ type: 'phone', from: home.landlord, text: LANDLORD_LATE[s.home], tone: 'bad', lines });
    }
  }
}

export function applyItem(s: SaveState, item: Item, out: GameEvent[]): boolean {
  if (s.money < item.price) {
    out.push({ type: 'toast', text: pick(['Card declined. The cashier gives you The Look.', 'Insufficient funds. Maybe just the tap water then.', 'Your bank app has sent you a sad face.']), tone: 'bad' });
    return false;
  }
  s.money -= item.price;
  s.hunger = clamp(s.hunger + (item.hunger ?? 0));
  s.energy = clamp(s.energy + (item.energy ?? 0));
  s.mood = clamp(s.mood + (item.mood ?? 0));
  if (item.special === 'oyster') s.oyster += 10;
  if (item.special === 'umbrella') s.umbrellaUntil = s.minutes + DAY * 3;
  if (item.special === 'scratchcard') {
    const win = pick(SCRATCH_PRIZES);
    s.money += win;
    out.push({ type: 'toast', text: win ? `Scratchcard: you won ${money(win)}! Don\u2019t spend it all at once.` : 'Scratchcard: nothing. Shocking. Absolutely shocking.', tone: win ? 'good' : 'bad' });
  }
  if (item.id === 'sroll' || item.id === 'vroll') {
    s.stats.sausageRolls++;
    completeGoal(s, 'sausage', out);
  }
  if (item.id === 'pint' || item.id === 'ale') {
    s.stats.pints++;
    completeGoal(s, 'pint', out);
  }
  return true;
}

export function shiftPay(job: Job, score: number) {
  // score 0..1 → between 50% and 130% of base pay
  return Math.round(job.pay * (0.5 + 0.8 * Math.max(0, Math.min(1, score))) * 100) / 100;
}

export function finishShift(s: SaveState, job: Job, pay: number, out: GameEvent[]) {
  s.money += pay;
  s.stats.earned += pay;
  s.shifts += 1;
  s.energy = clamp(s.energy - job.energy);
  s.hunger = clamp(s.hunger - job.hunger);
  const before = s.minutes;
  s.minutes += job.hours * 60;
  completeGoal(s, 'shift', out);
  processBills(s, before, out);
  if (s.shifts === 1 || s.shifts === 3) {
    const unlocked = Object.values(JOBS).filter((j) => j.unlockShifts === s.shifts);
    if (unlocked.length) out.push({ type: 'toast', text: `New job unlocked at the Jobcentre: ${unlocked.map((j) => j.title).join(', ')}`, tone: 'good' });
  }
}

/** Sleep until 07:00 next morning (or the same morning if it's before 5am). */
export function sleep(s: SaveState, out: GameEvent[]) {
  const home = HOMES[s.home];
  const before = s.minutes;
  const dayStart = Math.floor(s.minutes / DAY) * DAY;
  const mins = s.minutes - dayStart;
  const wake = mins < 5 * 60 ? dayStart + 7 * 60 : dayStart + DAY + 7 * 60;
  const hours = (wake - s.minutes) / 60;
  s.minutes = wake;
  s.energy = clamp(Math.max(s.energy, home.sleepEnergy));
  s.hunger = clamp(s.hunger - hours * 1.5);
  s.mood = clamp(s.mood + home.sleepMood + 4);
  out.push({ type: 'toast', text: s.home === 'sofa' ? 'You slept on Dave\u2019s sofa. The cat sat on your face at 4am.' : `You slept like a log. ${clock(wake).label}.`, tone: 'info' });
  processBills(s, before, out);
}
