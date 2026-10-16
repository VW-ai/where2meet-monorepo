import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useParticipantStore } from '@/features/meeting/model/participant-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import {
  parseSSEEvent,
  type SSEEventData,
  type SSEParticipant,
  type EventUpdatedPayload,
  type EventPublishedPayload,
  type ParticipantAddedPayload,
  type ParticipantUpdatedPayload,
  type ParticipantRemovedPayload,
  type VoteStatisticsPayload,
} from '@/shared/types/sse';
import type { SSEMessage } from '@/shared/lib/sse-parser';
import type { Participant } from '@/entities';

/**
 * Transform participant data from backend format to frontend format
 * Backend sends lat/lng at top level, frontend expects nested location object
 */
function transformParticipant({ lat, lng, ...rest }: SSEParticipant): Participant {
  return {
    ...rest,
    location: lat != null && lng != null ? { lat, lng } : null,
  } as Participant;
}

export function handleSSEMessage(message: SSEMessage, eventId: string): void {
  const parsed = parseSSEEvent(message, eventId);
  if (parsed.kind === 'invalid') console.error(`[SSE] Dropped ${message.event}: ${parsed.reason}`);
  if (parsed.kind !== 'event') return;
  try {
    handleSSEEvent(parsed.event);
  } catch (error) {
    console.error(`[SSE] Failed to apply ${message.event}:`, error);
  }
}

/**
 * Main SSE event router - dispatches events to appropriate handlers
 */
export function handleSSEEvent(event: SSEEventData): void {
  // Debug logging disabled in production
  // console.log('SSE Event received:', event.type, event.data);

  switch (event.type) {
    case 'event:updated':
      handleEventUpdated(event.data);
      break;
    case 'event:published':
      handleEventPublished(event.data);
      break;
    case 'participant:added':
      handleParticipantAdded(event.data);
      break;
    case 'participant:updated':
      handleParticipantUpdated(event.data);
      break;
    case 'participant:removed':
      handleParticipantRemoved(event.data);
      break;
    case 'vote:statistics':
      handleVoteStatistics(event.data);
      break;
    default:
      event satisfies never;
  }
}

/**
 * Handle event field updates (title, meetingTime, etc.)
 */
function handleEventUpdated(data: EventUpdatedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();

  if (!currentEvent || currentEvent.id !== data.event.id) {
    return;
  }

  const { title, meetingTime, publishedAt, publishedVenueId } = data.event;
  setCurrentEvent({ ...currentEvent, title, meetingTime, publishedAt, publishedVenueId });
}

/**
 * Handle event publish notification
 */
function handleEventPublished(data: EventPublishedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  const { setActiveView } = useUIStore.getState();

  // Only update if we're viewing the same event
  if (!currentEvent || currentEvent.id !== data.event.id) {
    return;
  }

  setCurrentEvent({
    ...currentEvent,
    publishedVenueId: data.event.publishedVenueId,
    publishedAt: data.event.publishedAt,
    updatedAt: new Date().toISOString(),
  });

  // Switch to venue view to show published venue in liked venues section
  setActiveView('venue');
}

/**
 * Handle new participant added to event
 */
function handleParticipantAdded(data: ParticipantAddedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  const { addParticipant, getParticipantById } = useParticipantStore.getState();

  // Only update if we're viewing the same event
  if (!currentEvent) {
    console.warn('[SSE Handler] No current event, skipping');
    return;
  }

  if (currentEvent.id !== data.eventId) {
    console.warn('[SSE Handler] Event ID mismatch, skipping:', {
      currentEventId: currentEvent.id,
      dataEventId: data.eventId,
    });
    return;
  }

  // Check if participant already exists (avoid duplicates)
  const exists = getParticipantById(data.participant.id);
  if (exists) {
    console.warn('[SSE Handler] Participant already exists, skipping add:', data.participant.id);
    return;
  }

  const transformedParticipant = transformParticipant(data.participant);

  // Add to participant store
  addParticipant(transformedParticipant);

  // Also update currentEvent.participants to keep them in sync
  if (currentEvent.participants) {
    setCurrentEvent({
      ...currentEvent,
      participants: [...currentEvent.participants, transformedParticipant],
    });
  } else {
    setCurrentEvent({
      ...currentEvent,
      participants: [transformedParticipant],
    });
  }
}

/**
 * Handle participant information update
 */
function handleParticipantUpdated(data: ParticipantUpdatedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  const { updateParticipant } = useParticipantStore.getState();

  const participantId = data.participant.id;

  // Only update if we're viewing the same event
  if (!currentEvent) {
    console.warn('[SSE Handler] No current event, skipping');
    return;
  }

  if (currentEvent.id !== data.eventId) {
    console.warn('[SSE Handler] Event ID mismatch, skipping');
    return;
  }

  const transformedParticipant = transformParticipant(data.participant);

  // Update in participant store
  updateParticipant(participantId, transformedParticipant);

  // Also update currentEvent.participants to keep them in sync
  if (currentEvent.participants) {
    setCurrentEvent({
      ...currentEvent,
      participants: currentEvent.participants.map((p) =>
        p.id === participantId ? { ...p, ...transformedParticipant } : p
      ),
    });
  }
}

/**
 * Handle participant removed from event
 */
function handleParticipantRemoved(data: ParticipantRemovedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();
  const { removeParticipant } = useParticipantStore.getState();

  const { participantId } = data;

  // Only update if we're viewing the same event
  if (!currentEvent) {
    console.warn('[SSE Handler] No current event, skipping');
    return;
  }

  if (currentEvent.id !== data.eventId) {
    console.warn('[SSE Handler] Event ID mismatch, skipping');
    return;
  }

  // Remove from participant store
  removeParticipant(participantId);

  // Also update currentEvent.participants to keep them in sync
  if (currentEvent.participants) {
    setCurrentEvent({
      ...currentEvent,
      participants: currentEvent.participants.filter((p) => p.id !== participantId),
    });
  }
}

/**
 * Handle vote statistics update
 * Dispatches to voting-store (which internally extracts vote stats only)
 */
function handleVoteStatistics(data: VoteStatisticsPayload): void {
  const { currentEvent, searchedVenues, venueById, hydrateVenue } = useMeetingStore.getState();
  const { setVoteStatistics } = useVotingStore.getState();

  // Only update if we're viewing the same event
  if (!currentEvent || currentEvent.id !== data.eventId) {
    console.warn('[SSE Handler] vote:statistics skipped - event mismatch');
    return;
  }

  // Transform backend format to VoteStatisticsResponse format
  // Frontend expects: VenueWithVotes[] (full venue data + votes)
  const transformedVenues = data.venues.map((backendVenue) => {
    // CRITICAL: Prioritize venueById (full details), fallback to searchedVenues
    const fullVenue =
      venueById[backendVenue.venueId] || searchedVenues.find((v) => v.id === backendVenue.venueId);

    const voters = backendVenue.voterIds;

    if (!fullVenue) {
      console.warn('[SSE Handler] Missing venue details for:', backendVenue.venueId);
      console.log('[SSE Handler] Triggering venue hydration...');
      hydrateVenue(backendVenue.venueId);

      // Return minimal venue structure temporarily (will be replaced after hydration completes)
      return {
        id: backendVenue.venueId,
        name: 'Unknown Venue',
        address: null,
        location: { lat: 0, lng: 0 },
        category: null,
        rating: null,
        priceLevel: null,
        photoUrl: null,
        voteCount: backendVenue.voteCount,
        voters,
      };
    }

    return {
      id: backendVenue.venueId,
      name: fullVenue.name,
      address: fullVenue.address || null,
      location: fullVenue.location,
      category: fullVenue.types?.[0] || null, // Use first type as category
      rating: fullVenue.rating,
      priceLevel: fullVenue.priceLevel,
      photoUrl: fullVenue.photoUrl,
      voteCount: backendVenue.voteCount,
      voters, // Standardized: "voters" field contains voterIds (participant UUIDs)
    };
  });

  const statistics = {
    venues: transformedVenues,
    totalVotes: data.totalVotes,
  };

  // Dispatch to voting-store (it will internally extract vote stats only)
  setVoteStatistics(statistics);
}
