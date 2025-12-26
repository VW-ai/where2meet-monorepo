/**
 * Meeting Store
 *
 * Zustand store for managing global application state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Event, Participant, Venue, TravelMode, Location, ActiveSection } from '@/types';
import { VoteStatisticsResponse } from '@/types/api';
import { api } from '@/lib/api';
import { useUIStore } from './ui-store';

interface MeetingState {
  // ============================================================================
  // Event State
  // ============================================================================
  currentEvent: Event | null;
  isLoadingEvent: boolean;
  eventError: string | null;

  // ============================================================================
  // UI State
  // ============================================================================
  activeSection: ActiveSection;
  selectedVenue: Venue | null;
  selectedParticipant: Participant | null;

  // ============================================================================
  // Venue State (Refactored - Separated Details from Stats)
  // ============================================================================
  // Venue details only - never overwritten by incomplete SSE data
  venueById: Record<string, Venue>; // Full venue data keyed by venue ID
  // Vote statistics only - updated by votes and SSE
  voteStatsByVenueId: Record<string, { voteCount: number; voterIds: string[]; seq?: number }>; // Vote stats per venue
  myParticipantId: string | null; // Current user's participant ID for this event
  searchedVenues: Venue[]; // Venues from current search results
  voteStatistics: VoteStatisticsResponse | null; // Vote statistics from backend (for compatibility)
  isLoadingVotes: boolean; // Loading state for vote operations
  lastReconcileAt: number | null; // Timestamp of last snapshot reconciliation (prevents spam)

  // Deprecated - kept for backward compatibility, derive from voteStatsByVenueId
  savedVenues: string[]; // Array of saved venue IDs (deprecated, use derived myLikedVenueIds)
  likedVenueData: Record<string, Venue>; // (deprecated, use venueById)

  // ============================================================================
  // Map State
  // ============================================================================
  searchRadius: number; // in meters
  travelMode: TravelMode;
  mapCenter: Location | null;

  // ============================================================================
  // Event Actions
  // ============================================================================
  setCurrentEvent: (event: Event) => void;
  updateEvent: (updates: Partial<Event>) => void;
  setLoadingEvent: (loading: boolean) => void;
  setEventError: (error: string | null) => void;

  // ============================================================================
  // Participant Actions
  // ============================================================================
  addParticipant: (participant: Participant) => void;
  updateParticipant: (id: string, updates: Partial<Participant>) => void;
  removeParticipant: (id: string) => void;

  // ============================================================================
  // UI Actions
  // ============================================================================
  setActiveSection: (section: ActiveSection) => void;
  setSelectedVenue: (venue: Venue | null) => void;
  setSelectedParticipant: (participant: Participant | null) => void;

  // ============================================================================
  // Map Actions
  // ============================================================================
  setSearchRadius: (radius: number) => void;
  setTravelMode: (mode: TravelMode) => void;
  setMapCenter: (center: Location | null) => void;

  // ============================================================================
  // Venue Actions
  // ============================================================================
  setSearchedVenues: (venues: Venue[]) => void;
  voteForVenue: (venueId: string, venue?: Venue) => Promise<void>;
  unvoteForVenue: (venueId: string) => Promise<void>;
  loadVoteStatistics: () => Promise<void>;
  setVoteStatistics: (statistics: VoteStatisticsResponse) => void;
  setMyParticipantId: (participantId: string | null) => void;
  saveVenue: (venueId: string, venue?: Venue) => void;
  unsaveVenue: (venueId: string) => void;
  hydrateVenue: (venueId: string) => Promise<void>; // Fetch missing venue details from API

  // Derived selectors (source of truth - DO NOT bypass these)
  getMyLikedVenueIds: () => string[];
  getAllVotedVenues: () => Venue[];
  getAllVotedVenueIdsSorted: () => string[]; // Sorted by vote count descending
  getVenueWithStats: (venueId: string) => (Venue & { voteCount: number }) | null;

  // ============================================================================
  // Utility Actions
  // ============================================================================
  reset: () => void;
}

const initialState = {
  // Event state
  currentEvent: null,
  isLoadingEvent: false,
  eventError: null,

  // UI state
  activeSection: 'participants' as ActiveSection,
  selectedVenue: null,
  selectedParticipant: null,

  // Venue state (refactored)
  venueById: {} as Record<string, Venue>,
  voteStatsByVenueId: {} as Record<string, { voteCount: number; voterIds: string[]; seq?: number }>,
  myParticipantId: null,
  searchedVenues: [] as Venue[],
  voteStatistics: null,
  isLoadingVotes: false,
  lastReconcileAt: null,
  // Deprecated
  savedVenues: [] as string[],
  likedVenueData: {} as Record<string, Venue>,

  // Map state
  searchRadius: 5000, // 5km default
  travelMode: 'driving' as TravelMode,
  mapCenter: null,
};

export const useMeetingStore = create<MeetingState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // Event actions
      setCurrentEvent: (event) => {
        set({ currentEvent: event });
      },

      updateEvent: (updates) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              ...updates,
            },
          };
        }),

      setLoadingEvent: (loading) => set({ isLoadingEvent: loading }),

      setEventError: (error) => set({ eventError: error }),

      // Participant actions
      addParticipant: (participant) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              participants: [...state.currentEvent.participants, participant],
            },
          };
        }),

      updateParticipant: (id, updates) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              participants: state.currentEvent.participants.map((p) =>
                p.id === id ? { ...p, ...updates } : p
              ),
            },
          };
        }),

      removeParticipant: (id) =>
        set((state) => {
          if (!state.currentEvent) return state;
          return {
            currentEvent: {
              ...state.currentEvent,
              participants: state.currentEvent.participants.filter((p) => p.id !== id),
            },
          };
        }),

      // UI actions
      setActiveSection: (section) => {
        set({ activeSection: section });
      },

      setSelectedVenue: (venue) => {
        set({ selectedVenue: venue });
      },

      setSelectedParticipant: (participant) => {
        set({ selectedParticipant: participant });
      },

      // Map actions
      setSearchRadius: (radius) => {
        set({ searchRadius: radius });
      },

      setTravelMode: (mode) => {
        set({ travelMode: mode });
      },

      setMapCenter: (center) => {
        set({ mapCenter: center });
      },

      // Venue actions
      setSearchedVenues: (venues) => {
        // Update searchedVenues and populate venueById with full venue details
        set((state) => {
          const newVenueById = { ...state.venueById };
          venues.forEach((venue) => {
            newVenueById[venue.id] = venue;
          });
          return {
            searchedVenues: venues,
            venueById: newVenueById,
          };
        });
      },

      voteForVenue: async (venueId, venue) => {
        const { currentEvent, myParticipantId } = get();
        const { organizerToken, participantToken, currentParticipantId, organizerParticipantId } =
          useUIStore.getState();

        // Determine which participant ID to use (organizer's ID takes precedence)
        const participantId = organizerParticipantId || currentParticipantId || myParticipantId;
        const token = organizerToken || participantToken;

        if (!currentEvent || !participantId || !token) {
          console.error('Cannot vote: Missing required data');
          console.error('  - currentEvent:', currentEvent ? 'OK' : 'MISSING');
          console.error('  - participantId:', participantId ? 'OK' : 'MISSING');
          console.error('  - token:', token ? 'OK' : 'MISSING');
          return;
        }

        if (!venue) {
          console.error('Cannot vote: Venue data is required');
          return;
        }

        // Save previous state for rollback (stats only, never touch venue details)
        const previousStats = get().voteStatsByVenueId[venueId];
        const previousSavedVenues = get().savedVenues;
        const previousLikedVenueData = get().likedVenueData;

        // Optimistic update
        set((state) => {
          // 1. Store full venue details in venueById (never overwritten)
          const newVenueById = { ...state.venueById };
          newVenueById[venueId] = venue;

          // 2. Update vote stats optimistically
          const currentStats = state.voteStatsByVenueId[venueId] || { voteCount: 0, voterIds: [] };
          const newVoterIds = currentStats.voterIds.includes(participantId)
            ? currentStats.voterIds
            : [...currentStats.voterIds, participantId];

          const newVoteStatsByVenueId = {
            ...state.voteStatsByVenueId,
            [venueId]: {
              voteCount: newVoterIds.length,
              voterIds: newVoterIds,
              seq: currentStats.seq,
            },
          };

          // 3. Update deprecated fields for backward compatibility
          const newSavedVenues = state.savedVenues.includes(venueId)
            ? state.savedVenues
            : [...state.savedVenues, venueId];

          return {
            venueById: newVenueById,
            voteStatsByVenueId: newVoteStatsByVenueId,
            savedVenues: newSavedVenues,
            likedVenueData: { ...state.likedVenueData, [venueId]: venue },
          };
        });

        try {
          // Call backend API - participantId now in URL path
          await api.votes.castVote(
            currentEvent.id,
            participantId,
            {
              venueId,
              venueData: {
                name: venue.name,
                address: venue.address,
                lat: venue.location.lat,
                lng: venue.location.lng,
                category: venue.types?.[0] || undefined,
                rating: venue.rating ?? undefined,
                priceLevel: venue.priceLevel ?? undefined,
                photoUrl: venue.photoUrl ?? undefined,
              },
            },
            token
          );

          // Reload statistics to get updated counts from backend
          await get().loadVoteStatistics();
        } catch (error) {
          console.error('Failed to vote:', error);
          // Revert optimistic update - ONLY rollback stats, NEVER touch venueById
          set((state) => {
            const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };
            if (previousStats) {
              newVoteStatsByVenueId[venueId] = previousStats;
            } else {
              delete newVoteStatsByVenueId[venueId];
            }

            return {
              voteStatsByVenueId: newVoteStatsByVenueId,
              savedVenues: previousSavedVenues,
              likedVenueData: previousLikedVenueData,
            };
          });
          throw error; // Re-throw so components can handle it
        }
      },

      unvoteForVenue: async (venueId) => {
        const { currentEvent, myParticipantId } = get();
        const { organizerToken, participantToken, currentParticipantId, organizerParticipantId } =
          useUIStore.getState();

        // Determine which participant ID to use (organizer's ID takes precedence)
        const participantId = organizerParticipantId || currentParticipantId || myParticipantId;
        const token = organizerToken || participantToken;

        if (!currentEvent || !participantId || !token) {
          console.error('Cannot unvote: Missing required data');
          return;
        }

        // Save previous state for rollback (stats only, never touch venue details)
        const previousStats = get().voteStatsByVenueId[venueId];
        const previousSavedVenues = get().savedVenues;
        const previousLikedVenueData = get().likedVenueData;

        // Optimistic update - update stats only
        set((state) => {
          const currentStats = state.voteStatsByVenueId[venueId];
          if (!currentStats) return state;

          const newVoterIds = currentStats.voterIds.filter((id) => id !== participantId);
          const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };

          if (newVoterIds.length === 0) {
            // No more votes, remove stats entry (but keep venue details in venueById)
            delete newVoteStatsByVenueId[venueId];
          } else {
            newVoteStatsByVenueId[venueId] = {
              voteCount: newVoterIds.length,
              voterIds: newVoterIds,
              seq: currentStats.seq,
            };
          }

          // Update deprecated fields for backward compatibility
          const newSavedVenues = state.savedVenues.filter((id) => id !== venueId);
          const newLikedVenueData = { ...state.likedVenueData };

          // Only remove from likedVenueData if no votes remain
          if (newVoterIds.length === 0) {
            delete newLikedVenueData[venueId];
          }

          return {
            voteStatsByVenueId: newVoteStatsByVenueId,
            savedVenues: newSavedVenues,
            likedVenueData: newLikedVenueData,
          };
        });

        try {
          // Call backend API - both IDs now in URL path, no body
          await api.votes.removeVote(currentEvent.id, participantId, venueId, token);

          // Reload statistics to get updated counts from backend
          await get().loadVoteStatistics();
        } catch (error) {
          console.error('Failed to remove vote:', error);
          // Revert optimistic update - ONLY rollback stats, NEVER touch venueById
          set((state) => {
            const newVoteStatsByVenueId = { ...state.voteStatsByVenueId };
            if (previousStats) {
              newVoteStatsByVenueId[venueId] = previousStats;
            } else {
              delete newVoteStatsByVenueId[venueId];
            }

            return {
              voteStatsByVenueId: newVoteStatsByVenueId,
              savedVenues: previousSavedVenues,
              likedVenueData: previousLikedVenueData,
            };
          });
          throw error; // Re-throw so components can handle it
        }
      },

      loadVoteStatistics: async () => {
        const { currentEvent, myParticipantId, lastReconcileAt } = get();
        if (!currentEvent) {
          console.error('Cannot load vote statistics: No current event');
          return;
        }

        // Throttle: Prevent spamming backend during connection flaps
        // Skip if reconciled within last 15 seconds
        const RECONCILE_THROTTLE_MS = 15000; // 15 seconds
        const now = Date.now();
        if (lastReconcileAt && now - lastReconcileAt < RECONCILE_THROTTLE_MS) {
          const timeLeft = Math.ceil((RECONCILE_THROTTLE_MS - (now - lastReconcileAt)) / 1000);
          console.log(
            `[Store] Throttling reconciliation (last reconciled ${timeLeft}s ago, waiting...)`
          );
          return;
        }

        // Mark start of reconciliation for throttling
        const reconcileStartedAt = now;
        set({ isLoadingVotes: true });

        try {
          const statistics = await api.votes.getStatistics(currentEvent.id);

          // Use same participant ID determination as voting actions
          const { currentParticipantId, organizerParticipantId } = useUIStore.getState();
          const participantId = organizerParticipantId || currentParticipantId || myParticipantId;

          // Populate separated stores
          const { venueById, searchedVenues } = get();
          const newVenueById = { ...venueById };
          const newVoteStatsByVenueId: Record<
            string,
            { voteCount: number; voterIds: string[]; seq?: number }
          > = {};

          // Build venue details and vote stats separately
          statistics.venues.forEach((venueStats) => {
            // Only add to venueById if we don't already have full details
            if (!newVenueById[venueStats.id]) {
              // Create basic venue entry from snapshot
              newVenueById[venueStats.id] = {
                id: venueStats.id,
                name: venueStats.name,
                address: venueStats.address || '',
                location: venueStats.location,
                types: venueStats.category ? [venueStats.category] : [],
                rating: venueStats.rating,
                userRatingsTotal: null,
                priceLevel: venueStats.priceLevel,
                openNow: null,
                photoUrl: venueStats.photoUrl,
              };

              // If venue details are minimal/missing, trigger hydration in background
              // This happens when user B receives vote notification before searching
              if (!venueStats.photoUrl || !venueStats.rating) {
                console.log(
                  '[Store] Snapshot has incomplete venue, triggering hydration:',
                  venueStats.id
                );
                // Trigger async hydration (non-blocking)
                get().hydrateVenue(venueStats.id);
              }
            }

            // Always update vote stats (snapshot is source of truth - last write wins)
            newVoteStatsByVenueId[venueStats.id] = {
              voteCount: venueStats.voteCount,
              voterIds: venueStats.voters || [], // Backend field is "voters" (contains participant UUIDs)
            };
          });

          // Update searchedVenues with vote counts
          const updatedSearchedVenues = searchedVenues.map((venue) => {
            const stats = newVoteStatsByVenueId[venue.id];
            if (stats) {
              return { ...venue, voteCount: stats.voteCount, votes: undefined };
            }
            return venue;
          });

          // Build deprecated fields for backward compatibility
          const hydratedSavedVenues: string[] = [];
          const hydratedLikedVenueData: Record<string, Venue> = {};

          statistics.venues.forEach((venueStats) => {
            hydratedLikedVenueData[venueStats.id] = newVenueById[venueStats.id];
            if (participantId && venueStats.voters.includes(participantId)) {
              hydratedSavedVenues.push(venueStats.id);
            }
          });

          set({
            venueById: newVenueById,
            voteStatsByVenueId: newVoteStatsByVenueId,
            myParticipantId: participantId || null,
            voteStatistics: statistics,
            savedVenues: hydratedSavedVenues,
            likedVenueData: hydratedLikedVenueData,
            searchedVenues: updatedSearchedVenues,
            lastReconcileAt: reconcileStartedAt, // Mark reconciliation timestamp
          });
        } catch (error) {
          console.error('Failed to load vote statistics:', error);
          // Don't throw - statistics loading should fail silently
        } finally {
          set({ isLoadingVotes: false });
        }
      },

      setVoteStatistics: (statistics) => {
        console.log('[Store] setVoteStatistics called with:', {
          venuesCount: statistics.venues.length,
          totalVotes: statistics.totalVotes,
        });

        const { myParticipantId } = get();
        const { currentParticipantId, organizerParticipantId } = useUIStore.getState();
        const participantId = organizerParticipantId || currentParticipantId || myParticipantId;

        console.log('[Store] Participant IDs:', {
          currentParticipantId,
          organizerParticipantId,
          myParticipantId,
          effectiveParticipantId: participantId,
        });

        // Get existing stores - CRITICAL: preserve venue details
        const { venueById, searchedVenues } = get();
        const newVenueById = { ...venueById };
        const newVoteStatsByVenueId: Record<
          string,
          { voteCount: number; voterIds: string[]; seq?: number }
        > = {};

        // Process vote statistics - separate concerns
        statistics.venues.forEach((venueStats) => {
          console.log('[Store] Processing venue stats:', {
            venueId: venueStats.id,
            venueName: venueStats.name,
            voteCount: venueStats.voteCount,
            voters: venueStats.voters,
            hasFullDetails: !!venueById[venueStats.id],
          });

          // CRITICAL: Only add to venueById if we don't already have it
          // This prevents SSE from overwriting complete venue data with incomplete payloads
          if (!newVenueById[venueStats.id]) {
            console.log('[Store] Adding new venue to venueById (incomplete data):', venueStats.id);
            newVenueById[venueStats.id] = {
              id: venueStats.id,
              name: venueStats.name,
              address: venueStats.address || '',
              location: venueStats.location,
              types: venueStats.category ? [venueStats.category] : [],
              rating: venueStats.rating,
              userRatingsTotal: null,
              priceLevel: venueStats.priceLevel,
              openNow: null,
              photoUrl: venueStats.photoUrl,
            };

            // If venue details are minimal/missing, trigger hydration in background
            // This happens when SSE arrives with incomplete venue data
            if (!venueStats.photoUrl || !venueStats.rating) {
              console.log(
                '[Store] Incomplete venue from SSE, triggering hydration:',
                venueStats.id
              );
              // Trigger async hydration (non-blocking)
              get().hydrateVenue(venueStats.id);
            }
          }

          // Always update vote stats (this is what SSE is for)
          const voterIds = venueStats.voters || [];
          newVoteStatsByVenueId[venueStats.id] = {
            voteCount: venueStats.voteCount,
            voterIds,
          };
        });

        // Update searchedVenues with vote counts (not venue details)
        const updatedSearchedVenues = searchedVenues.map((venue) => {
          const stats = newVoteStatsByVenueId[venue.id];
          if (stats) {
            return { ...venue, voteCount: stats.voteCount, votes: undefined };
          }
          return venue;
        });

        // Build deprecated fields for backward compatibility
        const hydratedSavedVenues: string[] = [];
        const hydratedLikedVenueData: Record<string, Venue> = {};

        statistics.venues.forEach((venueStats) => {
          const venue = newVenueById[venueStats.id];
          if (venue) {
            hydratedLikedVenueData[venueStats.id] = {
              ...venue,
              voteCount: venueStats.voteCount,
            };
          }
          const voterIds = venueStats.voters || [];
          if (participantId && voterIds.includes(participantId)) {
            hydratedSavedVenues.push(venueStats.id);
          }
        });

        console.log('[Store] Updated venue and vote data:', {
          venueByIdCount: Object.keys(newVenueById).length,
          voteStatsCount: Object.keys(newVoteStatsByVenueId).length,
          savedVenuesCount: hydratedSavedVenues.length,
        });

        set({
          venueById: newVenueById,
          voteStatsByVenueId: newVoteStatsByVenueId,
          myParticipantId: participantId || null,
          voteStatistics: statistics,
          savedVenues: hydratedSavedVenues,
          likedVenueData: hydratedLikedVenueData,
          searchedVenues: updatedSearchedVenues,
        });
      },

      setMyParticipantId: (participantId) => set({ myParticipantId: participantId }),

      saveVenue: (venueId, venue) =>
        set((state) => {
          if (state.savedVenues.includes(venueId)) {
            return state;
          }

          // Store venue data in venueById if provided
          const newVenueById = venue ? { ...state.venueById, [venueId]: venue } : state.venueById;

          // Store venue data if provided (deprecated)
          const newLikedVenueData = venue
            ? { ...state.likedVenueData, [venueId]: venue }
            : state.likedVenueData;

          return {
            venueById: newVenueById,
            savedVenues: [...state.savedVenues, venueId],
            likedVenueData: newLikedVenueData,
          };
        }),

      unsaveVenue: (venueId) =>
        set((state) => {
          // Don't remove from venueById (venue details are permanent)
          // Only remove from deprecated likedVenueData
          const newLikedVenueData = { ...state.likedVenueData };
          delete newLikedVenueData[venueId];

          return {
            savedVenues: state.savedVenues.filter((id) => id !== venueId),
            likedVenueData: newLikedVenueData,
          };
        }),

      hydrateVenue: async (venueId: string) => {
        // Check if venue already has full details
        const existingVenue = get().venueById[venueId];
        if (existingVenue && existingVenue.name !== 'Unknown Venue') {
          console.log('[Store] Venue already hydrated:', venueId);
          return;
        }

        console.log('[Store] Hydrating venue details for:', venueId);

        try {
          // Fetch full venue details from backend
          const venue = await api.venues.get(venueId);

          console.log('[Store] Venue hydrated successfully:', venue.name);

          // Update venueById with full details
          set((state) => ({
            venueById: {
              ...state.venueById,
              [venueId]: venue,
            },
            // Also update likedVenueData if this venue is in there
            likedVenueData: state.likedVenueData[venueId]
              ? { ...state.likedVenueData, [venueId]: venue }
              : state.likedVenueData,
          }));
        } catch (error) {
          console.error('[Store] Failed to hydrate venue:', venueId, error);
          // Don't throw - hydration is a best-effort enhancement
        }
      },

      // Derived selectors - SINGLE SOURCE OF TRUTH
      // DO NOT mutate savedVenues/likedVenueData directly - use these selectors!
      getMyLikedVenueIds: () => {
        const { voteStatsByVenueId, myParticipantId } = get();
        if (!myParticipantId) return [];

        return Object.entries(voteStatsByVenueId)
          .filter(([_, stats]) => stats.voterIds.includes(myParticipantId))
          .map(([venueId]) => venueId);
      },

      getAllVotedVenues: () => {
        const { venueById, voteStatsByVenueId } = get();

        return Object.keys(voteStatsByVenueId)
          .map((venueId) => {
            const venue = venueById[venueId];
            const stats = voteStatsByVenueId[venueId];
            if (!venue) return null;

            return {
              ...venue,
              voteCount: stats.voteCount,
            } as Venue;
          })
          .filter((v): v is Venue => v !== null);
      },

      getAllVotedVenueIdsSorted: () => {
        const { voteStatsByVenueId } = get();

        return Object.entries(voteStatsByVenueId)
          .sort(([, statsA], [, statsB]) => statsB.voteCount - statsA.voteCount)
          .map(([venueId]) => venueId);
      },

      getVenueWithStats: (venueId: string) => {
        const { venueById, voteStatsByVenueId } = get();

        const venue = venueById[venueId];
        const stats = voteStatsByVenueId[venueId];

        if (!venue) return null;

        return {
          ...venue,
          voteCount: stats?.voteCount ?? 0,
        };
      },

      // Utility actions
      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'MeetingStore',
    }
  )
);
