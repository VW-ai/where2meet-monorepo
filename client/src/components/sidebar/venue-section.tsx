'use client';

import { useEffect, useState, useRef } from 'react';
import { useUIStore } from '@/store/ui-store';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useMapStore } from '@/store/map-store';
import { searchPlacesByText } from '@/lib/google-maps/places-nearby';
import type { Venue } from '@/types';
import { VenueCard } from './venue-card';
import { TravelTypeFilter } from './venue/travel-type-filter';
import { SearchPillBar } from './venue/search-pill-bar';
import { LikedFilterButton } from './venue/liked-filter-button';

export function VenueSection() {
  const { savedVenues, searchedVenues, setSelectedVenue, setSearchedVenues, likedVenueData } =
    useMeetingStore();
  const { searchQuery, searchExecutionTrigger, executedSearchQuery, setExecutedSearchQuery } =
    useUIStore();
  const { mecCircle, searchRadius } = useMapStore();

  // Initialize venues from store (persists across view switches)
  const [venues, setVenues] = useState<Venue[]>(searchedVenues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [isLikedExpanded, setIsLikedExpanded] = useState(false);

  // Track if this is the initial mount (to skip redundant searches)
  const isInitialMount = useRef(true);
  const lastSearchParamsRef = useRef<{
    query: string;
    centerLat: number | null;
    centerLng: number | null;
    radius: number;
  } | null>(null);

  // Sync local venues with store when returning to venue section
  useEffect(() => {
    if (searchedVenues.length > 0 && venues.length === 0) {
      setVenues(searchedVenues);
    }
  }, [searchedVenues, venues.length]);

  // Listen for search execution trigger from category filters
  useEffect(() => {
    if (searchExecutionTrigger > 0 && searchQuery.trim()) {
      setExecutedSearchQuery(searchQuery);
    }
  }, [searchExecutionTrigger, searchQuery, setExecutedSearchQuery]);

  // Search venues when a search query is executed (Phase 2 of two-phase search)
  // Re-search when search radius changes (dragging the circle)
  useEffect(() => {
    async function searchVenues() {
      // On initial mount, skip search if we already have venues from the store
      if (isInitialMount.current) {
        isInitialMount.current = false;
        if (searchedVenues.length > 0 && executedSearchQuery.trim()) {
          // Already have data from store, update refs and skip search
          lastSearchParamsRef.current = {
            query: executedSearchQuery,
            centerLat: mecCircle?.center?.lat ?? null,
            centerLng: mecCircle?.center?.lng ?? null,
            radius: searchRadius,
          };
          return;
        }
      }

      if (!executedSearchQuery.trim()) {
        return; // Don't clear - preserve existing results
      }

      // Check if params have changed
      const currentParams = {
        query: executedSearchQuery,
        centerLat: mecCircle?.center?.lat ?? null,
        centerLng: mecCircle?.center?.lng ?? null,
        radius: searchRadius,
      };

      const lastParams = lastSearchParamsRef.current;
      if (
        lastParams &&
        lastParams.query === currentParams.query &&
        lastParams.centerLat === currentParams.centerLat &&
        lastParams.centerLng === currentParams.centerLng &&
        lastParams.radius === currentParams.radius
      ) {
        return; // Skip - params haven't changed
      }

      try {
        setLoading(true);
        setError(null);

        // Phase 2: Execute search and populate venue list
        // Use MEC center and search radius to limit results to the draggable circle
        const searchCenter = mecCircle?.center;
        const searchResults = await searchPlacesByText(
          executedSearchQuery,
          searchCenter,
          searchRadius
        );
        setVenues(searchResults);
        setSearchedVenues(searchResults); // Update store so map can show markers
        lastSearchParamsRef.current = currentParams;
      } catch (err) {
        console.error('Failed to search venues:', err);
        setError(err instanceof Error ? err.message : 'Failed to load venues');
      } finally {
        setLoading(false);
      }
    }

    searchVenues();
  }, [
    executedSearchQuery,
    mecCircle?.center,
    searchRadius,
    setSearchedVenues,
    searchedVenues.length,
  ]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Venues
          {executedSearchQuery && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              • &quot;{executedSearchQuery}&quot;
            </span>
          )}
        </h2>
        {venues.length > 0 && (
          <span className="text-sm text-muted-foreground">{venues.length} found</span>
        )}
      </div>

      {/* Travel Type Filter */}
      <TravelTypeFilter />

      {/* Quick Search and Liked Filter */}
      <div className="flex items-center gap-2">
        {/* Two-phase search: Phase 1 shows autocomplete, Phase 2 populates venue list */}
        <div
          className="transition-all duration-300 ease-in-out"
          style={{ width: isLikedExpanded ? '60%' : '80%' }}
        >
          <SearchPillBar
            onSelectVenue={(venue) => {
              // Select venue on map when chosen from autocomplete
              setSelectedVenue(venue);
            }}
            onSearchExecute={(query) => {
              // Phase 2: Execute search and populate venue list
              setExecutedSearchQuery(query);
            }}
          />
        </div>
        {/* Liked Filter - Toggles venue list filtering */}
        <div
          className="transition-all duration-300 ease-in-out"
          style={{ width: isLikedExpanded ? '40%' : '20%' }}
        >
          <LikedFilterButton
            isExpanded={isLikedExpanded}
            onToggle={() => {
              const newExpanded = !isLikedExpanded;
              setIsLikedExpanded(newExpanded);
              setShowLikedOnly(newExpanded);
            }}
          />
        </div>
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

      {/* Empty state - no search executed yet */}
      {!loading && !error && !executedSearchQuery && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Search for venues to get started</p>
          <p className="text-xs text-muted-foreground mt-1">
            Try &quot;restaurants near Central Park&quot;
          </p>
        </div>
      )}

      {/* Venue List - No results from search */}
      {!loading && !error && executedSearchQuery && venues.length === 0 && !showLikedOnly && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No venues found for &quot;{executedSearchQuery}&quot;
          </p>
          <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>
        </div>
      )}

      {/* No liked venues */}
      {!loading && !error && showLikedOnly && savedVenues.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No liked venues yet</p>
          <p className="text-xs text-muted-foreground mt-1">Like venues to see them here</p>
        </div>
      )}

      {/* Venue List */}
      {!loading &&
        !error &&
        (() => {
          // When showing liked only, use likedVenueData (persistent across searches)
          // Otherwise, filter from current search results
          let displayVenues: Venue[];

          if (showLikedOnly) {
            // Get all liked venues from persistent storage
            displayVenues = Object.values(likedVenueData).sort((a, b) => {
              // Sort by vote count (highest first)
              const aVotes = a.voteCount || 0;
              const bVotes = b.voteCount || 0;
              return bVotes - aVotes;
            });
          } else {
            // Show current search results
            displayVenues = venues;
          }

          // No venues to display
          if (displayVenues.length === 0) {
            if (showLikedOnly) {
              return null; // Empty state handled above
            }
            if (!executedSearchQuery) {
              return null; // Empty state handled above
            }
            return null; // No results state handled above
          }

          return (
            <div className="space-y-3">
              {displayVenues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>
          );
        })()}
    </div>
  );
}
