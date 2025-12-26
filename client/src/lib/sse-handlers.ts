import { useMeetingStore } from '@/store/useMeetingStore';
import type {
  SSEEventData,
  EventUpdatedPayload,
  EventPublishedPayload,
  ParticipantAddedPayload,
  ParticipantUpdatedPayload,
  ParticipantRemovedPayload,
  VoteStatisticsPayload,
} from '@/types/sse';
import type { Participant } from '@/types/participant';

/**
 * Transform participant data from backend format to frontend format
 * Backend sends lat/lng at top level, frontend expects nested location object
 */
function transformParticipant(
  backendParticipant: Participant & { lat?: number; lng?: number }
): Participant {
  const { lat, lng, ...rest } = backendParticipant;

  return {
    ...rest,
    location: lat != null && lng != null ? { lat, lng } : null,
  } as Participant;
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
      console.warn('Unknown SSE event type:', (event as { type: string }).type);
  }
}

/**
 * Handle event field updates (title, meetingTime, etc.)
 */
function handleEventUpdated(data: EventUpdatedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();

  // Only update if we're viewing the same event
  if (!currentEvent || currentEvent.id !== data.eventId) {
    return;
  }

  setCurrentEvent({
    ...currentEvent,
    title: data.title ?? currentEvent.title,
    meetingTime: data.meetingTime !== undefined ? data.meetingTime : currentEvent.meetingTime,
    updatedAt: data.updatedAt,
  });
}

/**
 * Handle event publish notification
 */
function handleEventPublished(data: EventPublishedPayload): void {
  const { currentEvent, setCurrentEvent } = useMeetingStore.getState();

  // Only update if we're viewing the same event
  if (!currentEvent || currentEvent.id !== data.eventId) {
    return;
  }

  setCurrentEvent({
    ...currentEvent,
    publishedVenueId: data.publishedVenueId,
    publishedAt: data.publishedAt,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Handle new participant added to event
 */
function handleParticipantAdded(data: ParticipantAddedPayload): void {
  const { currentEvent, addParticipant } = useMeetingStore.getState();

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
  const exists = currentEvent.participants.some((p) => p.id === data.participant.id);
  if (exists) {
    console.warn('[SSE Handler] Participant already exists, skipping add:', data.participant.id);
    return;
  }

  const transformedParticipant = transformParticipant(data.participant);
  addParticipant(transformedParticipant);
}

/**
 * Handle participant information update
 */
function handleParticipantUpdated(data: ParticipantUpdatedPayload): void {
  const { currentEvent, updateParticipant } = useMeetingStore.getState();

  // Backend sends participant.id, not a separate participantId field
  const participantId = data.participantId || data.participant.id;

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
  updateParticipant(participantId, transformedParticipant);
}

/**
 * Handle participant removed from event
 */
function handleParticipantRemoved(data: ParticipantRemovedPayload): void {
  const { currentEvent, removeParticipant } = useMeetingStore.getState();

  // Extract participantId - backend may send it directly or in nested structure
  const participantId =
    data.participantId || (data as { participant?: { id: string } }).participant?.id;

  // Only update if we're viewing the same event
  if (!currentEvent) {
    console.warn('[SSE Handler] No current event, skipping');
    return;
  }

  if (currentEvent.id !== data.eventId) {
    console.warn('[SSE Handler] Event ID mismatch, skipping');
    return;
  }

  if (!participantId) {
    console.warn('[SSE Handler] No participantId in payload, skipping');
    return;
  }

  removeParticipant(participantId);
}

/**
 * Handle vote statistics update
 * CRITICAL: This handler MUST NOT overwrite venue details, only update vote stats
 */
function handleVoteStatistics(data: VoteStatisticsPayload & { eventId?: string }): void {
  const { currentEvent, setVoteStatistics, searchedVenues, venueById } = useMeetingStore.getState();

  // Only update if we're viewing the same event
  if (!currentEvent || (data.eventId && currentEvent.id !== data.eventId)) {
    console.warn('[SSE Handler] vote:statistics skipped - event mismatch');
    return;
  }

  // Transform backend format to frontend VenueWithVotes format
  // Backend sends: { venueId, voteCount, voterNames }
  // Frontend expects: { id, name, address, location, category, rating, priceLevel, photoUrl, voteCount, voters }
  const transformedVenues = data.venues.map((backendVenue) => {
    // CRITICAL: Prioritize venueById (full details), fallback to searchedVenues
    // This ensures SSE doesn't overwrite complete venue data with incomplete data
    const fullVenue =
      venueById[backendVenue.venueId] || searchedVenues.find((v) => v.id === backendVenue.venueId);

    // Defensive guard: Handle missing voterNames field
    // Note: Backend field is "voterNames" (legacy naming) but contains participant UUIDs (voterIds)
    // Standardized naming: Always use "voterIds" in frontend code
    const voterIds = backendVenue.voterNames ?? [];

    if (!fullVenue) {
      console.warn('[SSE Handler] Missing venue details for:', backendVenue.venueId);

      // Trigger background hydration to fetch full venue details from backend
      console.log('[SSE Handler] Triggering venue hydration...');
      useMeetingStore.getState().hydrateVenue(backendVenue.venueId);

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
        voters: voterIds,
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
      voters: voterIds, // Standardized: "voters" field contains voterIds (participant UUIDs)
    };
  });

  const statistics = {
    venues: transformedVenues,
    totalVotes: data.totalVotes,
  };

  setVoteStatistics(statistics);
}
