// The fictional London neighbourhood of Peckwell. Any resemblance to real
// high streets is entirely because every high street looks like this.
export const TILE = 32;
export const W = 60;
export const H = 46;

export enum T {
  Grass = 0,
  Pave = 1,
  Road = 2,
  Building = 3,
  Water = 4,
  Tree = 5,
  Path = 6,
  Rail = 7,
  Plaza = 8,
  Fence = 9,
  Hedge = 10,
  Soil = 11,
  Solid = 12, // invisible-ish blockers (billboard legs, bandstand)
}

export type BuildingKind =
  | 'tube'
  | 'bakery'
  | 'cornershop'
  | 'lettings'
  | 'cafe'
  | 'jobcentre'
  | 'pub'
  | 'chicken'
  | 'office'
  | 'busgarage'
  | 'barber'
  | 'home'
  | 'bookies'
  | 'gym'
  | 'spot'
  | 'decor';

export interface Building {
  id: string;
  name: string;
  sign: string;
  kind: BuildingKind;
  x: number;
  y: number;
  w: number;
  h: number;
  door: number; // column offset from x
  face?: 'S' | 'N'; // which side the shopfront/door is on (default south)
  facade: string;
  roof: string;
  signBg: string;
  signFg: string;
  awning?: string;
  blurb: string;
  tube?: string; // station id for tube buildings
  homeId?: 'sofa' | 'flatshare' | 'studio' | 'onebed';
  /** spots only: emoji marker floating above them */
  emoji?: string;
}

export interface Billboard {
  id: string;
  name: string;
  x: number; // tile units (can be fractional)
  y: number;
  w: number;
  h: number;
  price: number;
  footfall: string;
  blurb: string;
}

const B = (b: Building) => b;

export const buildings: Building[] = [
  // ---- Albion Road (residential, north) ----
  B({ id: 'kestrel', name: "Dave's sofa · Kestrel House", sign: 'KESTREL HOUSE', kind: 'home', homeId: 'sofa', x: 1, y: 3, w: 8, h: 6, door: 4, facade: '#9a6b52', roof: '#5d4a44', signBg: '#2b2b2b', signFg: '#f2f2f2', blurb: "Your mate Dave's flat. The sofa has a dent shaped like you. The cat does not respect boundaries." }),
  B({ id: 'grimewood', name: 'Grimewood Court', sign: 'GRIMEWOOD COURT', kind: 'home', homeId: 'flatshare', x: 10, y: 3, w: 9, h: 6, door: 4, facade: '#b0855f', roof: '#4c4f5a', signBg: '#1f3b2c', signFg: '#e9f5e1', blurb: 'Six bedrooms, one bathroom, one mysterious smell. Nigel the landlord "lives locally" (Marbella).' }),
  B({ id: 'albion', name: 'Albion Road Overground', sign: 'ALBION ROAD', kind: 'tube', tube: 'albion', x: 26, y: 4, w: 6, h: 5, door: 3, facade: '#e9e2d0', roof: '#e8732a', signBg: '#e8732a', signFg: '#ffffff', blurb: 'Overground. Arrives "every 4 minutes" (philosophically).' }),
  B({ id: 'victoria', name: 'Victoria Terrace', sign: 'VICTORIA TERRACE', kind: 'home', homeId: 'studio', x: 33, y: 3, w: 8, h: 6, door: 4, facade: '#c9c0ad', roof: '#3f4652', signBg: '#20304a', signFg: '#ffffff', blurb: 'Converted Victorian studios. The bed folds into the wall. So does your will to live, slightly.' }),
  B({ id: 'vantage', name: 'The Vantage', sign: 'THE VANTAGE', kind: 'home', homeId: 'onebed', x: 42, y: 3, w: 9, h: 6, door: 4, facade: '#7fa3b8', roof: '#2e3f4f', signBg: '#111111', signFg: '#d6b25e', blurb: 'Luxury one-beds with a concierge called Marcus and a gym nobody uses.' }),
  B({ id: 'synergy', name: 'Synergy House', sign: 'SYNERGY HOUSE', kind: 'office', x: 52, y: 3, w: 7, h: 6, door: 3, facade: '#8c99a6', roof: '#47525e', signBg: '#2d6cdf', signFg: '#ffffff', blurb: "Open-plan office. Somebody's microwaving fish. Temps report to reception." }),

  // ---- Peckwell High Street, north side ----
  B({ id: 'broadway', name: 'Peckwell Broadway', sign: 'PECKWELL BROADWAY', kind: 'tube', tube: 'broadway', x: 1, y: 13, w: 6, h: 5, door: 3, facade: '#a8382f', roof: '#3a3a3a', signBg: '#ffffff', signFg: '#1d3f9a', blurb: 'Underground station. Mind the gap. Mind the man eating a whole rotisserie chicken.' }),
  B({ id: 'crumbs', name: 'Crumbs & Co.', sign: 'CRUMBS & CO.', kind: 'bakery', x: 7, y: 13, w: 5, h: 5, door: 2, facade: '#26498c', roof: '#5a5a62', signBg: '#26498c', signFg: '#ffd23f', awning: '#ffd23f', blurb: 'The nation\u2019s favourite sausage roll dealer. Queue goes out the door at 8:05am.' }),
  B({ id: 'kwik', name: 'Kwik Mart Food & Wine', sign: 'KWIK MART · FOOD & WINE', kind: 'cornershop', x: 12, y: 13, w: 5, h: 5, door: 2, facade: '#2f8f4e', roof: '#55585e', signBg: '#d92b2b', signFg: '#ffffff', awning: '#2f8f4e', blurb: 'Open till late. Sells everything: milk, phone chargers, single onions, lottery dreams.' }),
  B({ id: 'fleecems', name: 'Fleecems Lettings', sign: 'FLEECEMS LETTINGS', kind: 'lettings', x: 17, y: 13, w: 4, h: 5, door: 2, facade: '#3b3b46', roof: '#5f5f66', signBg: '#7a1fa2', signFg: '#ffffff', blurb: 'Estate agents. Every flat is "deceptively spacious". Every agent is called Josh.' }),
  B({ id: 'pret', name: 'Prêt-à-Pricey', sign: 'PRÊT-À-PRICEY', kind: 'cafe', x: 27, y: 13, w: 6, h: 5, door: 3, facade: '#7b1730', roof: '#4b4b52', signBg: '#7b1730', signFg: '#f6e7c1', awning: '#7b1730', blurb: 'Artisanal everything. £6.95 for a sandwich that has seen an avocado once.' }),
  B({ id: 'jobcentre', name: 'Jobcentre Minus', sign: 'JOBCENTRE MINUS', kind: 'jobcentre', x: 33, y: 13, w: 7, h: 5, door: 3, facade: '#d5d2c8', roof: '#6a6a70', signBg: '#00786f', signFg: '#ffffff', blurb: 'Take a ticket. Your number is 412. They are serving number 9.' }),
  B({ id: 'pub', name: 'The Leaky Brolly', sign: 'THE LEAKY BROLLY', kind: 'pub', x: 40, y: 13, w: 7, h: 5, door: 3, facade: '#1e3a2b', roof: '#4a3b33', signBg: '#1e3a2b', signFg: '#e4c46a', blurb: 'Proper boozer. Sticky carpet, pub quiz Tuesdays, a dog called Clive.' }),
  B({ id: 'bookies', name: 'LadBroke Bookmakers', sign: 'LADBROKE · BETS', kind: 'bookies', x: 47, y: 13, w: 5, h: 5, door: 2, facade: '#123b2a', roof: '#504a5a', signBg: '#0f7a3d', signFg: '#ffffff', blurb: 'Used to be a vape shop. Before that, a bookies. Before that, a different bookies. “When the fun stops, stop.” (It stopped in 2004.)' }),
  B({ id: 'pawn', name: 'Pawnderful', sign: 'PAWNDERFUL · CASH 4 GOLD', kind: 'decor', x: 52, y: 13, w: 7, h: 5, door: 3, facade: '#e2b33b', roof: '#5b5555', signBg: '#111111', signFg: '#ffd23f', blurb: 'Cash for gold, phones, and that bread maker you used once. Sign says "Back in 5 mins" (since 2019).' }),

  // ---- Peckwell High Street, south side ----
  B({ id: 'pfc', face: 'N', name: 'PFC · Peckwell Fried Chicken', sign: 'PFC FRIED CHICKEN', kind: 'chicken', x: 1, y: 24, w: 6, h: 5, door: 3, facade: '#c9221f', roof: '#55555c', signBg: '#c9221f', signFg: '#ffe066', awning: '#ffe066', blurb: 'Two wings and chips for less than a bus fare. Also the delivery rider HQ.' }),
  B({ id: 'laundry', face: 'N', name: 'Spin City Launderette', sign: 'SPIN CITY LAUNDERETTE', kind: 'decor', x: 7, y: 24, w: 5, h: 5, door: 2, facade: '#4aa3c7', roof: '#5a5d63', signBg: '#ffffff', signFg: '#1b6d8f', blurb: 'One machine works. Nobody knows which one. A man has been folding the same towel since 2011.' }),
  B({ id: 'garage', face: 'N', name: 'Peckwell Bus Garage', sign: 'PECKWELL BUS GARAGE', kind: 'busgarage', x: 12, y: 24, w: 9, h: 5, door: 4, facade: '#8b2222', roof: '#3c3f44', signBg: '#d42020', signFg: '#ffffff', blurb: 'Home of the 436 night bus. Drivers wanted. Must tolerate people asking "does this go to Peckwell?" on a bus that says PECKWELL.' }),
  B({ id: 'barber', face: 'N', name: 'Fade to Grey Barbers', sign: 'FADE TO GREY', kind: 'barber', x: 27, y: 24, w: 5, h: 5, door: 2, facade: '#20232a', roof: '#4e4e55', signBg: '#20232a', signFg: '#ffffff', awning: '#e23b3b', blurb: 'Skin fades, beard trims, and strong opinions about football. New look: £12.' }),
  B({ id: 'charity', face: 'N', name: 'Second Chances (charity shop)', sign: 'SECOND CHANCES', kind: 'decor', x: 32, y: 24, w: 5, h: 5, door: 2, facade: '#3f8f6a', roof: '#57575d', signBg: '#ffffff', signFg: '#3f8f6a', blurb: 'Seventeen copies of The Da Vinci Code and a wedding dress, £8.' }),
  B({ id: 'library', face: 'N', name: 'Peckwell Library', sign: 'PECKWELL LIBRARY', kind: 'decor', x: 38, y: 24, w: 8, h: 5, door: 4, facade: '#a9785a', roof: '#4a4140', signBg: '#28334a', signFg: '#f0e6d2', blurb: 'Open Mondays, Thursdays and alternate Saturdays during a full moon. Free Wi-Fi though.' }),

  // ---- South-west: Inkerman Terrace & Peckwell Common station ----
  B({ id: 'terrace1', name: 'Inkerman Terrace', sign: '', kind: 'decor', x: 1, y: 31, w: 5, h: 5, door: 2, facade: '#b5654a', roof: '#4f4545', signBg: '#000', signFg: '#fff', blurb: 'Victorian terrace. Worth £1.2m. Bathroom from 1974.' }),
  B({ id: 'terrace2', name: 'Inkerman Terrace', sign: '', kind: 'decor', x: 6, y: 31, w: 5, h: 5, door: 2, facade: '#c27a55', roof: '#4f4545', signBg: '#000', signFg: '#fff', blurb: 'There is a Bugaboo pram in the hallway and a passive-aggressive note about bins.' }),
  B({ id: 'terrace3', name: 'Inkerman Terrace', sign: '', kind: 'decor', x: 11, y: 31, w: 5, h: 5, door: 2, facade: '#a85a45', roof: '#4f4545', signBg: '#000', signFg: '#fff', blurb: 'Loft conversion in progress since the last general election.' }),
  B({ id: 'gym', name: 'PureGrind 24/7 Gym', sign: 'PUREGRIND 24/7', kind: 'gym', x: 16, y: 31, w: 5, h: 5, door: 2, facade: '#2b2d33', roof: '#4f4545', signBg: '#ff6a00', signFg: '#111111', blurb: 'Converted end-of-terrace. Open 24/7. The squat rack has been occupied by the same man since January.' }),
  B({ id: 'common', name: 'Peckwell Common', sign: 'PECKWELL COMMON', kind: 'tube', tube: 'common', x: 14, y: 38, w: 7, h: 4, door: 3, facade: '#a8382f', roof: '#3a3a3a', signBg: '#ffffff', signFg: '#1d3f9a', blurb: 'Underground station by the park. The escalator has been "under repair" for a generation.' }),
];

/** Things you can use that aren't buildings: park bits and the bus stop. Not drawn by the prerender. */
const spot = (id: string, name: string, x: number, y: number, emoji: string, blurb: string): Building => ({ id, name, sign: '', kind: 'spot', x, y, w: 0, h: 0, door: 0, facade: '#000', roof: '#000', signBg: '#000', signFg: '#fff', blurb, emoji });
export const spots: Building[] = [
  spot('pond', 'The Duck Pond', 42.5, 33.25, '🦆', 'Ducks, a trolley, and a swan with a criminal record. A sign says “Please don’t feed the ducks bread”. Everyone does.'),
  spot('bandstand', 'The Bandstand', 54, 39.7, '🎸', 'Victorian bandstand. Currently hosting a man called Tez and his acoustic guitar.'),
  spot('allotments', 'Peckwell Allotments', 6.5, 37.35, '🥕', 'Waiting list: 14 years. Marrows the size of toddlers. Nan is in charge, unofficially.'),
  spot('busstop', '436 Bus Stop', 46.2, 19.3, '🚌', 'Route 436. Every 8 minutes, or three at once after 40 minutes. Sometimes both.'),
];
export const places: Building[] = [];

export const billboards: Billboard[] = [
  { id: 'bb-bridge', name: 'Railway Bridge Banner', x: 21.6, y: 0.1, w: 4.8, h: 1.7, price: 99, footfall: '~40,000 delayed commuters / week', blurb: 'Hung off the railway bridge. Every train that stops "due to a signal failure" stares right at you.' },
  { id: 'bb-crumbs', name: 'Broadway Rooftop', x: 7.5, y: 12.2, w: 4, h: 1.9, price: 49, footfall: '~9,000 sausage-roll queuers / week', blurb: 'Above the bakery queue. Peak dwell time 8:00\u20139:00am.' },
  { id: 'bb-jobcentre', name: 'Jobcentre Minus Rooftop', x: 34, y: 12.2, w: 5, h: 1.9, price: 39, footfall: '~6,000 people waiting a very long time / week', blurb: 'Captive audience. Perfect for recruiters, courses and ambitious side-hustles.' },
  { id: 'bb-pub', name: 'Leaky Brolly Gable', x: 41.5, y: 12.2, w: 4, h: 1.9, price: 59, footfall: '~7,500 pint-holders / week', blurb: 'Visible from the beer garden and the smoking area, which is the same place.' },
  { id: 'bb-garage', name: 'Bus Garage Mega-Panel', x: 13, y: 26, w: 7, h: 1.9, price: 79, footfall: '~12,000 bus passengers / week', blurb: 'Every bus in Peckwell drives past it. Twice. Slowly.' },
  { id: 'bb-park', name: 'Common Gate 48-Sheet', x: 49.5, y: 25.2, w: 5, h: 2.2, price: 69, footfall: '~10,000 dog walkers & joggers / week', blurb: 'Freestanding at the park gate. Rain-proof, unlike everyone walking past it.' },
];

export interface Station {
  id: string;
  name: string;
  line: string;
  color: string;
}
export const stations: Station[] = [
  { id: 'broadway', name: 'Peckwell Broadway', line: 'Bakerloo-ish line', color: '#b36305' },
  { id: 'albion', name: 'Albion Road', line: 'Overground', color: '#e8732a' },
  { id: 'common', name: 'Peckwell Common', line: 'Northern-ish line', color: '#222222' },
];
export const TUBE_FARE = 2.8;

export const tiles = new Uint8Array(W * H);
export const idx = (x: number, y: number) => y * W + x;

function fill(x0: number, y0: number, x1: number, y1: number, t: T) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < W && y < H) tiles[idx(x, y)] = t;
}

export const trees: { x: number; y: number; r: number }[] = [];
export const lamps: { x: number; y: number }[] = [];
export const benches: { x: number; y: number }[] = [];
export const pond = { x: 39, y: 34, w: 8, h: 5 };
export const bandstand = { x: 52, y: 35, w: 4, h: 4 };

(function build() {
  fill(0, 0, W - 1, H - 1, T.Grass);
  fill(0, 0, W - 1, 1, T.Rail);
  fill(0, 2, W - 1, 2, T.Fence);
  // Albion Road
  fill(0, 9, W - 1, 9, T.Pave);
  fill(0, 10, W - 1, 11, T.Road);
  fill(0, 12, W - 1, 12, T.Pave);
  // High Street
  fill(0, 18, W - 1, 19, T.Pave);
  fill(0, 20, W - 1, 21, T.Road);
  fill(0, 22, W - 1, 23, T.Pave);
  fill(0, 29, W - 1, 29, T.Pave);
  // Cross street (Station Approach) runs north-south
  fill(22, 3, 22, H - 1, T.Pave);
  fill(25, 3, 25, H - 1, T.Pave);
  fill(23, 3, 24, H - 1, T.Road);
  // the main roads run straight through the junctions
  fill(22, 10, 25, 11, T.Road);
  fill(22, 20, 25, 21, T.Road);
  fill(21, 13, 21, 17, T.Pave);
  fill(26, 13, 26, 17, T.Pave);
  fill(21, 24, 21, 28, T.Pave);
  fill(26, 24, 26, 28, T.Pave);
  // Plaza by the park gate
  fill(46, 24, W - 1, 28, T.Plaza);
  fill(37, 24, 37, 28, T.Pave);
  // Inkerman Terrace pavement + station forecourt
  fill(0, 36, 21, 37, T.Pave);
  fill(0, 42, 21, 43, T.Pave);
  fill(13, 38, 13, 41, T.Pave);
  // Allotments
  fill(1, 38, 11, 40, T.Soil);
  // Park: hedge with gates, then paths
  fill(26, 30, W - 1, 30, T.Hedge);
  fill(32, 30, 33, 30, T.Path);
  fill(48, 30, 55, 30, T.Path);
  fill(26, 32, W - 1, 32, T.Path);
  fill(32, 31, 33, H - 1, T.Path);
  fill(48, 31, 49, H - 1, T.Path);
  fill(34, 40, 58, 41, T.Path);
  for (let y = pond.y; y < pond.y + pond.h; y++)
    for (let x = pond.x; x < pond.x + pond.w; x++) {
      const dx = (x + 0.5 - (pond.x + pond.w / 2)) / (pond.w / 2);
      const dy = (y + 0.5 - (pond.y + pond.h / 2)) / (pond.h / 2);
      if (dx * dx + dy * dy <= 1.05) tiles[idx(x, y)] = T.Water;
    }
  fill(bandstand.x, bandstand.y, bandstand.x + bandstand.w - 1, bandstand.y + bandstand.h - 1, T.Solid);
  // Buildings
  for (const b of buildings) fill(b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, T.Building);
  // Billboard legs at the park gate
  tiles[idx(50, 27)] = T.Solid;
  tiles[idx(53, 27)] = T.Solid;

  // Trees (solid)
  const addTree = (x: number, y: number, r = 0.75) => {
    if (tiles[idx(x, y)] === T.Grass) {
      tiles[idx(x, y)] = T.Tree;
      trees.push({ x: x + 0.5, y: y + 0.5, r });
    }
  };
  [0, 9, 19, 20, 21, 32, 41, 51, 59].forEach((x) => addTree(x, 5));
  [9, 32, 41, 51].forEach((x) => addTree(x, 7, 0.65));
  const parkTrees = [
    [28, 31], [30, 34], [28, 37], [30, 41], [27, 43], [36, 31], [41, 31], [45, 31], [58, 31],
    [30, 44], [41, 45], [54, 44], [58, 45], [36, 36], [36, 38], [51, 33], [56, 34], [58, 37], [57, 42], [52, 42], [44, 42], [39, 43], [29, 39], [46, 37],
  ];
  parkTrees.forEach(([x, y]) => addTree(x, y, 0.8 + ((x * 7 + y) % 3) * 0.1));
  [0, 21].forEach((x) => addTree(x, 30, 0.6));
  [12].forEach((x) => addTree(x, 40, 0.7));
  [2, 7, 11, 17, 21].forEach((x) => addTree(x, 45, 0.7));

  for (let x = 3; x < W; x += 7) {
    if (x < 22 || x > 25) {
      lamps.push({ x: x + 0.5, y: 19.8 });
      lamps.push({ x: x + 3.5, y: 22.8 });
    }
  }
  [4, 16, 30, 45, 56].forEach((x) => lamps.push({ x: x + 0.5, y: 9.3 }));
  [[33.5, 35], [48.5, 36], [33.5, 42]].forEach(([x, y]) => lamps.push({ x, y }));
  benches.push({ x: 35, y: 33 }, { x: 44, y: 33 }, { x: 50, y: 39 }, { x: 37, y: 41.5 }, { x: 47, y: 26.6 }, { x: 56, y: 26.6 });
})();

export const isSolid = (tx: number, ty: number) => {
  if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
  const t = tiles[idx(tx, ty)];
  return t === T.Building || t === T.Water || t === T.Tree || t === T.Rail || t === T.Fence || t === T.Hedge || t === T.Solid;
};

/** Pavement point in front of a building's door, in tile units. */
export const doorFront = (b: Building) => (b.kind === 'spot' ? { x: b.x, y: b.y } : { x: b.x + b.door + 0.5, y: b.face === 'N' ? b.y - 0.55 : b.y + b.h + 0.55 });

export const PARK = { x0: 26, y0: 31, x1: W, y1: H };
export const inPark = (x: number, y: number) => x >= PARK.x0 && x < PARK.x1 && y >= PARK.y0 && y < PARK.y1;

export const SPAWN = doorFront(buildings[0]);

places.push(...buildings, ...spots);
export const buildingById = (id: string) => places.find((b) => b.id === id)!;

/** Doors you could plausibly deliver chicken to. */
export const deliveryDoors: { name: string; x: number; y: number }[] = [
  ...buildings.filter((b) => b.kind === 'home' || b.id.startsWith('terrace') || b.kind === 'office').map((b) => ({ name: b.name.replace("Dave's sofa · ", ''), ...doorFront(b) })),
  { name: 'Bandstand (a man called Tez)', x: 54, y: 39.6 },
  { name: 'Park bench by the pond', x: 44, y: 33.4 },
  { name: 'The library steps', ...doorFront(buildingById('library')) },
];

export const NPC_SPOTS = [
  ...buildings.filter((b) => b.kind !== 'home').map(doorFront),
  ...spots.map(doorFront),
  { x: 34, y: 33 }, { x: 46, y: 41 }, { x: 52, y: 27 }, { x: 40, y: 22.6 }, { x: 10, y: 22.6 }, { x: 30, y: 19 }, { x: 5, y: 36.5 },
];
