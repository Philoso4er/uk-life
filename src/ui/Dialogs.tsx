import { useState } from 'react';
import { HOMES, JOBS, jobTitle, levelPay, money, shiftAvailability } from '../game/economy';
import type { SaveState, HomeId, JobId } from '../game/types';
import { TUBE_FARE, stations, type Billboard } from '../game/world';
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

export function ShiftBanner({ jobId, save, onStart }: { jobId: JobId; save: SaveState; onStart: () => void }) {
  const j = JOBS[jobId];
  const avail = shiftAvailability(save);
  return (
    <div className="shift-banner">
      <div>
        <b>You work here!</b> {jobTitle(save)} · {j.hours}h shift · {jobId === 'rider' ? 'paid per drop + tips' : `up to ${money(Math.round(j.pay * 1.3 * levelPay(save)))}`}
        {!avail.ok ? <div className="warn">{avail.reason}</div> : null}
      </div>
      <button className="btn btn-go" disabled={!avail.ok} onClick={onStart}>
        Start shift
      </button>
    </div>
  );
}

export function JobsList({ save, onTake }: { save: SaveState; onTake: (j: JobId) => void }) {
  return (
    <>
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
                  <span className="fx">📈 up to {j.titles[4]}</span>
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
      <p className="muted small">Shifts happen at the employer’s building. Switching jobs starts you at the bottom of the new ladder.</p>
    </>
  );
}

export function HomesList({ save, onRent, onSofa }: { save: SaveState; onRent: (h: HomeId) => void; onSofa: () => void }) {
  return (
    <>
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
      <p className="muted small">Move-in cost = first week + deposit (you will never see the deposit again). Rent and council tax leave your account every real Monday at 09:00.</p>
    </>
  );
}

export function TravelList({ from, snap, onTravel }: { from: string; snap: Snapshot; onTravel: (id: string) => void }) {
  const here = stations.find((s) => s.id === from)!;
  return (
    <>
      <div className="oyster">
        <div className="oyster-card">
          <span>OYSTER-ISH</span>
          <b>{money(snap.oyster)}</b>
        </div>
        <span className="muted small">{here.line}. Top up at Kwik Mart.</span>
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
      {snap.oyster < TUBE_FARE ? <p className="warn">The barrier beeps at you. “SEEK ASSISTANCE.” Top up at Kwik Mart.</p> : null}
    </>
  );
}

export const BUS_FARE = 1.75;
export const BUS_STOPS: { id: string; name: string; note: string }[] = [
  { id: 'albion', name: 'Albion Road', note: 'Up by the Overground and the posh flats.' },
  { id: 'pond', name: 'Peckwell Common (pond)', note: 'Ducks. Swan. Trolley.' },
  { id: 'allotments', name: 'Inkerman Allotments', note: 'Nan’s turf. Mind the marrows.' },
  { id: 'common', name: 'Peckwell Common station', note: 'The far end of the park.' },
];
export function BusList({ snap, onRide }: { snap: Snapshot; onRide: (id: string) => void }) {
  return (
    <>
      <div className="oyster">
        <div className="oyster-card">
          <span>OYSTER-ISH</span>
          <b>{money(snap.oyster)}</b>
        </div>
        <span className="muted small">Hopper fare: {money(BUS_FARE)} wherever you go. Upstairs, front seat, obviously.</span>
      </div>
      <ul className="item-list">
        {BUS_STOPS.map((s) => (
          <li key={s.id} className="item">
            <div className="item-main">
              <div className="item-name">🚌 436 to {s.name}</div>
              <div className="item-note">{s.note}</div>
            </div>
            <button className="btn btn-primary" disabled={snap.oyster < BUS_FARE} onClick={() => onRide(s.id)}>
              Ride · {money(BUS_FARE)}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export interface CardChoice {
  label: string;
  note?: string;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  onPick: () => void;
}
/** A big British life-event card: a picture, a bit of drama, and a choice or two. */
export function EventCard({ emoji, kicker, title, children, choices }: { emoji: string; kicker?: string; title: string; children: React.ReactNode; choices: CardChoice[] }) {
  return (
    <div className="modal-backdrop card-backdrop">
      <div className="panel event-card" role="alertdialog" aria-label={title} data-testid="event-card">
        <div className="event-art" aria-hidden>
          <span>{emoji}</span>
        </div>
        {kicker ? <div className="event-kicker">{kicker}</div> : null}
        <h2 className="event-title">{title}</h2>
        <div className="event-body">{children}</div>
        <div className="event-choices">
          {choices.map((c, i) => (
            <button key={c.label} className={'btn event-choice ' + (c.tone === 'ghost' ? 'btn-ghost' : c.tone === 'danger' ? 'btn-danger' : 'btn-primary')} disabled={c.disabled} onClick={c.onPick} autoFocus={i === 0}>
              <span>{c.label}</span>
              {c.note ? <span className="choice-note">{c.note}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
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

