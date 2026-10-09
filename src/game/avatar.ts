import type { Accessory, Avatar, Beard, Facing, Gender, HairStyle, OutfitStyle } from './types';
import { defaultPronouns, isGender, isPronouns } from './pronouns';
import { BLINK, IDLE0, PHONE, WALK_FRAMES, avatarSeed, drawCharacter, type Dir } from './character';

export const SKINS = ['#fbe0cc', '#f5d2b8', '#eabd98', '#d9a37a', '#c98e62', '#a86b45', '#8c5634', '#6e3f25', '#4f2f1c'];
export const HAIR_COLOURS = ['#1b1b1b', '#4a2f1f', '#8a5a2b', '#d9b44a', '#b8462a', '#9aa0a6', '#e05fa8', '#3a7bd5'];
export const OUTFIT_COLOURS = ['#2d5bd1', '#d13b3b', '#1f8a5b', '#f2a03d', '#7a3fd1', '#222831', '#e6e6e6', '#ff6fa8', '#2a9d8f', '#8d6e63'];
export const HAIRS: HairStyle[] = ['short', 'fade', 'curly', 'long', 'ponytail', 'bun', 'afro', 'braids', 'mohawk', 'bald'];
export const OUTFITS: OutfitStyle[] = ['hoodie', 'puffer', 'tracksuit', 'suit', 'dress', 'hivis', 'mac', 'knit', 'football'];
export const ACCESSORIES: Accessory[] = ['none', 'cap', 'beanie', 'flatcap', 'glasses', 'headphones', 'scarf'];
export const BEARDS: Beard[] = ['none', 'stubble', 'beard', 'tache'];

export const OUTFIT_LABEL: Record<OutfitStyle, string> = {
  hoodie: 'Hoodie',
  puffer: 'Puffer',
  tracksuit: 'Trackie',
  suit: 'Suit',
  dress: 'Dress',
  hivis: 'Hi-vis',
  mac: 'Mac',
  knit: 'Jumper',
  football: 'Kit',
};
export const HAIR_LABEL: Record<HairStyle, string> = {
  short: 'Short',
  fade: 'Fade',
  curly: 'Curly',
  long: 'Long',
  ponytail: 'Ponytail',
  bun: 'Bun',
  afro: 'Afro',
  braids: 'Braids',
  mohawk: 'Mohawk',
  bald: 'Bald',
};
export const ACC_LABEL: Record<Accessory, string> = {
  none: 'None',
  cap: 'Cap',
  beanie: 'Beanie',
  flatcap: 'Flat cap',
  glasses: 'Specs',
  headphones: 'Cans',
  scarf: 'Scarf',
};
export const BEARD_LABEL: Record<Beard, string> = { none: 'None', stubble: 'Stubble', beard: 'Beard', tache: 'Tache' };

const pick = <T,>(a: T[], r: () => number = Math.random) => a[Math.floor(r() * a.length)];
/** Small deterministic PRNG so a name always maps to the same look. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function wpick<T>(items: [T, number][], r: () => number): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let x = r() * total;
  for (const [v, w] of items) {
    x -= w;
    if (x < 0) return v;
  }
  return items[items.length - 1][0];
}
// Likely (not exclusive!) styles per gender, used for random looks and NPCs. The creator allows anything.
const HAIR_WEIGHTS: Record<Gender, [HairStyle, number][]> = {
  male: [['short', 4], ['fade', 4], ['curly', 2], ['afro', 1.5], ['bald', 1.6], ['mohawk', 0.5], ['bun', 0.4], ['long', 0.3], ['braids', 0.4], ['ponytail', 0.2]],
  female: [['long', 4], ['ponytail', 3], ['bun', 2.4], ['braids', 2], ['curly', 1.8], ['afro', 1.5], ['short', 0.8], ['fade', 0.3], ['mohawk', 0.2], ['bald', 0.1]],
  other: [['short', 2], ['curly', 2], ['bun', 1.6], ['fade', 1.5], ['mohawk', 1.3], ['afro', 1.2], ['long', 1.1], ['braids', 0.9], ['ponytail', 0.8], ['bald', 0.5]],
};
const DRESS_WEIGHT: Record<Gender, number> = { male: 0, female: 1.6, other: 0.4 };
/** Sensible starting points when you pick a gender in the creator (you can change any of them). */
export const GENDER_DEFAULTS: Record<Gender, Pick<Avatar, 'hair' | 'beard'>> = {
  male: { hair: 'short', beard: 'stubble' },
  female: { hair: 'long', beard: 'none' },
  other: { hair: 'curly', beard: 'none' },
};
/** Switch gender: sets pronouns to match, and moves the look to that gender's defaults. */
export function withGender(a: Avatar, g: Gender): Avatar {
  const out: Avatar = { ...a, gender: g, pronouns: defaultPronouns(g), ...GENDER_DEFAULTS[g] };
  if (g === 'male' && a.outfit === 'dress') out.outfit = 'hoodie';
  return out;
}

/** A random look. Gender is picked first (roughly 44% men, 44% women, 12% non-binary) unless given. */
export const randomAvatar = (r: () => number = Math.random, g?: Gender): Avatar => {
  const roll = r();
  const gender: Gender = g ?? (roll < 0.44 ? 'male' : roll < 0.88 ? 'female' : 'other');
  const hair = wpick(HAIR_WEIGHTS[gender], r);
  const outfit = wpick<OutfitStyle>(OUTFITS.map((o) => [o, o === 'dress' ? DRESS_WEIGHT[gender] : 1]), r);
  return {
    gender,
    pronouns: defaultPronouns(gender),
    skin: pick(SKINS, r),
    hair,
    hairColor: r() < 0.85 ? pick(HAIR_COLOURS.slice(0, 6), r) : pick(HAIR_COLOURS, r),
    outfit,
    outfitColor: pick(OUTFIT_COLOURS, r),
    accessory: r() < 0.4 ? 'none' : pick(ACCESSORIES, r),
    beard: gender === 'male' && r() < 0.55 ? wpick<Beard>([['stubble', 3], ['beard', 2], ['tache', 1]], r) : 'none',
  };
};
/** The same name always gets the same face (bots, feed posts, DMs all agree). Pass a gender for named locals. */
export const avatarForName = (name: string, g?: Gender): Avatar => randomAvatar(rng(hashString(name.toLowerCase())), g);

export function sanitizeAvatar(a: unknown): Avatar {
  const o = (a ?? {}) as Partial<Avatar>;
  const hex = (v: unknown, fb: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fb);
  return {
    skin: hex(o.skin, SKINS[2]),
    hair: HAIRS.includes(o.hair as HairStyle) ? (o.hair as HairStyle) : 'short',
    hairColor: hex(o.hairColor, HAIR_COLOURS[0]),
    outfit: OUTFITS.includes(o.outfit as OutfitStyle) ? (o.outfit as OutfitStyle) : 'hoodie',
    outfitColor: hex(o.outfitColor, OUTFIT_COLOURS[0]),
    accessory: ACCESSORIES.includes(o.accessory as Accessory) ? (o.accessory as Accessory) : 'none',
    beard: BEARDS.includes(o.beard as Beard) ? (o.beard as Beard) : 'none',
    // older saves/clients have no gender: Other with they/them until the player says otherwise
    gender: isGender(o.gender) ? o.gender : 'other',
    pronouns: isPronouns(o.pronouns) ? o.pronouns : defaultPronouns(isGender(o.gender) ? o.gender : 'other'),
  };
}

export interface DrawOpts {
  facing: Facing;
  moving: boolean;
  t: number; // seconds, for animation
  bike?: boolean;
  umbrella?: boolean;
  /** idle pose: glance at the phone */
  phone?: boolean;
}

/** Walk cycle: 8 frames over ~0.46s, matching the old sin(t*14) stride. */
export const walkFrame = (t: number) => Math.floor(t * 17.4) % WALK_FRAMES;

export function frameFor(a: Avatar, o: DrawOpts): number {
  if (o.moving) return walkFrame(o.t);
  const seed = avatarSeed(a);
  // blink for ~0.12s every ~3.7s, phase-shifted per character
  const bt = (o.t + (seed % 997) / 271) % 3.7;
  if (bt < 0.12) return BLINK;
  if (o.phone) return PHONE;
  return IDLE0 + (Math.floor((o.t + (seed % 13) * 0.2) * 2) % 4);
}

// ---------------------------------------------------------------- sprite cache
// Each (look, direction, frame, scale) is drawn once into a small canvas with an outline, then blitted.
const CELL_W = 48;
const CELL_H = 64;
const OX = 24;
const OY = 58;
const MAX_CELLS = 420;
const cells = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
// Limit how many new sprite cells get baked per ~16ms so a crowd arriving never causes a hitch;
// anything over budget is drawn directly as vectors for that frame instead.
let budget = 0;
let budgetSlot = -1;
const BUDGET = 5;
export function clearSpriteCache() {
  cells.clear();
}
export const spriteCacheSize = () => cells.size;

const avKey = (a: Avatar) => `${a.skin}${a.hair}${a.hairColor}${a.outfit}${a.outfitColor}${a.accessory}${a.beard ?? 'none'}${a.gender ?? 'other'}`;
function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;

function bake(a: Avatar, dir: Dir, frame: number, scale: number) {
  const w = Math.ceil(CELL_W * scale);
  const h = Math.ceil(CELL_H * scale);
  if (!scratch || scratch.width < w || scratch.height < h) scratch = makeCanvas(w, h);
  const sc = scratch.getContext('2d') as CanvasRenderingContext2D;
  sc.setTransform(1, 0, 0, 1, 0, 0);
  sc.clearRect(0, 0, scratch.width, scratch.height);
  sc.setTransform(scale, 0, 0, scale, OX * scale, OY * scale);
  drawCharacter(sc, a, dir, frame);
  const cell = makeCanvas(w, h);
  const cc = cell.getContext('2d') as CanvasRenderingContext2D;
  // soft dark silhouette outline so characters pop off any background
  const o = Math.max(1, Math.round(scale * 0.75));
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]]) cc.drawImage(scratch, 0, 0, w, h, dx, dy, w, h);
  cc.globalCompositeOperation = 'source-in';
  cc.fillStyle = 'rgba(28,22,30,0.82)';
  cc.fillRect(0, 0, w, h);
  cc.globalCompositeOperation = 'source-over';
  cc.drawImage(scratch, 0, 0, w, h, 0, 0, w, h);
  return cell;
}

function getCell(a: Avatar, dir: Dir, frame: number, scale: number) {
  const key = `${avKey(a)}|${dir}|${frame}|${scale}`;
  const hit = cells.get(key);
  if (hit) {
    // refresh LRU position
    cells.delete(key);
    cells.set(key, hit);
    return hit;
  }
  const slot = Math.floor((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 16);
  if (slot !== budgetSlot) {
    budgetSlot = slot;
    budget = BUDGET;
  }
  if (budget <= 0) return null;
  budget--;
  const cell = bake(a, dir, frame, scale);
  cells.set(key, cell);
  if (cells.size > MAX_CELLS) cells.delete(cells.keys().next().value!);
  return cell;
}

const canCache = typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined';

/** Draws the character (and shadow, bike, umbrella) with its feet at (0,0) in a 32px-per-tile space. */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: Avatar, o: DrawOpts) {
  const side = o.facing === 'left' ? -1 : o.facing === 'right' ? 1 : 0;
  const back = o.facing === 'up';
  const dir: Dir = side ? 'side' : back ? 'up' : 'down';
  const frame = frameFor(a, o);
  const bob = o.moving ? -Math.abs(Math.sin(o.t * 14)) * 1 : 0;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.ellipse(0, 0, o.bike ? 13 : 8.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (o.bike) drawBikeUnder(ctx, side, back);

  const m = ctx.getTransform();
  const sx = Math.hypot(m.a, m.b);
  // big previews (character creator) are baked fresh at full resolution rather than cached
  const big = sx > 2.75;
  const scale = big ? Math.ceil(sx * 2) / 2 : Math.max(1, Math.round(sx * 2) / 2);
  const cell = canCache ? (big ? bake(a, dir, frame, scale) : getCell(a, dir, frame, scale)) : null;
  ctx.save();
  if (side < 0) ctx.scale(-1, 1);
  if (cell) ctx.drawImage(cell, 0, 0, cell.width, cell.height, -OX, -OY, cell.width / scale, cell.height / scale);
  else drawCharacter(ctx, a, dir, frame);
  ctx.restore();

  if (o.bike) drawBikeOver(ctx, side, back, bob);
  if (o.umbrella) {
    ctx.save();
    ctx.translate(side * 5, -47 + bob);
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.stroke();
    const g = ctx.createLinearGradient(-16, 0, 16, 0);
    g.addColorStop(0, '#3b63c4');
    g.addColorStop(1, '#22408a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-17, 2);
    ctx.quadraticCurveTo(0, -12, 17, 2);
    for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(-17 + i * 6.8 + 3.4, -0.6, -17 + i * 6.8, 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-8, 1);
    ctx.moveTo(0, -5);
    ctx.lineTo(8, 1);
    ctx.stroke();
    ctx.restore();
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, c: string) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function drawBikeUnder(ctx: CanvasRenderingContext2D, side: number, back: boolean) {
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  if (side) {
    ctx.beginPath();
    ctx.arc(-10, -5, 5.2, 0, Math.PI * 2);
    ctx.moveTo(15.2, -5);
    ctx.arc(10, -5, 5.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#19a974';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-2, -13);
    ctx.lineTo(7, -13);
    ctx.lineTo(10, -5);
    ctx.moveTo(-2, -13);
    ctx.lineTo(0, -5);
    ctx.stroke();
    // box sits behind the rider
    ctx.save();
    ctx.scale(side, 1);
    rr(ctx, -20, -33, 13, 13, 2, '#19a974');
    rr(ctx, -20, -28, 13, 2, 0, '#0f7652');
    ctx.restore();
  } else {
    rr(ctx, -2, -9, 4, 10, 2, '#1a1a1a');
    if (!back) rr(ctx, -9, -17, 18, 2.5, 1, '#19a974');
  }
}
function drawBikeOver(ctx: CanvasRenderingContext2D, side: number, back: boolean, bob: number) {
  if (back && !side) {
    rr(ctx, -9.5, -33 + bob, 19, 16, 2.5, '#19a974');
    rr(ctx, -9.5, -26 + bob, 19, 2, 0, '#0f7652');
    ctx.fillStyle = '#e9fff4';
    ctx.font = '700 4px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PFC', 0, -20 + bob);
  }
}

/** Head-and-shoulders portrait for feed/DM avatars and the profile screen. */
export function drawPortrait(ctx: CanvasRenderingContext2D, a: Avatar, size: number) {
  // background disc tinted from the outfit colour
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, '#eef2f8');
  g.addColorStop(1, '#cfd8e6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();
  const s = size / 24;
  ctx.translate(size / 2, size * 1.72);
  ctx.scale(s, s);
  drawCharacter(ctx, a, 'down', IDLE0);
  ctx.restore();
}
export { PHONE };
