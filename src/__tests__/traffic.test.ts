import { describe, expect, it } from 'vitest';
import { findPath } from '../game/pathfind';
import { ROADS, ZEBRAS, gapClear, hitsVehicle, roadAt, stepVehicles, tileCost, zebraAt, type Car } from '../game/traffic';
import { makeWalkers, updateBot, type Bot } from '../game/bots';

const car = (x: number, y: number, dir: 1 | -1, cur = 5): Car => ({ x, y, dir, kind: 'car', color: '#000', speed: 5, cur });

/** All the tiles a polyline passes through. */
function tilesOn(sx: number, sy: number, pts: { x: number; y: number }[]) {
  const out: [number, number][] = [];
  let ax = sx;
  let ay = sy;
  for (const p of pts) {
    const n = Math.ceil(Math.hypot(p.x - ax, p.y - ay) / 0.1);
    for (let i = 0; i <= n; i++) out.push([Math.floor(ax + ((p.x - ax) * i) / n), Math.floor(ay + ((p.y - ay) * i) / n)]);
    ax = p.x;
    ay = p.y;
  }
  return out;
}

describe('pedestrian routes', () => {
  it('cross the high street at a zebra or the junction, not mid-block', () => {
    for (const [sx, tx] of [[15.5, 16.5], [40.5, 41.5], [5.5, 6.5], [50.5, 52.5]]) {
      const path = findPath(sx, 18.6, tx, 23.4, 'ped')!;
      expect(path).toBeTruthy();
      for (const [x, y] of tilesOn(sx, 18.6, path)) {
        const r = roadAt(y + 0.5);
        if (r < 0) continue;
        const ok = zebraAt(x + 0.5, r) >= 0 || (x >= 22 && x <= 25);
        expect(ok, `crossed at tile ${x},${y} for ${sx}->${tx}`).toBe(true);
      }
    }
  });
  it('the player still gets a direct-ish path and can walk onto the road', () => {
    const p = findPath(15.5, 18.6, 15.5, 20.5, 'player')!;
    expect(p.length).toBeGreaterThan(0);
    expect(p[p.length - 1]).toEqual({ x: 15.5, y: 20.5 });
    expect(tileCost('player', 15, 20)).toBeGreaterThan(1);
    expect(tileCost('player', 15, 19)).toBe(1);
  });
});

describe('vehicles', () => {
  it('brake for someone standing in their lane and never touch them', () => {
    const vs = [car(5, 20.5, 1)];
    const ped = { x: 12, y: 20.5 };
    for (let i = 0; i < 300; i++) {
      stepVehicles(vs, [ped], ZEBRAS.map(() => false), 1 / 60);
      expect(hitsVehicle(vs[0], ped.x, ped.y)).toBe(false);
    }
    expect(vs[0].cur).toBe(0);
    expect(vs[0].x).toBeLessThan(12 - 0.75 - 0.28);
  });
  it('stop at a zebra when someone is waiting, and carry on otherwise', () => {
    const z = ZEBRAS[1];
    const vs = [car(z.x0 - 8, 20.5, 1)];
    const demand = ZEBRAS.map((_, i) => i === 1);
    for (let i = 0; i < 240; i++) stepVehicles(vs, [], demand, 1 / 60);
    expect(vs[0].cur).toBe(0);
    expect(vs[0].x + 0.75).toBeLessThanOrEqual(z.x0);
    for (let i = 0; i < 240; i++) stepVehicles(vs, [], ZEBRAS.map(() => false), 1 / 60);
    expect(vs[0].x).toBeGreaterThan(z.x1);
  });
  it('keep their distance from the car in front', () => {
    const vs = [car(10, 21.5, -1, 0), car(14, 21.5, -1)];
    vs[0].speed = 0;
    for (let i = 0; i < 300; i++) stepVehicles(vs, [], ZEBRAS.map(() => false), 1 / 60);
    expect(vs[1].x - vs[0].x).toBeGreaterThan(1.5);
  });
});

describe('gap checks', () => {
  it('wait for a close car, go when it has passed or is far off', () => {
    const r = 1;
    expect(gapClear([car(12, 20.5, 1)], r, 15, 15, 2)).toBe(false);
    expect(gapClear([car(17, 20.5, 1)], r, 15, 15, 2)).toBe(true); // already past
    expect(gapClear([car(-40, 20.5, 1)], r, 15, 15, 2)).toBe(true); // miles away
    expect(gapClear([car(13, 20.5, 1, 0)], r, 15, 15, 2)).toBe(true); // stopped for us
    expect(gapClear([car(20, 21.5, -1)], r, 15, 15, 2)).toBe(false); // the far lane counts too
    expect(gapClear([car(20, 10.5, 1)], r, 15, 15, 2)).toBe(true); // other road
  });
});

describe('a busy street', () => {
  it('nobody ever overlaps a vehicle, and people do get across', () => {
    const vs: Car[] = [
      car(6, 21.5, -1), car(28, 21.5, -1), car(48, 21.5, -1), car(14, 20.5, 1), car(38, 20.5, 1), car(55, 20.5, 1),
      car(30, 11.5, -1), car(10, 10.5, 1),
    ];
    const bots: Bot[] = makeWalkers(14);
    let crossings = 0;
    const was = bots.map((b) => b.y < 20);
    const dt = 1 / 30;
    for (let step = 0; step < 30 * 240; step++) {
      for (const b of bots) updateBot(b, dt, { vehicles: vs });
      const demand = ZEBRAS.map((z, i) => bots.some((b) => (b.waitRoad === z.road && zebraAt(b.x, z.road) === i) || (zebraAt(b.x, z.road) === i && roadAt(b.y) === z.road)));
      stepVehicles(vs, bots, demand, dt);
      for (const v of vs) for (const b of bots) expect(hitsVehicle(v, b.x, b.y), `step ${step}`).toBe(false);
      bots.forEach((b, i) => {
        const north = b.y < 20;
        if (north !== was[i] && roadAt(b.y) < 0) {
          crossings++;
          was[i] = north;
        }
      });
    }
    expect(crossings).toBeGreaterThan(3);
    // traffic still flows
    expect(vs.some((v) => v.cur > 1)).toBe(true);
    expect(ROADS.length).toBe(2);
  });
});
