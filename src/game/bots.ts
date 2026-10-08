import { randomAvatar } from './avatar';
import { findPath } from './pathfind';
import type { Avatar, Facing } from './types';
import { NPC_SPOTS } from './world';

export const BOT_NAMES = ['Big Tel', 'Auntie Bev', 'Tomasz', 'Priya', 'Gary & dog', 'Josh (Fleecems)', 'Nan', 'Kev', 'Siobhan', 'Femi', 'Hamza', 'Posh Rupert'];

export const BOT_LINES = [
  'Is it me or has it rained every day since 2009',
  '£7.20 for a pint?? In THIS economy??',
  'Anyone know if the 436 is running or is it vibes only',
  'Just watched a fox eat a whole kebab. Respect.',
  'Crumbs & Co. out of vegan sausage rolls AGAIN',
  'My landlord put the rent up again lol. lmao even',
  'Signal failure at Albion Road. Standard.',
  'Lovely weather for ducks',
  'Who keeps putting trolleys in the pond',
  'Proper nippy out today innit',
  'Jobcentre just called number 14. I am number 412.',
  'Meal deal and a sit in the park. Living the dream.',
  'Viewing a "studio" later. It is a cupboard with a hob.',
  'Sorry. Sorry. No, sorry, my fault. Sorry.',
  'Cheers drive!',
  'Did anyone else get the council tax letter or just me',
  'PFC wings at 2am hit different',
  'Mind the gap ladies and gents',
  'The Leaky Brolly quiz tonight, who\u2019s in',
  'Can\u2019t complain. (Proceeds to complain for 20 mins)',
  'You alright? Yeah you? Yeah. Good. Good good.',
  'Fancy a cuppa? Course you do.',
];

export interface Bot {
  id: string;
  name: string;
  avatar: Avatar;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  path: { x: number; y: number }[];
  wait: number;
  speed: number;
  bubble?: { text: string; until: number };
}

export function makeBots(n: number): Bot[] {
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
  return names.map((name, i) => {
    const s = NPC_SPOTS[(i * 5) % NPC_SPOTS.length];
    return { id: 'npc-' + i, name, avatar: randomAvatar(), x: s.x, y: s.y, facing: 'down', moving: false, path: [], wait: Math.random() * 3, speed: 1.6 + Math.random() * 1.1 };
  });
}

export function updateBot(b: Bot, dt: number) {
  if (b.wait > 0) {
    b.wait -= dt;
    b.moving = false;
    return;
  }
  if (!b.path.length) {
    const target = NPC_SPOTS[Math.floor(Math.random() * NPC_SPOTS.length)];
    const p = findPath(b.x, b.y, target.x + (Math.random() - 0.5) * 0.6, target.y);
    b.path = p ?? [];
    if (!b.path.length) b.wait = 1;
    return;
  }
  const t = b.path[0];
  const dx = t.x - b.x;
  const dy = t.y - b.y;
  const d = Math.hypot(dx, dy);
  const step = b.speed * dt;
  if (d <= step) {
    b.x = t.x;
    b.y = t.y;
    b.path.shift();
    if (!b.path.length) b.wait = 2 + Math.random() * 7; // stop for a chat / to look at phone
  } else {
    b.x += (dx / d) * step;
    b.y += (dy / d) * step;
    b.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }
  b.moving = true;
}
