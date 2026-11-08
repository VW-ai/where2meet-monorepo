'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useMapStore, type RouteInfo } from '@/features/meeting/model/map-store';
import { useDraftPersonStore } from '@/features/meeting/model/draft-person-store';
import { DRAFT_PERSON_ID } from '@/features/meeting/lib/add-person-form';
import { loadGoogleMaps } from '@/shared/lib/google-maps/loader';
import { calculateMEC, calculateSearchRadius } from '@/shared/lib/mec';
import { getHexColor, personColor } from '@/features/meeting/lib/participant-colors';
import { directionsClient } from '@/features/meeting/api';
import { MapBlurOverlay } from './map-blur-overlay';
import { usePortalStore } from '@/features/portal/model/portal-store';
import { useLocale } from '@/shared/lib/i18n';
import { participantPositionsKey } from '@/features/meeting/lib/participant-positions';
import {
  hasStartingPoint,
  mergeRoutes,
  personRouteKeys,
  planRouteFetch,
  toRouteInfo,
} from '@/features/meeting/lib/person-routes';
import { useRouteCacheStore } from '@/features/meeting/model/route-cache-store';
import type { TravelMode } from '@/shared/types/map';
import { useUiVersion, useUiVersionStore } from '@/features/meeting/model/ui-version-store';
import {
  usePhonePlanStore,
  usePlanMapLayers,
} from '@/features/meeting/model/phone-plan-store';
import { fitSearchArea, offsetPoint } from '@/features/meeting/lib/phone-plan';
import {
  CLASSIC_SEARCH_CIRCLE_STYLE,
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
  fitPadding,
  isInUncoveredMap,
  leftPanelsWidth,
  likedVenueMarkerStyle,
  likedVenueMarkerTitle,
  participantMarkerStyle,
  venueMarkerStyle,
} from './map-common';
import {
  createMarkerDrops,
  prefersReducedMotion,
  pulseAt,
  revealStrokes,
  routeStrokeStyle,
  type RouteLine,
  type RouteStroke,
} from './map-motion';
import { usePersonPins, useVenuePins } from './use-map-pins';
import { useRouteChips } from './use-route-chips';
import { useSearchArea } from './use-search-area';

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

interface DrawnRoute extends RouteStroke {
  participantId: string;
  polyline: google.maps.Polyline;
  durationSeconds: number;
  lineMode: RouteLine;
}

const isV2 = () => useUiVersionStore.getState().version === 'v2';
const inPhonePlan = () => usePhonePlanStore.getState().active;
const animatesMarkers = () => isV2() && !prefersReducedMotion();

/** Fits everyone with a starting point and the selected venue. False when that's a single point. */
function frameGroup(map: google.maps.Map, extra?: { lat: number; lng: number }): boolean {
  const { currentEvent: event, selectedVenue: venue } = useMeetingStore.getState();
  const points = (event?.participants ?? []).filter(hasStartingPoint).map((p) => p.location!);
  if (venue) points.push(venue.location);
  if (extra) points.push(extra);
  if (points.length < 2) return false;
  const bounds = new google.maps.LatLngBounds();
  points.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, fitPadding(useUIStore.getState().isVenueInfoOpen));
  return true;
}
const routeFocused = (participantId: string, selectedId: string | null) =>
  participantId === DRAFT_PERSON_ID || selectedId === participantId || selectedId === null;

export function GoogleMapArea() {
  const locale = useLocale();
  const version = useUiVersion();
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

  const draft = useDraftPersonStore((state) => state.draft);
  const draftLat = draft?.location.lat;
  const draftLng = draft?.location.lng;
  const draftColor = draft?.color;
  const draftRoute = draft?.route ?? null;

  // Get ALL voted venue IDs from voting-store (from any participant)
  const savedVenues = getAllVotedVenueIds();

  // Check if user has joined (organizer or participant)
  const hasJoined = isOrganizerMode || isParticipantMode;

  // Convert UI travel mode to the directions API travel mode
  const travelMode = UI_TO_TRAVEL_MODE[uiTravelMode];

  const planLayers = usePlanMapLayers();
  const inPlan = planLayers !== null;
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
  const routePolylinesRef = useRef<DrawnRoute[]>([]);
  const cancelRevealRef = useRef<(() => void) | null>(null);
  const routeRequestRef = useRef(0);
  const positionsKey = participantPositionsKey(currentEvent?.participants ?? []);
  const pannedPositionsRef = useRef<string | null>(null);
  // Under v2, the trip already asked for per person, whether or not the answer is back
  const fetchedRoutesRef = useRef<Map<string, string>>(new Map());
  const [markerDrops] = useState(() => ({
    participant: createMarkerDrops(),
    venue: createMarkerDrops(),
    liked: createMarkerDrops(),
  }));

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
          zoom: inPhonePlan() ? 14 : 12,
          ...mapOptions,
          ...(window.matchMedia('(max-width: 767px)').matches
            ? {
                mapTypeId: inPhonePlan() ? 'roadmap' : 'hybrid',
                zoomControl: false,
                fullscreenControl: false,
                scaleControl: !inPhonePlan(),
                gestureHandling: inPhonePlan() ? 'greedy' : undefined,
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
    searchCircleRef.current = new google.maps.Circle({
      center: defaultCenter,
      radius: DEFAULT_SEARCH_RADIUS,
      map,
      ...CLASSIC_SEARCH_CIRCLE_STYLE,
      draggable: true, // Allow dragging when no participants
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
      if (searchCircleRef.current && !isV2()) {
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
    const planned = inPhonePlan() ? fitSearchArea(locations) : null;
    const newSearchRadius = planned?.radius ?? calculateSearchRadius(mec, 1.5, 1000, 10000);
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
        visible: !isV2(),
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
      if (!isV2()) searchCircleRef.current.setDraggable(false);

      // Also update search circle store state
      setSearchCircle({
        center: newCenter,
        radius: newSearchRadius,
      });
    }

    // Publishing refreshes the event without moving anyone, and must not pull the map off the venue
    const positionsMoved = pannedPositionsRef.current !== positionsKey;
    pannedPositionsRef.current = positionsKey;

    if (map && positionsMoved && isV2() && validParticipants.length >= 2) {
      // Someone new must land in view, and the group can be wider than a fixed zoom shows
      frameGroup(map);
    } else if (map && (positionsMoved || !isV2())) {
      // Smoothly pan to MEC center with offset for sidebar
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
  }, [
    currentEvent?.participants,
    positionsKey,
    map,
    setMecCircle,
    setSearchCircle,
    setSearchRadius,
  ]);

  // Update participant markers
  useEffect(() => {
    console.warn(
      '[Map] Participant markers useEffect triggered. Participant count:',
      currentEvent?.participants?.length
    );
    if (!map || !window.google) return;

    // Clear existing participant markers
    markerDrops.participant.cancelPending();
    participantMarkersRef.current.forEach((marker) => marker.setMap(null));
    participantMarkersRef.current = [];
    if (version === 'v2') return;

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
      markerDrops.participant.place(participant.id, marker, animatesMarkers());
    });
  }, [
    map,
    version,
    currentEvent?.participants,
    selectedParticipantId,
    setSelectedParticipantId,
    markerDrops,
  ]);

  // Update venue markers (searched venues that are NOT liked)
  useEffect(() => {
    if (!map || !window.google) return;

    // Clear existing venue markers (non-liked)
    markerDrops.venue.cancelPending();
    venueMarkersRef.current.forEach((marker) => marker.setMap(null));
    venueMarkersRef.current = [];
    if (version === 'v2') return;

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
      markerDrops.venue.place(venue.id, marker, animatesMarkers());
    });
  }, [
    map,
    version,
    searchedVenues,
    selectedVenue,
    hoveredVenueId,
    savedVenues,
    setSelectedVenue,
    openVenueInfo,
    markerDrops,
  ]);

  // Update liked venue markers (star markers that persist across searches)
  useEffect(() => {
    if (!map || !window.google) return;

    // Remove markers for venues that are no longer liked
    likedVenueMarkersRef.current.forEach((marker, venueId) => {
      if (version === 'v2' || !savedVenues.includes(venueId)) {
        markerDrops.liked.forget(venueId);
        marker.setMap(null);
        likedVenueMarkersRef.current.delete(venueId);
      }
    });

    if (version === 'v2') return;

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
          title: likedVenueMarkerTitle(venue.name, isPublished, locale),
          zIndex,
        });

        // Click handler
        marker.addListener('click', () => {
          setSelectedVenue(venue);
          openVenueInfo(venue.id);
        });

        likedVenueMarkersRef.current.set(venue.id, marker);
        markerDrops.liked.place(venue.id, marker, animatesMarkers());
      }
    });
  }, [
    map,
    version,
    searchedVenues,
    selectedVenue,
    hoveredVenueId,
    savedVenues,
    venueById,
    voteStatsByVenueId,
    setSelectedVenue,
    openVenueInfo,
    locale,
    markerDrops,
  ]);

  useSearchArea(map, searchCircleRef, mecCircleRef, version === 'v2' && (planLayers?.circle ?? true));
  useVenuePins(map, version === 'v2');
  usePersonPins(map, version === 'v2');
  useRouteChips(map, version === 'v2' && !inPlan);

  const circleShown = planLayers?.circle ?? true;
  useEffect(() => {
    searchCircleRef.current?.setVisible(circleShown);
  }, [map, circleShown]);

  const routesShown = planLayers?.routes ?? true;
  useEffect(() => {
    routePolylinesRef.current.forEach(({ polyline }) => polyline.setVisible(routesShown));
  }, [routesShown]);

  useEffect(() => {
    if (!map || !inPlan) return;
    map.setMapTypeId(usePhonePlanStore.getState().satellite ? 'hybrid' : 'roadmap');
    usePhonePlanStore.setState({
      api: {
        center: () => map.getCenter()?.toJSON() ?? null,
        zoom: () => map.getZoom() ?? 14,
        panTo: (point) => map.panTo(point),
        frame: (points) => {
          const circle = usePhonePlanStore.getState().section === 'places'
            ? searchCircleRef.current?.getBounds()
            : null;
          const bounds = new google.maps.LatLngBounds();
          points.forEach((point) => bounds.extend(point));
          if (circle) bounds.union(circle);
          if (!bounds.isEmpty()) map.fitBounds(bounds, fitPadding(false));
        },
        setSatellite: (on) => map.setMapTypeId(on ? 'hybrid' : 'roadmap'),
        setSearchArea: (center, radius) => {
          searchCircleRef.current?.setCenter(center);
          searchCircleRef.current?.setRadius(radius);
          const circle = searchCircleRef.current?.getBounds();
          if (circle) map.fitBounds(circle, fitPadding(false));
        },
        onIdle: (listener) => {
          const handle = map.addListener('idle', listener);
          return () => handle.remove();
        },
      },
    });
    return () => usePhonePlanStore.setState({ api: null });
  }, [map, inPlan]);

  // Under v2 a refreshed event, a changed travel mode above all, must not move the map
  const selectedSpot = currentEvent?.participants?.find((p) => p.id === selectedParticipantId);
  const panSelectedOn =
    version === 'v2'
      ? `${selectedSpot?.location?.lat},${selectedSpot?.location?.lng}`
      : currentEvent?.participants;

  // Pan to selected participant when selection changes (from sidebar or map marker click)
  useEffect(() => {
    if (!map || !window.google || !selectedParticipantId) return;

    // Find the selected participant
    const participant = currentEvent?.participants?.find((p) => p.id === selectedParticipantId);

    if (!participant?.location || !participant.location.lat || !participant.location.lng) return;

    // A pin the viewer can already see stays put, so opening a row doesn't undo the group's framing
    if (
      version === 'v2' &&
      isInUncoveredMap(
        participant.location,
        map.getBounds(),
        map.getDiv(),
        fitPadding(isVenueInfoOpen)
      )
    ) {
      return;
    }

    // Offset for sidebar (and venue detail panel if open)
    map.panTo(
      centerBesidePanels(
        { lat: participant.location.lat, lng: participant.location.lng },
        map.getZoom() || 14,
        leftPanelsWidth(isVenueInfoOpen)
      )
    );
  }, [selectedParticipantId, map, panSelectedOn, isVenueInfoOpen]);

  const clearRouteDrawings = useCallback(() => {
    cancelRevealRef.current?.();
    cancelRevealRef.current = null;
    routePolylinesRef.current.forEach(({ polyline }) => polyline.setMap(null));
    routePolylinesRef.current = [];
  }, []);

  const removeRouteDrawing = useCallback((participantId: string) => {
    routePolylinesRef.current = routePolylinesRef.current.filter((route) => {
      if (route.participantId !== participantId) return true;
      route.polyline.setMap(null);
      return false;
    });
  }, []);

  const revealRoutes = useCallback((routes: DrawnRoute[]) => {
    if (prefersReducedMotion()) return;
    const cancelEarlier = cancelRevealRef.current;
    // Someone else's reveal may still be playing, and only this person's line should start over
    const cancelThese = revealStrokes(routes);
    cancelRevealRef.current = () => {
      cancelEarlier?.();
      cancelThese();
    };
  }, []);

  const drawRouteLine = useCallback(
    (route: RouteInfo, color: string): DrawnRoute => {
      const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline);
      const style = routeStrokeStyle(
        route.travelMode,
        routeFocused(route.participantId, useMapStore.getState().selectedParticipantId)
      );
      const drawn: DrawnRoute = {
        participantId: route.participantId,
        polyline: new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: color,
          map,
          visible: !inPhonePlan() || usePhonePlanStore.getState().section === 'places' || !!useMeetingStore.getState().currentEvent?.publishedAt,
          ...style,
        }),
        path: decodedPath.map((point) => point.toJSON()),
        color,
        icons: style.icons,
        durationSeconds: route.durationSeconds,
        lineMode: route.travelMode,
      };
      routePolylinesRef.current.push(drawn);
      return drawn;
    },
    [map]
  );

  const resetRoutes = useCallback(() => {
    // Whatever is on its way is for a venue, viewer or version that no longer applies
    routeRequestRef.current++;
    fetchedRoutesRef.current = new Map();
    clearRouteDrawings();
    clearRoutes();
    setCalculatingRoutes(false);
  }, [clearRouteDrawings, clearRoutes, setCalculatingRoutes]);

  // Classic: one global mode for everyone, with a full refetch whenever anything changes
  const calculateClassicRoutes = useCallback(async () => {
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

    const validParticipants = currentEvent.participants.filter(hasStartingPoint);

    if (validParticipants.length === 0) {
      clearRoutes();
      return;
    }

    setCalculatingRoutes(true);
    const request = ++routeRequestRef.current;

    try {
      // Call backend directions API
      const response = await directionsClient.getDirections(
        currentEvent.id,
        selectedVenue.id,
        authToken,
        { travelMode }
      );

      // A switch to v2 while this was on its way must not draw over v2's routes
      if (request !== routeRequestRef.current) return;

      // Clear existing polylines
      clearRouteDrawings();

      const routeInfos: RouteInfo[] = [];

      response.routes.forEach((route) => {
        const participant = validParticipants.find((p) => p.id === route.participantId);
        if (!participant) return;

        // Decode the encoded polyline from backend
        const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline);

        const polyline = new google.maps.Polyline({
          path: decodedPath,
          geodesic: true,
          strokeColor: personColor(participant.color),
          map,
          ...routeStrokeStyle('solid', routeFocused(participant.id, selectedParticipantId)),
        });

        routePolylinesRef.current.push({
          participantId: participant.id,
          polyline,
          path: decodedPath.map((point) => point.toJSON()),
          color: personColor(participant.color),
          durationSeconds: route.duration.value,
          lineMode: 'solid',
        });

        routeInfos.push(toRouteInfo(route));
      });

      setRoutes(routeInfos);
    } catch (error) {
      console.error('[Map] Error calculating routes:', error);
      if (request === routeRequestRef.current) clearRoutes();
    } finally {
      if (request === routeRequestRef.current) setCalculatingRoutes(false);
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
    clearRouteDrawings,
  ]);

  // v2: each person's line is their own, and only a person whose trip changed is touched
  const syncPersonRoutes = useCallback(async () => {
    const authToken = organizerToken || participantToken;
    if (!map || !window.google || !selectedVenue || !currentEvent || !authToken) {
      resetRoutes();
      return;
    }
    const venueId = selectedVenue.id;
    const eventId = currentEvent.id;
    const peopleById = new Map(currentEvent.participants.map((p) => [p.id, p]));

    const wanted = personRouteKeys(venueId, currentEvent.participants);
    const { changed, gone, everyone } = planRouteFetch(fetchedRoutesRef.current, wanted);
    if (changed.length === 0 && gone.length === 0) return;
    fetchedRoutesRef.current = new Map(wanted);

    const putRoutes = (ids: string[], fresh: RouteInfo[]) => {
      useMapStore.getState().setRoutes(mergeRoutes(useMapStore.getState().routes, ids, fresh));
    };
    const stillWanted = (id: string) => fetchedRoutesRef.current.get(id) === wanted.get(id);

    const { markTripRequests } = useMapStore.getState();
    gone.forEach(removeRouteDrawing);
    if (gone.length > 0) {
      putRoutes(gone, []);
      markTripRequests(gone, null);
    }

    const draw = (ids: string[], routes: RouteInfo[]) => {
      const current = ids.filter(stillWanted);
      if (current.length === 0) return;
      const fresh = routes.filter((route) => current.includes(route.participantId));
      current.forEach(removeRouteDrawing);
      putRoutes(current, fresh);
      revealRoutes(
        fresh.map((route) =>
          drawRouteLine(route, personColor(peopleById.get(route.participantId)?.color ?? ''))
        )
      );
    };

    const modeOf = (id: string) => peopleById.get(id)?.travelMode;
    // The mode goes along because a change being saved hasn't reached the server yet
    const fetchOne = (id: string) =>
      fetchRoutes([id], { participantId: id, travelMode: modeOf(id) });
    const fetchRoutes = async (
      ids: string[],
      options: { participantId?: string; travelMode?: TravelMode }
    ): Promise<void> => {
      markTripRequests(ids, 'loading');
      try {
        const response = await directionsClient.getDirections(eventId, venueId, authToken, options);
        const routes = response.routes.map(toRouteInfo);
        // With no override the server uses the mode it has, which can lag a change still being
        // saved. Those trips are for a different key: ask again for the mode that's wanted.
        const lagging = routes.filter((route) => route.travelMode !== modeOf(route.participantId));
        useRouteCacheStore
          .getState()
          .record(
            ids
              .filter((id) => !lagging.some((route) => route.participantId === id))
              .map((id) => [wanted.get(id)!, routes.find((route) => route.participantId === id)])
          );
        markTripRequests(ids.filter(stillWanted), null);
        draw(ids, routes);
        lagging.forEach((route) => {
          if (stillWanted(route.participantId)) void fetchOne(route.participantId);
        });
      } catch (error) {
        console.error('[Map] Error calculating routes:', error);
        const current = ids.filter(stillWanted);
        current.forEach((id) => {
          fetchedRoutesRef.current.delete(id);
          removeRouteDrawing(id);
        });
        putRoutes(current, []);
        markTripRequests(current, 'failed');
      }
    };

    if (everyone) {
      setCalculatingRoutes(true);
      const request = ++routeRequestRef.current;
      await fetchRoutes(changed, {});
      if (request === routeRequestRef.current) setCalculatingRoutes(false);
      return;
    }

    // A trip the picker already compared needs no call
    const lookups = useRouteCacheStore.getState().entries;
    const known = changed.flatMap((id) => {
      const lookup = lookups[wanted.get(id)!];
      return lookup?.status === 'found' ? [lookup.route] : [];
    });
    if (known.length > 0) {
      draw(
        known.map((route) => route.participantId),
        known
      );
    }
    await Promise.all(
      changed
        .filter((id) => !known.some((route) => route.participantId === id))
        .map((id) => fetchOne(id))
    );
  }, [
    map,
    selectedVenue,
    currentEvent,
    organizerToken,
    participantToken,
    resetRoutes,
    setCalculatingRoutes,
    removeRouteDrawing,
    revealRoutes,
    drawRouteLine,
  ]);

  // Each version's routes are its own: switching drops what's drawn, and the other kind fetches
  const drawnVersionRef = useRef(version);
  useEffect(() => {
    if (drawnVersionRef.current === version) return;
    drawnVersionRef.current = version;
    resetRoutes();
  }, [version, resetRoutes]);

  const calculateRoutes = version === 'v2' ? syncPersonRoutes : calculateClassicRoutes;

  const tripRetry = useMapStore((state) => state.tripRetry);
  // Trigger route calculation when venue changes, or when someone asks to try failed trips again
  useEffect(() => {
    if (selectedVenue) {
      calculateRoutes();
    } else {
      resetRoutes();
    }
  }, [selectedVenue, calculateRoutes, resetRoutes, tripRetry]);

  // Update route visibility when selected participant changes
  useEffect(() => {
    if (!selectedVenue) return;

    routePolylinesRef.current.forEach((route, index) => {
      // Classic pairs polylines with participants by position, which drifts when a route is skipped
      const ownerId =
        version === 'v2' ? route.participantId : currentEvent?.participants[index]?.id;
      if (!ownerId) return;

      const isSelected = routeFocused(ownerId, selectedParticipantId);
      const style = routeStrokeStyle(route.lineMode, isSelected);
      route.icons = style.icons;
      route.polyline.setOptions(style);
    });
  }, [selectedParticipantId, currentEvent?.participants, selectedVenue, version]);

  const selectedVenueId = selectedVenue?.id;
  const selectedVenueLocation = selectedVenue?.location;
  useEffect(() => {
    if (!map || !window.google || !selectedVenueLocation || version !== 'v2') return;
    if (prefersReducedMotion()) return;
    return pulseAt(map, selectedVenueLocation);
  }, [map, selectedVenueId, version]);

  useEffect(() => {
    if (!map || !window.google || !draftRoute) return;
    revealRoutes([drawRouteLine(draftRoute, personColor(draftColor))]);
    return () => removeRouteDrawing(DRAFT_PERSON_ID);
  }, [map, draftRoute, draftColor, drawRouteLine, revealRoutes, removeRouteDrawing]);

  // The new place may be off-screen. Only a new place moves the map, with everyone left in view.
  useEffect(() => {
    if (!map || !window.google || draftLat == null || draftLng == null) return;
    const pin = { lat: draftLat, lng: draftLng };
    if (!frameGroup(map, pin)) {
      const venueOpen = useUIStore.getState().isVenueInfoOpen;
      map.panTo(centerBesidePanels(pin, map.getZoom() || 14, leftPanelsWidth(venueOpen)));
    }
  }, [map, draftLat, draftLng]);

  // Smoothly pan to selected venue and center it in the visible area
  useEffect(() => {
    if (!map || !selectedVenue || !window.google) return;

    // Get the current zoom level
    const currentZoom = map.getZoom() || 14;

    if (isV2()) {
      // Picking a place keeps the group's framing: a zoom change would throw everyone off-screen
      if (
        !isInUncoveredMap(
          selectedVenue.location,
          map.getBounds(),
          map.getDiv(),
          fitPadding(isVenueInfoOpen)
        )
      ) {
        if (inPhonePlan()) {
          const { top, bottom } = fitPadding(false);
          map.panTo(offsetPoint(selectedVenue.location, currentZoom, 0, (bottom - top) / 2));
          return;
        }
        map.panTo(
          centerBesidePanels(selectedVenue.location, currentZoom, leftPanelsWidth(isVenueInfoOpen))
        );
      }
      return;
    }

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
      markerDrops.participant.cancelPending();
      markerDrops.venue.cancelPending();
      markerDrops.liked.cancelPending();
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
      clearRouteDrawings();
    };
  }, [markerDrops, clearRouteDrawings]);

  if (!GOOGLE_MAPS_API_KEY) {
    return <MapUnavailable />;
  }

  if (loadError) {
    return <MapLoadError message={loadError} />;
  }

  return (
    <main className="w-full h-full relative">
      {isLoading && <MapLoading />}

      {!inPlan && <PhoneMapControls
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
      />}

      {/* Route calculating overlay */}
      {isCalculatingRoutes && !inPlan && <RoutesCalculating />}

      {/* Map container - MUST be relative for absolute overlay positioning */}
      <div className="relative w-full h-full">
        <div ref={mapRef} id="map" className="w-full h-full" />

        {/* Tutorial overlay marker for search circle */}
        {circleOverlayPosition && <SearchCircleTutorialTarget position={circleOverlayPosition} />}

        {/* Blur overlay for non-participants - only show after auth initialization */}
        {isAuthInitialized && !hasJoined && !inPlan && (
          <MapBlurOverlay isPublished={!!currentEvent?.publishedAt} />
        )}
      </div>
    </main>
  );
}
