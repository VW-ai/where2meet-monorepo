'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { MapArea } from '@/components/map';
import { VenueInfo } from '@/components/sidebar/venue/venue-info';
import { ParticipantStats } from '@/components/sidebar/participant/participant-stats';
import { ModalProvider } from '@/components/modals';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useUIStore } from '@/store/ui-store';
import { api } from '@/lib/api';

export default function MeetPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { setCurrentEvent, setLoadingEvent, setEventError, isLoadingEvent, eventError } =
    useMeetingStore();
  const { initializeOrganizerMode, initializeParticipantMode } = useUIStore();

  // Initialize organizer and participant modes based on localStorage tokens
  useEffect(() => {
    if (eventId) {
      initializeOrganizerMode(eventId);
      initializeParticipantMode(eventId);
    }
  }, [eventId, initializeOrganizerMode, initializeParticipantMode]);

  useEffect(() => {
    async function loadEvent() {
      if (!eventId) return;

      try {
        setLoadingEvent(true);
        setEventError(null);
        const event = await api.events.get(eventId);
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
