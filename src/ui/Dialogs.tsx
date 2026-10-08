import { useMemo, useState } from 'react';
import { GOALS, HOMES, JOBS, SHOPS, money, clock, type Item } from '../game/economy';
import type { SaveState, HomeId, JobId } from '../game/types';
import { TUBE_FARE, stations, type Billboard, type Building } from '../game/world';
import type { Snapshot } from '../game/engine';

export function Modal({ title, sub, onClose, children, className = '' }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; className?: string }) {
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'panel modal ' + className} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub ? <p className="muted">{sub}</p> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

const fx = (i: Item) => {
  const out: { k: string; v: number }[] = [];
  if (i.hunger) out.push({ k: '🍔', v: i.hunger });
  if (i.energy) out.push({ k: '⚡', v: i.energy });
  if (i.mood) out.push({ k: '🙂', v: i.mood });
  return out;
};

export function ShopDialog({ shopId, building, snap, onBuy, onClose, extra }: { shopId: string; building: Building; snap: Snapshot; onBuy: (i: Item) => void; onClose: () => void; extra?: React.ReactNode }) {
  const shop = SHOPS[shopId];
  const greeting = useMemo(() => shop.greeting[Math.floor(Math.random() * shop.greeting.length)], [shop]);
  return (
    <Modal title={shop.title} sub={greeting} onClose={onClose}>
      {extra}
      <ul className="item-list">
        {shop.items.map((i) => (
          <li key={i.id} className="item">
            <div className="item-main">
              <div className="item-name">{i.name}</div>
              <div className="item-note">{i.note}</div>
              <div className="item-fx">
                {fx(i).map((f) => (
                  <span key={f.k} className={f.v > 0 ? 'fx up' : 'fx down'}>
                    {f.k} {f.v > 0 ? '+' : ''}
                    {f.v}
                  </span>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-price" disabled={snap.money < i.price} onClick={() => onBuy(i)}>
              {money(i.price)}
            </button>
          </li>
        ))}
      </ul>
      <p className="muted small">{building.blurb}</p>
    </Modal>
  );
}

export function ShiftBanner({ jobId, snap, onStart }: { jobId: JobId; snap: Snapshot; onStart: () => void }) {
  const j = JOBS[jobId];
  const tired = snap.energy < 20;
  return (
    <div className="shift-banner">
      <div>
        <b>You work here!</b> {j.title} · {j.hours}h shift · {jobId === 'rider' ? 'paid per drop + tips' : `up to ${money(Math.round(j.pay * 1.3))}`}
        {tired ? <div className="warn">Too knackered to work (need ⚡20+). Coffee or kip first.</div> : null}
      </div>
      <button className="btn btn-go" disabled={tired} onClick={onStart}>
        Start shift
      </button>
    </div>
  );
}

export function JobCentreDialog({ save, onTake, onClose }: { save: SaveState; onTake: (j: JobId) => void; onClose: () => void }) {
  const [ticket] = useState(() => 380 + Math.floor(Math.random() * 90));
  return (
    <Modal title="Jobcentre Minus" sub={`You take a ticket: #${ticket}. Now serving: #9. ...Oh, they’ll see you now actually. Quiet day.`} onClose={onClose}>
      <ul className="item-list">
        {Object.values(JOBS).map((j) => {
          const locked = save.shifts < j.unlockShifts;
          const current = save.job === j.id;
          return (
            <li key={j.id} className={'item' + (locked ? ' locked' : '')}>
              <div className="item-main">
                <div className="item-name">
                  {j.title} <span className="muted">· {j.employer}</span>
                </div>
                <div className="item-note">{j.desc}</div>
                <div className="item-fx">
                  <span className="fx up">{j.id === 'rider' ? '£7–12 per drop' : `${money(j.pay)} base / ${j.hours}h shift`}</span>
                  <span className="fx down">⚡ -{j.energy}</span>
                  {locked ? <span className="fx lock">🔒 Needs {j.unlockShifts} shift{j.unlockShifts > 1 ? 's' : ''} of experience</span> : null}
                </div>
              </div>
              <button className="btn btn-primary" disabled={locked || current} onClick={() => onTake(j.id)}>
                {current ? 'Your job' : locked ? 'Locked' : 'Take job'}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Jobs are done at the employer’s building. Tap it on the map to walk there.</p>
    </Modal>
  );
}

export function LettingsDialog({ save, onRent, onSofa, onClose }: { save: SaveState; onRent: (h: HomeId) => void; onSofa: () => void; onClose: () => void }) {
  return (
    <Modal title="Fleecems Lettings" sub={'Josh looks up from his phone. "Hiya! Everything’s going fast, so... yeah."'} onClose={onClose}>
      <ul className="item-list">
        {(['flatshare', 'studio', 'onebed'] as HomeId[]).map((id) => {
          const h = HOMES[id];
          const current = save.home === id;
          const upfront = h.rent * 2;
          return (
            <li key={id} className="item">
              <div className="item-main">
                <div className="item-name">{h.name}</div>
                <div className="item-note">{h.pitch}</div>
                <div className="item-fx">
                  <span className="fx">{money(h.rent)}/week</span>
                  <span className="fx">+ council tax {money(h.councilTax)}/wk</span>
                  <span className="fx up">Sleep: 🙂 {h.sleepMood >= 0 ? '+' : ''}{h.sleepMood}</span>
                </div>
              </div>
              <button className="btn btn-primary" disabled={current || save.money < upfront} onClick={() => onRent(id)}>
                {current ? 'Your place' : `Move in · ${money(upfront)}`}
              </button>
            </li>
          );
        })}
      </ul>
      {save.home !== 'sofa' ? (
        <button className="btn btn-ghost" onClick={onSofa}>
          Hand in notice & go back to Dave’s sofa
        </button>
      ) : null}
      <p className="muted small">Move-in cost = first week + deposit (you will never see the deposit again). Rent and council tax leave your account every Monday at 09:00.</p>
    </Modal>
  );
}

export function HomeDialog({ building, save, onSleep, onCuppa, onClose }: { building: Building; save: SaveState; onSleep: () => void; onCuppa: () => void; onClose: () => void }) {
  const mine = building.homeId === save.home;
  const h = HOMES[building.homeId!];
  if (!mine)
    return (
      <Modal title={building.name} sub={building.blurb} onClose={onClose}>
        <p>
          {h.id === 'sofa' ? 'Dave is out. You don’t live here any more, the cat has taken your spot.' : `Units here go for ${money(h.rent)}/week. Enquire at Fleecems Lettings on the high street.`}
        </p>
      </Modal>
    );
  const c = clock(save.minutes);
  return (
    <Modal title={h.name} sub={building.blurb} onClose={onClose}>
      <div className="home-card">
        <div>
          <div className="muted small">It’s {c.label}</div>
          {save.home === 'sofa' ? (
            <p>Free! Dave’s paying the council tax and he’d like you to know that.</p>
          ) : (
            <p>
              Rent {money(save.rent)}/wk + council tax {money(h.councilTax)}/wk, due Mondays 09:00.
              {save.arrears ? <b className="warn"> You’re in arrears. One more miss and you’re out.</b> : null}
            </p>
          )}
        </div>
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={onSleep}>
          😴 Sleep till 7am
        </button>
        <button className="btn btn-ghost" onClick={onCuppa}>
          🫖 Put the kettle on
        </button>
      </div>
    </Modal>
  );
}

export function TubeDialog({ from, snap, onTravel, onTopUp, onClose }: { from: string; snap: Snapshot; onTravel: (id: string) => void; onTopUp: () => void; onClose: () => void }) {
  const here = stations.find((s) => s.id === from)!;
  return (
    <Modal title={here.name} sub={`${here.line} · "Please stand on the right." (Nobody does.)`} onClose={onClose}>
      <div className="oyster">
        <div className="oyster-card">
          <span>OYSTER-ISH</span>
          <b>{money(snap.oyster)}</b>
        </div>
        <button className="btn btn-ghost btn-small" onClick={onTopUp} disabled={snap.money < 10}>
          Top up £10
        </button>
      </div>
      <ul className="item-list">
        {stations
          .filter((s) => s.id !== from)
          .map((s) => (
            <li key={s.id} className="item">
              <div className="item-main">
                <div className="item-name">
                  <span className="line-dot" style={{ background: s.color }} /> {s.name}
                </div>
                <div className="item-note">{s.line} · about 12 minutes, signals permitting</div>
              </div>
              <button className="btn btn-primary" disabled={snap.oyster < TUBE_FARE} onClick={() => onTravel(s.id)}>
                Tap in · {money(TUBE_FARE)}
              </button>
            </li>
          ))}
      </ul>
      {snap.oyster < TUBE_FARE ? <p className="warn">The barrier beeps at you. "SEEK ASSISTANCE." Top up first.</p> : null}
    </Modal>
  );
}

const DECOR: Record<string, { label: string; price: number; mood: number; energy?: number; result: string }> = {
  laundry: { label: 'Do a wash (£4.50)', price: 4.5, mood: 6, result: 'Clean clothes! One sock is missing. It always will be.' },
  charity: { label: 'Buy a mystery paperback (£1)', price: 1, mood: 5, result: 'You bought "The Da Vinci Code". Copy number 18.' },
  library: { label: 'Use the free Wi-Fi (free!)', price: 0, mood: 4, energy: 2, result: 'You read 40 Wikipedia pages about medieval castles. Bliss.' },
  vape: { label: 'Browse flavours (free)', price: 0, mood: -2, result: '"Blue Razz Unicorn Ice Mango Storm". You leave confused and slightly sticky.' },
  pawn: { label: 'Knock on the door', price: 0, mood: 0, result: 'Sign still says "Back in 5 mins". It has said that since 2019.' },
  terrace1: { label: 'Ring the doorbell', price: 0, mood: -1, result: 'A Ring doorbell records you. The neighbourhood WhatsApp has been informed.' },
  terrace2: { label: 'Ring the doorbell', price: 0, mood: 1, result: 'A dog barks. A baby wakes. You run away.' },
  terrace3: { label: 'Ring the doorbell', price: 0, mood: 0, result: 'A builder answers. "Not til next Tuesday, mate." You didn’t ask anything.' },
  terrace4: { label: 'Ring the doorbell', price: 0, mood: 0, result: 'A curtain twitches. Nobody comes.' },
  synergy: { label: 'Ask at reception', price: 0, mood: -1, result: '"Are you the temp? No? Then I can’t let you in, sorry. Policy."' },
  garage: { label: 'Ask about driving', price: 0, mood: 0, result: '"Come back with a bit of experience, yeah? Three shifts of anything."' },
};

export function DecorDialog({ building, snap, onDo, onClose }: { building: Building; snap: Snapshot; onDo: (cost: number, mood: number, energy: number, text: string) => void; onClose: () => void }) {
  const d = DECOR[building.id];
  return (
    <Modal title={building.name} sub={building.blurb} onClose={onClose}>
      {d ? (
        <button className="btn btn-primary" disabled={snap.money < d.price} onClick={() => onDo(d.price, d.mood, d.energy ?? 0, d.result)}>
          {d.label}
        </button>
      ) : (
        <p className="muted">Nothing doing here.</p>
      )}
    </Modal>
  );
}

export function BillboardDialog({ bb, onClose }: { bb: Billboard; onClose: () => void }) {
  const [asked, setAsked] = useState(false);
  return (
    <Modal title={bb.name} sub="Advertising slot · Peckwell" onClose={onClose} className="billboard-modal">
      <div className="bb-preview">
        <div className="bb-board">
          <b>YOUR AD HERE</b>
          <span>£{bb.price}/week</span>
        </div>
      </div>
      <div className="bb-stats">
        <div>
          <span className="muted small">Price</span>
          <b>£{bb.price} / week</b>
        </div>
        <div>
          <span className="muted small">Est. footfall</span>
          <b>{bb.footfall}</b>
        </div>
      </div>
      <p>{bb.blurb}</p>
      <p className="muted small">Real businesses will be able to rent these in-game billboards: every player walking past sees your brand. Self-serve booking (Stripe) is on the roadmap.</p>
      {asked ? (
        <div className="notice">Booking isn’t live yet: this is a prototype, so no payment or enquiry was sent. Watch this space!</div>
      ) : (
        <button className="btn btn-primary" onClick={() => setAsked(true)}>
          Enquire about this slot
        </button>
      )}
    </Modal>
  );
}

export function PhoneMenu({ save, snap, onClose, onReset, onQuit }: { save: SaveState; snap: Snapshot; onClose: () => void; onReset: () => void; onQuit: () => void }) {
  const [tab, setTab] = useState<'goals' | 'me' | 'help'>('goals');
  const c = clock(save.minutes);
  const home = HOMES[save.home];
  const done = GOALS.filter((g) => snap.goals[g.id]).length;
  return (
    <Modal title="📱 Your phone" sub={`${c.label} · Week ${c.week} · battery 3%`} onClose={onClose} className="phone-menu">
      <div className="tabs">
        {(['goals', 'me', 'help'] as const).map((t) => (
          <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
            {t === 'goals' ? `Goals ${done}/${GOALS.length}` : t === 'me' ? 'Me' : 'Help'}
          </button>
        ))}
      </div>
      {tab === 'goals' ? (
        <ul className="goals">
          {GOALS.map((g) => (
            <li key={g.id} className={snap.goals[g.id] ? 'done' : ''}>
              <span className="tick">{snap.goals[g.id] ? '✓' : ''}</span>
              {g.label}
            </li>
          ))}
        </ul>
      ) : tab === 'me' ? (
        <div className="stats">
          <Row k="Name" v={save.name} />
          <Row k="Job" v={save.job ? `${JOBS[save.job].title} (${JOBS[save.job].employer})` : 'Unemployed (between opportunities)'} />
          <Row k="Shifts worked" v={String(save.shifts)} />
          <Row k="Home" v={home.name} />
          <Row k="Weekly bills" v={save.home === 'sofa' ? '£0 (thanks Dave)' : `${money(save.rent)} rent + ${money(home.councilTax)} council tax`} />
          <Row k="Next bill" v="Monday 09:00" />
          <Row k="Total earned" v={money(save.stats.earned)} />
          <Row k="Rent paid (lifetime)" v={money(save.stats.rentPaid)} />
          <Row k="Sausage rolls eaten" v={String(save.stats.sausageRolls)} />
          <Row k="Pints" v={String(save.stats.pints)} />
          <Row k="Tube trips" v={String(save.stats.tubeTrips)} />
        </div>
      ) : (
        <div className="help">
          <p>
            <b>Move:</b> tap / click where you want to go (hold to keep walking), or WASD / arrow keys.
          </p>
          <p>
            <b>Go inside:</b> tap a building, or stand at its door and press <kbd>E</kbd> / the big button.
          </p>
          <p>
            <b>Chat:</b> <kbd>T</kbd> or the 💬 button. <b>Close:</b> <kbd>Esc</kbd>.
          </p>
          <p>
            <b>Loop:</b> get a job at Jobcentre Minus → work shifts at the employer → buy food/coffee to keep ⚡🍔🙂 up → rent a place at Fleecems → survive Monday rent day. Mood drains in the rain unless you have a brolly; the park cheers you up.
          </p>
          <p className="muted small">A day lasts ~3 real minutes. Progress saves on this device automatically.</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={onQuit}>
              Title screen
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm('Start again from scratch? Your save will be deleted.')) onReset();
              }}
            >
              Reset save
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat-row">
      <span className="muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}
