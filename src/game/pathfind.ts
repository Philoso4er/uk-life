import { H, W, isSolid } from './world';

/** A* over the tile grid (8-way, no corner cutting). Returns waypoints in tile units (tile centres), smoothed. */
export function findPath(sx: number, sy: number, tx: number, ty: number): { x: number; y: number }[] | null {
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
  const f = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open: number[] = [];
  const si = start.y * W + start.x;
  const gi = goal.y * W + goal.x;
  const hfn = (i: number) => {
    const dx = Math.abs((i % W) - goal.x);
    const dy = Math.abs(((i / W) | 0) - goal.y);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  g[si] = 0;
  f[si] = hfn(si);
  open.push(si);
  let iter = 0;
  while (open.length && iter++ < 6000) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
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
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) {
          if (g[ni] === Infinity) open.push(ni);
          g[ni] = ng;
          f[ni] = ng + hfn(ni);
          came[ni] = cur;
        }
      }
  }
  if (came[gi] === -1 && gi !== si) return null;
  const pts: { x: number; y: number }[] = [];
  for (let c = gi; c !== -1 && c !== si; c = came[c]) pts.push({ x: (c % W) + 0.5, y: ((c / W) | 0) + 0.5 });
  pts.reverse();
  // final point: exact target if it was walkable
  if (pts.length && !isSolid(Math.floor(tx), Math.floor(ty))) pts[pts.length - 1] = { x: tx, y: ty };
  return smooth({ x: sx, y: sy }, pts);
}

function nearestOpen(x: number, y: number) {
  for (let r = 1; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (!isSolid(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return null;
}

/** Can a body of radius r walk straight from a to b? */
export function lineClear(ax: number, ay: number, bx: number, by: number, r = 0.3) {
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

function smooth(start: { x: number; y: number }, pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts;
  const out: { x: number; y: number }[] = [];
  let anchor = start;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(anchor.x, anchor.y, pts[j].x, pts[j].y)) j--;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}
