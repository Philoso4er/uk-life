import { useState } from 'react';
import type { Engine } from '../game/engine';
import { GENDERS, GENDER_LABEL, PRONOUNS, PRONOUN_LABEL, defaultPronouns, pronounsOf } from '../game/pronouns';
import type { Avatar, Gender, Pronouns } from '../game/types';

/** Gender + pronoun chips. Used by the character creator and by 📱 Me / Settings. */
export function IdentityRows({ gender, pronouns, onGender, onPronouns }: { gender: Gender; pronouns: Pronouns; onGender: (g: Gender) => void; onPronouns: (p: Pronouns) => void }) {
  return (
    <>
      <div className="opt-row">
        <span className="opt-label" id="gender-label">
          Gender
        </span>
        <div className="opt-items gender-items" role="radiogroup" aria-labelledby="gender-label">
          {GENDERS.map((g) => (
            <button key={g} role="radio" className={'chip chip-big' + (gender === g ? ' on' : '')} aria-checked={gender === g} onClick={() => onGender(g)}>
              {GENDER_LABEL[g]}
            </button>
          ))}
        </div>
      </div>
      <div className="opt-row">
        <span className="opt-label" id="pronoun-label">
          Pronouns
        </span>
        <div className="opt-items" role="radiogroup" aria-labelledby="pronoun-label">
          {PRONOUNS.map((p) => (
            <button key={p} role="radio" className={'chip' + (pronouns === p ? ' on' : '')} aria-checked={pronouns === p} onClick={() => onPronouns(p)}>
              {PRONOUN_LABEL[p]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** In-game version: edits the save directly (free, any time). Changing gender resets pronouns to its default. */
export function IdentityEditor({ engine }: { engine: Engine }) {
  const [, bump] = useState(0);
  const a = engine.save.avatar;
  const apply = (next: Avatar) => {
    engine.save.avatar = next;
    engine.social.setMe(engine.save.name, next);
    engine.touch();
    bump((n) => n + 1);
  };
  return (
    <div className="identity-box">
      <IdentityRows
        gender={a.gender ?? 'other'}
        pronouns={pronounsOf(a)}
        onGender={(g) => apply({ ...a, gender: g, pronouns: defaultPronouns(g) })}
        onPronouns={(p) => apply({ ...a, pronouns: p })}
      />
      <p className="muted small">Locals use your pronouns when they gossip about you. Your hair, clothes and face are yours to change at Fade to Grey Barbers.</p>
    </div>
  );
}
