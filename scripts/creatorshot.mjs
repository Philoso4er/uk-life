// Character creator screenshots (mobile). Usage: node scripts/creatorshot.mjs <baseUrl> <outPrefix>
// Picks Male, Female and Other in turn (if the build has the option) and saves <outPrefix>-{male,female,other}.png
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || 'shots/compare/creator';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(BASE + '/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Move to Peckwell/ }).first().click();
await page.waitForTimeout(400);
await page.getByLabel('Character name').fill('Sam');
const has = await page.getByRole('radio', { name: 'Male' }).count();
if (!has) {
  await page.screenshot({ path: `${OUT}-nogender.png` });
  console.log('no gender option in this build');
} else {
  for (const g of ['Male', 'Female', 'Other']) {
    await page.getByRole('radio', { name: g, exact: true }).click();
    await page.waitForTimeout(700);
    await page.locator('.creator-options').evaluate((el) => el.closest('.creator')?.scrollTo?.(0, 0));
    await page.screenshot({ path: `${OUT}-${g.toLowerCase()}.png` });
  }
}
console.log(errors.length ? 'errors: ' + errors.join('\n') : 'no page errors');
await browser.close();
