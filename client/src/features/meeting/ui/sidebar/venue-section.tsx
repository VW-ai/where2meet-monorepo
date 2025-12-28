'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { venueClient } from '@/features/meeting/api';
import type { Venue } from '@/entities';
import { VenueCard } from './venue-card';
import { TravelTypeFilter } from './travel-type-filter';
import { SearchPillBar } from './search-pill-bar';
import { LikedFilterButton } from '@/features/voting/ui/liked-filter-button';
import { cn } from '@/shared/lib/cn';

export function VenueSection() {
  const { currentEvent, searchedVenues, setSearchedVenues, venueById } = useMeetingStore();
  const { getAllVotedVenueIds, voteStatsByVenueId } = useVotingStore();
  const { searchQuery, searchExecutionTrigger, executedSearchQuery, setExecutedSearchQuery } =
    useUIStore();
  const { searchRadius, searchCircle } = useMapStore();
  const { isOrganizerMode, isParticipantMode } = useAuthStore();

  // Check if user has joined (organizer or participant)
  const hasJoined = isOrganizerMode || isParticipantMode;

  // Derive ALL voted venues (from any participant) from voting-store and venue details from meeting-store
  // Subscribe to voteStatsByVenueId to re-render when votes change
  const savedVenues = useMemo(() => {
    const votedVenueIds = getAllVotedVenueIds();
    console.log('[VenueSection] Voted venues updated:', {
      count: votedVenueIds.length,
      venueIds: votedVenueIds,
      voteStatsCount: Object.keys(voteStatsByVenueId).length,
    });
    return votedVenueIds;
  }, [voteStatsByVenueId, getAllVotedVenueIds]);

  const likedVenueData: Record<string, Venue> = {};
  savedVenues.forEach((venueId) => {
    if (venueById[venueId]) {
      likedVenueData[venueId] = venueById[venueId];
    }
  });

  // Initialize venues from store (persists across view switches)
  const [venues, setVenues] = useState<Venue[]>(searchedVenues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLikedOnly, setShowLikedOnly] = useState(false);
  const [isLikedExpanded, setIsLikedExpanded] = useState(false);

  // Check if event is published
  const isPublished = !!currentEvent?.publishedAt;

  // Preserve user's UI preferences before forcing liked mode
  const prevShowLikedOnlyRef = useRef(showLikedOnly);
  const prevIsLikedExpandedRef = useRef(isLikedExpanded);
  const didForceRef = useRef(false);

  // Track if this is the initial mount (to skip redundant searches)
  const isInitialMount = useRef(true);
  const lastSearchParamsRef = useRef<{
    query: string;
    eventId: string | null;
    radius: number;
    center: { lat: number; lng: number } | null;
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
            eventId: currentEvent?.id ?? null,
            radius: searchRadius,
            center: searchCircle?.center ?? null,
          };
          return;
        }
      }

      if (!executedSearchQuery.trim()) {
        return; // Don't clear - preserve existing results
      }

      if (!currentEvent?.id) {
        setError('No event selected');
        return;
      }

      // Check if params have changed
      const currentParams = {
        query: executedSearchQuery,
        eventId: currentEvent.id,
        radius: searchRadius,
        center: searchCircle?.center ?? null,
      };

      const lastParams = lastSearchParamsRef.current;
      if (
        lastParams &&
        lastParams.query === currentParams.query &&
        lastParams.eventId === currentParams.eventId &&
        lastParams.radius === currentParams.radius &&
        lastParams.center?.lat === currentParams.center?.lat &&
        lastParams.center?.lng === currentParams.center?.lng
      ) {
        return; // Skip - params haven't changed
      }

      try {
        setLoading(true);
        setError(null);

        // Phase 2: Execute search via backend API using the search circle center
        if (!searchCircle?.center) {
          setError('No search center available. Add participants with locations first.');
          setLoading(false);
          return;
        }

        const response = await venueClient.search({
          center: searchCircle.center,
          searchRadius,
          query: executedSearchQuery,
        });
        const searchResults = response.venues;
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
    currentEvent?.id,
    searchRadius,
    searchCircle,
    setSearchedVenues,
    searchedVenues.length,
  ]);

  // Force liked mode when published, restore on unpublish
  useEffect(() => {
    if (isPublished) {
      if (!didForceRef.current) {
        // First time entering published: save user preferences
        prevShowLikedOnlyRef.current = showLikedOnly;
        prevIsLikedExpandedRef.current = isLikedExpanded;
        didForceRef.current = true;
      }

      // Force liked-only + expanded
      if (!showLikedOnly) setShowLikedOnly(true);
      if (!isLikedExpanded) setIsLikedExpanded(true);
      return;
    }

    // Exiting published: restore if we previously forced
    if (didForceRef.current) {
      setShowLikedOnly(prevShowLikedOnlyRef.current);
      setIsLikedExpanded(prevIsLikedExpandedRef.current);
      didForceRef.current = false;
    }
  }, [isPublished]); // Only depend on isPublished to avoid setState loops

  return (
    <div
      className={cn(
        'relative h-full flex flex-col transition-colors duration-300',
        showLikedOnly ? 'bg-coral-50/30' : 'bg-transparent'
      )}
    >
      {/* Sticky Header Section */}
      <div
        className={cn(
          'sticky top-0 z-10 pb-4 space-y-4',
          '-mx-4 md:-mx-6 px-4 md:px-6 -mt-4 md:-mt-6 pt-4 md:pt-6',
          'transition-colors duration-300',
          showLikedOnly
            ? 'bg-coral-50/60 backdrop-blur-md border-b border-coral-200/50'
            : 'bg-white/95 backdrop-blur-md'
        )}
      >
        {/* Header - Title + Count + Search Query */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {showLikedOnly ? 'Liked Venues' : 'Venues'}
            {executedSearchQuery && !showLikedOnly && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                • &quot;{executedSearchQuery}&quot;
              </span>
            )}
          </h2>
          {(() => {
            const count = showLikedOnly ? Object.values(likedVenueData).length : venues.length;
            return (
              count > 0 && (
                <span
                  className={cn(
                    'text-sm font-medium',
                    showLikedOnly ? 'text-coral-700' : 'text-muted-foreground'
                  )}
                >
                  {count} {showLikedOnly ? 'liked' : 'found'}
                </span>
              )
            );
          })()}
        </div>

        {/* Travel Type Filter */}
        {!isPublished && <TravelTypeFilter />}

        {/* Search + Liked Filter */}
        <div className="flex items-center gap-2">
          {/* Two-phase search: Phase 1 shows autocomplete, Phase 2 populates venue list */}
          {/* Only show search bar for joined participants/organizers and when not published */}
          {hasJoined && !isPublished && (
            <div
              className="transition-all duration-300 ease-in-out"
              style={{ width: isLikedExpanded ? '60%' : '80%' }}
            >
              <SearchPillBar
                onSearchExecute={(query) => {
                  // Phase 2: Execute search and populate venue list
                  setExecutedSearchQuery(query);
                }}
                onFocus={() => {
                  // Collapse liked section when search bar is focused
                  if (isLikedExpanded) {
                    setIsLikedExpanded(false);
                    setShowLikedOnly(false);
                  }
                }}
              />
            </div>
          )}
          {/* Liked Filter - full width when published, disabled toggle */}
          <div
            className="transition-all duration-300 ease-in-out"
            style={{
              width: isPublished ? '100%' : hasJoined ? (isLikedExpanded ? '40%' : '20%') : '100%',
            }}
          >
            <LikedFilterButton
              isExpanded={isPublished || isLikedExpanded}
              onToggle={() => {
                if (isPublished) return; // Prevent toggle when published
                const newExpanded = !isLikedExpanded;
                setIsLikedExpanded(newExpanded);
                setShowLikedOnly(newExpanded);
              }}
              disabled={isPublished}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="flex-1 overflow-y-auto space-y-4 pt-4 pb-2">
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
        {!loading && !error && !executedSearchQuery && !showLikedOnly && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Search for venues to get started</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try &quot;restaurants near Central Park&quot;
            </p>
          </div>
        )}

        {/* Empty state for non-participants */}
        {!loading && !error && !executedSearchQuery && !hasJoined && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">Join the event to search for venues</p>
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
            <p className="text-sm text-muted-foreground">
              {isPublished ? 'No venues were voted for in this event' : 'No liked venues yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isPublished
                ? 'The event was published without any votes'
                : 'Like venues to see them here'}
            </p>
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
              <div className="space-y-4 px-2">
                {displayVenues.map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    isPublishedVenue={venue.id === currentEvent?.publishedVenueId}
                  />
                ))}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
