// Vector character art. Everything is drawn with the feet at (0,0), y pointing down, in "world px"
// (a map tile is 32px). A character is ~44px tall: a big readable head, a body with proper limbs,
// and per-outfit detail. These drawings are expensive-ish, so the game bakes them into cached sprite
// frames (see avatar.ts) and only ever blits images at runtime.
import type { Avatar, HairStyle } from './types';

export type Dir = 'down' | 'up' | 'side';
/** 0-7 walk cycle, 8-11 idle breathing, 12 blink, 13 phone check */
export const WALK_FRAMES = 8;
export const IDLE0 = 8;
export const BLINK = 12;
export const PHONE = 13;
export const FRAME_COUNT = 14;

// ------------------------------------------------------------------ colour helpers
function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex: string, amt: number) {
  const [r, g, b] = rgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function mix(hex: string, hex2: string, k: number) {
  const a = rgb(hex);
  const b = rgb(hex2);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`;
}
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
export function avatarSeed(a: Avatar) {
  const s = `${a.skin}${a.hair}${a.hairColor}${a.outfit}${a.outfitColor}${a.accessory}${a.beard ?? ''}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const LEGS = ['#2c3e66', '#1f2430', '#4a4f5a', '#6b5a3e', '#3f5a3a', '#34506e', '#5b3a2e'];
const SHOES = ['#f4f4f4', '#1a1a1a', '#b23a3a', '#6b4a2b', '#f4f4f4', '#2f5fa8'];
const EYES = ['#3b2618', '#2a4d7a', '#3f6b3a', '#1c1c1c', '#5a3a1a'];

interface Look {
  a: Avatar;
  skin: string;
  skinShade: string;
  skinLight: string;
  hair: string;
  hairDark: string;
  hairLight: string;
  top: string;
  topDark: string;
  topLight: string;
  legs: string;
  legsDark: string;
  shoe: string;
  sole: string;
  eye: string;
  seed: number;
}
function lookOf(a: Avatar): Look {
  const seed = avatarSeed(a);
  const legs = a.outfit === 'suit' ? shade(a.outfitColor, -30) : a.outfit === 'tracksuit' ? a.outfitColor : a.outfit === 'football' ? (seed & 1 ? '#f2f2f2' : '#1d1f24') : LEGS[seed % LEGS.length];
  const legsHex = legs.startsWith('#') ? legs : '#2c3e66';
  const shoe = a.outfit === 'suit' ? '#1a1a1a' : a.outfit === 'mac' ? '#5a3a22' : SHOES[(seed >>> 3) % SHOES.length];
  return {
    a,
    seed,
    skin: a.skin,
    skinShade: shade(a.skin, -32),
    skinLight: shade(a.skin, 22),
    hair: a.hairColor,
    hairDark: shade(a.hairColor, -38),
    hairLight: lum(a.hairColor) < 0.2 ? shade(a.hairColor, 55) : shade(a.hairColor, 40),
    top: a.outfit === 'hivis' ? '#ff8a1f' : a.outfit === 'mac' ? mix('#c8a46a', a.outfitColor, 0.25) : a.outfitColor,
    topDark: shade(a.outfit === 'hivis' ? '#ff8a1f' : a.outfitColor, -42),
    topLight: shade(a.outfit === 'hivis' ? '#ff8a1f' : a.outfitColor, 30),
    legs,
    legsDark: legs.startsWith('#') ? shade(legsHex, -30) : legs,
    shoe,
    sole: lum(shoe.startsWith('#') ? shoe : '#1a1a1a') > 0.6 ? '#c9ccd2' : '#f2f2f2',
    eye: EYES[(seed >>> 6) % EYES.length],
  };
}

// ------------------------------------------------------------------ primitive helpers
type C = CanvasRenderingContext2D;
function limb(ctx: C, x1: number, y1: number, x2: number, y2: number, w: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function limb2(ctx: C, a: [number, number], b: [number, number], c: [number, number], w: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.stroke();
}
function ell(ctx: C, x: number, y: number, rx: number, ry: number, col: string | CanvasGradient, rot = 0) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}
function rrect(ctx: C, x: number, y: number, w: number, h: number, r: number, col: string | CanvasGradient) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function hgrad(ctx: C, x0: number, x1: number, light: string, mid: string, dark: string) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

// ------------------------------------------------------------------ pose
interface Pose {
  dir: Dir;
  /** body vertical offset (bob / breathing) */
  bob: number;
  // front/back legs: foot lift per leg (left, right) and arm swing
  liftL: number;
  liftR: number;
  swing: number;
  // side view: angles (radians from vertical) for near/far thigh+knee, arms
  nearThigh: number;
  nearKnee: number;
  farThigh: number;
  farKnee: number;
  nearArm: number;
  farArm: number;
  blink: boolean;
  phone: boolean;
  breath: number;
}
function poseFor(dir: Dir, frame: number): Pose {
  const p: Pose = { dir, bob: 0, liftL: 0, liftR: 0, swing: 0, nearThigh: 0, nearKnee: 0, farThigh: 0, farKnee: 0, nearArm: 0.06, farArm: -0.06, blink: frame === BLINK, phone: frame === PHONE, breath: 0 };
  if (frame < WALK_FRAMES) {
    const ph = (frame / WALK_FRAMES) * Math.PI * 2;
    const s = Math.sin(ph);
    if (dir === 'side') {
      p.nearThigh = 0.52 * s;
      p.farThigh = -0.52 * s;
      // the leg swinging forward bends at the knee
      p.nearKnee = Math.max(0, Math.cos(ph)) * 0.75;
      p.farKnee = Math.max(0, -Math.cos(ph)) * 0.75;
      p.nearArm = -0.55 * s;
      p.farArm = 0.55 * s;
      p.bob = -Math.abs(Math.cos(ph)) * 1.1 + 0.4;
    } else {
      p.liftL = Math.max(0, s) * 2.4;
      p.liftR = Math.max(0, -s) * 2.4;
      p.swing = s;
      p.bob = -Math.abs(s) * 1.1;
    }
  } else if (frame >= IDLE0 && frame < IDLE0 + 4) {
    p.breath = Math.sin(((frame - IDLE0) / 4) * Math.PI * 2);
    p.bob = p.breath * 0.35;
  }
  return p;
}

// ------------------------------------------------------------------ main
const HEAD_Y = -31.5;
const HR = 8.7; // head radius (x)
const HRY = 8.3;

export function drawCharacter(ctx: C, a: Avatar, dir: Dir, frame: number) {
  const L = lookOf(a);
  const P = poseFor(dir, frame);
  ctx.save();
  if (dir === 'side') drawSide(ctx, L, P);
  else drawFrontBack(ctx, L, P, dir === 'up');
  ctx.restore();
}

// ---- front / back
function drawFrontBack(ctx: C, L: Look, P: Pose, back: boolean) {
  const a = L.a;
  const o = a.outfit;
  // hair that hangs behind the body (seen from the front)
  ctx.save();
  ctx.translate(0, P.bob);
  if (!back) hairBehind(ctx, L, 'front');
  ctx.restore();

  // legs
  const legW = o === 'football' ? 4.2 : 4.6;
  const legs = (side: -1 | 1, lift: number) => {
    const x = side * 3;
    const foot = -1.9 - lift;
    const knee = -6.5 - lift * 0.4 + P.bob * 0.5;
    if (o === 'dress' || o === 'football') {
      // bare legs (tights for the dress) + socks for football
      limb2(ctx, [x, -11 + P.bob], [x, knee], [x, foot], 3.5, o === 'dress' ? (L.seed & 2 ? '#2a2a33' : L.skin) : L.skin);
      if (o === 'football') {
        limb(ctx, x, knee + 0.8, x, foot, 3.9, L.top);
        limb(ctx, x - 1.4, knee + 1.5, x + 1.4, knee + 1.5, 1.1, '#ffffff');
      }
    } else limb2(ctx, [x, -12 + P.bob], [x, knee], [x, foot], legW, side < 0 ? L.legs : L.legsDark);
    // shoe
    rrect(ctx, x - 2.9, foot - 1.3, 5.8, 3.1, 1.5, L.shoe);
    ctx.fillStyle = L.sole;
    ctx.fillRect(x - 2.6, foot + 1.15, 5.2, 0.7);
  };
  legs(-1, P.liftL);
  legs(1, P.liftR);

  ctx.save();
  ctx.translate(0, P.bob);
  const sw = P.swing;
  // shorts for football kit
  if (o === 'football') {
    rrect(ctx, -6.4, -13.2, 12.8, 5.2, 1.8, L.legs);
    ctx.fillStyle = shade(L.legs.startsWith('#') ? L.legs : '#1d1f24', -25);
    ctx.fillRect(-0.4, -11, 0.8, 3);
  }
  // back arms are behind the torso when facing away? (no: both arms are at the sides)
  torsoFrontBack(ctx, L, P, back);
  // arms
  const sleeve = o === 'dress' ? L.skin : o === 'football' ? L.top : o === 'hivis' ? '#3b4250' : L.top;
  const sleeveDark = o === 'dress' ? L.skinShade : o === 'hivis' ? '#2b313c' : L.topDark;
  const arm = (side: -1 | 1, s: number) => {
    const sx = side * (o === 'puffer' ? 8.4 : 7.2);
    const hx = side * (o === 'puffer' ? 9.6 : 8.6);
    const hy = -12.6 + s * 1.3;
    const ey = -17 + s * 0.7;
    limb2(ctx, [sx, -20.6], [hx - side * 0.2, ey], [hx, hy - 1.3], o === 'puffer' ? 4.6 : 3.9, side < 0 ? sleeve : sleeveDark);
    if (o === 'football' || o === 'dress') limb(ctx, hx - side * 0.1, ey + 1.2, hx, hy - 1.3, 3.2, side < 0 ? L.skin : L.skinShade);
    ell(ctx, hx, hy, 1.9, 2, side < 0 ? L.skin : L.skinShade);
  };
  if (P.phone && !back) {
    // both hands up holding a phone
    limb2(ctx, [-7.2, -20.6], [-7.6, -15.5], [-1.6, -16.4], 3.9, sleeve);
    limb2(ctx, [7.2, -20.6], [7.6, -15.5], [1.6, -16.4], 3.9, sleeveDark);
    rrect(ctx, -2.6, -19.6, 5.2, 4.4, 0.9, '#22252c');
    rrect(ctx, -2.1, -19.2, 4.2, 3.4, 0.5, '#7fd3ff');
    ell(ctx, -2.2, -16.2, 1.8, 1.8, L.skin);
    ell(ctx, 2.2, -16.2, 1.8, 1.8, L.skinShade);
  } else {
    arm(-1, -sw);
    arm(1, sw);
  }
  // scarf over the torso
  if (a.accessory === 'scarf') scarf(ctx, L, back);
  // head
  ctx.translate(0, P.breath * 0.15);
  headFrontBack(ctx, L, P, back);
  ctx.restore();
}

function torsoFrontBack(ctx: C, L: Look, P: Pose, back: boolean) {
  const o = L.a.outfit;
  const wide = o === 'puffer' ? 1.18 : o === 'mac' ? 1.05 : 1;
  const bottom = o === 'mac' ? -6.2 : o === 'dress' ? -6.8 : o === 'knit' ? -10.6 : -11.2;
  const w = 7.4 * wide;
  const b = (o === 'dress' ? 9.4 : o === 'mac' ? 8.4 : 6.8 * wide) + P.breath * 0.12;
  // neck
  rrect(ctx, -2.2, -25.4, 4.4, 3.6, 1.2, L.skinShade);
  ctx.beginPath();
  ctx.moveTo(-w, -19.8);
  ctx.quadraticCurveTo(-w, -23.4, -w + 3.2, -23.4);
  ctx.lineTo(w - 3.2, -23.4);
  ctx.quadraticCurveTo(w, -23.4, w, -19.8);
  ctx.lineTo(b, bottom);
  ctx.quadraticCurveTo(0, bottom + 0.9, -b, bottom);
  ctx.closePath();
  ctx.fillStyle = hgrad(ctx, -w, w, L.topLight, L.top, L.topDark);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const top = L.top;
  switch (o) {
    case 'hoodie':
      if (!back) {
        // drawstrings + kangaroo pocket
        rrect(ctx, -4.6, -16.2, 9.2, 4.4, 1.6, L.topDark);
        rrect(ctx, -4.2, -16, 8.4, 3.9, 1.4, top);
        limb(ctx, -1.6, -22.6, -1.9, -18.6, 0.8, '#f4f4f4');
        limb(ctx, 1.6, -22.6, 1.9, -18.6, 0.8, '#f4f4f4');
      } else {
        // hood lying on the back
        ell(ctx, 0, -20.8, 5.2, 3.2, L.topDark);
        ell(ctx, 0, -21.4, 4.2, 2.4, L.top);
      }
      ctx.fillStyle = L.topDark;
      ctx.fillRect(-w, bottom - 1.6, w * 2, 1.6);
      break;
    case 'puffer':
      ctx.strokeStyle = L.topDark;
      ctx.lineWidth = 0.75;
      for (let y = -20; y < bottom; y += 2.9) {
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.quadraticCurveTo(0, y + 1.1, w, y);
        ctx.stroke();
      }
      if (!back) limb(ctx, 0, -23, 0, bottom, 0.8, shade(L.top.startsWith('#') ? L.top : '#222831', -60));
      // collar
      rrect(ctx, -4.6, -24.4, 9.2, 2.6, 1.2, L.topLight);
      break;
    case 'tracksuit':
      ctx.fillStyle = '#f6f6f6';
      ctx.fillRect(-w + 0.6, -22, 1.2, 12);
      ctx.fillRect(w - 1.8, -22, 1.2, 12);
      if (!back) limb(ctx, 0, -23, 0, bottom, 0.8, '#e6e6e6');
      rrect(ctx, -3.4, -24.2, 6.8, 1.9, 0.8, L.topDark);
      break;
    case 'suit':
      if (!back) {
        ctx.fillStyle = '#f4f4f4';
        ctx.beginPath();
        ctx.moveTo(-3.4, -23.4);
        ctx.lineTo(3.4, -23.4);
        ctx.lineTo(0, -14.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = (L.seed & 4) ? '#b5333b' : '#2f4f8f';
        ctx.beginPath();
        ctx.moveTo(-0.9, -22.4);
        ctx.lineTo(0.9, -22.4);
        ctx.lineTo(1.2, -16);
        ctx.lineTo(0, -14.8);
        ctx.lineTo(-1.2, -16);
        ctx.closePath();
        ctx.fill();
        // lapels
        ctx.fillStyle = L.topDark;
        ctx.beginPath();
        ctx.moveTo(-3.6, -23.4);
        ctx.lineTo(-1.2, -17);
        ctx.lineTo(-3.4, -18.6);
        ctx.closePath();
        ctx.moveTo(3.6, -23.4);
        ctx.lineTo(1.2, -17);
        ctx.lineTo(3.4, -18.6);
        ctx.closePath();
        ctx.fill();
        ell(ctx, 0, -12.9, 0.5, 0.5, '#d6d6d6');
      } else limb(ctx, 0, -18, 0, bottom, 0.6, L.topDark);
      break;
    case 'dress':
      ctx.fillStyle = L.topDark;
      ctx.fillRect(-w, -15.6, w * 2, 1.3);
      if (!back) {
        ctx.fillStyle = '#f6f2ea';
        ctx.beginPath();
        ctx.moveTo(-3, -23.4);
        ctx.quadraticCurveTo(0, -20.6, 3, -23.4);
        ctx.lineTo(1.8, -23.4);
        ctx.quadraticCurveTo(0, -22, -1.8, -23.4);
        ctx.fill();
        // polka dots
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 9; i++) ell(ctx, -6 + (i % 3) * 5.2 + (Math.floor(i / 3) % 2) * 2.4, -12.4 + Math.floor(i / 3) * 2.2, 0.7, 0.7, 'rgba(255,255,255,0.35)');
      }
      break;
    case 'hivis':
      ctx.fillStyle = '#e9edf2';
      ctx.fillRect(-w, -17.6, w * 2, 1.5);
      ctx.fillRect(-w, -13.8, w * 2, 1.5);
      if (!back) {
        ctx.fillRect(-4.6, -23.4, 1.5, 6);
        ctx.fillRect(3.1, -23.4, 1.5, 6);
        ctx.fillStyle = '#3b4250';
        ctx.fillRect(-1.6, -23.4, 3.2, 4.6);
      } else {
        ctx.fillStyle = '#2b2f36';
        ctx.font = '700 3.2px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CREW', 0, -19.4);
      }
      break;
    case 'mac':
      // trench: belt, lapels, buttons
      ctx.fillStyle = L.topDark;
      ctx.fillRect(-w - 1, -13.6, w * 2 + 2, 1.5);
      rrect(ctx, -1.2, -14, 2.4, 2.2, 0.4, '#3a2a1a');
      if (!back) {
        ctx.fillStyle = L.topLight;
        ctx.beginPath();
        ctx.moveTo(-4.4, -23.4);
        ctx.lineTo(0, -16.6);
        ctx.lineTo(4.4, -23.4);
        ctx.lineTo(2.2, -23.4);
        ctx.lineTo(0, -19.6);
        ctx.lineTo(-2.2, -23.4);
        ctx.closePath();
        ctx.fill();
        for (const y of [-18.6, -16.2, -10.4]) {
          ell(ctx, -2.6, y, 0.5, 0.5, L.topDark);
          ell(ctx, 2.6, y, 0.5, 0.5, L.topDark);
        }
      } else limb(ctx, 0, -12, 0, bottom, 0.7, L.topDark);
      break;
    case 'knit': {
      // a Fair Isle band across the chest
      ctx.fillStyle = L.topDark;
      ctx.fillRect(-w, -21, w * 2, 3.4);
      ctx.fillStyle = '#f2ead8';
      for (let x = -w; x < w; x += 2.2) {
        ctx.beginPath();
        ctx.moveTo(x, -18.2);
        ctx.lineTo(x + 1.1, -20.4);
        ctx.lineTo(x + 2.2, -18.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = L.topDark;
      ctx.fillRect(-w, bottom - 1.4, w * 2, 1.4);
      rrect(ctx, -3.2, -24.2, 6.4, 1.8, 0.8, L.topDark);
      break;
    }
    case 'football':
      ctx.fillStyle = '#f6f6f6';
      ctx.fillRect(-w, -23.4, 2.2, 13);
      ctx.fillRect(w - 2.2, -23.4, 2.2, 13);
      if (back) {
        ctx.fillStyle = '#f6f6f6';
        ctx.font = '800 6.4px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(((L.seed >>> 4) % 11) + 1), 0, -13.4);
      } else {
        rrect(ctx, -2.2, -24, 4.4, 2.2, 1, '#f6f6f6');
        ell(ctx, 3.2, -19.4, 1, 1.1, '#f6f6f6');
      }
      break;
  }
  ctx.restore();
}

function headFrontBack(ctx: C, L: Look, P: Pose, back: boolean) {
  const y = HEAD_Y;
  // ears
  ell(ctx, -HR + 0.3, y + 0.6, 1.9, 2.3, L.skinShade);
  ell(ctx, HR - 0.3, y + 0.6, 1.9, 2.3, L.skinShade);
  if (back) {
    ell(ctx, 0, y, HR, HRY, L.skinShade);
    hairTop(ctx, L, 'back');
    accessoryHead(ctx, L, 'back');
    return;
  }
  // face with a soft light from the top-left
  const g = ctx.createRadialGradient(-3, y - 3.5, 1, 0, y, HR + 1.5);
  g.addColorStop(0, L.skinLight);
  g.addColorStop(0.55, L.skin);
  g.addColorStop(1, L.skinShade);
  ell(ctx, 0, y, HR, HRY, g);
  // chin shadow onto neck
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, y + HRY - 0.4, 4.2, 1.2, 0, 0, Math.PI);
  ctx.fill();
  face(ctx, L, P);
  hairTop(ctx, L, 'front');
  accessoryHead(ctx, L, 'front');
}

function face(ctx: C, L: Look, P: Pose) {
  const y = HEAD_Y + 0.6;
  const look = P.phone ? 1.1 : 0;
  // eyes
  for (const s of [-1, 1]) {
    const ex = s * 3.2;
    if (P.blink) {
      limb(ctx, ex - 1.6, y + 0.3, ex + 1.6, y + 0.3, 0.8, '#3a2a22');
      continue;
    }
    ell(ctx, ex, y, 1.95, 2.35, '#ffffff');
    ell(ctx, ex + 0.15, y + 0.25 + look, 1.4, 1.55, L.eye);
    ell(ctx, ex + 0.15, y + 0.35 + look, 0.7, 0.8, '#0d0b0a');
    ell(ctx, ex - 0.35, y - 0.45 + look * 0.7, 0.5, 0.5, '#ffffff');
    // upper lid line
    ctx.strokeStyle = 'rgba(40,25,20,0.75)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.ellipse(ex, y, 2, 2.4, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
  // brows
  const browCol = L.a.hair === 'bald' ? L.skinShade : L.hairDark;
  for (const s of [-1, 1]) {
    ctx.strokeStyle = browCol;
    ctx.lineWidth = 0.95;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 1.6, y - 3.3);
    ctx.quadraticCurveTo(s * 3.1, y - 4.2, s * 4.7, y - 3.3);
    ctx.stroke();
  }
  // nose
  ctx.strokeStyle = L.skinShade;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-0.6, y + 2.6);
  ctx.quadraticCurveTo(0, y + 3.3, 0.7, y + 2.6);
  ctx.stroke();
  // cheeks
  ell(ctx, -5, y + 3.1, 1.6, 1, 'rgba(232,110,110,0.28)');
  ell(ctx, 5, y + 3.1, 1.6, 1, 'rgba(232,110,110,0.28)');
  // beard / mouth
  const beard = L.a.beard ?? 'none';
  if (beard === 'beard') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.moveTo(-HR + 0.8, y - 0.6);
    ctx.quadraticCurveTo(-HR + 0.6, y + 7.4, 0, y + 8.4);
    ctx.quadraticCurveTo(HR - 0.6, y + 7.4, HR - 0.8, y - 0.6);
    ctx.lineTo(HR - 2.4, y + 1.6);
    ctx.quadraticCurveTo(0, y + 3.2, -HR + 2.4, y + 1.6);
    ctx.closePath();
    ctx.fill();
  } else if (beard === 'stubble') {
    ctx.fillStyle = 'rgba(40,30,25,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, y + 5, 5.4, 3.2, 0, 0, Math.PI);
    ctx.fill();
  }
  // mouth: a small friendly smile
  ctx.strokeStyle = beard === 'beard' ? '#f2e6e0' : '#7a2e2e';
  ctx.lineWidth = 0.85;
  ctx.beginPath();
  ctx.moveTo(-1.7, y + 4.6);
  ctx.quadraticCurveTo(0, y + 5.9, 1.7, y + 4.6);
  ctx.stroke();
  if (beard === 'tache') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.moveTo(-2.9, y + 4.4);
    ctx.quadraticCurveTo(0, y + 2.6, 2.9, y + 4.4);
    ctx.quadraticCurveTo(0, y + 3.8, -2.9, y + 4.4);
    ctx.fill();
  }
}

// ---- side (facing right; the left side is a mirror)
function drawSide(ctx: C, L: Look, P: Pose) {
  const o = L.a.outfit;
  const hipY = -11.6;
  // where the feet land decides the bob
  const leg = (thigh: number, knee: number) => {
    const kx = Math.sin(thigh) * 5.4;
    const ky = hipY + Math.cos(thigh) * 5.4;
    const shin = thigh - knee;
    const fx = kx + Math.sin(shin) * 5.6;
    const fy = ky + Math.cos(shin) * 5.6;
    return { kx, ky, fx, fy };
  };
  const near = leg(P.nearThigh, P.nearKnee);
  const far = leg(P.farThigh, P.farKnee);
  const ground = Math.max(near.fy, far.fy) + 1.6;
  const lift = -ground; // translate so the lowest foot touches 0
  ctx.save();
  ctx.translate(0, lift + (P.dir === 'side' && P.nearThigh === 0 ? P.bob : 0));
  hairBehind(ctx, L, 'side');
  const drawLeg = (l: ReturnType<typeof leg>, col: string, skinCol: string) => {
    const bare = o === 'dress' || o === 'football';
    limb2(ctx, [0, hipY], [l.kx, l.ky], [l.fx, l.fy], bare ? 3.5 : 4.6, bare ? (o === 'dress' && L.seed & 2 ? '#2a2a33' : skinCol) : col);
    if (o === 'football') limb(ctx, l.kx + (l.fx - l.kx) * 0.15, l.ky + (l.fy - l.ky) * 0.15, l.fx, l.fy, 3.9, L.top);
    // shoe pointing forward
    rrect(ctx, l.fx - 2.2, l.fy - 1.4, 5.8, 3, 1.4, L.shoe);
    ctx.fillStyle = L.sole;
    ctx.fillRect(l.fx - 2, l.fy + 1, 5.4, 0.7);
  };
  // far arm (behind)
  const sleeve = o === 'dress' ? L.skin : o === 'hivis' ? '#3b4250' : L.top;
  const arm = (ang: number, col: string, hand: string) => {
    const sx = 0.4;
    const sy = -20.8;
    const ex = sx + Math.sin(ang) * 5;
    const ey = sy + Math.cos(ang) * 5;
    const hx = ex + Math.sin(ang * 1.4 + 0.2) * 4.4;
    const hy = ey + Math.cos(ang * 1.4 + 0.2) * 4.4;
    limb2(ctx, [sx, sy], [ex, ey], [hx, hy], o === 'puffer' ? 4.6 : 3.9, col);
    if (o === 'dress' || o === 'football') limb(ctx, ex, ey, hx, hy, 3.2, hand);
    ell(ctx, hx + 0.2, hy + 1, 1.9, 1.9, hand);
  };
  arm(P.phone ? -0.2 : P.farArm, o === 'dress' ? L.skinShade : L.topDark, L.skinShade);
  drawLeg(far, L.legsDark, L.skinShade);
  drawLeg(near, L.legs, L.skin);
  if (o === 'football') rrect(ctx, -3.8, -13.4, 7.6, 5, 1.6, L.legs);
  ctx.translate(0, P.bob * (P.nearThigh === 0 ? 0 : 0));
  // torso
  const wide = o === 'puffer' ? 1.2 : 1;
  const back = -4.4 * wide;
  const front = 4.2 * wide;
  const bottom = o === 'mac' ? -6.2 : o === 'dress' ? -6.8 : -11.2;
  rrect(ctx, -1.6, -25.4, 3.8, 3.6, 1.2, L.skinShade);
  ctx.beginPath();
  ctx.moveTo(back, -19.6);
  ctx.quadraticCurveTo(back, -23.4, back + 2.6, -23.4);
  ctx.lineTo(front - 2.2, -23.4);
  ctx.quadraticCurveTo(front + 0.6, -22.8, front, -18.8);
  ctx.lineTo(o === 'dress' || o === 'mac' ? front + 3 : front, bottom);
  ctx.lineTo(o === 'dress' || o === 'mac' ? back - 2.6 : back, bottom);
  ctx.closePath();
  ctx.fillStyle = hgrad(ctx, back, front, L.topDark, L.top, L.topLight);
  ctx.fill();
  ctx.save();
  ctx.clip();
  switch (o) {
    case 'hoodie':
      ell(ctx, back + 1.2, -21.6, 2.8, 3.4, L.topDark);
      ctx.fillStyle = L.topDark;
      ctx.fillRect(back, bottom - 1.6, 12, 1.6);
      break;
    case 'puffer':
      ctx.strokeStyle = L.topDark;
      ctx.lineWidth = 0.75;
      for (let y = -20; y < bottom; y += 2.9) {
        ctx.beginPath();
        ctx.moveTo(back, y);
        ctx.quadraticCurveTo(0, y + 1, front + 1, y);
        ctx.stroke();
      }
      break;
    case 'tracksuit':
      ctx.fillStyle = '#f6f6f6';
      ctx.fillRect(-0.6, -22.6, 1.2, 12);
      break;
    case 'suit':
      ctx.fillStyle = '#f4f4f4';
      ctx.fillRect(front - 1.6, -23.4, 1.6, 7);
      ctx.fillStyle = L.seed & 4 ? '#b5333b' : '#2f4f8f';
      ctx.fillRect(front - 0.9, -22, 0.9, 6);
      break;
    case 'hivis':
      ctx.fillStyle = '#e9edf2';
      ctx.fillRect(back, -17.6, 12, 1.5);
      ctx.fillRect(back, -13.8, 12, 1.5);
      break;
    case 'mac':
      ctx.fillStyle = L.topDark;
      ctx.fillRect(back - 3, -13.6, 14, 1.5);
      break;
    case 'knit':
      ctx.fillStyle = L.topDark;
      ctx.fillRect(back, -21, 12, 3.4);
      ctx.fillStyle = '#f2ead8';
      for (let x = back; x < front; x += 2.2) {
        ctx.beginPath();
        ctx.moveTo(x, -18.2);
        ctx.lineTo(x + 1.1, -20.4);
        ctx.lineTo(x + 2.2, -18.2);
        ctx.fill();
      }
      break;
    case 'football':
      ctx.fillStyle = '#f6f6f6';
      ctx.fillRect(-1, -23.4, 2, 13);
      break;
    case 'dress':
      ctx.fillStyle = L.topDark;
      ctx.fillRect(back - 3, -15.6, 14, 1.3);
      break;
  }
  ctx.restore();
  if (L.a.accessory === 'scarf') {
    rrect(ctx, -3.6, -24.6, 8, 3, 1.4, '#c0392b');
    rrect(ctx, -3.6, -22.4, 2.6, 6, 1, '#a93226');
  }
  // near arm (in front)
  if (P.phone) {
    limb2(ctx, [0.4, -20.8], [1.2, -15.8], [5.6, -17.6], o === 'puffer' ? 4.6 : 3.9, sleeve);
    rrect(ctx, 5.2, -21.4, 2.2, 4.6, 0.6, '#22252c');
    ell(ctx, 5.8, -17.2, 1.9, 1.9, L.skin);
  } else arm(P.nearArm, sleeve, L.skin);
  // head
  headSide(ctx, L, P);
  ctx.restore();
}

function headSide(ctx: C, L: Look, P: Pose) {
  const y = HEAD_Y;
  const cx = 0.8;
  const g = ctx.createRadialGradient(cx + 2, y - 3.5, 1, cx, y, HR + 1.5);
  g.addColorStop(0, L.skinLight);
  g.addColorStop(0.55, L.skin);
  g.addColorStop(1, L.skinShade);
  ell(ctx, cx, y, HR - 0.4, HRY, g);
  // nose
  ell(ctx, cx + HR - 0.6, y + 1.6, 1.5, 1.3, L.skin);
  // ear
  ell(ctx, cx - 1.6, y + 0.8, 1.8, 2.3, L.skinShade);
  ell(ctx, cx - 1.6, y + 0.8, 0.9, 1.3, shade(L.skin, -48));
  // eye
  const ex = cx + 4.2;
  const ey = y + 0.6;
  if (P.blink) limb(ctx, ex - 1.2, ey + 0.3, ex + 1.3, ey + 0.3, 0.8, '#3a2a22');
  else {
    ell(ctx, ex, ey, 1.5, 2.2, '#ffffff');
    ell(ctx, ex + 0.5, ey + 0.2 + (P.phone ? 1 : 0), 1.05, 1.45, L.eye);
    ell(ctx, ex + 0.6, ey + 0.3 + (P.phone ? 1 : 0), 0.55, 0.75, '#0d0b0a');
    ell(ctx, ex + 0.2, ey - 0.5, 0.4, 0.4, '#ffffff');
  }
  ctx.strokeStyle = L.a.hair === 'bald' ? L.skinShade : L.hairDark;
  ctx.lineWidth = 0.95;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ex - 1.6, ey - 3.1);
  ctx.quadraticCurveTo(ex, ey - 3.9, ex + 1.8, ey - 3.2);
  ctx.stroke();
  ell(ctx, cx + 5.4, y + 3.6, 1.4, 0.9, 'rgba(232,110,110,0.28)');
  const beard = L.a.beard ?? 'none';
  if (beard === 'beard') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.moveTo(cx - 1, y + 1);
    ctx.quadraticCurveTo(cx - 0.4, y + 8.6, cx + 5, y + 8);
    ctx.quadraticCurveTo(cx + 8.4, y + 6.4, cx + 7.6, y + 4.2);
    ctx.lineTo(cx + 4, y + 4.6);
    ctx.closePath();
    ctx.fill();
  } else if (beard === 'stubble') ell(ctx, cx + 3.4, y + 5.2, 4, 2.4, 'rgba(40,30,25,0.22)');
  ctx.strokeStyle = beard === 'beard' ? '#f2e6e0' : '#7a2e2e';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx + 5.6, y + 5.1);
  ctx.quadraticCurveTo(cx + 6.6, y + 5.6, cx + 7.3, y + 4.9);
  ctx.stroke();
  if (beard === 'tache') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(cx + 6.2, y + 4.3, 1.8, 0.8, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  hairTop(ctx, L, 'side');
  accessoryHead(ctx, L, 'side');
}

// ------------------------------------------------------------------ hair
type View = 'front' | 'back' | 'side';
const longish = (h: HairStyle) => h === 'long' || h === 'braids';

/** Hair that hangs behind the body/head. */
function hairBehind(ctx: C, L: Look, v: View) {
  const h = L.a.hair;
  const y = HEAD_Y;
  ctx.fillStyle = L.hairDark;
  if (h === 'afro') {
    // drawn behind the head in every view
    afroBall(ctx, L, v === 'side' ? -0.6 : 0, y - 2.4, 12.2);
  } else if (h === 'curly' && v !== 'back') {
    for (const [x, yy, r] of [[-8, 0, 3.6], [8, 0, 3.6], [-7.2, 4, 3], [7.2, 4, 3]] as const) ell(ctx, (v === 'side' ? x * 0.4 - 2 : x), y + yy, r, r, L.hairDark);
  } else if (longish(h)) {
    if (v === 'front') {
      rrect(ctx, -HR - 1.3, y - 3, (HR + 1.3) * 2, 15.4, 4.5, L.hairDark);
      if (h === 'braids') {
        ctx.strokeStyle = shade(L.a.hairColor, -55);
        ctx.lineWidth = 0.6;
        for (let x = -HR; x <= HR; x += 2.2) limb(ctx, x, y, x, y + 12, 0.5, shade(L.a.hairColor, -55));
      }
    } else if (v === 'side') {
      rrect(ctx, -HR - 0.6, y - 4, HR + 1.5, 16.6, 4.5, L.hairDark);
    }
  }
}

function afroBall(ctx: C, L: Look, x: number, y: number, r: number) {
  ell(ctx, x, y, r, r * 0.94, L.hair);
  // knobbly outline for texture
  ctx.fillStyle = L.hair;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    ell(ctx, x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.88, 2.3, 2.3, L.hair);
  }
  // soft sheen on the upper-left, plus a few curl highlights
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.5, x - r * 0.35, y - r * 0.4, r * 0.8);
  g.addColorStop(0, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ell(ctx, x, y, r, r * 0.94, g);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 7; i++) {
    const a = i * 2.3;
    const cx = x + Math.cos(a) * r * 0.55;
    const cy = y + Math.sin(a) * r * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.4, Math.PI, Math.PI * 1.8);
    ctx.stroke();
  }
}

function hairTop(ctx: C, L: Look, v: View) {
  const h = L.a.hair;
  const y = HEAD_Y;
  const acc = L.a.accessory;
  const hidden = acc === 'beanie' || acc === 'flatcap';
  const hair = L.hair;
  const grad = (x0: number, x1: number) => hgrad(ctx, x0, x1, L.hairLight, hair, L.hairDark);
  if (h === 'bald') {
    if (!hidden && v !== 'back') ell(ctx, v === 'side' ? 2.6 : -2.6, y - 5, 2.3, 1.3, 'rgba(255,255,255,0.32)', -0.4);
    return;
  }
  // a hat flattens a mohawk into an ordinary short crop
  if (h === 'mohawk' && (hidden || acc === 'cap')) return hairTop(ctx, { ...L, a: { ...L.a, hair: 'fade' } }, v);
  if (h === 'afro') {
    if (v === 'back') afroBall(ctx, L, 0, y - 2.4, 12.2);
    else if (v === 'front') {
      // hairline arc framing the face
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.ellipse(0, y - 3.2, HR + 0.6, 6.4, 0, Math.PI, 0);
      ctx.fill();
    } else {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.ellipse(-1, y - 2.6, HR + 0.6, 7.2, 0, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
    }
    return;
  }
  if (v === 'back') {
    // full head of hair from behind
    if (h === 'mohawk') {
      ell(ctx, 0, y, HR, HRY, 'rgba(0,0,0,0.0)');
      rrect(ctx, -2.2, y - HRY - 4.4, 4.4, HRY * 2 + 1.4, 2.2, hair);
      return;
    }
    if (h === 'fade') {
      ell(ctx, 0, y - 0.6, HR + 0.2, HRY - 0.2, mix(L.a.hairColor, L.skin, 0.45));
      ell(ctx, 0, y - 2.4, HR, HRY - 2.4, grad(-HR, HR));
      return;
    }
    ell(ctx, 0, y - 0.3, HR + 0.5, HRY + 0.4, grad(-HR, HR));
    if (longish(h)) {
      rrect(ctx, -HR - 1.2, y - 2, (HR + 1.2) * 2, 15.4, 4.4, grad(-HR, HR));
      if (h === 'braids') for (let x = -HR + 1; x <= HR - 1; x += 2.3) limb(ctx, x, y - 1, x, y + 12.6, 0.55, L.hairDark);
    }
    if (h === 'ponytail') {
      rrect(ctx, -2.4, y + 2, 4.8, 11, 2.4, grad(-2.4, 2.4));
      rrect(ctx, -2.6, y + 1.2, 5.2, 1.6, 0.7, '#e74c3c');
    }
    if (h === 'bun') ell(ctx, 0, y - HRY - 1.4, 4.4, 4, grad(-4.4, 4.4));
    if (h === 'curly') for (let i = 0; i < 10; i++) ell(ctx, -7 + (i % 5) * 3.5, y - 4 + Math.floor(i / 5) * 6, 2.6, 2.6, i % 2 ? L.hairDark : hair);
    return;
  }
  if (v === 'side') {
    if (h === 'mohawk') {
      ctx.fillStyle = mix(L.a.hairColor, L.skin, 0.6);
      ctx.beginPath();
      ctx.ellipse(0.4, y - 2, HR - 0.6, 6.2, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(-6.4, y - 4);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(-5.4 + i * 3, y - 14.4 + Math.abs(i - 2) * 1.2);
        ctx.lineTo(-4 + i * 3, y - 8);
      }
      ctx.lineTo(7.6, y - 6);
      ctx.closePath();
      ctx.fill();
      return;
    }
    const tight = h === 'fade' || h === 'bun' || h === 'ponytail';
    ctx.fillStyle = grad(-HR, HR);
    ctx.beginPath();
    ctx.moveTo(-HR + 0.2, y + (tight ? 1.5 : 3.2));
    ctx.quadraticCurveTo(-HR - 0.8, y - HRY - 0.4, 1, y - HRY - (tight ? 0.5 : 1.3));
    ctx.quadraticCurveTo(HR + 1.4, y - HRY + 0.4, HR + 0.6, y - 2.6);
    ctx.quadraticCurveTo(4.6, y - 4.8, 2.4, y - 2.4);
    ctx.quadraticCurveTo(0.6, y - 0.2, -1.2, y + (tight ? 1.5 : 3.6));
    ctx.closePath();
    ctx.fill();
    if (h === 'fade') ell(ctx, -3, y + 0.5, 4, 3, mix(L.a.hairColor, L.skin, 0.5));
    if (h === 'bun') ell(ctx, -4.6, y - HRY + 0.6, 4.2, 4, grad(-8.6, -0.6));
    if (h === 'ponytail') {
      ctx.fillStyle = grad(-12, -4);
      ctx.beginPath();
      ctx.moveTo(-7, y - 3.4);
      ctx.quadraticCurveTo(-14, y + 1, -10.4, y + 10);
      ctx.quadraticCurveTo(-9.4, y + 3, -5.4, y - 0.6);
      ctx.closePath();
      ctx.fill();
      rrect(ctx, -8.2, y - 4.4, 2.2, 3, 0.6, '#e74c3c');
    }
    if (h === 'curly') for (let i = 0; i < 6; i++) ell(ctx, -6 + i * 2.6, y - HRY + 1 + (i % 2) * 1.4, 2.4, 2.4, i % 2 ? L.hairDark : hair);
    if (longish(h)) {
      rrect(ctx, -HR - 0.6, y - 2, 5.2, 13.6, 2.6, grad(-HR, -HR + 5));
      if (h === 'braids') ell(ctx, -HR + 2, y + 11.6, 1.1, 1.1, '#f1c40f');
    }
    return;
  }
  // ---- front
  if (h === 'mohawk') {
    // shaved sides
    ctx.fillStyle = mix(L.a.hairColor, L.skin, 0.62);
    ctx.beginPath();
    ctx.ellipse(0, y - 2.4, HR, 6.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = grad(-3, 3);
    ctx.beginPath();
    ctx.moveTo(-2.8, y - 4.6);
    ctx.lineTo(-2.2, y - 13);
    ctx.lineTo(0, y - 16.2);
    ctx.lineTo(2.2, y - 13);
    ctx.lineTo(2.8, y - 4.6);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const tight = h === 'fade' || h === 'bun' || h === 'ponytail';
  // the cap of hair
  ctx.fillStyle = grad(-HR, HR);
  ctx.beginPath();
  ctx.moveTo(-HR - 0.4, y + (tight ? -0.4 : 1.6));
  ctx.quadraticCurveTo(-HR - 0.8, y - HRY - 1.2, 0, y - HRY - (tight ? 0.6 : 1.4));
  ctx.quadraticCurveTo(HR + 0.8, y - HRY - 1.2, HR + 0.4, y + (tight ? -0.4 : 1.6));
  // fringe edge
  if (h === 'short' || h === 'curly') {
    ctx.lineTo(HR - 1.4, y - 2.6);
    ctx.quadraticCurveTo(HR - 3, y - 4.6, 3.4, y - 3.6);
    ctx.quadraticCurveTo(1.6, y - 5.4, -0.2, y - 3.6);
    ctx.quadraticCurveTo(-2.4, y - 5.6, -4.4, y - 3.4);
    ctx.quadraticCurveTo(-6.8, y - 4.4, -HR + 1.4, y - 2.6);
  } else if (longish(h)) {
    // centre parting, curtains down the sides
    ctx.lineTo(HR - 0.6, y + 8);
    ctx.lineTo(HR - 2.6, y + 8);
    ctx.quadraticCurveTo(HR - 3.6, y - 3.8, 0.4, y - 6.4);
    ctx.lineTo(-0.4, y - 6.4);
    ctx.quadraticCurveTo(-HR + 3.6, y - 3.8, -HR + 2.6, y + 8);
    ctx.lineTo(-HR + 0.6, y + 8);
  } else {
    // swept back / fade: a clean hairline
    ctx.quadraticCurveTo(HR - 1, y - 4.6, 0, y - 5.8);
    ctx.quadraticCurveTo(-HR + 1, y - 4.6, -HR - 0.4, y - 0.4);
  }
  ctx.closePath();
  ctx.fill();
  if (h === 'fade') {
    ctx.fillStyle = mix(L.a.hairColor, L.skin, 0.55);
    ctx.fillRect(-HR - 0.3, y - 2.6, 2, 2.6);
    ctx.fillRect(HR - 1.7, y - 2.6, 2, 2.6);
  }
  if (h === 'curly') {
    for (let i = 0; i < 7; i++) ell(ctx, -6.6 + i * 2.2, y - 4.6 - (i % 2) * 1.2, 2.1, 2.1, i % 2 ? hair : L.hairDark);
  }
  if (h === 'bun') ell(ctx, 0, y - HRY - 2.6, 4.4, 4, grad(-4.4, 4.4));
  if (h === 'ponytail') ell(ctx, HR - 0.6, y - 1, 2.4, 3.6, L.hairDark);
  if (h === 'braids') {
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) ell(ctx, s * (HR - 1.4), y + 1.4 + k * 2.4, 1.3, 1.3, k === 2 ? '#f1c40f' : L.hairDark);
  }
  // shine
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(-1.6, y - 2, 6.6, Math.PI * 1.18, Math.PI * 1.42);
  ctx.stroke();
}

// ------------------------------------------------------------------ accessories
function accessoryHead(ctx: C, L: Look, v: View) {
  const acc = L.a.accessory;
  const y = HEAD_Y;
  const col = shade(L.a.outfitColor, -22);
  if (acc === 'cap') {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(v === 'side' ? 0.6 : 0, y - 3.2, HR + 0.5, 6.8, 0, Math.PI, 0);
    ctx.fill();
    ell(ctx, v === 'side' ? 0.6 : 0, y - 9.6, 1, 0.8, shade(L.a.outfitColor, 20));
    if (v === 'front') rrect(ctx, -HR + 0.4, y - 4.4, (HR - 0.4) * 2, 2.6, 1.2, shade(L.a.outfitColor, -40));
    else if (v === 'side') rrect(ctx, 2, y - 4.4, 9.4, 2.2, 1, shade(L.a.outfitColor, -40));
  } else if (acc === 'beanie') {
    const c = L.seed & 8 ? '#c0392b' : '#2e86c1';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(v === 'side' ? 0.6 : 0, y - 2.6, HR + 0.9, 8.4, 0, Math.PI, 0);
    ctx.fill();
    rrect(ctx, -HR - 0.9 + (v === 'side' ? 0.6 : 0), y - 4.2, (HR + 0.9) * 2, 3.4, 1.4, shade(c, -30));
    ell(ctx, v === 'side' ? 0 : 0, y - 12.2, 2.6, 2.6, '#f4f4f4');
  } else if (acc === 'flatcap') {
    const c = '#6b5d4f';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(v === 'side' ? 1.4 : 0, y - 4, HR + 1, 5.6, v === 'side' ? 0.12 : 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = shade(c, -30);
    ctx.lineWidth = 0.5;
    for (let i = -6; i <= 6; i += 3) limb(ctx, i, y - 8.4, i + 1, y - 4.4, 0.4, shade(c, -24));
    if (v === 'front') rrect(ctx, -HR + 0.6, y - 4.6, (HR - 0.6) * 2, 1.8, 0.9, shade(c, -36));
    if (v === 'side') rrect(ctx, 3.6, y - 4.6, 6.6, 1.8, 0.9, shade(c, -36));
  } else if (acc === 'glasses' && v !== 'back') {
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 0.9;
    if (v === 'front') {
      ctx.beginPath();
      ctx.roundRect(-5.6, y - 1.6, 4.6, 3.8, 1);
      ctx.roundRect(1, y - 1.6, 4.6, 3.8, 1);
      ctx.moveTo(-1, y - 0.4);
      ctx.lineTo(1, y - 0.4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(180,220,255,0.18)';
      ctx.fillRect(-5.4, y - 1.4, 4.2, 3.4);
      ctx.fillRect(1.2, y - 1.4, 4.2, 3.4);
    } else {
      ctx.beginPath();
      ctx.roundRect(3.2, y - 1.4, 3.8, 3.6, 1);
      ctx.moveTo(3.2, y - 0.2);
      ctx.lineTo(-1.2, y - 0.4);
      ctx.stroke();
    }
  } else if (acc === 'headphones') {
    ctx.strokeStyle = '#26282e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    if (v === 'side') ctx.arc(-0.6, y - 1, 9.4, Math.PI * 1.1, Math.PI * 1.85);
    else ctx.arc(0, y - 0.6, 9.6, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    const c = L.seed & 16 ? '#e23b3b' : '#f1c40f';
    if (v === 'side') rrect(ctx, -3.4, y - 3.2, 4.6, 6.4, 2, c);
    else {
      rrect(ctx, -HR - 2.4, y - 3, 3.6, 6.6, 1.8, c);
      rrect(ctx, HR - 1.2, y - 3, 3.6, 6.6, 1.8, c);
    }
  }
}
function scarf(ctx: C, L: Look, back: boolean) {
  const c = L.seed & 32 ? '#c0392b' : '#1f6f8b';
  rrect(ctx, -5.2, -24.8, 10.4, 3.2, 1.5, c);
  if (!back) {
    rrect(ctx, 1.4, -22.6, 2.8, 7.4, 1, shade(c, -18));
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(1.4, -18.2, 2.8, 0.8);
  }
}
