import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Engine, type Snapshot } from '../game/engine';
import { GOALS, HOMES, JOBS, SAVE_KEY, completeGoal, finishShift, gainMoodlet, levelPay, money, shiftAvailability, shiftPay, writeSave, type GameEvent } from '../game/economy';
import { MOODLETS, effectiveMood, moodPayMult, passTime } from '../game/needs';
import { PERSONAS, contactAuthor, systemAuthor } from '../game/npcs';
import type { SocialSnapshot } from '../game/social';
import { getClockOffset, london, msUntilRent, setClockOffset } from '../game/time';
import type { SaveState, JobId, HomeId, Avatar } from '../game/types';
import { buildingById, doorFront, stations, TUBE_FARE, type Billboard, type Building } from '../game/world';
import { createTransport } from '../net';
import { BUS_FARE, BUS_STOPS, BillboardDialog, BusList, EventCard, HomesList, JobsList, Modal, ShiftBanner, TravelList, type CardChoice } from './Dialogs';
import { BaristaGame, BusGame, OfficeGame } from './MiniGames';
import { EVENT_BY_ID, SHIFT_CARDS, eventDebug, choiceBlocked, resolveChoice, shiftXp, titleOf, type ShiftMods } from '../game/events';
import { Hud } from './Hud';
import { Creator } from './Creator';
import { PlaceDialog, ctxNow } from './Place';
import { PLACE_HOURS, placeOpen } from '../game/actions';
import { sfx } from '../game/audio';
import { GUIDE_STEPS, guideFinished, guideStep, skipGuide } from '../game/guide';
import { Phone, type PhoneApp } from './Phone';
import { HereSheet, ProfileCard, RoomBar } from './People';
import { actionsAt, interiorFor, type UseSpot } from '../game/interiors';
import { COMPLIMENTS, shortName, touchRel, type PersonRef } from '../game/people';

type Dialog = { kind: 'building'; b: Building; use?: UseSpot } | { kind: 'billboard'; bb: Billboard } | { kind: 'barber' } | { kind: 'shift'; job: JobId };

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
  onTap?: () => void;
}
export interface Card {
  id: number;
  emoji: string;
  kicker?: string;
  title: string;
  body: React.ReactNode;
  choices?: CardChoice[];
}

const ANNOUNCEMENTS = [
  'Mind the gap between the train and the platform.',
  'We are being held at a red signal. Thank you for your patience.',
  'Please take all your belongings with you. Including the man asleep in the corner.',
  'This is a Peckwell-bound train. (They all are.)',
  'Due to a passenger being taken ill, nobody makes eye contact.',
  'See it. Say it. Sorted. (Sorry.)',
];
const BUS_LINES = ['“Move down the bus please!” There is nowhere to move down to.', 'Someone is playing a voice note on speaker. It’s about a fridge.', 'You got the front seat upstairs. You are, briefly, the driver.', 'A man is eating a whole rotisserie chicken. It’s 9am.', '“This bus terminates here.” It does not. It goes round the corner and stops.'];
const EMPLOYER: Record<string, JobId> = { pret: 'barista', pfc: 'rider', synergy: 'temp', garage: 'bus' };

let toastId = 1;
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function Game({ save, onQuit }: { save: SaveState; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [phone, setPhone] = useState<PhoneApp | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [travel, setTravel] = useState<{ icon: string; text: string } | null>(null);
  const [person, setPerson] = useState<PersonRef | null>(null);
  const [hereOpen, setHereOpen] = useState(false);
  const phoneRef = useRef(phone);
  phoneRef.current = phone;

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info', onTap?: () => void) => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, text, tone, onTap }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), onTap ? 5200 : 3800);
  }, []);
  const card = useCallback((c: Omit<Card, 'id'>) => {
    sfx.pop();
    setCards((q) => [...q, { ...c, id: toastId++ }]);
  }, []);
  /** show straight after the card currently on screen (for "what happened next") */
  const cardNext = useCallback((c: Omit<Card, 'id'>) => setCards((q) => [...q.slice(0, 1), { ...c, id: toastId++ }, ...q.slice(1)]), []);
  const shiftMods = useRef<ShiftMods>({ bonus: 0, mult: 1 });
  const showEventRef = useRef<(id: string) => void>(() => {});

  const engineRef = useRef<Engine | null>(null);
  const handleEvents = useCallback(
    (ev: GameEvent[]) => {
      const e = engineRef.current;
      for (const x of ev) {
        if (x.type === 'toast') toast(x.text, x.tone);
        else if (x.type === 'goal') toast(`✓ Goal: ${GOALS.find((g) => g.id === x.id)?.label}`, 'good');
        else if (x.type === 'moodlet') {
          const m = MOODLETS[x.id];
          if (m) toast(`${m.emoji} ${m.name} (${m.mood > 0 ? '+' : ''}${m.mood} mood)`, m.mood >= 0 ? 'good' : 'bad');
        } else if (x.type === 'gossip') e?.brain.gossip(x.key);
        else if (x.type === 'card') showEventRef.current(x.id);
        else if (x.type === 'post' && e) {
          e.social.post(x.text);
          e.say(x.text);
        }
        else if (x.type === 'phone' && e) {
          const a = x.from === 'Mum' ? contactAuthor('mum') : x.from === 'Dave' ? contactAuthor('dave') : systemAuthor(x.from);
          e.social.incoming(a, x.text, { tone: x.tone, lines: x.lines }, false);
          if (x.quiet) toast(`✉️ ${x.from}: ${x.text}`, x.tone ?? 'info', () => setPhone(`thread:${a.id}`));
          else
            card({
              emoji: x.lines ? (x.lines.some((l) => l.amount < 0) ? '💷' : '🧾') : '📱',
              kicker: `New message · ${x.from}`,
              title: x.lines ? (x.lines.some((l) => l.amount < 0) ? 'Payment day' : 'Rent day') : x.from,
              body: (
                <>
                  <p>{x.text}</p>
                  {x.lines ? (
                    <div className="bill">
                      {x.lines.map((l) => (
                        <div key={l.label} className="bill-row">
                          <span>{l.label}</span>
                          <b className={l.amount < 0 ? 'credit' : undefined}>{l.amount < 0 ? '+' : '-'}{money(Math.abs(l.amount))}</b>
                        </div>
                      ))}
                      <div className="bill-row total">
                        <span>Balance now</span>
                        <b>{money(e.save.money)}</b>
                      </div>
                    </div>
                  ) : null}
                </>
              ),
              choices: [{ label: x.tone === 'bad' ? 'Ugh. Fine.' : 'Cheers', onPick: () => {} }],
            });
        } else if (x.type === 'streak')
          card({ emoji: '🔥', kicker: `Day ${x.count} streak`, title: x.title, body: <p>{x.text}</p>, choices: [{ label: 'Get in', onPick: () => {} }] });
        else if (x.type === 'summary')
          card({
            emoji: '🏠',
            kicker: 'Welcome back',
            title: x.title,
            body: (
              <ul className="summary-list">
                {x.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            ),
            choices: [{ label: 'Right, where was I', onPick: () => {} }],
          });
        else if (x.type === 'passout' && e) {
          const s = e.save;
          if (s.energy > 0) continue;
          const home = buildingById(HOMES[s.home].building);
          e.cancelDelivery();
          passTime(s, 300, { raining: false, outdoors: false, sleeping: true, rate: 0.4 });
          s.energy = 55;
          const cab = Math.min(s.money, 9.5);
          s.money = Math.round((s.money - cab) * 100) / 100;
          const out: GameEvent[] = [];
          gainMoodlet(s, 'end_of_line', out);
          const f = doorFront(home);
          e.teleport(f.x, f.y);
          setDialog(null);
          card({ emoji: '🥱', kicker: 'You ran out of energy', title: 'End of the line', body: <p>You passed out on the 436 and woke up in a bus depot in Croydon. Minicab home: -{money(cab)}. Maybe get some sleep, yeah?</p>, choices: [{ label: 'Never again (until next time)', onPick: () => {} }] });
          e.touch();
        }
      }
    },
    [toast, card],
  );
  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;

  // ---- engine lifecycle
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const e = new Engine(canvasRef.current!, save, {
      onInteract: (b) => setDialog({ kind: 'building', b }),
      onUse: (b, use) => setDialog({ kind: 'building', b, use }),
      onPerson: (p) => {
        sfx.pop();
        setPerson(p);
      },
      onEnter: (b) => {
        const n = e.hereNow();
        const names = n.slice(0, 3).map((p) => shortName(p.name));
        toast(`📍 ${b.name.split(' · ')[0]} · 👥 ${n.length} here${names.length ? `: ${names.join(', ')}${n.length > 3 ? ` +${n.length - 3}` : ''}` : ''}`, 'info', () => setHereOpen(true));
      },
      onLeave: () => setHereOpen(false),
      onAct: (m, from, boost) => {
        const s = e.save;
        const out: GameEvent[] = [];
        touchRel(s, 'player:' + m.from, 1, 'wave', out, m.name);
        const openCard = from ? () => setPerson(from) : undefined;
        const where = m.place ? buildingById(m.place)?.name.split(' · ')[0] ?? m.place : '';
        sfx.pop();
        if (m.kind === 'wave' || m.kind === 'nod') toast(`👋 ${m.name} waved at you`, 'info', openCard);
        else if (m.kind === 'compliment') toast(`💐 ${m.name}: “${COMPLIMENTS[m.n ?? 0] ?? COMPLIMENTS[0]}”`, 'good', openCard);
        else if (m.kind === 'drink') {
          if (boost) s.social = Math.min(100, s.social + 8);
          toast(`🍺 ${m.name} bought you a drink!${boost ? ' 💬 +8' : ''}`, 'good', openCard);
        } else if (m.kind === 'follow') toast(`➕ ${m.name} followed you on Natter`, 'good', openCard);
        else if (m.kind === 'accept') toast(`👍 ${m.name} is on the way${where ? ` to ${where}` : ''}`, 'good');
        else if (m.kind === 'decline') toast(`🙅 ${m.name} can’t make it this time`, 'info');
        else if (m.kind === 'invite' && from)
          card({
            emoji: '📍',
            kicker: 'Invite',
            title: `${m.name} invited you to ${where || 'hang out'}`,
            body: <p>{where ? `They’re asking you down to ${where}. Fancy it?` : 'Fancy it?'}</p>,
            choices: [
              { label: 'Go on then', tone: 'primary', onPick: () => void e.sendAct(from, 'accept', { place: m.place }) },
              { label: 'Not today', tone: 'ghost', onPick: () => void e.sendAct(from, 'decline') },
            ],
          });
        e.touch();
        if (out.length) handleEventsRef.current(out);
      },
      onBillboard: (bb) => setDialog({ kind: 'billboard', bb }),
      onEvents: (ev) => handleEventsRef.current(ev),
      onDeliveryDone: (earned, onTime, total, done, cancelled) => {
        if (cancelled && done === 0) {
          // nothing delivered, nothing earned: no shift on record, no "+£0" fanfare
          shiftMods.current = { bonus: 0, mult: 1 };
          toast('Shift cancelled. No drops, no pay. The chicken goes to someone else.', 'info');
          return;
        }
        const out: GameEvent[] = [];
        const tip = Math.round(shiftMods.current.bonus * 100) / 100;
        earned = Math.round((earned * shiftMods.current.mult + tip) * 100) / 100;
        shiftMods.current = { bonus: 0, mult: 1 };
        finishShift(e.save, JOBS.rider, earned, out);
        shiftXp(e.save, total ? onTime / total : 0, out);
        e.touch();
        handleEventsRef.current(out);
        if (cancelled) {
          card({ emoji: '🛵', kicker: 'Shift ended early', title: `+${money(earned)}`, body: <p>{done}/{total} drops made before you called it a day. You get paid for those.</p>, choices: [{ label: 'Fair enough', onPick: () => {} }] });
          return;
        }
        card({ emoji: '🛵', kicker: 'Delivery shift done', title: `+${money(earned)}`, body: <p>{onTime}/{total} drops on time. {onTime === total ? 'Five stars. The chips were still warm.' : onTime ? 'Mixed reviews. One customer says you “looked stressed”.' : 'One star: “chips were cold, rider was sweaty”.'}</p>, choices: [{ label: 'Lovely', onPick: () => {} }] });
      },
      onIncoming: (kind, from, text) => {
        if (kind === 'dm') sfx.buzz();
        if (phoneRef.current) return;
        if (kind === 'dm') toast(`✉️ ${from}: ${text.length > 70 ? text.slice(0, 68) + '…' : text}`, 'info', () => setPhone('messages'));
      },
    });
    engineRef.current = e;
    setEngine(e);
    let alive = true;
    createTransport().then((t) => {
      if (alive) void e.start(t);
    });
    if (params.has('debug')) (window as unknown as { __ukl: unknown }).__ukl = { engine: e, setDialog, setPhone, setClockOffset, getClockOffset, london, msUntilRent, writeSave, card, building: buildingById, tel: () => { const p = e.social.npcPost(e.brain.author(PERSONAS[0]), 'Can’t complain 👍', { likes: 6 }); e.brain.complain(p.id); e.social.pump(Date.now() + 120000); }, handle: (ev: GameEvent[]) => handleEventsRef.current(ev), events: eventDebug, showEvent: (id: string) => showEventRef.current(id) };
    const saver = setInterval(() => writeSave(e.save), 4000);
    const onHide = () => {
      writeSave(e.save);
      e.social.persist();
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      alive = false;
      clearInterval(saver);
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
      writeSave(e.save);
      e.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snap = useSyncExternalStore(engine?.subscribe ?? noopSub, engine?.getSnapshot ?? nullSnap) as Snapshot | null;
  const social = useSyncExternalStore(engine?.social.subscribe ?? noopSub, engine?.social.getSnapshot ?? nullSnap) as SocialSnapshot | null;

  // pause the world whenever something modal is up
  const modalUp = !!dialog || !!phone || cards.length > 0 || !!travel || !!person || hereOpen;
  useEffect(() => {
    engine?.setPaused(modalUp);
  }, [engine, modalUp]);
  useEffect(() => {
    engine?.setIndoors(dialog?.kind === 'building' && dialog.b.kind !== 'spot');
  }, [engine, dialog]);

  // older saves: a one-off nudge that gender & pronouns now exist (they start as Other, they/them)
  useEffect(() => {
    if (!engine || !engine.save.flags.identityPrompt) return;
    delete engine.save.flags.identityPrompt;
    const id = setTimeout(() => toast('New: set your gender & pronouns in 📱 Me (tap here). Locals use them when they gossip.', 'info', () => setPhone('me')), 2500);
    return () => clearTimeout(id);
  }, [engine, toast]);

  // keyboard shortcuts
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement | null)?.tagName ?? '');
      if (ev.key === 'Escape') {
        if (cards.length) return;
        if (person) setPerson(null);
        else if (hereOpen) setHereOpen(false);
        else if (phone) setPhone(null);
        else if (dialog && dialog.kind !== 'shift') setDialog(null);
      } else if (!typing && !modalUp && (ev.key === 't' || ev.key === 'T' || ev.key === '/')) {
        ev.preventDefault();
        setPhone('natter');
      } else if (!typing && !modalUp && (ev.key === 'p' || ev.key === 'P')) setPhone('home');
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [dialog, phone, cards.length, modalUp, person, hereOpen]);

  showEventRef.current = (id: string) => {
    const def = EVENT_BY_ID[id];
    const engine = engineRef.current;
    if (!def || !engine) return;
    const s = engine.save;
    card({
      emoji: def.emoji,
      kicker: def.kicker,
      title: titleOf(def, s),
      body: <p>{def.text(s)}</p>,
      choices: def.choices.map((c, i) => {
        const why = choiceBlocked(s, c);
        return {
          label: c.label,
          note: why ?? c.note,
          disabled: !!why,
          tone: i === 0 ? 'primary' : 'ghost',
          onPick: () => {
            const out: GameEvent[] = [];
            const r = resolveChoice(s, def, i, out, shiftMods.current);
            s.eventLog[def.id] = Date.now();
            engine.touch();
            cardNext({ emoji: def.emoji, kicker: def.kicker, title: r.tone === 'bad' ? 'Oh dear.' : r.tone === 'good' ? 'Get in.' : 'Right then.', body: <p>{r.text}</p>, choices: [{ label: r.tone === 'bad' ? 'Typical' : 'Carry on', onPick: () => {} }] });
            handleEvents(out);
          },
        } satisfies CardChoice;
      }),
    });
  };

  // mid-shift dilemmas: once per mini-game shift, and after the first drop on a delivery run
  const shiftJob = dialog?.kind === 'shift' ? dialog.job : null;
  useEffect(() => {
    if (!shiftJob) return;
    const pool = SHIFT_CARDS[shiftJob];
    const id = setTimeout(() => showEventRef.current(pool[Math.floor(Math.random() * pool.length)].id), 9000 + Math.random() * 7000);
    return () => clearTimeout(id);
  }, [shiftJob]);
  const dropIdx = snap?.delivery?.index ?? -1;
  useEffect(() => {
    if (dropIdx !== 1 || Math.random() > 0.65) return;
    const pool = SHIFT_CARDS.rider;
    showEventRef.current(pool[Math.floor(Math.random() * pool.length)].id);
  }, [dropIdx]);

  // first-session guide
  const guideIdx = engine && snap ? guideStep(engine.save) : -1;
  const guidePlace = guideIdx >= 0 && engine ? GUIDE_STEPS[guideIdx].place(engine.save) : null;
  useEffect(() => {
    engine?.setGuideTarget(guidePlace);
  }, [engine, guidePlace]);
  useEffect(() => {
    if (!engine || !snap) return;
    if (guideFinished(engine.save)) {
      engine.touch();
      card({ emoji: '🎉', kicker: 'Guide complete', title: 'You’re a local now', body: <p>Fed, employed and one shift down. The rest of Peckwell is yours: check 📱 → Goals for what’s next, and mind the swan.</p>, choices: [{ label: 'Cheers', onPick: () => {} }] });
    }
  }, [engine, snap, card]);

  if (!snap || !engine || !social)
    return (
      <div className="game">
        <canvas ref={canvasRef} className="game-canvas" />
      </div>
    );
  const s = engine.save;

  // ---- actions
  const run = (fn: (out: GameEvent[]) => void) => {
    const out: GameEvent[] = [];
    fn(out);
    engine.touch();
    handleEvents(out);
    writeSave(s);
  };
  const takeJob = (j: JobId) =>
    run((out) => {
      if (s.job !== j) {
        s.job = j;
        s.jobLevel = 1;
        s.jobXp = 0;
      }
      completeGoal(s, 'job', out);
      const b = buildingById(JOBS[j].building);
      toast(`You’re now a ${JOBS[j].title}! Head to ${b.name.split(' · ')[0]} to start a shift.`, 'good');
      setDialog(null);
    });
  const rent = (h: HomeId) =>
    run((out) => {
      const home = HOMES[h];
      if (s.money < home.rent * 2) return;
      s.money = Math.round((s.money - home.rent * 2) * 100) / 100;
      s.home = h;
      s.rent = home.rent;
      s.arrears = 0;
      s.damp = 0;
      completeGoal(s, 'rent', out);
      out.push({ type: 'phone', from: home.landlord, text: h === 'flatshare' ? 'Welcome to Grimewood Court! House rules: no guests, no heating before November, label your milk. Rent every Monday 9am, standing order pls. Nigel 👍' : h === 'studio' ? 'Dear Tenant, welcome to Victoria Terrace. Please find attached a 46-page inventory. Any scuffs will be deducted from your deposit. Regards, PropertyHub' : 'Welcome to The Vantage! I’m Marcus, your concierge. I’ll be holding your parcels and judging your takeaway orders. Rent: Mondays, 9am.', tone: 'good' });
      setDialog(null);
    });
  const backToSofa = () =>
    run((out) => {
      s.home = 'sofa';
      s.rent = 0;
      s.arrears = 0;
      out.push({ type: 'phone', from: 'Dave', text: 'Back on the sofa?? Course you can mate. The cat’s missed you. (The cat has not missed you.)', tone: 'info', quiet: true });
      setDialog(null);
    });
  const journey = (icon: string, text: string, to: Building, then: () => void) => {
    setDialog(null);
    setTravel({ icon, text });
    setTimeout(() => {
      const f = doorFront(to);
      engine.teleport(f.x, f.y);
      setTravel(null);
      then();
      engine.touch();
    }, 1600);
  };
  const travelTo = (id: string) => {
    if (s.oyster < TUBE_FARE) return;
    s.oyster = Math.round((s.oyster - TUBE_FARE) * 100) / 100;
    s.stats.tubeTrips++;
    const out: GameEvent[] = [];
    completeGoal(s, 'tube', out);
    passTime(s, 12, { raining: false, outdoors: false });
    const st = stations.find((x) => x.id === id)!;
    sfx.chime();
    journey('🚇', pickOne(ANNOUNCEMENTS), buildingById(st.id), () => {
      handleEvents(out);
      toast(`Arrived at ${st.name}.`, 'info');
    });
  };
  const replacementBus = (id: string) => {
    const out: GameEvent[] = [];
    passTime(s, 50, { raining: false, outdoors: false });
    gainMoodlet(s, 'rail_replacement', out);
    const st = stations.find((x) => x.id === id)!;
    journey('🚌', pickOne(['The rail replacement bus goes via a retail park, a roundabout, and what looks like Wales.', 'The driver doesn’t know the way. A passenger is giving directions off Google Maps.', 'You have been on this bus so long you have made a friend and lost them.']), buildingById(st.id), () => {
      handleEvents(out);
      toast(`Eventually, ${st.name}.`, 'info');
    });
  };
  const rideBus = (id: string) => {
    if (s.oyster < BUS_FARE) return;
    s.oyster = Math.round((s.oyster - BUS_FARE) * 100) / 100;
    passTime(s, 15, { raining: false, outdoors: false });
    const stop = BUS_STOPS.find((x) => x.id === id)!;
    journey('🚌', pickOne(BUS_LINES), buildingById(id), () => toast(`The 436 drops you at ${stop.name}.`, 'info'));
  };
  const startShift = (job: JobId) => {
    const avail = shiftAvailability(s);
    if (!avail.ok) return toast(avail.reason!, 'bad');
    shiftMods.current = { bonus: 0, mult: 1 };
    if (job === 'rider') {
      setDialog(null);
      engine.startDelivery();
      toast('Shift started! Ride to the green marker. Faster drops = bigger tips.', 'good');
      return;
    }
    setDialog({ kind: 'shift', job });
  };
  const shiftDone = (job: JobId, score: number, summary: string) => {
    const m = shiftMods.current;
    const mult = levelPay(s) * moodPayMult(effectiveMood(s, snap.raining)) * Math.max(0.5, m.mult);
    const pay = Math.round((shiftPay(JOBS[job], score, mult) + m.bonus) * 100) / 100;
    shiftMods.current = { bonus: 0, mult: 1 };
    run((out) => {
      finishShift(s, JOBS[job], pay, out);
      shiftXp(s, score, out);
    });
    setDialog(null);
    card({ emoji: job === 'barista' ? '☕' : job === 'temp' ? '📎' : '🚌', kicker: `${JOBS[job].title} shift done`, title: `+${money(pay)}`, body: <p>{summary}</p>, choices: [{ label: 'Lovely', onPick: () => {} }] });
  };

  // ---- dialog rendering
  let content: React.ReactNode = null;
  if (dialog?.kind === 'building') {
    const b = dialog.b;
    const use = dialog.use;
    const close = () => setDialog(null);
    const ctxFn = () => ctxNow(snap.raining, engine.peopleNear(b.id));
    const job = EMPLOYER[b.id];
    // inside a building you use one thing at a time (the till, the bar…); "Everything here" opens the lot
    const room = use ? interiorFor(b, s) : null;
    const only = use && room ? actionsAt(room, use, b.id, b.kind) : undefined;
    const wants = (sp: UseSpot['special']) => !use || use.special === sp;
    const common = {
      b,
      save: s,
      ctxFn,
      onEvents: (ev: GameEvent[]) => run(() => handleEvents(ev)),
      onClose: close,
      only,
      title: use ? (
        <>
          <span className="place-emoji">{use.emoji}</span>
          {use.label}
        </>
      ) : undefined,
      onAll: use ? () => setDialog({ kind: 'building', b }) : undefined,
    };
    if (b.kind === 'jobcentre') {
      const open = placeOpen(b.id, london());
      content = (
        <PlaceDialog
          {...common}
          tabs={wants('jobs') ? [{ id: 'jobs', label: open ? 'Jobs' : 'Jobs (kiosk)', node: <JobsList save={s} onTake={takeJob} /> }] : []}
          defaultTab={use?.special === 'jobs' ? 'jobs' : s.job || use ? 'do' : 'jobs'}
          greeting={open ? `You take a ticket: #${380 + (london().mm % 60)}. Now serving: #9.` : `The shutters are down (open ${PLACE_HOURS.jobcentre.label}). The job kiosk outside still works. Mostly.`}
        />
      );
    }
    else if (b.kind === 'lettings') content = <PlaceDialog {...common} tabs={wants('homes') ? [{ id: 'homes', label: 'Homes', node: <HomesList save={s} onRent={rent} onSofa={backToSofa} /> }] : []} defaultTab={wants('homes') ? 'homes' : 'do'} greeting="Josh looks up from his phone. “Hiya! Everything’s going fast, so… yeah.”" />;
    else if (b.kind === 'tube') {
      const strike = s.flags.strike === london().dateKey;
      content = (
        <PlaceDialog
          {...common}
          tabs={(wants('travel') ? [0] : []).map(() => (
            {
              id: 'travel',
              label: strike ? 'Strike!' : 'Travel',
              node: strike ? (
                <>
                  <p className="notice">🪧 The shutters are down. A hand-written sign: “NO SERVICE TODAY. RAIL REPLACEMENT BUS OUTSIDE. SORRY (NOT SORRY).”</p>
                  <ul className="item-list">
                    {stations
                      .filter((x) => x.id !== b.tube)
                      .map((x) => (
                        <li key={x.id} className="item">
                          <div className="item-main">
                            <div className="item-name">🚌 {x.name}</div>
                            <div className="item-note">Rail replacement bus · free · about 50 minutes (via everywhere)</div>
                          </div>
                          <button className="btn btn-primary" onClick={() => replacementBus(x.id)}>
                            Get on
                          </button>
                        </li>
                      ))}
                  </ul>
                </>
              ) : (
                <TravelList from={b.tube!} snap={snap} onTravel={travelTo} />
              ),
            }
          ))}
          defaultTab={wants('travel') ? 'travel' : 'do'}
        />
      );
    }
    else if (b.id === 'busstop') content = <PlaceDialog {...common} tabs={[{ id: 'ride', label: 'Ride the 436', node: <BusList snap={snap} onRide={rideBus} /> }]} defaultTab="ride" />;
    else if (b.kind === 'home') {
      const mine = b.homeId === s.home;
      const h = HOMES[b.homeId!];
      content = (
        <PlaceDialog
          {...common}
          greeting={mine ? (s.home === 'sofa' ? 'Free! Dave’s paying the council tax and he’d like you to know that.' : `Rent ${money(s.rent)}/wk + council tax, every real Monday 09:00. ⚡ Meter ${s.meter > 0 ? money(s.meter) : 'on EMERGENCY'} · 🍄 Damp ${Math.round(s.damp)}%.${s.arrears ? ' ⚠️ You’re in arrears.' : ''}`) : b.blurb}
          closed={mine ? undefined : <p className="notice">{h.id === 'sofa' ? 'Dave is out. You don’t live here any more: the cat has taken your spot.' : `Units here go for ${money(h.rent)}/week. Enquire at Fleecems Lettings on the high street.`}</p>}
        />
      );
    } else
      content = (
        <PlaceDialog
          {...common}
          top={
            <>
              {job && s.job === job && wants('shift') ? <ShiftBanner jobId={job} save={s} onStart={() => startShift(job)} /> : null}
              {use?.special === 'shift' && (!job || s.job !== job) ? (
                <p className="notice">Staff only. {job ? `Get a job here at the Jobcentre and this is where you’ll clock in.` : ''}</p>
              ) : null}
              {b.kind === 'barber' && wants('barber') ? (
                <button className="btn btn-primary wide" disabled={s.money < 12} onClick={() => setDialog({ kind: 'barber' })}>
                  💈 Full new look · £12
                </button>
              ) : null}
            </>
          }
        />
      );
  } else if (dialog?.kind === 'billboard') {
    content = <BillboardDialog bb={dialog.bb} onClose={() => setDialog(null)} />;
  } else if (dialog?.kind === 'barber') {
    content = (
      <Creator
        mode="barber"
        initial={s.avatar}
        onBack={() => setDialog(null)}
        onDone={(_n, a: Avatar) =>
          run((out) => {
            s.money = Math.round((s.money - 12) * 100) / 100;
            s.avatar = a;
            engine.social.setMe(s.name, a);
            gainMoodlet(s, 'fresh_trim', out);
            out.push({ type: 'gossip', key: 'trim' });
            toast('Fresh look. You catch yourself in every shop window.', 'good');
            setDialog(null);
          })
        }
      />
    );
  } else if (dialog?.kind === 'shift') {
    const job = dialog.job;
    const done = (score: number, summary: string) => shiftDone(job, score, summary);
    content = (
      <div className="modal-backdrop">
        <div className="panel modal minigame-modal">{job === 'barista' ? <BaristaGame onDone={done} paused={cards.length > 0} /> : job === 'temp' ? <OfficeGame onDone={done} paused={cards.length > 0} /> : <BusGame onDone={done} paused={cards.length > 0} />}</div>
      </div>
    );
  }

  const top = cards[0];
  const goalsLeft = GOALS.some((g) => !snap.goals[g.id]);
  return (
    <div className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      <Hud snap={snap} save={s} onCancelDelivery={() => engine.cancelDelivery()} onOpenMe={() => setPhone('me')}>
        {snap.scene ? <RoomBar engine={engine} snap={snap} onOpen={() => setHereOpen(true)} onPerson={setPerson} /> : null}
        {guideIdx >= 0 && !snap.delivery ? (
          <div className="guide panel" role="status">
            <div className="guide-step">
              {guideIdx + 1}/{GUIDE_STEPS.length}
            </div>
            <div className="guide-main">
              <b>{GUIDE_STEPS[guideIdx].title}</b>
              <span>{GUIDE_STEPS[guideIdx].text(s)}</span>
            </div>
            <button
              className="btn btn-ghost btn-small guide-skip"
              onClick={() => {
                skipGuide(s);
                engine.setGuideTarget(null);
                engine.touch();
                toast('Guide off. You can find your goals in 📱 → Goals.', 'info');
              }}
            >
              Skip
            </button>
          </div>
        ) : null}
      </Hud>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.tone + (t.onTap ? ' tappable' : '')} onClick={() => t.onTap && (t.onTap(), setToasts((q) => q.filter((x) => x.id !== t.id)))}>
            {t.text}
          </div>
        ))}
      </div>
      <div className="bottom-bar">
        <button className="round-btn" onClick={() => setPhone('natter')} aria-label="Natter">
          💬
          {social.feedUnread ? <span className="badge">{social.feedUnread > 9 ? '9+' : social.feedUnread}</span> : null}
        </button>
        <div className="action-slot">
          {snap.scene && !modalUp ? (
            snap.nearUse ? (
              <button className="btn btn-action" onClick={() => engine.interactNearby()} data-testid="use-btn">
                {snap.nearUse.emoji} {snap.nearUse.label}
                <kbd className="hide-touch">E</kbd>
              </button>
            ) : (
              <button className="btn btn-action btn-soft" onClick={() => engine.inside && setDialog({ kind: 'building', b: engine.inside })} data-testid="menu-btn">
                📋 What’s here
              </button>
            )
          ) : snap.nearby && !modalUp ? (
            <button className="btn btn-action" onClick={() => engine.interactNearby()}>
              {snap.nearby.spot ? 'Visit' : engine.canEnter(buildingById(snap.nearby.id)) ? '🚪 Go in' : 'Enter'} {snap.nearby.name.split(' · ')[0]}
              <kbd className="hide-touch">E</kbd>
            </button>
          ) : null}
        </div>
        <button className="round-btn" onClick={() => setPhone('home')} aria-label="Phone">
          📱
          {social.dmUnread ? <span className="badge">{social.dmUnread > 9 ? '9+' : social.dmUnread}</span> : goalsLeft ? <span className="dot" /> : null}
        </button>
      </div>
      {content}
      {hereOpen && snap.scene && !dialog ? (
        <HereSheet
          engine={engine}
          snap={snap}
          toast={toast}
          onClose={() => setHereOpen(false)}
          onPerson={(p) => setPerson(p)}
          onMenu={() => {
            setHereOpen(false);
            if (engine.inside) setDialog({ kind: 'building', b: engine.inside });
          }}
        />
      ) : null}
      {person ? (
        <ProfileCard
          key={person.key}
          engine={engine}
          who={person}
          snap={snap}
          onClose={() => setPerson(null)}
          onEvents={(ev) => run(() => handleEvents(ev))}
          openDM={(id) => {
            setPerson(null);
            setHereOpen(false);
            setPhone(`thread:${id}`);
          }}
        />
      ) : null}
      {phone ? (
        <Phone
          engine={engine}
          snap={snap}
          app={phone}
          setApp={setPhone}
          onClose={() => setPhone(null)}
          onEvents={(ev) => run(() => handleEvents(ev))}
          toast={toast}
          onQuit={() => {
            writeSave(s);
            onQuit();
          }}
          onReset={() => {
            localStorage.removeItem(SAVE_KEY);
            localStorage.removeItem('uklife.social.' + s.id);
            engine.dispose();
            location.reload();
          }}
        />
      ) : null}
      {top ? (
        <EventCard
          emoji={top.emoji}
          kicker={top.kicker}
          title={top.title}
          choices={(top.choices ?? [{ label: 'OK', onPick: () => {} }]).map((c) => ({
            ...c,
            onPick: () => {
              c.onPick();
              setCards((q) => q.filter((x) => x.id !== top.id));
              engine.touch();
              writeSave(s);
            },
          }))}
        >
          {top.body}
        </EventCard>
      ) : null}
      {travel ? (
        <div className="travel">
          <div className="travel-train">{travel.icon}</div>
          <div className="travel-text">{travel.text}</div>
        </div>
      ) : null}
    </div>
  );
}

// Modal is re-exported for the minigame wrapper and tests
export { Modal };
const noopSub = () => () => {};
const nullSnap = () => null;
