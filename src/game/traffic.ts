// Road rules for Peckwell. Pedestrians keep to the pavement, cross at zebras or at the junction, and
// look for a gap first; drivers ease off for anyone in the road and stop for people waiting at a zebra.
// Everything here is pure data + maths so it can be unit-tested without a canvas.
import { T, W, tiles } from './world';
import type { Vehicle } from './render';

export interface Road {
  y0: number; // first lane row
  y1: number; // one past the last lane row
  lanes: { y: number; dir: 1 | -1 }[];
}
/** Albion Road (north) and the High Street. They drive on the left: eastbound in the top lane. */
export const ROADS: Road[] = [
  { y0: 10, y1: 12, lanes: [{ y: 10.5, dir: 1 }, { y: 11.5, dir: -1 }] },
  { y0: 20, y1: 22, lanes: [{ y: 20.5, dir: 1 }, { y: 21.5, dir: -1 }] },
];
export interface Zebra {
  x0: number;
  x1: number; // exclusive
  road: number;
}
export const ZEBRAS: Zebra[] = [
  { x0: 10, x1: 12, road: 1 },
  { x0: 30, x1: 32, road: 1 },
  { x0: 29, x1: 31, road: 0 },
];
/** The cross street (Station Approach) has no through traffic; the junction mouths line up with the main roads' pavements. */
const CROSS_X0 = 23;
const CROSS_X1 = 25;
const CROSS_KERB_ROWS = new Set([9, 12, 18, 19, 22, 23, 28]);

export const roadAt = (y: number) => {
  for (let i = 0; i < ROADS.length; i++) if (y >= ROADS[i].y0 && y < ROADS[i].y1) return i;
  return -1;
};
export const zebraAt = (x: number, road: number) => ZEBRAS.findIndex((z) => z.road === road && x >= z.x0 - 0.15 && x < z.x1 + 0.15);

// ---------------------------------------------------------------- path costs
export type CostMode = 'plain' | 'ped' | 'player';
const pedCost = new Float32Array(tiles.length);
const playerCost = new Float32Array(tiles.length);
(function build() {
  for (let i = 0; i < tiles.length; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    const t = tiles[i];
    const r = roadAt(y + 0.5);
    let ped = t === T.Grass ? 2 : t === T.Soil ? 3 : 1;
    let pl = 1;
    if (r >= 0) {
      pl = zebraAt(x + 0.5, r) >= 0 ? 1 : 2.2;
      ped = zebraAt(x + 0.5, r) >= 0 ? 1.5 : x === CROSS_X0 - 1 || x === CROSS_X1 ? 3 : 30;
    } else if (x >= CROSS_X0 && x < CROSS_X1 && y >= 3) {
      ped = CROSS_KERB_ROWS.has(y) ? 1.2 : 8;
    }
    pedCost[i] = ped;
    playerCost[i] = pl;
  }
})();
export function tileCost(mode: CostMode, x: number, y: number) {
  if (mode === 'plain') return 1;
  const i = y * W + x;
  return mode === 'ped' ? pedCost[i] : playerCost[i];
}

// ---------------------------------------------------------------- vehicles
export interface Car extends Vehicle {
  cur: number;
}
export const vehHalf = (k: Vehicle['kind']) => (k === 'bus' ? 1.7 : k === 'van' ? 0.95 : 0.75);
export const vehHalfW = (k: Vehicle['kind']) => (k === 'bus' ? 0.43 : 0.36);
export const PERSON_R = 0.28;
export interface Person {
  x: number;
  y: number;
}

/** Does a person-sized circle at (x,y) touch vehicle v's body (plus a little margin)? */
export function hitsVehicle(v: Vehicle, x: number, y: number, pad = 0) {
  const h = vehHalf(v.kind) + pad;
  const hw = vehHalfW(v.kind) + pad;
  const cx = Math.max(v.x - h, Math.min(v.x + h, x));
  const cy = Math.max(v.y - hw, Math.min(v.y + hw, y));
  return Math.hypot(x - cx, y - cy) < PERSON_R;
}
export const hitsAnyVehicle = (vs: Vehicle[], x: number, y: number, pad = 0) => vs.some((v) => hitsVehicle(v, x, y, pad));

const ACCEL = 3;
const BRAKE = 12;
const COMFORT = 7;

/**
 * Move the traffic on. `people` is everyone on foot (player, NPCs, other players), `zebraDemand[i]`
 * says someone's on or waiting at zebra i. Drivers pick a speed they can stop from in the space ahead,
 * and never move into anyone.
 */
export function stepVehicles(vs: Car[], people: Person[], zebraDemand: boolean[], dt: number) {
  for (const v of vs) {
    const half = vehHalf(v.kind);
    const hw = vehHalfW(v.kind);
    let space = Infinity;
    for (const o of vs) {
      if (o === v || Math.abs(o.y - v.y) > 0.2) continue;
      const ahead = (o.x - v.x) * v.dir;
      if (ahead > 0) space = Math.min(space, ahead - half - vehHalf(o.kind) - 0.7);
    }
    for (const p of people) {
      if (Math.abs(p.y - v.y) > hw + PERSON_R + 0.1) continue;
      const ahead = (p.x - v.x) * v.dir;
      if (ahead < -half) continue; // already behind the front bumper's sweep
      space = Math.min(space, ahead - half - PERSON_R - 0.9);
    }
    const road = roadAt(v.y);
    ZEBRAS.forEach((z, i) => {
      if (z.road !== road || !zebraDemand[i]) return;
      const edge = v.dir > 0 ? z.x0 : z.x1;
      const ahead = (edge - v.x) * v.dir - half;
      if (ahead > -0.2) space = Math.min(space, ahead - 0.45);
    });
    const target = Math.min(v.speed, space <= 0 ? 0 : Math.sqrt(2 * COMFORT * space));
    v.cur = target > v.cur ? Math.min(target, v.cur + ACCEL * dt) : Math.max(target, v.cur - BRAKE * dt);
    const nx = v.x + v.dir * v.cur * dt;
    const moved = { ...v, x: nx };
    if (people.some((p) => hitsVehicle(moved, p.x, p.y, 0.05))) {
      v.cur = 0; // never drive into someone, whatever the maths said
      continue;
    }
    v.x = nx;
    if ((v.dir > 0 && v.x > W + 4) || (v.dir < 0 && v.x < -4)) {
      let entry = v.dir > 0 ? -4 : W + 4;
      for (let guard = 0; guard < 20; guard++) {
        const clash = vs.some((o) => o !== v && Math.abs(o.y - v.y) < 0.2 && Math.abs(o.x - entry) < half + vehHalf(o.kind) + 0.8);
        if (!clash) break;
        entry -= v.dir * 1.5;
      }
      v.x = entry;
    }
  }
}

// ---------------------------------------------------------------- crossing decisions
/**
 * Is it safe to step off the kerb into `road`, walking from x0 to x1 at `speed`?
 * A car is fine if it has already passed, or it's stopped a decent way off, or it's far enough away
 * that we'll be across (with a second to spare) before it gets here.
 */
export function gapClear(vs: Car[], road: number, x0: number, x1: number, speed: number, laneDist = 2.2) {
  const r = ROADS[road];
  const xa = Math.min(x0, x1) - 0.5;
  const xb = Math.max(x0, x1) + 0.5;
  const crossTime = Math.hypot(x1 - x0, laneDist) / Math.max(0.5, speed);
  for (const v of vs) {
    if (v.y < r.y0 || v.y >= r.y1) continue;
    const half = vehHalf(v.kind);
    const passed = v.dir > 0 ? v.x - half > xb : v.x + half < xa;
    if (passed) continue;
    const d = v.dir > 0 ? xa - (v.x + half) : v.x - half - xb;
    if (d < 0.3) return false;
    if (v.cur < 0.25 && d >= 0.6) continue;
    if (d / Math.max(0.1, v.cur) < crossTime + 1) return false;
  }
  return true;
}
