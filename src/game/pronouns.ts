// Pronouns for talking about someone in the third person (Natter gossip, NPC chat, event text).
// Text uses tokens so every line works for he/him, she/her and they/them:
//   {they} {them} {their} {theirs} {themself}  (capitalise the first letter for the start of a sentence: {They} {Their} …)
//   {theyre} → he's / she's / they're   ({Theyre} capitalised)
//   {is} {was} {has} {does} {doesnt} {isnt}  → verb agreement (singular they takes the plural forms)
//   {s} → a verb ending: "{they} grow{s}" → "he grows" / "they grow"
//   {me} → the person's name
import type { Avatar, Gender, Pronouns } from './types';

export const PRONOUNS: Pronouns[] = ['he', 'she', 'they'];
export const GENDERS: Gender[] = ['male', 'female', 'other'];
export const GENDER_LABEL: Record<Gender, string> = { male: 'Male', female: 'Female', other: 'Other' };
export const PRONOUN_LABEL: Record<Pronouns, string> = { he: 'he/him', she: 'she/her', they: 'they/them' };

interface Set {
  they: string;
  them: string;
  their: string;
  theirs: string;
  themself: string;
  theyre: string;
  plural: boolean;
}
const SETS: Record<Pronouns, Set> = {
  he: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself', theyre: 'he’s', plural: false },
  she: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself', theyre: 'she’s', plural: false },
  they: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themself', theyre: 'they’re', plural: true },
};

/** Gender sets the default; it's always editable. 'Other' defaults to they/them. */
export const defaultPronouns = (g?: Gender): Pronouns => (g === 'male' ? 'he' : g === 'female' ? 'she' : 'they');
export const isPronouns = (v: unknown): v is Pronouns => v === 'he' || v === 'she' || v === 'they';
export const isGender = (v: unknown): v is Gender => v === 'male' || v === 'female' || v === 'other';
export const pronounsOf = (a?: Partial<Avatar> | null): Pronouns => (a && isPronouns(a.pronouns) ? a.pronouns : defaultPronouns(a?.gender));

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** Fill pronoun/verb tokens (and {me}) in a line of text. */
export function pronounText(text: string, p: Pronouns, name?: string): string {
  const s = SETS[p] ?? SETS.they;
  const verbs: Record<string, string> = {
    is: s.plural ? 'are' : 'is',
    was: s.plural ? 'were' : 'was',
    has: s.plural ? 'have' : 'has',
    does: s.plural ? 'do' : 'does',
    doesnt: s.plural ? 'don’t' : 'doesn’t',
    isnt: s.plural ? 'aren’t' : 'isn’t',
    s: s.plural ? '' : 's',
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (k === 'me') return name ?? m;
    const lower = k.charAt(0).toLowerCase() + k.slice(1);
    const word = lower in verbs ? verbs[lower] : (s as unknown as Record<string, string | boolean>)[lower];
    if (typeof word !== 'string') return m;
    return k !== lower ? cap(word) : word;
  });
}

/** Convenience: fill tokens for an avatar (the player, or an NPC) by name. */
export const aboutPerson = (text: string, a: Partial<Avatar> | null | undefined, name: string) => pronounText(text, pronounsOf(a), name);
