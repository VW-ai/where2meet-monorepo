'use client';

import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/ui-store';
import { useMeetingStore } from '@/store/useMeetingStore';
import { api } from '@/lib/api/client';
import type { Venue, VenueSearchResponse } from '@/types';
import { VenueCard } from './venue-card';

export function VenueSection() {
  const { selectedCategory } = useUIStore();
  const { currentEvent } = useMeetingStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function searchVenues() {
      if (!currentEvent || !currentEvent.participants || currentEvent.participants.length === 0) {
        setVenues([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Calculate center point from participants (simple average for now)
        const latitudes = currentEvent.participants
          .map((p) => p.location.lat)
          .filter((lat): lat is number => lat !== null);
        const longitudes = currentEvent.participants
          .map((p) => p.location.lng)
          .filter((lon): lon is number => lon !== null);

        if (latitudes.length === 0 || longitudes.length === 0) {
          setVenues([]);
          return;
        }

        const centerLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
        const centerLon = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

        const response = (await api.venues.search({
          center: { lat: centerLat, lng: centerLon },
          radius: 5000, // 5km radius
          categories: selectedCategory ? [selectedCategory] : undefined,
        })) as VenueSearchResponse;

        setVenues(response.venues);
      } catch (err) {
        console.error('Failed to search venues:', err);
        setError(err instanceof Error ? err.message : 'Failed to load venues');
      } finally {
        setLoading(false);
      }
    }

    searchVenues();
  }, [currentEvent, selectedCategory]);

  if (!currentEvent) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Loading event...</p>
      </div>
    );
  }

  if (!currentEvent.participants || currentEvent.participants.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">No participants yet</p>
        <p className="text-xs text-muted-foreground">Add participants to search for venues</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Venues
          {selectedCategory && (
            <span className="ml-2 text-sm font-normal text-muted-foreground capitalize">
              • {selectedCategory.replace('_', ' ')}
            </span>
          )}
        </h2>
        {venues.length > 0 && (
          <span className="text-sm text-muted-foreground">{venues.length} found</span>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-8 text-center" role="status" aria-live="polite">
          <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-coral-500"
            aria-hidden="true"
          ></div>
          <p className="mt-2 text-sm text-muted-foreground">Searching venues...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 shadow-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Venue List */}
      {!loading && !error && venues.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No venues found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting the category filter</p>
        </div>
      )}

      {!loading && !error && venues.length > 0 && (
        <div className="space-y-3">
          {venues.map((venue) => (
            <VenueCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </div>
  );
}
