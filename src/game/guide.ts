// First-session guide: walks a brand-new player through the first three goals, then gets out of the way.
import { JOBS } from './economy';
import type { GoalId, SaveState } from './types';

export interface GuideStep {
  goal: GoalId;
  title: string;
  text: (s: SaveState) => string;
  /** building to point the arrow at */
  place: (s: SaveState) => string;
}
export const GUIDE_STEPS: GuideStep[] = [
  {
    goal: 'sausage',
    title: 'Breakfast of champions',
    text: () => 'Tap Crumbs & Co. (the blue bakery) to walk in, then tap the counter for a sausage roll.',
    place: () => 'crumbs',
  },
  {
    goal: 'job',
    title: 'Get a job',
    text: () => 'Head into Jobcentre Minus and tap the job board 📋. Shut? The kiosk outside still works.',
    place: () => 'jobcentre',
  },
  {
    goal: 'shift',
    title: 'Clock in',
    text: (s) => (s.job ? `Go to ${JOBS[s.job].employer} and start your first shift (staff room / desk inside). Shifts run at set hours; the place will tell you.` : 'You’ll need a job first.'),
    place: (s) => (s.job ? JOBS[s.job].building : 'jobcentre'),
  },
];

/** Index of the current step, or -1 if the guide isn't running (skipped, finished, or an older save). */
export function guideStep(s: SaveState): number {
  if (s.flags.guide !== 'on') return -1;
  return GUIDE_STEPS.findIndex((g) => !s.goals[g.goal]);
}
/** True once, when the last step has just been completed. Marks the guide done. */
export function guideFinished(s: SaveState): boolean {
  if (s.flags.guide !== 'on' || guideStep(s) !== -1) return false;
  s.flags.guide = 'done';
  return true;
}
export function skipGuide(s: SaveState) {
  if (s.flags.guide === 'on') s.flags.guide = 'skipped';
}
