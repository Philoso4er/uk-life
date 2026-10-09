// Real-world UK time. The game clock is the actual time in Europe/London; a
// debug offset lets tests and screenshots pretend it's a different moment.

let offsetMs = 0;
export const setClockOffset = (ms: number) => {
  offsetMs = ms;
};
export const getClockOffset = () => offsetMs;
export const now = () => Date.now() + offsetMs;

export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DOW_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface LondonTime {
  dayIdx: number; // 0 = Monday
  day: string;
  hh: number;
  mm: number;
  month: number; // 1-12
  dateKey: string; // YYYY-MM-DD in London
  label: string; // "Mon 09:05"
}

let fmt: Intl.DateTimeFormat | null = null;
let cacheMin = NaN;
let cacheVal: LondonTime | null = null;

export function london(ms: number = now()): LondonTime {
  const minute = Math.floor(ms / 60000);
  if (minute === cacheMin && cacheVal) return cacheVal;
  fmt ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  const dayIdx = Math.max(0, DOW.indexOf(p.weekday));
  const hh = Number(p.hour) % 24;
  const mm = Number(p.minute);
  const v: LondonTime = {
    dayIdx,
    day: DOW[dayIdx],
    hh,
    mm,
    month: Number(p.month),
    dateKey: `${p.year}-${p.month}-${p.day}`,
    label: `${DOW[dayIdx]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
  };
  cacheMin = minute;
  cacheVal = v;
  return v;
}

/** Shift a YYYY-MM-DD key by n days (calendar arithmetic, no time zones involved). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Whole days between two date keys (b - a). */
export function daysBetween(a: string, b: string): number {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

export const RENT_HOUR = 9; // Monday 09:00, London

/** Date key of the most recent Monday whose 09:00 (London) has already passed. */
export function rentKey(ms: number = now()): string {
  const t = london(ms);
  const intoWeek = t.dayIdx * 1440 + t.hh * 60 + t.mm;
  const back = intoWeek >= RENT_HOUR * 60 ? t.dayIdx : t.dayIdx + 7;
  return addDays(t.dateKey, -back);
}

/** Real milliseconds until the next Monday 09:00 London (approximate across DST changes). */
export function msUntilRent(ms: number = now()): number {
  const t = london(ms);
  const intoWeek = t.dayIdx * 1440 + t.hh * 60 + t.mm;
  let delta = RENT_HOUR * 60 - intoWeek;
  if (delta <= 0) delta += 7 * 1440;
  return delta * 60000 - (ms % 60000);
}

export function fmtDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${mm}m`;
  return `${mm}m`;
}

export const isNight = (t: LondonTime) => t.hh < 6 || t.hh >= 20;
export const isWinter = (t: LondonTime) => t.month >= 10 || t.month <= 3;
