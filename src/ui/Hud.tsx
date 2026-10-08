import { clock, money, JOBS } from '../game/economy';
import type { Snapshot } from '../game/engine';
import type { SaveState } from '../game/types';

function Bar({ icon, label, value }: { icon: string; label: string; value: number }) {
  const colour = value > 55 ? '#3ecf6e' : value > 25 ? '#ffb53f' : '#ff5a4f';
  return (
    <div className="need" title={`${label}: ${Math.round(value)}/100`}>
      <span className="need-icon" aria-hidden>
        {icon}
      </span>
      <div className="need-track" aria-label={label} role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className="need-fill" style={{ width: `${value}%`, background: colour }} />
      </div>
    </div>
  );
}

export function Hud({ snap, save, onCancelDelivery }: { snap: Snapshot; save: SaveState; onCancelDelivery: () => void }) {
  const c = clock(snap.minutes);
  const night = c.hh < 6 || c.hh >= 20;
  const weather = snap.raining ? '🌧️' : night ? '🌙' : c.hh < 9 ? '🌤️' : '⛅';
  const online = snap.netMode === 'online' && snap.netStatus === 'online';
  const d = snap.delivery;
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
          <div className="hud-time">
            <span>{weather}</span> {c.label} <span className="muted">· Wk {c.week}</span>
          </div>
        </div>
        <div className="hud-row needs">
          <Bar icon="⚡" label="Energy" value={snap.energy} />
          <Bar icon="🍔" label="Fullness" value={snap.hunger} />
          <Bar icon="🙂" label="Mood" value={snap.mood} />
        </div>
        <div className="hud-row hud-meta">
          <span className="muted">{save.job ? JOBS[save.job].title : 'Unemployed'} · {snap.home === 'sofa' ? "Dave's sofa" : `Rent ${money(snap.rent)}/wk`}{snap.arrears ? ' · ⚠️ arrears' : ''}{snap.umbrella ? ' · ☂️' : ''}</span>
          <span className={'pill ' + (online ? 'pill-on' : '')} data-testid="online-pill">
            {online ? (
              <>
                <i className="live-dot" /> {snap.online} online
              </>
            ) : snap.netMode === 'online' ? (
              snap.netStatus === 'connecting' ? 'Connecting…' : 'Offline mode'
            ) : (
              <>Offline mode{snap.localPeers ? ` · +${snap.localPeers} tab${snap.localPeers > 1 ? 's' : ''}` : ''}</>
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
            <div className="muted small">
              Earned {money(d.earned)} · follow the green arrow
            </div>
          </div>
          <div className={'delivery-timer' + (d.remaining < 5 ? ' late' : '')}>{d.remaining > 0 ? `${Math.ceil(d.remaining)}s` : 'LATE'}</div>
          <button className="icon-btn" onClick={onCancelDelivery} aria-label="End shift early" title="End shift early">
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
