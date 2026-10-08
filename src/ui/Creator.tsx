import { useState } from 'react';
import { ACCESSORIES, ACC_LABEL, HAIRS, HAIR_COLOURS, HAIR_LABEL, OUTFITS, OUTFIT_COLOURS, OUTFIT_LABEL, SKINS, randomAvatar } from '../game/avatar';
import type { Avatar } from '../game/types';
import { AvatarCanvas } from './AvatarCanvas';
import { MAX_NAME } from '../net/filter';

const NAME_IDEAS = ['Kezza', 'Big Dave', 'Priya', 'Tunde', 'Siobhan', 'Gaz', 'Ellie', 'Mo', 'Chantelle', 'Rupert', 'Aisha', 'Tomasz'];

export function Creator({
  mode,
  initial,
  initialName,
  onDone,
  onBack,
}: {
  mode: 'new' | 'barber';
  initial?: Avatar;
  initialName?: string;
  onDone: (name: string, a: Avatar) => void;
  onBack: () => void;
}) {
  const [a, setA] = useState<Avatar>(() => initial ?? randomAvatar());
  const [name, setName] = useState(initialName ?? '');
  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => setA((p) => ({ ...p, [k]: v }));
  const canGo = mode === 'barber' || name.trim().length >= 2;

  return (
    <div className={mode === 'new' ? 'creator-screen' : 'modal-backdrop'}>
      <div className="creator panel">
        <div className="creator-head">
          <h2>{mode === 'new' ? 'Who are you, then?' : 'Fade to Grey · New look'}</h2>
          <p className="muted">{mode === 'new' ? 'New to Peckwell. Sleeping on your mate Dave’s sofa. £120 to your name. Big dreams.' : '"What we doing today, boss?" Hair, outfit, the lot. £12.'}</p>
        </div>
        <div className="creator-body">
          <div className="creator-preview">
            <AvatarCanvas avatar={a} size={150} animate />
            <button className="btn btn-ghost btn-small" onClick={() => setA(randomAvatar())}>
              🎲 Randomise
            </button>
          </div>
          <div className="creator-options">
            {mode === 'new' ? (
              <label className="field">
                <span>Name</span>
                <input
                  value={name}
                  maxLength={MAX_NAME}
                  placeholder={`e.g. ${NAME_IDEAS[Math.floor(Date.now() / 1000) % NAME_IDEAS.length]}`}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canGo && onDone(name, a)}
                  aria-label="Character name"
                />
              </label>
            ) : null}
            <Row label="Skin">
              {SKINS.map((c) => (
                <Swatch key={c} colour={c} on={a.skin === c} onClick={() => set('skin', c)} />
              ))}
            </Row>
            <Row label="Hair">
              {HAIRS.map((h) => (
                <Chip key={h} on={a.hair === h} onClick={() => set('hair', h)}>
                  {HAIR_LABEL[h]}
                </Chip>
              ))}
            </Row>
            <Row label="Hair colour">
              {HAIR_COLOURS.map((c) => (
                <Swatch key={c} colour={c} on={a.hairColor === c} onClick={() => set('hairColor', c)} />
              ))}
            </Row>
            <Row label="Outfit">
              {OUTFITS.map((o) => (
                <Chip key={o} on={a.outfit === o} onClick={() => set('outfit', o)}>
                  {OUTFIT_LABEL[o]}
                </Chip>
              ))}
            </Row>
            <Row label="Colour">
              {OUTFIT_COLOURS.map((c) => (
                <Swatch key={c} colour={c} on={a.outfitColor === c} onClick={() => set('outfitColor', c)} />
              ))}
            </Row>
            <Row label="Extras">
              {ACCESSORIES.map((x) => (
                <Chip key={x} on={a.accessory === x} onClick={() => set('accessory', x)}>
                  {ACC_LABEL[x]}
                </Chip>
              ))}
            </Row>
          </div>
        </div>
        <div className="creator-foot">
          <button className="btn btn-ghost" onClick={onBack}>
            {mode === 'new' ? 'Back' : 'Cancel'}
          </button>
          <button className="btn btn-primary" disabled={!canGo} onClick={() => onDone(name, a)}>
            {mode === 'new' ? 'Move to Peckwell →' : 'Pay £12 & look sharp'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="opt-row">
      <span className="opt-label">{label}</span>
      <div className="opt-items">{children}</div>
    </div>
  );
}
function Swatch({ colour, on, onClick }: { colour: string; on: boolean; onClick: () => void }) {
  return <button className={'swatch' + (on ? ' on' : '')} style={{ background: colour }} onClick={onClick} aria-label={colour} aria-pressed={on} />;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={'chip' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}>
      {children}
    </button>
  );
}
