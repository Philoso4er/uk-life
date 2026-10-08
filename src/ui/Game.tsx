import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Engine, type Snapshot } from '../game/engine';
import { GOALS, HOMES, JOBS, SAVE_KEY, applyItem, clamp, completeGoal, finishShift, money, shiftPay, sleep, writeSave, type GameEvent, type Item } from '../game/economy';
import type { SaveState, JobId, HomeId, Avatar } from '../game/types';
import { buildingById, doorFront, stations, TUBE_FARE, type Billboard, type Building } from '../game/world';
import { createTransport } from '../net';
import { BillboardDialog, DecorDialog, HomeDialog, JobCentreDialog, LettingsDialog, Modal, PhoneMenu, ShiftBanner, ShopDialog, TubeDialog } from './Dialogs';
import { BaristaGame, BusGame, OfficeGame } from './MiniGames';
import { Hud } from './Hud';
import { Chat } from './Chat';
import { Creator } from './Creator';

type Dialog =
  | { kind: 'building'; b: Building }
  | { kind: 'billboard'; bb: Billboard }
  | { kind: 'phone' }
  | { kind: 'barber' }
  | { kind: 'shift'; job: JobId }
  | { kind: 'result'; title: string; pay: number; summary: string };

interface Toast {
  id: number;
  text: string;
  tone: 'good' | 'bad' | 'info';
}
interface PhoneMsg {
  id: number;
  from: string;
  text: string;
  tone?: 'good' | 'bad' | 'info';
  lines?: { label: string; amount: number }[];
}

const ANNOUNCEMENTS = [
  'Mind the gap between the train and the platform.',
  'We are being held at a red signal. Thank you for your patience.',
  'Please take all your belongings with you. Including the man asleep in the corner.',
  'This is a Peckwell-bound train. (They all are.)',
  'Due to a passenger being taken ill, nobody makes eye contact.',
  'See it. Say it. Sorted. (Sorry.)',
];

let toastId = 1;

export function Game({ save, onQuit }: { save: SaveState; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<Engine | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [phoneQ, setPhoneQ] = useState<PhoneMsg[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [travel, setTravel] = useState<string | null>(null);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const engineRef = useRef<Engine | null>(null);
  const handleEvents = useCallback(
    (ev: GameEvent[]) => {
      const e = engineRef.current;
      for (const x of ev) {
        if (x.type === 'toast') toast(x.text, x.tone);
        else if (x.type === 'goal') toast(`✓ Goal: ${GOALS.find((g) => g.id === x.id)?.label}`, 'good');
        else if (x.type === 'phone') setPhoneQ((q) => [...q, { id: toastId++, from: x.from, text: x.text, tone: x.tone, lines: x.lines }]);
        else if (x.type === 'passout' && e) {
          const s = e.save;
          const home = buildingById(HOMES[s.home].building);
          const out: GameEvent[] = [];
          e.cancelDelivery();
          sleep(s, out);
          const cab = Math.min(s.money, 9.5);
          s.money -= cab;
          s.mood = clamp(s.mood - 12);
          s.energy = 60;
          const f = doorFront(home);
          e.teleport(f.x, f.y);
          setDialog(null);
          setPhoneQ((q) => [...q, { id: toastId++, from: 'Your bank', text: `You passed out from exhaustion on the 436 and woke up at the end of the line. Took a minicab home. -${money(cab)}. Maybe get some sleep, yeah?`, tone: 'bad' }]);
          handleEventsRef.current(out.filter((o) => o.type !== 'passout'));
          e.touch();
        }
      }
    },
    [toast],
  );
  const handleEventsRef = useRef(handleEvents);
  handleEventsRef.current = handleEvents;

  // ---- engine lifecycle
  useEffect(() => {
    const e = new Engine(canvasRef.current!, save, {
      onInteract: (b) => setDialog({ kind: 'building', b }),
      onBillboard: (bb) => setDialog({ kind: 'billboard', bb }),
      onEvents: (ev) => handleEventsRef.current(ev),
      onDeliveryDone: (earned, onTime, total) => {
        const out: GameEvent[] = [];
        finishShift(e.save, JOBS.rider, earned, out);
        e.touch();
        handleEventsRef.current(out);
        setDialog({ kind: 'result', title: 'Delivery shift done', pay: earned, summary: `${onTime}/${total} drops on time. ${onTime === total ? 'Five stars. The chips were still warm.' : onTime ? 'Mixed reviews. One customer says you "looked stressed".' : 'One star: "chips were cold, rider was sweaty".'}` });
      },
    });
    engineRef.current = e;
    setEngine(e);
    let alive = true;
    createTransport().then((t) => {
      if (alive) void e.start(t);
    });
    const params = new URLSearchParams(location.search);
    if (params.has('debug')) (window as unknown as { __ukl: unknown }).__ukl = { engine: e, setDialog, handle: (ev: GameEvent[]) => handleEventsRef.current(ev) };
    const saver = setInterval(() => writeSave(e.save), 4000);
    const onHide = () => writeSave(e.save);
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

  // pause the world whenever something modal is up
  const modalUp = !!dialog || phoneQ.length > 0 || !!travel;
  useEffect(() => {
    engine?.setPaused(modalUp);
  }, [engine, modalUp]);

  // keyboard shortcuts
  useEffect(() => {
    const k = (ev: KeyboardEvent) => {
      const typing = (document.activeElement as HTMLElement | null)?.tagName === 'INPUT';
      if (ev.key === 'Escape') {
        if (phoneQ.length) setPhoneQ((q) => q.slice(1));
        else if (dialog && dialog.kind !== 'shift') setDialog(null);
        else if (chatOpen) setChatOpen(false);
      } else if (!typing && !modalUp && (ev.key === 't' || ev.key === 'T' || ev.key === '/')) {
        ev.preventDefault();
        setChatOpen(true);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [dialog, chatOpen, phoneQ.length, modalUp]);

  if (!snap || !engine)
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
  const buy = (i: Item) =>
    run((out) => {
      if (i.special === 'haircut') {
        if (s.money < i.price) return toast('Card declined. The barber shakes his head slowly.', 'bad');
        setDialog({ kind: 'barber' });
        return;
      }
      if (applyItem(s, i, out) && !i.special) toast(`${i.name}: ${i.note}`, 'good');
      else if (i.special === 'oyster' && s.oyster) toast(`Oyster topped up: ${money(s.oyster)}`, 'good');
      else if (i.special === 'umbrella' && s.umbrellaUntil > s.minutes) toast('Brolly acquired. Mood is now rain-proof (for about 3 days).', 'good');
    });
  const takeJob = (j: JobId) =>
    run((out) => {
      s.job = j;
      completeGoal(s, 'job', out);
      const b = buildingById(JOBS[j].building);
      toast(`You’re now a ${JOBS[j].title}! Head to ${b.name} to start a shift.`, 'good');
      setDialog(null);
    });
  const rent = (h: HomeId) =>
    run((out) => {
      const home = HOMES[h];
      if (s.money < home.rent * 2) return;
      s.money -= home.rent * 2;
      s.home = h;
      s.rent = home.rent;
      s.arrears = 0;
      s.lastBillWeek = Math.floor(s.minutes / 10080) + 1;
      completeGoal(s, 'rent', out);
      out.push({ type: 'phone', from: home.landlord, text: h === 'flatshare' ? 'Welcome to Grimewood Court! House rules: no guests, no heating before November, label your milk. Rent every Monday 9am, standing order pls. Nigel 👍' : h === 'studio' ? 'Dear Tenant, welcome to Victoria Terrace. Please find attached a 46-page inventory. Any scuffs will be deducted from your deposit. Regards, PropertyHub' : 'Welcome to The Vantage! I’m Marcus, your concierge. I’ll be holding your parcels and judging your takeaway orders. Rent: Mondays, 9am.', tone: 'good' });
      setDialog(null);
    });
  const backToSofa = () =>
    run((out) => {
      s.home = 'sofa';
      s.rent = 0;
      s.arrears = 0;
      out.push({ type: 'phone', from: 'Dave', text: 'Back on the sofa?? Course you can mate. The cat’s missed you. (The cat has not missed you.)', tone: 'info' });
      setDialog(null);
    });
  const doSleep = () =>
    run((out) => {
      sleep(s, out);
      setDialog(null);
    });
  const travelTo = (id: string) => {
    if (s.oyster < TUBE_FARE) return;
    s.oyster = Math.round((s.oyster - TUBE_FARE) * 100) / 100;
    s.stats.tubeTrips++;
    s.minutes += 12;
    const out: GameEvent[] = [];
    completeGoal(s, 'tube', out);
    setDialog(null);
    setTravel(ANNOUNCEMENTS[Math.floor(Math.random() * ANNOUNCEMENTS.length)]);
    setTimeout(() => {
      const st = stations.find((x) => x.id === id)!;
      const b = buildingById(st.id);
      const f = doorFront(b);
      engine.teleport(f.x, f.y);
      setTravel(null);
      engine.touch();
      handleEvents(out);
      toast(`Arrived at ${st.name}.`, 'info');
    }, 1500);
  };
  const startShift = (job: JobId) => {
    if (s.energy < 20) return toast('You’re too knackered to work. Sleep or caffeine.', 'bad');
    if (job === 'rider') {
      setDialog(null);
      engine.startDelivery();
      toast('Shift started! Ride to the green marker. Faster drops = bigger tips.', 'good');
      return;
    }
    setDialog({ kind: 'shift', job });
  };
  const shiftDone = (job: JobId, score: number, summary: string) => {
    const pay = shiftPay(JOBS[job], score);
    run((out) => finishShift(s, JOBS[job], pay, out));
    setDialog({ kind: 'result', title: `${JOBS[job].title} shift done`, pay, summary });
  };

  // ---- dialog rendering
  let content: React.ReactNode = null;
  if (dialog?.kind === 'building') {
    const b = dialog.b;
    const close = () => setDialog(null);
    const banner = (job: JobId) => (s.job === job ? <ShiftBanner jobId={job} snap={snap} onStart={() => startShift(job)} /> : null);
    switch (b.kind) {
      case 'bakery':
        content = <ShopDialog shopId="crumbs" building={b} snap={snap} onBuy={buy} onClose={close} />;
        break;
      case 'cornershop':
        content = <ShopDialog shopId="kwik" building={b} snap={snap} onBuy={buy} onClose={close} />;
        break;
      case 'cafe':
        content = <ShopDialog shopId="pret" building={b} snap={snap} onBuy={buy} onClose={close} extra={banner('barista')} />;
        break;
      case 'chicken':
        content = <ShopDialog shopId="pfc" building={b} snap={snap} onBuy={buy} onClose={close} extra={banner('rider')} />;
        break;
      case 'pub':
        content = <ShopDialog shopId="pub" building={b} snap={snap} onBuy={buy} onClose={close} />;
        break;
      case 'barber':
        content = <ShopDialog shopId="barber" building={b} snap={snap} onBuy={buy} onClose={close} />;
        break;
      case 'jobcentre':
        content = <JobCentreDialog save={s} onTake={takeJob} onClose={close} />;
        break;
      case 'lettings':
        content = <LettingsDialog save={s} onRent={rent} onSofa={backToSofa} onClose={close} />;
        break;
      case 'home':
        content = (
          <HomeDialog
            building={b}
            save={s}
            onSleep={doSleep}
            onCuppa={() =>
              run(() => {
                s.mood = clamp(s.mood + 5);
                s.minutes += 20;
                toast('You have a cup of tea. Everything is, briefly, fine.', 'good');
                setDialog(null);
              })
            }
            onClose={close}
          />
        );
        break;
      case 'tube':
        content = <TubeDialog from={b.tube!} snap={snap} onTravel={travelTo} onTopUp={() => run(() => { s.money -= 10; s.oyster += 10; toast('Topped up £10. Contactless would’ve been easier but here we are.', 'good'); })} onClose={close} />;
        break;
      case 'office':
      case 'busgarage': {
        const job: JobId = b.kind === 'office' ? 'temp' : 'bus';
        content =
          s.job === job ? (
            <Modal title={b.name} sub={b.blurb} onClose={close}>
              <ShiftBanner jobId={job} snap={snap} onStart={() => startShift(job)} />
            </Modal>
          ) : (
            <DecorDialog building={b} snap={snap} onClose={close} onDo={(c, m, en, t) => run(() => { s.money -= c; s.mood = clamp(s.mood + m); s.energy = clamp(s.energy + en); toast(t, 'info'); setDialog(null); })} />
          );
        break;
      }
      default:
        content = <DecorDialog building={b} snap={snap} onClose={close} onDo={(c, m, en, t) => run(() => { s.money -= c; s.mood = clamp(s.mood + m); s.energy = clamp(s.energy + en); s.minutes += 30; toast(t, 'info'); setDialog(null); })} />;
    }
  } else if (dialog?.kind === 'billboard') {
    content = <BillboardDialog bb={dialog.bb} onClose={() => setDialog(null)} />;
  } else if (dialog?.kind === 'phone') {
    content = (
      <PhoneMenu
        save={s}
        snap={snap}
        onClose={() => setDialog(null)}
        onQuit={() => {
          writeSave(s);
          onQuit();
        }}
        onReset={() => {
          localStorage.removeItem(SAVE_KEY);
          engine.dispose();
          location.reload();
        }}
      />
    );
  } else if (dialog?.kind === 'barber') {
    content = (
      <Creator
        mode="barber"
        initial={s.avatar}
        onBack={() => setDialog(null)}
        onDone={(_n, a: Avatar) =>
          run(() => {
            s.money -= 12;
            s.avatar = a;
            s.mood = clamp(s.mood + 15);
            toast('Fresh trim. You catch yourself in every shop window.', 'good');
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
  } else if (dialog?.kind === 'result') {
    content = (
      <Modal title={dialog.title} onClose={() => setDialog(null)} className="result-modal">
        <div className="result-pay">+{money(dialog.pay)}</div>
        <p>{dialog.summary}</p>
        <p className="muted small">Paid straight into your account. HMRC have been notified (they haven’t).</p>
        <button className="btn btn-primary" onClick={() => setDialog(null)} autoFocus>
          Lovely
        </button>
      </Modal>
    );
  }

  const phone = phoneQ[0];
  return (
    <div className="game">
      <canvas ref={canvasRef} className="game-canvas" />
      <Hud snap={snap} save={s} onCancelDelivery={() => engine.cancelDelivery()} />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.tone}>
            {t.text}
          </div>
        ))}
      </div>
      <div className="bottom-bar">
        <button className="round-btn" onClick={() => setChatOpen((o) => !o)} aria-label="Chat">
          💬
        </button>
        <div className="action-slot">
          {snap.nearby && !modalUp ? (
            <button className="btn btn-action" onClick={() => engine.interactNearby()}>
              Enter {snap.nearby.name.split(' · ')[0]}
              <kbd className="hide-touch">E</kbd>
            </button>
          ) : null}
        </div>
        <button className="round-btn" onClick={() => setDialog({ kind: 'phone' })} aria-label="Phone menu">
          📱
          {GOALS.some((g) => !snap.goals[g.id]) ? <span className="dot" /> : null}
        </button>
      </div>
      {chatOpen ? (
        <Chat
          snap={snap}
          onSend={(t) => {
            const err = engine.sendChat(t);
            if (err) toast(err, 'bad');
            else
              run((out) => {
                completeGoal(s, 'chat', out);
              });
            return !err;
          }}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
      {content}
      {phone ? (
        <div className="modal-backdrop">
          <div className={'phone-msg panel ' + (phone.tone ?? '')} role="alertdialog">
            <div className="phone-notch" />
            <div className="phone-from">
              <span className="avatar-dot">{phone.from[0]}</span>
              <div>
                <b>{phone.from}</b>
                <div className="muted small">now</div>
              </div>
            </div>
            <div className="bubble-msg">{phone.text}</div>
            {phone.lines ? (
              <div className="bill">
                {phone.lines.map((l) => (
                  <div key={l.label} className="bill-row">
                    <span>{l.label}</span>
                    <b>-{money(l.amount)}</b>
                  </div>
                ))}
                <div className="bill-row total">
                  <span>Balance now</span>
                  <b>{money(s.money)}</b>
                </div>
              </div>
            ) : null}
            <button className="btn btn-primary" autoFocus onClick={() => setPhoneQ((q) => q.slice(1))}>
              {phone.tone === 'bad' ? 'Ugh. Fine.' : 'Cheers'}
            </button>
          </div>
        </div>
      ) : null}
      {travel ? (
        <div className="travel">
          <div className="travel-train">🚇</div>
          <div className="travel-text">{travel}</div>
        </div>
      ) : null}
    </div>
  );
}

const noopSub = () => () => {};
const nullSnap = () => null;
