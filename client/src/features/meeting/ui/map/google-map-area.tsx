'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { loadGoogleMaps } from '@/shared/lib/google-maps/loader';
import { calculateMEC, calculateSearchRadius } from '@/shared/lib/mec';
import { getHexColor } from '@/features/meeting/lib/participant-colors';
import { directionsClient } from '@/features/meeting/api';
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

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const defaultCenter = {
  lat: 40.7128, // NYC default
  lng: -74.006,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

export function GoogleMapArea() {
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

  // Convert UI travel mode to the directions API travel mode
  const travelMode = UI_TO_TRAVEL_MODE[uiTravelMode];

  const [satellite, setSatellite] = useState(true);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [center, setCenter] = useState(defaultCenter);
  const [circleOverlayPosition, setCircleOverlayPosition] = useState<{
    x: number;
    y: number;
    radiusPixels: number;
  } | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);
  const participantMarkersRef = useRef<google.maps.Marker[]>([]);
  const venueMarkersRef = useRef<google.maps.Marker[]>([]);
  const likedVenueMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const mecCircleRef = useRef<google.maps.Circle | null>(null);
  const searchCircleRef = useRef<google.maps.Circle | null>(null);
  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current) {
        console.warn('[Map] Map container ref not ready');
        return;
      }

      try {
        setIsLoading(true);
        setLoadError(null);

        const maps = await loadGoogleMaps();

        if (!mapRef.current) {
          console.warn('[Map] Map container ref lost during initialization');
          return;
        }

        const mapInstance = new maps.Map(mapRef.current, {
          center,
          zoom: 12,
          ...mapOptions,
          ...(window.matchMedia('(max-width: 767px)').matches
            ? {
                mapTypeId: 'hybrid',
                zoomControl: false,
                fullscreenControl: false,
              }
            : {}),
        });

        setMap(mapInstance);
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load map');
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      initMap();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Tell the create-meeting transition once the map has settled on this meeting:
  // tiles loaded and no camera movement for a moment (the first view is the
  // default center, then the map pans to the participants).
  const eventIdForMap = currentEvent?.id;
  useEffect(() => {
    if (!eventIdForMap) return;
    // Without a map there is nothing to wait for.
    if (loadError || !GOOGLE_MAPS_API_KEY) {
      usePortalStore.getState().mapReady(eventIdForMap);
      return;
    }
    if (!map) return;
    let tilesLoaded = false;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        if (tilesLoaded) usePortalStore.getState().mapReady(eventIdForMap);
      }, 250);
    };
    const listeners = [
      map.addListener('tilesloaded', () => {
        tilesLoaded = true;
        settle();
      }),
      map.addListener('idle', settle),
      map.addListener('bounds_changed', () => clearTimeout(quiet)),
    ];
    return () => {
      clearTimeout(quiet);
      listeners.forEach((listener) => listener.remove());
    };
  }, [map, eventIdForMap, loadError]);

  // Initialize search circle on map load (shown from the start)
  useEffect(() => {
    if (!map || !window.google) return;

    // Only create if not already created
    if (searchCircleRef.current) return;

    // Create search radius circle (black/dark, editable) at default center
    // zIndex 200 ensures circle handles are above markers (participant: 100, venue: 50)
    // so the circle can be dragged/resized even when overlapping with markers
    searchCircleRef.current = new google.maps.Circle({
      center: defaultCenter,
      radius: DEFAULT_SEARCH_RADIUS,
      map,
      fillColor: '#1F2937', // gray-800
      fillOpacity: 0.05,
      strokeColor: '#374151', // gray-700
      strokeOpacity: 0.5,
      strokeWeight: 2,
      editable: true,
      draggable: true, // Allow dragging when no participants
      zIndex: 200,
    });

    // Set initial search radius in store
    setSearchRadius(DEFAULT_SEARCH_RADIUS);

    // Set initial search circle to default center
    setSearchCircle({
      center: defaultCenter,
      radius: DEFAULT_SEARCH_RADIUS,
    });

    // Listen for radius changes
    google.maps.event.addListener(searchCircleRef.current, 'radius_changed', () => {
      const newRadius = searchCircleRef.current?.getRadius();
      if (newRadius) {
        setSearchRadius(clampSearchRadius(newRadius));
      }
    });

    // Listen for center changes (when dragged)
    google.maps.event.addListener(searchCircleRef.current, 'center_changed', () => {
      const newCenter = searchCircleRef.current?.getCenter();
      if (newCenter) {
        setSearchCircle({
          center: { lat: newCenter.lat(), lng: newCenter.lng() },
          radius: searchCircleRef.current?.getRadius() || DEFAULT_SEARCH_RADIUS,
        });
      }
    });
  }, [map, setSearchRadius, setMecCircle, setSearchCircle]);

  // Track search circle position for tutorial overlay
  useEffect(() => {
    if (!map || !searchCircleRef.current || !window.google) return;

    const updateCircleOverlayPosition = () => {
      const center = searchCircleRef.current?.getCenter();
      const radiusMeters = searchCircleRef.current?.getRadius();
      if (!center || !radiusMeters) return;

      // Get the map's projection
      const projection = map.getProjection();
      if (!projection) return;

      // Convert lat/lng to pixel coordinates
      const bounds = map.getBounds();
      if (!bounds) return;

      // Use the built-in method to convert to pixel coordinates
      const topRight = projection.fromLatLngToPoint(bounds.getNorthEast());
      const bottomLeft = projection.fromLatLngToPoint(bounds.getSouthWest());
      const worldPoint = projection.fromLatLngToPoint(center);

      if (!topRight || !bottomLeft || !worldPoint) return;

      const scale = Math.pow(2, map.getZoom() || 0);
      const pixelOffset = new google.maps.Point(
        (worldPoint.x - bottomLeft.x) * scale,
        (worldPoint.y - topRight.y) * scale
      );

      // Convert radius from meters to pixels
      // Formula: meters per pixel = 156543.03392 * Math.cos(latRadians) / Math.pow(2, zoom)
      const zoom = map.getZoom() || 0;
      const latRadians = (center.lat() * Math.PI) / 180;
      const metersPerPixel = (156543.03392 * Math.cos(latRadians)) / Math.pow(2, zoom);
      const radiusPixels = radiusMeters / metersPerPixel;

      setCircleOverlayPosition({
        x: pixelOffset.x,
        y: pixelOffset.y,
        radiusPixels: radiusPixels,
      });
    };

    // Update position initially
    updateCircleOverlayPosition();

    // Listen to circle and map changes
    const centerListener = google.maps.event.addListener(
      searchCircleRef.current,
      'center_changed',
      updateCircleOverlayPosition
    );
    const radiusListener = google.maps.event.addListener(
      searchCircleRef.current,
      'radius_changed',
      updateCircleOverlayPosition
    );
    const zoomListener = google.maps.event.addListener(
      map,
      'zoom_changed',
      updateCircleOverlayPosition
    );
    const boundsListener = google.maps.event.addListener(
      map,
      'bounds_changed',
      updateCircleOverlayPosition
    );

    return () => {
      google.maps.event.removeListener(centerListener);
      google.maps.event.removeListener(radiusListener);
      google.maps.event.removeListener(zoomListener);
      google.maps.event.removeListener(boundsListener);
    };
  }, [map]);

  // Calculate MEC and update circles when participants change
  useEffect(() => {
    if (!map || !window.google) return;

    const validParticipants =
      currentEvent?.participants?.filter(
        (p) => p.location && p.location.lat != null && p.location.lng != null
      ) || [];

    // If no valid participants, keep the default search circle
    if (validParticipants.length === 0) {
      // Ensure search circle is draggable when no participants
      if (searchCircleRef.current) {
        searchCircleRef.current.setDraggable(true);
      }
      return;
    }

    // Calculate MEC
    const locations = validParticipants.map((p) => ({
      lat: p.location!.lat!,
      lng: p.location!.lng!,
    }));

    const mec = calculateMEC(locations);
    setMecCircle(mec);

    // Update center
    const newCenter = mec.center;
    setCenter(newCenter);

    // Calculate search radius (1.5x MEC radius, min 1km, max 10km)
    const newSearchRadius = calculateSearchRadius(mec, 1.5, 1000, 10000);
    setSearchRadius(newSearchRadius);

    // Clear existing MEC circle
    if (mecCircleRef.current) {
      mecCircleRef.current.setMap(null);
      mecCircleRef.current = null;
    }

    // Only show MEC circle if we have 2+ participants
    if (validParticipants.length >= 2) {
      // Create MEC circle (yellow, very low visibility)
      mecCircleRef.current = new google.maps.Circle({
        center: newCenter,
        radius: mec.radius,
        map,
        fillColor: '#FCD34D', // yellow-400
        fillOpacity: 0.08,
        strokeColor: '#F59E0B', // amber-500
        strokeOpacity: 0.25,
        strokeWeight: 2,
        zIndex: 1,
      });
    }

    // Update search circle position and radius (don't recreate)
    if (searchCircleRef.current) {
      searchCircleRef.current.setCenter(newCenter);
      searchCircleRef.current.setRadius(newSearchRadius);
      // Disable dragging when we have participants (circle follows MEC)
      searchCircleRef.current.setDraggable(false);

      // Also update search circle store state
      setSearchCircle({
        center: newCenter,
        radius: newSearchRadius,
      });
    }

    // Smoothly pan to MEC center with offset for sidebar
    if (map) {
      // Get or set zoom level
      const targetZoom = validParticipants.length === 1 ? 14 : 13;
      const currentZoom = map.getZoom() || targetZoom;

      // Sidebar only, no venue detail when panning to participants
      const adjustedCenter = centerBesidePanels(newCenter, targetZoom, leftPanelsWidth(false));

      // Use panTo for smooth animation
      map.panTo(adjustedCenter);

      // Adjust zoom smoothly if needed
      if (currentZoom !== targetZoom) {
        setTimeout(() => {
          map.setZoom(targetZoom);
        }, 100);
      }
    }
  }, [currentEvent?.participants, map, setMecCircle, setSearchCircle, setSearchRadius]);

  // Update participant markers
  useEffect(() => {
    console.warn(
      '[Map] Participant markers useEffect triggered. Participant count:',
      currentEvent?.participants?.length
    );
    if (!map || !window.google) return;

    // Clear existing participant markers
    participantMarkersRef.current.forEach((marker) => marker.setMap(null));
    participantMarkersRef.current = [];

    // Add participant markers with matching colors
    currentEvent?.participants.forEach((participant) => {
      console.warn(
        '[Map] Processing participant:',
        participant.name,
        'Location:',
        participant.location
      );
      if (!participant.location || !participant.location.lat || !participant.location.lng) {
        console.warn('[Map] Skipping participant - invalid location:', participant.name);
        return;
      }

      const markerColor = getHexColor(participant.color);
      const isSelected = selectedParticipantId === participant.id;
      const style = participantMarkerStyle(isSelected);

      const marker = new google.maps.Marker({
        position: {
          lat: participant.location.lat,
          lng: participant.location.lng,
        },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: style.scale,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: style.strokeWeight,
        },
        title: participant.name,
        zIndex: style.zIndex,
      });

      // Click handler to toggle participant selection (panning handled by separate useEffect)
      marker.addListener('click', () => {
        if (selectedParticipantId === participant.id) {
          setSelectedParticipantId(null);
        } else {
          setSelectedParticipantId(participant.id);
        }
      });

      participantMarkersRef.current.push(marker);
    });
  }, [map, currentEvent?.participants, selectedParticipantId, setSelectedParticipantId]);

  // Update venue markers (searched venues that are NOT liked)
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing venue markers (non-liked)
    venueMarkersRef.current.forEach((marker) => marker.setMap(null));
    venueMarkersRef.current = [];

    // Add markers for searched venues that are NOT liked
    searchedVenues.forEach((venue) => {
      // Skip if this venue is liked (it will be rendered as a star)
      if (savedVenues.includes(venue.id)) return;

      // Skip if venue has invalid location (e.g., "Unknown Venue" from incomplete SSE)
      if (!venue.location || venue.location.lat == null || venue.location.lng == null) {
        console.warn('[Map] Skipping venue with invalid location:', venue.name);
        return;
      }

      const style = venueMarkerStyle(selectedVenue?.id === venue.id, hoveredVenueId === venue.id);

      const marker = new google.maps.Marker({
        position: {
          lat: venue.location.lat,
          lng: venue.location.lng,
        },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: style.scale,
          fillColor: style.fillColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: style.strokeWeight,
        },
        title: venue.name,
        zIndex: style.zIndex,
      });

      // Click handler to select venue and open info
      marker.addListener('click', () => {
        setSelectedVenue(venue);
        openVenueInfo(venue.id);
      });

      venueMarkersRef.current.push(marker);
    });
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
    if (!map || !window.google) return;

    // Remove markers for venues that are no longer liked
    likedVenueMarkersRef.current.forEach((marker, venueId) => {
      if (!savedVenues.includes(venueId)) {
        marker.setMap(null);
        likedVenueMarkersRef.current.delete(venueId);
      }
    });

    // Get all liked venues - use venueById for details, fallback to searchedVenues
    const allLikedVenues = savedVenues
      .map((venueId) => {
        // First check venueById (persistent storage)
        if (venueById[venueId]) {
          return venueById[venueId];
        }
        // Fallback to current search results
        return searchedVenues.find((v) => v.id === venueId);
      })
      .filter((v): v is (typeof searchedVenues)[0] => v !== undefined);

    // Add or update markers for liked venues
    allLikedVenues.forEach((venue) => {
      // Skip if venue has invalid location (e.g., "Unknown Venue" from incomplete SSE)
      if (!venue.location || venue.location.lat == null || venue.location.lng == null) {
        console.warn('[Map] Skipping liked venue with invalid location:', venue.name);
        return;
      }

      const isPublished = venue.id === currentEvent?.publishedVenueId;
      const { zIndex, ...style } = likedVenueMarkerStyle(
        isPublished,
        selectedVenue?.id === venue.id,
        hoveredVenueId === venue.id
      );
      const icon = { ...style, fillOpacity: 1, rotation: 0 };

      const existingMarker = likedVenueMarkersRef.current.get(venue.id);

      if (existingMarker) {
        // Update existing marker icon for selection/hover state
        existingMarker.setIcon(icon);
        existingMarker.setZIndex(zIndex);
      } else {
        // Create new star/crown marker
        const marker = new google.maps.Marker({
          position: {
            lat: venue.location.lat,
            lng: venue.location.lng,
          },
          map,
          icon,
          title: isPublished ? `${venue.name} (Published)` : `${venue.name} (Liked)`,
          zIndex,
        });

        // Click handler
        marker.addListener('click', () => {
          setSelectedVenue(venue);
          openVenueInfo(venue.id);
        });

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
    setSelectedVenue,
    openVenueInfo,
  ]);

  // Pan to selected participant when selection changes (from sidebar or map marker click)
  useEffect(() => {
    if (!map || !window.google || !selectedParticipantId) return;

    // Find the selected participant
    const participant = currentEvent?.participants?.find((p) => p.id === selectedParticipantId);

    if (!participant?.location || !participant.location.lat || !participant.location.lng) return;

    // Offset for sidebar (and venue detail panel if open)
    map.panTo(
      centerBesidePanels(
        { lat: participant.location.lat, lng: participant.location.lng },
        map.getZoom() || 14,
        leftPanelsWidth(isVenueInfoOpen)
      )
    );
  }, [selectedParticipantId, map, currentEvent?.participants, isVenueInfoOpen]);

  // Calculate and display routes when venue is selected
  const calculateRoutes = useCallback(async () => {
    if (!map || !window.google || !selectedVenue || !currentEvent) {
      clearRoutes();
      return;
    }

    // Get auth token (prefer organizer, fallback to participant)
    const authToken = organizerToken || participantToken;
    if (!authToken) {
      console.warn('[Map] No auth token available for directions API');
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
      // Call backend directions API
      const response = await directionsClient.getDirections(
        currentEvent.id,
        selectedVenue.id,
        travelMode,
        authToken
      );

      // Clear existing polylines
      routePolylinesRef.current.forEach((polyline) => polyline.setMap(null));
      routePolylinesRef.current = [];

      // Draw route polylines and build route infos
      const routeInfos: Array<{
        participantId: string;
        distance: string;
        duration: string;
        polyline: string;
      }> = [];

      response.routes.forEach((route) => {
        const participant = validParticipants.find((p) => p.id === route.participantId);
        if (!participant) return;

        const participantColor = getHexColor(participant.color);
        const isSelected =
          selectedParticipantId === participant.id || selectedParticipantId === null;

        // Decode the encoded polyline from backend
        const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline);

        const polyline = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: participantColor,
          strokeOpacity: isSelected ? 0.9 : 0.3,
          strokeWeight: isSelected ? 5 : 3,
          map,
          zIndex: isSelected ? 20 : 5,
        });

        routePolylinesRef.current.push(polyline);

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
    setRoutes,
    setCalculatingRoutes,
  ]);

  // Trigger route calculation when venue changes
  useEffect(() => {
    if (selectedVenue) {
      calculateRoutes();
    } else {
      // Clear routes when no venue selected
      routePolylinesRef.current.forEach((polyline) => polyline.setMap(null));
      routePolylinesRef.current = [];
      clearRoutes();
    }
  }, [selectedVenue, calculateRoutes, clearRoutes]);

  // Update route visibility when selected participant changes
  useEffect(() => {
    if (!selectedVenue) return;

    routePolylinesRef.current.forEach((polyline, index) => {
      const participant = currentEvent?.participants[index];
      if (!participant) return;

      const isSelected = selectedParticipantId === participant.id || selectedParticipantId === null;
      polyline.setOptions({
        strokeOpacity: isSelected ? 0.9 : 0.3,
        strokeWeight: isSelected ? 5 : 3,
        zIndex: isSelected ? 20 : 5,
      });
    });
  }, [selectedParticipantId, currentEvent?.participants, selectedVenue]);

  // Smoothly pan to selected venue and center it in the visible area
  useEffect(() => {
    if (!map || !selectedVenue || !window.google) return;

    // Get the current zoom level
    const currentZoom = map.getZoom() || 14;

    // Show the venue in the middle of the map area beside the sidebar/panels
    map.panTo(
      centerBesidePanels(selectedVenue.location, currentZoom, leftPanelsWidth(isVenueInfoOpen))
    );

    // Optionally adjust zoom if needed (but don't exceed max zoom)
    const targetZoom = 15;
    if (currentZoom < 13 || currentZoom > 17) {
      // Smoothly transition zoom
      setTimeout(() => {
        map.setZoom(targetZoom);
      }, 100);
    }
  }, [selectedVenue, map, isVenueInfoOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      participantMarkersRef.current.forEach((marker) => marker.setMap(null));
      venueMarkersRef.current.forEach((marker) => marker.setMap(null));
      likedVenueMarkersRef.current.forEach((marker) => marker.setMap(null));
      likedVenueMarkersRef.current.clear();
      if (mecCircleRef.current) {
        mecCircleRef.current.setMap(null);
      }
      if (searchCircleRef.current) {
        searchCircleRef.current.setMap(null);
      }
      routePolylinesRef.current.forEach((polyline) => polyline.setMap(null));
    };
  }, []);

  if (!GOOGLE_MAPS_API_KEY) {
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
          map?.setMapTypeId(satellite ? 'roadmap' : 'hybrid');
          setSatellite(!satellite);
        }}
        onRecenter={() => {
          const circle = useMapStore.getState().searchCircle;
          if (circle) {
            map?.panTo(circle.center);
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
