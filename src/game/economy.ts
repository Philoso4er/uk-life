import type { Avatar, GoalId, HomeId, JobId, SaveState, SkillId } from './types';
import { SPAWN } from './world';
import { addDays, london, now, rentKey } from './time';
import { addMoodlet, applyFx, clamp, passTime } from './needs';

export { clamp };

export const DAY_MIN = 1440;
export const money = (n: number) => (n < 0 ? '-' : '') + '£' + Math.abs(n).toFixed(2).replace(/\.00$/, '');
export const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
export const chance = (p: number) => Math.random() < p;

/** Real seconds an action takes, given its nominal in-game minutes (fast-forwarded life). */
export const actionSecs = (mins: number) => Math.round(Math.max(4, Math.min(40, 4 + 0.11 * mins)));
/** While you're actually playing, your personal clock runs at 4x real time. */
export const LIFE_SPEED_ACTIVE = 4;
export const CATCHUP_CAP_MIN = 12 * 60;

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
  dampRate: number; // damp points per day if neglected
}
export const HOMES: Record<HomeId, Home> = {
  sofa: { id: 'sofa', name: "Dave's sofa", building: 'kestrel', rent: 0, councilTax: 0, sleepEnergy: 75, sleepMood: -6, landlord: 'Dave', pitch: 'Free, if you count your dignity as free. Dave pays the council tax and mentions it often.', dampRate: 0 },
  flatshare: { id: 'flatshare', name: 'Box room, Grimewood Court', building: 'grimewood', rent: 165, councilTax: 21, sleepEnergy: 100, sleepMood: 0, landlord: 'Nigel (Landlord)', pitch: '"Cosy" box room in a 6-bed flatshare. Bills not included. Prepayment meter. Window faces a wall.', dampRate: 9 },
  studio: { id: 'studio', name: 'Studio, Victoria Terrace', building: 'victoria', rent: 295, councilTax: 29, sleepEnergy: 100, sleepMood: 8, landlord: 'PropertyHub Solutions Ltd', pitch: 'Your own front door! The kitchen is also the bedroom is also the lounge. Key meter by the door.', dampRate: 6 },
  onebed: { id: 'onebed', name: 'One-bed, The Vantage', building: 'vantage', rent: 520, councilTax: 44, sleepEnergy: 100, sleepMood: 20, landlord: 'Marcus (Concierge)', pitch: 'Floor-to-ceiling windows, a gym, a concierge called Marcus. Smart meter (it is not smart).', dampRate: 2 },
};

// ------------------------------------------------------------------ jobs + career ladders
export interface Job {
  id: JobId;
  title: string;
  titles: string[]; // 5 rungs
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
  barista: { id: 'barista', title: 'Barista', titles: ['Barista', 'Senior Barista', 'Shift Lead', 'Assistant Manager', 'Store Manager'], employer: 'Prêt-à-Pricey', building: 'pret', pay: 52, hours: 4, unlockShifts: 0, energy: 22, hunger: 16, desc: 'Make oat flat whites for people who are "literally dying". Spell their names wrong.' },
  rider: { id: 'rider', title: 'Delivery Rider', titles: ['Delivery Rider', 'Rider (has a better bike)', 'Top Rider', 'Dispatch Lead', 'Head of Last-Mile Synergy'], employer: 'PFC Fried Chicken', building: 'pfc', pay: 0, hours: 3, unlockShifts: 0, energy: 26, hunger: 18, desc: 'Cycle chicken to doors around Peckwell. Paid per drop, plus tips if the chips are still warm.' },
  temp: { id: 'temp', title: 'Office Temp', titles: ['Office Temp', 'Admin Assistant', 'Executive Assistant', 'Project Coordinator', 'Head of Synergy'], employer: 'Synergy House', building: 'synergy', pay: 68, hours: 5, unlockShifts: 1, energy: 20, hunger: 18, desc: 'Triage the inbox. Reply to the boss, archive the cake emails, report the phishing.' },
  bus: { id: 'bus', title: 'Bus Driver', titles: ['Bus Driver', 'Senior Driver', 'Route Specialist', 'Garage Supervisor', 'Controller of the 436'], employer: 'Peckwell Bus Garage', building: 'garage', pay: 86, hours: 6, unlockShifts: 3, energy: 28, hunger: 22, desc: 'Drive the 436. Stop at the stops. Answer "does this go to Peckwell?" with saintly patience.' },
};
export const LEVEL_XP = [0, 20, 50, 95, 155];
export const LEVEL_PAY = [1, 1.25, 1.55, 1.9, 2.35];
export const SHIFT_COOLDOWN_MIN = 45;
export const MAX_SHIFTS_PER_DAY = 4;
export const jobTitle = (s: SaveState) => (s.job ? JOBS[s.job].titles[Math.max(0, Math.min(4, s.jobLevel - 1))] : 'Unemployed');
export const levelPay = (s: SaveState) => LEVEL_PAY[Math.max(0, Math.min(4, s.jobLevel - 1))];
export const nextLevelXp = (s: SaveState) => (s.jobLevel >= 5 ? null : LEVEL_XP[s.jobLevel]);

export function shiftAvailability(s: SaveState, t = now()): { ok: boolean; reason?: string } {
  const today = london(t).dateKey;
  const done = s.shiftDay === today ? s.shiftsToday : 0;
  if (done >= MAX_SHIFTS_PER_DAY) return { ok: false, reason: `You’ve done ${MAX_SHIFTS_PER_DAY} shifts today. Even Linda goes home eventually. Back tomorrow.` };
  const wait = s.lastShiftAt + SHIFT_COOLDOWN_MIN * 60000 - t;
  if (wait > 0) return { ok: false, reason: `On your break. Next shift on the rota in ${Math.ceil(wait / 60000)} min.` };
  if (s.energy < 20) return { ok: false, reason: 'Too knackered to work (need ⚡20+). Coffee or a kip first.' };
  return { ok: true };
}

export function shiftPay(job: Job, score: number, mult = 1) {
  // score 0..1 -> between 50% and 130% of base pay, then level and mood multipliers
  return Math.round(job.pay * (0.5 + 0.8 * Math.max(0, Math.min(1, score))) * mult * 100) / 100;
}

// ------------------------------------------------------------------ goals
export const GOALS: { id: GoalId; label: string }[] = [
  { id: 'job', label: 'Get a job at Jobcentre Minus' },
  { id: 'shift', label: 'Finish your first shift' },
  { id: 'sausage', label: 'Eat a sausage roll from Crumbs & Co.' },
  { id: 'chat', label: 'Post something on Natter (📱)' },
  { id: 'ducks', label: 'Feed the ducks at the park pond' },
  { id: 'pint', label: 'Have a pint at The Leaky Brolly' },
  { id: 'dm', label: 'Slide into someone’s DMs (Messages)' },
  { id: 'tube', label: 'Tap in with your Oyster at a station' },
  { id: 'rent', label: 'Rent your own place (sorry, Dave)' },
  { id: 'quiz', label: 'Win the pub quiz' },
  { id: 'promo', label: 'Get promoted' },
  { id: 'rentday', label: 'Survive rent day (real Monday, 09:00)' },
];

// ------------------------------------------------------------------ events between economy and UI
export type Tone = 'good' | 'bad' | 'info';
export type GameEvent =
  | { type: 'toast'; text: string; tone?: Tone }
  | { type: 'phone'; from: string; text: string; tone?: Tone; lines?: { label: string; amount: number }[]; quiet?: boolean }
  | { type: 'goal'; id: GoalId }
  | { type: 'passout' }
  | { type: 'moodlet'; id: string }
  | { type: 'gossip'; key: string }
  | { type: 'card'; id: string }
  | { type: 'post'; text: string }
  | { type: 'streak'; count: number; title: string; text: string }
  | { type: 'summary'; title: string; lines: string[] };

export function completeGoal(s: SaveState, id: GoalId, out: GameEvent[]) {
  if (s.goals[id]) return;
  s.goals[id] = true;
  out.push({ type: 'goal', id });
}
export function gainMoodlet(s: SaveState, id: string, out: GameEvent[], mins?: number) {
  if (addMoodlet(s, id, mins)) out.push({ type: 'moodlet', id });
}
export function gainSkill(s: SaveState, k: SkillId, amt: number) {
  s.skills[k] = Math.min(10, Math.round((s.skills[k] + amt) * 100) / 100);
}

// ------------------------------------------------------------------ state
export const SAVE_KEY = 'uklife.save.v1'; // key kept so old saves are found; contents are now version 2

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newSave(name: string, avatar: Avatar): SaveState {
  const t = now();
  return {
    version: 2,
    id: rid(),
    name,
    avatar,
    money: 120,
    oyster: 5.6,
    energy: 80,
    hunger: 60,
    social: 60,
    hygiene: 75,
    warmth: 70,
    mood: 65,
    moodlets: [],
    skills: { fitness: 0, charm: 0, brains: 0, graft: 0 },
    life: 0,
    lastSeen: t,
    job: null,
    jobLevel: 1,
    jobXp: 0,
    shifts: 0,
    shiftDay: '',
    shiftsToday: 0,
    lastShiftAt: 0,
    home: 'sofa',
    rent: 0,
    arrears: 0,
    lastBillKey: rentKey(t),
    umbrellaUntil: 0,
    inv: { teabags: 0, coat: false },
    cooldowns: {},
    goals: {},
    pos: { ...SPAWN },
    stats: { earned: 0, rentPaid: 0, sausageRolls: 0, pints: 0, tubeTrips: 0, actions: 0, quizWins: 0, ducksFed: 0, posts: 0 },
    streak: { day: '', count: 0, best: 0 },
    meter: 0,
    heating: false,
    damp: 0,
    lastDailyKey: london(t).dateKey,
    flags: {},
    eventLog: {},
    nextEventAt: t + 3 * 60000,
    uc: { claiming: false, appt: '', attended: false, searches: 0, weekEarned: 0, sanctioned: false },
    owned: { items: [], btl: 0, allotment: null, hustle: null },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Fill anything missing (or the wrong type) from the defaults. Never throws. */
function fillDefaults<T>(def: T, raw: unknown): T {
  if (!isObj(def) || !isObj(raw)) {
    if (typeof def === 'number') return (Number.isFinite(raw as number) ? raw : def) as T;
    if (typeof def === typeof raw) return raw as T;
    if (def === null) return (raw ?? null) as T; // nullable objects (allotment, hustle, job)
    return def;
  }
  const out: Record<string, unknown> = { ...raw };
  for (const [k, v] of Object.entries(def)) {
    if (Array.isArray(v)) out[k] = Array.isArray(raw[k]) ? raw[k] : v;
    else if (isObj(v) && Object.keys(v).length === 0) out[k] = isObj(raw[k]) ? raw[k] : v; // free-form maps
    else out[k] = fillDefaults(v, raw[k]);
  }
  return out as T;
}

/** Turn whatever is in localStorage into a valid current save (or null). Handles v1 saves. */
export function migrate(raw: unknown): SaveState | null {
  if (!isObj(raw) || typeof raw.name !== 'string' || !isObj(raw.avatar)) return null;
  const base = newSave(raw.name, raw.avatar as unknown as Avatar);
  if (raw.version === 1) {
    // v1 ran a 3-minute fake day; v2 runs on real UK time. Keep money, job, home and progress.
    const v1 = raw as Record<string, unknown>;
    const brolly = Number(v1.umbrellaUntil) > Number(v1.minutes);
    const shifts = Number(v1.shifts) || 0;
    const migrated: Record<string, unknown> = {
      ...base,
      id: typeof v1.id === 'string' ? v1.id : base.id,
      money: Number(v1.money) || 0,
      oyster: Number(v1.oyster) || 0,
      energy: Number(v1.energy) || 60,
      hunger: Number(v1.hunger) || 60,
      mood: Number(v1.mood) || 60,
      job: v1.job ?? null,
      shifts,
      jobXp: Math.min(40, shifts * 6),
      jobLevel: shifts >= 4 ? 2 : 1,
      home: v1.home ?? 'sofa',
      rent: Number(v1.rent) || 0,
      arrears: Number(v1.arrears) || 0,
      umbrellaUntil: brolly ? 2 * DAY_MIN : 0,
      goals: isObj(v1.goals) ? v1.goals : {},
      pos: isObj(v1.pos) ? v1.pos : base.pos,
      stats: { ...base.stats, ...(isObj(v1.stats) ? v1.stats : {}) },
      meter: v1.home && v1.home !== 'sofa' ? 10 : 0,
      flags: { migratedFromV1: true },
    };
    raw = migrated;
  }
  const s = fillDefaults(base, raw);
  s.version = 2;
  if (!(s.home in HOMES)) s.home = 'sofa';
  if (s.job && !(s.job in JOBS)) s.job = null;
  s.jobLevel = Math.max(1, Math.min(5, Math.round(s.jobLevel)));
  for (const k of ['energy', 'hunger', 'social', 'hygiene', 'warmth', 'mood'] as const) s[k] = clamp(s[k]);
  s.moodlets = s.moodlets.filter((m) => m && typeof m.id === 'string' && Number.isFinite(m.until));
  if (s.lastSeen > now() + 60000) s.lastSeen = now();
  return s;
}

export function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}
export function writeSave(s: SaveState) {
  try {
    s.lastSeen = now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota: carry on regardless */
  }
}

// ------------------------------------------------------------------ landlords
export const LANDLORD_OK: Record<Exclude<HomeId, 'sofa'>, string[]> = {
  flatshare: [
    'Hiya! Rent received, cheers 👍 Just FYI the boiler is "being looked at". Nigel',
    'Payment received. Please stop leaving passive aggressive notes about the bins on the fridge, it’s upsetting Tomasz. Nigel',
    'Ta for the rent. Someone will come round to look at the damp at some point between 8am and the heat death of the universe. N',
  ],
  studio: [
    'Dear Tenant, your rent has been received. Please note: hanging pictures, cooking fish, and "having guests" are not permitted. Kind regards, PropertyHub Solutions Ltd',
    'Dear Tenant, payment received. A routine inspection will occur Thursday. Please hide any evidence of joy. PropertyHub',
  ],
  onebed: [
    'Good morning! Rent received with thanks. Marcus at the concierge desk has signed for 14 of your parcels. He would like to know what you are doing with that many oat milks.',
    'Rent received. A gentle reminder that the rooftop terrace is closed for "the season", which is all of them. The Vantage Management',
  ],
};
export const LANDLORD_LATE: Record<Exclude<HomeId, 'sofa'>, string> = {
  flatshare: 'Mate. Rent hasn’t come through?? I have a mortgage on my third property to pay you know. Sort it by next Monday or I’m getting the locks changed. Nigel',
  studio: 'Dear Tenant, your payment FAILED. A late fee may or may not apply. A second missed payment will result in termination of your tenancy. PropertyHub Solutions Ltd',
  onebed: 'Marcus here. Management asked me to "have a word". I don’t want to have a word. Please just pay the rent. Second strike and you’re out.',
};

/** Rent day: the real Monday 09:00 in London. Billed at most once per Monday, even after a long absence. */
export function processBills(s: SaveState, out: GameEvent[], t = now()) {
  const key = rentKey(t);
  if (key > s.lastBillKey) {
    s.lastBillKey = key;
    weeklyHooks.forEach((fn) => fn(s, out));
    billWeek(s, out);
  }
}
/** Other systems (benefits, memberships, buy-to-let) register weekly hooks that run just before rent. */
export const weeklyHooks: ((s: SaveState, out: GameEvent[]) => void)[] = [];

export function billWeek(s: SaveState, out: GameEvent[]) {
  if (s.home === 'sofa') {
    out.push({ type: 'phone', from: 'Dave', text: pick(['Morning! No rent obviously, you’re family. But you DID finish my cereal. And the milk. And my oat milk. 🙃', 'Yo, the cat’s started sleeping on your pillow when you’re out. Just so you know. Also any chance you could find your own place this side of Christmas? x', 'Council tax came through. I paid it. Again. No pressure. (Some pressure.)']), tone: 'info' });
    return;
  }
  const home = HOMES[s.home];
  const ct = s.flags.ctDiscount ? Math.round(home.councilTax * 0.75 * 100) / 100 : home.councilTax;
  const total = s.rent + ct;
  const lines = [
    { label: `Rent · ${home.name}`, amount: s.rent },
    { label: s.flags.ctDiscount ? 'Council tax (25% single person discount)' : 'Council tax (Band B, feels like Band Z)', amount: ct },
  ];
  if (s.money >= total) {
    s.money = Math.round((s.money - total) * 100) / 100;
    s.stats.rentPaid += s.rent;
    s.arrears = 0;
    let text = pick(LANDLORD_OK[s.home]);
    if (chance(0.35)) {
      const old = s.rent;
      s.rent = Math.round(s.rent * 1.04);
      text += `\n\n(Rent going up from ${money(old)} to ${money(s.rent)}/week. "It’s the market.")`;
    }
    out.push({ type: 'phone', from: home.landlord, text, tone: 'info', lines });
    gainMoodlet(s, 'rent_paid', out);
    completeGoal(s, 'rentday', out);
  } else {
    s.arrears += 1;
    if (s.arrears >= 2) {
      out.push({ type: 'phone', from: home.landlord, text: 'That’s two missed payments. You’ve been evicted. Your stuff is in bin bags on the pavement. Dave says you can have the sofa back.', tone: 'bad', lines });
      s.home = 'sofa';
      s.rent = 0;
      s.arrears = 0;
      s.heating = false;
    } else out.push({ type: 'phone', from: home.landlord, text: LANDLORD_LATE[s.home], tone: 'bad', lines });
  }
}

// ------------------------------------------------------------------ daily login streak
export const STREAK_REWARDS: { title: string; text: string; apply: (s: SaveState) => void }[] = [
  { title: 'Found a fiver', text: '+£5. It was in your coat pocket. From 2019. Still counts.', apply: (s) => (s.money += 5) },
  { title: 'Free Crumbs voucher', text: 'A free sausage roll, delivered by a pigeon (allegedly). +30 🍔 and “Had a Crumbs”.', apply: (s) => { applyFx(s, { hunger: 30 }); addMoodlet(s, 'had_crumbs'); } },
  { title: 'Nan sent a tenner', text: '+£10 in a birthday card. It isn’t your birthday. “Don’t spend it on drink.”', apply: (s) => (s.money += 10) },
  { title: 'Tea round', text: '+10 teabags and +15 💬. Someone at the bus stop said “lovely day for it” and you agreed.', apply: (s) => { s.inv.teabags += 10; applyFx(s, { social: 15 }); } },
  { title: 'Council tax rebate', text: '+£15. Clerical error in your favour. Do not tell them.', apply: (s) => (s.money += 15) },
  { title: 'The brolly that lasts', text: 'A sturdy golf umbrella. Rain-proof for a whole week (you will still lose it eventually).', apply: (s) => (s.umbrellaUntil = Math.max(s.umbrellaUntil, s.life) + 7 * DAY_MIN) },
  { title: 'Sunday Roast Chest', text: '7-day streak! +£25, a roast with all the trimmings (+40 🍔) and maximum smugness.', apply: (s) => { s.money += 25; applyFx(s, { hunger: 40, mood: 10 }); addMoodlet(s, 'smug'); } },
];

export function checkStreak(s: SaveState, out: GameEvent[], t = now()) {
  const today = london(t).dateKey;
  if (s.streak.day === today) return;
  const continuing = s.streak.day === addDays(today, -1);
  s.streak.count = continuing ? s.streak.count + 1 : 1;
  s.streak.best = Math.max(s.streak.best, s.streak.count);
  s.streak.day = today;
  const r = STREAK_REWARDS[(s.streak.count - 1) % STREAK_REWARDS.length];
  r.apply(s);
  out.push({ type: 'streak', count: s.streak.count, title: r.title, text: r.text });
}

// ------------------------------------------------------------------ the live tick
export interface TickCtx {
  raining: boolean;
  outdoors: boolean;
  inPark: boolean;
  onShift: boolean;
  /** real ms since the last tick */
  dtMs: number;
  /** playing (moving about) vs a menu/phone being open */
  active: boolean;
}

/** Hooks other systems register for once-a-day / every-tick processing. */
export const dailyHooks: ((s: SaveState, out: GameEvent[], dayKey: string) => void)[] = [];
export const tickHooks: ((s: SaveState, ctx: TickCtx, out: GameEvent[]) => void)[] = [];

export function tick(s: SaveState, ctx: TickCtx, out: GameEvent[]) {
  const t = now();
  const mins = (ctx.dtMs / 60000) * (ctx.active ? LIFE_SPEED_ACTIVE : 1);
  passTime(s, mins, { raining: ctx.raining, outdoors: ctx.outdoors && !ctx.onShift });
  if (ctx.inPark && !ctx.raining) s.mood = clamp(s.mood + 5 * (mins / 60));
  if (ctx.outdoors && ctx.raining && s.umbrellaUntil <= s.life && !s.inv.coat && s.warmth < 45) gainMoodlet(s, 'soaked', out);
  if (s.umbrellaUntil > 0 && s.umbrellaUntil < s.life) {
    s.umbrellaUntil = 0;
    out.push({ type: 'toast', text: 'You left your umbrella on the bus. Classic.', tone: 'bad' });
  }
  if (s.energy <= 0) out.push({ type: 'passout' });
  s.lastSeen = t;
  const today = london(t).dateKey;
  if (s.lastDailyKey !== today) {
    s.lastDailyKey = today;
    dailyHooks.forEach((fn) => fn(s, out, today));
  }
  checkStreak(s, out, t);
  processBills(s, out, t);
  tickHooks.forEach((fn) => fn(s, ctx, out));
}

/** Come back after time away: replay up to 12 hours gently (needs won't be dragged below 20). */
export function catchUp(s: SaveState, out: GameEvent[], t = now()): number {
  const away = t - s.lastSeen;
  if (away < 3 * 60000) return 0;
  const mins = Math.min(CATCHUP_CAP_MIN, away / 60000);
  const before = { hunger: s.hunger, energy: s.energy, social: s.social, hygiene: s.hygiene, warmth: s.warmth };
  const backAt = london(t);
  const leftAt = london(s.lastSeen);
  const slept = mins >= 300 || (mins >= 120 && (backAt.hh >= 5 && backAt.hh <= 11 || leftAt.hh >= 21 || leftAt.hh <= 3));
  passTime(s, mins, { raining: false, outdoors: false, rate: 0.5, floor: 20 });
  const lines: string[] = [`You were away for ${fmtAway(away)}${away > CATCHUP_CAP_MIN * 60000 ? ' (Peckwell only remembers the last 12 hours)' : ''}.`];
  if (slept) {
    const home = HOMES[s.home];
    const cold = s.home !== 'sofa' && s.meter <= 0;
    s.energy = Math.max(s.energy, home.sleepEnergy * (cold ? 0.7 : 0.95));
    if (s.home === 'sofa') {
      addMoodlet(s, 'sofa_back');
      lines.push('You slept on Dave’s sofa. The cat sat on your face at 4am.');
    } else if (cold) {
      addMoodlet(s, 'cold_flat');
      lines.push('You slept in a cold flat (the meter ran dry). Brrr.');
    } else {
      addMoodlet(s, 'well_rested');
      lines.push(`You slept at ${home.name}. Well rested!`);
    }
  }
  const diff = (k: keyof typeof before, icon: string) => {
    const d = Math.round(s[k] - before[k]);
    if (Math.abs(d) >= 3) lines.push(`${icon} ${d > 0 ? '+' : ''}${d}`);
  };
  diff('energy', '⚡ Energy');
  diff('hunger', '🍔 Fullness');
  diff('social', '💬 Social');
  diff('hygiene', '🫧 Hygiene');
  s.lastSeen = t;
  out.push({ type: 'summary', title: 'While you were out…', lines });
  return mins;
}
const fmtAway = (ms: number) => {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)} days`;
};

// ------------------------------------------------------------------ shifts
export function finishShift(s: SaveState, job: Job, pay: number, out: GameEvent[]) {
  const t = now();
  s.money = Math.round((s.money + pay) * 100) / 100;
  s.stats.earned += pay;
  s.uc.weekEarned += pay;
  s.shifts += 1;
  const today = london(t).dateKey;
  s.shiftsToday = s.shiftDay === today ? s.shiftsToday + 1 : 1;
  s.shiftDay = today;
  s.lastShiftAt = t;
  passTime(s, job.hours * 60 * 0.5, { raining: false, outdoors: false });
  applyFx(s, { energy: -job.energy, hunger: -job.hunger * 0.5 });
  gainSkill(s, 'graft', 0.25);
  completeGoal(s, 'shift', out);
  if (s.shifts === 1 || s.shifts === 3) {
    const unlocked = Object.values(JOBS).filter((j) => j.unlockShifts === s.shifts);
    if (unlocked.length) out.push({ type: 'toast', text: `New job unlocked at the Jobcentre: ${unlocked.map((j) => j.title).join(', ')}`, tone: 'good' });
  }
}
