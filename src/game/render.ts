import { H, T, TILE, W, bandstand, benches, billboards, buildings, idx, lamps, pond, tiles, trees, type Billboard, type Building } from './world';

export const FONT = '"Rubik", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 700) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && s > 6) {
    s -= 0.5;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
  return s;
}

/** Pre-render the static world (ground, buildings, trees) at `scale` device px per world px. */
export function prerenderWorld(scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(W * TILE * scale);
  c.height = Math.round(H * TILE * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawGround(ctx);
  drawStreetMarkings(ctx);
  drawPark(ctx);
  for (const b of buildings) drawBuilding(ctx, b);
  drawFurniture(ctx);
  for (const t of trees) drawTree(ctx, t.x * TILE, t.y * TILE, t.r * TILE);
  return c;
}

function drawGround(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = tiles[idx(x, y)];
      const px = x * TILE;
      const py = y * TILE;
      const r = hash(x, y);
      switch (t) {
        case T.Grass:
        case T.Tree:
        case T.Solid:
          ctx.fillStyle = r > 0.5 ? '#6db152' : '#69ab4e';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#5c9c43';
          for (let k = 0; k < 4; k++) {
            const hx = hash(x * 7 + k, y * 13) * 28;
            const hy = hash(x * 3, y * 11 + k) * 28;
            ctx.fillRect(px + hx, py + hy, 2, 3);
          }
          if (r > 0.93) {
            ctx.fillStyle = r > 0.965 ? '#ffffff' : '#f7d33b';
            ctx.fillRect(px + 10 + r * 10, py + 12, 3, 3);
          }
          break;
        case T.Pave:
          ctx.fillStyle = '#cdc9bf';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#bab6ab';
          ctx.fillRect(px, py, TILE, 1);
          ctx.fillRect(px, py + 16, TILE, 1);
          ctx.fillRect(px + ((y % 2) * 16), py, 1, 16);
          ctx.fillRect(px + (((y + 1) % 2) * 16), py + 16, 1, 16);
          if (r > 0.9) {
            ctx.fillStyle = 'rgba(60,60,60,0.12)';
            ctx.beginPath();
            ctx.ellipse(px + 16, py + 18, 6, 3, 0, 0, Math.PI * 2);
            ctx.fill(); // chewing gum. Every London pavement has it.
          }
          break;
        case T.Road:
          ctx.fillStyle = r > 0.5 ? '#4b4e56' : '#494c54';
          ctx.fillRect(px, py, TILE, TILE);
          if (r > 0.85) {
            ctx.fillStyle = '#42454c';
            ctx.fillRect(px + r * 16, py + 8, 10, 6); // pothole patch
          }
          break;
        case T.Rail:
          ctx.fillStyle = '#857b70';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#6a6158';
          for (let k = 0; k < 6; k++) ctx.fillRect(px + hash(x, k) * 30, py + hash(k, y + x) * 30, 2, 2);
          break;
        case T.Fence:
          ctx.fillStyle = '#69ab4e';
          ctx.fillRect(px, py, TILE, TILE);
          break;
        case T.Hedge:
          ctx.fillStyle = '#69ab4e';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#2f6b2a';
          ctx.beginPath();
          ctx.roundRect(px - 1, py + 4, TILE + 2, 24, 8);
          ctx.fill();
          ctx.fillStyle = '#3f8436';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(px + 4 + k * 8, py + 9 + hash(x, k) * 6, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case T.Path:
          ctx.fillStyle = '#d9c99f';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#c6b385';
          for (let k = 0; k < 5; k++) ctx.fillRect(px + hash(x + k, y) * 30, py + hash(x, y + k) * 30, 2, 2);
          break;
        case T.Plaza:
          ctx.fillStyle = '#d8c3a5';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#c4ab89';
          for (let k = 0; k < 4; k++) {
            ctx.fillRect(px, py + k * 8, TILE, 1);
            ctx.fillRect(px + ((k % 2) * 8) + 4, py + k * 8, 1, 8);
            ctx.fillRect(px + ((k % 2) * 8) + 20, py + k * 8, 1, 8);
          }
          break;
        case T.Water:
          ctx.fillStyle = '#69ab4e';
          ctx.fillRect(px, py, TILE, TILE);
          break;
        case T.Soil:
          ctx.fillStyle = '#7a5a3c';
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#5f4630';
          ctx.fillRect(px, py + 10, TILE, 2);
          ctx.fillRect(px, py + 22, TILE, 2);
          ctx.fillStyle = r > 0.3 ? '#4f9a3a' : '#c0532c';
          for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.arc(px + 4 + k * 8, py + 6, 2.6, 0, Math.PI * 2);
            ctx.arc(px + 4 + k * 8, py + 18, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case T.Building:
          ctx.fillStyle = '#5a5a5a';
          ctx.fillRect(px, py, TILE, TILE);
          break;
      }
    }

  // Railway: sleepers + rails along rows 0-1
  ctx.fillStyle = '#5b4632';
  for (let x = 0; x < W * TILE; x += 10) {
    ctx.fillRect(x, 6, 5, 22);
    ctx.fillRect(x, 36, 5, 22);
  }
  ctx.fillStyle = '#c9ced4';
  [10, 23, 40, 53].forEach((y) => ctx.fillRect(0, y, W * TILE, 2.5));
  // Fence (palisade) along row 2
  ctx.fillStyle = '#2b4d3a';
  ctx.fillRect(0, 2 * TILE + 8, W * TILE, 3);
  ctx.fillRect(0, 2 * TILE + 22, W * TILE, 3);
  for (let x = 0; x < W * TILE; x += 6) ctx.fillRect(x, 2 * TILE + 4, 2, 24);

  // kerbs: darker edge where pavement meets road
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (tiles[idx(x, y)] !== T.Pave) continue;
      const px = x * TILE;
      const py = y * TILE;
      ctx.fillStyle = '#a19d93';
      if (y + 1 < H && tiles[idx(x, y + 1)] === T.Road) ctx.fillRect(px, py + TILE - 3, TILE, 3);
      if (y > 0 && tiles[idx(x, y - 1)] === T.Road) ctx.fillRect(px, py, TILE, 3);
      if (x + 1 < W && tiles[idx(x + 1, y)] === T.Road) ctx.fillRect(px + TILE - 3, py, 3, TILE);
      if (x > 0 && tiles[idx(x - 1, y)] === T.Road) ctx.fillRect(px, py, 3, TILE);
    }
}

function drawStreetMarkings(ctx: CanvasRenderingContext2D) {
  // centre lines
  ctx.fillStyle = '#f2f2f2';
  for (let x = 0; x < W * TILE; x += 40) {
    if (x > 22 * TILE && x < 26 * TILE) continue;
    const zeb = (x0: number) => x + 22 > x0 * TILE - 6 && x < (x0 + 2) * TILE + 6;
    if (!zeb(10) && !zeb(30)) ctx.fillRect(x, 21 * TILE - 1.5, 22, 3);
    if (!zeb(29)) ctx.fillRect(x, 11 * TILE - 1.5, 22, 3);
  }
  for (let y = 3 * TILE; y < H * TILE; y += 40) {
    if ((y > 9 * TILE && y < 12 * TILE) || (y > 19.5 * TILE && y < 22.5 * TILE)) continue;
    ctx.fillRect(24 * TILE - 1.5, y, 3, 22);
  }
  // double yellow lines on the high street (no parking, obviously)
  ctx.fillStyle = '#f1c40f';
  for (const yy of [20 * TILE + 3, 20 * TILE + 7, 22 * TILE - 4, 22 * TILE - 8]) {
    ctx.fillRect(0, yy, 23 * TILE - 4, 2);
    ctx.fillRect(25 * TILE + 4, yy, W * TILE, 2);
  }
  // zebra crossing on the high street + cross street
  ctx.fillStyle = '#f7f7f7';
  for (let i = 0; i < 8; i++) ctx.fillRect(30 * TILE + 4, 20 * TILE + 2 + i * 8, 2 * TILE - 8, 4);
  for (let i = 0; i < 8; i++) ctx.fillRect(10 * TILE + 4, 20 * TILE + 2 + i * 8, 2 * TILE - 8, 4);
  for (let i = 0; i < 8; i++) ctx.fillRect(29 * TILE + 4, 10 * TILE + 2 + i * 8, 2 * TILE - 8, 4);
  // zig-zags on the approach to each zebra
  ctx.strokeStyle = '#f7f7f7';
  ctx.lineWidth = 1.5;
  for (const [zx, yTop] of [[10, 20], [30, 20], [29, 10]]) {
    for (const side of [-1, 1]) {
      for (const yy of [yTop * TILE + 3, (yTop + 2) * TILE - 3]) {
        ctx.beginPath();
        const x0 = side < 0 ? zx * TILE - 4 - 64 : (zx + 2) * TILE + 4;
        for (let k = 0; k <= 8; k++) ctx.lineTo(x0 + k * 8, yy + (k % 2 ? 2.5 : -2.5) * (yy < (yTop + 1) * TILE ? 1 : -1));
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < 8; i++) ctx.fillRect(23 * TILE + 2 + i * 8, 28 * TILE + 4, 4, TILE - 8);
  // "LOOK RIGHT"
  ctx.font = `700 9px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f7f7f7';
  ctx.fillText('LOOK RIGHT →', 31 * TILE, 19.85 * TILE);
  ctx.fillText('← LOOK LEFT', 11 * TILE, 22.45 * TILE);
  ctx.fillText('LOOK RIGHT →', 30 * TILE, 9.85 * TILE);
  // bus lane on the south lane
  ctx.fillStyle = 'rgba(160,50,50,0.7)';
  ctx.fillRect(36 * TILE, 21 * TILE + 2, 20 * TILE, TILE - 6);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = `700 14px ${FONT}`;
  ctx.fillText('BUS LANE', 46 * TILE, 21.68 * TILE);
}

function drawPark(ctx: CanvasRenderingContext2D) {
  // pond
  const cx = (pond.x + pond.w / 2) * TILE;
  const cy = (pond.y + pond.h / 2) * TILE;
  ctx.fillStyle = '#8f7a55';
  ctx.beginPath();
  ctx.ellipse(cx, cy, (pond.w / 2) * TILE + 4, (pond.h / 2) * TILE + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f7fb3';
  ctx.beginPath();
  ctx.ellipse(cx, cy, (pond.w / 2) * TILE - 2, (pond.h / 2) * TILE - 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a9ccc';
  ctx.beginPath();
  ctx.ellipse(cx - 30, cy - 18, 60, 18, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // lily pads + a shopping trolley, as is tradition
  ctx.fillStyle = '#4f9a3a';
  [[-70, 20], [60, -10], [90, 30], [-20, 40]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(cx + dx, cy + dy, 6, 0.4, Math.PI * 2);
    ctx.lineTo(cx + dx, cy + dy);
    ctx.fill();
  });
  ctx.strokeStyle = '#b8bec4';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx + 40, cy + 10, 16, 10);
  ctx.beginPath();
  ctx.moveTo(cx + 40, cy + 15);
  ctx.lineTo(cx + 56, cy + 15);
  ctx.stroke();
  // bandstand
  const bx = bandstand.x * TILE;
  const by = bandstand.y * TILE;
  const bw = bandstand.w * TILE;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2 + 6, by + bw / 2 + 8, bw / 2, bw / 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e2d2';
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by + bw / 2 + 6, bw / 2, bw / 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e6b46';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(bx + bw / 2 + Math.cos(a) * (bw / 2 - 4), by + bw / 2 + Math.sin(a) * (bw / 2.4 - 4));
  }
  ctx.fill();
  ctx.fillStyle = '#3d8a5c';
  ctx.beginPath();
  ctx.moveTo(bx + bw / 2, by + 10);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(bx + bw / 2 + Math.cos(a) * (bw / 2 - 4), by + bw / 2 + Math.sin(a) * (bw / 2.4 - 4));
  }
  ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(bx + bw / 2, by + bw / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // benches
  for (const b of benches) {
    const x = b.x * TILE;
    const y = b.y * TILE;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x - 13, y + 4, 30, 5);
    ctx.fillStyle = '#7a4f2a';
    ctx.fillRect(x - 15, y - 8, 30, 4);
    ctx.fillRect(x - 15, y - 2, 30, 5);
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(x - 13, y + 3, 2, 4);
    ctx.fillRect(x + 11, y + 3, 2, 4);
  }
  // park sign
  signPost(ctx, 31 * TILE, 31.1 * TILE, 'PECKWELL COMMON', 'No ball games. No fun. Dogs welcome.');
  signPost(ctx, 47 * TILE, 31.1 * TILE, 'PECKWELL COMMON', 'Please clean up after your dog (Gary).');
}

function signPost(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, sub: string) {
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 1.5, y, 3, 14);
  ctx.fillStyle = '#1f4d32';
  ctx.beginPath();
  ctx.roundRect(x - 44, y - 18, 88, 20, 3);
  ctx.fill();
  ctx.fillStyle = '#f2ecd9';
  ctx.textAlign = 'center';
  ctx.font = `700 8px ${FONT}`;
  ctx.fillText(title, x, y - 9);
  ctx.font = `500 5px ${FONT}`;
  ctx.fillText(sub, x, y - 2);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 4, y + r * 0.55, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b3d24';
  ctx.fillRect(x - 3, y - 4, 6, r * 0.7);
  const g = ['#2f6f2c', '#3b8a35', '#4ea343'];
  ctx.fillStyle = g[0];
  ctx.beginPath();
  ctx.arc(x, y - r * 0.55, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g[1];
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.75, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = g[2];
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.95, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function windowRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit = false) {
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
  ctx.fillStyle = lit ? '#f5d77a' : '#7fa8c4';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.6);
  ctx.lineTo(x + w * 0.6, y);
  ctx.lineTo(x + w * 0.85, y);
  ctx.lineTo(x, y + h * 0.85);
  ctx.fill();
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(x, y + h / 2 - 0.75, w, 1.5);
}

function drawBuilding(ctx: CanvasRenderingContext2D, b: Building) {
  const px = b.x * TILE;
  const py = b.y * TILE;
  const pw = b.w * TILE;
  const ph = b.h * TILE;
  const north = b.face === 'N';
  const isHome = b.kind === 'home' || b.id.startsWith('terrace');
  // drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(px + 6, py + 6, pw, ph);

  if (!north) {
    const roofH = isHome ? 2.3 * TILE : b.kind === 'tube' ? 1.8 * TILE : 2 * TILE;
    drawRoof(ctx, b, px, py, pw, roofH, isHome);
    // facade
    const fy = py + roofH;
    const fh = ph - roofH;
    ctx.fillStyle = b.facade;
    ctx.fillRect(px, fy, pw, fh);
    // brick texture
    ctx.fillStyle = shade(b.facade, -14);
    for (let yy = fy + 4; yy < fy + fh; yy += 6)
      for (let xx = px + ((yy / 6) % 2) * 6; xx < px + pw; xx += 12) ctx.fillRect(xx, yy, 8, 1);
    ctx.fillStyle = shade(b.facade, 25);
    ctx.fillRect(px, fy, pw, 2);
    const shopH = isHome ? 0 : 1.35 * TILE;
    // upper floor windows
    const upTop = fy + 6;
    const upBottom = py + ph - (isHome ? 1.15 * TILE : shopH + 16);
    for (let yy = upTop; yy + 16 <= upBottom; yy += 24)
      for (let i = 0; i < b.w; i++) {
        if (isHome && i === b.door && yy + 40 > py + ph) continue;
        windowRect(ctx, px + i * TILE + 9, yy, 14, 16, hash(b.x + i, yy) > 0.8);
      }
    if (isHome) drawHomeDoor(ctx, b, px, py, ph);
    else drawShopfront(ctx, b, px, py + ph - shopH - 14, pw, shopH + 14, false);
    if (b.kind === 'tube') drawTubeMark(ctx, px + pw - 18, py + roofH - 2);
  } else {
    // North-facing: shopfront strip on the top edge, roof behind it.
    const shopH = 1.6 * TILE;
    drawRoof(ctx, b, px, py + shopH, pw, ph - shopH, false);
    ctx.fillStyle = b.facade;
    ctx.fillRect(px, py, pw, shopH);
    drawShopfront(ctx, b, px, py, pw, shopH, true);
  }
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
}

function drawRoof(ctx: CanvasRenderingContext2D, b: Building, x: number, y: number, w: number, h: number, pitched: boolean) {
  ctx.fillStyle = b.roof;
  ctx.fillRect(x, y, w, h);
  if (pitched) {
    ctx.fillStyle = shade(b.roof, -12);
    for (let yy = y + 5; yy < y + h; yy += 6) ctx.fillRect(x, yy, w, 1.5);
    ctx.fillStyle = shade(b.roof, 22);
    ctx.fillRect(x, y + h * 0.42, w, 3);
    // chimneys with pots
    for (let i = 1; i < b.w; i += 3) {
      const cx = x + i * TILE + 6;
      ctx.fillStyle = shade(b.facade, -20);
      ctx.fillRect(cx, y + 4, 14, 14);
      ctx.fillStyle = '#b5532f';
      ctx.fillRect(cx + 2, y + 1, 4, 5);
      ctx.fillRect(cx + 8, y + 1, 4, 5);
    }
    // satellite dish
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(x + w - 16, y + h - 14, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = shade(b.roof, 18);
    ctx.fillRect(x, y, w, 3);
    ctx.fillRect(x, y, 3, h);
    ctx.fillRect(x + w - 3, y, 3, h);
    ctx.fillStyle = shade(b.roof, -10);
    ctx.fillRect(x, y + h - 3, w, 3);
    // AC units / vents
    const n = Math.max(1, Math.floor(b.w / 3));
    for (let i = 0; i < n; i++) {
      const vx = x + 10 + hash(b.x, i) * (w - 34);
      const vy = y + 8 + hash(i, b.y) * Math.max(2, h - 26);
      ctx.fillStyle = '#9aa1a8';
      ctx.fillRect(vx, vy, 14, 10);
      ctx.fillStyle = '#6f767d';
      ctx.beginPath();
      ctx.arc(vx + 7, vy + 5, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHomeDoor(ctx: CanvasRenderingContext2D, b: Building, px: number, py: number, ph: number) {
  const dx = px + b.door * TILE + 6;
  const dy = py + ph - 30;
  const colours = ['#1f3f8a', '#8a1f2f', '#1f6a3f', '#222', '#e0b021'];
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(dx - 3, dy - 3, 26, 33);
  ctx.fillStyle = colours[(b.x + b.y) % colours.length];
  ctx.fillRect(dx, dy, 20, 30);
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(dx + 15, dy + 15, 2.5, 2.5);
  ctx.fillRect(dx + 7, dy + 7, 6, 2);
  ctx.fillStyle = '#9b9b9b';
  ctx.fillRect(dx - 5, py + ph - 2, 30, 2);
  // ground floor windows
  for (let i = 0; i < b.w; i++) {
    if (Math.abs(i - b.door) < 1) continue;
    windowRect(ctx, px + i * TILE + 8, py + ph - 26, 16, 18);
  }
  if (b.sign) {
    const sw = Math.min(b.w * TILE - 20, 120);
    ctx.fillStyle = b.signBg;
    ctx.fillRect(px + b.door * TILE + 16 - sw / 2, py + ph - 44, sw, 11);
    ctx.fillStyle = b.signFg;
    ctx.textAlign = 'center';
    fitText(ctx, b.sign, sw - 6, 8);
    ctx.fillText(b.sign, px + b.door * TILE + 16, py + ph - 35.5);
  }
  // wheelie bins
  ctx.fillStyle = '#2d6a3e';
  ctx.fillRect(px + 4, py + ph - 14, 8, 12);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(px + 13, py + ph - 14, 8, 12);
}

function drawShopfront(ctx: CanvasRenderingContext2D, b: Building, x: number, y: number, w: number, h: number, north: boolean) {
  // layout: sign band (14px) then glazing with door
  const signY = north ? y + 2 : y;
  const glassY = north ? y + 18 : y + 16;
  const glassH = h - 20;
  ctx.fillStyle = b.signBg;
  ctx.fillRect(x + 2, signY, w - 4, 14);
  ctx.fillStyle = shade(b.signBg, -30);
  ctx.fillRect(x + 2, signY + 12, w - 4, 2);
  ctx.fillStyle = b.signFg;
  ctx.textAlign = 'center';
  fitText(ctx, b.sign, w - 12, 10.5);
  ctx.fillText(b.sign, x + w / 2, signY + 10.5);
  // glazing
  ctx.fillStyle = '#26323d';
  ctx.fillRect(x + 4, glassY, w - 8, glassH);
  ctx.fillStyle = '#3d5466';
  for (let i = 0; i < b.w; i++) {
    ctx.fillRect(x + i * TILE + 6, glassY + 2, TILE - 6, glassH - 4);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < b.w; i++) {
    ctx.beginPath();
    ctx.moveTo(x + i * TILE + 8, glassY + glassH - 4);
    ctx.lineTo(x + i * TILE + 20, glassY + 2);
    ctx.lineTo(x + i * TILE + 26, glassY + 2);
    ctx.lineTo(x + i * TILE + 14, glassY + glassH - 4);
    ctx.fill();
  }
  // goods in the window
  drawWindowGoods(ctx, b, x, glassY, w, glassH);
  // door
  const dx = x + b.door * TILE + 5;
  ctx.fillStyle = shade(b.facade, -35);
  ctx.fillRect(dx - 2, glassY - 1, 26, glassH + 1);
  ctx.fillStyle = '#5f7f95';
  ctx.fillRect(dx + 1, glassY + 2, 20, glassH - 2);
  ctx.fillStyle = '#d0d0d0';
  ctx.fillRect(dx + 16, glassY + glassH / 2, 2, 6);
  // awning
  if (b.awning) {
    const ay = north ? y - 4 : glassY - 4;
    for (let i = 0; i < w - 4; i += 8) {
      ctx.fillStyle = (i / 8) % 2 ? '#ffffff' : b.awning;
      ctx.fillRect(x + 2 + i, ay, 8, 7);
      ctx.beginPath();
      ctx.arc(x + 6 + i, ay + 7, 4, 0, Math.PI);
      ctx.fill();
    }
  }
}

function drawWindowGoods(ctx: CanvasRenderingContext2D, b: Building, x: number, y: number, _w: number, h: number) {
  const k = b.kind;
  for (let i = 0; i < b.w; i++) {
    if (i === b.door) continue;
    const cx = x + i * TILE + 16;
    const cy = y + h - 6;
    if (k === 'bakery') {
      ctx.fillStyle = '#e0a458';
      for (let j = 0; j < 3; j++) ctx.fillRect(cx - 10 + j * 7, cy - 4, 6, 4);
    } else if (k === 'lettings') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(cx - 9, cy - 16, 8, 10);
      ctx.fillRect(cx + 1, cy - 16, 8, 10);
      ctx.fillStyle = '#7a1fa2';
      ctx.fillRect(cx - 9, cy - 9, 8, 2);
      ctx.fillRect(cx + 1, cy - 9, 8, 2);
    } else if (k === 'cornershop') {
      const cs = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'];
      for (let j = 0; j < 4; j++) {
        ctx.fillStyle = cs[(j + i) % 4];
        ctx.fillRect(cx - 11 + j * 6, cy - 8, 4, 8);
      }
    } else if (k === 'chicken') {
      ctx.fillStyle = '#ffe066';
      ctx.font = `700 7px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('£2.99', cx, cy - 6);
    } else if (k === 'jobcentre') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(cx - 8, cy - 14, 16, 10);
      ctx.fillStyle = '#00786f';
      ctx.fillRect(cx - 6, cy - 12, 12, 2);
    } else if (k === 'pub') {
      ctx.fillStyle = '#f5d77a';
      ctx.fillRect(cx - 10, cy - 14, 20, 12);
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (k === 'cafe') {
      ctx.fillStyle = '#f6e7c1';
      ctx.fillRect(cx - 8, cy - 6, 5, 6);
      ctx.fillRect(cx + 2, cy - 6, 5, 6);
    } else if (k === 'barber') {
      // barber pole
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, cy - 18, 4, 16);
      ctx.fillStyle = '#e23b3b';
      for (let j = 0; j < 4; j++) ctx.fillRect(cx - 2, cy - 17 + j * 4, 4, 2);
    }
  }
}

function drawTubeMark(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Our own "Peckwell Transit" mark: a diamond with a bar. (Not the real roundel.)
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(11, 0);
  ctx.lineTo(0, 11);
  ctx.lineTo(-11, 0);
  ctx.fill();
  ctx.strokeStyle = '#d0312d';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#1d3f9a';
  ctx.fillRect(-14, -3, 28, 6);
  ctx.restore();
}

function drawFurniture(ctx: CanvasRenderingContext2D) {
  // red phone box
  phoneBox(ctx, 21.15 * TILE, 18.1 * TILE);
  // post box
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(26.5 * TILE + 3, 22.5 * TILE + 8, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c8102e';
  ctx.beginPath();
  ctx.roundRect(26.5 * TILE - 6, 22.5 * TILE - 14, 12, 22, [6, 6, 1, 1]);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(26.5 * TILE - 4, 22.5 * TILE - 7, 8, 2);
  // bus shelter on the north pavement
  const sx = 44.7 * TILE;
  const sy = 18.15 * TILE;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(sx + 4, sy + 4, 2 * TILE, 18);
  ctx.fillStyle = 'rgba(170,210,230,0.55)';
  ctx.fillRect(sx, sy, 2 * TILE, 16);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, 2 * TILE, 16);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(sx + 2 * TILE + 4, sy - 12, 3, 30);
  ctx.beginPath();
  ctx.arc(sx + 2 * TILE + 5.5, sy - 12, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 7px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('436', sx + 2 * TILE + 5.5, sy - 9.5);
  // Belisha beacons at the zebra
  for (const [bx, by] of [[29.8, 19.6], [32.2, 22.4], [9.8, 19.6], [12.2, 22.4], [28.8, 9.6], [31.2, 12.4]]) {
    ctx.fillStyle = '#222';
    ctx.fillRect(bx * TILE - 1, by * TILE - 18, 2, 18);
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(bx * TILE, by * TILE - 20, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // lamp posts (heads drawn here, glow drawn at night dynamically)
  for (const l of lamps) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(l.x * TILE + 2, l.y * TILE + 2, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2f36';
    ctx.fillRect(l.x * TILE - 1.5, l.y * TILE - 26, 3, 26);
    ctx.fillRect(l.x * TILE - 2.5, l.y * TILE - 3, 5, 3);
    ctx.beginPath();
    ctx.roundRect(l.x * TILE - 5, l.y * TILE - 31, 10, 6, [4, 4, 1, 1]);
    ctx.fill();
    ctx.fillStyle = '#f3e3a6';
    ctx.fillRect(l.x * TILE - 3.5, l.y * TILE - 26, 7, 1.5);
  }
}

function phoneBox(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 3, y + 3, 22, 26);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(x, y, 22, 26);
  ctx.fillStyle = '#a00d24';
  ctx.fillRect(x, y, 22, 4);
  ctx.fillStyle = '#f2f2f2';
  ctx.font = `700 4.5px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('TELEPHONE', x + 11, y + 3.3);
  ctx.fillStyle = '#8fb3c9';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 4, y + 6 + i * 6, 14, 4);
}

// -------------------------------------------------------------- dynamic bits

export function drawBillboard(ctx: CanvasRenderingContext2D, bb: Billboard, t: number, highlight: boolean) {
  const x = bb.x * TILE;
  const y = bb.y * TILE;
  const w = bb.w * TILE;
  const h = bb.h * TILE;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 5, y + 6, w, h);
  // legs
  ctx.fillStyle = '#3b3f45';
  ctx.fillRect(x + w * 0.2, y + h, 4, 10);
  ctx.fillRect(x + w * 0.8 - 4, y + h, 4, 10);
  ctx.fillStyle = '#20242a';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#fff7d6');
  g.addColorStop(1, '#ffe08a');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // diagonal promo stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = 'rgba(232,115,42,0.15)';
  for (let i = -h; i < w; i += 18) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + 8, y + h);
    ctx.lineTo(x + i + 8 + h, y);
    ctx.lineTo(x + i + h, y);
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1b1b1b';
  const big = fitText(ctx, 'YOUR AD HERE', w - 10, h * 0.36, 800);
  ctx.fillText('YOUR AD HERE', x + w / 2, y + h * 0.18 + big);
  ctx.fillStyle = '#c0392b';
  fitText(ctx, `£${bb.price}/week · tap to enquire`, w - 10, h * 0.22, 700);
  ctx.fillText(`£${bb.price}/week · tap to enquire`, x + w / 2, y + h * 0.86);
  if (highlight) {
    ctx.strokeStyle = `rgba(255,255,255,${0.6 + Math.sin(t * 6) * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
  }
  // little spotlights
  ctx.fillStyle = '#20242a';
  ctx.fillRect(x + w * 0.25 - 3, y - 7, 6, 4);
  ctx.fillRect(x + w * 0.75 - 3, y - 7, 6, 4);
}

export interface Vehicle {
  x: number; // tile units
  y: number;
  dir: 1 | -1;
  speed: number;
  kind: 'bus' | 'cab' | 'car' | 'van';
  color: string;
}

export function drawVehicle(ctx: CanvasRenderingContext2D, v: Vehicle) {
  const len = v.kind === 'bus' ? 3.4 * TILE : v.kind === 'van' ? 1.9 * TILE : 1.5 * TILE;
  const wid = v.kind === 'bus' ? 0.85 * TILE : 0.7 * TILE;
  const x = v.x * TILE - len / 2;
  const y = v.y * TILE - wid / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 3, y + 5, len, wid);
  ctx.fillStyle = v.color;
  ctx.beginPath();
  ctx.roundRect(x, y, len, wid, v.kind === 'bus' ? 4 : 6);
  ctx.fill();
  const front = v.dir > 0 ? x + len : x;
  if (v.kind === 'bus') {
    // double-decker roof from above
    ctx.fillStyle = '#e8473f';
    ctx.fillRect(x + 4, y + 3, len - 8, wid - 6);
    ctx.fillStyle = '#b81d1d';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 10 + i * 17, y + 6, 10, wid - 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('436 PECKWELL', x + len / 2, y + wid / 2 + 3.5);
  } else {
    ctx.fillStyle = 'rgba(160,200,230,0.85)';
    const wx = v.dir > 0 ? x + len * 0.58 : x + len * 0.12;
    ctx.fillRect(wx, y + 3, len * 0.3, wid - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + len * 0.3, y + 3, len * 0.3, wid - 6);
    if (v.kind === 'cab') {
      ctx.fillStyle = '#f5c518';
      ctx.fillRect(x + len / 2 - 4, y + wid / 2 - 3, 8, 6);
    }
    if (v.kind === 'van') {
      ctx.fillStyle = '#333';
      ctx.font = `700 6px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(v.dir > 0 ? 'MAN W/ VAN' : 'MAN W/ VAN', x + len * (v.dir > 0 ? 0.3 : 0.7), y + wid / 2 + 2);
    }
  }
  ctx.fillStyle = '#fff6c2';
  ctx.fillRect(front - (v.dir > 0 ? 3 : 0), y + 2, 3, 4);
  ctx.fillRect(front - (v.dir > 0 ? 3 : 0), y + wid - 6, 3, 4);
}

export function drawTrain(ctx: CanvasRenderingContext2D, x: number) {
  // Overground train, orange stripe
  const y = 0.25 * TILE;
  const carLen = 4 * TILE;
  for (let i = 0; i < 4; i++) {
    const cx = x + i * (carLen + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(cx + 3, y + 5, carLen, 1.5 * TILE);
    ctx.fillStyle = '#e9edf0';
    ctx.beginPath();
    ctx.roundRect(cx, y, carLen, 1.5 * TILE, 6);
    ctx.fill();
    ctx.fillStyle = '#e8732a';
    ctx.fillRect(cx, y + 0.55 * TILE, carLen, 0.4 * TILE);
    ctx.fillStyle = '#c4ccd3';
    for (let k = 0; k < 4; k++) ctx.fillRect(cx + 10 + k * 30, y + 6, 18, 6);
  }
}

export function drawPigeon(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, flying: boolean, flip: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  if (!flying) {
    ctx.beginPath();
    ctx.ellipse(0, 1, 5, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const peck = flying ? 0 : Math.max(0, Math.sin(t * 5)) * 2;
  ctx.fillStyle = '#8a8f99';
  ctx.beginPath();
  ctx.ellipse(0, flying ? -14 : -4, 5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c6270';
  ctx.beginPath();
  ctx.arc(4, (flying ? -16 : -6) + peck, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5aa37a';
  ctx.fillRect(2.4, (flying ? -15 : -5) + peck, 2, 1.2);
  if (flying) {
    const f = Math.sin(t * 30) * 6;
    ctx.fillStyle = '#7a808a';
    ctx.beginPath();
    ctx.moveTo(-2, -14);
    ctx.lineTo(-6, -14 - f);
    ctx.lineTo(2, -14);
    ctx.fill();
  }
  ctx.restore();
}

/** soft glow sprite for lamps */
export function makeGlow(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,214,120,0.75)');
  grd.addColorStop(0.4, 'rgba(255,190,90,0.28)');
  grd.addColorStop(1, 'rgba(255,170,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export const billboardAt = (wx: number, wy: number) => billboards.find((b) => wx >= b.x - 0.2 && wx <= b.x + b.w + 0.2 && wy >= b.y - 0.2 && wy <= b.y + b.h + 0.3);
