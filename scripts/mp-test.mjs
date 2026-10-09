// Two headless tabs in one browser profile talk over BroadcastChannel (the offline/local
// transport). Exercises the same remote-player + chat code paths the Supabase transport feeds.
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '../uk-life-shots';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const errors = [];
const open = async (name, fresh) => {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(name + ': ' + m.text()));
  await p.goto(BASE + '/?debug=1');
  if (fresh) {
    await p.evaluate(() => localStorage.clear());
    await p.reload();
  }
  await p.getByRole('button', { name: /Move to Peckwell|New character/ }).first().click();
  await p.getByLabel('Character name').fill(name);
  await p.getByRole('button', { name: /Move to Peckwell →/ }).click();
  await p.waitForTimeout(1500);
  return p;
};
const dismiss = async (p) => {
  for (let i = 0; i < 5; i++) {
    const c = p.locator('.event-card .event-choice').first();
    if (!(await c.isVisible().catch(() => false))) break;
    await c.click();
    await p.waitForTimeout(200);
  }
};
const alice = await open('Alice', true);
const bob = await open('Bob', false);
await dismiss(alice);
await dismiss(bob);
await alice.evaluate(() => window.__ukl.engine.teleport(30, 19));
await bob.evaluate(() => window.__ukl.engine.teleport(33, 19));
await bob.waitForTimeout(800);
const seen = await alice.evaluate(() => [...window.__ukl.engine['remotes'].values()].map((r) => ({ name: r.p.name, x: r.p.x })));
console.log('Alice sees:', JSON.stringify(seen));

// Bob posts on Natter
await bob.getByRole('button', { name: 'Natter' }).click();
await bob.getByLabel('New post').fill('Alright Alice! Fancy a sausage roll?');
await bob.getByRole('button', { name: 'Post' }).click();
await alice.waitForTimeout(600);
const feed = await alice.evaluate(() => window.__ukl.engine.social.getSnapshot().posts.filter((p) => !p.authorId.startsWith('npc:')).map((p) => p.text));
console.log('Alice feed (players):', JSON.stringify(feed));

// Bob DMs Alice
await bob.getByRole('button', { name: 'Back' }).click();
await bob.getByRole('button', { name: /^Messages/ }).click();
await bob.getByRole('button', { name: /New message/ }).click();
await bob.getByRole('button', { name: /Alice/ }).first().click();
await bob.getByLabel('Message').fill('Psst. Quiz at the Brolly, Tuesday?');
await bob.getByRole('button', { name: 'Send' }).click();
await alice.waitForTimeout(800);
const dms = await alice.evaluate(() => window.__ukl.engine.social.getSnapshot().threads.flatMap((t) => t.msgs.filter((m) => !m.from.includes(':')).map((m) => m.text)));
console.log('Alice DMs from players:', JSON.stringify(dms));
const pill = await alice.getByTestId('online-pill').textContent();
console.log('Alice HUD pill:', pill);
await alice.bringToFront();
await alice.getByRole('button', { name: 'Phone' }).click();
await alice.getByRole('button', { name: /^Messages/ }).click();
await alice.getByRole('button', { name: /Bob/ }).first().click();
await alice.waitForTimeout(400);
await alice.screenshot({ path: `${OUT}/multiplayer-local-dm.png` });
await alice.getByRole('button', { name: 'Close phone' }).click();
await alice.waitForTimeout(300);
await alice.screenshot({ path: `${OUT}/multiplayer-local-two-tabs.png` });
const ok = seen.some((s) => s.name === 'Bob') && feed.some((c) => c.includes('sausage roll')) && dms.some((c) => c.includes('Quiz at the Brolly'));
console.log(ok ? 'PASS: local multiplayer presence + Natter post + DM' : 'FAIL');
console.log(errors.length ? 'Errors:\n' + errors.join('\n') : 'No page errors.');
await browser.close();
process.exit(ok ? 0 : 1);
