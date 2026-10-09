import { jobTitle, money } from '../game/economy';
import type { Snapshot } from '../game/engine';
import { DOW, london } from '../game/time';
import type { SaveState } from '../game/types';

function Bar({ icon, label, value, wide }: { icon: string; label: string; value: number; wide?: boolean }) {
  const colour = value > 55 ? '#3ecf6e' : value > 25 ? '#ffb53f' : '#ff5a4f';
  return (
    <div className={'need' + (wide ? ' need-mood' : '') + (value < 20 ? ' low' : '')} title={`${label}: ${Math.round(value)}/100`}>
      <span className="need-icon" aria-hidden>
        {icon}
      </span>
      <div className="need-track" aria-label={label} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className="need-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: colour }} />
      </div>
    </div>
  );
}

const moodFace = (m: number) => (m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 20 ? '😕' : '😩');

export function Hud({ snap, save, onCancelDelivery, onOpenMe, children }: { snap: Snapshot; save: SaveState; onCancelDelivery: () => void; onOpenMe: () => void; children?: React.ReactNode }) {
  const c = london(snap.now);
  const night = c.hh < 6 || c.hh >= 20;
  const weather = snap.raining ? '🌧️' : night ? '🌙' : c.hh < 9 ? '🌤️' : '⛅';
  const online = snap.netMode === 'online' && snap.netStatus === 'online';
  const d = snap.delivery;
  const chips = [...snap.moodlets].sort((a, b) => Math.abs(b.mood) - Math.abs(a.mood)).slice(0, 4);
  return (
    <div className="hud">
      <div className="hud-card panel">
        <div className="hud-row">
          <div className="hud-money" aria-label="Money">
            {money(snap.money)}
          </div>
          <div className="hud-oyster" title="Oyster card balance">
            <span className="oyster-mini" /> {money(snap.oyster)}
          </div>
          <div className="hud-spacer" />
          <div className="hud-time" title="Real UK time">
            <span>{weather}</span> {DOW[c.dayIdx]} {c.label.slice(4)}
          </div>
        </div>
        <button className="hud-row needs" onClick={onOpenMe} aria-label="Your needs and moodlets (opens Me)" data-testid="needs">
          <Bar icon="⚡" label="Energy" value={snap.energy} />
          <Bar icon="🍔" label="Fullness" value={snap.hunger} />
          <Bar icon="💬" label="Social" value={snap.social} />
          <Bar icon="🫧" label="Hygiene" value={snap.hygiene} />
          <Bar icon="🧣" label="Warm & dry" value={snap.warmth} />
          <Bar icon={moodFace(snap.mood)} label="Mood" value={snap.mood} wide />
        </button>
        <div className="hud-row hud-meta">
          <div className="moodlet-chips" onClick={onOpenMe}>
            {snap.streak > 1 ? (
              <span className="chip-m streak" title={`${snap.streak}-day streak`}>
                🔥 {snap.streak}
              </span>
            ) : null}
            {chips.map((m) => (
              <span key={m.id} className={'chip-m ' + (m.mood >= 0 ? 'good' : 'bad')} title={`${m.name}: ${m.desc}`}>
                {m.emoji} <span className="chip-name">{m.name}</span> <b>{m.mood > 0 ? '+' : ''}{m.mood}</b>
              </span>
            ))}
            {!chips.length && snap.streak <= 1 ? <span className="muted small">{jobTitle(save)} · {snap.home === 'sofa' ? "Dave's sofa" : `Rent ${money(snap.rent)}/wk`}</span> : null}
          </div>
          <span className={'pill ' + (online ? 'pill-on' : '')} data-testid="online-pill">
            {online ? (
              <>
                <i className="live-dot" /> {snap.online} online
              </>
            ) : snap.netMode === 'online' ? (
              snap.netStatus === 'connecting' ? 'Connecting…' : 'Offline'
            ) : (
              <>Offline{snap.localPeers ? ` · +${snap.localPeers} tab${snap.localPeers > 1 ? 's' : ''}` : ''}</>
            )}
          </span>
        </div>
      </div>
      {d ? (
        <div className="delivery panel">
          <div className="delivery-icon">🛵</div>
          <div className="delivery-main">
            <div>
              Drop {d.index + 1}/{d.total} → <b>{d.target}</b>
            </div>
            <div className="muted small">Earned {money(d.earned)} · follow the green arrow</div>
          </div>
          <div className={'delivery-timer' + (d.remaining < 5 ? ' late' : '')}>{d.remaining > 0 ? `${Math.ceil(d.remaining)}s` : 'LATE'}</div>
          <button className="icon-btn" onClick={onCancelDelivery} aria-label="End shift early" title="End shift early">
            ✕
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
