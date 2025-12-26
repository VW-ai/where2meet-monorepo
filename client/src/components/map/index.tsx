'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMeetingStore } from '@/store/useMeetingStore';
import { useUIStore, TravelMode as UITravelMode } from '@/store/ui-store';
import { useMapStore } from '@/store/map-store';
import { Loader2 } from 'lucide-react';
import { loadGoogleMaps } from '@/lib/google-maps/loader';
import { calculateMEC, calculateSearchRadius } from '@/lib/utils/mec';
import { getHexColor } from '@/lib/utils/participant-colors';
import { api } from '@/lib/api';
import type { TravelMode } from '@/types';

// Convert UI travel mode to Google Maps travel mode
const UI_TO_GOOGLE_TRAVEL_MODE: Record<UITravelMode, TravelMode> = {
  car: 'driving',
  transit: 'transit',
  walk: 'walking',
  bike: 'bicycling',
};

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

export function MapArea() {
  const {
    currentEvent,
    selectedVenue,
    searchedVenues,
    setSelectedVenue,
    savedVenues,
    likedVenueData,
  } = useMeetingStore();
  const { isVenueInfoOpen, selectedTravelMode, openVenueInfo, organizerToken, participantToken } =
    useUIStore();
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
  } = useMapStore();

  // Convert UI travel mode to Google Maps travel mode
  const travelMode = UI_TO_GOOGLE_TRAVEL_MODE[selectedTravelMode];

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [center, setCenter] = useState(defaultCenter);

  const mapRef = useRef<HTMLDivElement>(null);
  const participantMarkersRef = useRef<google.maps.Marker[]>([]);
  const venueMarkersRef = useRef<google.maps.Marker[]>([]);
  const likedVenueMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const mecCircleRef = useRef<google.maps.Circle | null>(null);
  const searchCircleRef = useRef<google.maps.Circle | null>(null);
  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);

  // Star path for liked venue markers (SVG path)
  const STAR_PATH = 'M 0,-1 0.588,0.809 -0.951,-0.309 0.951,-0.309 -0.588,0.809 Z';

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

  // Default search radius for initial circle
  const DEFAULT_SEARCH_RADIUS = 3000; // 3km default

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
        setSearchRadius(Math.min(Math.max(newRadius, 500), 15000)); // Clamp between 500m and 15km
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
      const screenWidth = window.innerWidth;
      const isMobile = screenWidth < 768;
      const isLg = screenWidth >= 1024;
      const isXl = screenWidth >= 1280;

      // Calculate the left offset (sidebar width only, no venue detail when panning to participants)
      let leftOffset = 0;
      if (!isMobile) {
        const sidebarWidth = isXl ? 400 : isLg ? 360 : 320;
        leftOffset = sidebarWidth;
      }

      // Calculate pixel offset to center in visible area
      const pixelOffsetX = leftOffset / 2;

      // Get or set zoom level
      const targetZoom = validParticipants.length === 1 ? 14 : 13;
      const currentZoom = map.getZoom() || targetZoom;

      // Calculate the offset in world coordinates
      const scale = Math.pow(2, targetZoom);
      const worldCoordPerPixel = 360 / (256 * scale);

      // Adjust center to account for sidebar
      const adjustedLng = newCenter.lng - pixelOffsetX * worldCoordPerPixel;

      const adjustedCenter = new google.maps.LatLng(newCenter.lat, adjustedLng);

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
    console.log('[Map] Participant markers useEffect triggered. Participant count:', currentEvent?.participants?.length);
    if (!map || !window.google) return;

    // Clear existing participant markers
    participantMarkersRef.current.forEach((marker) => marker.setMap(null));
    participantMarkersRef.current = [];

    // Add participant markers with matching colors
    currentEvent?.participants.forEach((participant) => {
      console.log('[Map] Processing participant:', participant.name, 'Location:', participant.location);
      if (!participant.location || !participant.location.lat || !participant.location.lng) {
        console.log('[Map] Skipping participant - invalid location:', participant.name);
        return;
      }

      const markerColor = getHexColor(participant.color);
      const isSelected = selectedParticipantId === participant.id;

      const marker = new google.maps.Marker({
        position: {
          lat: participant.location.lat,
          lng: participant.location.lng,
        },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 14 : 10,
          fillColor: markerColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: isSelected ? 3 : 2,
        },
        title: participant.name,
        zIndex: isSelected ? 100 : 10,
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

      const isSelected = selectedVenue?.id === venue.id;
      const isHovered = hoveredVenueId === venue.id;
      const isHighlighted = isSelected || isHovered;

      const marker = new google.maps.Marker({
        position: {
          lat: venue.location.lat,
          lng: venue.location.lng,
        },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isHighlighted ? 14 : 10,
          fillColor: isSelected ? '#FF6B6B' : isHovered ? '#F97316' : '#9CA3AF', // coral for selected, orange for hovered, gray for others
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: isHighlighted ? 3 : 2,
        },
        title: venue.name,
        zIndex: isSelected ? 50 : isHovered ? 40 : 5,
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

    // Get all liked venues - prioritize likedVenueData for persistence, fallback to searchedVenues
    const allLikedVenues = savedVenues
      .map((venueId) => {
        // First check likedVenueData (persistent storage)
        if (likedVenueData[venueId]) {
          return likedVenueData[venueId];
        }
        // Fallback to current search results
        return searchedVenues.find((v) => v.id === venueId);
      })
      .filter((v): v is (typeof searchedVenues)[0] => v !== undefined);

    // Add or update markers for liked venues
    allLikedVenues.forEach((venue) => {
      const isSelected = selectedVenue?.id === venue.id;
      const isHovered = hoveredVenueId === venue.id;
      const isHighlighted = isSelected || isHovered;

      const existingMarker = likedVenueMarkersRef.current.get(venue.id);

      if (existingMarker) {
        // Update existing marker icon for selection/hover state
        existingMarker.setIcon({
          path: STAR_PATH,
          scale: isHighlighted ? 16 : 12,
          fillColor: '#FFD700', // Gold color for liked venues
          fillOpacity: 1,
          strokeColor: isSelected ? '#FF6B6B' : '#ffffff',
          strokeWeight: isHighlighted ? 3 : 2,
          rotation: 0,
        });
        existingMarker.setZIndex(isSelected ? 60 : isHovered ? 55 : 30);
      } else {
        // Create new star marker
        const marker = new google.maps.Marker({
          position: {
            lat: venue.location.lat,
            lng: venue.location.lng,
          },
          map,
          icon: {
            path: STAR_PATH,
            scale: isHighlighted ? 16 : 12,
            fillColor: '#FFD700', // Gold color for liked venues
            fillOpacity: 1,
            strokeColor: isSelected ? '#FF6B6B' : '#ffffff',
            strokeWeight: isHighlighted ? 3 : 2,
            rotation: 0,
          },
          title: `${venue.name} (Liked)`,
          zIndex: isSelected ? 60 : isHovered ? 55 : 30,
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
    likedVenueData,
    STAR_PATH,
    setSelectedVenue,
    openVenueInfo,
  ]);

  // Pan to selected participant when selection changes (from sidebar or map marker click)
  useEffect(() => {
    if (!map || !window.google || !selectedParticipantId) return;

    // Find the selected participant
    const participant = currentEvent?.participants?.find((p) => p.id === selectedParticipantId);

    if (!participant?.location || !participant.location.lat || !participant.location.lng) return;

    // Calculate offset for sidebar (and venue detail panel if open)
    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isLg = screenWidth >= 1024;
    const isXl = screenWidth >= 1280;

    let leftOffset = 0;
    if (!isMobile) {
      // Sidebar width
      const sidebarWidth = isXl ? 400 : isLg ? 360 : 320;
      // Venue detail panel width (only when open)
      const venueDetailWidth = isVenueInfoOpen ? (isXl ? 400 : isLg ? 360 : 320) : 0;
      // Gap between panels
      const gap = isVenueInfoOpen ? 24 : 0;
      leftOffset = sidebarWidth + gap + venueDetailWidth;
    }

    const pixelOffsetX = leftOffset / 2;
    const currentZoom = map.getZoom() || 14;
    const scale = Math.pow(2, currentZoom);
    const worldCoordPerPixel = 360 / (256 * scale);

    const adjustedLng = participant.location.lng - pixelOffsetX * worldCoordPerPixel;
    const adjustedCenter = new google.maps.LatLng(participant.location.lat, adjustedLng);

    map.panTo(adjustedCenter);
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
      const response = await api.directions.getDirections(
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

    const screenWidth = window.innerWidth;
    const isMobile = screenWidth < 768;
    const isLg = screenWidth >= 1024;
    const isXl = screenWidth >= 1280;

    // Calculate the left offset (sidebar + venue detail panel width)
    let leftOffset = 0;
    if (!isMobile) {
      // Sidebar width
      const sidebarWidth = isXl ? 400 : isLg ? 360 : 320;
      // Venue detail panel width (only when open)
      const venueDetailWidth = isVenueInfoOpen ? (isXl ? 400 : isLg ? 360 : 320) : 0;
      // Gap between panels
      const gap = isVenueInfoOpen ? 24 : 0;
      leftOffset = sidebarWidth + gap + venueDetailWidth;
    }

    // We want the venue to appear in the center of the visible map area
    // Calculate the pixel offset needed to shift the center
    const pixelOffsetX = leftOffset / 2;

    // Get the current zoom level
    const currentZoom = map.getZoom() || 14;

    // Calculate the offset in world coordinates
    // At zoom level 0, the world is 256 pixels wide
    // Each zoom level doubles the pixels
    const scale = Math.pow(2, currentZoom);
    const worldCoordPerPixel = 360 / (256 * scale);

    // Shift the center to the left to account for sidebar/panels
    // This puts the venue in the center of the visible area
    const adjustedLng = selectedVenue.location.lng - pixelOffsetX * worldCoordPerPixel;

    const adjustedCenter = new google.maps.LatLng(selectedVenue.location.lat, adjustedLng);

    // Use panTo for smooth animation
    map.panTo(adjustedCenter);

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
    return (
      <main className="w-full h-full bg-gradient-to-br from-sky-50 via-coral-50/30 to-mint-50/30 relative overflow-hidden flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-6xl">🗺️</div>
          <h3 className="text-xl font-semibold text-foreground">Google Maps API Key Required</h3>
          <p className="text-sm text-muted-foreground">
            Please add your Google Maps API key to the{' '}
            <code className="bg-coral-50 px-2 py-1 rounded">.env.local</code> file:
          </p>
          <pre className="text-xs bg-gray-100 p-4 rounded-lg text-left">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
          </pre>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="w-full h-full bg-gradient-to-br from-sky-50 via-coral-50/30 to-mint-50/30 relative overflow-hidden flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <div className="text-6xl">⚠️</div>
          <h3 className="text-xl font-semibold text-foreground">Failed to Load Map</h3>
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-50 z-10">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 text-coral-500 animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Route calculating overlay */}
      {isCalculatingRoutes && (
        <div className="absolute top-4 right-4 z-20 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-coral-500 animate-spin" />
          <span className="text-sm text-muted-foreground">Calculating routes...</span>
        </div>
      )}

      <div ref={mapRef} className="w-full h-full" />
    </main>
  );
}
