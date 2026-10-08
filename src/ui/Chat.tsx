import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '../game/engine';
import { MAX_CHAT } from '../net/filter';

export function Chat({ snap, onSend, onClose }: { snap: Snapshot; onSend: (t: string) => boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [snap.chat.length]);
  useEffect(() => {
    // don't pop the keyboard up on phones automatically
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, []);
  const send = () => {
    if (!text.trim()) return;
    if (onSend(text)) setText('');
  };
  const online = snap.netMode === 'online' && snap.netStatus === 'online';
  return (
    <div className="chat panel" role="dialog" aria-label="Chat">
      <div className="chat-head">
        <b>Peckwell chat</b>
        <span className="muted small">{online ? `${snap.online} online · be nice` : 'Offline · NPC chatter is local only'}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>
      <div className="chat-list" ref={listRef}>
        {snap.chat.map((m) => (
          <div key={m.id} className={'chat-msg ' + m.kind}>
            {m.kind === 'system' ? (
              <span>{m.text}</span>
            ) : (
              <>
                <b>{m.name}</b>
                {m.kind === 'npc' ? <span className="npc-tag">NPC</span> : null}
                <span>{m.text}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          ref={inputRef}
          value={text}
          maxLength={MAX_CHAT}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              (e.target as HTMLInputElement).blur();
              onClose();
            }
          }}
          placeholder="Say something nice (or about the weather)…"
          aria-label="Chat message"
          enterKeyHint="send"
        />
        <span className="chat-count">{MAX_CHAT - text.length}</span>
        <button className="btn btn-primary btn-small" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}
