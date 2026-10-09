// Round 6 evidence: walk into the Leaky Brolly at night on a phone-sized screen, see who's in,
// open someone's profile card and have a bit of small talk. Usage: node scripts/inside.mjs [base] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || 'shots/round6';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
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
    await p.waitForTimeout(250);
  }
};
await dismiss();
const skip = p.getByRole('button', { name: 'Skip' });
if (await skip.isVisible().catch(() => false)) await skip.click();
await p.waitForTimeout(400);
// 8:30pm, so the pub is busy
await p.evaluate(() => {
  const u = window.__ukl;
  const t = u.london();
  const want = 20.5 * 60;
  const cur = t.hh * 60 + t.mm;
  u.setClockOffset(u.getClockOffset() + (want - cur) * 60000);
  u.engine['scheduleLocals'](true);
  u.engine.save.money = 60;
});
// stand across the road from the Brolly
await p.evaluate(() => window.__ukl.engine.teleport(43.5, 19.4));
await p.waitForTimeout(900);
await dismiss();
await p.screenshot({ path: `${OUT}/1-street-pub-badge.png` });
// tap the pub
const box = await p.locator('canvas.game-canvas').boundingBox();
const tapWorld = async (wx, wy) => {
  const pt = await p.evaluate(([wx, wy]) => {
    const e = window.__ukl.engine;
    const left = e['cam'].x - e['vw'] / 2 / e['zoom'];
    const top = e['cam'].y - e['vh'] / 2 / e['zoom'];
    return { x: (wx * 32 - left) * e['zoom'], y: (wy * 32 - top) * e['zoom'] };
  }, [wx, wy]);
  await p.mouse.click(box.x + pt.x, box.y + pt.y);
};
await tapWorld(43.5, 16.5);
await p.waitForFunction(() => !!window.__ukl.engine.inside, null, { timeout: 15000 });
await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/2-entered-pub.png` });
await dismiss();
// walk up to the bar
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/3-interior-people.png` });
await p.getByTestId('open-here').click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/4-here-now.png` });
const here = await p.evaluate(() => window.__ukl.engine.hereNow().map((x) => `${x.name} (${x.kind})`));
console.log('Here now:', here.join(', '));
// open a local's card (first non-staff, else staff)
const rows = p.locator('.here-row');
const n = await rows.count();
let pick = 0;
for (let i = 0; i < n; i++) if (!/Landlady|staff/i.test(await rows.nth(i).innerText())) { pick = i; break; }
await rows.nth(pick).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/5-profile-card.png` });
await p.getByTestId('act-wave').click();
await p.waitForTimeout(400);
await p.getByTestId('act-talk').click();
await p.waitForTimeout(300);
await p.getByTestId('topic-you').click();
await p.waitForTimeout(300);
await p.getByTestId('topic-gossip').click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/6-small-talk.png` });
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
// use the bar
await p.evaluate(() => {
  const e = window.__ukl.engine;
  const u = e.room.uses.find((x) => x.id === 'bar');
  e.walkTo(u.at[0], u.at[1], 'use:bar');
});
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/7-at-the-bar.png` });
console.log(errors.length ? 'Errors:\n' + errors.join('\n') : 'No page errors.');
await browser.close();
