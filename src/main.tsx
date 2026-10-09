import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { setClockOffset } from './game/time';
import { installAudioUnlock } from './game/audio';

installAudioUnlock();

// ?debug=1&clock=<ms> runs the whole game shifted in time (screenshots and testing rent day)
const q = new URLSearchParams(location.search);
if (q.has('debug') && Number(q.get('clock'))) setClockOffset(Number(q.get('clock')));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
