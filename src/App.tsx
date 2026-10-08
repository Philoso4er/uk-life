import { useState } from 'react';
import { loadSave, newSave, writeSave } from './game/economy';
import type { SaveState } from './game/types';
import { Title } from './ui/Title';
import { Creator } from './ui/Creator';
import { Game } from './ui/Game';
import { cleanName } from './net/filter';

type Screen = 'title' | 'create' | 'game';

export default function App() {
  const [save, setSave] = useState<SaveState | null>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('title');

  if (screen === 'title')
    return (
      <Title
        save={save}
        onContinue={() => setScreen('game')}
        onNew={() => setScreen('create')}
      />
    );
  if (screen === 'create' || !save)
    return (
      <Creator
        mode="new"
        initial={save?.avatar}
        initialName={save?.name}
        onBack={() => setScreen('title')}
        onDone={(name, avatar) => {
          const s = newSave(cleanName(name), avatar);
          writeSave(s);
          setSave(s);
          setScreen('game');
        }}
      />
    );
  return <Game save={save} onQuit={() => { setSave(loadSave()); setScreen('title'); }} />;
}
