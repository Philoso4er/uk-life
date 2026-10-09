// Phase 3: things to own and grow. An allotment, a Flogit reselling hustle, buy-to-let flats
// and some status items you absolutely don't need.
import type { ActionDef } from './actions';
import { chance, gainMoodlet, money, pick, tickHooks, weeklyHooks, type GameEvent } from './economy';
import { EVENT_BY_ID, type EventDef } from './events';
import { applyFx } from './needs';
import { now } from './time';
import type { SaveState } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const earn = (s: SaveState, n: number) => {
  s.money = r2(s.money + n);
  s.stats.earned = r2(s.stats.earned + n);
  s.uc.weekEarned = r2(s.uc.weekEarned + n);
};
const A = (d: ActionDef) => d;

// ------------------------------------------------------------------ allotment
export interface Crop {
  id: string;
  emoji: string;
  name: string;
  seed: number;
  /** real minutes to grow */
  grow: number;
  veg: number;
  blurb: string;
}
export const CROPS: Crop[] = [
  { id: 'radish', emoji: '🌱', name: 'Radishes', seed: 1, grow: 45, veg: 3, blurb: 'Ready in about 45 minutes. Idiot-proof. Mostly.' },
  { id: 'spuds', emoji: '🥔', name: 'Potatoes', seed: 2, grow: 240, veg: 7, blurb: 'Ready in about 4 hours. Dig for victory.' },
  { id: 'marrow', emoji: '🥒', name: 'A show marrow', seed: 3, grow: 720, veg: 2, blurb: 'About 12 hours. For the Peckwell Show. Nan has opinions.' },
];
export const CROP_BY_ID: Record<string, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c]));
export const PLOT_RENT = 3;
export const cropLeft = (s: SaveState, t = now()) => {
  const a = s.owned.allotment;
  if (!a || !a.crop) return 0;
  return Math.max(0, a.planted + CROP_BY_ID[a.crop].grow * 60000 - t);
};
const growing = (s: SaveState) => !!s.owned.allotment?.crop;
const mins = (ms: number) => (ms >= 3600000 ? `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m` : `${Math.max(1, Math.round(ms / 60000))} min`);

// ------------------------------------------------------------------ Flogit (reselling)
const FINDS = ['a Le Creuset-ish casserole pot (one chip)', 'a box of 90s Pokémon-ish cards', 'a “vintage” Ralph Lauren-ish shirt', 'a fondue set, never used', 'a Nintendo-ish Game Boy that turns on', 'a framed print of a lighthouse', 'Dr Martens-ish boots, size 9', 'a bread maker (it’s always a bread maker)', 'a VHS of Titanic, both tapes', 'a Barbour-ish jacket with “character”'];
export const MAX_STOCK = 4;
export const hustleOf = (s: SaveState) => (s.owned.hustle ??= { stock: [], listings: [] });

// ------------------------------------------------------------------ buy-to-let
export const BTL_DEPOSIT = 6000;
export const BTL_SALE = 5400;
export const BTL_RENT = 175;
export const BTL_MORTGAGE = 72;
export const BTL_FEE = 0.12;
const REPAIRS: [string, number, number][] = [
  ['The boiler’s packed in (of course)', 80, 160],
  ['Tenant locked out at 2am. Locksmith', 60, 110],
  ['Mysterious leak “from upstairs”', 50, 140],
  ['Gas safety certificate', 60, 60],
  ['Smoke alarm battery (agent call-out fee)', 45, 45],
  ['Fox got into the bins. Again. Pest control', 40, 80],
];

// ------------------------------------------------------------------ status items (the Shop app)
export interface StatusItem {
  id: string;
  emoji: string;
  name: string;
  price: number;
  blurb: string;
}
export const STATUS_ITEMS: StatusItem[] = [
  { id: 'sign', emoji: '🪧', name: '“Live Laugh Love” sign', price: 8, blurb: 'For above the telly. You will live. You will laugh. You will, eventually, love.' },
  { id: 'airfryer', emoji: '🍟', name: 'Air fryer', price: 60, blurb: 'Unlocks “air-fry something” at home. You will tell everyone. Everyone.' },
  { id: 'smeg', emoji: '🫖', name: 'Retro Smeg-ish kettle', price: 85, blurb: 'Boils water the same as any kettle. But in pastel.' },
  { id: 'ring', emoji: '🔔', name: 'Video doorbell', price: 90, blurb: 'Watch the fox in HD. Catch couriers not knocking. Post it all on Natter.' },
  { id: 'barbour', emoji: '🧥', name: 'Barbour-ish wax jacket', price: 140, blurb: 'Counts as a proper coat. You now own a Labrador emotionally.' },
  { id: 'dyson', emoji: '💨', name: 'Dyson-ish hair styler', price: 280, blurb: 'Unlocks a salon blow-dry at home. Costs more than your first car.' },
  { id: 'peloton', emoji: '🚴', name: 'Pedalon-ish exercise bike', price: 350, blurb: 'Unlocks a spin class at home. Doubles as a clothes horse.' },
];
export const statusCount = (s: SaveState) => STATUS_ITEMS.filter((i) => s.owned.items.includes(i.id)).length;
export function buyStatus(s: SaveState, id: string, out: GameEvent[]): string | null {
  const it = STATUS_ITEMS.find((i) => i.id === id);
  if (!it || s.owned.items.includes(id)) return 'Already got one.';
  if (s.money < it.price) return 'Card declined. Maybe next payday.';
  s.money = r2(s.money - it.price);
  s.owned.items.push(id);
  if (id === 'barbour') s.inv.coat = true;
  gainMoodlet(s, 'new_kettle', out);
  out.push({ type: 'phone', from: 'Couriers-R-Us', text: pick([`Your ${it.name} has been delivered. Left in a safe place: your bin.`, `We tried to deliver your ${it.name} but you were in so we left it with number 47. Who you’ve never met.`, `Delivered! Your ${it.name} is behind the wheelie bin. Photo attached (it’s a photo of a hedge).`]), tone: 'good', quiet: true });
  out.push({ type: 'gossip', key: 'status' });
  return null;
}

// ------------------------------------------------------------------ actions
export const OWNING_ACTIONS: ActionDef[] = [
  // allotment
  A({ id: 'plotask', place: 'allotments', emoji: '📋', label: 'Ask about getting a plot', note: `£${PLOT_RENT}/week. The waiting list is 14 years. Unless you know someone.`, mins: 10, outdoors: true, hidden: (s) => !!s.owned.allotment, req: (s) => (Number(s.flags.nanHelps ?? 0) < 2 ? 'Waiting list: 14 years. Help Nan with her marrows a couple of times first: she knows people.' : null), lines: [''], run: (s, _c, out, r) => { s.owned.allotment = { planted: 0, crop: '' }; r.tone = 'good'; out.push({ type: 'gossip', key: 'plot' }); return 'Nan had a word with the committee. Maureen’s plot is yours: two beds, a shed with one wall and a gnome called Kenneth. Don’t mention the 1987 feud.'; } }),
  ...CROPS.map((c) => A({ id: 'plant_' + c.id, place: 'allotments', emoji: c.emoji, label: `Plant ${c.name.toLowerCase()}`, note: c.blurb, mins: 20, cost: c.seed, outdoors: true, fx: { mood: 3, energy: -4 }, skill: ['fitness', 0.05], hidden: (s) => !s.owned.allotment || growing(s), lines: [`You planted ${c.name.toLowerCase()} in a straight-ish line. Kenneth the gnome watches over them.`], run: (s) => { s.owned.allotment = { planted: now(), crop: c.id }; } })),
  A({ id: 'water', place: 'allotments', emoji: '🚿', label: 'Water and weed', note: 'Takes 15 real minutes off the growing time.', mins: 15, cooldown: 20, outdoors: true, fx: { mood: 4, energy: -3 }, hidden: (s) => !growing(s) || cropLeft(s) <= 0, lines: [''], run: (s, c) => { const a = s.owned.allotment!; a.planted -= (c.raining ? 5 : 15) * 60000; const left = cropLeft(s); return c.raining ? `You watered the plants in the rain. Nan saw. Nan will never let this go. ${left ? `Ready in ${mins(left)}.` : 'Ready to dig up!'}` : `Weeded, watered, and you had a little chat with the ${CROP_BY_ID[a.crop].name.toLowerCase()}. ${left ? `Ready in ${mins(left)}.` : 'Ready to dig up!'}`; } }),
  A({ id: 'checkplot', place: 'allotments', emoji: '👀', label: 'Check on your plot', note: 'Free. Slugs permitting.', mins: 4, outdoors: true, hidden: (s) => !s.owned.allotment || (growing(s) && cropLeft(s) <= 0), lines: [''], run: (s) => (growing(s) ? `${CROP_BY_ID[s.owned.allotment!.crop].name}: ready in about ${mins(cropLeft(s))}. Kenneth the gnome says hold your horses.` : 'Two empty beds and Kenneth the gnome. Plant something!') }),
  A({ id: 'harvest', place: 'allotments', emoji: '🧺', label: 'Harvest!', note: 'Dig it all up.', mins: 25, outdoors: true, fx: { energy: -5 }, hidden: (s) => !growing(s) || cropLeft(s) > 0, lines: [''], run: (s, _c, out, r) => { const crop = CROP_BY_ID[s.owned.allotment!.crop]; s.owned.allotment = { planted: 0, crop: '' }; let n = crop.veg; let extra = ''; if (chance(0.2)) { n = Math.max(1, Math.floor(n / 2)); extra = ' The slugs had a party. You lost half.'; } s.inv.veg += n; if (crop.id === 'marrow') s.flags.showMarrow = true; gainMoodlet(s, 'grew_it', out); out.push({ type: 'gossip', key: 'veg' }); r.tone = 'good'; return `${crop.emoji} ${n} lots of ${crop.name.toLowerCase()} in the basket.${extra}${crop.id === 'marrow' ? ' And one ENORMOUS marrow. Show-worthy.' : ''} Cook them at home or sell them to Raj at Kwik Mart.`; } }),
  A({ id: 'marrowshow', place: 'allotments', emoji: '🏆', label: 'Enter the Peckwell Show (marrow class)', note: 'Win £25 and eternal glory. Or lose to Nan.', mins: 40, outdoors: true, hidden: (s) => !s.flags.showMarrow, lines: [''], run: (s, _c, out, r) => { s.flags.showMarrow = false; if (chance(0.45)) { earn(s, 25); gainMoodlet(s, 'smug', out); out.push({ type: 'gossip', key: 'marrow' }); r.tone = 'good'; return 'FIRST PLACE. A rosette and £25. Nan came second and has gone very quiet. Doris is delighted.'; } r.tone = 'bad'; return 'Nan won. Again. She patted your marrow and said “maybe next year, love”. It was the most devastating thing anyone has ever said to you.'; } }),
  A({ id: 'stew', place: 'home', emoji: '🍲', label: 'Cook a veg stew', note: 'Uses 2 home-grown veg. Free and smug.', mins: 40, fx: { hunger: 45, mood: 6, warmth: 10 }, hidden: (s) => s.inv.veg < 1, req: (s) => (s.inv.veg < 2 ? 'You need 2 veg. You have one radish. That is not a stew.' : null), moodlet: 'grew_it', lines: ['You made a stew with your own vegetables. You took a photo. You will mention this at work.', 'Home-grown stew. It tastes of soil and victory.'], run: (s) => { s.inv.veg -= 2; } }),
  A({ id: 'sellveg', place: 'kwik', emoji: '🥕', label: 'Sell your veg to Raj', note: '£1.20 each, “for the local produce shelf”.', mins: 6, hidden: (s) => s.inv.veg < 1, lines: [''], run: (s, _c, _o, r) => { const n = s.inv.veg; s.inv.veg = 0; r.extraPay = r2(n * 1.2); return `Raj bought ${n} veg and put a hand-written sign up: “LOCAL!!! ORGANIC!!!”. He’s charging £3 each. Fair play.`; } }),
  // Flogit
  A({ id: 'rummage', place: 'charity', emoji: '🔍', label: 'Rummage for something to flip', note: `£4. Sell it on Flogit for more (list it at home). Holds ${MAX_STOCK}.`, mins: 15, cost: 4, cooldown: 20, skill: ['brains', 0.05], req: (s) => ((s.owned.hustle?.stock.length ?? 0) >= MAX_STOCK ? 'Your hallway is full of “stock”. List it on Flogit first (at home).' : null), lines: [''], run: (s) => { const f = pick(FINDS); hustleOf(s).stock.push(f); return `You found ${f}. Margaret at the till said “ooh, that’s a good one”. You’re basically on Antiques Roadshow.`; } }),
  A({ id: 'flogit', place: 'home', emoji: '📸', label: 'List your finds on Flogit', note: 'Photograph it on the carpet. Sells over the next few (real) minutes.', mins: 20, hidden: (s) => !s.owned.hustle?.stock.length, lines: [''], run: (s) => { const h = hustleOf(s); const t = now(); const n = h.stock.length; for (const item of h.stock) h.listings.push({ item, price: Math.round(8 + Math.random() * 18 + s.skills.charm * 1.5), sellAt: t + (3 + Math.random() * 12) * 60000 }); h.stock = []; return `${n} listing${n > 1 ? 's' : ''} up on Flogit. Description: “Good condition. Smoke-free, pet-free home.” (Lie.) Buyers will message you.`; } }),
  // buy-to-let
  A({ id: 'btlbuy', place: 'fleecems', emoji: '🏘️', label: `Buy a buy-to-let flat (${money(BTL_DEPOSIT)} deposit)`, note: `About ${money(BTL_RENT)}/wk rent in, minus mortgage, a ${BTL_FEE * 100}% agent fee and whatever breaks. Up to 3.`, mins: 40, cost: BTL_DEPOSIT, hidden: (s) => s.owned.btl >= 3, lines: [''], run: (s, _c, out, r) => { s.owned.btl += 1; gainMoodlet(s, 'smug', out); out.push({ type: 'gossip', key: 'landlord' }); r.tone = 'good'; return s.owned.btl === 1 ? 'Congratulations: you’re a landlord. Josh gave you a Fleecems keyring and a firm handshake. You feel a strange new urge to say “it’s the market”.' : `Flat number ${s.owned.btl}. You’ve started saying “portfolio”. Dave has started calling you Nigel.`; } }),
  A({ id: 'btlsell', place: 'fleecems', emoji: '🔑', label: `Sell a buy-to-let (${money(BTL_SALE)})`, note: 'After fees. The market is “a bit soft right now”.', mins: 30, hidden: (s) => s.owned.btl < 1, lines: ['Sold. Josh took his cut and a selfie. You are a little bit less Nigel.'], run: (s, _c, _o, r) => { s.owned.btl -= 1; r.extraPay = BTL_SALE; } }),
  // status items in use
  A({ id: 'airfry', place: 'home', emoji: '🍟', label: 'Air-fry something', note: 'Your air fryer. You love your air fryer.', mins: 15, cost: 1.5, fx: { hunger: 35, mood: 5 }, hidden: (s) => !s.owned.items.includes('airfryer'), lines: ['Chips in 12 minutes. You told three people. None of them asked.', 'You air-fried a whole chicken. It was the best day of your life.'] }),
  A({ id: 'spin', place: 'home', emoji: '🚴', label: 'Do a spin class on the bike', note: '“Push it, Peckwell!”', mins: 30, fx: { energy: -12, mood: 7, hygiene: -12 }, skill: ['fitness', 0.15], hidden: (s) => !s.owned.items.includes('peloton'), lines: [''], run: () => (chance(0.3) ? 'You went to use the bike. It was covered in drying laundry. You did a bit of stretching instead and called it a session.' : 'Instructor Chad yelled “YOU’RE A WARRIOR” at you through the screen. You are. A sweaty one.') }),
  A({ id: 'blowdry', place: 'home', emoji: '💨', label: 'Salon blow-dry at home', note: 'The Dyson-ish. Sounds like a jet taking off.', mins: 20, fx: { hygiene: 12, mood: 6 }, moodlet: 'fresh_trim', hidden: (s) => !s.owned.items.includes('dyson'), lines: ['Absolute bounce. You walked to Kwik Mart just to be seen.'] }),
];

// ------------------------------------------------------------------ hooks
export const plotRentHook = (s: SaveState, out: GameEvent[]) => {
  if (!s.owned.allotment) return;
  if (s.money >= PLOT_RENT) s.money = r2(s.money - PLOT_RENT);
  else {
    s.owned.allotment = null;
    out.push({ type: 'phone', from: 'Peckwell Allotment Committee', text: 'Your plot rent (£3) bounced, so the plot has gone to the next person on the waiting list (Doris). Kenneth the gnome stays with the plot.', tone: 'bad', quiet: true });
  }
};
export function btlWeek(s: SaveState, out: GameEvent[]) {
  if (s.owned.btl < 1) return;
  const n = s.owned.btl;
  const lines: { label: string; amount: number }[] = [
    { label: `Rent from ${n} flat${n > 1 ? 's' : ''}`, amount: -BTL_RENT * n },
    { label: `Fleecems management fee (${BTL_FEE * 100}%)`, amount: r2(BTL_RENT * n * BTL_FEE) },
    { label: 'Mortgage', amount: BTL_MORTGAGE * n },
  ];
  for (let i = 0; i < n; i++) {
    if (!chance(0.35)) continue;
    const [what, lo, hi] = pick(REPAIRS);
    lines.push({ label: what, amount: Math.round(lo + Math.random() * (hi - lo)) });
  }
  const net = r2(-lines.reduce((a, l) => a + l.amount, 0));
  s.money = r2(s.money + net);
  if (net > 0) {
    s.stats.earned = r2(s.stats.earned + net);
    s.uc.weekEarned = r2(s.uc.weekEarned + net);
  }
  out.push({ type: 'phone', from: 'Fleecems Lettings', text: `Your landlord statement. ${net >= 0 ? `You made ${money(net)} this week. Passive income! (You did nothing. That’s the point.)` : `You LOST ${money(-net)} this week. “Property always goes up,” Josh says, quietly.`}${chance(0.4) ? `\n\nYour tenant says: “${pick(['The shower’s doing the thing again.', 'Is it ok if my cousin stays for a bit? (6 months)', 'There’s a smell. Not a bad smell. A worrying smell.', 'Can I paint the bathroom? It’s going to be purple.'])}”` : ''}`, tone: net >= 0 ? 'good' : 'bad', lines, quiet: false });
}
weeklyHooks.push(plotRentHook, btlWeek);

/** Flogit: due listings sell (or a buyer lowballs you, which is a card). */
export function flogitTick(s: SaveState, out: GameEvent[], t = now()) {
  const h = s.owned.hustle;
  if (!h || !h.listings.length || s.flags.lowballOpen) return;
  const i = h.listings.findIndex((l) => l.sellAt <= t);
  if (i < 0) return;
  const l = h.listings[i];
  if (!l.haggled && chance(0.4)) {
    l.haggled = true;
    s.flags.lowballOpen = true;
    s.flags.lowball = i;
    out.push({ type: 'card', id: 'lowball' });
    return;
  }
  h.listings.splice(i, 1);
  sell(s, l.item, l.price, out);
}
function sell(s: SaveState, item: string, price: number, out: GameEvent[]) {
  earn(s, price);
  s.flags.flips = Number(s.flags.flips ?? 0) + 1;
  out.push({ type: 'phone', from: 'Flogit', text: `Sold! ${item} went for ${money(price)}. ${pick(['The buyer turned up in a Range Rover-ish and paid in coins.', 'The buyer said “bit smaller than in the photo”. It was the same size.', 'Collected within the hour. The buyer smelled of Lynx-ish Africa.', 'Five stars: “Item as described. Seller seemed nervous.”'])}`, tone: 'good', quiet: true });
  if (Number(s.flags.flips) === 3) out.push({ type: 'gossip', key: 'flogit' });
}
tickHooks.push((s, _ctx, out) => flogitTick(s, out));

const lowballItem = (s: SaveState) => s.owned.hustle?.listings[Number(s.flags.lowball)] ?? null;
export const LOWBALL: EventDef = {
  id: 'lowball',
  emoji: '💬',
  kicker: 'Flogit · new message',
  title: '“Is this still available?”',
  text: (s) => {
    const l = lowballItem(s);
    return l ? `Someone called Gaz_1987 wants ${l.item}, listed at ${money(l.price)}. “Is this still available? Would you take ${money(Math.ceil(l.price * 0.45))}? Can collect in 5 mins. Cash.”` : 'The buyer has vanished. Classic Flogit.';
  },
  choices: [
    { label: 'Take the lowball', note: 'Money now. Dignity later.', apply: (s, out) => { const l = lowballItem(s); s.flags.lowballOpen = false; if (!l) return 'They’ve gone.'; s.owned.hustle!.listings.splice(Number(s.flags.lowball), 1); const p = Math.ceil(l.price * 0.45); sell(s, l.item, p, out); return `Gaz turned up 40 minutes late and paid ${money(p)} in 20ps. You helped carry it to his car.`; } },
    { label: '“No, the price is firm”', note: 'Hold out for a real buyer.', apply: (s) => { const l = lowballItem(s); s.flags.lowballOpen = false; if (!l) return 'They’ve gone.'; l.sellAt = now() + (2 + Math.random() * 6) * 60000; if (chance(0.25)) l.price = Math.max(4, Math.round(l.price * 0.8)); return '“No worries mate.” Then: “What’s your lowest?” Then: “Last offer, £3.” You block Gaz. Someone sensible will buy it soon.'; } },
    { label: 'Leave him on read', note: 'Power move.', apply: (s) => { const l = lowballItem(s); s.flags.lowballOpen = false; if (l) l.sellAt = now() + (3 + Math.random() * 8) * 60000; applyFx(s, { mood: 3 }); return 'Gaz sends “??” then “hello??” then “time waster”. You feel incredible.'; } },
  ],
};
EVENT_BY_ID.lowball = LOWBALL;
