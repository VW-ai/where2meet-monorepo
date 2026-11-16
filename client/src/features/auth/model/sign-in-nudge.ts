import { create } from 'zustand';
import { trackEvent } from '@/lib/analytics/events';

// What asked for the "save this plan" prompt on a meeting page
export type NudgeTrigger = 'join' | 'location' | 'vote' | 'time';

export const NUDGE_ACTIVE_SECONDS = 30;
const SNOOZE_KEY = 'w2m-sign-in-nudge-snoozed-until';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

// pending: asked for, waiting for the page to be free. Shown once per visit.
type NudgePhase =
  | { status: 'idle' }
  | { status: 'pending'; trigger: NudgeTrigger }
  | { status: 'open'; trigger: NudgeTrigger }
  | { status: 'done' };

interface NudgeState {
  phase: NudgePhase;
  request: (trigger: NudgeTrigger) => void;
  show: () => void;
  dismiss: () => void;
  signedIn: () => void;
}

function readSnoozedUntil(): number {
  try {
    return Number(window.localStorage.getItem(SNOOZE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function isNudgeSnoozed(now = Date.now()): boolean {
  return readSnoozedUntil() > now;
}

function snooze(now = Date.now()) {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(now + SNOOZE_MS));
  } catch {
    // Private mode: it just asks again next visit
  }
}

export const useSignInNudge = create<NudgeState>((set, get) => ({
  phase: { status: 'idle' },
  // The first request of a visit wins; later ones are ignored
  request: (trigger) => {
    if (get().phase.status !== 'idle' || isNudgeSnoozed()) return;
    set({ phase: { status: 'pending', trigger } });
  },
  show: () => {
    const { phase } = get();
    if (phase.status !== 'pending') return;
    set({ phase: { status: 'open', trigger: phase.trigger } });
    trackEvent('nudge_shown', { trigger: phase.trigger });
  },
  dismiss: () => {
    const { phase } = get();
    if (phase.status !== 'open') return;
    snooze();
    set({ phase: { status: 'done' } });
    trackEvent('nudge_dismissed', { trigger: phase.trigger });
  },
  signedIn: () => {
    const { phase } = get();
    if (phase.status !== 'open') return;
    set({ phase: { status: 'done' } });
    trackEvent('nudge_signed_in', { trigger: phase.trigger });
  },
}));

// Call right after a key action on a meeting page
export const requestSignInNudge = (trigger: NudgeTrigger) =>
  useSignInNudge.getState().request(trigger);
