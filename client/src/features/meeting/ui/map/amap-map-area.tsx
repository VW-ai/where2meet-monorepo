'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { hasAmapKey, loadAmap } from '@/shared/lib/amap/loader';
import { gcj02ToWgs84, wgs84ToGcj02 } from '@/shared/lib/geo/coords';
import { decodePolyline } from '@/shared/lib/geo/polyline';
import { calculateMEC, calculateSearchRadius } from '@/shared/lib/mec';
import { getHexColor } from '@/features/meeting/lib/participant-colors';
import { directionsClient } from '@/features/meeting/api';
import type { Location } from '@/shared/types/map';
import { MapBlurOverlay } from './map-blur-overlay';
import { usePortalStore } from '@/features/portal/model/portal-store';
import {
  DEFAULT_SEARCH_RADIUS,
  MapLoadError,
  MapLoading,
  MapUnavailable,
  PhoneMapControls,
  RoutesCalculating,
  SearchCircleTutorialTarget,
  UI_TO_TRAVEL_MODE,
  centerBesidePanels,
  clampSearchRadius,
  leftPanelsWidth,
  likedVenueMarkerStyle,
  participantMarkerStyle,
  venueMarkerStyle,
} from './map-common';

/**
 * The meeting map for events in mainland China, drawn with AMap (Gaode).
 *
 * It mirrors the Google map (google-map-area.tsx) feature for feature. The app
 * keeps every coordinate in WGS-84; AMap draws in GCJ-02, so points are
 * converted on the way onto the map (toAmap) and back off it (fromAmap).
 */

// Beijing, until participants add where they start from (WGS-84)
const defaultCenter = {
  lat: 39.9042,
  lng: 116.4074,
};

/** WGS-84 point to an AMap position */
function toAmap(point: Location): [number, number] {
  const gcj = wgs84ToGcj02(point);
  return [gcj.lng, gcj.lat];
}

/** AMap position to a WGS-84 point */
function fromAmap(position: AMap.LngLat): Location {
  return gcj02ToWgs84({ lat: position.lat, lng: position.lng });
}

/** A round marker like Google's SymbolPath.CIRCLE, where scale is the radius */
function dotContent(scale: number, fillColor: string, strokeWeight: number): string {
  const size = scale * 2;
  return `<div style="width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${fillColor};border:${strokeWeight}px solid #ffffff"></div>`;
}

/** A star or crown marker from the same SVG path the Google map uses */
function shapeContent(style: ReturnType<typeof likedVenueMarkerStyle>): string {
  const pad = style.strokeWeight / style.scale;
  const extent = 2 + 2 * pad;
  const size = extent * style.scale;
  return `<svg width="${size}" height="${size}" viewBox="${-1 - pad} ${-1 - pad} ${extent} ${extent}" style="display:block"><path d="${style.path}" fill="${style.fillColor}" stroke="${style.strokeColor}" stroke-width="${style.strokeWeight}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

export function AmapMapArea() {
  const { currentEvent, selectedVenue, searchedVenues, setSelectedVenue, venueById } =
    useMeetingStore();
  const { getAllVotedVenueIds, voteStatsByVenueId } = useVotingStore();
  const { isVenueInfoOpen, openVenueInfo } = useUIStore();
  const {
    organizerToken,
    participantToken,
    isOrganizerMode,
    isParticipantMode,
    isAuthInitialized,
  } = useAuthStore();
  const {
    setMecCircle,
    setSearchCircle,
    setSearchRadius,
    setRoutes,
    clearRoutes,
    selectedParticipantId,
    setSelectedParticipantId,
    hoveredVenueId,
    isCalculatingRoutes,
    setCalculatingRoutes,
    travelMode: uiTravelMode,
  } = useMapStore();

  // Get ALL voted venue IDs from voting-store (from any participant)
  const savedVenues = getAllVotedVenueIds();

  // Check if user has joined (organizer or participant)
  const hasJoined = isOrganizerMode || isParticipantMode;

  const travelMode = UI_TO_TRAVEL_MODE[uiTravelMode];

  const [satellite, setSatellite] = useState(true);
  const [map, setMap] = useState<AMap.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [circleOverlayPosition, setCircleOverlayPosition] = useState<{
    x: number;
    y: number;
    radiusPixels: number;
  } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const tilesLoadedRef = useRef(false);
  const satelliteLayersRef = useRef<AMap.TileLayer[]>([]);
  const participantMarkersRef = useRef<AMap.Marker[]>([]);
  const venueMarkersRef = useRef<AMap.Marker[]>([]);
  const likedVenueMarkersRef = useRef<Map<string, AMap.Marker>>(new Map());
  const mecCircleRef = useRef<AMap.Circle | null>(null);
  const searchCircleRef = useRef<AMap.Circle | null>(null);
  const circleEditorRef = useRef<AMap.CircleEditor | null>(null);
  const routePolylinesRef = useRef<{ participantId: string; polyline: AMap.Polyline }[]>([]);

  // Initialize map
  useEffect(() => {
    if (!hasAmapKey()) return;
    let cancelled = false;
    let instance: AMap.Map | null = null;

    loadAmap()
      .then((amap) => {
        if (cancelled || !mapRef.current) return;

        instance = new amap.Map(mapRef.current, {
          center: toAmap(defaultCenter),
          zoom: 12,
          // No place labels, like the Google map's style
          features: ['bg', 'road', 'building'],
        });
        instance.on('complete', () => {
          tilesLoadedRef.current = true;
        });

        // Satellite with road names on top, like Google's hybrid view
        satelliteLayersRef.current = [new amap.TileLayer.Satellite(), new amap.TileLayer.RoadNet()];
        if (window.matchMedia('(max-width: 767px)').matches) {
          instance.add(satelliteLayersRef.current);
        } else {
          instance.addControl(new amap.ToolBar({ position: 'RB' }));
          instance.addControl(new amap.Scale({ position: 'LB' }));
        }

        setMap(instance);
      })
      .catch((error) => {
        console.error('Failed to load Amap:', error);
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Failed to load map');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      // Destroying the map removes every marker, circle and route on it
      instance?.destroy();
    };
  }, []);

  // Tell the create-meeting transition once the map has settled on this meeting:
  // tiles loaded and no camera movement for a moment.
  const eventIdForMap = currentEvent?.id;
  useEffect(() => {
    if (!eventIdForMap) return;
    // Without a map there is nothing to wait for.
    if (loadError || !hasAmapKey()) {
      usePortalStore.getState().mapReady(eventIdForMap);
      return;
    }
    if (!map) return;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        if (tilesLoadedRef.current) usePortalStore.getState().mapReady(eventIdForMap);
      }, 250);
    };
    const moving = () => clearTimeout(quiet);
    map.on('complete', settle);
    map.on('moveend', settle);
    map.on('zoomend', settle);
    map.on('mapmove', moving);
    // The tiles may have finished before this effect ran
    if (tilesLoadedRef.current) settle();
    return () => {
      clearTimeout(quiet);
      map.off('complete', settle);
      map.off('moveend', settle);
      map.off('zoomend', settle);
      map.off('mapmove', moving);
    };
  }, [map, eventIdForMap, loadError]);

  // Initialize search circle on map load (shown from the start)
  useEffect(() => {
    if (!map) return;

    // Only create if not already created
    if (searchCircleRef.current) return;

    // Search radius circle (black/dark), resized and moved with the circle editor's handles
    const circle = new AMap.Circle({
      center: toAmap(defaultCenter),
      radius: DEFAULT_SEARCH_RADIUS,
      fillColor: '#1F2937', // gray-800
      fillOpacity: 0.05,
      strokeColor: '#374151', // gray-700
      strokeOpacity: 0.5,
      strokeWeight: 2,
      zIndex: 20,
    });
    map.add(circle);
    searchCircleRef.current = circle;

    const editor = new AMap.CircleEditor(map, circle);
    editor.open();
    circleEditorRef.current = editor;

    // Set initial search radius in store
    setSearchRadius(DEFAULT_SEARCH_RADIUS);

    // Set initial search circle to default center
    setSearchCircle({
      center: defaultCenter,
      radius: DEFAULT_SEARCH_RADIUS,
    });

    // Radius handle dragged
    editor.on('adjust', () => {
      setSearchRadius(clampSearchRadius(circle.getRadius()));
    });

    // Center handle dragged
    editor.on('move', () => {
      setSearchCircle({
        center: fromAmap(circle.getCenter()),
        radius: circle.getRadius() || DEFAULT_SEARCH_RADIUS,
      });
    });
  }, [map, setSearchRadius, setSearchCircle]);

  // Track search circle position for tutorial overlay
  useEffect(() => {
    if (!map || !searchCircleRef.current || !circleEditorRef.current) return;
    const circle = searchCircleRef.current;
    const editor = circleEditorRef.current;

    const updateCircleOverlayPosition = () => {
      const center = circle.getCenter();
      const pixel = map.lngLatToContainer(center);
      setCircleOverlayPosition({
        x: pixel.getX(),
        y: pixel.getY(),
        // getResolution is meters per pixel at that point
        radiusPixels: circle.getRadius() / map.getResolution(center),
      });
    };

    updateCircleOverlayPosition();

    map.on('mapmove', updateCircleOverlayPosition);
    map.on('zoomchange', updateCircleOverlayPosition);
    map.on('resize', updateCircleOverlayPosition);
    map.on('moveend', updateCircleOverlayPosition);
    editor.on('adjust', updateCircleOverlayPosition);
    editor.on('move', updateCircleOverlayPosition);

    return () => {
      map.off('mapmove', updateCircleOverlayPosition);
      map.off('zoomchange', updateCircleOverlayPosition);
      map.off('resize', updateCircleOverlayPosition);
      map.off('moveend', updateCircleOverlayPosition);
      editor.off('adjust', updateCircleOverlayPosition);
      editor.off('move', updateCircleOverlayPosition);
    };
  }, [map]);

  // Calculate MEC and update circles when participants change
  useEffect(() => {
    if (!map) return;

    const validParticipants =
      currentEvent?.participants?.filter(
        (p) => p.location && p.location.lat != null && p.location.lng != null
      ) || [];

    // If no valid participants, keep the default search circle
    if (validParticipants.length === 0) return;

    // Calculate MEC
    const locations = validParticipants.map((p) => ({
      lat: p.location!.lat!,
      lng: p.location!.lng!,
    }));

    const mec = calculateMEC(locations);
    setMecCircle(mec);

    const newCenter = mec.center;

    // Calculate search radius (1.5x MEC radius, min 1km, max 10km)
    const newSearchRadius = calculateSearchRadius(mec, 1.5, 1000, 10000);
    setSearchRadius(newSearchRadius);

    // Clear existing MEC circle
    if (mecCircleRef.current) {
      map.remove(mecCircleRef.current);
      mecCircleRef.current = null;
    }

    // Only show MEC circle if we have 2+ participants
    if (validParticipants.length >= 2) {
      // MEC circle (yellow, very low visibility)
      mecCircleRef.current = new AMap.Circle({
        center: toAmap(newCenter),
        radius: mec.radius,
        fillColor: '#FCD34D', // yellow-400
        fillOpacity: 0.08,
        strokeColor: '#F59E0B', // amber-500
        strokeOpacity: 0.25,
        strokeWeight: 2,
        zIndex: 1,
        bubble: true, // Let clicks reach the map
      });
      map.add(mecCircleRef.current);
    }

    // Update search circle position and radius (don't recreate)
    if (searchCircleRef.current) {
      searchCircleRef.current.setCenter(toAmap(newCenter));
      searchCircleRef.current.setRadius(newSearchRadius);
      // Reopen the editor so its handles move with the circle
      circleEditorRef.current?.close();
      circleEditorRef.current?.open();

      // Also update search circle store state
      setSearchCircle({
        center: newCenter,
        radius: newSearchRadius,
      });
    }

    // Smoothly pan to MEC center with offset for sidebar
    const targetZoom = validParticipants.length === 1 ? 14 : 13;
    const currentZoom = map.getZoom() || targetZoom;

    // Sidebar only, no venue detail when panning to participants
    map.panTo(toAmap(centerBesidePanels(newCenter, targetZoom, leftPanelsWidth(false))));

    // Adjust zoom smoothly if needed
    if (currentZoom !== targetZoom) {
      setTimeout(() => {
        map.setZoom(targetZoom);
      }, 100);
    }
  }, [currentEvent?.participants, map, setMecCircle, setSearchCircle, setSearchRadius]);

  // Update participant markers
  useEffect(() => {
    if (!map) return;

    // Clear existing participant markers
    map.remove(participantMarkersRef.current);
    participantMarkersRef.current = [];

    // Add participant markers with matching colors
    currentEvent?.participants.forEach((participant) => {
      if (!participant.location || !participant.location.lat || !participant.location.lng) {
        return;
      }

      const style = participantMarkerStyle(selectedParticipantId === participant.id);

      const marker = new AMap.Marker({
        position: toAmap({ lat: participant.location.lat, lng: participant.location.lng }),
        content: dotContent(style.scale, getHexColor(participant.color), style.strokeWeight),
        anchor: 'center',
        title: participant.name,
        zIndex: style.zIndex,
      });

      // Click handler to toggle participant selection (panning handled by separate useEffect)
      marker.on('click', () => {
        setSelectedParticipantId(selectedParticipantId === participant.id ? null : participant.id);
      });

      participantMarkersRef.current.push(marker);
    });
    map.add(participantMarkersRef.current);
  }, [map, currentEvent?.participants, selectedParticipantId, setSelectedParticipantId]);

  // Update venue markers (searched venues that are NOT liked)
  useEffect(() => {
    if (!map) return;

    // Clear existing venue markers (non-liked)
    map.remove(venueMarkersRef.current);
    venueMarkersRef.current = [];

    // Add markers for searched venues that are NOT liked
    searchedVenues.forEach((venue) => {
      // Skip if this venue is liked (it will be rendered as a star)
      if (savedVenues.includes(venue.id)) return;

      // Skip if venue has invalid location (e.g., "Unknown Venue" from incomplete SSE)
      if (!venue.location || venue.location.lat == null || venue.location.lng == null) return;

      const style = venueMarkerStyle(selectedVenue?.id === venue.id, hoveredVenueId === venue.id);

      const marker = new AMap.Marker({
        position: toAmap(venue.location),
        content: dotContent(style.scale, style.fillColor, style.strokeWeight),
        anchor: 'center',
        title: venue.name,
        zIndex: style.zIndex,
      });

      // Click handler to select venue and open info
      marker.on('click', () => {
        setSelectedVenue(venue);
        openVenueInfo(venue.id);
      });

      venueMarkersRef.current.push(marker);
    });
    map.add(venueMarkersRef.current);
  }, [
    map,
    searchedVenues,
    selectedVenue,
    hoveredVenueId,
    savedVenues,
    setSelectedVenue,
    openVenueInfo,
  ]);

  // Update liked venue markers (star markers that persist across searches)
  useEffect(() => {
    if (!map) return;

    // Remove markers for venues that are no longer liked
    likedVenueMarkersRef.current.forEach((marker, venueId) => {
      if (!savedVenues.includes(venueId)) {
        map.remove(marker);
        likedVenueMarkersRef.current.delete(venueId);
      }
    });

    // Get all liked venues - use venueById for details, fallback to searchedVenues
    const allLikedVenues = savedVenues
      .map((venueId) => venueById[venueId] ?? searchedVenues.find((v) => v.id === venueId))
      .filter((v): v is (typeof searchedVenues)[0] => v !== undefined);

    allLikedVenues.forEach((venue) => {
      // Skip if venue has invalid location (e.g., "Unknown Venue" from incomplete SSE)
      if (!venue.location || venue.location.lat == null || venue.location.lng == null) return;

      const isPublished = venue.id === currentEvent?.publishedVenueId;
      const style = likedVenueMarkerStyle(
        isPublished,
        selectedVenue?.id === venue.id,
        hoveredVenueId === venue.id
      );

      const existingMarker = likedVenueMarkersRef.current.get(venue.id);

      if (existingMarker) {
        // Update existing marker for selection/hover state
        existingMarker.setContent(shapeContent(style));
        existingMarker.setzIndex(style.zIndex);
      } else {
        // Create new star/crown marker
        const marker = new AMap.Marker({
          position: toAmap(venue.location),
          content: shapeContent(style),
          anchor: 'center',
          title: isPublished ? `${venue.name} (Published)` : `${venue.name} (Liked)`,
          zIndex: style.zIndex,
        });

        marker.on('click', () => {
          setSelectedVenue(venue);
          openVenueInfo(venue.id);
        });

        map.add(marker);
        likedVenueMarkersRef.current.set(venue.id, marker);
      }
    });
  }, [
    map,
    searchedVenues,
    selectedVenue,
    hoveredVenueId,
    savedVenues,
    venueById,
    voteStatsByVenueId,
    currentEvent?.publishedVenueId,
    setSelectedVenue,
    openVenueInfo,
  ]);

  // Pan to selected participant when selection changes (from sidebar or map marker click)
  useEffect(() => {
    if (!map || !selectedParticipantId) return;

    const participant = currentEvent?.participants?.find((p) => p.id === selectedParticipantId);
    if (!participant?.location || !participant.location.lat || !participant.location.lng) return;

    // Offset for sidebar (and venue detail panel if open)
    map.panTo(
      toAmap(
        centerBesidePanels(
          { lat: participant.location.lat, lng: participant.location.lng },
          map.getZoom() || 14,
          leftPanelsWidth(isVenueInfoOpen)
        )
      )
    );
  }, [selectedParticipantId, map, currentEvent?.participants, isVenueInfoOpen]);

  const removeRoutes = useCallback(() => {
    if (map) map.remove(routePolylinesRef.current.map(({ polyline }) => polyline));
    routePolylinesRef.current = [];
  }, [map]);

  // Calculate and display routes when venue is selected
  const calculateRoutes = useCallback(async () => {
    if (!map || !selectedVenue || !currentEvent) {
      clearRoutes();
      return;
    }

    // Get auth token (prefer organizer, fallback to participant)
    const authToken = organizerToken || participantToken;
    if (!authToken) {
      clearRoutes();
      return;
    }

    const validParticipants = currentEvent.participants.filter(
      (p) => p.location !== null && p.location.lat !== null && p.location.lng !== null
    );

    if (validParticipants.length === 0) {
      clearRoutes();
      return;
    }

    setCalculatingRoutes(true);

    try {
      const response = await directionsClient.getDirections(
        currentEvent.id,
        selectedVenue.id,
        travelMode,
        authToken
      );

      removeRoutes();

      const routeInfos: Array<{
        participantId: string;
        distance: string;
        duration: string;
        polyline: string;
      }> = [];

      response.routes.forEach((route) => {
        const participant = validParticipants.find((p) => p.id === route.participantId);
        // AMap has no routes for participants outside mainland China
        if (!participant || !route.polyline) return;

        const isSelected =
          selectedParticipantId === participant.id || selectedParticipantId === null;

        // The backend encodes WGS-84 points in Google's polyline format for both providers
        const polyline = new AMap.Polyline({
          path: decodePolyline(route.polyline).map(toAmap),
          strokeColor: getHexColor(participant.color),
          strokeOpacity: isSelected ? 0.9 : 0.3,
          strokeWeight: isSelected ? 5 : 3,
          zIndex: isSelected ? 20 : 5,
          bubble: true,
        });
        map.add(polyline);
        routePolylinesRef.current.push({ participantId: participant.id, polyline });

        routeInfos.push({
          participantId: route.participantId,
          distance: route.distance.text,
          duration: route.duration.text,
          polyline: route.polyline,
        });
      });

      setRoutes(routeInfos);
    } catch (error) {
      console.error('[Map] Error calculating routes:', error);
      clearRoutes();
    } finally {
      setCalculatingRoutes(false);
    }
  }, [
    map,
    selectedVenue,
    currentEvent,
    travelMode,
    selectedParticipantId,
    organizerToken,
    participantToken,
    clearRoutes,
    removeRoutes,
    setRoutes,
    setCalculatingRoutes,
  ]);

  // Trigger route calculation when venue changes
  useEffect(() => {
    if (selectedVenue) {
      calculateRoutes();
    } else {
      // Clear routes when no venue selected
      removeRoutes();
      clearRoutes();
    }
  }, [selectedVenue, calculateRoutes, clearRoutes, removeRoutes]);

  // Update route visibility when selected participant changes
  useEffect(() => {
    if (!selectedVenue) return;

    routePolylinesRef.current.forEach(({ participantId, polyline }) => {
      const isSelected = selectedParticipantId === participantId || selectedParticipantId === null;
      polyline.setOptions({
        strokeOpacity: isSelected ? 0.9 : 0.3,
        strokeWeight: isSelected ? 5 : 3,
        zIndex: isSelected ? 20 : 5,
      });
    });
  }, [selectedParticipantId, selectedVenue]);

  // Smoothly pan to selected venue and center it in the visible area
  useEffect(() => {
    if (!map || !selectedVenue) return;

    const currentZoom = map.getZoom() || 14;

    // Show the venue in the middle of the map area beside the sidebar/panels
    map.panTo(
      toAmap(
        centerBesidePanels(selectedVenue.location, currentZoom, leftPanelsWidth(isVenueInfoOpen))
      )
    );

    // Optionally adjust zoom if needed (but don't exceed max zoom)
    if (currentZoom < 13 || currentZoom > 17) {
      setTimeout(() => {
        map.setZoom(15);
      }, 100);
    }
  }, [selectedVenue, map, isVenueInfoOpen]);

  if (!hasAmapKey()) {
    return <MapUnavailable />;
  }

  if (loadError) {
    return <MapLoadError message={loadError} />;
  }

  return (
    <main className="w-full h-full relative">
      {isLoading && <MapLoading />}

      <PhoneMapControls
        satellite={satellite}
        onToggleSatellite={() => {
          if (satellite) {
            map?.remove(satelliteLayersRef.current);
          } else {
            map?.add(satelliteLayersRef.current);
          }
          setSatellite(!satellite);
        }}
        onRecenter={() => {
          const circle = useMapStore.getState().searchCircle;
          if (circle) {
            map?.panTo(toAmap(circle.center));
            map?.setZoom(13);
          }
        }}
      />

      {/* Route calculating overlay */}
      {isCalculatingRoutes && <RoutesCalculating />}

      {/* Map container - MUST be relative for absolute overlay positioning */}
      <div className="relative w-full h-full">
        <div ref={mapRef} id="map" className="w-full h-full" />

        {/* Tutorial overlay marker for search circle */}
        {circleOverlayPosition && <SearchCircleTutorialTarget position={circleOverlayPosition} />}

        {/* Blur overlay for non-participants - only show after auth initialization */}
        {isAuthInitialized && !hasJoined && (
          <MapBlurOverlay isPublished={!!currentEvent?.publishedAt} />
        )}
      </div>
    </main>
  );
}
