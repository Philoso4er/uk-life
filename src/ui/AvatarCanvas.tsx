import { useEffect, useRef } from 'react';
import { drawAvatar } from '../game/avatar';
import type { Avatar, Facing } from '../game/types';

export function AvatarCanvas({ avatar, size = 96, animate = false, facing = 'down', head = false }: { avatar: Avatar; size?: number; animate?: boolean; facing?: Facing; head?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const avRef = useRef(avatar);
  avRef.current = avatar;
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    let raf = 0;
    const start = performance.now();
    const order: Facing[] = ['down', 'right', 'up', 'left'];
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      // `head`: a close-up of the face (for little people lists)
      const s = (size / (head ? 26 : 54)) * dpr;
      ctx.setTransform(s, 0, 0, s, (size / 2) * dpr, head ? (size * 0.5 + 37 * (size / 26)) * dpr : size * 0.9 * dpr);
      const f = animate ? order[Math.floor(t / 2) % 4] : facing;
      drawAvatar(ctx, avRef.current, { facing: f, moving: animate && f !== 'down', t });
      if (animate) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, animate, facing, avatar, head]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label="Avatar preview" className={head ? 'av-head' : undefined} />;
}
