export type HairStyle = 'short' | 'long' | 'bun' | 'afro' | 'bald' | 'mohawk' | 'braids' | 'ponytail' | 'curly' | 'fade';
export type OutfitStyle = 'hoodie' | 'suit' | 'puffer' | 'tracksuit' | 'dress' | 'hivis' | 'mac' | 'knit' | 'football';
export type Accessory = 'none' | 'cap' | 'glasses' | 'headphones' | 'beanie' | 'scarf' | 'flatcap';
export type Beard = 'none' | 'stubble' | 'beard' | 'tache';
/** How the character presents (and their body build in the art). Every style is open to every gender. */
export type Gender = 'male' | 'female' | 'other';
/** Which pronouns the game uses for you in the third person (gossip, NPC chat). */
export type Pronouns = 'he' | 'she' | 'they';

export interface Avatar {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  outfit: OutfitStyle;
  outfitColor: string;
  accessory: Accessory;
  /** optional so older saves and older clients' avatars stay valid */
  beard?: Beard;
  /** optional for the same reason; missing = 'other' (an androgynous build) */
  gender?: Gender;
  /** missing = they/them */
  pronouns?: Pronouns;
}

export type Facing = 'down' | 'up' | 'left' | 'right';

export type JobId = 'barista' | 'rider' | 'temp' | 'bus';
export type HomeId = 'sofa' | 'flatshare' | 'studio' | 'onebed';
export type GoalId = 'job' | 'shift' | 'sausage' | 'tube' | 'rent' | 'rentday' | 'pint' | 'chat' | 'ducks' | 'dm' | 'quiz' | 'promo';
export type NeedId = 'hunger' | 'energy' | 'social' | 'hygiene' | 'warmth';
export type SkillId = 'fitness' | 'charm' | 'brains' | 'graft';

export interface ActiveMoodlet {
  id: string;
  /** life-minute it wears off */
  until: number;
}

/** How well you know someone (a local, a member of staff or another player). */
export interface Rel {
  pts: number;
  /** real ms of the last interaction */
  last: number;
  /** consecutive London days you've interacted */
  streak: number;
  /** London date of the last streak day */
  day: string;
  /** action -> real ms when available again */
  cds: Record<string, number>;
  /** London date of the last favour */
  fav?: string;
  /** display name (players' keys are ids) */
  name?: string;
}

export interface SaveState {
  version: 2;
  id: string;
  name: string;
  avatar: Avatar;
  money: number;
  oyster: number;
  // needs, 0-100 (100 = great)
  energy: number;
  hunger: number; // "fullness"
  social: number;
  hygiene: number;
  warmth: number; // warm & dry
  mood: number; // base mood; moodlets sit on top of it
  moodlets: ActiveMoodlet[];
  skills: Record<SkillId, number>;
  /** "life minutes": your personal clock. Ticks with real time (faster while you play) and with every action you do. */
  life: number;
  /** real ms the save was last ticked (for offline catch-up) */
  lastSeen: number;
  // work
  job: JobId | null;
  jobLevel: number; // 1-5
  jobXp: number;
  shifts: number;
  shiftDay: string; // London date key of shiftsToday
  shiftsToday: number;
  lastShiftAt: number; // real ms
  // home
  home: HomeId;
  rent: number;
  arrears: number;
  lastBillKey: string; // Monday date key last billed
  umbrellaUntil: number; // life-minute the brolly is inevitably lost
  // things
  inv: { teabags: number; coat: boolean; veg: number };
  cooldowns: Record<string, number>; // action id -> real ms when available again
  goals: Partial<Record<GoalId, boolean>>;
  pos: { x: number; y: number };
  stats: { earned: number; rentPaid: number; sausageRolls: number; pints: number; tubeTrips: number; actions: number; quizWins: number; ducksFed: number; posts: number };
  streak: { day: string; count: number; best: number };
  // phase 2: home comfort
  meter: number; // prepayment electric credit (£)
  heating: boolean;
  damp: number; // 0-100
  lastDailyKey: string; // London date of the last daily roll
  // phase 2: events + benefits
  flags: Record<string, string | number | boolean>;
  eventLog: Record<string, number>; // event id -> real ms last fired
  nextEventAt: number; // real ms
  uc: { claiming: boolean; appt: string; attended: boolean; searches: number; weekEarned: number; sanctioned: boolean };
  // phase 3: things to own
  // round 6: people
  /** relationships, keyed npc:Name / staff:Name / player:pid */
  rel: Record<string, Rel>;
  /** Natter author ids you follow */
  follows: string[];
  /** lifetime wish id -> real ms completed */
  wishes: Record<string, number>;
  owned: { items: string[]; btl: number; allotment: null | { planted: number; crop: string }; hustle: null | { stock: string[]; listings: { item: string; price: number; sellAt: number; haggled?: boolean }[] } };
}
