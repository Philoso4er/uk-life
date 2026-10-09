import { useEffect, useMemo, useRef, useState } from 'react';
import { ACTION_BY_ID, actionCost, actionsFor, blockReason, completeAction, isHidden, secsFor, type ActionCtx, type ActionDef, type ActionOutcome } from '../game/actions';
import { money, type GameEvent } from '../game/economy';
import { MOODLETS } from '../game/needs';
import { london } from '../game/time';
import type { SaveState } from '../game/types';
import type { Building } from '../game/world';
import { Modal } from './Dialogs';

export interface PlaceTab {
  id: string;
  label: string;
  node: React.ReactNode;
}

const FX_ICON: Record<string, string> = { hunger: '🍔', energy: '⚡', social: '💬', hygiene: '🫧', warmth: '🧣', mood: '🙂' };

/** A building (or park spot) with its menu of timed actions. */
export function PlaceDialog({
  b,
  save,
  ctxFn,
  onEvents,
  onClose,
  tabs = [],
  top,
  greeting,
  defaultTab,
  closed,
}: {
  b: Building;
  save: SaveState;
  ctxFn: () => ActionCtx;
  onEvents: (ev: GameEvent[]) => void;
  onClose: () => void;
  /** extra tabs (Jobs, Homes, Travel…) shown next to "Things to do" */
  tabs?: PlaceTab[];
  /** shown above the list (shift banner etc.) */
  top?: React.ReactNode;
  greeting?: string;
  defaultTab?: string;
  /** replaces the action list (e.g. someone else's house) */
  closed?: React.ReactNode;
}) {
  const [tab, setTab] = useState(defaultTab ?? 'do');
  const [run, setRun] = useState<{ a: ActionDef; secs: number; started: number } | null>(null);
  const [result, setResult] = useState<{ a: ActionDef; o: ActionOutcome } | null>(null);
  const [, force] = useState(0);
  const list = actionsFor(b.id, b.kind);
  const ctx = ctxFn();

  // refresh cooldowns / opening hours every few seconds while open
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 5000);
    return () => clearInterval(i);
  }, []);

  const start = (a: ActionDef) => {
    if (blockReason(save, a, ctxFn())) return;
    setResult(null);
    setRun({ a, secs: secsFor(a), started: performance.now() });
  };
  const finish = () => {
    if (!run) return;
    const c = ctxFn();
    const why = blockReason(save, run.a, c);
    setRun(null);
    if (why) {
      setResult({ a: run.a, o: { text: why, tone: 'bad', deltas: [], moodlets: [] } });
      return;
    }
    const out: GameEvent[] = [];
    const o = completeAction(save, run.a, c, out);
    setResult({ a: run.a, o });
    onEvents(out.filter((e) => e.type !== 'moodlet'));
  };

  const head = (
    <>
      {b.emoji ? <span className="place-emoji">{b.emoji}</span> : null}
      {b.name.split(' · ')[0]}
    </>
  );

  let body: React.ReactNode;
  if (run) body = <Progress key={run.started} a={run.a} secs={run.secs} onDone={finish} onCancel={() => setRun(null)} />;
  else if (result)
    body = (
      <ResultCard
        a={result.a}
        o={result.o}
        again={!blockReason(save, result.a, ctxFn()) && !isHidden(save, result.a, ctxFn()) ? () => start(result.a) : null}
        onBack={() => setResult(null)}
      />
    );
  else
    body = (
      <>
        {tabs.length ? (
          <div className="tabs place-tabs" role="tablist">
            <button role="tab" className={'tab' + (tab === 'do' ? ' on' : '')} onClick={() => setTab('do')}>
              Things to do
            </button>
            {tabs.map((t) => (
              <button key={t.id} role="tab" className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
        {tab !== 'do' ? (
          tabs.find((t) => t.id === tab)?.node
        ) : (
          <>
            {top}
            {closed ?? (
              <ul className="item-list action-list">
                {list
                  .filter((a) => !isHidden(save, a, ctx))
                  .map((a) => (
                    <ActionRow key={a.id} a={a} save={save} ctx={ctx} onGo={() => start(a)} />
                  ))}
              </ul>
            )}
          </>
        )}
      </>
    );

  return (
    <Modal title={head} sub={run || result ? undefined : greeting ?? b.blurb} onClose={onClose} className="place-modal">
      {body}
    </Modal>
  );
}

function ActionRow({ a, save, ctx, onGo }: { a: ActionDef; save: SaveState; ctx: ActionCtx; onGo: () => void }) {
  const why = blockReason(save, a, ctx);
  const cost = actionCost(save, a, ctx);
  const secs = secsFor(a);
  return (
    <li className={'item action' + (why ? ' blocked' : '')}>
      <button className="action-btn" onClick={onGo} disabled={!!why} aria-label={`${a.label}${cost ? `, ${money(cost)}` : ''}`}>
        <span className="action-emoji" aria-hidden>
          {a.emoji}
        </span>
        <span className="item-main">
          <span className="item-name">{a.label}</span>
          <span className="item-note">{why ?? a.note}</span>
          <span className="item-fx">
            <span className="fx time">⏱ {secs}s</span>
            {Object.entries(a.fx ?? {}).map(([k, v]) => (
              <span key={k} className={v! > 0 ? 'fx up' : 'fx down'}>
                {FX_ICON[k]} {v! > 0 ? '+' : ''}
                {v}
              </span>
            ))}
            {a.gig ? <span className="fx up">+{money(a.gig[0])}{a.gig[1] !== a.gig[0] ? `–${money(a.gig[1])}` : ''}</span> : null}
            {a.moodlet && MOODLETS[a.moodlet] ? <span className="fx moodlet">{MOODLETS[a.moodlet].emoji} {MOODLETS[a.moodlet].name}</span> : null}
          </span>
        </span>
        <span className={'action-cost' + (cost ? '' : ' free')}>{cost ? money(cost) : 'Free'}</span>
      </button>
    </li>
  );
}

function Progress({ a, secs, onDone, onCancel }: { a: ActionDef; secs: number; onDone: () => void; onCancel: () => void }) {
  const lines = useMemo(() => a.progress ?? ['Getting on with it…', 'Still going…', 'Nearly there…'], [a]);
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(secs);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t0 = performance.now();
    const iv = setInterval(() => {
      const el = (performance.now() - t0) / 1000;
      setLeft(Math.max(0, Math.ceil(secs - el)));
      setI(Math.min(lines.length - 1, Math.floor((el / secs) * lines.length)));
      if (el >= secs) {
        clearInterval(iv);
        done.current();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [secs, lines]);
  return (
    <div className="progress-view" data-testid="action-progress">
      <div className="progress-emoji" aria-hidden>
        {a.emoji}
      </div>
      <div className="progress-title">{a.label}</div>
      <div className="progress-line" aria-live="polite">
        {lines[i]}
      </div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={secs} aria-valuenow={secs - left}>
        <div className="progress-fill" style={{ animationDuration: `${secs}s` }} />
      </div>
      <div className="progress-meta">
        <span className="muted small">{left}s left</span>
        <button className="btn btn-ghost btn-small" onClick={onCancel}>
          Never mind
        </button>
      </div>
    </div>
  );
}

function ResultCard({ a, o, again, onBack }: { a: ActionDef; o: ActionOutcome; again: (() => void) | null; onBack: () => void }) {
  return (
    <div className={'result-card ' + o.tone} data-testid="action-result">
      <div className="result-emoji" aria-hidden>
        {a.emoji}
      </div>
      <p className="result-text">{o.text}</p>
      {o.deltas.length ? (
        <div className="item-fx result-fx">
          {o.deltas.map((d) => (
            <span key={d.k} className={'fx ' + (d.v > 0 ? 'up' : 'down')}>
              {d.money ? `${d.v > 0 ? '+' : '-'}${money(Math.abs(d.v))}` : `${d.k} ${d.v > 0 ? '+' : ''}${d.v}`}
            </span>
          ))}
        </div>
      ) : null}
      {o.moodlets.map((id) => {
        const m = MOODLETS[id];
        return (
          <div key={id} className={'moodlet-get ' + (m.mood >= 0 ? 'good' : 'bad')}>
            <span className="moodlet-emoji">{m.emoji}</span>
            <div>
              <b>{m.name}</b> <span className="muted">({m.mood > 0 ? '+' : ''}{m.mood} mood)</span>
              <div className="small muted">{m.desc}</div>
            </div>
          </div>
        );
      })}
      <div className="btn-row">
        {again ? (
          <button className="btn btn-ghost" onClick={again}>
            Again
          </button>
        ) : null}
        <button className="btn btn-primary" onClick={onBack} autoFocus>
          {o.tone === 'bad' ? 'Right…' : 'Lovely'}
        </button>
      </div>
    </div>
  );
}

export const ctxNow = (raining: boolean, regulars: number): ActionCtx => ({ raining, regulars, t: london() });
export { ACTION_BY_ID };
