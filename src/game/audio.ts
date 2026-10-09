// Tiny synthesised soundscape: no audio files, nothing loud. WebAudio only starts after the first
// tap/keypress (browser autoplay rules), and everything is a no-op in tests or old browsers.

const SOUND_KEY = 'uklife.sound';
const HAPTICS_KEY = 'uklife.haptics';

type Listener = () => void;
const listeners = new Set<Listener>();
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);
const readFlag = (k: string) => ls()?.getItem(k) !== '0';

let soundOn = readFlag(SOUND_KEY);
let hapticsOn = readFlag(HAPTICS_KEY);
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let rainGain: GainNode | null = null;
let rainSrc: AudioBufferSourceNode | null = null;
let rainLevel = 0;

export const audioSettings = {
  get sound() {
    return soundOn;
  },
  get haptics() {
    return hapticsOn;
  },
  setSound(v: boolean) {
    soundOn = v;
    ls()?.setItem(SOUND_KEY, v ? '1' : '0');
    if (master && ctx) master.gain.setTargetAtTime(v ? 0.55 : 0, ctx.currentTime, 0.05);
    if (v) sfx.pop();
    listeners.forEach((f) => f());
  },
  setHaptics(v: boolean) {
    hapticsOn = v;
    ls()?.setItem(HAPTICS_KEY, v ? '1' : '0');
    if (v) vibrate(30);
    listeners.forEach((f) => f());
  },
  subscribe(f: Listener) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
};

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = soundOn ? 0.55 : 0;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    if (rainLevel > 0) startRain();
  } catch {
    ctx = null;
  }
}
/** Hook the unlock to the first real interaction. */
export function installAudioUnlock() {
  if (typeof window === 'undefined') return;
  const go = () => {
    unlockAudio();
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    }
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
}

const live = () => (ctx && master && soundOn && ctx.state === 'running' ? ctx : null);

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}
function tone(freq: number, at: number, peak: number, decay: number, type: OscillatorType = 'sine', attack = 0.005) {
  const c = live();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  env(g, at, peak, attack, decay);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}
function burst(at: number, peak: number, dur: number, filter: BiquadFilterType, freq: number, q = 1) {
  const c = live();
  if (!c || !noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  env(g, at, peak, 0.004, dur);
  src.connect(f).connect(g).connect(master!);
  src.start(at, Math.random() * 1.5);
  src.stop(at + dur + 0.05);
}

function vibrate(p: number | number[]) {
  if (!hapticsOn || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate(p);
  } catch {
    /* some browsers throw if not allowed yet */
  }
}

let lastStep = 0;
export const sfx = {
  /** soft footstep on paving */
  step(surface: 'pave' | 'grass' = 'pave') {
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    if (t - lastStep < 0.12) return;
    lastStep = t;
    burst(t, surface === 'grass' ? 0.05 : 0.07, 0.05, 'lowpass', surface === 'grass' ? 500 + Math.random() * 200 : 900 + Math.random() * 400, 0.7);
  },
  /** the two-tone Tube door chime */
  chime() {
    const c = live();
    if (!c) return;
    const t = c.currentTime + 0.02;
    tone(784, t, 0.12, 0.9);
    tone(1568, t, 0.03, 0.5);
    tone(622, t + 0.32, 0.12, 1.1);
    tone(1244, t + 0.32, 0.03, 0.6);
  },
  /** phone buzz on your desk */
  buzz() {
    vibrate([70, 50, 70]);
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    for (const k of [0, 0.17]) {
      tone(155, t + k, 0.07, 0.11, 'square', 0.01);
      tone(310, t + k, 0.02, 0.1, 'triangle', 0.01);
    }
  },
  /** ka-ching */
  till() {
    vibrate(20);
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    burst(t, 0.06, 0.04, 'highpass', 3000);
    tone(1318, t + 0.04, 0.07, 0.35, 'triangle');
    tone(1760, t + 0.1, 0.06, 0.5, 'triangle');
  },
  /** a card / notification appears */
  pop() {
    const c = live();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(760, t + 0.06);
    env(g, t, 0.06, 0.004, 0.12);
    o.connect(g).connect(master!);
    o.start(t);
    o.stop(t + 0.2);
  },
};

function startRain() {
  const c = live();
  if (!c || !noise || rainSrc) return;
  rainSrc = c.createBufferSource();
  rainSrc.buffer = noise;
  rainSrc.loop = true;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 500;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  rainGain = c.createGain();
  rainGain.gain.value = 0;
  rainSrc.connect(hp).connect(lp).connect(rainGain).connect(master!);
  rainSrc.start();
}
/** 0..1, smoothed. Muffled indoors. */
export function setRainLevel(level: number) {
  rainLevel = level;
  if (level > 0.01) startRain();
  if (rainGain && ctx) rainGain.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.4);
}
