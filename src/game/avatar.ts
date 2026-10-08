import type { Accessory, Avatar, Facing, HairStyle, OutfitStyle } from './types';

export const SKINS = ['#f5d2b8', '#e8b58f', '#c98e62', '#a86b45', '#7a4a2c', '#4f2f1c'];
export const HAIR_COLOURS = ['#1b1b1b', '#4a2f1f', '#8a5a2b', '#d9b44a', '#b8462a', '#9aa0a6', '#e05fa8', '#3a7bd5'];
export const OUTFIT_COLOURS = ['#2d5bd1', '#d13b3b', '#1f8a5b', '#f2a03d', '#7a3fd1', '#222831', '#e6e6e6', '#ff6fa8'];
export const HAIRS: HairStyle[] = ['short', 'long', 'bun', 'afro', 'braids', 'mohawk', 'bald'];
export const OUTFITS: OutfitStyle[] = ['hoodie', 'puffer', 'tracksuit', 'suit', 'dress', 'hivis'];
export const ACCESSORIES: Accessory[] = ['none', 'cap', 'beanie', 'glasses', 'headphones'];

export const OUTFIT_LABEL: Record<OutfitStyle, string> = {
  hoodie: 'Hoodie',
  puffer: 'Puffer',
  tracksuit: 'Trackie',
  suit: 'Suit',
  dress: 'Dress',
  hivis: 'Hi-vis',
};
export const HAIR_LABEL: Record<HairStyle, string> = {
  short: 'Short',
  long: 'Long',
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
  glasses: 'Specs',
  headphones: 'Cans',
};

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const randomAvatar = (): Avatar => ({
  skin: pick(SKINS),
  hair: pick(HAIRS),
  hairColor: pick(HAIR_COLOURS.slice(0, 6)),
  outfit: pick(OUTFITS),
  outfitColor: pick(OUTFIT_COLOURS),
  accessory: pick(ACCESSORIES),
});

export function sanitizeAvatar(a: unknown): Avatar {
  const o = (a ?? {}) as Partial<Avatar>;
  const hex = (v: unknown, fb: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fb);
  return {
    skin: hex(o.skin, SKINS[1]),
    hair: HAIRS.includes(o.hair as HairStyle) ? (o.hair as HairStyle) : 'short',
    hairColor: hex(o.hairColor, HAIR_COLOURS[0]),
    outfit: OUTFITS.includes(o.outfit as OutfitStyle) ? (o.outfit as OutfitStyle) : 'hoodie',
    outfitColor: hex(o.outfitColor, OUTFIT_COLOURS[0]),
    accessory: ACCESSORIES.includes(o.accessory as Accessory) ? (o.accessory as Accessory) : 'none',
  };
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `rgb(${r},${g},${b})`;
}

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

export interface DrawOpts {
  facing: Facing;
  moving: boolean;
  t: number; // seconds, for animation
  bike?: boolean;
  umbrella?: boolean;
}

/**
 * Draws an avatar with its feet at (0,0) in a 32px-per-tile space.
 * Roughly 18px wide and 40px tall.
 */
export function drawAvatar(ctx: CanvasRenderingContext2D, a: Avatar, o: DrawOpts) {
  const walk = o.moving ? Math.sin(o.t * 14) : 0;
  const bob = o.moving ? Math.abs(Math.sin(o.t * 14)) * -1.5 : Math.sin(o.t * 2) * 0.4;
  const side = o.facing === 'left' ? -1 : o.facing === 'right' ? 1 : 0;
  const back = o.facing === 'up';
  const dark = shade(a.outfitColor, -45);
  const light = shade(a.outfitColor, 35);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, o.bike ? 13 : 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (o.bike) {
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    if (side) {
      ctx.beginPath();
      ctx.arc(-9, -4, 5, 0, Math.PI * 2);
      ctx.arc(9, -4, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#19a974';
      ctx.beginPath();
      ctx.moveTo(-9, -4);
      ctx.lineTo(-2, -12);
      ctx.lineTo(6, -12);
      ctx.lineTo(9, -4);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1a1a1a';
      rr(ctx, -2, -9, 4, 10, 2);
      ctx.fillStyle = '#19a974';
      rr(ctx, -8, -16, 16, 2.5, 1);
    }
    // insulated delivery box (sideways: peeks out behind the rider)
    if (side) {
      ctx.fillStyle = '#19a974';
      rr(ctx, -side * 13 - 6, -32 + bob, 12, 12, 2);
      ctx.fillStyle = '#0f7652';
      ctx.fillRect(-side * 13 - 6, -27 + bob, 12, 2);
    }
  }

  ctx.save();
  ctx.translate(0, bob);

  // legs
  const legC = a.outfit === 'suit' ? '#1d1f24' : a.outfit === 'tracksuit' ? dark : '#2c3e66';
  ctx.fillStyle = legC;
  if (a.outfit !== 'dress') {
    rr(ctx, -6, -11 + (walk > 0 ? -walk * 1.5 : 0), 5, 10, 2);
    rr(ctx, 1, -11 + (walk < 0 ? walk * 1.5 : 0), 5, 10, 2);
  } else {
    ctx.fillStyle = a.skin;
    rr(ctx, -5, -8, 3.5, 7, 1.5);
    rr(ctx, 1.5, -8, 3.5, 7, 1.5);
  }
  // shoes
  ctx.fillStyle = a.outfit === 'tracksuit' ? '#ffffff' : '#141414';
  rr(ctx, -6.5, -2.5 + (walk > 0 ? -walk * 1.5 : 0), 6, 3, 1.5);
  rr(ctx, 0.5, -2.5 + (walk < 0 ? walk * 1.5 : 0), 6, 3, 1.5);

  // hood (behind head) for hoodie
  if (a.outfit === 'hoodie' && !back) {
    ctx.fillStyle = dark;
    rr(ctx, -7, -30, 14, 8, 4);
  }

  // torso
  const bodyW = a.outfit === 'puffer' ? 20 : 16;
  ctx.fillStyle = a.outfitColor;
  if (a.outfit === 'dress') {
    ctx.beginPath();
    ctx.moveTo(-6, -24);
    ctx.lineTo(6, -24);
    ctx.lineTo(10, -7);
    ctx.lineTo(-10, -7);
    ctx.closePath();
    ctx.fill();
  } else {
    rr(ctx, -bodyW / 2, -25, bodyW, 15, 5);
  }
  // arms
  const armSwing = o.moving ? walk * 2 : 0;
  ctx.fillStyle = a.outfit === 'hivis' ? a.outfitColor : a.outfit === 'dress' ? a.skin : a.outfitColor;
  if (side) {
    rr(ctx, -2.5 + armSwing * side, -23, 5, 12, 2.5);
  } else {
    rr(ctx, -bodyW / 2 - 3, -23 + armSwing, 4.5, 11, 2.2);
    rr(ctx, bodyW / 2 - 1.5, -23 - armSwing, 4.5, 11, 2.2);
  }
  // outfit details
  if (a.outfit === 'puffer') {
    ctx.fillStyle = dark;
    for (let i = 0; i < 3; i++) ctx.fillRect(-bodyW / 2 + 1, -21 + i * 4.2, bodyW - 2, 1.1);
  } else if (a.outfit === 'tracksuit') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-8, -24, 1.6, 13);
    ctx.fillRect(6.4, -24, 1.6, 13);
    if (!back) ctx.fillRect(-0.6, -24, 1.2, 13);
  } else if (a.outfit === 'suit' && !back) {
    ctx.fillStyle = '#f4f4f4';
    ctx.beginPath();
    ctx.moveTo(-3.5, -25);
    ctx.lineTo(3.5, -25);
    ctx.lineTo(0, -17);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-0.9, -23, 1.8, 6);
  } else if (a.outfit === 'hivis') {
    ctx.fillStyle = '#d7dde3';
    ctx.fillRect(-8, -19, 16, 1.6);
    ctx.fillRect(-8, -15, 16, 1.6);
    if (!back) {
      ctx.fillRect(-4.5, -25, 1.6, 7);
      ctx.fillRect(3, -25, 1.6, 7);
    }
  } else if (a.outfit === 'hoodie' && !back) {
    ctx.fillStyle = light;
    ctx.fillRect(-4, -15, 8, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2.5, -24, 0.9, 4);
    ctx.fillRect(1.6, -24, 0.9, 4);
  }

  // head
  const hx = side * 1.5;
  const hy = -31;
  ctx.fillStyle = a.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fill();

  drawHair(ctx, a, hx, hy, side, back);

  // face
  if (!back) {
    ctx.fillStyle = '#1b1b1b';
    if (side) {
      ctx.fillRect(hx + side * 4 - 1, hy - 0.5, 2, 2.4);
    } else {
      ctx.fillRect(hx - 3.6, hy - 0.5, 2, 2.4);
      ctx.fillRect(hx + 1.6, hy - 0.5, 2, 2.4);
    }
    ctx.fillStyle = 'rgba(220,90,90,0.35)';
    if (!side) {
      ctx.beginPath();
      ctx.arc(hx - 4.8, hy + 3, 1.6, 0, Math.PI * 2);
      ctx.arc(hx + 4.8, hy + 3, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawAccessory(ctx, a.accessory, hx, hy, side, back, a.outfitColor);

  if (o.bike && back) {
    // facing away: the big green box covers your back
    ctx.fillStyle = '#19a974';
    rr(ctx, -9, -30, 18, 15, 2);
    ctx.fillStyle = '#0f7652';
    ctx.fillRect(-9, -24, 18, 2);
  }
  ctx.restore();

  if (o.umbrella) {
    ctx.save();
    ctx.translate(side * 4, -44 + bob);
    ctx.fillStyle = '#1d1d1d';
    ctx.fillRect(-0.8, 0, 1.6, 12);
    ctx.fillStyle = '#2b4c9b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 7, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3b63c4';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 2.5, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }
}

function drawHair(ctx: CanvasRenderingContext2D, a: Avatar, hx: number, hy: number, side: number, back: boolean) {
  ctx.fillStyle = a.hairColor;
  const h = a.hair;
  if (h === 'bald') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(hx - 2.5, hy - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (h === 'afro') {
    ctx.beginPath();
    ctx.arc(hx, hy - 3, 11, 0, Math.PI * 2);
    ctx.fill();
    if (!back) {
      ctx.fillStyle = a.skin;
      ctx.beginPath();
      ctx.ellipse(hx + side * 2, hy + 2, 6.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (h === 'long' || h === 'braids') {
    // hair falling behind shoulders
    ctx.beginPath();
    ctx.roundRect(hx - 9, hy - 6, 18, back ? 20 : 17, 6);
    ctx.fill();
    if (h === 'braids') {
      ctx.fillStyle = shade(a.hairColor, 30);
      for (let i = -6; i <= 6; i += 3) ctx.fillRect(hx + i - 0.5, hy - 2, 1, 15);
      ctx.fillStyle = a.hairColor;
    }
  }
  if (back) {
    ctx.beginPath();
    ctx.arc(hx, hy, 8.4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // top cap of hair
    ctx.beginPath();
    ctx.arc(hx, hy - 1, 8.5, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(hx + 8.5, hy - 1);
    ctx.closePath();
    ctx.fill();
    // fringe
    ctx.beginPath();
    ctx.ellipse(hx - side * 2, hy - 4, 7.5, 3.4, side * 0.3, 0, Math.PI * 2);
    ctx.fill();
    if (h === 'long' || h === 'braids') {
      ctx.fillRect(hx - 8.5, hy - 3, 3, 10);
      ctx.fillRect(hx + 5.5, hy - 3, 3, 10);
    }
    if (h === 'mohawk') {
      ctx.fillStyle = a.skin;
      ctx.beginPath();
      ctx.ellipse(hx - 5.5, hy - 4, 3, 4, 0, 0, Math.PI * 2);
      ctx.ellipse(hx + 5.5, hy - 4, 3, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (h === 'bun') {
    ctx.fillStyle = a.hairColor;
    ctx.beginPath();
    ctx.arc(hx, hy - 10, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (h === 'mohawk') {
    ctx.fillStyle = a.hairColor;
    ctx.beginPath();
    ctx.moveTo(hx - 2.5, hy - 7);
    ctx.lineTo(hx, hy - 15);
    ctx.lineTo(hx + 2.5, hy - 7);
    ctx.fill();
  }
}

function drawAccessory(ctx: CanvasRenderingContext2D, acc: Accessory, hx: number, hy: number, side: number, back: boolean, colour: string) {
  if (acc === 'cap') {
    ctx.fillStyle = shade(colour, -20);
    ctx.beginPath();
    ctx.arc(hx, hy - 2, 8.6, Math.PI, 0);
    ctx.fill();
    if (!back) {
      ctx.beginPath();
      ctx.ellipse(hx + side * 6, hy - 2, side ? 6 : 8.5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (acc === 'beanie') {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(hx, hy - 2, 8.8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(hx - 8.8, hy - 3.5, 17.6, 3);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx, hy - 11, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (acc === 'glasses' && !back) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (side) {
      ctx.rect(hx + side * 4 - 2.5, hy - 1.5, 5, 4);
    } else {
      ctx.rect(hx - 5.2, hy - 1.6, 4.6, 4);
      ctx.rect(hx + 0.6, hy - 1.6, 4.6, 4);
      ctx.moveTo(hx - 0.6, hy);
      ctx.lineTo(hx + 0.6, hy);
    }
    ctx.stroke();
  } else if (acc === 'headphones') {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy - 1, 9, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#e23b3b';
    if (side) rr(ctx, hx - side * 2 - 2.5, hy - 3, 5, 7, 2);
    else {
      rr(ctx, hx - 10.5, hy - 3, 4, 7, 2);
      rr(ctx, hx + 6.5, hy - 3, 4, 7, 2);
    }
  }
}
