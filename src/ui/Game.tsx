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
import { Hud } from './Hud';
import { Creator } from './Creator';
import { PlaceDialog, ctxNow } from './Place';
import { Phone, type PhoneApp } from './Phone';

type Dialog = { kind: 'building'; b: Building } | { kind: 'billboard'; bb: Billboard } | { kind: 'barber' } | { kind: 'shift'; job: JobId };

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
  const phoneRef = useRef(phone);
  phoneRef.current = phone;

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info', onTap?: () => void) => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-2), { id, text, tone, onTap }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), onTap ? 5200 : 3800);
  }, []);
  const card = useCallback((c: Omit<Card, 'id'>) => setCards((q) => [...q, { ...c, id: toastId++ }]), []);

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
        else if (x.type === 'phone' && e) {
          const a = x.from === 'Mum' ? contactAuthor('mum') : x.from === 'Dave' ? contactAuthor('dave') : systemAuthor(x.from);
          e.social.incoming(a, x.text, { tone: x.tone, lines: x.lines }, false);
          if (x.quiet) toast(`✉️ ${x.from}: ${x.text}`, x.tone ?? 'info', () => setPhone(`thread:${a.id}`));
          else
            card({
              emoji: x.lines ? '🧾' : '📱',
              kicker: `New message · ${x.from}`,
              title: x.lines ? 'Rent day' : x.from,
              body: (
                <>
                  <p>{x.text}</p>
                  {x.lines ? (
                    <div className="bill">
                      {x.lines.map((l) => (
                        <div key={l.label} className="bill-row">
                          <span>{l.label}</span>
                          <b>-{money(l.amount)}</b>
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
      onBillboard: (bb) => setDialog({ kind: 'billboard', bb }),
      onEvents: (ev) => handleEventsRef.current(ev),
      onDeliveryDone: (earned, onTime, total) => {
        const out: GameEvent[] = [];
        finishShift(e.save, JOBS.rider, earned, out);
        e.touch();
        handleEventsRef.current(out);
        card({ emoji: '🛵', kicker: 'Delivery shift done', title: `+${money(earned)}`, body: <p>{onTime}/{total} drops on time. {onTime === total ? 'Five stars. The chips were still warm.' : onTime ? 'Mixed reviews. One customer says you “looked stressed”.' : 'One star: “chips were cold, rider was sweaty”.'}</p>, choices: [{ label: 'Lovely', onPick: () => {} }] });
      },
      onIncoming: (kind, from, text) => {
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
    if (params.has('debug')) (window as unknown as { __ukl: unknown }).__ukl = { engine: e, setDialog, setPhone, setClockOffset, getClockOffset, london, msUntilRent, writeSave, card, tel: () => { const p = e.social.npcPost(e.brain.author(PERSONAS[0]), 'Can’t complain 👍', { likes: 6 }); e.brain.complain(p.id); e.social.pump(Date.now() + 120000); }, handle: (ev: GameEvent[]) => handleEventsRef.current(ev) };
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
  const modalUp = !!dialog || !!phone || cards.length > 0 || !!travel;
  useEffect(() => {
    engine?.setPaused(modalUp);
  }, [engine, modalUp]);
  useEffect(() => {
    engine?.setIndoors(dialog?.kind === 'building' && dialog.b.kind !== 'spot');
  }, [engine, dialog]);

  // keyboard shortcuts
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement | null)?.tagName ?? '');
      if (ev.key === 'Escape') {
        if (cards.length) return;
        if (phone) setPhone(null);
        else if (dialog && dialog.kind !== 'shift') setDialog(null);
      } else if (!typing && !modalUp && (ev.key === 't' || ev.key === 'T' || ev.key === '/')) {
        ev.preventDefault();
        setPhone('natter');
      } else if (!typing && !modalUp && (ev.key === 'p' || ev.key === 'P')) setPhone('home');
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [dialog, phone, cards.length, modalUp]);

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
    journey('🚇', pickOne(ANNOUNCEMENTS), buildingById(st.id), () => {
      handleEvents(out);
      toast(`Arrived at ${st.name}.`, 'info');
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
    if (job === 'rider') {
      setDialog(null);
      engine.startDelivery();
      toast('Shift started! Ride to the green marker. Faster drops = bigger tips.', 'good');
      return;
    }
    setDialog({ kind: 'shift', job });
  };
  const shiftDone = (job: JobId, score: number, summary: string) => {
    const mult = levelPay(s) * moodPayMult(effectiveMood(s, snap.raining));
    const pay = shiftPay(JOBS[job], score, mult);
    run((out) => finishShift(s, JOBS[job], pay, out));
    setDialog(null);
    card({ emoji: job === 'barista' ? '☕' : job === 'temp' ? '📎' : '🚌', kicker: `${JOBS[job].title} shift done`, title: `+${money(pay)}`, body: <p>{summary}</p>, choices: [{ label: 'Lovely', onPick: () => {} }] });
  };

  // ---- dialog rendering
  let content: React.ReactNode = null;
  if (dialog?.kind === 'building') {
    const b = dialog.b;
    const close = () => setDialog(null);
    const ctxFn = () => ctxNow(snap.raining, engine.peopleNear(b.id));
    const job = EMPLOYER[b.id];
    const common = { b, save: s, ctxFn, onEvents: (ev: GameEvent[]) => run(() => handleEvents(ev)), onClose: close };
    if (b.kind === 'jobcentre') content = <PlaceDialog {...common} tabs={[{ id: 'jobs', label: 'Jobs', node: <JobsList save={s} onTake={takeJob} /> }]} defaultTab={s.job ? 'do' : 'jobs'} greeting={`You take a ticket: #${380 + (london().mm % 60)}. Now serving: #9.`} />;
    else if (b.kind === 'lettings') content = <PlaceDialog {...common} tabs={[{ id: 'homes', label: 'Homes', node: <HomesList save={s} onRent={rent} onSofa={backToSofa} /> }]} defaultTab="homes" greeting="Josh looks up from his phone. “Hiya! Everything’s going fast, so… yeah.”" />;
    else if (b.kind === 'tube') content = <PlaceDialog {...common} tabs={[{ id: 'travel', label: 'Travel', node: <TravelList from={b.tube!} snap={snap} onTravel={travelTo} /> }]} defaultTab="travel" />;
    else if (b.id === 'busstop') content = <PlaceDialog {...common} tabs={[{ id: 'ride', label: 'Ride the 436', node: <BusList snap={snap} onRide={rideBus} /> }]} defaultTab="ride" />;
    else if (b.kind === 'home') {
      const mine = b.homeId === s.home;
      const h = HOMES[b.homeId!];
      content = (
        <PlaceDialog
          {...common}
          greeting={mine ? (s.home === 'sofa' ? 'Free! Dave’s paying the council tax and he’d like you to know that.' : `Rent ${money(s.rent)}/wk + council tax ${money(h.councilTax)}/wk, every real Monday 09:00.${s.arrears ? ' ⚠️ You’re in arrears.' : ''}`) : b.blurb}
          closed={mine ? undefined : <p className="notice">{h.id === 'sofa' ? 'Dave is out. You don’t live here any more: the cat has taken your spot.' : `Units here go for ${money(h.rent)}/week. Enquire at Fleecems Lettings on the high street.`}</p>}
        />
      );
    } else
      content = (
        <PlaceDialog
          {...common}
          top={
            <>
              {job && s.job === job ? <ShiftBanner jobId={job} save={s} onStart={() => startShift(job)} /> : null}
              {b.kind === 'barber' ? (
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
        <div className="panel modal minigame-modal">{job === 'barista' ? <BaristaGame onDone={done} /> : job === 'temp' ? <OfficeGame onDone={done} /> : <BusGame onDone={done} />}</div>
      </div>
    );
  }

  const top = cards[0];
  const goalsLeft = GOALS.some((g) => !snap.goals[g.id]);
  return (
    <div className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      <Hud snap={snap} save={s} onCancelDelivery={() => engine.cancelDelivery()} onOpenMe={() => setPhone('me')} />
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
          {snap.nearby && !modalUp ? (
            <button className="btn btn-action" onClick={() => engine.interactNearby()}>
              {snap.nearby.spot ? 'Visit' : 'Enter'} {snap.nearby.name.split(' · ')[0]}
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
