// Character line-up for before/after comparisons. Usage: node scripts/lineup.mjs <baseUrl> <outPng> [dir]
// Freezes the NPC walkers in a row on the high street pavement with a fixed set of looks.
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || 'shots/compare/lineup.png';
const DIR = process.argv[4] || 'down';
const LOOKS = [
  { skin: '#f5d2b8', hair: 'long', hairColor: '#d9b44a', outfit: 'dress', outfitColor: '#e05fa8', accessory: 'none' },
  { skin: '#4f2f1c', hair: 'afro', hairColor: '#1b1b1b', outfit: 'puffer', outfitColor: '#222831', accessory: 'headphones' },
  { skin: '#c98e62', hair: 'bun', hairColor: '#4a2f1f', outfit: 'suit', outfitColor: '#2d5bd1', accessory: 'glasses' },
  { skin: '#e8b58f', hair: 'short', hairColor: '#b8462a', outfit: 'hoodie', outfitColor: '#1f8a5b', accessory: 'cap' },
  { skin: '#7a4a2c', hair: 'braids', hairColor: '#1b1b1b', outfit: 'tracksuit', outfitColor: '#7a3fd1', accessory: 'none' },
  { skin: '#a86b45', hair: 'bald', hairColor: '#1b1b1b', outfit: 'hivis', outfitColor: '#f2a03d', accessory: 'none' },
  { skin: '#f5d2b8', hair: 'mohawk', hairColor: '#e05fa8', outfit: 'hoodie', outfitColor: '#d13b3b', accessory: 'beanie' },
  { skin: '#e8b58f', hair: 'short', hairColor: '#9aa0a6', outfit: 'suit', outfitColor: '#222831', accessory: 'glasses' },
];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE + '/?debug=1');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Move to Peckwell/ }).first().click();
await page.waitForTimeout(300);
await page.getByLabel('Character name').fill('Lineup');
await page.getByRole('button', { name: /Move to Peckwell →/ }).click();
await page.waitForTimeout(1500);
for (let i = 0; i < 4; i++) {
  const c = page.locator('.event-card .event-choice').first();
  if (!(await c.isVisible().catch(() => false))) break;
  await c.click();
  await page.waitForTimeout(250);
}
const clip = await page.evaluate(([looks, dir]) => {
  const u = window.__ukl;
  const e = u.engine;
  // daylight: jump to 13:00 London
  const t = u.london(Date.now() + u.getClockOffset());
  let d = (13 * 60 - (t.hh * 60 + t.mm)) * 60000;
  if (d < 0) d += 24 * 3600e3;
  u.setClockOffset(u.getClockOffset() + d);
  if (u.events) u.events.off = true;
  e.teleport(36.2 + 4 * 1.15, 22.9);
  e.save.avatar = looks[0];
  // park the passers-by out of shot
  e.bots.filter((b) => b.ambient).forEach((b, i) => {
    b.x = 2 + i;
    b.y = 44.5;
    b.path = [];
    b.wait = 1e9;
  });
  const bots = e.bots.filter((b) => !b.ambient).slice(0, 7);
  const slots = [0, 1, 2, 3, 5, 6, 7];
  bots.forEach((b, i) => {
    b.x = 36.2 + slots[i] * 1.15;
    b.y = 22.9;
    b.path = [];
    b.wait = 1e9;
    b.avatar = looks[i + 1];
    b.facing = dir;
    b.name = ''; b.ambient = true;
  });
  e.player.x = 36.2 + 4 * 1.15;
  e.player.y = 22.9;
  e.player.facing = dir;
  e.touch();
  return null;
}, [LOOKS, DIR]);
await page.waitForTimeout(1500);

// characters sit around the screen centre
await page.screenshot({ path: OUT, clip: { x: 190, y: 300 - 95, width: 470, height: 140 } });
await browser.close();
console.log('wrote', OUT, clip ?? '');
