// Shared world events: things that should happen to EVERYONE in Peckwell on the same day
// (a Tube strike, a heatwave). Today these come from a deterministic, date-seeded local feed, so two
// players on different phones still get the same strike day without any server.
//
// To make them truly live later (e.g. Supabase): implement WorldFeed against a `world_days` table
// (date_key primary key, strike bool, heatwave bool, note text), cache the row for the day, fall back
// to LocalWorldFeed when offline, and call setWorldFeed() at start-up. Nothing else needs to change.
import { hashString } from './avatar';

export interface WorldDay {
  strike: boolean;
  heatwave: boolean;
}
export interface WorldFeed {
  readonly name: string;
  day(dateKey: string): WorldDay;
}

const roll = (key: string, salt: string) => hashString(`${salt}:${key}`) % 1000;

/** Roughly one strike day a fortnight; heatwaves only May–September. */
export class LocalWorldFeed implements WorldFeed {
  readonly name = 'local';
  day(dateKey: string): WorldDay {
    const month = Number(dateKey.slice(5, 7));
    return {
      strike: roll(dateKey, 'strike') < 70,
      heatwave: month >= 5 && month <= 9 && roll(dateKey, 'heat') < 110,
    };
  }
}

let feed: WorldFeed = new LocalWorldFeed();
export const worldFeed = () => feed;
export function setWorldFeed(f: WorldFeed) {
  feed = f;
}
