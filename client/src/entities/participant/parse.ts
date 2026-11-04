import type { TravelMode } from '@/shared/types/map';

/**
 * The one place a participant from the API or the stream gets its transport fields.
 * Client and server deploy separately, so either field can still be absent.
 */
export function parseParticipant<T extends object>(
  raw: T & { travelMode?: TravelMode; claimable?: boolean }
): T & { travelMode: TravelMode; claimable: boolean } {
  return { ...raw, travelMode: raw.travelMode ?? 'driving', claimable: raw.claimable ?? false };
}

export function parseEventParticipants<T extends { participants?: object[] }>(event: T): T {
  return event.participants
    ? { ...event, participants: event.participants.map((p) => parseParticipant(p)) }
    : event;
}
