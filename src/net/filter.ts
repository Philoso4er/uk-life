// A deliberately simple chat filter. Mild British banter (bloody, bum, git, numpty,
// pillock, muppet, arse) is allowed. Strong swearing and slurs are masked.

export const MAX_CHAT = 120;
export const MAX_POST = 140;
export const MAX_DM = 200;
export const MAX_NAME = 16;

const CONTAINS = [
  'fuck', 'shit', 'cunt', 'wank', 'bitch', 'bastard', 'twat', 'whore', 'slut', 'bellend',
  'nigger', 'nigga', 'faggot', 'retard', 'spastic', 'tranny', 'pussy', 'dickhead', 'motherf',
];
const EXACT = new Set([
  'fag', 'fags', 'nob', 'knob', 'knobhead', 'cock', 'cocks', 'dick', 'dicks', 'prick', 'pricks', 'tit', 'tits',
  'paki', 'pakis', 'spaz', 'kike', 'chink', 'coon', 'wog', 'wogs', 'rape', 'raped', 'rapist', 'cum', 'slag', 'slags', 'nonce', 'pikey', 'gyppo',
]);
const ALLOW = new Set(['scunthorpe', 'shitake', 'shiitake', 'swank', 'swanky', 'cockney', 'cocktail', 'peacock', 'hancock', 'dickens', 'pussycat', 'retardant', 'cockpit', 'cockerel', 'grape', 'drape', 'scrape', 'therapist']);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b' };

export function normalise(token: string) {
  return token
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '');
}
const squash = (s: string) => s.replace(/(.)\1+/g, '$1');

export function isBad(token: string): boolean {
  const n = normalise(token);
  if (!n || ALLOW.has(n)) return false;
  if (EXACT.has(n) || EXACT.has(squash(n))) return true;
  const sq = squash(n);
  for (const root of CONTAINS) {
    if (n.includes(root)) return true;
    if (squash(root) === root && sq.includes(root)) return true;
  }
  return false;
}

const WORST = ['nigger', 'nigga', 'faggot', 'cunt'];

/** Clean a chat message: trims, strips control chars, enforces length, masks bad words. */
export function cleanMessage(raw: string, max = MAX_CHAT): string {
  let s = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) s = s.slice(0, max).trim();
  if (!s) return '';
  // spaced-out tricks like "f u c k" or "c.u.n.t"
  const squashedAll = normalise(s.replace(/\s+/g, ''));
  const allowedHit = [...ALLOW].some((a) => squashedAll.includes(a));
  if (!allowedHit && WORST.some((w) => squashedAll.includes(w))) return '[removed by the Peckwell Residents\u2019 Association]';
  return s
    .split(/(\s+)/)
    .map((tok) => {
      if (/^\s+$/.test(tok)) return tok;
      // keep leading/trailing punctuation
      const m = tok.match(/^([^\w@$!]*)(.*?)([^\w@$!]*)$/);
      const core = m ? m[2] : tok;
      if (core && isBad(core)) return (m?.[1] ?? '') + '*'.repeat(Math.max(3, Math.min(core.length, 8))) + (m?.[3] ?? '');
      return tok;
    })
    .join('');
}

export function cleanName(raw: string): string {
  const s = cleanMessage(raw, MAX_NAME).replace(/[^\p{L}\p{N} '\-_.]/gu, '').trim();
  if (!s || s.includes('*') || s.startsWith('[')) return 'Anon Londoner';
  return s;
}
