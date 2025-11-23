'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { MapArea } from '@/components/map';
import { useMeetingStore } from '@/store/useMeetingStore';
import { api } from '@/lib/api/client';

export default function MeetPage() {
  const params = useParams();
  const eventId = params.id as string;
  const { setCurrentEvent, setLoadingEvent, setEventError, isLoadingEvent, eventError } =
    useMeetingStore();

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
    <div className="flex flex-col h-screen bg-background">
      {/* Header - 10% height */}
      <Header eventId={eventId} />

      {/* Main Content - 90% height */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - 30% width on desktop, full width on mobile */}
        <Sidebar />

        {/* Map Area - 70% width on desktop, full width on mobile */}
        <MapArea />
      </div>
    </div>
  );
}
