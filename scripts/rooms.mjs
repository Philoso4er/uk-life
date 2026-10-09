// Screenshot every interior (desktop size) for an art review. Usage: node scripts/rooms.mjs [base] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || 'shots/round6/rooms';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 640 } });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(BASE + '/?debug=1');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.getByRole('button', { name: /Move to Peckwell|New character/ }).first().click();
await p.getByLabel('Character name').fill('Sam');
await p.getByRole('button', { name: /Move to Peckwell →/ }).click();
await p.waitForTimeout(1500);
const dismiss = async () => {
  for (let i = 0; i < 6; i++) {
    const c = p.locator('.event-card .event-choice').first();
    if (!(await c.isVisible().catch(() => false))) break;
    await c.click();
    await p.waitForTimeout(200);
  }
};
await dismiss();
const skip = p.getByRole('button', { name: 'Skip' });
if (await skip.isVisible().catch(() => false)) await skip.click();
// midday on a Wednesday-ish: everything open
await p.evaluate(() => {
  const u = window.__ukl;
  const t = u.london();
  u.setClockOffset(u.getClockOffset() + ((((2 - t.dayIdx + 7) % 7) * 24 + 13 - t.hh) * 60 - t.mm) * 60000);
});
await p.addStyleTag({ content: '.toasts{display:none!important}' });
const ids = ['kestrel', 'crumbs', 'kwik', 'pret', 'jobcentre', 'pub', 'bookies', 'pawn', 'pfc', 'laundry', 'garage', 'barber', 'charity', 'library', 'gym', 'synergy', 'fleecems', 'broadway'];
for (const id of ids) {
  await p.evaluate((id) => {
    const e = window.__ukl.engine;
    e.teleport(5, 10);
    e.enterBuilding(window.__ukl.building(id));
  }, id);
  await p.waitForTimeout(700);
  await dismiss();
  await p.screenshot({ path: `${OUT}/${id}.png` });
}
console.log(errors.length ? errors.join('\n') : 'No page errors.');
await browser.close();
