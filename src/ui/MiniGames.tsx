import { useCallback, useEffect, useRef, useState } from 'react';

const useCountdown = (secs: number, running: boolean, onEnd: () => void, paused = false) => {
  const [left, setLeft] = useState(secs);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (!running) return;
    let remaining = secs;
    let last = performance.now();
    const id = setInterval(() => {
      const t = performance.now();
      if (!pausedRef.current) remaining = Math.max(0, remaining - (t - last) / 1000);
      last = t;
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        endRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [secs, running]);
  return left;
};

function Timer({ left, total }: { left: number; total: number }) {
  return (
    <div className="mg-timer">
      <div className="mg-timer-bar" style={{ width: `${(left / total) * 100}%`, background: left < 8 ? '#e74c3c' : '#ffd23f' }} />
      <span>{Math.ceil(left)}s</span>
    </div>
  );
}

// ------------------------------------------------------------------ barista
const INGREDIENTS = [
  { id: 'espresso', label: 'Espresso', icon: '☕' },
  { id: 'whole', label: 'Whole milk', icon: '🥛' },
  { id: 'oat', label: 'Oat milk', icon: '🌾' },
  { id: 'foam', label: 'Foam', icon: '☁️' },
  { id: 'syrup', label: 'Caramel', icon: '🍯' },
  { id: 'ice', label: 'Ice', icon: '🧊' },
  { id: 'choc', label: 'Choc dust', icon: '🍫' },
];
const DRINKS = [
  { name: 'Flat white', steps: ['espresso', 'whole'] },
  { name: 'Oat flat white', steps: ['espresso', 'oat'] },
  { name: 'Oat latte', steps: ['espresso', 'oat', 'foam'] },
  { name: 'Cappuccino', steps: ['espresso', 'whole', 'foam', 'choc'] },
  { name: 'Iced oat latte', steps: ['ice', 'espresso', 'oat'] },
  { name: 'Caramel latte', steps: ['espresso', 'syrup', 'whole', 'foam'] },
  { name: 'Double espresso', steps: ['espresso', 'espresso'] },
  { name: 'Babyccino (it’s for a dog)', steps: ['foam', 'choc'] },
];
const CUP_NAMES = [['Siobhan', 'Shivorn'], ['John', 'Jhon'], ['Mohammed', 'Mohamed'], ['Sarah', 'Sarah (no H)'], ['Xander', 'Zander'], ['Niamh', 'Neve'], ['Tarquin', 'Tarkwin'], ['Ngozi', 'Gozi'], ['Dave', 'Dave'], ['Ffion', 'Fion']];
const COMPLAINTS = ['"I said OAT."', '"Is this... dairy?"', '"Erm, that’s not what I ordered, babe."', '"I’m literally lactose intolerant."', '"Can you start again? Sorry. Sorry."'];

export function BaristaGame({ onDone, paused = false }: { onDone: (score: number, summary: string) => void; paused?: boolean }) {
  const TOTAL = 35;
  const [order, setOrder] = useState(() => newOrder());
  const [progress, setProgress] = useState(0);
  const [served, setServed] = useState(0);
  const [msg, setMsg] = useState('Order up! Tap the ingredients in order.');
  const [shake, setShake] = useState(false);
  const [running, setRunning] = useState(true);
  const servedRef = useRef(0);
  const end = useCallback(() => {
    setRunning(false);
    const n = servedRef.current;
    onDone(Math.min(1, n / 7), `${n} drink${n === 1 ? '' : 's'} served. ${n >= 7 ? 'Absolute machine.' : n >= 4 ? 'Solid shift.' : 'The queue is now out the door and round the corner.'}`);
  }, [onDone]);
  const left = useCountdown(TOTAL, running, end, paused);

  function newOrder() {
    const d = DRINKS[Math.floor(Math.random() * DRINKS.length)];
    const n = CUP_NAMES[Math.floor(Math.random() * CUP_NAMES.length)];
    return { ...d, customer: n[0], cup: n[1] };
  }
  const tap = (id: string) => {
    if (!running || paused) return;
    if (order.steps[progress] === id) {
      if (progress + 1 >= order.steps.length) {
        servedRef.current += 1;
        setServed(servedRef.current);
        setMsg(`Served "${order.cup}" ✓ (${order.customer} looks at the cup. Says nothing.)`);
        setOrder(newOrder());
        setProgress(0);
      } else setProgress(progress + 1);
    } else {
      setMsg(COMPLAINTS[Math.floor(Math.random() * COMPLAINTS.length)] + ' Start again.');
      setProgress(0);
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  };
  return (
    <div className="minigame">
      <div className="mg-head">
        <h3>☕ Barista shift · Prêt-à-Pricey</h3>
        <Timer left={left} total={TOTAL} />
      </div>
      <div className={'mg-order' + (shake ? ' shake' : '')}>
        <div className="mg-cup">
          <div className="mg-cup-name">{order.cup}</div>
        </div>
        <div>
          <div className="mg-order-title">{order.name}</div>
          <div className="mg-steps">
            {order.steps.map((s, i) => {
              const ing = INGREDIENTS.find((x) => x.id === s)!;
              return (
                <span key={i} className={'mg-step' + (i < progress ? ' done' : i === progress ? ' next' : '')}>
                  {ing.icon} {ing.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mg-msg">{msg}</p>
      <div className="mg-grid">
        {INGREDIENTS.map((i) => (
          <button key={i.id} className="mg-btn" onClick={() => tap(i.id)}>
            <span className="mg-btn-icon">{i.icon}</span>
            {i.label}
          </button>
        ))}
      </div>
      <div className="mg-foot">Served: {served}</div>
    </div>
  );
}

// ------------------------------------------------------------------ office temp
type Ans = 'reply' | 'archive' | 'report';
const EMAILS: { from: string; subject: string; answer: Ans }[] = [
  { from: 'Linda (your boss)', subject: 'Need this by EOD pls x', answer: 'reply' },
  { from: 'Linda (your boss)', subject: 'Quick call? 5 mins (it will be 50 mins)', answer: 'reply' },
  { from: 'Client · Hargreaves & Sons', subject: 'Invoice query (third time of asking)', answer: 'reply' },
  { from: 'Linda (your boss)', subject: 'Per my last email...', answer: 'reply' },
  { from: 'Client · Pemberton Ltd', subject: 'Can we circle back on the deck?', answer: 'reply' },
  { from: 'All Staff', subject: 'RE: RE: RE: RE: Who took my yoghurt', answer: 'archive' },
  { from: 'Facilities', subject: 'Cake in the kitchen!! (Gone now)', answer: 'archive' },
  { from: 'Synergy Weekly', subject: '10 ways to leverage your synergies', answer: 'archive' },
  { from: 'HR', subject: 'Mandatory fun: team bowling, Thursday', answer: 'archive' },
  { from: 'All Staff', subject: 'Reply-all: please remove me from this list', answer: 'archive' },
  { from: '1T-Supp0rt@m1crosoft-help.biz', subject: 'Ur password is expire, click here NOW', answer: 'report' },
  { from: 'R0yal Ma1l', subject: 'Parcel held: pay £1.99 customs fee', answer: 'report' },
  { from: 'HMRC Refunds Dept (gmail.com)', subject: 'You are due a tax refund of £847.20', answer: 'report' },
  { from: 'CEO (definitely)', subject: 'Buy 10 gift cards, urgent, keep it secret', answer: 'report' },
];

export function OfficeGame({ onDone, paused = false }: { onDone: (score: number, summary: string) => void; paused?: boolean }) {
  const TOTAL = 35;
  const [mail, setMail] = useState(() => EMAILS[Math.floor(Math.random() * EMAILS.length)]);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const [msg, setMsg] = useState('Inbox: 2,847 unread. Let’s go.');
  const [running, setRunning] = useState(true);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const end = useCallback(() => {
    setRunning(false);
    const { right, wrong } = statsRef.current;
    const total = right + wrong;
    const acc = total ? right / total : 0;
    const score = acc * Math.min(1, total / 10);
    onDone(score, `${right}/${total} emails handled correctly. ${score > 0.8 ? 'Linda says "great stuff" (highest honour).' : score > 0.45 ? 'Linda is "a little concerned".' : 'You replied-all to the yoghurt thread. Legend, but no.'}`);
  }, [onDone]);
  const left = useCountdown(TOTAL, running, end, paused);
  const answer = (a: Ans) => {
    if (!running || paused) return;
    const ok = a === mail.answer;
    setStats((s) => ({ right: s.right + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1) }));
    setMsg(ok ? ['Nice.', 'Inbox zero is a myth but nice.', 'Efficient.', 'Linda would be proud.'][Math.floor(Math.random() * 4)] : mail.answer === 'report' ? 'That was phishing! IT are sending you on a course.' : mail.answer === 'reply' ? 'You ignored Linda. Linda noticed.' : 'You replied to a reply-all. Everyone hates you now.');
    let next = mail;
    while (next === mail) next = EMAILS[Math.floor(Math.random() * EMAILS.length)];
    setMail(next);
  };
  return (
    <div className="minigame">
      <div className="mg-head">
        <h3>💼 Temp shift · Synergy House</h3>
        <Timer left={left} total={TOTAL} />
      </div>
      <div className="mg-rules">
        <span>
          <b>Reply</b> to Linda & clients
        </span>
        <span>
          <b>Archive</b> reply-alls, cake & HR
        </span>
        <span>
          <b>Report</b> anything dodgy
        </span>
      </div>
      <div className="mg-email">
        <div className="mg-email-from">From: {mail.from}</div>
        <div className="mg-email-subject">{mail.subject}</div>
      </div>
      <p className="mg-msg">{msg}</p>
      <div className="mg-row">
        <button className="mg-btn wide" onClick={() => answer('reply')}>
          ↩️ Reply
        </button>
        <button className="mg-btn wide" onClick={() => answer('archive')}>
          🗄️ Archive
        </button>
        <button className="mg-btn wide danger" onClick={() => answer('report')}>
          🚩 Report phish
        </button>
      </div>
      <div className="mg-foot">
        ✓ {stats.right} · ✗ {stats.wrong}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ bus driver
const BUS_QUIPS = ['"Does this go to Peckwell?" (It says PECKWELL on the front.)', 'Someone taps their Oyster four times. "Is it working?"', 'A man boards with a full-size fridge freezer.', '"Cheers drive!" (×14)', 'A schoolkid rings the bell 37 times.', 'Somebody is eating a hot McDonald’s upstairs. Everyone knows.', 'A pensioner gives you a Werther’s Original. Best part of the day.'];

export function BusGame({ onDone, paused = false }: { onDone: (score: number, summary: string) => void; paused?: boolean }) {
  const STOPS = 6;
  const STOP_AT = 0.72;
  const [stop, setStop] = useState(0);
  const [pos, setPos] = useState(0);
  const [phase, setPhase] = useState<'driving' | 'boarding' | 'done'>('driving');
  const [msg, setMsg] = useState('Tap STOP (or press Space) so the bus doors line up with the stop.');
  const scores = useRef<number[]>([]);
  const posRef = useRef(0);
  const speedRef = useRef(0.32);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (phase !== 'driving') return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = pausedRef.current ? 0 : (now - last) / 1000;
      last = now;
      posRef.current += speedRef.current * dt;
      if (posRef.current > 1.05) {
        brake();
        return;
      }
      setPos(posRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stop]);

  const brake = () => {
    if (phase !== 'driving' || pausedRef.current) return;
    const err = Math.abs(posRef.current - STOP_AT);
    const s = Math.max(0, 1 - err / 0.16);
    scores.current.push(s);
    setPos(posRef.current);
    setPhase('boarding');
    const verdict = s > 0.85 ? 'Perfect stop!' : s > 0.5 ? 'Close enough.' : s > 0 ? 'Passengers had to jog a bit.' : 'Missed it! They will be writing to the council.';
    setMsg(`${verdict} ${BUS_QUIPS[Math.floor(Math.random() * BUS_QUIPS.length)]}`);
    setTimeout(() => {
      if (scores.current.length >= STOPS) {
        setPhase('done');
        const avg = scores.current.reduce((a, b) => a + b, 0) / STOPS;
        onDone(avg, `${scores.current.filter((x) => x > 0.5).length}/${STOPS} clean stops on the 436. ${avg > 0.75 ? 'TfL-ish want to put you on a poster.' : 'Nobody died. Good enough.'}`);
      } else {
        posRef.current = 0;
        speedRef.current = 0.32 + scores.current.length * 0.07;
        setPos(0);
        setStop((x) => x + 1);
        setPhase('driving');
      }
    }, 1500);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        brake();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  const stopNames = ['Peckwell Broadway', 'Albion Road', 'The Leaky Brolly', 'Jobcentre Minus', 'Inkerman Terrace', 'Peckwell Common'];
  return (
    <div className="minigame">
      <div className="mg-head">
        <h3>🚌 Bus shift · Route 436</h3>
        <div className="mg-pill">
          Stop {Math.min(stop + 1, STOPS)}/{STOPS}
        </div>
      </div>
      <div className="mg-road">
        <div className="mg-stop" style={{ left: `${STOP_AT * 100}%` }}>
          <div className="mg-stop-flag">
            <b>BUS STOP</b>
            <span>{stopNames[stop % stopNames.length]}</span>
          </div>
          <div className="mg-stop-zone" />
        </div>
        <div className="mg-bus" style={{ left: `calc(${pos * 100}% - 70px)` }}>
          <div className="mg-bus-top">436 PECKWELL</div>
          <div className="mg-bus-door" />
        </div>
      </div>
      <p className="mg-msg">{msg}</p>
      <button className="mg-btn stop" onClick={brake} disabled={phase !== 'driving'}>
        🛑 STOP
      </button>
    </div>
  );
}
