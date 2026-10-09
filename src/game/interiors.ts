// Walk-in interiors. Every main building has a small room you can walk around with the same
// tap-to-move controls as the street: furniture, counters, staff behind them, and "use spots"
// (the till, the bar, the bed…) where the building's timed actions happen.
//
// Coordinates are tiles inside the room. Rows 0-1 are the back wall (things hang on it), the
// left/right columns are side walls, the bottom row is the front wall with the exit door at `exit`.
import type { Avatar, Facing, Gender, HomeId, SaveState } from './types';
import type { Grid } from './pathfind';
import { ACTIONS, actionsFor } from './actions';
import { buildingById, type Building } from './world';

export type FurnKind =
  | 'counter' | 'case' | 'bar' | 'till' | 'taps' | 'coffee' | 'table' | 'chair' | 'stool' | 'shelf' | 'fridge' | 'sofa' | 'armchair' | 'bed' | 'tv'
  | 'kitchen' | 'shower' | 'washer' | 'dryer' | 'pool' | 'fire' | 'desk' | 'pcs' | 'plant' | 'rug' | 'barberchair' | 'mirror' | 'books'
  | 'treadmill' | 'weights' | 'ticketmachine' | 'barrier' | 'screens' | 'sign' | 'radiator' | 'bench' | 'quizmachine' | 'rack' | 'board'
  | 'dog' | 'cat' | 'bike' | 'door' | 'meter' | 'mould' | 'window' | 'bin' | 'watercooler' | 'escalator' | 'map';

export interface Furn {
  k: FurnKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** main colour */
  c?: string;
  /** label / sign text */
  label?: string;
  /** solid (default: true for most things, false for flat or wall-mounted ones) */
  solid?: boolean;
  /** tapping it uses this spot */
  use?: string;
}

export type Special = 'jobs' | 'travel' | 'homes' | 'barber' | 'shift';
export interface UseSpot {
  id: string;
  label: string;
  emoji: string;
  /** where you stand to use it */
  at: [number, number];
  face: Facing;
  /** action ids done here (filtered to what exists at this place) */
  actions?: string[];
  /** also takes every action of the place that no other spot claims */
  rest?: boolean;
  special?: Special;
}

export interface Staff {
  name: string;
  role: string;
  gender: Gender;
  at: [number, number];
  face: Facing;
  look?: Partial<Avatar>;
  bio: string;
}

export interface Interior {
  /** the building id (also the multiplayer "room") */
  id: string;
  title: string;
  w: number;
  h: number;
  floor: 'wood' | 'check' | 'carpet' | 'lino' | 'tile' | 'concrete';
  floorC: [string, string];
  wallC: string;
  trimC: string;
  exit: number;
  furn: Furn[];
  uses: UseSpot[];
  staff: Staff[];
  /** where locals stand / sit */
  hang: [number, number][];
  /** pub carpet, posh tiles… */
  mood?: 'warm' | 'cool' | 'bright';
}

const NON_SOLID: FurnKind[] = ['rug', 'bench', 'armchair', 'sign', 'window', 'mould', 'board', 'mirror', 'map', 'till', 'taps', 'coffee', 'chair', 'stool', 'dog', 'cat', 'meter', 'door'];
export const isSolidFurn = (f: Furn) => f.solid ?? !NON_SOLID.includes(f.k);

const F = (k: FurnKind, x: number, y: number, w = 1, h = 1, o: Partial<Furn> = {}): Furn => ({ k, x, y, w, h, ...o });

// ------------------------------------------------------------------ the rooms
function shopShell(id: string, title: string, w: number, h: number, exit: number, o: Partial<Interior>): Interior {
  return { id, title, w, h, exit, floor: 'lino', floorC: ['#d8d2c4', '#cfc8b8'], wallC: '#e8e1d0', trimC: '#7a6a55', furn: [], uses: [], staff: [], hang: [], ...o };
}

const BREAD = '#c98a3e';
export const INTERIORS: Record<string, Interior> = {
  crumbs: shopShell('crumbs', 'Crumbs & Co.', 12, 9, 6, {
    floor: 'check', floorC: ['#f3e9d6', '#d9c7a4'], wallC: '#2f56a0', trimC: '#ffd23f', mood: 'warm',
    furn: [
      F('shelf', 1, 2, 7, 1, { c: BREAD, solid: true }),
      F('sign', 3, 0, 4, 1, { label: 'HOT · FRESH · ISH', c: '#ffd23f' }),
      F('window', 9, 0, 2, 1),
      F('case', 2, 4, 5, 1, { c: '#2f56a0', use: 'counter' }),
      F('counter', 7, 4, 2, 1, { c: '#2f56a0', use: 'counter' }),
      F('till', 8, 4, 1, 1),
      F('door', 10, 2, 1, 1, { label: 'STAFF', use: 'helpout' }),
      F('table', 2, 6, 1, 1), F('stool', 1, 6), F('stool', 3, 6),
      F('table', 9, 6, 1, 1), F('stool', 8, 6), F('stool', 10, 6),
      F('rug', 5, 7, 3, 1, { c: '#ffd23f' }),
    ],
    uses: [
      { id: 'counter', label: 'Counter', emoji: '🥐', at: [5, 5.45], face: 'up', rest: true, actions: ['sroll', 'vroll', 'steak', 'donut', 'coffee', 'warmones'] },
      { id: 'helpout', label: 'Help behind the counter', emoji: '🧹', at: [10.5, 3.6], face: 'up', actions: ['rush'] },
    ],
    staff: [{ name: 'Shaz', role: 'Crumbs counter', gender: 'female', at: [4.6, 3.45], face: 'down', look: { outfit: 'tracksuit', outfitColor: '#2d5bd1', accessory: 'none', hair: 'bun' }, bio: 'Has served 40,000 sausage rolls. Remembers every regular’s order and judges it silently.' }],
    hang: [[1.5, 6.7], [3.5, 6.7], [8.5, 6.7], [10.5, 6.7], [5.5, 6.2], [7.5, 6.4], [3.2, 7.5]],
  }),
  kwik: shopShell('kwik', 'Kwik Mart Food & Wine', 12, 9, 6, {
    floor: 'lino', floorC: ['#e2e6df', '#d3d9d0'], wallC: '#2f8f4e', trimC: '#d92b2b',
    furn: [
      F('fridge', 1, 2, 3, 1, { use: 'fridges' }),
      F('shelf', 5, 2, 4, 1, { c: '#e3b23c', use: 'crisps' }),
      F('sign', 5, 0, 4, 1, { label: 'SINGLE ONIONS · CHARGERS', c: '#ffffff' }),
      F('shelf', 2, 5, 4, 1, { c: '#d24b4b', use: 'crisps' }),
      F('counter', 8, 5, 3, 1, { c: '#6b4a2b', use: 'till' }),
      F('till', 9, 5, 1, 1),
      F('board', 9, 0, 2, 1, { label: 'LOTTO', c: '#e74c3c' }),
      F('meter', 10, 2, 1, 1, { use: 'till' }),
    ],
    uses: [
      { id: 'till', label: 'Till (Raj)', emoji: '🧾', at: [9.5, 6.5], face: 'up', rest: true, actions: ['scratch', 'brolly', 'teabags', 'meter10', 'meter20', 'sellveg', 'shopnatter'] },
      { id: 'fridges', label: 'Fridges', emoji: '🧊', at: [2.5, 3.5], face: 'up', actions: ['energydrink', 'mealdeal'] },
      { id: 'crisps', label: 'Crisp aisle', emoji: '🥔', at: [7, 3.5], face: 'up', actions: ['crisps'] },
    ],
    staff: [{ name: 'Raj', role: 'Kwik Mart owner', gender: 'male', at: [9.5, 4.45], face: 'down', look: { outfit: 'knit', outfitColor: '#8d6e63', hair: 'short', hairColor: '#9aa0a6', beard: 'beard' }, bio: 'Open 7am till late, 364 days a year. Knows everyone’s business and keeps most of it.' }],
    hang: [[3.5, 4], [4.5, 6.6], [1.5, 7], [7, 4], [6.5, 7.2]],
  }),
  pret: shopShell('pret', 'Prêt-à-Pricey', 13, 9, 6, {
    floor: 'wood', floorC: ['#a87b54', '#93694a'], wallC: '#7b1730', trimC: '#f6e7c1', mood: 'warm',
    furn: [
      F('fridge', 1, 2, 2, 1, { use: 'counter' }),
      F('shelf', 3, 2, 4, 1, { c: '#e9d6a8' }),
      F('counter', 2, 4, 6, 1, { c: '#3a2a22', use: 'counter' }),
      F('coffee', 6, 4, 1, 1),
      F('till', 3, 4, 1, 1),
      F('door', 8, 2, 1, 1, { label: 'STAFF', use: 'staffroom' }),
      F('sign', 3, 0, 4, 1, { label: 'ARTISAN · ISH', c: '#f6e7c1' }),
      F('window', 9, 0, 3, 1),
      F('table', 10, 3, 2, 1, { use: 'window' }), F('stool', 10, 4), F('stool', 11, 4),
      F('table', 2, 6, 1, 1), F('chair', 1, 6), F('chair', 3, 6),
      F('table', 10, 6, 1, 1), F('chair', 9, 6), F('chair', 11, 6),
      F('plant', 11, 7),
    ],
    uses: [
      { id: 'counter', label: 'Counter', emoji: '🥑', at: [5, 5.45], face: 'up', rest: true, actions: ['avo', 'crayfish', 'cookie', 'flatwhite'] },
      { id: 'window', label: 'Window seat', emoji: '💻', at: [10.5, 4.6], face: 'up', actions: ['laptop'] },
      { id: 'staffroom', label: 'Staff room', emoji: '☕', at: [8.5, 3.6], face: 'up', special: 'shift' },
    ],
    staff: [{ name: 'Jules', role: 'Barista', gender: 'other', at: [5.5, 3.45], face: 'down', look: { outfit: 'knit', outfitColor: '#7b1730', hair: 'mohawk', hairColor: '#e05fa8' }, bio: 'Writes your name on the cup with total confidence and total inaccuracy.' }],
    hang: [[10.5, 4.6], [11.5, 4.6], [1.5, 6.7], [3.5, 6.7], [9.5, 6.7], [11.5, 6.7], [6.5, 6.6]],
  }),
  jobcentre: shopShell('jobcentre', 'Jobcentre Minus', 13, 9, 6, {
    floor: 'tile', floorC: ['#c9cfd3', '#bcc3c8'], wallC: '#dfe3e1', trimC: '#00786f', mood: 'cool',
    furn: [
      F('sign', 4, 0, 5, 1, { label: 'NOW SERVING: 9', c: '#ff5a3c' }),
      F('board', 1, 0, 3, 1, { label: 'JOBS', c: '#00786f', use: 'board' }),
      F('desk', 7, 3, 3, 1, { use: 'desk' }),
      F('pcs', 7, 3, 1, 1, { solid: false }),
      F('ticketmachine', 11, 2, 1, 1, { use: 'ticket' }),
      F('watercooler', 1, 2, 1, 1, { use: 'coffee' }),
      F('bench', 2, 5, 4, 1, { c: '#7c8a93' }),
      F('bench', 2, 7, 4, 1, { c: '#7c8a93' }),
      F('plant', 11, 7, 1, 1),
    ],
    uses: [
      { id: 'desk', label: 'Desk (Sandra)', emoji: '🤝', at: [8.5, 4.55], face: 'up', rest: true, actions: ['ucappt', 'ucclaim', 'ucstatus', 'ucclose'] },
      { id: 'board', label: 'Job board', emoji: '📋', at: [2.5, 2.6], face: 'up', actions: ['jobboard'], special: 'jobs' },
      { id: 'ticket', label: 'Ticket machine', emoji: '🎟️', at: [11.5, 3.6], face: 'up', actions: ['ticket'] },
      { id: 'coffee', label: 'Free coffee machine', emoji: '☕', at: [1.5, 3.6], face: 'up', actions: ['jcoffee'] },
    ],
    staff: [{ name: 'Sandra', role: 'Work coach', gender: 'female', at: [8.5, 2.6], face: 'down', look: { outfit: 'suit', outfitColor: '#2a9d8f', hair: 'bun', hairColor: '#4a2f1f', accessory: 'glasses' }, bio: 'Work coach. Has a photo of her cat on the monitor and a quiet belief in you.' }],
    hang: [[2.5, 5.9], [3.5, 5.9], [4.5, 5.9], [2.5, 7.9], [4.5, 7.9], [10.5, 5.5], [6.5, 6.5]],
  }),
  pub: shopShell('pub', 'The Leaky Brolly', 16, 11, 8, {
    floor: 'carpet', floorC: ['#6e2430', '#5a1c27'], wallC: '#2d4a37', trimC: '#c9a24a', mood: 'warm',
    furn: [
      F('shelf', 2, 2, 6, 1, { c: '#8fbf6a' }),
      F('bar', 2, 4, 7, 1, { c: '#5a3a22', use: 'bar' }),
      F('taps', 4, 4, 2, 1),
      F('till', 7, 4, 1, 1),
      F('stool', 3, 5), F('stool', 5, 5), F('stool', 7, 5),
      F('fire', 11, 2, 2, 1, { use: 'fire' }),
      F('armchair', 10, 3, 1, 1), F('armchair', 13, 3, 1, 1),
      F('sign', 3, 0, 4, 1, { label: 'NO SWEARING · CLIVE IS LISTENING', c: '#e4c46a' }),
      F('window', 14, 0, 1, 1), F('window', 9, 0, 1, 1),
      F('quizmachine', 14, 2, 1, 1, { use: 'quizmachine' }),
      F('pool', 10, 6, 3, 2, { use: 'pool' }),
      F('table', 2, 7, 2, 1, { use: 'quiz' }), F('chair', 1, 7), F('chair', 4, 7),
      F('table', 6, 8, 1, 1), F('chair', 5, 8), F('chair', 7, 8),
      F('table', 14, 8, 1, 1), F('chair', 13, 8),
      F('dog', 9, 4, 1, 1, { use: 'clive' }),
      F('board', 1, 0, 2, 1, { label: 'QUIZ TUE', c: '#1e3a2b', use: 'quiz' }),
    ],
    uses: [
      { id: 'bar', label: 'The bar (Mo)', emoji: '🍺', at: [6, 5.5], face: 'up', rest: true, actions: ['pint', 'round', 'justone', 'roast', 'glasses'] },
      { id: 'fire', label: 'Fireplace', emoji: '🔥', at: [12, 3.6], face: 'up', actions: ['fire'] },
      { id: 'pool', label: 'Pool table', emoji: '🎱', at: [11.5, 8.6], face: 'up', actions: ['pool'] },
      { id: 'quizmachine', label: 'Quiz machine', emoji: '🕹️', at: [14.5, 3.6], face: 'up', actions: ['quizmachine'] },
      { id: 'quiz', label: 'Quiz table', emoji: '🧠', at: [3, 8.4], face: 'up', actions: ['quiz'] },
      { id: 'clive', label: 'Clive the dog', emoji: '🐕', at: [9.5, 5.6], face: 'up', actions: ['clive'] },
    ],
    staff: [{ name: 'Mo', role: 'Landlady', gender: 'female', at: [5.5, 3.45], face: 'down', look: { outfit: 'knit', outfitColor: '#1e3a2b', hair: 'long', hairColor: '#b8462a', accessory: 'glasses' }, bio: 'Landlady of the Leaky Brolly since 2003. Has barred three people, one of them twice, and one of them her brother.' }],
    hang: [[3.5, 5.6], [5.4, 5.7], [7.5, 5.6], [10.5, 3.9], [13.5, 3.9], [1.5, 7.7], [4.5, 7.7], [5.5, 8.7], [7.5, 8.7], [13.5, 8.7], [9.5, 7], [12.5, 5.4]],
  }),
  bookies: shopShell('bookies', 'LadBroke Bookmakers', 12, 9, 6, {
    floor: 'carpet', floorC: ['#1f4f3a', '#1a4532'], wallC: '#0f3a26', trimC: '#ffffff', mood: 'cool',
    furn: [
      F('screens', 1, 0, 6, 1, { use: 'screens' }),
      F('counter', 8, 3, 3, 1, { c: '#0f7a3d', use: 'counter' }),
      F('till', 9, 3, 1, 1),
      F('bench', 1, 4, 5, 1, { c: '#3d4a44', use: 'regulars' }),
      F('stool', 1, 5), F('stool', 3, 5), F('stool', 5, 5),
      F('quizmachine', 10, 6, 1, 1, { c: '#ffd23f' }),
      F('bin', 1, 7),
      F('sign', 7, 0, 4, 1, { label: 'WHEN THE FUN STOPS, STOP', c: '#ffd23f' }),
    ],
    uses: [
      { id: 'counter', label: 'Counter', emoji: '🐎', at: [9.5, 4.55], face: 'up', rest: true, actions: ['horse', 'acca'] },
      { id: 'screens', label: 'The screens', emoji: '📺', at: [3.5, 2.7], face: 'up', actions: ['dogs'] },
      { id: 'regulars', label: 'The regulars', emoji: '🗣️', at: [3, 5.7], face: 'up', actions: ['tactics'] },
    ],
    staff: [{ name: 'Pam', role: 'Cashier', gender: 'female', at: [9.5, 2.6], face: 'down', look: { outfit: 'hoodie', outfitColor: '#0f7a3d', hair: 'short', hairColor: '#d9b44a' }, bio: 'Has seen every accumulator fail. Still says “good luck, love” and means it.' }],
    hang: [[1.5, 5.6], [3.5, 5.6], [5.5, 5.6], [7.5, 6.5], [3.5, 7.2]],
  }),
  pawn: shopShell('pawn', 'Pawnderful', 11, 8, 5, {
    floor: 'lino', floorC: ['#d9cfb2', '#cdc2a2'], wallC: '#e2b33b', trimC: '#111111',
    furn: [
      F('shelf', 1, 2, 4, 1, { c: '#7f8c8d' }),
      F('shelf', 6, 2, 4, 1, { c: '#c0392b' }),
      F('case', 2, 4, 6, 1, { c: '#111111', use: 'counter' }),
      F('sign', 3, 0, 5, 1, { label: 'BACK IN 5 MINS', c: '#ffd23f' }),
      F('rack', 9, 5, 1, 1),
    ],
    uses: [{ id: 'counter', label: 'Counter (Del)', emoji: '💍', at: [5, 5.5], face: 'up', rest: true, actions: ['pawnknock', 'sellgames', 'speaker'] }],
    staff: [{ name: 'Del', role: 'Pawnbroker', gender: 'male', at: [5.5, 3.45], face: 'down', look: { outfit: 'suit', outfitColor: '#8d6e63', hair: 'bald', beard: 'tache', accessory: 'glasses' }, bio: '“Back in 5 mins” since 2019. Can value a bread maker from across the street.' }],
    hang: [[2.5, 6], [7.5, 6], [8.5, 5.4]],
  }),
  pfc: shopShell('pfc', 'PFC · Peckwell Fried Chicken', 12, 9, 6, {
    floor: 'tile', floorC: ['#f1f1f1', '#e2e2e2'], wallC: '#c9221f', trimC: '#ffe066', mood: 'bright',
    furn: [
      F('kitchen', 1, 2, 6, 1, { c: '#b9bec4' }),
      F('counter', 2, 4, 6, 1, { c: '#c9221f', use: 'counter' }),
      F('till', 6, 4, 1, 1),
      F('board', 2, 0, 4, 1, { label: '2 WINGS + CHIPS £2.99', c: '#ffe066' }),
      F('desk', 9, 3, 2, 1, { c: '#555', use: 'riders' }),
      F('bike', 10, 2, 1, 1),
      F('table', 2, 6, 2, 1), F('stool', 1, 6), F('stool', 4, 6),
      F('table', 9, 6, 2, 1), F('stool', 8, 6), F('stool', 11, 6, 1, 1, { solid: false }),
    ],
    uses: [
      { id: 'counter', label: 'Counter (Kemal)', emoji: '🍗', at: [5, 5.5], face: 'up', rest: true, actions: ['wings', 'boxmeal', 'gravy'] },
      { id: 'riders', label: 'Rider desk', emoji: '🛵', at: [9.5, 4.55], face: 'up', special: 'shift' },
    ],
    staff: [{ name: 'Kemal', role: 'Fryer', gender: 'male', at: [4.5, 3.45], face: 'down', look: { outfit: 'hoodie', outfitColor: '#c9221f', hair: 'fade', beard: 'stubble', accessory: 'cap' }, bio: 'Runs the fryer and the delivery riders. Says “two minutes, boss” and means eleven.' }],
    hang: [[1.5, 6.7], [4.5, 6.7], [8.5, 6.7], [7.5, 5.5], [10.5, 7.3]],
  }),
  laundry: shopShell('laundry', 'Spin City Launderette', 12, 9, 6, {
    floor: 'check', floorC: ['#e9f2f6', '#cfe1e8'], wallC: '#4aa3c7', trimC: '#ffffff', mood: 'bright',
    furn: [
      F('washer', 1, 2, 5, 1, { use: 'washers' }),
      F('dryer', 7, 2, 4, 1, { use: 'dryers' }),
      F('table', 7, 5, 3, 1, { c: '#d9d9d9', use: 'towels' }),
      F('bench', 1, 5, 4, 1, { c: '#e67e22', use: 'washers' }),
      F('sign', 2, 0, 5, 1, { label: 'ONE MACHINE WORKS', c: '#1b6d8f' }),
      F('bin', 11, 7),
    ],
    uses: [
      { id: 'washers', label: 'The washers', emoji: '🧺', at: [3, 3.6], face: 'up', rest: true, actions: ['wash', 'watchmachines'] },
      { id: 'dryers', label: 'Tumble dryers', emoji: '♨️', at: [9, 3.6], face: 'up', actions: ['dryers'] },
      { id: 'towels', label: 'Folding table', emoji: '🧻', at: [8.5, 6.6], face: 'up', actions: ['towels'] },
    ],
    staff: [{ name: 'Ray', role: 'Towel folder', gender: 'male', at: [8.5, 4.45], face: 'down', look: { outfit: 'knit', outfitColor: '#9aa0a6', hair: 'bald', beard: 'tache' }, bio: 'Has been folding the same towel since 2011. Said his own name out loud once. Big day.' }],
    hang: [[1.5, 5.9], [2.5, 5.9], [4.5, 5.9], [5.5, 7], [10.5, 6.6]],
  }),
  garage: shopShell('garage', 'Peckwell Bus Garage', 14, 9, 7, {
    floor: 'concrete', floorC: ['#9da3a8', '#949a9f'], wallC: '#8b2222', trimC: '#ffd23f', mood: 'cool',
    furn: [
      F('desk', 2, 3, 3, 1, { c: '#6d6d6d', use: 'office' }),
      F('board', 1, 0, 4, 1, { label: 'ROTA', c: '#ffffff', use: 'office' }),
      F('window', 8, 0, 5, 1, { use: 'wash' }),
      F('sign', 6, 0, 2, 1, { label: '436', c: '#d42020' }),
      F('bench', 8, 5, 4, 1, { c: '#555', use: 'wash' }),
      F('watercooler', 12, 2),
      F('table', 2, 6, 2, 1), F('chair', 1, 6), F('chair', 4, 6),
    ],
    uses: [
      { id: 'office', label: 'Depot office', emoji: '🚌', at: [3.5, 4.6], face: 'up', special: 'shift', rest: true },
      { id: 'wash', label: 'Bus wash window', emoji: '🫧', at: [10, 3], face: 'up', actions: ['buswash'] },
    ],
    staff: [{ name: 'Dennis', role: 'Garage controller', gender: 'male', at: [3.5, 2.55], face: 'down', look: { outfit: 'hivis', hair: 'short', hairColor: '#9aa0a6', beard: 'beard' }, bio: 'Controller of the 436. Has heard “does this go to Peckwell?” 40,000 times. Still answers.' }],
    hang: [[8.5, 5.9], [10.5, 5.9], [1.5, 6.7], [4.5, 6.7], [6.5, 7.2]],
  }),
  barber: shopShell('barber', 'Fade to Grey Barbers', 11, 8, 5, {
    floor: 'check', floorC: ['#f2f2f2', '#2b2b2b'], wallC: '#20232a', trimC: '#e23b3b',
    furn: [
      F('mirror', 1, 0, 6, 1),
      F('barberchair', 2, 2, 1, 1, { use: 'chair' }),
      F('barberchair', 5, 2, 1, 1, { use: 'chair' }),
      F('bench', 6, 5, 4, 1, { c: '#7b5a3a', use: 'bench' }),
      F('tv', 8, 2, 2, 1, { use: 'bench' }),
      F('plant', 1, 6),
    ],
    uses: [
      { id: 'chair', label: 'Barber’s chair', emoji: '💈', at: [3.5, 3.6], face: 'up', rest: true, actions: ['trim'], special: 'barber' },
      { id: 'bench', label: 'Waiting bench (the football’s on)', emoji: '⚽', at: [8, 4.5], face: 'up', actions: ['football'] },
    ],
    staff: [{ name: 'Dimitri', role: 'Barber', gender: 'male', at: [4.4, 2.9], face: 'down', look: { outfit: 'hoodie', outfitColor: '#20232a', hair: 'fade', beard: 'beard' }, bio: 'Skin fades and strong opinions about the back four. Will give you the same cut whatever you ask for.' }],
    hang: [[6.5, 5.9], [7.5, 5.9], [9.5, 5.9], [2.5, 5.5]],
  }),
  charity: shopShell('charity', 'Second Chances', 12, 9, 6, {
    floor: 'wood', floorC: ['#b89a74', '#a78a66'], wallC: '#3f8f6a', trimC: '#ffffff',
    furn: [
      F('books', 1, 2, 3, 1),
      F('rack', 5, 4, 4, 1, { use: 'rails' }),
      F('counter', 8, 2, 3, 1, { c: '#3f8f6a', use: 'till' }),
      F('till', 9, 2, 1, 1),
      F('sign', 1, 0, 6, 1, { label: 'ALL PROCEEDS TO A GOOD CAUSE', c: '#ffffff' }),
      F('shelf', 1, 6, 3, 1, { c: '#b07cc6', use: 'rails' }),
      F('armchair', 10, 6),
    ],
    uses: [
      { id: 'till', label: 'Till (Margaret)', emoji: '🧥', at: [9.5, 3.55], face: 'up', rest: true, actions: ['coat', 'paperback', 'donate', 'pricing'] },
      { id: 'rails', label: 'The rails', emoji: '🔎', at: [7, 5.6], face: 'up', actions: ['rummage'] },
    ],
    staff: [{ name: 'Margaret', role: 'Volunteer', gender: 'female', at: [10.5, 3.4], face: 'down', look: { outfit: 'knit', outfitColor: '#b07cc6', hair: 'curly', hairColor: '#9aa0a6', accessory: 'glasses' }, bio: 'Volunteer since 1998. Prices everything at £2.50 except the thing you want, which is £15.' }],
    hang: [[3, 4], [4.5, 7.6], [10.5, 7.2], [6.5, 7]],
  }),
  library: shopShell('library', 'Peckwell Library', 15, 10, 7, {
    floor: 'carpet', floorC: ['#556c8a', '#4d6380'], wallC: '#a9785a', trimC: '#28334a', mood: 'warm',
    furn: [
      F('books', 1, 2, 4, 1, { use: 'books' }), F('books', 10, 2, 4, 1, { use: 'books' }),
      F('desk', 6, 3, 3, 1, { c: '#8a6a4a', use: 'desk' }),
      F('pcs', 1, 5, 4, 1, { use: 'pcs' }),
      F('stool', 1, 6), F('stool', 3, 6),
      F('armchair', 11, 6, 1, 1, { use: 'radiator' }), F('armchair', 13, 6, 1, 1, { use: 'radiator' }),
      F('radiator', 12, 5, 1, 1, { use: 'radiator' }),
      F('rug', 10, 7, 4, 2, { c: '#c0392b' }),
      F('sign', 6, 0, 3, 1, { label: 'SHHH', c: '#f0e6d2' }),
      F('table', 6, 7, 3, 1), F('chair', 5, 7), F('chair', 9, 7),
    ],
    uses: [
      { id: 'desk', label: 'Front desk', emoji: '📚', at: [7.5, 4.6], face: 'up', rest: true, actions: ['course', 'cv', 'rhymetime', 'wifisteps'] },
      { id: 'pcs', label: 'Computers (free Wi-Fi)', emoji: '💻', at: [2.5, 6.6], face: 'up', actions: ['wifi'] },
      { id: 'books', label: 'Bookshelves', emoji: '📖', at: [3, 3.6], face: 'up', actions: ['read'] },
      { id: 'radiator', label: 'Warm Space (radiator)', emoji: '♨️', at: [12.5, 7.6], face: 'up', actions: ['warmspace'] },
    ],
    staff: [{ name: 'Ade', role: 'Librarian', gender: 'male', at: [7.5, 2.55], face: 'down', look: { outfit: 'knit', outfitColor: '#28334a', hair: 'short', accessory: 'glasses' }, bio: 'Librarian. Can find any book, any form and any lost child. Shushes with love.' }],
    hang: [[1.5, 6.7], [3.5, 6.7], [11.5, 6.7], [13.5, 6.7], [5.5, 7.6], [9.5, 7.6], [6, 8.6]],
  }),
  gym: shopShell('gym', 'PureGrind 24/7', 13, 9, 6, {
    floor: 'concrete', floorC: ['#3a3d44', '#33363c'], wallC: '#2b2d33', trimC: '#ff6a00', mood: 'cool',
    furn: [
      F('counter', 1, 3, 3, 1, { c: '#ff6a00', use: 'reception' }),
      F('mirror', 5, 0, 7, 1, { use: 'mirror' }),
      F('treadmill', 5, 2, 1, 2, { use: 'weights' }), F('treadmill', 7, 2, 1, 2, { use: 'weights' }),
      F('weights', 9, 2, 3, 1, { use: 'weights' }),
      F('door', 11, 5, 1, 1, { label: 'SAUNA', use: 'sauna' }),
      F('door', 11, 7, 1, 1, { label: 'SHOWERS', use: 'showers' }),
      F('bench', 6, 6, 3, 1, { c: '#555' }),
      F('watercooler', 1, 7),
    ],
    uses: [
      { id: 'reception', label: 'Reception (Chad)', emoji: '💳', at: [2.5, 4.6], face: 'up', rest: true, actions: ['joingym', 'cancelgym'] },
      { id: 'weights', label: 'Weights', emoji: '🏋️', at: [10, 3.6], face: 'up', actions: ['workout'] },
      { id: 'mirror', label: 'The mirror', emoji: '🤳', at: [6.5, 4.6], face: 'up', actions: ['selfie'] },
      { id: 'sauna', label: 'Sauna', emoji: '🧖', at: [10.5, 5.5], face: 'right', actions: ['sauna'] },
      { id: 'showers', label: 'Showers', emoji: '🚿', at: [10.5, 7.5], face: 'right', actions: ['gymshower'] },
    ],
    staff: [{ name: 'Chad', role: 'Personal trainer', gender: 'male', at: [2.5, 2.55], face: 'down', look: { outfit: 'tracksuit', outfitColor: '#ff6a00', hair: 'fade', beard: 'stubble' }, bio: 'Personal trainer. Calls everyone “champ”. Has never once skipped leg day, and will tell you.' }],
    hang: [[6, 6.9], [8, 6.9], [4, 5.5], [8.5, 4.5], [2.5, 7.4]],
  }),
  synergy: shopShell('synergy', 'Synergy House', 14, 9, 7, {
    floor: 'carpet', floorC: ['#8c99a6', '#84909c'], wallC: '#e6ebef', trimC: '#2d6cdf', mood: 'cool',
    furn: [
      F('counter', 5, 3, 4, 1, { c: '#2d6cdf', use: 'reception' }),
      F('sign', 5, 0, 4, 1, { label: 'SYNERGY · DISRUPT · LUNCH', c: '#2d6cdf' }),
      F('pcs', 1, 5, 3, 1), F('pcs', 10, 5, 3, 1),
      F('chair', 1, 6), F('chair', 2, 6), F('chair', 11, 6), F('chair', 12, 6),
      F('table', 10, 2, 3, 1, { c: '#ddd', use: 'meeting' }),
      F('door', 1, 2, 1, 1, { label: 'LOOS', use: 'loos' }),
      F('plant', 3, 2), F('watercooler', 12, 7),
    ],
    uses: [
      { id: 'reception', label: 'Reception (Kayleigh)', emoji: '📎', at: [7, 4.6], face: 'up', rest: true, special: 'shift' },
      { id: 'meeting', label: 'Meeting room biscuits', emoji: '🍪', at: [11.5, 3.6], face: 'up', actions: ['biscuits'] },
      { id: 'loos', label: 'The posh loos', emoji: '🚽', at: [1.5, 3.6], face: 'up', actions: ['poshloo'] },
    ],
    staff: [{ name: 'Kayleigh', role: 'Receptionist', gender: 'female', at: [7, 2.55], face: 'down', look: { outfit: 'suit', outfitColor: '#2d6cdf', hair: 'ponytail', hairColor: '#d9b44a' }, bio: 'Receptionist. Has a lanyard for every occasion. Knows where the good biscuits are hidden.' }],
    hang: [[1.5, 6.6], [2.5, 6.6], [11.5, 6.6], [12.5, 6.6], [6.5, 6.5], [8.5, 7]],
  }),
  fleecems: shopShell('fleecems', 'Fleecems Lettings', 11, 8, 5, {
    floor: 'wood', floorC: ['#8a7a6a', '#7d6e60'], wallC: '#3b3b46', trimC: '#7a1fa2',
    furn: [
      F('board', 1, 0, 4, 1, { label: 'TO LET · TO LET', c: '#7a1fa2' }),
      F('desk', 5, 3, 3, 1, { c: '#ddd', use: 'desk' }),
      F('chair', 6, 4),
      F('sofa', 1, 5, 3, 1, { c: '#7a1fa2' }),
      F('plant', 9, 2), F('window', 7, 0, 3, 1),
    ],
    uses: [{ id: 'desk', label: 'Lettings desk', emoji: '🔑', at: [6.5, 4.7], face: 'up', rest: true, actions: ['deposit', 'viewing'], special: 'homes' }],
    staff: [{ name: 'Jess', role: 'Trainee negotiator', gender: 'female', at: [6.5, 2.55], face: 'down', look: { outfit: 'suit', outfitColor: '#7a1fa2', hair: 'long', hairColor: '#4a2f1f' }, bio: 'Trainee negotiator. Has been told to say “deceptively spacious” and is very sorry about it.' }],
    hang: [[1.5, 6], [2.5, 6], [3.5, 6], [8.5, 5.5]],
  }),
};

// three Tube/Overground stations share a layout
function station(id: string, title: string, colour: string): Interior {
  return shopShell(id, title, 14, 9, 7, {
    floor: 'tile', floorC: ['#e4e1d8', '#d6d2c6'], wallC: '#f2efe6', trimC: colour, mood: 'bright',
    furn: [
      F('map', 1, 0, 4, 1, { use: 'machines' }),
      F('ticketmachine', 1, 2, 1, 1, { use: 'machines' }), F('ticketmachine', 2, 2, 1, 1, { use: 'machines' }),
      F('sign', 5, 0, 4, 1, { label: 'MIND THE GAP', c: colour }),
      F('escalator', 10, 2, 3, 2, { use: 'barriers' }),
      F('barrier', 6, 4, 2, 1, { use: 'barriers' }), F('barrier', 9, 4, 4, 1, { use: 'barriers' }),
      F('bench', 1, 6, 3, 1, { c: '#7c8a93' }),
      F('bin', 12, 7),
    ],
    uses: [
      { id: 'machines', label: 'Ticket machines', emoji: '🎫', at: [2, 3.6], face: 'up', special: 'travel', rest: true },
      { id: 'barriers', label: 'Barriers (to the trains)', emoji: '🚇', at: [8.5, 5.6], face: 'up', special: 'travel' },
    ],
    staff: [{ name: 'Gordon', role: 'Station staff', gender: 'male', at: [8.5, 3.5], face: 'down', look: { outfit: 'hivis', hair: 'short', hairColor: '#4a2f1f' }, bio: 'Station staff. Announces delays like a poet. Knows which carriage stops by the exit.' }],
    hang: [[1.5, 6.9], [3.5, 6.9], [5, 6.5], [11, 6.5], [9.5, 7.5]],
  });
}
INTERIORS.broadway = station('broadway', 'Peckwell Broadway', '#1d3f9a');
INTERIORS.albion = station('albion', 'Albion Road Overground', '#e8732a');
INTERIORS.common = station('common', 'Peckwell Common', '#1d3f9a');

/** Your own home. Furniture depends on which place you live in (and what you own). */
function homeInterior(b: Building, home: HomeId, s: SaveState | null): Interior {
  const items = s?.owned.items ?? [];
  const V = {
    sofa: { title: 'Dave’s flat', floor: 'carpet' as const, fc: ['#8a7d6b', '#80745f'] as [string, string], wall: '#c7b79a', trim: '#5d4a44' },
    flatshare: { title: 'Your box room (Grimewood Court)', floor: 'wood' as const, fc: ['#9b7b58', '#8c6e4e'] as [string, string], wall: '#b9c4a8', trim: '#1f3b2c' },
    studio: { title: 'Your studio (Victoria Terrace)', floor: 'wood' as const, fc: ['#b48a5e', '#a67f55'] as [string, string], wall: '#e3dccb', trim: '#20304a' },
    onebed: { title: 'Your one-bed (The Vantage)', floor: 'tile' as const, fc: ['#e9e7e2', '#dcd9d2'] as [string, string], wall: '#f4f4f2', trim: '#d6b25e' },
  }[home];
  const furn: Furn[] = [
    F('kitchen', 1, 2, 4, 1, { use: 'kitchen' }),
    F('fridge', 5, 2, 1, 1, { use: 'kitchen' }),
    F('window', 7, 0, 2, 1, { use: 'window' }),
    F('shower', 10, 2, 1, 1, { use: 'bathroom' }),
    F('meter', 1, 4, 1, 1, { use: 'meter' }),
    F('radiator', 6, 2, 1, 1, { use: 'meter' }),
    F('mould', 9, 0, 1, 1, { use: 'mould' }),
    home === 'sofa' ? F('sofa', 6, 5, 3, 1, { c: '#6b8e5a', use: 'bed' }) : F('bed', 7, 4, 2, 2, { c: home === 'onebed' ? '#d6b25e' : '#4a6fa5', use: 'bed' }),
    F('tv', home === 'sofa' ? 6 : 10, home === 'sofa' ? 7 : 5, 2, 1),
    F('rug', 3, 5, 3, 2, { c: home === 'onebed' ? '#d6b25e' : '#a84d4d' }),
    F('desk', 1, 7, 2, 1, { c: '#8a6a4a', use: 'desk' }),
  ];
  if (home === 'sofa') furn.push(F('cat', 8, 5, 1, 1));
  if (items.includes('peloton')) furn.push(F('bike', 10, 6, 1, 1, { use: 'bike' }));
  return {
    id: b.id, title: V.title, w: 12, h: 9, exit: 5, floor: V.floor, floorC: V.fc, wallC: V.wall, trimC: V.trim, mood: 'warm', furn,
    uses: [
      { id: 'bed', label: home === 'sofa' ? 'The sofa' : 'Bed', emoji: '🛏️', at: [home === 'sofa' ? 7.5 : 6.5, home === 'sofa' ? 6.6 : 5.2], face: home === 'sofa' ? 'up' : 'right', actions: ['sleep', 'nap', 'doomscroll'] },
      { id: 'kitchen', label: 'Kitchen', emoji: '🍳', at: [3, 3.6], face: 'up', rest: true, actions: ['beans', 'cuppa', 'stew', 'airfry'] },
      { id: 'bathroom', label: 'Shower', emoji: '🚿', at: [10.5, 3.6], face: 'up', actions: ['shower', 'blowdry'] },
      { id: 'window', label: 'Window', emoji: '🪟', at: [8, 3.4], face: 'up', actions: ['window'] },
      { id: 'meter', label: 'Meter & heating', emoji: '🔌', at: [2, 4.6], face: 'left', actions: ['checkmeter', 'heating'] },
      { id: 'mould', label: 'The damp patch', emoji: '🍄', at: [9.5, 3.4], face: 'up', actions: ['bleach', 'damptext'] },
      { id: 'desk', label: 'Laptop', emoji: '💻', at: [2, 6.6], face: 'down', actions: ['flogit'] },
      { id: 'bike', label: 'Exercise bike', emoji: '🚴', at: [10.5, 7.5], face: 'up', actions: ['spin'] },
    ],
    staff: home === 'sofa' ? [{ name: 'Dave', role: 'Your mate (owns the sofa)', gender: 'male', at: [4.5, 6.2], face: 'down', look: { outfit: 'tracksuit', outfitColor: '#3a7bd5', hair: 'short', beard: 'stubble' }, bio: 'Your mate. Owner of the sofa. Owner of the cat (disputed). Never asks for rent, always asks for milk.' }] : [],
    hang: [[4, 5.5], [5, 6.5], [3, 6.8]],
  };
}

// ------------------------------------------------------------------ lookup
/** The interior you'd walk into through this building's door (null: menu only, e.g. someone else's house). */
export function interiorFor(b: Building, s: SaveState | null): Interior | null {
  if (b.kind === 'spot') return null;
  if (b.kind === 'home') return s && b.homeId === s.home ? homeInterior(b, s.home, s) : null;
  return INTERIORS[b.id] ?? null;
}
/** For tests/tools: every interior including all four home variants. */
export function allInteriors(): Interior[] {
  const homes = (['sofa', 'flatshare', 'studio', 'onebed'] as HomeId[]).map((h) => {
    const b = { kestrel: 'kestrel', sofa: 'kestrel', flatshare: 'grimewood', studio: 'victoria', onebed: 'vantage' }[h];
    return homeInterior(buildingById(b)!, h, null);
  });
  return [...Object.values(INTERIORS), ...homes];
}

/** The collision grid of a room (walls + solid furniture; the exit gap is open). */
export function gridOf(r: Interior): Grid {
  const solid = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) if (y < 2 || x === 0 || x === r.w - 1 || (y === r.h - 1 && x !== r.exit)) solid[y * r.w + x] = 1;
  for (const f of r.furn) {
    if (!isSolidFurn(f)) continue;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (x >= 0 && y >= 0 && x < r.w && y < r.h) solid[y * r.w + x] = 1;
  }
  return { w: r.w, h: r.h, solid: (x, y) => x < 0 || y < 0 || x >= r.w || y >= r.h || solid[y * r.w + x] === 1 };
}
export const spawnOf = (r: Interior) => ({ x: r.exit + 0.5, y: r.h - 1.55 });
/** Walking into the door gap takes you back outside. */
export const atExit = (r: Interior, x: number, y: number) => y > r.h - 0.95 && Math.floor(x) === r.exit;

/** Which spot does this tap (in room tiles) mean? Furniture first, then spots' own stand points. */
export function useAt(r: Interior, x: number, y: number): UseSpot | null {
  for (let i = r.furn.length - 1; i >= 0; i--) {
    const f = r.furn[i];
    if (!f.use) continue;
    // tall things (shelves, fridges, machines) can also be tapped on their upper part
    const top = f.y - (TALL.includes(f.k) ? 1.2 : 0.4);
    if (x >= f.x && x < f.x + f.w && y >= top && y < f.y + f.h) return r.uses.find((u) => u.id === f.use) ?? null;
  }
  return null;
}
const TALL: FurnKind[] = ['shelf', 'fridge', 'books', 'ticketmachine', 'quizmachine', 'washer', 'dryer', 'door', 'escalator', 'kitchen', 'shower', 'weights', 'treadmill'];

/** Which action ids each spot offers (the "rest" spot also gets anything unclaimed). */
export function actionsAt(r: Interior, u: UseSpot, placeId: string, kind: string): string[] {
  const here = actionsFor(placeId, kind).map((a) => a.id);
  const claimed = new Set(r.uses.filter((x) => x !== u).flatMap((x) => x.actions ?? []));
  const mine = (u.actions ?? []).filter((id) => here.includes(id));
  if (u.rest) for (const id of here) if (!claimed.has(id) && !mine.includes(id)) mine.push(id);
  return mine;
}
export const knownActionIds = () => new Set(ACTIONS.map((a) => a.id));

// ------------------------------------------------------------------ drawing
const TILE = 32;
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
type C = CanvasRenderingContext2D;
const rr = (ctx: C, x: number, y: number, w: number, h: number, r: number, c: string) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};
const box = (ctx: C, x: number, y: number, w: number, h: number, rise: number, c: string, top?: string) => {
  // a 3/4-view block: top face then front face, `rise` px tall
  rr(ctx, x, y - rise, w, h, 3, top ?? shade(c, 28));
  ctx.fillStyle = c;
  ctx.fillRect(x, y + h - rise - 2, w, rise + 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x, y + h - 3, w, 3);
};

/** Flat, never-changing parts of the room: floor, walls, wall-mounted things, rugs. */
export function prerenderInterior(r: Interior, scale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = r.w * TILE * scale;
  c.height = r.h * TILE * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawRoomStatic(ctx, r);
  return c;
}
export const WALL_MOUNTED: FurnKind[] = ['sign', 'window', 'board', 'mirror', 'screens', 'map', 'mould'];

export function drawRoomStatic(ctx: C, r: Interior) {
  const W = r.w * TILE;
  const H = r.h * TILE;
  // floor
  const [a, b] = r.floorC;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, W, H);
  for (let y = 2; y < r.h - 1; y++)
    for (let x = 1; x < r.w - 1; x++) {
      const px = x * TILE;
      const py = y * TILE;
      if (r.floor === 'check') {
        if ((x + y) % 2) {
          ctx.fillStyle = b;
          ctx.fillRect(px, py, TILE, TILE);
        }
      } else if (r.floor === 'wood') {
        ctx.fillStyle = (y * 3 + Math.floor((x + (y % 2) * 0.5) / 2)) % 2 ? b : a;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(px, py + 15, TILE, 1);
        ctx.fillRect(px + ((x + y) % 2 ? 0 : 16), py, 1, 15);
        ctx.fillRect(px + ((x + y) % 2 ? 16 : 0), py + 16, 1, 16);
      } else if (r.floor === 'tile') {
        ctx.fillStyle = (x + y) % 2 ? b : a;
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      } else if (r.floor === 'carpet') {
        ctx.fillStyle = b;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(px + 8 + (i % 2) * 16, py + 8 + Math.floor(i / 2) * 16, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (r.floor === 'concrete') {
        if ((x * 7 + y * 13) % 5 === 0) {
          ctx.fillStyle = b;
          ctx.fillRect(px + 6, py + 9, 9, 5);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.fillRect(px, py, TILE, 1);
      } else {
        // lino speckle
        ctx.fillStyle = b;
        for (let i = 0; i < 3; i++) ctx.fillRect(px + ((x * 11 + i * 9) % 28), py + ((y * 7 + i * 13) % 28), 2, 2);
      }
    }
  // back wall (2 tiles tall) with a skirting board
  const wall = ctx.createLinearGradient(0, 0, 0, 2 * TILE);
  wall.addColorStop(0, shade(r.wallC, -18));
  wall.addColorStop(1, r.wallC);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, 2 * TILE);
  ctx.fillStyle = r.trimC;
  ctx.fillRect(0, 2 * TILE - 6, W, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 2 * TILE, W, 4);
  // side walls
  ctx.fillStyle = shade(r.wallC, -40);
  ctx.fillRect(0, 0, TILE * 0.55, H);
  ctx.fillRect(W - TILE * 0.55, 0, TILE * 0.55, H);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(TILE * 0.55, 2 * TILE, 5, H);
  ctx.fillRect(W - TILE * 0.55 - 5, 2 * TILE, 5, H);
  // front wall with the door gap
  const fy = (r.h - 1) * TILE + 10;
  ctx.fillStyle = shade(r.wallC, -50);
  ctx.fillRect(0, fy, W, H - fy);
  ctx.fillStyle = r.trimC;
  ctx.fillRect(0, fy, W, 4);
  // doormat + door gap
  ctx.fillStyle = a;
  ctx.fillRect(r.exit * TILE, fy, TILE, H - fy);
  rr(ctx, r.exit * TILE + 2, (r.h - 1) * TILE - 6, TILE - 4, 18, 3, '#6b4f2a');
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '700 6px Rubik, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WELCOME', r.exit * TILE + 16, (r.h - 1) * TILE + 5);
  // rugs + wall-mounted bits
  for (const f of r.furn) if (f.k === 'rug' || WALL_MOUNTED.includes(f.k)) drawFurn(ctx, f, 0);
}

/** Draw one piece of furniture (live, so it y-sorts with people). */
export function drawFurn(ctx: C, f: Furn, t: number) {
  const x = f.x * TILE;
  const y = f.y * TILE;
  const w = f.w * TILE;
  const h = f.h * TILE;
  const c = f.c ?? '#8a6a4a';
  ctx.textAlign = 'center';
  switch (f.k) {
    case 'rug':
      rr(ctx, x + 2, y + 2, w - 4, h - 4, 6, c);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 4);
      ctx.stroke();
      break;
    case 'sign':
    case 'board': {
      const sy = f.k === 'board' ? 10 : 14;
      rr(ctx, x + 3, sy, w - 6, f.k === 'board' ? 38 : 20, 4, f.k === 'board' ? '#f4f1e8' : 'rgba(0,0,0,0.35)');
      if (f.k === 'board') {
        ctx.fillStyle = c;
        ctx.fillRect(x + 3, sy, w - 6, 10);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        for (let i = 0; i < Math.max(2, f.w * 2); i++) ctx.fillRect(x + 8 + i * 14, sy + 16 + (i % 2) * 8, 10, 6);
      }
      ctx.fillStyle = f.k === 'board' ? '#ffffff' : c;
      ctx.font = `800 ${f.k === 'board' ? 7 : 8}px Rubik, system-ui, sans-serif`;
      ctx.fillText(f.label ?? '', x + w / 2, sy + (f.k === 'board' ? 8 : 13.5), w - 10);
      break;
    }
    case 'window': {
      rr(ctx, x + 4, 8, w - 8, 40, 3, '#f4f4f4');
      const g = ctx.createLinearGradient(0, 11, 0, 45);
      g.addColorStop(0, '#9fd3f0');
      g.addColorStop(1, '#d8f0fb');
      rr(ctx, x + 7, 11, w - 14, 34, 2, g as unknown as string);
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(x + w / 2 - 1.5, 11, 3, 34);
      ctx.fillRect(x + 7, 27, w - 14, 2.5);
      break;
    }
    case 'mirror':
      rr(ctx, x + 4, 8, w - 8, 44, 4, '#c9ced4');
      rr(ctx, x + 7, 11, w - 14, 38, 3, '#e9f1f6');
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < f.w; i++) ctx.fillRect(x + 14 + i * 32, 14, 3, 30);
      break;
    case 'screens':
      for (let i = 0; i < f.w; i += 2) {
        rr(ctx, x + i * TILE + 4, 6, 2 * TILE - 8, 36, 3, '#111');
        rr(ctx, x + i * TILE + 7, 9, 2 * TILE - 14, 30, 2, i % 4 ? '#1f7a3d' : '#2b5fa8');
        ctx.fillStyle = '#ffd23f';
        ctx.font = '700 6px Rubik, system-ui, sans-serif';
        ctx.fillText(i % 4 ? 'KEMPTON-ISH 3:40' : 'ROMFORD DOGS', x + i * TILE + TILE, 20);
        ctx.fillStyle = '#fff';
        for (let k = 0; k < 4; k++) ctx.fillRect(x + i * TILE + 12 + ((k * 13 + i * 7) % 30), 26 + k * 3, 6, 2);
      }
      break;
    case 'map':
      rr(ctx, x + 4, 8, w - 8, 40, 3, '#ffffff');
      ctx.lineWidth = 2.5;
      for (const [col, oy] of [['#b36305', 18], ['#e8732a', 28], ['#222', 38]] as const) {
        ctx.strokeStyle = col;
        ctx.beginPath();
        ctx.moveTo(x + 10, 8 + oy - 6);
        ctx.lineTo(x + w / 2, 8 + oy - 6);
        ctx.lineTo(x + w - 10, 8 + oy - 12);
        ctx.stroke();
      }
      break;
    case 'mould': {
      ctx.fillStyle = 'rgba(40,55,35,0.35)';
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(x + 8 + ((i * 11) % 18), 34 + ((i * 7) % 16), 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'counter':
    case 'bar':
    case 'case': {
      const top = f.k === 'bar' ? '#8a5a32' : f.k === 'case' ? '#e8eef2' : '#efe6d6';
      box(ctx, x, y, w, h, 16, c, top);
      if (f.k === 'case') {
        // glass with pastries
        rr(ctx, x + 3, y - 14, w - 6, 13, 2, 'rgba(200,230,245,0.7)');
        for (let i = 0; i < f.w * 3; i++) {
          ctx.fillStyle = i % 3 === 0 ? '#c98a3e' : i % 3 === 1 ? '#e0a95a' : '#f2d27a';
          ctx.beginPath();
          ctx.ellipse(x + 8 + i * 10, y - 6, 4, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (f.k === 'bar') {
        ctx.fillStyle = 'rgba(255,220,150,0.25)';
        ctx.fillRect(x, y + h - 14, w, 2);
      }
      break;
    }
    case 'till':
      rr(ctx, x + 8, y - 24, 16, 10, 2, '#2b2b2b');
      rr(ctx, x + 10, y - 23, 12, 5, 1, '#7fd3ff');
      break;
    case 'taps':
      for (let i = 0; i < f.w * 2; i++) {
        rr(ctx, x + 6 + i * 14, y - 32, 4, 16, 2, '#d9d9d9');
        rr(ctx, x + 4 + i * 14, y - 34, 8, 6, 2, ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db'][i % 4]);
      }
      break;
    case 'coffee':
      rr(ctx, x + 4, y - 30, 24, 16, 3, '#3a3a3a');
      rr(ctx, x + 7, y - 27, 18, 5, 1, '#c0c0c0');
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 12 + Math.sin(t * 3) * 1.5, y - 38, 2, 7);
      break;
    case 'table':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h - 3, w / 2 - 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      rr(ctx, x + w / 2 - 2, y + h / 2 - 4, 4, h / 2, 1, '#3a3a3a');
      rr(ctx, x + 3, y - 4, w - 6, h - 6, 5, f.c ?? '#a0744a');
      rr(ctx, x + 3, y + h - 12, w - 6, 3, 1, 'rgba(0,0,0,0.25)');
      break;
    case 'chair':
    case 'stool':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 26, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      if (f.k === 'chair') rr(ctx, x + 8, y + 2, 16, 8, 3, shade(f.c ?? '#6b4a2b', -10));
      rr(ctx, x + 14, y + 16, 4, 10, 1, '#333');
      rr(ctx, x + 8, y + 10, 16, 8, 4, f.c ?? (f.k === 'stool' ? '#c0392b' : '#6b4a2b'));
      break;
    case 'shelf':
    case 'books': {
      box(ctx, x, y, w, h, 40, f.k === 'books' ? '#6b4a2b' : '#8a7a68', f.k === 'books' ? '#7d5a38' : '#a89884');
      const rows = 3;
      for (let rI = 0; rI < rows; rI++) {
        const ry = y - 36 + rI * 12;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 3, ry + 9, w - 6, 2);
        for (let i = 0; i < f.w * 5; i++) {
          const ix = x + 4 + i * 6;
          if (ix > x + w - 8) break;
          ctx.fillStyle = f.k === 'books' ? ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#ecf0f1'][(i + rI * 2) % 6] : i % 3 === 0 ? shade(c, 20) : i % 3 === 1 ? c : shade(c, -25);
          if (f.k === 'books') ctx.fillRect(ix, ry + 1 + ((i * 3) % 3), 4, 8 - ((i * 3) % 3));
          else {
            ctx.beginPath();
            ctx.ellipse(ix + 2, ry + 6, 3, 3, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }
    case 'fridge':
      box(ctx, x, y, w, h, 42, '#d9dee3', '#eef1f4');
      for (let i = 0; i < f.w; i++) {
        rr(ctx, x + i * TILE + 3, y - 38, TILE - 6, 36, 3, 'rgba(160,215,240,0.75)');
        for (let k = 0; k < 3; k++)
          for (let j = 0; j < 4; j++) {
            ctx.fillStyle = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#ecf0f1'][(i + j + k) % 5];
            ctx.fillRect(x + i * TILE + 6 + j * 6, y - 34 + k * 11, 4, 8);
          }
      }
      break;
    case 'sofa':
    case 'armchair': {
      const sc = f.c ?? '#7a4a3a';
      rr(ctx, x + 2, y - 10, w - 4, 14, 6, shade(sc, -15));
      rr(ctx, x + 2, y, w - 4, h - 4, 6, sc);
      rr(ctx, x, y - 4, 7, h, 4, shade(sc, -25));
      rr(ctx, x + w - 7, y - 4, 7, h, 4, shade(sc, -25));
      if (f.k === 'sofa') {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 1; i < f.w; i++) ctx.fillRect(x + i * TILE, y + 2, 1.5, h - 10);
      }
      break;
    }
    case 'bed':
      rr(ctx, x + 2, y - 8, w - 4, h + 4, 5, '#6b4a2b');
      rr(ctx, x + 4, y - 4, w - 8, h - 4, 4, '#f4f4f4');
      rr(ctx, x + 6, y - 2, w - 12, 12, 5, '#ffffff');
      rr(ctx, x + 4, y + 12, w - 8, h - 20, 4, f.c ?? '#4a6fa5');
      break;
    case 'tv':
      rr(ctx, x + 4, y - 16, w - 8, 10, 2, '#5a4a3a');
      rr(ctx, x + 6, y - 40, w - 12, 26, 3, '#111');
      rr(ctx, x + 8, y - 38, w - 16, 22, 2, `hsl(${(t * 40) % 360},45%,${42 + Math.sin(t * 7) * 6}%)`);
      break;
    case 'kitchen':
      box(ctx, x, y, w, h, 22, '#d4cfc4', '#efebe4');
      ctx.fillStyle = '#2b2b2b';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(x + 12 + i * 12, y - 14, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      rr(ctx, x + w - 30, y - 18, 22, 10, 3, '#b9c4cc');
      rr(ctx, x + w / 2 - 6, y - 26, 10, 10, 3, '#e74c3c');
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 1; i < f.w; i++) ctx.fillRect(x + i * TILE, y + h - 20, 1, 18);
      break;
    case 'shower':
      box(ctx, x, y, w, h, 46, '#dfe9ee', '#f2f7fa');
      rr(ctx, x + 4, y - 42, w - 8, 40, 3, 'rgba(160,210,235,0.55)');
      ctx.fillStyle = '#9aa0a6';
      ctx.fillRect(x + w / 2 - 1, y - 44, 2, 8);
      break;
    case 'washer':
    case 'dryer':
      for (let i = 0; i < f.w; i++) {
        const mx = x + i * TILE;
        box(ctx, mx + 1, y, TILE - 2, h, 26, f.k === 'washer' ? '#eef1f4' : '#d6dce2', '#ffffff');
        ctx.fillStyle = '#5b6770';
        ctx.beginPath();
        ctx.arc(mx + 16, y - 6, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = f.k === 'washer' ? '#7fb8d6' : '#c9a27a';
        ctx.beginPath();
        ctx.arc(mx + 16, y - 6, 7, 0, Math.PI * 2);
        ctx.fill();
        if ((i + (f.k === 'dryer' ? 1 : 0)) % 2 === 0) {
          // spinning
          ctx.strokeStyle = 'rgba(255,255,255,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(mx + 16, y - 6, 4, t * 6 + i, t * 6 + i + 2.2);
          ctx.stroke();
        }
      }
      break;
    case 'pool':
      rr(ctx, x + 2, y - 4, w - 4, h, 6, '#5a3a22');
      rr(ctx, x + 7, y + 1, w - 14, h - 10, 3, '#2e8b57');
      for (const [bx, by, bc] of [[0.3, 0.3, '#fff'], [0.6, 0.5, '#e74c3c'], [0.65, 0.35, '#f1c40f'], [0.7, 0.6, '#111']] as const) {
        ctx.fillStyle = bc;
        ctx.beginPath();
        ctx.arc(x + 7 + (w - 14) * bx, y + 1 + (h - 10) * by, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'fire': {
      box(ctx, x, y, w, h, 34, '#7a6a5a', '#9a8a7a');
      rr(ctx, x + 10, y - 22, w - 20, 22, 4, '#1b1b1b');
      const fl = Math.sin(t * 9) * 2;
      ctx.fillStyle = '#ff8a1f';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y - 8, 9, 9 + fl, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y - 5, 5, 6 - fl * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'desk':
      box(ctx, x, y, w, h, 14, f.c ?? '#8a6a4a');
      rr(ctx, x + 6, y - 30, 18, 14, 2, '#222');
      rr(ctx, x + 8, y - 28, 14, 10, 1, '#7fd3ff');
      break;
    case 'pcs':
      if (f.solid !== false) box(ctx, x, y, w, h, 12, '#9a9a9a');
      for (let i = 0; i < f.w; i++) {
        rr(ctx, x + i * TILE + 6, y - 28, 20, 15, 2, '#222');
        rr(ctx, x + i * TILE + 8, y - 26, 16, 11, 1, i % 2 ? '#7fd3ff' : '#a8e6a1');
      }
      break;
    case 'plant':
      rr(ctx, x + 10, y + 8, 12, 14, 3, '#b5651d');
      ctx.fillStyle = '#2e8b57';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x + 16 + Math.cos(i * 1.3) * 6, y + 2 - i * 3, 6, 4, i, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'barberchair':
      rr(ctx, x + 6, y - 14, 20, 12, 4, '#1b1b1b');
      rr(ctx, x + 4, y - 4, 24, 14, 4, '#c0392b');
      rr(ctx, x + 14, y + 10, 4, 10, 1, '#c0c0c0');
      // the pole
      rr(ctx, x + 28, y - 34, 5, 26, 2, '#ffffff');
      ctx.fillStyle = '#e23b3b';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 28, y - 34 + ((i * 7 + t * 12) % 26), 5, 3);
      break;
    case 'treadmill':
      rr(ctx, x + 4, y, w - 8, h - 4, 3, '#222');
      rr(ctx, x + 7, y + 4, w - 14, h - 12, 2, '#3d3d3d');
      rr(ctx, x + 4, y - 16, w - 8, 10, 2, '#555');
      break;
    case 'weights':
      box(ctx, x, y, w, h, 30, '#444', '#555');
      for (let i = 0; i < f.w * 2; i++) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(x + 10 + i * 16, y - 16, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'ticketmachine':
      box(ctx, x + 2, y, w - 4, h, 40, '#2b4f9a', '#3d63b3');
      rr(ctx, x + 7, y - 34, w - 14, 14, 2, '#7fd3ff');
      rr(ctx, x + 9, y - 16, w - 18, 4, 1, '#111');
      break;
    case 'quizmachine':
      box(ctx, x + 2, y, w - 4, h, 40, f.c ?? '#6c3483', '#884ea0');
      rr(ctx, x + 6, y - 36, w - 12, 16, 2, `hsl(${(t * 90) % 360},70%,60%)`);
      break;
    case 'barrier':
      for (let i = 0; i < f.w; i++) {
        rr(ctx, x + i * TILE + 2, y - 6, 8, h, 2, '#9aa0a6');
        rr(ctx, x + i * TILE + 22, y - 6, 8, h, 2, '#9aa0a6');
        rr(ctx, x + i * TILE + 10, y + 4, 12, 4, 2, i % 2 ? '#e74c3c' : '#2ecc71');
      }
      break;
    case 'escalator':
      rr(ctx, x, y - 10, w, h + 6, 4, '#6b6f73');
      ctx.fillStyle = '#3d4044';
      for (let i = 0; i < 9; i++) ctx.fillRect(x + 6, y - 6 + ((i * 7 + t * 14) % (h + 2)), w - 12, 2);
      break;
    case 'radiator':
      box(ctx, x + 2, y, w - 4, h, 18, '#e8e8e8', '#f6f6f6');
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 7 + i * 4, y - 12, 1.5, 18);
      break;
    case 'bench':
      rr(ctx, x + 2, y + 2, w - 4, 10, 3, f.c ?? '#7b5a3a');
      for (let i = 0; i < f.w; i++) rr(ctx, x + i * TILE + 6, y + 12, 4, 10, 1, '#333');
      break;
    case 'rack':
      rr(ctx, x + 2, y - 30, w - 4, 3, 1, '#888');
      for (let i = 0; i < f.w * 4; i++) rr(ctx, x + 4 + i * 8, y - 28, 6, 28, 2, ['#c0392b', '#2980b9', '#f1c40f', '#8e44ad', '#16a085'][i % 5]);
      break;
    case 'dog': {
      const wag = Math.sin(t * 8) * 3;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 24, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c98a3e';
      ctx.beginPath();
      ctx.ellipse(x + 15, y + 17, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 26, y + 13, 5, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a5a2b';
      ctx.beginPath();
      ctx.ellipse(x + 28, y + 9, 2.5, 3.5, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c98a3e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 5, y + 16);
      ctx.lineTo(x + 0, y + 11 + wag);
      ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.fillRect(x + 28, y + 12, 1.6, 1.6);
      break;
    }
    case 'cat':
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.ellipse(x + 16, y + 14, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 24, y + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 21, y + 7);
      ctx.lineTo(x + 22, y + 3);
      ctx.lineTo(x + 24, y + 6);
      ctx.moveTo(x + 25, y + 6);
      ctx.lineTo(x + 27, y + 3);
      ctx.lineTo(x + 28, y + 8);
      ctx.fill();
      break;
    case 'bike':
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x + 9, y + 18, 6, 0, Math.PI * 2);
      ctx.arc(x + 25, y + 18, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#d42020';
      ctx.beginPath();
      ctx.moveTo(x + 9, y + 18);
      ctx.lineTo(x + 16, y + 8);
      ctx.lineTo(x + 25, y + 18);
      ctx.stroke();
      break;
    case 'door':
      rr(ctx, x + 4, y - 40, w - 8, 44, 3, shade(c, -20));
      rr(ctx, x + 7, y - 37, w - 14, 38, 2, '#c9b28a');
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x + w - 11, y - 16, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (f.label) {
        rr(ctx, x + 6, y - 32, w - 12, 9, 2, '#1b1b1b');
        ctx.fillStyle = '#fff';
        ctx.font = '700 5.5px Rubik, system-ui, sans-serif';
        ctx.fillText(f.label, x + w / 2, y - 25.5, w - 12);
      }
      break;
    case 'meter':
      rr(ctx, x + 6, y - 30, 20, 22, 2, '#c8c3b8');
      rr(ctx, x + 9, y - 27, 14, 7, 1, '#2b2b2b');
      ctx.fillStyle = '#7fff7f';
      ctx.font = '700 5px monospace';
      ctx.fillText('£', x + 16, y - 21.5);
      break;
    case 'bin':
      rr(ctx, x + 9, y + 4, 14, 18, 3, '#4b5560');
      rr(ctx, x + 7, y + 2, 18, 4, 2, '#333c45');
      break;
    case 'watercooler':
      rr(ctx, x + 9, y - 6, 14, 26, 3, '#e8e8e8');
      rr(ctx, x + 10, y - 22, 12, 16, 5, 'rgba(120,190,240,0.75)');
      break;
  }
}
