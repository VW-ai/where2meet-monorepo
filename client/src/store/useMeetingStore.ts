/**
 * Meeting Store
 *
 * Zustand store for managing global application state
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Event, Participant, Venue, TravelMode, Location, ActiveSection } from '@/types';

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
  voteForVenue: (venueId: string, venue?: Venue) => void;
  unvoteForVenue: (venueId: string) => void;
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

  // Map state
  searchRadius: 5000, // 5km default
  travelMode: 'driving' as TravelMode,
  mapCenter: null,
};

export const useMeetingStore = create<MeetingState>()(
  devtools(
    (set) => ({
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

      voteForVenue: (venueId, venue) =>
        set((state) => {
          // Voting automatically saves the venue
          const newSavedVenues = state.savedVenues.includes(venueId)
            ? state.savedVenues
            : [...state.savedVenues, venueId];

          // Store venue data if provided
          const newLikedVenueData = venue
            ? { ...state.likedVenueData, [venueId]: venue }
            : state.likedVenueData;

          return {
            userVotes: {
              ...state.userVotes,
              [venueId]: true,
            },
            savedVenues: newSavedVenues,
            likedVenueData: newLikedVenueData,
          };
        }),

      unvoteForVenue: (venueId) =>
        set((state) => {
          const newVotes = { ...state.userVotes };
          delete newVotes[venueId];

          // Unvoting removes from saved venues and liked data
          const newLikedVenueData = { ...state.likedVenueData };
          delete newLikedVenueData[venueId];

          return {
            userVotes: newVotes,
            savedVenues: state.savedVenues.filter((id) => id !== venueId),
            likedVenueData: newLikedVenueData,
          };
        }),

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
