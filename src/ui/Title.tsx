import { useMemo } from 'react';
import type { SaveState } from '../game/types';
import { money, jobTitle } from '../game/economy';
import { hasRealtime } from '../net';
import { AvatarCanvas } from './AvatarCanvas';

export function Title({ save, onContinue, onNew }: { save: SaveState | null; onContinue: () => void; onNew: () => void }) {
  const tagline = useMemo(() => {
    const t = [
      'Rent is due. It is always due.',
      'Now with 40% more drizzle.',
      'Mind the gap (in your finances).',
      'Population: you, 8 NPCs and several thousand pigeons.',
      'Sausage rolls are a currency here.',
      'Where a pint costs £7.20 and nobody knows why.',
    ];
    return t[Math.floor(Math.random() * t.length)];
  }, []);
  const drops = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 0.137) % 1.6, dur: 0.6 + ((i * 7) % 5) / 10 })), []);
  return (
    <div className="title-screen">
      <div className="title-rain" aria-hidden>
        {drops.map((d, i) => (
          <span key={i} style={{ left: d.left + '%', animationDelay: d.delay + 's', animationDuration: d.dur + 's' }} />
        ))}
      </div>
      <svg className="skyline" viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <path fill="#232c43" d="M0 120V70h20V55h14v15h10V40h18v80zM62 120V60h12l6-20 6 20h12v60zM98 120V30l18-26 18 26v90zM134 120V65h24V50h10v70zM168 120V35c0-14 26-14 26 0v85zM194 120V58h30v62zM224 120V8l10 28v84zM234 120V45h22v75zM256 120V62h14V48h12v72zM282 120V25h6V10h4v15h6v95zM298 120V55h28v65zM326 120V40h16l4-8 4 8h14v80zM364 120V60h36v60z" />
        <path fill="#1a2135" d="M0 120V92h400v28z" />
        <g fill="#f5d77a" opacity=".8">
          <rect x="104" y="40" width="3" height="4" /><rect x="112" y="52" width="3" height="4" /><rect x="120" y="44" width="3" height="4" /><rect x="174" y="50" width="3" height="4" /><rect x="182" y="62" width="3" height="4" /><rect x="240" y="60" width="3" height="4" /><rect x="304" y="70" width="3" height="4" /><rect x="333" y="56" width="3" height="4" /><rect x="70" y="70" width="3" height="4" />
        </g>
      </svg>
      <div className="title-bus" aria-hidden>
        <div className="bus-body">
          <div className="bus-windows top">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>
          <div className="bus-windows">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>
          <div className="bus-blind">436 PECKWELL</div>
        </div>
        <div className="bus-wheels"><i /><i /></div>
      </div>
      <div className="title-card">
        <div className="title-kicker">PECKWELL · LONDON · EST. YESTERDAY</div>
        <h1 className="title-logo">
          UK <span>LIFE</span>
        </h1>
        <p className="title-tagline">{tagline}</p>
        {save ? (
          <div className="title-save">
            <AvatarCanvas avatar={save.avatar} size={64} />
            <div>
              <strong>{save.name}</strong>
              <div className="muted">
                {money(save.money)} · {jobTitle(save)} · {save.home === 'sofa' ? "on Dave's sofa" : 'renting'}{save.streak.count > 1 ? ` · 🔥 ${save.streak.count}` : ''}
              </div>
            </div>
          </div>
        ) : null}
        <div className="title-buttons">
          {save ? (
            <button className="btn btn-primary btn-big" onClick={onContinue} autoFocus>
              Carry on
            </button>
          ) : null}
          <button className={save ? 'btn btn-ghost' : 'btn btn-primary btn-big'} onClick={onNew} autoFocus={!save}>
            {save ? 'New character' : 'Move to Peckwell'}
          </button>
        </div>
        <div className="title-foot">
          <span className={hasRealtime() ? 'pill pill-on' : 'pill'}>{hasRealtime() ? 'Multiplayer on' : 'Offline mode · NPC locals'}</span>
          <span className="muted">Free · no sign-up · progress saved on this device</span>
        </div>
      </div>
    </div>
  );
}
