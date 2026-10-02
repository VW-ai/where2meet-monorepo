import { create } from 'zustand';
import type { Rect } from '../lib/timeline';

export type PortalStatus = 'idle' | 'running' | 'failed';

interface PortalState {
  status: PortalStatus;
  /** performance.now() when the user pressed Create Meeting. */
  startedAt: number;
  /** Where the header logo was, so the cat can lift off it. */
  from: Rect | null;
  reduced: boolean;
  eventId: string | null;
  createdAt: number | null;
  /** The organizer saved a starting point, so a pin will be on the map. */
  hasPin: boolean;
  mapReadyAt: number | null;
  failedAt: number | null;

  start: (from: Rect | null) => void;
  created: (eventId: string, hasPin: boolean) => void;
  /** Called by the meeting map once it has settled on the meeting. */
  mapReady: (eventId: string) => void;
  fail: () => void;
  finish: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const initial = {
  status: 'idle' as PortalStatus,
  startedAt: 0,
  from: null,
  reduced: false,
  eventId: null,
  createdAt: null,
  hasPin: false,
  mapReadyAt: null,
  failedAt: null,
};

/** Drives the create-meeting → map transition across the route change. */
export const usePortalStore = create<PortalState>((set, get) => ({
  ...initial,

  start: (from) =>
    set({
      ...initial,
      status: 'running',
      startedAt: performance.now(),
      from,
      reduced: prefersReducedMotion(),
    }),

  created: (eventId, hasPin) => {
    if (get().status !== 'running') return;
    set({ eventId, hasPin, createdAt: performance.now() });
  },

  mapReady: (eventId) => {
    const state = get();
    if (state.status !== 'running' || state.eventId !== eventId || state.mapReadyAt !== null)
      return;
    set({ mapReadyAt: performance.now() });
  },

  fail: () => {
    if (get().status !== 'running') return;
    set({ status: 'failed', failedAt: performance.now() });
  },

  finish: () => set({ ...initial }),
}));
