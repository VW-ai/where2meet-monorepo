import type { Venue } from '@/entities';
import { eventClient } from '@/features/meeting/api';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { APIError } from '@/lib/api/client';
import { defineMessages, type Locale } from '@/shared/lib/locale';

const errorMessages = defineMessages({
  en: {
    alreadyPublished: 'This event has already been published.',
    unverifiedVenue: 'The selected venue could not be verified. Please try another venue.',
    unexpected: 'An unexpected error occurred. Please try again.',
  },
  zh: {
    alreadyPublished: '这个见面已经确定地点了。',
    unverifiedVenue: '无法核实所选地点，请换一个地点试试。',
    unexpected: '出了点问题，请重试。',
  },
});

export function publishErrorMessage(error: unknown, locale: Locale): string {
  const t = errorMessages[locale];
  if (!(error instanceof APIError)) return t.unexpected;
  if (error.code === 'EVENT_ALREADY_PUBLISHED') return t.alreadyPublished;
  // The backend rejects a venue it can't verify with Google Places as invalid input
  if (error.code === 'VALIDATION_ERROR') return t.unverifiedVenue;
  return error.message;
}

/**
 * Publishing always counts the organizer's own like first. A failed vote never stops the
 * publish: a 409 means the organizer had already voted, and anything else is only logged.
 */
export async function publishVenue(eventId: string, venue: Venue, organizerToken: string) {
  const { hasVotedFor, voteForVenue } = useVotingStore.getState();

  if (!hasVotedFor(venue.id)) {
    try {
      await voteForVenue(eventId, venue.id, {
        name: venue.name,
        address: venue.address,
        lat: venue.location.lat,
        lng: venue.location.lng,
        category: venue.types?.[0],
        rating: venue.rating ?? undefined,
        priceLevel: venue.priceLevel ?? undefined,
        photoUrl: venue.photoUrl ?? undefined,
      });
    } catch (voteError) {
      if (!(voteError instanceof APIError && voteError.status === 409)) {
        console.error('[publishVenue] Failed to vote before publishing:', voteError);
      }
    }
  }

  const updatedEvent = await eventClient.publish(eventId, venue.id, organizerToken);
  useMeetingStore.getState().setCurrentEvent(updatedEvent);
  // Show the published venue in the liked venues section
  useUIStore.getState().setActiveView('venue');
}

export async function unpublishVenue(eventId: string, organizerToken: string) {
  const updatedEvent = await eventClient.unpublish(eventId, organizerToken);
  useMeetingStore.getState().setCurrentEvent(updatedEvent);
}
