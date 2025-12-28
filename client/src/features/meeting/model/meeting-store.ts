/**
 * Meeting Store
 *
 * Manages event-related state for the current meeting:
 * - Event metadata (title, meetingTime, publishedAt, etc.)
 * - Venue data (search results, venue details)
 * - Map state (center location)
 * - UI state (active section, selected venue)
 *
 * NOTE: This store has been refactored for separation of concerns:
 * - Participant management → participant-store
 * - Vote management → voting-store
 * - Authentication/tokens → auth-store
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Event, Venue } from '@/entities';
import { Location } from '@/shared/types/map';
import { ActiveSection } from '@/shared/types/api';
import { venueClient } from '@/features/meeting/api';

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

  // ============================================================================
  // Venue State
  // ============================================================================
  venueById: Record<string, Venue>; // Full venue data keyed by venue ID
  searchedVenues: Venue[]; // Venues from current search results
  hydratingVenueIds: Set<string>; // Track in-flight venue hydrations to prevent duplicates

  // ============================================================================
  // Map State
  // ============================================================================
  mapCenter: Location | null;

  // ============================================================================
  // Event Actions
  // ============================================================================
  setCurrentEvent: (event: Event) => void;
  updateEvent: (updates: Partial<Event>) => void;
  setLoadingEvent: (loading: boolean) => void;
  setEventError: (error: string | null) => void;

  // ============================================================================
  // UI Actions
  // ============================================================================
  setActiveSection: (section: ActiveSection) => void;
  setSelectedVenue: (venue: Venue | null) => void;

  // ============================================================================
  // Map Actions
  // ============================================================================
  setMapCenter: (center: Location | null) => void;

  // ============================================================================
  // Venue Actions
  // ============================================================================
  setSearchedVenues: (venues: Venue[]) => void;
  hydrateVenue: (venueId: string) => Promise<void>; // Fetch missing venue details from API

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

  // Venue state
  venueById: {} as Record<string, Venue>,
  searchedVenues: [] as Venue[],
  hydratingVenueIds: new Set() as Set<string>,

  // Map state
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

      // UI actions
      setActiveSection: (section) => {
        set({ activeSection: section });
      },

      setSelectedVenue: (venue) => {
        set({ selectedVenue: venue });
      },

      // Map actions
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

      hydrateVenue: async (venueId: string) => {
        // Check if already hydrated or currently hydrating
        const { venueById, hydratingVenueIds } = get();
        const existingVenue = venueById[venueId];

        if (existingVenue && existingVenue.name !== 'Unknown Venue') {
          console.log('[MeetingStore] Venue already hydrated:', venueId);
          return; // Already hydrated
        }

        if (hydratingVenueIds.has(venueId)) {
          console.log('[MeetingStore] Already hydrating:', venueId);
          return; // In-flight, skip
        }

        console.log('[MeetingStore] Hydrating venue details for:', venueId);

        // Mark as hydrating
        set((state) => ({
          hydratingVenueIds: new Set(state.hydratingVenueIds).add(venueId),
        }));

        try {
          // Fetch full venue details from backend
          const venue = await venueClient.get(venueId);

          console.log('[MeetingStore] Venue hydrated successfully:', venue.name);

          // Update venueById with full details
          set((state) => ({
            venueById: {
              ...state.venueById,
              [venueId]: venue,
            },
          }));
        } catch (error) {
          console.error('[MeetingStore] Failed to hydrate venue:', venueId, error);
          // Don't throw - hydration is a best-effort enhancement
        } finally {
          // Remove from in-flight tracking
          set((state) => {
            const newSet = new Set(state.hydratingVenueIds);
            newSet.delete(venueId);
            return { hydratingVenueIds: newSet };
          });
        }
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
