// Headless screenshot tour. Usage: node scripts/shots.mjs [baseUrl] [outDir]
// Needs a Chrome/Chromium: set CHROME=/path/to/chrome (defaults to /usr/bin/google-chrome).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '../uk-life-shots';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function tour(label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${label}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  const shot = (name) => page.screenshot({ path: `${OUT}/${label}-${name}.png` });
  const w = (ms) => page.waitForTimeout(ms);
  const dbg = (fn, arg) => page.evaluate(fn, arg);

  await page.goto(BASE + '/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await w(1200);
  await shot('01-title');

  await page.getByRole('button', { name: /Move to Peckwell/ }).click();
  await w(300);
  await page.getByLabel('Character name').fill(mobile ? 'Priya' : 'Big Dave');
  await page.getByRole('button', { name: 'Afro' }).click();
  await page.getByRole('button', { name: 'Puffer' }).click();
  await page.getByRole('button', { name: 'Cans' }).click();
  await w(900);
  await shot('02-create');
  await page.getByRole('button', { name: /Move to Peckwell →/ }).click();
  await w(2200);
  await shot('03-arrive');

  // walk the high street
  await dbg(() => { const e = window.__ukl.engine; e.teleport(28, 19); e.save.minutes = 12 * 60 + 30; });
  if (mobile) {
    await page.touchscreen.tap(330, 470);
    await w(900);
  } else {
    await page.keyboard.down('ArrowRight');
    await w(1100);
    await page.keyboard.up('ArrowRight');
  }
  await w(500);
  await shot('04-highstreet');

  // job centre → barista
  await dbg(() => { const e = window.__ukl.engine; e.teleport(36.5, 18.6); });
  await w(400);
  await page.getByRole('button', { name: /Enter Jobcentre Minus/ }).click();
  await w(400);
  await shot('05-jobcentre');
  await page.getByRole('button', { name: 'Take job' }).first().click();
  await w(400);
  await dbg(() => { const e = window.__ukl.engine; e.teleport(30.5, 18.6); });
  await w(400);
  await page.getByRole('button', { name: /Enter Prêt/ }).click();
  await w(300);
  await page.getByRole('button', { name: 'Start shift' }).click();
  await w(300);
  // play a bit: tap the 'next' step correctly a few times
  for (let i = 0; i < 6; i++) {
    const next = await page.locator('.mg-step.next').first().textContent().catch(() => null);
    if (!next) break;
    const label = next.replace(/^\S+\s/, '').trim();
    await page.locator('.mg-btn', { hasText: label }).first().click();
    await w(150);
  }
  await shot('06-shift-barista');
  await page.waitForSelector('.result-pay', { timeout: 45000 });
  await w(300);
  await shot('07-shift-result');
  await page.getByRole('button', { name: 'Lovely' }).click();

  // rent a flat then fast-forward to Monday 09:00
  await dbg(() => { const e = window.__ukl.engine; e.save.money = 640; e.teleport(19.5, 18.6); e.touch(); });
  await w(400);
  await page.getByRole('button', { name: /Enter Fleecems/ }).click();
  await w(300);
  await shot('08-lettings');
  await page.getByRole('button', { name: /Move in/ }).first().click();
  await w(400);
  await page.getByRole('button', { name: /Cheers|Fine/ }).click();
  await w(200);
  await dbg(() => { const e = window.__ukl.engine; e.save.minutes = 10080 + 9 * 60 - 3; e.touch(); });
  await page.waitForSelector('.phone-msg .bill', { timeout: 8000 });
  await w(400);
  await shot('09-rent-due');
  await page.locator('.phone-msg .btn').click();

  // chat (with the profanity filter doing its thing)
  await dbg(() => { const e = window.__ukl.engine; e.teleport(40, 22.6); });
  await page.getByRole('button', { name: 'Chat' }).click();
  await w(200);
  await page.getByLabel('Chat message').fill('Alright Peckwell! Rent went up AGAIN, what the fuck');
  await page.getByRole('button', { name: 'Send' }).click();
  await w(1600);
  await page.getByLabel('Chat message').fill('Lovely weather for ducks innit');
  await page.getByRole('button', { name: 'Send' }).click();
  await w(500);
  await shot('10-chat');
  await page.getByRole('button', { name: 'Close chat' }).click();

  // billboard
  await dbg(() => { const e = window.__ukl.engine; e.teleport(36.5, 19.2); });
  await w(1200);
  await shot('11-billboards-world');
  const box = await page.evaluate(() => {
    // centre of the jobcentre billboard in screen coords
    const e = window.__ukl.engine; const c = e['cam']; const z = e['zoom'];
    const left = c.x - innerWidth / 2 / z; const top = c.y - innerHeight / 2 / z;
    return { x: ((34 + 2.5) * 32 - left) * z, y: ((12.2 + 0.95) * 32 - top) * z };
  });
  if (mobile) await page.touchscreen.tap(box.x, box.y); else await page.mouse.click(box.x, box.y);
  await w(400);
  await shot('12-billboard-modal');
  await page.keyboard.press('Escape');

  // rain + night + delivery
  await dbg(() => { const e = window.__ukl.engine; e.setRain(true); e.save.minutes = 10080 + 21 * 60; e.save.job = 'rider'; e.teleport(4.5, 23.4); e.touch(); });
  await w(300);
  await page.getByRole('button', { name: /Enter PFC/ }).click();
  await w(300);
  await page.getByRole('button', { name: 'Start shift' }).click();
  await w(600);
  await dbg(() => window.__ukl.engine.setRain(true));
  await w(2200);
  await shot('13-rain-night-delivery');

  // phone/goals
  await page.getByRole('button', { name: 'Phone menu' }).click();
  await w(400);
  await shot('14-phone-goals');
  await page.keyboard.press('Escape');
  const fps = await page.evaluate(() => window.__ukl.engine.getSnapshot().fps);
  console.log(label, 'fps≈', fps);
  await ctx.close();
}

await tour('mobile', { width: 390, height: 844 }, true);
await tour('desktop', { width: 1280, height: 800 }, false);
await browser.close();
console.log(errors.length ? 'CONSOLE ISSUES:\n' + errors.join('\n') : 'No console errors or warnings.');
