import { drawAvatar, walkFrame } from './avatar';
import { setRainLevel, sfx } from './audio';
import { makeBots, makeWalkers, updateBot, type Bot } from './bots';
import { ROADS, ZEBRAS, hitsAnyVehicle, stepVehicles, vehHalfW, zebraAt, type Car, type Person } from './traffic';
import { JOBS, catchUp, tick, type GameEvent } from './economy';
import { activeMoodlets, effectiveMood } from './needs';
import { london, now as realNow } from './time';
import { SocialStore } from './social';
import { NpcBrain } from './npcs';
import { findPath, type Grid } from './pathfind';
import { INTERIORS, WALL_MOUNTED, atExit, drawFurn, gridOf, interiorFor, prerenderInterior, spawnOf, useAt, type Interior, type UseSpot } from './interiors';
import { RateLimiter, checkWishes, chatterLine, npcKey, playerKey, staffAvatar, staffKey, wantedPlace, type PersonRef } from './people';
import { placeOpen } from './actions';
import { newId } from './social';
import { cleanMessage } from '../net/filter';
import { FONT, billboardAt, drawBillboard, drawPigeon, drawTrain, drawVehicle, makeGlow, prerenderWorld } from './render';
import type { Facing, JobId, SaveState, HomeId, GoalId } from './types';
import { H, T, TILE, W, billboards, buildings, deliveryDoors, doorFront, inPark, isSolid, lamps, buildingById, places, spots, tiles, type Billboard, type Building } from './world';
import { MAX_SAY, type NetMode, type PlayerState, type SocialWire, type Transport } from '../net/types';

export type ActWire = Extract<SocialWire, { t: 'act' }>;
export interface RoomLine {
  id: string;
  name: string;
  text: string;
  ts: number;
  kind: 'me' | 'player' | 'npc' | 'staff';
}
interface StaffEnt {
  name: string;
  role: string;
  avatar: import('./types').Avatar;
  x: number;
  y: number;
  facing: Facing;
  bubble?: { text: string; until: number };
}
interface Scene {
  b: Building;
  r: Interior;
  grid: Grid;
  canvas: HTMLCanvasElement | null;
  staff: StaffEnt[];
}

export interface EngineCallbacks {
  onInteract(b: Building): void;
  onBillboard(bb: Billboard): void;
  onEvents(ev: GameEvent[]): void;
  /** `done` = drops actually made; `cancelled` when you bailed out early */
  onDeliveryDone(earned: number, onTime: number, total: number, done: number, cancelled: boolean): void;
  onIncoming?(kind: 'dm' | 'post', from: string, text: string): void;
  /** walked up to a use spot inside a building (the till, the bar, the bed…) */
  onUse?(b: Building, use: UseSpot): void;
  /** tapped a person (street or indoors) */
  onPerson?(p: PersonRef): void;
  /** walked into / out of a building */
  onEnter?(b: Building, r: Interior): void;
  onLeave?(b: Building): void;
  /** another player did something to you (wave, drink, invite…); `boost` = it counts for Social */
  onAct?(m: ActWire, from: PersonRef | null, boost: boolean): void;
}

export interface DeliveryView {
  target: string;
  remaining: number;
  index: number;
  total: number;
  earned: number;
}

export interface Snapshot {
  money: number;
  oyster: number;
  energy: number;
  hunger: number;
  social: number;
  hygiene: number;
  warmth: number;
  /** effective mood (base + moodlets) */
  mood: number;
  moodlets: { id: string; name: string; emoji: string; mood: number; desc: string; left: number; dynamic: boolean }[];
  /** real time (ms), for the clock */
  now: number;
  meter: number;
  streak: number;
  job: JobId | null;
  home: HomeId;
  shifts: number;
  rent: number;
  arrears: number;
  umbrella: boolean;
  goals: Partial<Record<GoalId, boolean>>;
  raining: boolean;
  netMode: NetMode;
  netStatus: string;
  online: number;
  localPeers: number;
  npcs: number;
  nearby: { id: string; name: string; spot: boolean } | null;
  delivery: DeliveryView | null;
  fps: number;
  /** the building you're inside, if any */
  scene: { id: string; title: string } | null;
  /** how many other people are in the room with you */
  here: number;
  /** the use spot you're standing at */
  nearUse: { id: string; label: string; emoji: string } | null;
  /** bumps when the room chat changes */
  chatN: number;
}

interface Remote {
  p: PlayerState;
  rx: number;
  ry: number;
  last: number;
  bubble?: { text: string; until: number };
  room?: string;
}

interface Pigeon {
  x: number;
  y: number;
  fly: number;
  vx: number;
  vy: number;
  flip: boolean;
  phase: number;
}

const PLAYER_SPEED = 4.3; // tiles per second
const R = 0.28;

export class Engine {
  save: SaveState;
  private ctx: CanvasRenderingContext2D;
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticScale = 2;
  private glow = makeGlow();
  private dpr = 1;
  private zoom = 1;
  private vw = 0;
  private vh = 0;
  private cam = { x: 0, y: 0 };
  private player: { x: number; y: number; facing: Facing; moving: boolean; path: { x: number; y: number }[]; pending: string | null; stuck: number };
  private keys = new Set<string>();
  bots: Bot[] = [];
  private remotes = new Map<string, Remote>();
  /** public for debug tooling (shots scripts) */
  vehicles: Car[] = [];
  private pigeons: Pigeon[] = [];
  private train = { x: -9999, next: 6 };
  private drops: { x: number; y: number; l: number; s: number }[] = [];
  raining = false;
  private rainLevel = 0;
  private t = 0;
  private tickAcc = 0;
  private lastTickReal = 0;
  private weatherAt = 0;
  private indoors = false;
  paused = false;
  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private snapTimer = 0;
  private dirty = true;
  private raf = 0;
  private lastFrame = 0;
  private fps = 60;
  private transport: Transport | null = null;
  private netMode: NetMode = 'offline';
  private netStatus = 'offline';
  private online = 1;
  private lastSent = { x: 0, y: 0, facing: 'down' as Facing, moving: false, at: 0, room: '' };
  readonly social: SocialStore;
  readonly brain: NpcBrain;
  private delivery: { stops: { name: string; x: number; y: number }[]; index: number; deadline: number; limit: number; earned: number; onTime: number } | null = null;
  private tap: { x: number; y: number; t: number } | null = null;
  private holding: { sx: number; sy: number } | null = null;
  private holdTimer = 0;
  private hoverBillboard: string | null = null;
  private nearby: Building | null = null;
  private bubble: { text: string; until: number } | null = null;
  private disposed = false;
  /** per-tab network id so the same save open in two tabs shows as two people */
  readonly netId: string;
  // ---- interiors & people
  private scene: Scene | null = null;
  private nearUse: UseSpot | null = null;
  private roomCanvases = new Map<string, HTMLCanvasElement>();
  private roomGrids = new Map<string, Grid>();
  /** locals you've invited somewhere: name -> where & until when (real ms) */
  private overrides = new Map<string, { place: string; until: number }>();
  private schedAt = 0;
  private chatterAt = 0;
  /** room chat in the building you're in (cleared when you leave) */
  roomLog: RoomLine[] = [];
  private chatN = 0;
  private actOut = new RateLimiter(6, 60000, 2000);
  private actIn = new RateLimiter(4, 30000);
  private sayOut = new RateLimiter(5, 20000, 1500);
  private sayIn = new RateLimiter(6, 20000);
  private drinkIn = new RateLimiter(3, 3600000);

  constructor(private canvas: HTMLCanvasElement, save: SaveState, private cb: EngineCallbacks) {
    this.save = save;
    this.netId = `${save.id}.${Math.random().toString(36).slice(2, 6)}`;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.social = new SocialStore('uklife.social.' + save.id, { id: save.id, name: save.name, avatar: save.avatar });
    this.brain = new NpcBrain(this.social, save);
    this.brain.onSpeak = (name, text) => {
      const b = this.bots.find((x) => x.name === name);
      if (b) b.bubble = { text: text.length > 90 ? text.slice(0, 88) + '…' : text, until: this.t + 6 };
    };
    const p = this.validSpawn(save.pos.x, save.pos.y);
    this.player = { x: p.x, y: p.y, facing: 'down', moving: false, path: [], pending: null, stuck: 0 };
    this.cam = { x: p.x * TILE, y: p.y * TILE };
    this.snap = this.makeSnapshot();
    this.initVehicles();
    this.initPigeons();
    this.raining = false;
  }

  // ------------------------------------------------------------ lifecycle
  async start(transport: Transport) {
    this.resize();
    try {
      await Promise.all([document.fonts?.load(`700 12px "Rubik"`), document.fonts?.load(`500 12px "Rubik"`)]);
    } catch {
      /* fallback font is fine */
    }
    this.staticCanvas = prerenderWorld(this.staticScale);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('mousemove', this.onHover);
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.transport = transport;
    this.netMode = transport.mode;
    const regulars = makeBots(transport.mode === 'online' ? 6 : 12, [this.save.name]);
    for (const b of regulars) this.brain.setAvatar(b.name, b.avatar);
    this.bots = [...regulars, ...makeWalkers(transport.mode === 'online' ? 4 : 6)];
    this.scheduleLocals(true);
    this.social.sender = (m) => this.transport?.sendSocial(m);
    this.social.onIncoming = (kind, a, text) => this.cb.onIncoming?.(kind, a.name, text);
    const out: GameEvent[] = [];
    catchUp(this.save, out);
    this.lastTickReal = realNow();
    if (out.length) this.cb.onEvents(out);
    this.brain.seed(this.npcCtx());
    this.netStatus = transport.mode === 'online' ? 'connecting' : transport.mode;
    try {
      await transport.start(this.playerState(), {
        onState: (p) => {
          if (p.pid) this.social.upsertAuthor({ id: p.pid, name: p.name, handle: '@' + p.name.replace(/[^\w]/g, '').slice(0, 14), kind: 'player', avatar: p.avatar });
          const r = this.remotes.get(p.id);
          if (r) {
            if ((r.room ?? '') !== (p.room ?? '')) {
              // walked through a door: jump, don't glide across the map
              r.rx = p.x;
              r.ry = p.y;
              this.dirty = true;
            }
            r.p = p;
            r.room = p.room;
            r.last = performance.now();
          } else this.remotes.set(p.id, { p, rx: p.x, ry: p.y, last: performance.now(), room: p.room });
        },
        onLeave: (id) => this.remotes.delete(id),
        onSocial: (m) => {
          if (m.t === 'act') return this.receiveAct(m);
          if (m.t === 'say') return this.receiveSay(m);
          this.social.receive(m);
          if (m.t === 'post' && !m.replyTo && !this.social.isMuted(m.from)) {
            for (const r of this.remotes.values()) if (r.p.pid === m.from) r.bubble = { text: m.text, until: this.t + 6 };
          }
        },
        onCount: (n) => {
          this.online = n;
          this.dirty = true;
        },
        onStatus: (s) => {
          this.netStatus = s === 'SUBSCRIBED' ? 'online' : s.toLowerCase();
          this.dirty = true;
        },
      });
    } catch (e) {
      console.warn('Realtime unavailable, carrying on in offline mode', e);
      this.netStatus = 'error';
    }
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('mousemove', this.onHover);
    this.transport?.stop();
    this.social.persist();
  }

  // ------------------------------------------------------------ store
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  /** call after mutating `save` from the UI */
  touch() {
    this.dirty = true;
    this.flush();
  }
  private flush() {
    this.snap = this.makeSnapshot();
    this.dirty = false;
    this.listeners.forEach((l) => l());
  }
  private makeSnapshot(): Snapshot {
    const s = this.save;
    const d = this.delivery;
    return {
      money: s.money,
      oyster: s.oyster,
      energy: s.energy,
      hunger: s.hunger,
      social: s.social,
      hygiene: s.hygiene,
      warmth: s.warmth,
      mood: effectiveMood(s, this.raining),
      moodlets: activeMoodlets(s, this.raining).map((m) => ({ id: m.def.id, name: m.def.name, emoji: m.def.emoji, mood: m.def.mood, desc: m.def.desc, left: m.left, dynamic: m.dynamic })),
      now: realNow(),
      meter: s.meter,
      streak: s.streak.count,
      job: s.job,
      home: s.home,
      shifts: s.shifts,
      rent: s.rent,
      arrears: s.arrears,
      umbrella: s.umbrellaUntil > s.life,
      goals: { ...s.goals },
      raining: this.raining,
      netMode: this.netMode,
      netStatus: this.netStatus,
      online: this.online,
      localPeers: this.remotes.size,
      npcs: this.bots.length,
      nearby: this.nearby ? { id: this.nearby.id, name: this.nearby.name, spot: this.nearby.kind === 'spot' } : null,
      delivery: d ? { target: d.stops[d.index].name, remaining: Math.max(0, d.deadline - this.t), index: d.index, total: d.stops.length, earned: d.earned } : null,
      fps: Math.round(this.fps),
      scene: this.scene ? { id: this.scene.b.id, title: this.scene.r.title } : null,
      here: this.scene ? this.hereNow().length : 0,
      nearUse: this.nearUse ? { id: this.nearUse.id, label: this.nearUse.label, emoji: this.nearUse.emoji } : null,
      chatN: this.chatN,
    };
  }

  // ------------------------------------------------------------ public API
  teleport(x: number, y: number) {
    if (this.scene) this.exitScene();
    const p = this.validSpawn(x, y);
    this.player.x = p.x;
    this.player.y = p.y;
    this.player.path = [];
    this.player.pending = null;
    this.cam.x = p.x * TILE;
    this.cam.y = p.y * TILE;
    this.save.pos = { x: p.x, y: p.y };
    this.sendNet(true);
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      this.keys.clear();
      this.player.path = [];
      this.player.pending = null;
      this.holding = null;
    }
  }
  setRain(on: boolean) {
    this.raining = on;
    this.dirty = true;
  }
  get playerPos() {
    return { x: this.player.x, y: this.player.y };
  }

  walkTo(x: number, y: number, pending: string | null = null) {
    const path = this.scene ? findPath(this.player.x, this.player.y, x, y, 'plain', this.scene.grid) : findPath(this.player.x, this.player.y, x, y, 'player');
    this.player.path = path ?? [];
    this.player.pending = path ? pending : null;
    this.player.stuck = 0;
  }

  /** First-session guide: point at this building (null to stop). */
  setGuideTarget(id: string | null) {
    this.guideTarget = id ? buildingById(id) ?? null : null;
  }
  private guideTarget: Building | null = null;
  private lastWalkFrame = -1;

  interactNearby() {
    if (this.paused) return;
    if (this.scene) {
      if (this.nearUse) this.cb.onUse?.(this.scene.b, this.nearUse);
      return;
    }
    if (this.nearby) this.arriveDoor(this.nearby);
  }

  // ------------------------------------------------------------ interiors
  /** Can you walk into this building (vs. just getting its menu)? */
  canEnter(b: Building) {
    return !this.delivery && !!interiorFor(b, this.save) && placeOpen(b.id, london());
  }
  private arriveDoor(b: Building) {
    if (this.canEnter(b)) this.enterBuilding(b);
    else this.cb.onInteract(b);
  }
  get inside() {
    return this.scene?.b ?? null;
  }
  get room() {
    return this.scene?.r ?? null;
  }
  enterBuilding(b: Building) {
    const r = interiorFor(b, this.save);
    if (!r) return false;
    let canvas = this.roomCanvases.get(r.id + ':' + r.title + ':' + r.furn.length) ?? null;
    if (!canvas && typeof document !== 'undefined') {
      canvas = prerenderInterior(r, 2);
      this.roomCanvases.set(r.id + ':' + r.title + ':' + r.furn.length, canvas);
    }
    const staff = r.staff.map((st) => ({ name: st.name, role: st.role, avatar: staffAvatar(st), x: st.at[0], y: st.at[1], facing: st.face }));
    this.scene = { b, r, grid: gridOf(r), canvas, staff };
    const sp = spawnOf(r);
    const p = this.player;
    p.x = sp.x;
    p.y = sp.y;
    p.facing = 'up';
    p.path = [];
    p.pending = null;
    p.moving = false;
    this.cam.x = p.x * TILE;
    this.cam.y = p.y * TILE;
    const f = doorFront(b);
    this.save.pos = { x: f.x, y: f.y };
    this.nearby = null;
    this.roomLog = [];
    this.chatN++;
    this.chatterAt = this.t + 4;
    sfx.pop();
    this.sendNet(true);
    this.dirty = true;
    this.cb.onEnter?.(b, r);
    return true;
  }
  /** Walk back out onto the street, just outside the same door. */
  leaveBuilding() {
    const b = this.exitScene();
    if (b) this.cb.onLeave?.(b);
  }
  private exitScene() {
    const sc = this.scene;
    if (!sc) return null;
    this.scene = null;
    this.nearUse = null;
    const f = doorFront(sc.b);
    const p = this.player;
    const pos = this.validSpawn(f.x, f.y);
    p.x = pos.x;
    p.y = pos.y;
    p.facing = sc.b.face === 'N' ? 'up' : 'down';
    p.path = [];
    p.pending = null;
    this.cam.x = p.x * TILE;
    this.cam.y = p.y * TILE;
    this.save.pos = { x: p.x, y: p.y };
    this.roomLog = [];
    this.chatN++;
    this.sendNet(true);
    this.dirty = true;
    return sc.b;
  }
  private gridFor(id: string) {
    let g = this.roomGrids.get(id);
    if (!g) {
      g = gridOf(INTERIORS[id]);
      this.roomGrids.set(id, g);
    }
    return g;
  }

  // ------------------------------------------------------------ people
  private botRef(b: Bot): PersonRef {
    return { key: npcKey(b.name), kind: 'npc', name: b.name, avatar: b.avatar, place: b.inside ?? null };
  }
  private remoteRef(r: Remote): PersonRef {
    return { key: playerKey(r.p.pid ?? r.p.id), kind: 'player', name: r.p.name, avatar: r.p.avatar, netId: r.p.id, pid: r.p.pid, place: r.p.room ?? null, mood: r.p.mood, status: r.p.status };
  }
  private staffRef(st: StaffEnt): PersonRef {
    return { key: staffKey(st.name), kind: 'staff', name: st.name, avatar: st.avatar, place: this.scene?.b.id ?? null, role: st.role };
  }
  /** Everyone in the building with you (staff, locals, real players). */
  hereNow(): PersonRef[] {
    const sc = this.scene;
    if (!sc) return [];
    const out: PersonRef[] = sc.staff.map((st) => this.staffRef(st));
    for (const b of this.bots) if (b.inside === sc.b.id) out.push(this.botRef(b));
    for (const r of this.remotes.values()) if (r.p.room === sc.b.id) out.push(this.remoteRef(r));
    return out;
  }
  /** People inside a building (not counting staff), for the street badges. */
  occupancy(id: string) {
    let n = 0;
    for (const b of this.bots) if (b.inside === id) n++;
    for (const r of this.remotes.values()) if (r.p.room === id) n++;
    return n;
  }
  /** Find a person by their key (for refreshing a profile card). */
  personByKey(key: string): PersonRef | null {
    if (key.startsWith('staff:')) {
      const st = this.scene?.staff.find((x) => staffKey(x.name) === key);
      return st ? this.staffRef(st) : null;
    }
    if (key.startsWith('npc:')) {
      const b = this.bots.find((x) => !x.ambient && npcKey(x.name) === key);
      return b ? this.botRef(b) : null;
    }
    for (const r of this.remotes.values()) if (playerKey(r.p.pid ?? r.p.id) === key) return this.remoteRef(r);
    return null;
  }
  private personAt(wx: number, wy: number): PersonRef | null {
    const sc = this.scene;
    let best: { y: number; ref: () => PersonRef } | null = null;
    const hit = (x: number, y: number, ref: () => PersonRef) => {
      if (Math.abs(wx - x) < 0.45 && wy > y - 1.55 && wy < y + 0.25 && (!best || y > best.y)) best = { y, ref };
    };
    if (sc) {
      for (const st of sc.staff) hit(st.x, st.y, () => this.staffRef(st));
      for (const b of this.bots) if (b.inside === sc.b.id) hit(b.x, b.y, () => this.botRef(b));
      for (const r of this.remotes.values()) if (r.p.room === sc.b.id) hit(r.rx, r.ry, () => this.remoteRef(r));
    } else {
      for (const b of this.bots) if (!b.ambient && !b.inside) hit(b.x, b.y, () => this.botRef(b));
      for (const r of this.remotes.values()) if (!r.p.room) hit(r.rx, r.ry, () => this.remoteRef(r));
    }
    return best ? (best as { ref: () => PersonRef }).ref() : null;
  }
  /** Pop a speech/emote bubble over someone. */
  emote(who: PersonRef, text: string) {
    const bubble = { text: text.length > 90 ? text.slice(0, 88) + '…' : text, until: this.t + 5 };
    if (who.kind === 'staff') {
      const st = this.scene?.staff.find((x) => x.name === who.name);
      if (st) st.bubble = bubble;
    } else if (who.kind === 'npc') {
      const b = this.bots.find((x) => x.name === who.name);
      if (b) b.bubble = bubble;
    } else for (const r of this.remotes.values()) if (r.p.id === who.netId) r.bubble = bubble;
  }
  /** Face someone you're talking to. */
  faceTowards(who: PersonRef) {
    let x: number | null = null;
    let y = 0;
    if (who.kind === 'staff') {
      const st = this.scene?.staff.find((s) => s.name === who.name);
      if (st) [x, y] = [st.x, st.y];
    } else if (who.kind === 'npc') {
      const b = this.bots.find((s) => s.name === who.name);
      if (b && (b.inside ?? null) === (this.scene?.b.id ?? null)) [x, y] = [b.x, b.y];
    }
    if (x == null) return;
    const dx = x - this.player.x;
    const dy = y - this.player.y;
    this.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }
  /** Send a canned action to another player. Returns an error, or null when sent. */
  sendAct(who: PersonRef, kind: ActWire['kind'], extra: { n?: number; place?: string } = {}): string | null {
    if (!who.netId) return 'They’ve gone.';
    if (!this.transport) return 'Not connected.';
    if (!this.actOut.ok('all')) return 'Easy, tiger. Give it a few seconds.';
    this.transport.sendSocial({ t: 'act', id: newId(), from: this.save.id, name: this.save.name, to: who.netId, kind, ...extra });
    return null;
  }
  private receiveAct(m: ActWire) {
    if (m.to !== this.netId || m.from === this.save.id || this.social.isMuted(m.from)) return;
    if (!this.actIn.ok(m.from)) return;
    let ref: PersonRef | null = null;
    for (const r of this.remotes.values())
      if (r.p.pid === m.from) {
        ref = this.remoteRef(r);
        r.bubble = { text: { wave: '👋', nod: '🙂', compliment: '💐', drink: '🍺', follow: '➕', invite: '📍', accept: '👍', decline: '🙅' }[m.kind], until: this.t + 4 };
      }
    const boost = m.kind === 'drink' ? this.drinkIn.ok(m.from) : true;
    this.cb.onAct?.(m, ref, boost);
  }
  /** Say something out loud in the room you're in (everyone inside sees it). */
  sayInRoom(raw: string): string | null {
    const sc = this.scene;
    if (!sc) return 'You’re not inside anywhere.';
    const text = cleanMessage(raw, MAX_SAY);
    if (!text) return 'Say something first.';
    if (!this.sayOut.ok('all')) return 'Let someone else get a word in.';
    const line: RoomLine = { id: newId(), name: this.save.name, text, ts: Date.now(), kind: 'me' };
    this.pushRoom(line);
    this.say(text);
    this.transport?.sendSocial({ t: 'say', id: line.id, from: this.save.id, name: this.save.name, room: sc.b.id, text, ts: line.ts });
    return null;
  }
  private receiveSay(m: Extract<SocialWire, { t: 'say' }>) {
    const sc = this.scene;
    if (!sc || m.room !== sc.b.id || m.from === this.save.id || this.social.isMuted(m.from)) return;
    if (!this.sayIn.ok(m.from)) return;
    if (this.roomLog.some((l) => l.id === m.id)) return;
    this.pushRoom({ id: m.id, name: m.name, text: m.text, ts: Date.now(), kind: 'player' });
    for (const r of this.remotes.values()) if (r.p.pid === m.from) r.bubble = { text: m.text, until: this.t + 6 };
  }
  private pushRoom(l: RoomLine) {
    this.roomLog = [...this.roomLog.slice(-29), l];
    this.chatN++;
    this.dirty = true;
  }
  /** Invite a local somewhere: they'll head there for the next half hour. */
  inviteLocal(name: string, place: string) {
    this.overrides.set(name, { place, until: Date.now() + 30 * 60000 });
    this.schedAt = 0;
  }

  /** Send locals to (and from) the places on their routine. */
  private scheduleLocals(initial = false) {
    const t = london();
    for (const b of this.bots) {
      if (b.ambient) continue;
      const want = wantedPlace(b.name, t, this.overrides.get(b.name));
      if (b.inside && b.inside !== want) {
        // out the door
        const f = doorFront(buildingById(b.inside));
        b.inside = null;
        b.x = f.x;
        b.y = f.y;
        b.path = [];
        b.wait = 0.4;
        b.bubble = undefined;
      }
      if (!want || b.inside === want) {
        if (!want) b.goal = null;
        continue;
      }
      if (initial || !INTERIORS[want]) {
        this.botEnter(b, want);
        continue;
      }
      if (b.goal !== want) {
        b.goal = want;
        b.path = [];
        b.wait = Math.min(b.wait, 0.5);
      }
    }
  }
  private botEnter(b: Bot, place: string) {
    const r = INTERIORS[place];
    b.goal = null;
    b.path = [];
    if (!r) return;
    b.inside = place;
    const g = this.gridFor(place);
    const taken = this.bots.filter((o) => o !== b && o.inside === place).map((o) => [o.x, o.y]);
    const free = r.hang.filter(([x, y]) => !taken.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 0.6) && !g.solid(Math.floor(x), Math.floor(y)));
    const sp = spawnOf(r);
    const [x, y] = free.length ? free[Math.floor(Math.random() * free.length)] : [sp.x, sp.y - 1];
    b.x = x;
    b.y = y;
    b.facing = 'down';
    b.moving = false;
    b.wait = 4 + Math.random() * 10;
    b.phone = Math.random() < 0.3;
    this.dirty = true;
  }
  private updateIndoorBot(b: Bot, dt: number) {
    const r = INTERIORS[b.inside!];
    if (!r) {
      b.inside = null;
      return;
    }
    if (b.wait > 0) {
      b.wait -= dt;
      b.moving = false;
      return;
    }
    if (!b.path.length) {
      const taken = this.bots.filter((o) => o !== b && o.inside === b.inside).map((o) => [o.x, o.y]);
      const free = r.hang.filter(([x, y]) => !taken.some(([ox, oy]) => Math.hypot(ox - x, oy - y) < 0.7) && Math.hypot(x - b.x, y - b.y) > 0.5);
      if (!free.length) {
        b.wait = 5;
        return;
      }
      const [hx, hy] = free[Math.floor(Math.random() * free.length)];
      b.path = findPath(b.x, b.y, hx, hy, 'plain', this.gridFor(b.inside!)) ?? [];
      if (!b.path.length) b.wait = 4;
      return;
    }
    const t = b.path[0];
    const dx = t.x - b.x;
    const dy = t.y - b.y;
    const d = Math.hypot(dx, dy);
    const step = b.speed * 0.6 * dt;
    if (d <= step) {
      b.x = t.x;
      b.y = t.y;
      b.path.shift();
      if (!b.path.length) {
        b.wait = 8 + Math.random() * 16;
        b.facing = Math.random() < 0.6 ? 'down' : Math.random() < 0.5 ? 'left' : 'right';
        b.phone = Math.random() < 0.3;
      }
    } else {
      b.x += (dx / d) * step;
      b.y += (dy / d) * step;
      b.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
    b.moving = true;
  }
  /** Locals heading somewhere walk to its door, then go in. */
  private steerLocal(b: Bot) {
    if (!b.goal || b.inside) return;
    const f = doorFront(buildingById(b.goal));
    if (Math.hypot(b.x - f.x, b.y - f.y) < 0.7) return this.botEnter(b, b.goal);
    if (!b.path.length && b.wait <= 0) {
      const path = findPath(b.x, b.y, f.x, f.y, 'ped');
      if (path) b.path = path;
      else this.botEnter(b, b.goal); // can't find a way: they pop in anyway
    }
  }
  /** Background chatter in the room you're in: the "chat spot". */
  private roomChatter() {
    const sc = this.scene;
    if (!sc || this.t < this.chatterAt) return;
    this.chatterAt = this.t + 9 + Math.random() * 10;
    const locals = this.bots.filter((b) => b.inside === sc.b.id);
    const useStaff = !locals.length || Math.random() < 0.3;
    if (useStaff && sc.staff.length && sc.b.kind !== 'home') {
      const st = sc.staff[Math.floor(Math.random() * sc.staff.length)];
      const text = chatterLine(sc.b.id, true);
      st.bubble = { text, until: this.t + 5 };
      this.pushRoom({ id: newId(), name: st.name, text, ts: Date.now(), kind: 'staff' });
    } else if (locals.length) {
      const b = locals[Math.floor(Math.random() * locals.length)];
      const text = chatterLine(sc.b.id);
      b.bubble = { text, until: this.t + 5 };
      this.pushRoom({ id: newId(), name: b.name, text, ts: Date.now(), kind: 'npc' });
    }
  }

  /** Show a speech bubble over your own head (after posting on Natter). */
  say(text: string) {
    this.bubble = { text: text.length > 90 ? text.slice(0, 88) + '…' : text, until: this.t + 6 };
  }
  /** True while you're inside a building's menu (keeps you dry). */
  setIndoors(v: boolean) {
    this.indoors = v;
  }
  /** NPC regulars (and real players) hanging around a place, e.g. for getting a round in. */
  peopleNear(placeId: string, r = 9) {
    const b = buildingById(placeId);
    if (!b) return 0;
    const f = doorFront(b);
    let n = this.bots.filter((x) => !x.ambient && (x.inside ? x.inside === placeId : Math.hypot(x.x - f.x, x.y - f.y) < r)).length;
    for (const x of this.remotes.values()) if (x.p.room ? x.p.room === placeId : Math.hypot(x.rx - f.x, x.ry - f.y) < r) n++;
    return n;
  }
  /** Real players currently in Peckwell (for starting DMs). */
  onlinePlayers() {
    return [...this.remotes.values()].filter((r) => r.p.pid).map((r) => ({ pid: r.p.pid!, name: r.p.name, avatar: r.p.avatar }));
  }
  npcCtx() {
    const t = london();
    const f = this.save.flags;
    // date-stamped flags only count on the day they were set
    return { raining: this.raining, hh: t.hh, dayIdx: t.dayIdx, flags: { ...f, strike: f.strike === t.dateKey, heatwave: f.heatwave === t.dateKey } };
  }

  startDelivery() {
    if (this.scene) this.exitScene(); // the bike's outside
    const pfc = doorFront(buildingById('pfc'));
    const pool = [...deliveryDoors].sort(() => Math.random() - 0.5).slice(0, 3);
    this.delivery = { stops: pool, index: 0, deadline: 0, limit: 0, earned: 0, onTime: 0 };
    this.setDropTimer(pfc.x, pfc.y);
    this.dirty = true;
  }
  cancelDelivery() {
    if (!this.delivery) return;
    const d = this.delivery;
    this.delivery = null;
    this.cb.onDeliveryDone(d.earned, d.onTime, d.stops.length, d.index, true);
  }
  private setDropTimer(fx: number, fy: number) {
    const d = this.delivery!;
    const s = d.stops[d.index];
    const path = findPath(fx, fy, s.x, s.y);
    let len = 0;
    let px = fx;
    let py = fy;
    for (const pt of path ?? []) {
      len += Math.hypot(pt.x - px, pt.y - py);
      px = pt.x;
      py = pt.y;
    }
    if (!path) len = Math.hypot(s.x - fx, s.y - fy) * 1.4;
    d.limit = Math.round(8 + len / 4.6);
    d.deadline = this.t + d.limit;
  }

  // ------------------------------------------------------------ input
  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = this.vw + 'px';
    this.canvas.style.height = this.vh + 'px';
    const tileCss = Math.max(30, Math.min(50, Math.min(this.vw, this.vh) / 10.5));
    this.zoom = tileCss / TILE;
  };

  private typing() {
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.typing() || this.paused) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
      this.keys.add(k);
      this.player.path = [];
      this.player.pending = null;
      e.preventDefault();
    }
    if (k === 'e' || k === 'enter' || k === ' ') {
      if (this.nearby || this.nearUse) {
        e.preventDefault();
        this.interactNearby();
      }
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private onBlur = () => this.keys.clear();

  private screenToWorld(sx: number, sy: number) {
    const left = this.cam.x - this.vw / 2 / this.zoom;
    const top = this.cam.y - this.vh / 2 / this.zoom;
    return { x: (left + sx / this.zoom) / TILE, y: (top + sy / this.zoom) / TILE };
  }
  private onPointerDown = (e: PointerEvent) => {
    if (this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = this.screenToWorld(sx, sy);
    const who = this.personAt(w.x, w.y);
    if (who) {
      this.cb.onPerson?.(who);
      return;
    }
    if (this.scene) {
      const r = this.scene.r;
      const u = useAt(r, w.x, w.y);
      if (u) {
        this.walkTo(u.at[0], u.at[1], 'use:' + u.id);
        this.tap = { x: u.at[0], y: u.at[1], t: this.t };
        return;
      }
      if (w.y > r.h - 1.25 && Math.abs(w.x - (r.exit + 0.5)) < 1.3) {
        this.walkTo(r.exit + 0.5, r.h - 0.3, 'exit');
        this.tap = { x: r.exit + 0.5, y: r.h - 0.5, t: this.t };
        return;
      }
      this.walkTo(w.x, w.y);
      this.tap = { x: w.x, y: w.y, t: this.t };
      this.holding = { sx, sy };
      return;
    }
    const bb = billboardAt(w.x, w.y);
    if (bb) {
      this.cb.onBillboard(bb);
      return;
    }
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    const b = buildings.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) ?? spots.find((sp) => Math.hypot(sp.x - w.x, sp.y - 0.6 - w.y) < 0.9);
    if (b) {
      const f = doorFront(b);
      this.walkTo(f.x, f.y, b.id);
      this.tap = { x: f.x, y: f.y, t: this.t };
      return;
    }
    this.walkTo(w.x, w.y);
    this.tap = { x: w.x, y: w.y, t: this.t };
    this.holding = { sx, sy };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.holding) return;
    const rect = this.canvas.getBoundingClientRect();
    this.holding = { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };
  private onPointerUp = () => {
    this.holding = null;
  };
  private onHover = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const w = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    if (this.scene) {
      this.canvas.style.cursor = this.personAt(w.x, w.y) || useAt(this.scene.r, w.x, w.y) ? 'pointer' : 'default';
      return;
    }
    const bb = billboardAt(w.x, w.y);
    this.hoverBillboard = bb?.id ?? null;
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    const onBuilding = !!this.personAt(w.x, w.y) || buildings.some((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) || spots.some((sp) => Math.hypot(sp.x - w.x, sp.y - 0.6 - w.y) < 0.9);
    this.canvas.style.cursor = bb || onBuilding ? 'pointer' : 'default';
  };

  // ------------------------------------------------------------ simulation
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private validSpawn(x: number, y: number) {
    if (!this.blocked(x, y)) return { x, y };
    for (let r = 1; r < 8; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) if (!this.blocked(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    return { x: 5, y: 9.5 };
  }

  private blocked(x: number, y: number) {
    const g = this.scene?.grid;
    if (g) return g.solid(Math.floor(x - R), Math.floor(y - 0.22)) || g.solid(Math.floor(x + R), Math.floor(y - 0.22)) || g.solid(Math.floor(x - R), Math.floor(y + 0.12)) || g.solid(Math.floor(x + R), Math.floor(y + 0.12));
    return isSolid(Math.floor(x - R), Math.floor(y - 0.22)) || isSolid(Math.floor(x + R), Math.floor(y - 0.22)) || isSolid(Math.floor(x - R), Math.floor(y + 0.12)) || isSolid(Math.floor(x + R), Math.floor(y + 0.12));
  }

  private update(dt: number) {
    this.t += dt;
    const p = this.player;
    const events: GameEvent[] = [];

    // ---- player movement
    let vx = 0;
    let vy = 0;
    if (!this.paused) {
      if (this.keys.has('arrowleft') || this.keys.has('a')) vx -= 1;
      if (this.keys.has('arrowright') || this.keys.has('d')) vx += 1;
      if (this.keys.has('arrowup') || this.keys.has('w')) vy -= 1;
      if (this.keys.has('arrowdown') || this.keys.has('s')) vy += 1;
      if (this.holding) {
        this.holdTimer -= dt;
        if (this.holdTimer <= 0) {
          this.holdTimer = 0.15;
          const w = this.screenToWorld(this.holding.sx, this.holding.sy);
          if (Math.hypot(w.x - p.x, w.y - p.y) > 0.6) this.walkTo(w.x, w.y);
        }
      }
      if (!vx && !vy && p.path.length) {
        const tgt = p.path[0];
        const dx = tgt.x - p.x;
        const dy = tgt.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.12) {
          p.path.shift();
          if (!p.path.length && p.pending) {
            const pend = p.pending;
            p.pending = null;
            if (this.scene) {
              const u = pend.startsWith('use:') ? this.scene.r.uses.find((x) => 'use:' + x.id === pend) : null;
              if (u) {
                p.facing = u.face;
                this.nearUse = u;
                this.cb.onUse?.(this.scene.b, u);
              }
            } else {
              const b = places.find((b) => b.id === pend);
              if (b) this.arriveDoor(b);
            }
          }
        } else {
          vx = dx / d;
          vy = dy / d;
        }
      }
    }
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      const speed = PLAYER_SPEED * (this.delivery ? 1.7 : 1) * (this.save.hunger < 8 || this.save.energy < 8 ? 0.7 : 1);
      const step = Math.min(speed * dt, p.path.length ? Math.hypot(p.path[0].x - p.x, p.path[0].y - p.y) : 99);
      const mx = (vx / len) * step;
      const my = (vy / len) * step;
      const ox = p.x;
      const oy = p.y;
      let carBlocked = false;
      const car = (x: number, y: number) => {
        // never walk into a vehicle (but always allow stepping out of one)
        const hit = hitsAnyVehicle(this.vehicles, x, y) && !hitsAnyVehicle(this.vehicles, p.x, p.y);
        if (hit) carBlocked = true;
        return hit;
      };
      if (!this.blocked(p.x + mx, p.y) && !car(p.x + mx, p.y)) p.x += mx;
      if (!this.blocked(p.x, p.y + my) && !car(p.x, p.y + my)) p.y += my;
      const MW = this.scene ? this.scene.r.w : W;
      const MH = this.scene ? this.scene.r.h : H;
      p.x = Math.max(0.4, Math.min(MW - 0.4, p.x));
      p.y = Math.max(0.4, Math.min(MH - 0.2, p.y));
      const moved = Math.hypot(p.x - ox, p.y - oy);
      if (p.path.length && moved < step * 0.2) {
        // waiting for a bus to pass isn't "stuck"; only give up if it's been a while
        p.stuck += carBlocked ? dt * 0.15 : dt;
        if (p.stuck > 0.6) {
          p.path = [];
          p.pending = null;
          p.stuck = 0;
        }
      } else p.stuck = 0;
      p.moving = moved > 0.0005;
      // footsteps land on frames 0 and 4 of the walk cycle
      const wf = walkFrame(this.t);
      if (p.moving && !this.delivery && wf !== this.lastWalkFrame && (wf === 0 || wf === 4)) sfx.step(!this.scene && tiles[Math.floor(p.y) * W + Math.floor(p.x)] === T.Grass ? 'grass' : 'pave');
      this.lastWalkFrame = wf;
      if (Math.abs(vx) > Math.abs(vy) * 1.1) p.facing = vx > 0 ? 'right' : 'left';
      else p.facing = vy > 0 ? 'down' : 'up';
      if (!this.scene) {
        this.save.pos.x = p.x;
        this.save.pos.y = p.y;
      } else if (atExit(this.scene.r, p.x, p.y)) this.leaveBuilding();
    } else p.moving = false;

    // ---- clock + needs (real UK time; your personal clock runs faster while you're out and about)
    this.tickAcc += dt;
    if (this.tickAcc >= 0.5) {
      this.tickAcc = 0;
      const tNow = realNow();
      const dtMs = Math.max(0, Math.min(5000, tNow - this.lastTickReal));
      this.lastTickReal = tNow;
      tick(this.save, { raining: this.raining, outdoors: !this.indoors && !this.scene, inPark: inPark(p.x, p.y), onShift: !!this.delivery, dtMs, active: !this.paused }, events);
      this.social.pump(Date.now());
      if (this.bots.length) this.brain.tick(this.npcCtx());
      setRainLevel(this.rainLevel * (this.indoors || this.scene ? 0.3 : 1));
      if (this.t >= this.schedAt) {
        this.schedAt = this.t + 3;
        this.scheduleLocals();
        checkWishes(this.save, events);
      }
      this.roomChatter();
      if (tNow > this.weatherAt) {
        if (this.weatherAt) this.rollWeather();
        this.weatherAt = tNow + 120000;
      }
      this.dirty = true;
    }

    // ---- delivery shift
    if (this.delivery && this.paused) this.delivery.deadline += dt; // the clock stops while a card is up
    if (this.delivery && !this.paused) {
      const d = this.delivery;
      const s = d.stops[d.index];
      if (Math.hypot(s.x - p.x, s.y - p.y) < 1.3) {
        const left = d.deadline - this.t;
        const pay = left > 0 ? 7 + Math.round(5 * (left / d.limit) * 100) / 100 : 2.5;
        if (left > 0) d.onTime++;
        d.earned = Math.round((d.earned + pay) * 100) / 100;
        events.push({ type: 'toast', text: left > 0 ? `Delivered to ${s.name}! +£${pay.toFixed(2)} (tip included)` : `Late to ${s.name}. "Chips were cold." +£2.50`, tone: left > 0 ? 'good' : 'bad' });
        d.index++;
        if (d.index >= d.stops.length) {
          this.delivery = null;
          this.cb.onDeliveryDone(d.earned, d.onTime, d.stops.length, d.stops.length, false);
        } else this.setDropTimer(p.x, p.y);
      }
      this.dirty = true;
    }

    // ---- nearby door (or, indoors, the thing you're standing at)
    let best: Building | null = null;
    let bd = 1.25;
    if (this.scene) {
      let nu: UseSpot | null = null;
      let nd = 0.85;
      for (const u of this.scene.r.uses) {
        const d = Math.hypot(u.at[0] - p.x, u.at[1] - p.y);
        if (d < nd) {
          nd = d;
          nu = u;
        }
      }
      if (nu !== this.nearUse) {
        this.nearUse = nu;
        this.dirty = true;
      }
    }
    for (const b of this.scene ? [] : places) {
      const f = doorFront(b);
      const d = Math.hypot(f.x - p.x, (f.y - p.y) * 1.3);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    if (best !== this.nearby) {
      this.nearby = best;
      this.dirty = true;
    }

    // ---- NPCs & remote players
    const street = { vehicles: this.vehicles };
    for (const b of this.bots) {
      if (b.inside) this.updateIndoorBot(b, dt);
      else {
        this.steerLocal(b);
        if (!b.inside) updateBot(b, dt, street);
      }
    }
    const now = performance.now();
    for (const [id, r] of this.remotes) {
      const k = Math.min(1, dt * 10);
      if (Math.hypot(r.p.x - r.rx, r.p.y - r.ry) > 5) {
        r.rx = r.p.x;
        r.ry = r.p.y;
      } else {
        r.rx += (r.p.x - r.rx) * k;
        r.ry += (r.p.y - r.ry) * k;
      }
      if (this.netMode !== 'online' && now - r.last > 8000) this.remotes.delete(id);
    }

    this.updateAmbient(dt);
    this.sendNet(false);

    // ---- camera
    const tx = p.x * TILE;
    const ty = p.y * TILE - 10;
    const k = 1 - Math.pow(0.0015, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const halfW = this.vw / 2 / this.zoom;
    const halfH = this.vh / 2 / this.zoom;
    const ww = (this.scene ? this.scene.r.w : W) * TILE;
    const wh = (this.scene ? this.scene.r.h + 0.6 : H) * TILE;
    this.cam.x = halfW * 2 >= ww ? ww / 2 : Math.max(halfW, Math.min(ww - halfW, this.cam.x));
    this.cam.y = halfH * 2 >= wh ? wh / 2 : Math.max(halfH, Math.min(wh - halfH, this.cam.y));

    if (events.length) this.cb.onEvents(events);
    this.snapTimer -= dt;
    if (this.dirty && this.snapTimer <= 0) {
      this.snapTimer = 0.2;
      this.flush();
    }
  }

  private rollWeather() {
    const was = this.raining;
    if (this.save.flags.heatwave === london().dateKey) this.raining = false;
    else if (this.raining) {
      if (Math.random() < 0.3) this.raining = false;
    } else if (Math.random() < 0.14) this.raining = true;
    if (was !== this.raining) {
      this.dirty = true;
      this.cb.onEvents([{ type: 'toast', text: this.raining ? (this.save.umbrellaUntil > this.save.life ? 'It\u2019s started raining. Good thing you\u2019ve got a brolly.' : 'It\u2019s started raining. Of course it has. (🧣 Warmth drains in the rain: get a brolly, a coat, or get inside.)') : 'Rain\u2019s stopped. Brief moment of national joy.', tone: 'info' }]);
    }
  }

  private playerState(): PlayerState {
    const s = this.save;
    return {
      id: this.netId,
      pid: s.id,
      name: s.name,
      avatar: s.avatar,
      x: +this.player.x.toFixed(2),
      y: +this.player.y.toFixed(2),
      facing: this.player.facing,
      moving: this.player.moving,
      bike: !!this.delivery,
      room: this.scene?.b.id,
      mood: Math.round(effectiveMood(s, this.raining)),
      status: s.job ? `${JOBS[s.job].title}${s.jobLevel > 1 ? ` (level ${s.jobLevel})` : ''}` : 'Looking for work',
    };
  }

  private sendNet(force: boolean) {
    if (!this.transport) return;
    const now = performance.now();
    const p = this.player;
    const l = this.lastSent;
    const changed = Math.hypot(p.x - l.x, p.y - l.y) > 0.05 || p.facing !== l.facing || p.moving !== l.moving || (this.scene?.b.id ?? '') !== l.room;
    const interval = this.netMode === 'online' ? 200 : 100; // ~5 msgs/s while moving keeps Supabase quotas sane
    if (force || (changed && now - l.at > interval) || now - l.at > 2500) {
      this.transport.sendState(this.playerState());
      this.lastSent = { x: p.x, y: p.y, facing: p.facing, moving: p.moving, at: now, room: this.scene?.b.id ?? '' };
    }
  }

  // ------------------------------------------------------------ ambient life
  private initVehicles() {
    const v = (x: number, dir: 1 | -1, road: 'high' | 'albion', kind: Car['kind'], color: string, speed: number): Car => ({
      x,
      dir,
      y: road === 'high' ? (dir > 0 ? 20.5 : 21.5) : dir > 0 ? 10.5 : 11.5, // they drive on the LEFT here
      kind,
      color,
      speed,
      cur: speed,
    });
    this.vehicles = [
      v(6, -1, 'high', 'bus', '#d42020', 4.2),
      v(28, -1, 'high', 'cab', '#1b1b1b', 5.2),
      v(48, -1, 'high', 'car', '#e0b021', 4.8),
      v(14, 1, 'high', 'van', '#f2f2f2', 4.1),
      v(38, 1, 'high', 'car', '#3a6fd8', 5),
      v(55, 1, 'high', 'cab', '#1b1b1b', 5.4),
      v(30, -1, 'albion', 'car', '#2f8f4e', 3.6),
      v(10, 1, 'albion', 'car', '#9b59b6', 3.9),
      v(45, 1, 'albion', 'van', '#c0c6cc', 3.4),
    ];
  }

  private initPigeons() {
    const spots = [[8, 19], [15, 22.6], [27.5, 18.7], [33, 23], [44, 22.8], [52, 19.2], [5, 22.7], [38.5, 19], [54, 27], [47, 28]];
    this.pigeons = spots.map(([x, y], i) => ({ x, y, fly: 0, vx: 0, vy: 0, flip: i % 2 === 0, phase: Math.random() * 6 }));
  }

  /** Everyone on foot, for the drivers. */
  private pedestrians(): Person[] {
    const out: Person[] = this.scene ? [] : [{ x: this.player.x, y: this.player.y }];
    for (const b of this.bots) if (!b.inside) out.push(b);
    for (const r of this.remotes.values()) if (!r.p.room) out.push({ x: r.rx, y: r.ry });
    return out;
  }

  /** Someone's on a zebra, or waiting at its kerb wanting to cross: traffic should stop. */
  private zebraDemand(): boolean[] {
    const p = this.player;
    return ZEBRAS.map((z, i) => {
      const rd = ROADS[z.road];
      const inX = (x: number) => x >= z.x0 - 0.15 && x < z.x1 + 0.15;
      const onIt = (x: number, y: number) => inX(x) && y >= rd.y0 - 0.1 && y < rd.y1 + 0.1;
      if (!this.scene && onIt(p.x, p.y)) return true;
      // you at the kerb, facing the road
      if (!this.scene && inX(p.x) && ((p.y >= rd.y0 - 0.9 && p.y < rd.y0 && p.facing === 'down') || (p.y >= rd.y1 && p.y < rd.y1 + 0.9 && p.facing === 'up'))) return true;
      for (const b of this.bots) {
        if (b.inside) continue;
        if (onIt(b.x, b.y)) return true;
        if (b.waitRoad === z.road && zebraAt(b.x, z.road) === i) return true;
      }
      for (const r of this.remotes.values()) if (!r.p.room && onIt(r.rx, r.ry)) return true;
      return false;
    });
  }

  private updateAmbient(dt: number) {
    // traffic: brake for anyone in the road, stop at zebras when someone's crossing or waiting
    stepVehicles(this.vehicles, this.pedestrians(), this.zebraDemand(), dt);
    // pigeons
    for (const g of this.pigeons) {
      if (g.fly > 0) {
        g.fly -= dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (g.fly <= 0) {
          if (isSolid(Math.floor(g.x), Math.floor(g.y)) || g.x < 1 || g.x > W - 1 || g.y < 3 || g.y > H - 1) g.fly = 0.6;
        }
      } else {
        const scare = (!this.scene && Math.hypot(g.x - this.player.x, g.y - this.player.y) < 1.4) || this.bots.some((b) => !b.inside && Math.hypot(g.x - b.x, g.y - b.y) < 0.9);
        if (scare) {
          const a = Math.atan2(g.y - this.player.y, g.x - this.player.x) + (Math.random() - 0.5);
          g.vx = Math.cos(a) * 4;
          g.vy = Math.sin(a) * 4;
          g.flip = g.vx < 0;
          g.fly = 1.2 + Math.random();
        } else if (Math.random() < dt * 0.4) {
          g.flip = !g.flip;
          g.x += (g.flip ? -1 : 1) * 0.1;
        }
      }
    }
    // train
    if (this.train.x > -9000) {
      this.train.x += 360 * dt;
      if (this.train.x > W * TILE + 50) {
        this.train.x = -9999;
        this.train.next = this.t + 30 + Math.random() * 40;
      }
    } else if (this.t > this.train.next) this.train.x = -560;
    // rain
    this.rainLevel += ((this.raining ? 1 : 0) - this.rainLevel) * Math.min(1, dt * 0.8);
    const want = Math.round(((this.vw * this.vh) / 5200) * this.rainLevel);
    while (this.drops.length < want) this.drops.push({ x: Math.random() * this.vw, y: Math.random() * this.vh, l: 10 + Math.random() * 12, s: 650 + Math.random() * 350 });
    if (this.drops.length > want) this.drops.length = want;
    for (const d of this.drops) {
      d.y += d.s * dt;
      d.x -= d.s * 0.18 * dt;
      if (d.y > this.vh) {
        d.y = -20;
        d.x = Math.random() * (this.vw + 100);
      }
    }
  }

  // ------------------------------------------------------------ rendering
  private render() {
    if (this.scene) return this.renderRoom(this.scene);
    const ctx = this.ctx;
    const S = this.dpr * this.zoom;
    const left = this.cam.x - this.vw / 2 / this.zoom;
    const top = this.cam.y - this.vh / 2 / this.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#3d6b33';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.staticCanvas) {
      const ss = this.staticScale;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.staticCanvas, left * ss, top * ss, (this.vw / this.zoom) * ss, (this.vh / this.zoom) * ss, 0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
    const viewR = left + this.vw / this.zoom;
    const viewB = top + this.vh / this.zoom;
    const vis = (x: number, y: number, m = 80) => x > left - m && x < viewR + m && y > top - m && y < viewB + m;

    if (this.train.x > -9000) drawTrain(ctx, this.train.x);

    // tap marker
    // spot markers (park bits, bus stop)
    for (const sp of spots) if (vis(sp.x * TILE, sp.y * TILE)) this.spotMarker(sp, this.nearby === sp);

    if (this.tap && this.t - this.tap.t < 0.6) {
      const k = (this.t - this.tap.t) / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.tap.x * TILE, this.tap.y * TILE, 6 + k * 10, 3 + k * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // nearby door highlight
    if (this.nearby) {
      const f = doorFront(this.nearby);
      ctx.fillStyle = `rgba(255,230,90,${0.25 + Math.sin(this.t * 5) * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(f.x * TILE, (f.y - 0.1) * TILE, 15, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // delivery target
    if (this.delivery) {
      const s = this.delivery.stops[this.delivery.index];
      const bounce = Math.sin(this.t * 6) * 4;
      ctx.fillStyle = 'rgba(25,169,116,0.35)';
      ctx.beginPath();
      ctx.ellipse(s.x * TILE, s.y * TILE, 18 + bounce, 9 + bounce / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#19a974';
      ctx.beginPath();
      ctx.moveTo(s.x * TILE - 8, s.y * TILE - 46 + bounce);
      ctx.lineTo(s.x * TILE + 8, s.y * TILE - 46 + bounce);
      ctx.lineTo(s.x * TILE, s.y * TILE - 34 + bounce);
      ctx.fill();
      ctx.fillRect(s.x * TILE - 4, s.y * TILE - 58 + bounce, 8, 12);
    }

    // guide arrow bobbing over the door you're meant to go to
    const gt = !this.delivery && this.guideTarget ? doorFront(this.guideTarget) : null;
    if (gt && this.nearby !== this.guideTarget) {
      const bounce = Math.abs(Math.sin(this.t * 3.2)) * -7;
      const gx = gt.x * TILE;
      const gy = gt.y * TILE - 30 + bounce;
      ctx.fillStyle = 'rgba(255,210,63,0.28)';
      ctx.beginPath();
      ctx.ellipse(gx, gt.y * TILE, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#3a2a00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx - 9, gy - 12);
      ctx.lineTo(gx - 4, gy - 12);
      ctx.lineTo(gx - 4, gy - 22);
      ctx.lineTo(gx + 4, gy - 22);
      ctx.lineTo(gx + 4, gy - 12);
      ctx.lineTo(gx + 9, gy - 12);
      ctx.lineTo(gx, gy);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }

    for (const bb of billboards) if (vis(bb.x * TILE, bb.y * TILE, 200)) drawBillboard(ctx, bb, this.t, this.hoverBillboard === bb.id);

    // pigeons (grounded)
    for (const g of this.pigeons) if (g.fly <= 0 && vis(g.x * TILE, g.y * TILE)) drawPigeon(ctx, g.x * TILE, g.y * TILE, this.t + g.phase, false, g.flip);

    // people, y-sorted
    type Ent = { y: number; draw: () => void; tag: () => void };
    const ents: Ent[] = [];
    const umbrella = this.raining && this.save.umbrellaUntil > this.save.life;
    const p = this.player;
    ents.push({
      y: p.y,
      draw: () => {
        ctx.save();
        ctx.translate(p.x * TILE, p.y * TILE);
        drawAvatar(ctx, this.save.avatar, { facing: p.facing, moving: p.moving, t: this.t, bike: !!this.delivery, umbrella });
        ctx.restore();
      },
      tag: () => this.nameTag(p.x, p.y, this.save.name, 'me', this.bubble),
    });
    for (const b of this.bots) {
      if (b.inside || !vis(b.x * TILE, b.y * TILE)) continue;
      ents.push({
        y: b.y,
        draw: () => {
          ctx.save();
          ctx.translate(b.x * TILE, b.y * TILE);
          drawAvatar(ctx, b.avatar, { facing: b.facing, moving: b.moving, t: this.t + b.speed * 3, phone: !b.moving && b.wait > 0 && b.phone });
          ctx.restore();
        },
        tag: () => (b.ambient ? undefined : this.nameTag(b.x, b.y, b.name, 'npc', b.bubble)),
      });
    }
    for (const r of this.remotes.values()) {
      if (r.p.room || !vis(r.rx * TILE, r.ry * TILE)) continue;
      ents.push({
        y: r.ry,
        draw: () => {
          ctx.save();
          ctx.translate(r.rx * TILE, r.ry * TILE);
          drawAvatar(ctx, r.p.avatar, { facing: r.p.facing, moving: r.p.moving, t: this.t, bike: r.p.bike });
          ctx.restore();
        },
        tag: () => this.nameTag(r.rx, r.ry, r.p.name, 'player', r.bubble),
      });
    }
    for (const v of this.vehicles) {
      if (!vis(v.x * TILE, v.y * TILE, 140)) continue;
      ents.push({ y: v.y + vehHalfW(v.kind), draw: () => drawVehicle(ctx, v), tag: () => {} });
    }
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    // flying pigeons above people
    for (const g of this.pigeons) if (g.fly > 0 && vis(g.x * TILE, g.y * TILE)) drawPigeon(ctx, g.x * TILE, g.y * TILE, this.t, true, g.flip);

    // night + lamps (follows the real sky over London, give or take the season)
    const c = london();
    const h = c.hh + c.mm / 60;
    const summer = c.month >= 4 && c.month <= 9;
    const [dawn, dusk] = summer ? [5, 20.5] : [6.5, 17];
    const dark = h < dawn - 1 || h >= dusk + 1.5 ? 1 : h < dawn + 1 ? 1 - (h - (dawn - 1)) / 2 : h >= dusk - 0.5 ? (h - (dusk - 0.5)) / 2 : 0;
    const gloom = Math.max(dark * 0.5, this.rainLevel * 0.16);
    if (gloom > 0.01) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = dark > 0.01 ? `rgba(12,18,52,${gloom})` : `rgba(40,55,80,${gloom})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      if (dark > 0.05) {
        ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = dark * 0.85;
        for (const l of lamps) if (vis(l.x * TILE, l.y * TILE, 120)) ctx.drawImage(this.glow, l.x * TILE - 70, l.y * TILE - 70 - 20, 140, 140);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // name tags & bubbles on top of the lighting
    ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
    for (const e of ents) e.tag();
    // "👥 3" over buildings with people inside
    for (const b of buildings) {
      const n = this.occupancy(b.id);
      if (!n) continue;
      const f = doorFront(b);
      if (vis(f.x * TILE, f.y * TILE)) this.badge(f.x + 0.85, f.y - 1.3, `👥 ${n}`);
    }

    // rain (screen space)
    if (this.drops.length) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.strokeStyle = 'rgba(190,210,235,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of this.drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * 0.18, d.y + d.l);
      }
      ctx.stroke();
    }

    // off-screen pointer to the delivery drop (or the guide's next stop)
    const pointAt = this.delivery ? this.delivery.stops[this.delivery.index] : gt;
    if (pointAt) {
      const s = pointAt;
      const sx = (s.x * TILE - left) * this.zoom;
      const sy = (s.y * TILE - top) * this.zoom;
      const m = 40;
      if (sx < 0 || sy < 0 || sx > this.vw || sy > this.vh) {
        const cx = this.vw / 2;
        const cy = this.vh / 2;
        const a = Math.atan2(sy - cy, sx - cx);
        const ex = Math.max(m, Math.min(this.vw - m, cx + Math.cos(a) * this.vw));
        const ey = Math.max(m + 90, Math.min(this.vh - m - 70, cy + Math.sin(a) * this.vh));
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.translate(ex, ey);
        ctx.rotate(a);
        ctx.fillStyle = this.delivery ? '#19a974' : '#ffd23f';
        ctx.strokeStyle = this.delivery ? '#fff' : '#3a2a00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -13);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-10, 13);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      }
    }
  }

  private badge(x: number, y: number, text: string) {
    const ctx = this.ctx;
    ctx.font = `700 8px ${FONT}`;
    ctx.textAlign = 'center';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = 'rgba(25,169,116,0.95)';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x * TILE - w / 2, y * TILE - 8, w, 13, 6.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x * TILE, y * TILE + 1.8);
  }

  /** Inside a building: the room, its furniture, and everyone in it. */
  private renderRoom(sc: Scene) {
    const ctx = this.ctx;
    const r = sc.r;
    const S = this.dpr * this.zoom;
    const left = this.cam.x - this.vw / 2 / this.zoom;
    const top = this.cam.y - this.vh / 2 / this.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#15171d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
    if (sc.canvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sc.canvas, 0, 0, r.w * TILE, r.h * TILE);
    }
    // a glimpse of the street through the door
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(r.exit * TILE, r.h * TILE, TILE, 0.6 * TILE);
    // tap ripple
    if (this.tap && this.t - this.tap.t < 0.6) {
      const k = (this.t - this.tap.t) / 0.6;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.tap.x * TILE, this.tap.y * TILE, 6 + k * 10, 3 + k * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // where you'd stand to use something
    if (this.nearUse) {
      const [ux, uy] = this.nearUse.at;
      ctx.fillStyle = `rgba(255,230,90,${0.28 + Math.sin(this.t * 5) * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(ux * TILE, uy * TILE, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    type Ent = { y: number; draw: () => void; tag?: () => void };
    const ents: Ent[] = [];
    const SEAT = ['chair', 'stool', 'bench', 'armchair', 'sofa'];
    for (const f of r.furn) {
      if (f.k === 'rug' || WALL_MOUNTED.includes(f.k)) continue;
      ents.push({ y: SEAT.includes(f.k) ? f.y + 0.5 : f.y + f.h - 0.05, draw: () => drawFurn(ctx, f, this.t) });
    }
    const person = (x: number, y: number, a: import('./types').Avatar, facing: Facing, moving: boolean, t: number, tag: () => void, phone = false) =>
      ents.push({
        y,
        draw: () => {
          ctx.save();
          ctx.translate(x * TILE, y * TILE);
          drawAvatar(ctx, a, { facing, moving, t, phone });
          ctx.restore();
        },
        tag,
      });
    for (const st of sc.staff) person(st.x, st.y, st.avatar, st.facing, false, this.t, () => this.nameTag(st.x, st.y, st.name, 'npc', st.bubble, st.role));
    for (const b of this.bots) if (b.inside === r.id) person(b.x, b.y, b.avatar, b.facing, b.moving, this.t + b.speed * 3, () => this.nameTag(b.x, b.y, b.name, 'npc', b.bubble), !b.moving && b.phone);
    for (const rm of this.remotes.values()) if (rm.p.room === r.id) person(rm.rx, rm.ry, rm.p.avatar, rm.p.facing, rm.p.moving, this.t, () => this.nameTag(rm.rx, rm.ry, rm.p.name, 'player', rm.bubble));
    const p = this.player;
    person(p.x, p.y, this.save.avatar, p.facing, p.moving, this.t, () => this.nameTag(p.x, p.y, this.save.name, 'me', this.bubble));
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();
    // a little warmth (or chill) to the light
    if (r.mood) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = r.mood === 'warm' ? 'rgba(255,170,70,0.07)' : r.mood === 'cool' ? 'rgba(120,170,255,0.05)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
    }
    // markers over things you can use
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const u of r.uses) {
      const f = r.furn.find((x) => x.use === u.id);
      const mx = f ? (f.x + f.w / 2) * TILE : u.at[0] * TILE;
      const tall = f && ['shelf', 'fridge', 'books', 'ticketmachine', 'quizmachine', 'washer', 'dryer', 'door', 'escalator', 'kitchen', 'shower', 'weights', 'fire', 'tv', 'treadmill', 'barberchair'].includes(f.k);
      const my = (f ? f.y * TILE - (tall ? 56 : 26) : (u.at[1] - 1.6) * TILE) + Math.sin(this.t * 2.4 + mx) * 2;
      const near = this.nearUse === u;
      ctx.globalAlpha = near ? 1 : 0.82;
      ctx.fillStyle = near ? '#ffd23f' : 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(mx - 9, my - 9, 18, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillText(u.emoji, mx, my + 1);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
    for (const e of ents) e.tag?.();
    // the way out
    ctx.font = `700 7px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('▼ EXIT', (r.exit + 0.5) * TILE, (r.h + 0.35) * TILE);
  }

  private spotMarker(sp: Building, near: boolean) {
    const ctx = this.ctx;
    const x = sp.x * TILE;
    const y = (sp.y - 1.25) * TILE + Math.sin(this.t * 2.4 + sp.x) * 2.5;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, sp.y * TILE + 2, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = near ? '#ffd23f' : 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 11, 22, 22, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 10);
    ctx.lineTo(x + 4, y + 10);
    ctx.lineTo(x, y + 15);
    ctx.fill();
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(sp.emoji ?? '⭐', x, y + 1);
    ctx.textBaseline = 'alphabetic';
  }

  private nameTag(x: number, y: number, name: string, kind: 'me' | 'npc' | 'player', bubble?: { text: string; until: number } | null, role?: string) {
    const ctx = this.ctx;
    const px = x * TILE;
    const py = y * TILE - 50;
    ctx.font = `600 8.5px ${FONT}`;
    ctx.textAlign = 'center';
    const label = kind === 'npc' ? `${name} · ${role ? (role.length <= 14 ? role : 'staff') : 'NPC'}` : name;
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = kind === 'me' ? 'rgba(255,210,63,0.95)' : kind === 'npc' ? 'rgba(30,30,40,0.55)' : 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.roundRect(px - w / 2, py - 9, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = kind === 'npc' ? '#f0f0f0' : '#1b1b1b';
    ctx.fillText(label, px, py);
    if (bubble && bubble.until > this.t) {
      const alpha = Math.min(1, (bubble.until - this.t) * 2);
      ctx.globalAlpha = alpha;
      ctx.font = `500 8px ${FONT}`;
      const lines = wrap(ctx, bubble.text, 120);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
      const bh = lines.length * 10 + 6;
      const by = py - 14 - bh;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px - bw / 2, by, bw, bh, 5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - 4, by + bh);
      ctx.lineTo(px + 4, by + bh);
      ctx.lineTo(px, by + bh + 5);
      ctx.fill();
      ctx.fillStyle = '#1b1b1b';
      lines.forEach((l, i) => ctx.fillText(l, px, by + 11 + i * 10));
      ctx.globalAlpha = 1;
    }
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}
