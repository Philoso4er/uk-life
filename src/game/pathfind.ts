import { H, W, isSolid as worldSolid } from './world';
import { tileCost, type CostMode } from './traffic';

/** Any walkable tile grid: the street (default) or a building interior. */
export interface Grid {
  w: number;
  h: number;
  solid: (x: number, y: number) => boolean;
}
export const STREET: Grid = { w: W, h: H, solid: worldSolid };
// the grid the current search runs on (searches are synchronous, so a module variable is safe)
let G: Grid = STREET;
const isSolid = (x: number, y: number) => G.solid(x, y);

/**
 * Weighted A* over the tile grid (8-way, no corner cutting). Returns waypoints in tile units, smoothed.
 * `mode` picks the cost map: NPCs ('ped') hate stepping into traffic lanes except at crossings;
 * the player ('player') mildly prefers pavements; 'plain' is distance only.
 */
export function findPath(sx: number, sy: number, tx: number, ty: number, mode: CostMode = 'plain', grid: Grid = STREET): { x: number; y: number }[] | null {
  const prev = G;
  G = grid;
  try {
    return search(sx, sy, tx, ty, grid === STREET ? mode : 'plain');
  } finally {
    G = prev;
  }
}

function search(sx: number, sy: number, tx: number, ty: number, mode: CostMode): { x: number; y: number }[] | null {
  const W = G.w;
  const H = G.h;
  const start = { x: Math.floor(sx), y: Math.floor(sy) };
  let goal = { x: Math.floor(tx), y: Math.floor(ty) };
  if (isSolid(goal.x, goal.y)) {
    const near = nearestOpen(goal.x, goal.y);
    if (!near) return null;
    goal = near;
  }
  if (isSolid(start.x, start.y)) return null;
  const N = W * H;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new Heap();
  const si = start.y * W + start.x;
  const gi = goal.y * W + goal.x;
  const hfn = (i: number) => {
    const dx = Math.abs((i % W) - goal.x);
    const dy = Math.abs(((i / W) | 0) - goal.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  g[si] = 0;
  heap.push(si, hfn(si));
  let iter = 0;
  while (heap.size && iter++ < 8000) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    if (cur === gi) break;
    closed[cur] = 1;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (isSolid(nx, ny)) continue;
        if (dx && dy && (isSolid(cx + dx, cy) || isSolid(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const c = (tileCost(mode, cx, cy) + tileCost(mode, nx, ny)) / 2;
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1) * c;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          heap.push(ni, ng + hfn(ni));
        }
      }
  }
  if (came[gi] === -1 && gi !== si) return null;
  const pts: { x: number; y: number }[] = [];
  const onPath = new Set<number>([si]);
  for (let c = gi; c !== -1 && c !== si; c = came[c]) {
    pts.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
    onPath.add(c);
  }
  pts.reverse();
  // final point: exact target if it was walkable
  if (pts.length && !isSolid(Math.floor(tx), Math.floor(ty))) pts[pts.length - 1] = { x: tx, y: ty };
  return smooth({ x: sx, y: sy }, pts, mode, onPath);
}

function nearestOpen(x: number, y: number) {
  for (let r = 1; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (!isSolid(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return null;
}

/** Can a body of radius r walk straight from a to b? */
export function lineClear(ax: number, ay: number, bx: number, by: number, r = 0.3, grid?: Grid) {
  if (grid && grid !== G) {
    const prev = G;
    G = grid;
    try {
      return lineClear(ax, ay, bx, by, r);
    } finally {
      G = prev;
    }
  }
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / 0.2);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (isSolid(Math.floor(x - r), Math.floor(y - r)) || isSolid(Math.floor(x + r), Math.floor(y - r)) || isSolid(Math.floor(x - r), Math.floor(y + r)) || isSolid(Math.floor(x + r), Math.floor(y + r))) return false;
  }
  return true;
}

/** Shortcuts may not wander across expensive tiles (roads, grass) that the real path avoided. */
function lineCheap(ax: number, ay: number, bx: number, by: number, mode: CostMode, onPath: Set<number>) {
  if (mode === 'plain') return true;
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / 0.2);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    const x = Math.floor(ax + (bx - ax) * t);
    const y = Math.floor(ay + (by - ay) * t);
    if (tileCost(mode, x, y) > 1.5 && !onPath.has(y * G.w + x)) return false;
  }
  return true;
}

function smooth(start: { x: number; y: number }, pts: { x: number; y: number }[], mode: CostMode, onPath: Set<number>) {
  if (pts.length < 2) return pts;
  const out: { x: number; y: number }[] = [];
  let anchor = start;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !(lineClear(anchor.x, anchor.y, pts[j].x, pts[j].y) && lineCheap(anchor.x, anchor.y, pts[j].x, pts[j].y, mode, onPath))) j--;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}

/** Minimal binary heap of (index, priority). */
class Heap {
  private ids: number[] = [];
  private pr: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, p: number) {
    const ids = this.ids;
    const pr = this.pr;
    let i = ids.length;
    ids.push(id);
    pr.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= p) break;
      ids[i] = ids[parent];
      pr[i] = pr[parent];
      i = parent;
    }
    ids[i] = id;
    pr[i] = p;
  }
  pop() {
    const ids = this.ids;
    const pr = this.pr;
    const top = ids[0];
    const lastId = ids.pop()!;
    const lastP = pr.pop()!;
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && pr[r] < pr[l] ? r : l;
        if (pr[c] >= lastP) break;
        ids[i] = ids[c];
        pr[i] = pr[c];
        i = c;
      }
      ids[i] = lastId;
      pr[i] = lastP;
    }
    return top;
  }
}
