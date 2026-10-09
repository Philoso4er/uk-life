import { avatarForName, randomAvatar } from './avatar';
import { findPath } from './pathfind';
import { ROADS, gapClear, hitsAnyVehicle, roadAt, type Car } from './traffic';
import type { Avatar, Facing } from './types';
import { H, NPC_SPOTS, T, W, isSolid, tiles } from './world';

export const BOT_NAMES = ['Big Tel', 'Auntie Bev', 'Tomasz', 'Priya', 'Gary & dog', 'Josh (Fleecems)', 'Nan', 'Kev', 'Siobhan', 'Femi', 'Hamza', 'Posh Rupert'];

export const BOT_LINES = [
  'Is it me or has it rained every day since 2009',
  '£7.20 for a pint?? In THIS economy??',
  'Anyone know if the 436 is running or is it vibes only',
  'Just watched a fox eat a whole kebab. Respect.',
  'Crumbs & Co. out of vegan sausage rolls AGAIN',
  'My landlord put the rent up again lol. lmao even',
  'Signal failure at Albion Road. Standard.',
  'Lovely weather for ducks',
  'Who keeps putting trolleys in the pond',
  'Proper nippy out today innit',
  'Jobcentre just called number 14. I am number 412.',
  'Meal deal and a sit in the park. Living the dream.',
  'Viewing a "studio" later. It is a cupboard with a hob.',
  'Sorry. Sorry. No, sorry, my fault. Sorry.',
  'Cheers drive!',
  'Did anyone else get the council tax letter or just me',
  'PFC wings at 2am hit different',
  'Mind the gap ladies and gents',
  'The Leaky Brolly quiz tonight, who\u2019s in',
  'Can\u2019t complain. (Proceeds to complain for 20 mins)',
  'You alright? Yeah you? Yeah. Good. Good good.',
  'Fancy a cuppa? Course you do.',
];

export interface Bot {
  id: string;
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  path: { x: number; y: number }[];
  wait: number;
  speed: number;
  bubble?: { text: string; until: number };
  /** unnamed passer-by: no name tag, doesn't post or count as a regular */
  ambient?: boolean;
  /** idle pose: scrolling their phone */
  phone?: boolean;
  /** road index being crossed (-1 = on the pavement) */
  crossing: number;
  /** seconds spent waiting at the kerb for a gap */
  kerb: number;
  /** road they're waiting to cross, -1 if not waiting */
  waitRoad: number;
}

/** What a walker needs to know about the street. */
export interface StreetView {
  vehicles: Car[];
}

const freshBot = (id: string, name: string, avatar: Avatar, x: number, y: number, speed: number, ambient = false): Bot => ({
  id,
  name,
  avatar,
  x,
  y,
  facing: 'down',
  moving: false,
  path: [],
  wait: Math.random() * 3,
  speed,
  ambient,
  crossing: -1,
  kerb: 0,
  waitRoad: -1,
});

/** Named regulars. Each name always has the same face, so the feed, DMs and the street agree. */
export function makeBots(n: number, exclude: string[] = []): Bot[] {
  const ex = new Set(exclude.map((x) => x.trim().toLowerCase()));
  const names = BOT_NAMES.filter((x) => !ex.has(x.toLowerCase()))
    .sort(() => Math.random() - 0.5)
    .slice(0, n);
  return names.map((name, i) => {
    const s = NPC_SPOTS[(i * 5) % NPC_SPOTS.length];
    return freshBot('npc-' + i, name, avatarForName(name), s.x, s.y, 1.6 + Math.random() * 1.1);
  });
}

/** Unnamed passers-by who mostly just walk the high streets (and cross them). */
export function makeWalkers(n: number): Bot[] {
  return Array.from({ length: n }, (_, i) => {
    const s = pavementPoint();
    return freshBot('walker-' + i, '', randomAvatar(), s.x, s.y, 1.5 + Math.random() * 1.0, true);
  });
}

function pavementPoint() {
  for (let k = 0; k < 200; k++) {
    // bias towards the two main roads so people actually cross them
    const y = Math.random() < 0.75 ? [9, 12, 18, 19, 22, 23][Math.floor(Math.random() * 6)] : Math.floor(Math.random() * H);
    const x = 1 + Math.floor(Math.random() * (W - 2));
    const t = tiles[y * W + x];
    if ((t === T.Pave || t === T.Plaza) && roadAt(y + 0.5) < 0 && !isSolid(x, y)) return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: 5, y: 19.5 };
}

/** Distance from the kerb edge that walkers wait at. */
export const KERB = 0.35;

export function updateBot(b: Bot, dt: number, street: StreetView) {
  if (b.wait > 0) {
    b.wait -= dt;
    b.moving = false;
    return;
  }
  if (!b.path.length) {
    b.phone = false;
    const target = b.ambient && Math.random() < 0.8 ? pavementPoint() : NPC_SPOTS[Math.floor(Math.random() * NPC_SPOTS.length)];
    const p = findPath(b.x, b.y, target.x + (Math.random() - 0.5) * 0.6, target.y, 'ped');
    b.path = p ?? [];
    if (!b.path.length) b.wait = 1;
    return;
  }
  const t = b.path[0];
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, b.speed * dt);
  const nx = d > 0 ? b.x + (dx / d) * step : t.x;
  const ny = d > 0 ? b.y + (dy / d) * step : t.y;

  // ---- road crossing: stop at the kerb, look both ways, go when there's a gap
  if (b.crossing < 0) {
    const r = ROADS.findIndex((rd) => Math.min(b.y, t.y) < rd.y1 && Math.max(b.y, t.y) >= rd.y0);
    if (r >= 0) {
      const rd = ROADS[r];
      const fromNorth = b.y < rd.y0;
      const kerbLine = fromNorth ? rd.y0 - KERB : rd.y1 + KERB;
      const atKerb = fromNorth ? ny >= kerbLine : ny <= kerbLine;
      if (atKerb) {
        // where we'll come out the other side
        const far = fromNorth ? rd.y1 : rd.y0;
        const k = Math.abs(dy) > 1e-3 ? (far - b.y) / dy : 1;
        const exitX = k >= 0 && k <= 1 ? b.x + dx * k : t.x;
        if (gapClear(street.vehicles, r, b.x, exitX, b.speed, rd.y1 - rd.y0 + KERB * 2)) {
          b.crossing = r;
          b.kerb = 0;
          b.waitRoad = -1;
        } else {
          b.kerb += dt;
          b.waitRoad = r;
          b.moving = false;
          // look right, look left, look right again
          b.facing = Math.floor(b.kerb / 0.8) % 2 === 0 ? 'right' : 'left';
          if (b.kerb > 25) {
            // sod this, I'll go another way
            b.path = [];
            b.kerb = 0;
            b.waitRoad = -1;
            b.wait = 1;
          }
          return;
        }
      }
    }
  } else if (roadAt(b.y) < 0) {
    const rd = ROADS[b.crossing];
    if (b.y < rd.y0 - KERB - 0.05 || b.y > rd.y1 + KERB + 0.05) b.crossing = -1;
  }

  // ---- never walk into a vehicle
  if (hitsAnyVehicle(street.vehicles, nx, ny, 0.08) && !hitsAnyVehicle(street.vehicles, b.x, b.y, 0.08)) {
    b.moving = false;
    return;
  }

  if (d <= b.speed * dt) {
    b.x = t.x;
    b.y = t.y;
    b.path.shift();
    if (!b.path.length) {
      b.wait = b.ambient ? 0.5 + Math.random() * 3 : 2 + Math.random() * 7; // stop for a chat / to look at phone
      b.phone = Math.random() < 0.45;
    }
  } else {
    b.x = nx;
    b.y = ny;
    b.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }
  b.moving = true;
}
