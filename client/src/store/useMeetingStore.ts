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
  // Venue State
  // ============================================================================
  savedVenues: string[]; // Array of saved venue IDs
  likedVenueData: Record<string, Venue>; // Full venue data for liked venues (for persistent markers)
  userVotes: Record<string, boolean>; // Map of venueId -> voted status
  searchedVenues: Venue[]; // Venues from current search results
  voteStatistics: VoteStatisticsResponse | null; // Vote statistics from backend
  isLoadingVotes: boolean; // Loading state for vote operations

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
  saveVenue: (venueId: string, venue?: Venue) => void;
  unsaveVenue: (venueId: string) => void;

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

  // Venue state
  savedVenues: [] as string[],
  likedVenueData: {} as Record<string, Venue>,
  userVotes: {} as Record<string, boolean>,
  searchedVenues: [] as Venue[],
  voteStatistics: null,
  isLoadingVotes: false,

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
      setSearchedVenues: (venues) => set({ searchedVenues: venues }),

      voteForVenue: async (venueId, venue) => {
        const { currentEvent } = get();
        const { organizerToken, participantToken, currentParticipantId, organizerParticipantId } =
          useUIStore.getState();

        // Determine which participant ID to use (organizer's ID takes precedence)
        const participantId = organizerParticipantId || currentParticipantId;
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

        // Optimistic update - immediately update UI
        set((state) => {
          const newSavedVenues = state.savedVenues.includes(venueId)
            ? state.savedVenues
            : [...state.savedVenues, venueId];

          return {
            userVotes: {
              ...state.userVotes,
              [venueId]: true,
            },
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

          // Reload statistics to get updated counts
          await get().loadVoteStatistics();
        } catch (error) {
          console.error('Failed to vote:', error);
          // Revert optimistic update on error
          set((state) => {
            const { [venueId]: removed, ...remainingVotes } = state.userVotes;
            return {
              userVotes: remainingVotes,
              savedVenues: state.savedVenues.filter((id) => id !== venueId),
            };
          });
          throw error; // Re-throw so components can handle it
        }
      },

      unvoteForVenue: async (venueId) => {
        const { currentEvent } = get();
        const { organizerToken, participantToken, currentParticipantId, organizerParticipantId } =
          useUIStore.getState();

        // Determine which participant ID to use (organizer's ID takes precedence)
        const participantId = organizerParticipantId || currentParticipantId;
        const token = organizerToken || participantToken;

        if (!currentEvent || !participantId || !token) {
          console.error('Cannot unvote: Missing required data');
          return;
        }

        // Optimistic update - immediately update UI
        const previousUserVotes = get().userVotes;
        const previousSavedVenues = get().savedVenues;
        const previousLikedVenueData = get().likedVenueData;

        set((state) => {
          const newVotes = { ...state.userVotes };
          delete newVotes[venueId];

          const newLikedVenueData = { ...state.likedVenueData };
          delete newLikedVenueData[venueId];

          return {
            userVotes: newVotes,
            savedVenues: state.savedVenues.filter((id) => id !== venueId),
            likedVenueData: newLikedVenueData,
          };
        });

        try {
          // Call backend API - both IDs now in URL path, no body
          await api.votes.removeVote(currentEvent.id, participantId, venueId, token);

          // Reload statistics to get updated counts
          await get().loadVoteStatistics();
        } catch (error) {
          console.error('Failed to remove vote:', error);
          // Revert optimistic update on error
          set({
            userVotes: previousUserVotes,
            savedVenues: previousSavedVenues,
            likedVenueData: previousLikedVenueData,
          });
          throw error; // Re-throw so components can handle it
        }
      },

      loadVoteStatistics: async () => {
        const { currentEvent } = get();
        if (!currentEvent) {
          console.error('Cannot load vote statistics: No current event');
          return;
        }

        set({ isLoadingVotes: true });
        try {
          const statistics = await api.votes.getStatistics(currentEvent.id);

          // Hydrate userVotes from backend voters data
          // Use same participant ID determination as voting actions
          const { currentParticipantId, organizerParticipantId } = useUIStore.getState();
          const participantId = organizerParticipantId || currentParticipantId;
          const hydratedUserVotes: Record<string, boolean> = {};

          if (participantId) {
            statistics.venues.forEach((venue) => {
              if (venue.voters.includes(participantId)) {
                hydratedUserVotes[venue.id] = true;
              }
            });
          }

          // HYDRATE SAVED VENUES AND LIKED VENUE DATA
          // Reconstruct savedVenues and likedVenueData from backend vote statistics
          // When user votes for a venue, it's also added to savedVenues/likedVenueData
          // After refresh, we need to restore this from the backend
          const hydratedSavedVenues: string[] = [];
          const hydratedLikedVenueData: Record<string, Venue> = {};

          if (participantId) {
            statistics.venues.forEach((venueStats) => {
              if (venueStats.voters.includes(participantId)) {
                // User voted for this venue - add to saved venues
                hydratedSavedVenues.push(venueStats.id);

                // Convert VenueWithVotes to Venue format for likedVenueData
                hydratedLikedVenueData[venueStats.id] = {
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
                  voteCount: venueStats.voteCount,
                };
              }
            });
          }

          // Merge vote counts back into searchedVenues
          const { searchedVenues } = get();

          const updatedSearchedVenues = searchedVenues.map((venue) => {
            const stats = statistics.venues.find((v) => v.id === venue.id);
            if (stats) {
              return { ...venue, voteCount: stats.voteCount, votes: undefined };
            }
            return venue;
          });

          // Update likedVenueData with fresh vote counts
          Object.keys(hydratedLikedVenueData).forEach((venueId) => {
            const stats = statistics.venues.find((v) => v.id === venueId);
            if (stats) {
              hydratedLikedVenueData[venueId] = {
                ...hydratedLikedVenueData[venueId],
                voteCount: stats.voteCount,
              };
            }
          });

          set({
            voteStatistics: statistics,
            userVotes: hydratedUserVotes,
            savedVenues: hydratedSavedVenues,
            likedVenueData: hydratedLikedVenueData,
            searchedVenues: updatedSearchedVenues,
          });
        } catch (error) {
          console.error('Failed to load vote statistics:', error);
          // Don't throw - statistics loading should fail silently
        } finally {
          set({ isLoadingVotes: false });
        }
      },

      saveVenue: (venueId, venue) =>
        set((state) => {
          if (state.savedVenues.includes(venueId)) {
            return state;
          }

          // Store venue data if provided
          const newLikedVenueData = venue
            ? { ...state.likedVenueData, [venueId]: venue }
            : state.likedVenueData;

          return {
            savedVenues: [...state.savedVenues, venueId],
            likedVenueData: newLikedVenueData,
          };
        }),

      unsaveVenue: (venueId) =>
        set((state) => {
          const newLikedVenueData = { ...state.likedVenueData };
          delete newLikedVenueData[venueId];

          return {
            savedVenues: state.savedVenues.filter((id) => id !== venueId),
            likedVenueData: newLikedVenueData,
          };
        }),

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
