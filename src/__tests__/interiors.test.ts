import { describe, expect, it } from 'vitest';
import { allInteriors, actionsAt, gridOf, interiorFor, spawnOf, atExit, useAt, INTERIORS } from '../game/interiors';
import { findPath } from '../game/pathfind';
import { actionsFor } from '../game/actions';
import { buildingById, buildings } from '../game/world';
import { newSave } from '../game/economy';
import { avatarForName } from '../game/avatar';

describe('interiors', () => {
  const rooms = allInteriors();
  it('every main building except decor terraces has a room', () => {
    for (const b of buildings) {
      if (b.kind === 'home' || b.id.startsWith('terrace')) continue;
      expect(INTERIORS[b.id], b.id).toBeTruthy();
    }
  });
  for (const r of rooms) {
    describe(r.id + ' / ' + r.title, () => {
      const g = gridOf(r);
      const sp = spawnOf(r);
      it('spawn is open, exit is reachable and leads out', () => {
        expect(g.solid(Math.floor(sp.x), Math.floor(sp.y))).toBe(false);
        expect(g.solid(r.exit, r.h - 1)).toBe(false);
        expect(atExit(r, r.exit + 0.5, r.h - 0.5)).toBe(true);
        expect(atExit(r, sp.x, sp.y)).toBe(false);
      });
      it('every use spot is reachable from the door', () => {
        for (const u of r.uses) {
          const [x, y] = u.at;
          expect(g.solid(Math.floor(x), Math.floor(y)), `${u.id} stand point solid`).toBe(false);
          const p = findPath(sp.x, sp.y, x, y, 'plain', g);
          expect(p, `${r.id}:${u.id} unreachable`).not.toBeNull();
        }
      });
      it('staff stand on floor, hang spots are reachable', () => {
        for (const s of r.staff) expect(g.solid(Math.floor(s.at[0]), Math.floor(s.at[1])), s.name).toBe(false);
        for (const [x, y] of r.hang) {
          expect(g.solid(Math.floor(x), Math.floor(y)), `${r.id} hang ${x},${y}`).toBe(false);
          expect(findPath(sp.x, sp.y, x, y, 'plain', g), `${r.id} hang ${x},${y}`).not.toBeNull();
        }
      });
      it('furniture "use" ids exist and tapping them finds the spot', () => {
        for (const f of r.furn) if (f.use) {
          expect(r.uses.some((u) => u.id === f.use), `${r.id} furn use ${f.use}`).toBe(true);
          expect(useAt(r, f.x + f.w / 2, f.y + f.h / 2)?.id).toBe(f.use);
        }
      });
    });
  }
  it('every action of every place is reachable at some spot', () => {
    for (const r of Object.values(INTERIORS)) {
      const b = buildingById(r.id);
      const all = actionsFor(b.id, b.kind).map((a) => a.id);
      const got = new Set(r.uses.flatMap((u) => actionsAt(r, u, b.id, b.kind)));
      for (const id of all) expect(got.has(id), `${r.id}: ${id}`).toBe(true);
    }
    const s = newSave('Test', avatarForName('Test'));
    const home = buildingById('kestrel');
    const r = interiorFor(home, s)!;
    const all = actionsFor(home.id, home.kind).map((a) => a.id);
    const got = new Set(r.uses.flatMap((u) => actionsAt(r, u, home.id, home.kind)));
    for (const id of all) expect(got.has(id), `home: ${id}`).toBe(true);
  });
  it('other people’s homes and decor terraces stay menu-only', () => {
    const s = newSave('Test', avatarForName('Test'));
    expect(interiorFor(buildingById('vantage'), s)).toBeNull();
    expect(interiorFor(buildingById('terrace1'), s)).toBeNull();
    expect(interiorFor(buildingById('kestrel'), s)).not.toBeNull();
  });
});
