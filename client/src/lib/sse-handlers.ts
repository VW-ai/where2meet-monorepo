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
function transformParticipant(backendParticipant: any): Participant {
  const { lat, lng, ...rest } = backendParticipant;

  return {
    ...rest,
    location: lat != null && lng != null ? { lat, lng } : null,
  };
}

/**
 * Main SSE event router - dispatches events to appropriate handlers
 */
export function handleSSEEvent(event: SSEEventData): void {
  console.log('SSE Event received:', event.type, event.data);

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

  console.log('[SSE Handler] participant:added received:', {
    dataEventId: data.eventId,
    currentEventId: currentEvent?.id,
    participantId: data.participant?.id,
    participantName: data.participant?.name,
  });

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

  console.log('[SSE Handler] Adding participant to event:', data.participant.name);
  const transformedParticipant = transformParticipant(data.participant);
  console.log('[SSE Handler] Transformed participant location:', transformedParticipant.location);
  addParticipant(transformedParticipant);
  console.log('[SSE Handler] Participant added successfully');
}

/**
 * Handle participant information update
 */
function handleParticipantUpdated(data: ParticipantUpdatedPayload): void {
  const { currentEvent, updateParticipant } = useMeetingStore.getState();

  // Backend sends participant.id, not a separate participantId field
  const participantId = data.participantId || data.participant.id;

  console.log('[SSE Handler] participant:updated received:', {
    dataEventId: data.eventId,
    currentEventId: currentEvent?.id,
    participantId,
  });

  // Only update if we're viewing the same event
  if (!currentEvent) {
    console.warn('[SSE Handler] No current event, skipping');
    return;
  }

  if (currentEvent.id !== data.eventId) {
    console.warn('[SSE Handler] Event ID mismatch, skipping');
    return;
  }

  console.log('[SSE Handler] Updating participant:', data.participant.name);
  const transformedParticipant = transformParticipant(data.participant);
  console.log('[SSE Handler] Transformed participant location:', transformedParticipant.location);
  updateParticipant(participantId, transformedParticipant);

  // Verify the update worked
  const { currentEvent: updatedEvent } = useMeetingStore.getState();
  const updated = updatedEvent?.participants.find(p => p.id === participantId);
  console.log('[SSE Handler] Participant updated successfully:', updated?.name);
}

/**
 * Handle participant removed from event
 */
function handleParticipantRemoved(data: ParticipantRemovedPayload): void {
  const { currentEvent, removeParticipant } = useMeetingStore.getState();

  // Extract participantId - backend may send it directly or in nested structure
  const participantId = data.participantId || (data as any).participant?.id;

  console.log('[SSE Handler] participant:removed received:', {
    dataEventId: data.eventId,
    currentEventId: currentEvent?.id,
    participantId,
  });

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

  console.log('[SSE Handler] Removing participant:', participantId);
  removeParticipant(participantId);
  console.log('[SSE Handler] Participant removed successfully');
}

/**
 * Handle vote statistics update
 */
function handleVoteStatistics(data: VoteStatisticsPayload & { eventId?: string }): void {
  const { currentEvent, setVoteStatistics, searchedVenues, likedVenueData } = useMeetingStore.getState();

  console.log('[SSE Handler] vote:statistics received:', {
    eventId: data.eventId,
    venuesCount: data.venues.length,
    totalVotes: data.totalVotes,
  });

  // Only update if we're viewing the same event
  if (!currentEvent || (data.eventId && currentEvent.id !== data.eventId)) {
    console.warn('[SSE Handler] vote:statistics skipped - event mismatch');
    return;
  }

  // Transform backend format to frontend VenueWithVotes format
  // Backend sends: { venueId, voteCount, voterNames }
  // Frontend expects: { id, name, address, location, category, rating, priceLevel, photoUrl, voteCount, voters }
  const transformedVenues = data.venues.map((backendVenue) => {
    // Find full venue details from searchedVenues or likedVenueData
    const fullVenue =
      searchedVenues.find(v => v.id === backendVenue.venueId) ||
      likedVenueData[backendVenue.venueId];

    console.log('[SSE Handler] Transforming venue:', {
      venueId: backendVenue.venueId,
      foundInSearch: !!searchedVenues.find(v => v.id === backendVenue.venueId),
      foundInLiked: !!likedVenueData[backendVenue.venueId],
      voteCount: backendVenue.voteCount,
      voterNames: backendVenue.voterNames,
    });

    return {
      id: backendVenue.venueId,
      name: fullVenue?.name || 'Unknown Venue',
      address: fullVenue?.address || null,
      location: fullVenue?.location || { lat: 0, lng: 0 },
      category: fullVenue?.types?.[0] || null, // Use first type as category
      rating: fullVenue?.rating || null,
      priceLevel: fullVenue?.priceLevel || null,
      photoUrl: fullVenue?.photoUrl || null,
      voteCount: backendVenue.voteCount,
      voters: backendVenue.voterNames, // Backend sends "voterNames" but it contains participant IDs
    };
  });

  const statistics = {
    venues: transformedVenues,
    totalVotes: data.totalVotes,
  };

  console.log('[SSE Handler] Calling setVoteStatistics with:', {
    venuesCount: transformedVenues.length,
    totalVotes: data.totalVotes,
  });

  setVoteStatistics(statistics);
  console.log('[SSE Handler] vote:statistics processed successfully');
}
