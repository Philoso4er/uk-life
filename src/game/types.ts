export type HairStyle = 'short' | 'long' | 'bun' | 'afro' | 'bald' | 'mohawk' | 'braids';
export type OutfitStyle = 'hoodie' | 'suit' | 'puffer' | 'tracksuit' | 'dress' | 'hivis';
export type Accessory = 'none' | 'cap' | 'glasses' | 'headphones' | 'beanie';

export interface Avatar {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  outfit: OutfitStyle;
  outfitColor: string;
  accessory: Accessory;
}

export type Facing = 'down' | 'up' | 'left' | 'right';

export type JobId = 'barista' | 'rider' | 'temp' | 'bus';
export type HomeId = 'sofa' | 'flatshare' | 'studio' | 'onebed';
export type GoalId =
  | 'job'
  | 'shift'
  | 'sausage'
  | 'tube'
  | 'rent'
  | 'rentday'
  | 'pint'
  | 'chat';

export interface SaveState {
  version: 1;
  id: string;
  name: string;
  avatar: Avatar;
  money: number;
  oyster: number;
  energy: number;
  hunger: number; // "fullness": 100 = stuffed, 0 = starving
  mood: number;
  minutes: number; // game minutes since Monday 00:00, week 1
  job: JobId | null;
  shifts: number;
  home: HomeId;
  rent: number; // current weekly rent (landlords love a rise)
  arrears: number;
  lastBillWeek: number;
  umbrellaUntil: number; // game minute the brolly is inevitably lost
  goals: Partial<Record<GoalId, boolean>>;
  pos: { x: number; y: number };
  stats: { earned: number; rentPaid: number; sausageRolls: number; pints: number; tubeTrips: number };
}
