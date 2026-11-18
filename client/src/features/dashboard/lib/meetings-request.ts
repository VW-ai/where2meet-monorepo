import type { UserEventResponse } from '@/features/auth/types';
import { userClient } from '@/features/user/api';

// A head start older than this is too stale to show
const HEAD_START_MS = 30_000;

let headStart: { at: number; meetings: Promise<UserEventResponse[]> } | null = null;

function fetchMeetings(): Promise<UserEventResponse[]> {
  return userClient
    .getEvents()
    .then(({ events }) => events.filter((userEvent) => userEvent.event != null));
}

/** Starts loading the dashboard's meetings before the person gets there, e.g. on opening the account menu */
export function startLoadingMeetings() {
  if (headStart && Date.now() - headStart.at < HEAD_START_MS) return;
  const meetings = fetchMeetings();
  // A failed head start is dropped; the dashboard asks again
  meetings.catch(() => {
    if (headStart?.meetings === meetings) headStart = null;
  });
  headStart = { at: Date.now(), meetings };
}

/** The meetings for the dashboard: the head start if there's a fresh one, else a new request. Each head start is used once. */
export function loadMeetings(): Promise<UserEventResponse[]> {
  const fresh = headStart && Date.now() - headStart.at < HEAD_START_MS ? headStart.meetings : null;
  headStart = null;
  return fresh ?? fetchMeetings();
}
