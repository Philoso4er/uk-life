// Frame sequence of a pedestrian waiting at the kerb, a car stopping, and them crossing.
// Usage: node scripts/crossing.mjs <baseUrl> <outDir> [zebra|junction]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || 'shots/crossing';
const MODE = process.argv[4] || 'zebra';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await page.goto(BASE + '/?debug=1');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Move to Peckwell/ }).first().click();
await page.waitForTimeout(300);
await page.getByLabel('Character name').fill('Watcher');
await page.getByRole('button', { name: /Move to Peckwell →/ }).click();
await page.waitForTimeout(1500);
for (let i = 0; i < 4; i++) {
  const c = page.locator('.event-card .event-choice').first();
  if (!(await c.isVisible().catch(() => false))) break;
  await c.click();
  await page.waitForTimeout(250);
}
await page.locator('.guide-skip').click().catch(() => {});
await page.addStyleTag({ content: '.toasts{display:none!important}' });
const clip = await page.evaluate((mode) => {
  const u = window.__ukl;
  const e = u.engine;
  const t = u.london(Date.now() + u.getClockOffset());
  let d = (13 * 60 - (t.hh * 60 + t.mm)) * 60000;
  if (d < 0) d += 24 * 3600e3;
  u.setClockOffset(u.getClockOffset() + d);
  if (u.events) u.events.off = true;
  e.setRain?.(false);
  e.weatherAt = Infinity;
  const cx = mode === 'zebra' ? 31 : 22.5;
  e.teleport(cx + 3.2, 18.5);
  e.player.facing = 'down';
  // clear the stage
  e.bots.forEach((b, i) => {
    b.x = 2 + i;
    b.y = 44.5;
    b.path = [];
    b.wait = 1e9;
  });
  const b = e.bots.find((x) => x.ambient);
  b.avatar = { skin: '#c98e62', hair: 'ponytail', hairColor: '#4a2f1f', outfit: 'mac', outfitColor: '#2a9d8f', accessory: 'scarf', beard: 'none' };
  b.x = cx;
  b.y = 18.4;
  b.speed = 2;
  b.wait = 0;
  b.crossing = -1;
  b.kerb = 0;
  b.path = [{ x: cx, y: 23.3 }];
  // a car bearing down in the near (eastbound) lane, and another the other way
  const vs = e.vehicles.filter((v) => v.y > 15);
  vs.forEach((v, i) => {
    v.x = -30 - i * 6;
    v.cur = 0;
  });
  const east = vs.find((v) => v.dir > 0 && v.kind !== 'bus');
  east.x = cx - 9;
  east.cur = east.speed;
  const west = vs.find((v) => v.dir < 0 && v.kind !== 'bus');
  west.x = cx + 14;
  west.cur = west.speed;
  window.__crossBot = b;
  window.__crossX = cx;
  const left = e.cam.x - e.vw / 2 / e.zoom;
  const top = e.cam.y - e.vh / 2 / e.zoom;
  return { left, top, zoom: e.zoom };
}, MODE);
const frames = [];
for (let i = 0; i < 22; i++) {
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => {
    const e = window.__ukl.engine;
    const b = window.__crossBot;
    const left = e.cam.x - e.vw / 2 / e.zoom;
    const top = e.cam.y - e.vh / 2 / e.zoom;
    const X = (wx) => (wx * 32 - left) * e.zoom;
    const Y = (wy) => (wy * 32 - top) * e.zoom;
    const cx = window.__crossX;
    return { x0: X(cx - 5.5), x1: X(cx + 5.5), y0: Y(17.0), y1: Y(24.4), z: e.zoom, kerb: +b.kerb.toFixed(2), crossing: b.crossing, y: +b.y.toFixed(2), cars: e.vehicles.filter((v) => v.y > 15 && v.x > 0 && v.x < 60).map((v) => `${v.kind}@${v.x.toFixed(1)}:${v.cur.toFixed(1)}`).join(' ') };
  });
  const f = `${OUT}/${MODE}-${String(i).padStart(2, '0')}.png`;
  const x = Math.max(0, info.x0);
  const y = Math.max(0, info.y0);
  await page.screenshot({ path: f, clip: { x, y, width: Math.min(900, info.x1) - x, height: Math.min(600, info.y1) - y } });
  frames.push(f);
  console.log(f, JSON.stringify({ kerb: info.kerb, crossing: info.crossing, y: info.y, cars: info.cars }));
}
await browser.close();
