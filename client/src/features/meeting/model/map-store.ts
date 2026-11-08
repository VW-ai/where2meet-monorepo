'use client';

import { create } from 'zustand';
import type { Circle } from '@/shared/lib/mec';
import type { TripRequest } from '@/features/meeting/lib/route-summary';
import type { TravelMode } from '@/shared/types/map';
import { useUIStore } from './ui-store';

export interface RouteInfo {
  participantId: string;
  distance: string; // e.g., "2.5 km"
  duration: string; // e.g., "8 mins"
  durationSeconds: number;
  polyline: string; // encoded polyline
  travelMode: TravelMode;
}

// UI-friendly travel mode (matches user interface)
export type UITravelMode = 'car' | 'transit' | 'walk' | 'bike';

interface MapState {
  // MEC (Minimum Enclosing Circle) - calculated from participants, read-only
  mecCircle: Circle | null;
  setMecCircle: (circle: Circle | null) => void;

  // Search Circle - user-draggable, used for venue searches
  searchCircle: Circle | null;
  setSearchCircle: (circle: Circle | null) => void;

  // Search radius
  searchRadius: number; // in meters
  setSearchRadius: (radius: number) => void;

  // Routes
  routes: RouteInfo[];
  setRoutes: (routes: RouteInfo[]) => void;
  clearRoutes: () => void;
  /** By person, for the selected venue. Someone missing here has no request outstanding. */
  tripRequests: Record<string, TripRequest>;
  markTripRequests: (ids: readonly string[], request: TripRequest | null) => void;
  /** Bumped to ask the map to fetch the failed trips again. */
  tripRetry: number;
  retryTrips: () => void;

  // Selected participant for route display
  selectedParticipantId: string | null;
  setSelectedParticipantId: (id: string | null) => void;

  // Hovered venue (for map marker highlight)
  hoveredVenueId: string | null;
  setHoveredVenueId: (id: string | null) => void;

  // Loading states
  isCalculatingRoutes: boolean;
  setCalculatingRoutes: (loading: boolean) => void;

  // Travel mode (single source of truth)
  travelMode: UITravelMode;
  setTravelMode: (mode: UITravelMode) => void;
}

export const useMapStore = create<MapState>((set) => ({
  // MEC
  mecCircle: null,
  setMecCircle: (circle) => set({ mecCircle: circle }),

  // Search Circle
  searchCircle: null,
  setSearchCircle: (circle) => set({ searchCircle: circle }),

  // Search radius (default 5km)
  searchRadius: 5000,
  setSearchRadius: (radius) => set({ searchRadius: radius }),

  // Routes
  routes: [],
  setRoutes: (routes) => set({ routes }),
  clearRoutes: () => set({ routes: [], tripRequests: {} }),
  tripRequests: {},
  markTripRequests: (ids, request) =>
    set((state) => {
      const tripRequests = { ...state.tripRequests };
      ids.forEach((id) => {
        if (request) tripRequests[id] = request;
        else delete tripRequests[id];
      });
      return { tripRequests };
    }),
  tripRetry: 0,
  retryTrips: () => set((state) => ({ tripRetry: state.tripRetry + 1 })),

  // Selected participant
  selectedParticipantId: null,
  setSelectedParticipantId: (id) => set({ selectedParticipantId: id }),

  // Hovered venue
  hoveredVenueId: null,
  setHoveredVenueId: (id) => set({ hoveredVenueId: id }),

  // Loading
  isCalculatingRoutes: false,
  setCalculatingRoutes: (loading) => set({ isCalculatingRoutes: loading }),

  // Travel mode (default: car)
  travelMode: 'car',
  setTravelMode: (mode) => {
    set({ travelMode: mode });
    // Trigger participant icon flash to indicate route recalculation
    useUIStore.getState().triggerParticipantFlash();
  },
}));
