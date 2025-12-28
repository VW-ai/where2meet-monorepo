'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/features/meeting/ui/header';
import { Sidebar } from '@/features/meeting/ui/sidebar';
import { MapArea } from '@/features/meeting/ui/map';
import { VenueInfo } from '@/features/meeting/ui/sidebar/venue-info';
import { ParticipantStats } from '@/features/meeting/ui/sidebar/participant-stats';
import { ModalProvider } from '@/features/meeting/ui/modals';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useParticipantStore } from '@/features/meeting/model/participant-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { eventClient } from '@/features/meeting/api';
import { useEventStream } from '@/features/meeting/hooks/useEventStream';

export default function MeetPage() {
  const params = useParams();
  const eventId = params.id as string;
  const {
    currentEvent,
    setCurrentEvent,
    setLoadingEvent,
    setEventError,
    isLoadingEvent,
    eventError,
  } = useMeetingStore();
  const { loadVoteStatistics, setMyParticipantId } = useVotingStore();
   const { initializeOrganizerMode, initializeParticipantMode, organizerToken, participantToken, organizerParticipantId, currentParticipantId } =
    useAuthStore();
  const { setParticipants } = useParticipantStore();

  // Get authentication token (prefer organizer token, fallback to participant token)
  const token = organizerToken || participantToken || null;

  // Initialize organizer and participant modes based on localStorage tokens
  useEffect(() => {
    if (eventId) {
      initializeOrganizerMode(eventId);
      initializeParticipantMode(eventId);
    }
  }, [eventId, initializeOrganizerMode, initializeParticipantMode]);

  // Set participant ID for voting (organizer's participant ID takes precedence)
  useEffect(() => {
    const participantId = organizerParticipantId || currentParticipantId;
    if (participantId) {
      console.log('[MeetPage] Setting myParticipantId for voting:', participantId);
      setMyParticipantId(participantId);
    }
  }, [organizerParticipantId, currentParticipantId, setMyParticipantId]);

  // Restore user identity using /me endpoint after page refresh
  useEffect(() => {
    async function restoreIdentity() {
      if (!eventId || !token) return;

      try {
        const participant = await eventClient.getMe(eventId, token);
        console.log('[MeetPage] Restored participant identity:', {
          id: participant.id,
          name: participant.name,
          isOrganizer: participant.isOrganizer,
        });

        // Update auth store with participant info if needed
        // This ensures the participant ID is available for voting operations
        const { setParticipantInfo } = useAuthStore.getState();
        if (!participantToken && participant.participantToken) {
          setParticipantInfo(eventId, participant.id, participant.participantToken);
        }
      } catch (error) {
        console.error('[MeetPage] Failed to restore identity:', error);
        // Silently fail - user may not have a token or it may be invalid
      }
    }

    restoreIdentity();
  }, [eventId, token, participantToken]);

  // Connect to SSE stream for real-time updates
  // Trigger snapshot reconciliation on (re)connect to prevent drift
  useEventStream(eventId, token, {
    onConnect: () => {
      console.log(
        '[SSE] Connection established - loading vote statistics snapshot for reconciliation'
      );
      loadVoteStatistics(eventId);
    },
  });

  // Sync participants from event to participant store
  useEffect(() => {
    if (!currentEvent?.participants) {
      return;
    }

    // Sync participants to participant store for SSE updates and UI rendering
    console.log('[MeetPage] Syncing participants to store:', currentEvent.participants.length);
    setParticipants(currentEvent.participants);
  }, [currentEvent, setParticipants]);

  // Load initial vote statistics once event is loaded
  // Real-time updates are handled via SSE connection
  useEffect(() => {
    if (!eventId || !currentEvent) {
      return;
    }

    // Load initial vote statistics
    loadVoteStatistics(eventId);
  }, [eventId, currentEvent, loadVoteStatistics]);

  useEffect(() => {
    async function loadEvent() {
      if (!eventId) return;

      try {
        setLoadingEvent(true);
        setEventError(null);
        const event = await eventClient.get(eventId);
        setCurrentEvent(event);
      } catch (error) {
        console.error('Failed to load event:', error);
        setEventError(error instanceof Error ? error.message : 'Failed to load event');
      } finally {
        setLoadingEvent(false);
      }
    }

    loadEvent();
  }, [eventId, setCurrentEvent, setLoadingEvent, setEventError]);

  // Loading state
  if (isLoadingEvent) {
    return (
      <div
        className="flex items-center justify-center h-screen bg-background"
        role="status"
        aria-live="polite"
      >
        <div className="text-center space-y-4">
          <div
            className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-coral-500"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Loading event...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (eventError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background p-8">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Failed to load event</h2>
          <p className="text-sm text-red-700">{eventError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Map - Full Screen Background */}
      <div className="absolute inset-0">
        <MapArea />
      </div>

      {/* Floating UI Components */}
      <div className="relative z-10 h-full w-full pointer-events-none">
        {/* Header - Floating at top */}
        <div className="pointer-events-auto">
          <Header eventId={eventId} />
        </div>

        {/* Sidebar - Floating overlay (bottom on mobile, left on desktop) */}
        <div className="pointer-events-auto fixed bottom-0 left-0 right-0 h-[50vh] md:absolute md:top-[10vh] md:left-0 md:bottom-3 md:right-auto md:h-auto md:max-h-[calc(90vh-1rem)]">
          <Sidebar />
        </div>

        {/* Venue Info Slide-out - Global overlay */}
        <div className="pointer-events-auto">
          <VenueInfo />
        </div>

        {/* Participant Stats Slide-out */}
        <div className="pointer-events-auto">
          <ParticipantStats />
        </div>
      </div>

      {/* Modals */}
      <ModalProvider />
    </div>
  );
}
