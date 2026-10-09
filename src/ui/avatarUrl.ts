import { drawAvatar } from '../game/avatar';
import type { Avatar } from '../game/types';

// Feed and message lists show lots of little faces; draw each one once and reuse it as an image.
const cache = new Map<string, string>();
export function avatarUrl(a: Avatar, size = 40): string {
  const key = size + JSON.stringify(a);
  let url = cache.get(key);
  if (url) return url;
  const c = document.createElement('canvas');
  const dpr = 2;
  c.width = c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  // head-and-shoulders crop: scale up and push the body down
  const s = (size / 30) * dpr;
  ctx.setTransform(s, 0, 0, s, (size / 2) * dpr, size * 1.42 * dpr);
  drawAvatar(ctx, a, { facing: 'down', moving: false, t: 0 });
  url = c.toDataURL();
  if (cache.size > 200) cache.clear();
  cache.set(key, url);
  return url;
}
