import type { Participant } from '@/entities';

/** Same value while everyone stays put, however many times the event object is refreshed. */
export function participantPositionsKey(participants: readonly Participant[]): string {
  return participants
    .map(({ id, location }) => `${id}:${location?.lat ?? ''},${location?.lng ?? ''}`)
    .join('|');
}
