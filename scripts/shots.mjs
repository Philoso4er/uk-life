// Headless screenshot tour. Usage: node scripts/shots.mjs [baseUrl] [outDir]
// Needs a Chrome/Chromium: set CHROME=/path/to/chrome (defaults to /usr/bin/google-chrome).
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '../uk-life-shots';
const ONLY = process.env.ONLY; // 'mobile' | 'desktop'
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
  const btn = (name) => page.getByRole('button', { name }).first();
  const dismissCards = async () => {
    for (let i = 0; i < 6; i++) {
      const c = page.locator('.event-card .event-choice').first();
      if (!(await c.isVisible().catch(() => false))) break;
      await c.click();
      await w(250);
    }
  };
  /** jump the game's clock to a given London weekday (0 = Mon) and time */
  const setLondon = (dayIdx, hh, mm = 0) =>
    dbg(([d, h, m]) => {
      // only ever moves forward, like real time
      const u = window.__ukl;
      const t = u.london(Date.now() + u.getClockOffset());
      const cur = t.dayIdx * 1440 + t.hh * 60 + t.mm;
      let delta = d * 1440 + h * 60 + m - cur;
      if (delta <= 0) delta += 7 * 1440;
      u.setClockOffset(u.getClockOffset() + delta * 60000);
    }, [dayIdx, hh, mm]).then(async () => {
      await w(900);
      await dismissCards();
    });
  const enter = async (x, y, re) => {
    await dbg(([x, y]) => { const e = window.__ukl.engine; e.teleport(x, y); e.touch(); }, [x, y]);
    await w(450);
    await btn(re).click();
    await w(450);
  };

  await page.goto(BASE + '/?debug=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await w(1200);
  await shot('01-title');

  await btn(/Move to Peckwell/).click();
  await w(300);
  await page.getByLabel('Character name').fill(mobile ? 'Priya' : 'Big Dave');
  await btn('Afro').click();
  await btn('Puffer').click();
  await btn('Cans').click();
  await w(700);
  await shot('02-create');
  await btn(/Move to Peckwell →/).click();
  await w(1500);
  await page.waitForSelector('.event-card', { timeout: 5000 }).catch(() => {});
  await w(400);
  await shot('03-event-card-streak');
  await dismissCards();
  await setLondon(1, 12, 30); // Tuesday lunchtime

  // ---- a timed action at Crumbs
  await enter(9.5, 18.6, /Enter Crumbs/);
  await shot('04-action-menu-crumbs');
  await btn(/^Sausage roll/).click();
  await w(1800);
  await shot('05-action-progress');
  await page.waitForSelector('[data-testid=action-result]', { timeout: 15000 });
  await w(400);
  await shot('06-action-result');
  await page.keyboard.press('Escape');
  await w(200);

  // ---- needs + moodlets HUD out on the high street
  await dbg(() => { const e = window.__ukl.engine; const s = e.save; s.hygiene = 22; s.social = 38; s.warmth = 64; e.teleport(28, 19); e.touch(); });
  if (mobile) {
    await page.touchscreen.tap(330, 470);
    await w(900);
  } else {
    await page.keyboard.down('ArrowRight');
    await w(1100);
    await page.keyboard.up('ArrowRight');
  }
  await w(600);
  await shot('07-hud-needs-moodlets');

  // ---- the pub on quiz night
  await setLondon(1, 19, 30);
  await enter(43.5, 18.6, /Enter The Leaky Brolly/);
  await shot('08-action-menu-pub');
  await page.keyboard.press('Escape');

  // ---- the park: spots with floating markers
  await setLondon(2, 12, 40);
  await dbg(() => { const e = window.__ukl.engine; e.teleport(44.5, 34.5); e.touch(); });
  await w(1200);
  await shot('09-park-spots');
  await btn(/Visit The Duck Pond/).click();
  await w(400);
  await shot('10-action-menu-pond');
  await page.keyboard.press('Escape');

  // ---- Jobcentre → barista shift
  await enter(36.5, 18.6, /Enter Jobcentre Minus/);
  await shot('11-jobcentre');
  await btn('Take job').click();
  await w(400);
  await enter(30.5, 18.6, /Enter Prêt/);
  await btn('Start shift').click();
  await w(300);
  for (let i = 0; i < 6; i++) {
    const next = await page.locator('.mg-step.next').first().textContent().catch(() => null);
    if (!next) break;
    const lbl = next.replace(/^\S+\s/, '').trim();
    await page.locator('.mg-btn', { hasText: lbl }).first().click();
    await w(150);
  }
  await page.waitForSelector('.event-card', { timeout: 45000 });
  await w(400);
  await shot('12-shift-result-card');
  await dismissCards();

  // ---- move in, then the real Monday 09:00 arrives
  await dbg(() => { const e = window.__ukl.engine; e.save.money = 640; e.touch(); });
  await enter(19.5, 18.6, /Enter Fleecems/);
  await shot('13-lettings');
  await btn(/Move in/).click();
  await w(400);
  await dismissCards();
  await dbg(() => { const u = window.__ukl; u.setClockOffset(u.getClockOffset() + u.msUntilRent(Date.now() + u.getClockOffset()) - 3000); });
  await w(4500);
  for (let i = 0; i < 4; i++) {
    if (await page.locator('.event-card .bill').isVisible().catch(() => false)) break;
    await page.locator('.event-card .event-choice').first().click().catch(() => {});
    await w(600);
  }
  await page.waitForSelector('.event-card .bill', { timeout: 8000 });
  await w(400);
  await shot('14-event-card-rent-day');
  await dismissCards();

  // ---- the phone: Natter feed
  await setLondon(0, 18, 10);
  await dbg(() => window.__ukl.tel());
  await btn('Natter').click();
  await w(500);
  await page.getByLabel('New post').fill('Rent went up AGAIN. Can’t complain. Well. I could. What the fuck, Nigel');
  await btn('Post').click();
  await w(12000); // NPCs like and reply
  await dbg(() => document.querySelector('.phone-screen')?.scrollTo(0, 0));
  await shot('15-phone-natter');
  // a Big Tel chain somewhere further down, ideally
  await btn('Back').click();
  await w(300);
  await shot('16-phone-home');
  await btn(/^Messages/).click();
  await w(300);
  await btn(/Auntie Bev/).click();
  await w(300);
  await page.getByLabel('Message').fill('Thanks Bev! Is the swan really that bad?');
  await btn('Send').click();
  await w(7000);
  await shot('17-phone-messages-thread');
  await btn('Back').click();
  await w(300);
  await shot('18-phone-messages');
  await btn('Back').click();
  await btn(/^Me$/).click();
  await w(300);
  await shot('19-phone-me-moodlets');
  await btn('Close phone').click();
  await w(200);

  // ---- rain + night + delivery
  await setLondon(2, 22, 0);
  await dbg(() => { const e = window.__ukl.engine; e.setRain(true); e.save.job = 'rider'; e.save.lastShiftAt = 0; e.save.energy = 80; e.teleport(4.5, 23.4); e.touch(); });
  await w(300);
  await btn(/Enter PFC/).click();
  await w(300);
  await btn('Start shift').click();
  await w(600);
  await dbg(() => window.__ukl.engine.setRain(true));
  await w(2200);
  await shot('20-rain-night-delivery');
  await dbg(() => window.__ukl.engine.cancelDelivery());
  await w(300);

  // ---- leave for 9 hours, come back
  const [off, json] = await dbg(() => { const u = window.__ukl; u.writeSave(u.engine.save); const s = { ...u.engine.save, lastSeen: u.engine.save.lastSeen - 9 * 3600e3 }; return [u.getClockOffset(), JSON.stringify(s)]; });
  await page.goto(BASE + '/?debug=1&clock=' + off);
  await w(500);
  await dbg((j) => localStorage.setItem('uklife.save.v1', j), json);
  await page.reload();
  await w(800);
  await btn('Carry on').click();
  await page.waitForSelector('.event-card', { timeout: 6000 });
  await w(500);
  await shot('21-event-card-welcome-back');
  const fps = await page.evaluate(() => window.__ukl?.engine.getSnapshot().fps);
  console.log(label, 'fps≈', fps);
  await ctx.close();
}

if (ONLY !== 'desktop') await tour('mobile', { width: 390, height: 844 }, true);
if (ONLY !== 'mobile') await tour('desktop', { width: 1280, height: 800 }, false);
await browser.close();
console.log(errors.length ? 'CONSOLE ISSUES:\n' + errors.join('\n') : 'No console errors or warnings.');
