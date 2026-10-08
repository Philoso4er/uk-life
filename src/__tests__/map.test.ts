import { describe, expect, it } from 'vitest';
import { buildings, doorFront, SPAWN, isSolid, deliveryDoors } from '../game/world';
import { findPath } from '../game/pathfind';

describe('map connectivity', () => {
  it('every door and delivery drop is reachable from the spawn point', () => {
    expect(isSolid(Math.floor(SPAWN.x), Math.floor(SPAWN.y))).toBe(false);
    for (const b of buildings) {
      const f = doorFront(b);
      expect(isSolid(Math.floor(f.x), Math.floor(f.y)), `${b.id} door front is solid`).toBe(false);
      expect(findPath(SPAWN.x, SPAWN.y, f.x, f.y), `${b.id} unreachable`).not.toBeNull();
    }
    for (const d of deliveryDoors) expect(findPath(SPAWN.x, SPAWN.y, d.x, d.y), d.name).not.toBeNull();
  });
});
