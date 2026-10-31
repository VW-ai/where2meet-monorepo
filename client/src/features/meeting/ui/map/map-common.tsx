/**
 * Pieces shared by the Google map and the AMap map (meetings in mainland China),
 * so both look and move the same way.
 */

import { Layers, Loader2, LocateFixed } from 'lucide-react';
import type { UITravelMode } from '@/features/meeting/model/map-store';
import type { Location, TravelMode } from '@/shared/types/map';

// Convert UI travel mode to the directions API travel mode
export const UI_TO_TRAVEL_MODE: Record<UITravelMode, TravelMode> = {
  car: 'driving',
  transit: 'transit',
  walk: 'walking',
  bike: 'bicycling',
};

// Default search radius for the initial circle
export const DEFAULT_SEARCH_RADIUS = 3000; // 3km default

/** Clamp a dragged search radius between 500m and 15km */
export function clampSearchRadius(radius: number): number {
  return Math.min(Math.max(radius, 500), 15000);
}

// Star path for liked venue markers (SVG path)
export const STAR_PATH = 'M 0,-1 0.588,0.809 -0.951,-0.309 0.951,-0.309 -0.588,0.809 Z';

// Crown path for published venue marker (SVG path)
export const CROWN_PATH =
  'M 0,-1 L 0.2,-0.5 L 0.4,-0.8 L 0.6,-0.3 L 0.8,-0.7 L 1,0 L 1,0.3 L -1,0.3 L -1,0 L -0.8,-0.7 L -0.6,-0.3 L -0.4,-0.8 L -0.2,-0.5 Z';

/**
 * Width of the panels floating over the left of the map: the sidebar, plus the
 * venue detail panel when it is open. Zero on mobile, where panels sit below.
 */
export function leftPanelsWidth(includeVenuePanel: boolean): number {
  const screenWidth = window.innerWidth;
  if (screenWidth < 768) return 0;
  const panelWidth = screenWidth >= 1280 ? 400 : screenWidth >= 1024 ? 360 : 320;
  // Venue detail panel and the gap before it (only when open)
  return includeVenuePanel ? panelWidth + 24 + panelWidth : panelWidth;
}

/**
 * Map center that shows `point` in the middle of the map area left uncovered
 * by `leftOffset` pixels of panels, at `zoom` (256px tiles at zoom 0).
 */
export function centerBesidePanels(point: Location, zoom: number, leftOffset: number): Location {
  const worldCoordPerPixel = 360 / (256 * Math.pow(2, zoom));
  return { lat: point.lat, lng: point.lng - (leftOffset / 2) * worldCoordPerPixel };
}

/** Participant dot: scale is the radius in pixels */
export function participantMarkerStyle(isSelected: boolean) {
  return {
    scale: isSelected ? 14 : 10,
    strokeWeight: isSelected ? 3 : 2,
    zIndex: isSelected ? 100 : 10,
  };
}

/** Searched venue dot: coral for selected, orange for hovered, gray for others */
export function venueMarkerStyle(isSelected: boolean, isHovered: boolean) {
  const isHighlighted = isSelected || isHovered;
  return {
    scale: isHighlighted ? 14 : 10,
    fillColor: isSelected ? '#FF6B6B' : isHovered ? '#F97316' : '#9CA3AF',
    strokeWeight: isHighlighted ? 3 : 2,
    zIndex: isSelected ? 50 : isHovered ? 40 : 5,
  };
}

/** Liked venue star, or a crown for the published venue */
export function likedVenueMarkerStyle(
  isPublished: boolean,
  isSelected: boolean,
  isHovered: boolean
) {
  const isHighlighted = isSelected || isHovered;
  return {
    path: isPublished ? CROWN_PATH : STAR_PATH,
    scale: isPublished ? 18 : isHighlighted ? 16 : 12,
    fillColor: isPublished ? '#F59E0B' : '#FFD700', // Amber for published, gold for liked
    strokeColor: isPublished ? '#B45309' : isSelected ? '#FF6B6B' : '#ffffff',
    strokeWeight: isPublished ? 3 : isHighlighted ? 3 : 2,
    zIndex: isPublished ? 70 : isSelected ? 60 : isHovered ? 55 : 30,
  };
}

export function MapUnavailable() {
  return (
    <main className="w-full h-full bg-stone-100 flex items-center justify-center">
      <div className="text-center px-8 pt-28 max-w-sm" role="status">
        <Layers className="mx-auto mb-3 text-stone-400" size={32} />
        <h3 className="font-semibold text-foreground">Map temporarily unavailable</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          You can still manage your group below. Try the map again later.
        </p>
      </div>
    </main>
  );
}

export function MapLoadError({ message }: { message: string }) {
  return (
    <main className="w-full h-full bg-gradient-to-br from-sky-50 via-coral-50/30 to-mint-50/30 relative overflow-hidden flex items-center justify-center">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="text-6xl">⚠️</div>
        <h3 className="text-xl font-semibold text-foreground">Failed to Load Map</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

export function MapLoading() {
  return (
    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-50 z-10">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 text-coral-500 animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  );
}

export function PhoneMapControls({
  satellite,
  onToggleSatellite,
  onRecenter,
}: {
  satellite: boolean;
  onToggleSatellite: () => void;
  onRecenter: () => void;
}) {
  return (
    <div className="phone-map-controls hidden max-md:flex">
      <button
        aria-label={satellite ? 'Show street map' : 'Show satellite map'}
        onClick={onToggleSatellite}
      >
        <Layers size={22} />
      </button>
      <button aria-label="Center map on meeting area" onClick={onRecenter}>
        <LocateFixed size={22} />
      </button>
    </div>
  );
}

export function RoutesCalculating() {
  return (
    <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
      <Loader2 className="w-4 h-4 text-coral-500 animate-spin" />
      <span className="text-sm text-muted-foreground">Calculating routes...</span>
    </div>
  );
}

/** Invisible circle over the search circle, for the tutorial to point at */
export function SearchCircleTutorialTarget({
  position,
}: {
  position: { x: number; y: number; radiusPixels: number };
}) {
  return (
    <div
      data-tutorial="search-circle"
      className="absolute pointer-events-none rounded-full border-2 border-transparent"
      style={{
        top: position.y,
        left: position.x,
        width: `${position.radiusPixels * 2}px`,
        height: `${position.radiusPixels * 2}px`,
        transform: 'translate(-50%, -50%)',
        zIndex: 300,
      }}
      aria-hidden="true"
    />
  );
}
