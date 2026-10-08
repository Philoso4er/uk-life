import { useEffect, useRef } from 'react';
import { drawAvatar } from '../game/avatar';
import type { Avatar, Facing } from '../game/types';

export function AvatarCanvas({ avatar, size = 96, animate = false, facing = 'down' }: { avatar: Avatar; size?: number; animate?: boolean; facing?: Facing }) {
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
      const s = (size / 48) * dpr;
      ctx.setTransform(s, 0, 0, s, (size / 2) * dpr, size * 0.86 * dpr);
      const f = animate ? order[Math.floor(t / 1.6) % 4] : facing;
      drawAvatar(ctx, avRef.current, { facing: f, moving: animate && Math.floor(t / 1.6) % 2 === 1, t });
      if (animate) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size, animate, facing, avatar]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label="Avatar preview" />;
}
