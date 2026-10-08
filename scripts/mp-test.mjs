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
const alice = await open('Alice', true);
const bob = await open('Bob', false);
await alice.evaluate(() => window.__ukl.engine.teleport(30, 19));
await bob.evaluate(() => window.__ukl.engine.teleport(33, 19));
await bob.waitForTimeout(800);
const seen = await alice.evaluate(() => [...window.__ukl.engine['remotes'].values()].map((r) => ({ name: r.p.name, x: r.p.x })));
console.log('Alice sees:', JSON.stringify(seen));
await bob.getByRole('button', { name: 'Chat' }).click();
await bob.getByLabel('Chat message').fill('Alright Alice! Fancy a sausage roll?');
await bob.getByRole('button', { name: 'Send' }).click();
await alice.waitForTimeout(600);
const chat = await alice.evaluate(() => window.__ukl.engine.getSnapshot().chat.filter((m) => m.kind === 'player').map((m) => `${m.name}: ${m.text}`));
console.log('Alice chat:', JSON.stringify(chat));
const pill = await alice.getByTestId('online-pill').textContent();
console.log('Alice HUD pill:', pill);
await alice.bringToFront();
await alice.waitForTimeout(300);
await alice.screenshot({ path: `${OUT}/multiplayer-local-two-tabs.png` });
const ok = seen.some((s) => s.name === 'Bob') && chat.some((c) => c.includes('sausage roll'));
console.log(ok ? 'PASS: local multiplayer presence + chat' : 'FAIL');
console.log(errors.length ? 'Errors:\n' + errors.join('\n') : 'No page errors.');
await browser.close();
process.exit(ok ? 0 : 1);
