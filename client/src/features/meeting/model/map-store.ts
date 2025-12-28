'use client';

import { create } from 'zustand';
import type { Circle } from '@/shared/lib/mec';
import { useUIStore } from './ui-store';

export interface RouteInfo {
  participantId: string;
  distance: string; // e.g., "2.5 km"
  duration: string; // e.g., "8 mins"
  polyline: string; // encoded polyline
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
  clearRoutes: () => set({ routes: [] }),

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
