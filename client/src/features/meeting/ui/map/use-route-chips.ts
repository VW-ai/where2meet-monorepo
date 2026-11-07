import { useEffect, useRef, useState } from 'react';
import { DRAFT_PERSON_ID } from '@/features/meeting/lib/add-person-form';
import { hasStartingPoint } from '@/features/meeting/lib/person-routes';
import { getMutedHexColor } from '@/features/meeting/lib/participant-colors';
import { useDraftPersonStore } from '@/features/meeting/model/draft-person-store';
import { useMapStore } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useLocale } from '@/shared/lib/i18n';
import {
  placeRouteChips,
  ROUTE_CHIP_Z_INDEX,
  routeChipImage,
  routeChipLabel,
  type PinImage,
} from './map-pins';
import { pinMarkerOptions } from './use-map-pins';

interface RouteChip {
  marker: google.maps.Marker;
  image: PinImage;
}

/** One time label per route, on the route. Zoom decides which ones fit, so it re-places them. */
export function useRouteChips(map: google.maps.Map | null, enabled: boolean) {
  const locale = useLocale();
  const participants = useMeetingStore((state) => state.currentEvent?.participants);
  const venueLocation = useMeetingStore((state) => state.selectedVenue?.location);
  const routes = useMapStore((state) => state.routes);
  const selectedId = useMapStore((state) => state.selectedParticipantId);
  const draft = useDraftPersonStore((state) => state.draft);

  const [zoom, setZoom] = useState<number>();
  const chipsRef = useRef(new Map<string, RouteChip>());

  useEffect(() => {
    if (!map || !enabled) return;
    const chips = chipsRef.current;
    const idle = map.addListener('idle', () => setZoom(map.getZoom()));
    return () => {
      idle.remove();
      chips.forEach(({ marker }) => marker.setMap(null));
      chips.clear();
    };
  }, [map, enabled]);

  useEffect(() => {
    const projection = map?.getProjection();
    if (!map || !enabled || !projection || zoom === undefined) return;
    const chips = chipsRef.current;

    const colors = new Map((participants ?? []).map((person) => [person.id, person.color]));
    const shown = venueLocation
      ? routes.filter(({ participantId }) => selectedId === null || selectedId === participantId)
      : [];
    const wanted = [
      ...shown.map((route) => ({
        id: route.participantId,
        route,
        color: colors.get(route.participantId),
      })),
      ...(draft?.route ? [{ id: DRAFT_PERSON_ID, route: draft.route, color: draft.color }] : []),
    ].map(({ id, route, color }) => {
      const label = routeChipLabel(route.durationSeconds, locale);
      return {
        id,
        label,
        path: google.maps.geometry.encoding
          .decodePath(route.polyline)
          .map((point) => point.toJSON()),
        image: routeChipImage({
          color: getMutedHexColor(color),
          mode: route.travelMode,
          label,
        }),
      };
    });

    const scale = 2 ** zoom;
    const pins = [
      ...(participants ?? []).filter(hasStartingPoint).map((person) => person.location!),
      ...(venueLocation ? [venueLocation] : []),
      ...(draft ? [draft.location] : []),
    ];
    const spots = placeRouteChips(wanted, pins, (point) => {
      const pixel = projection.fromLatLngToPoint(point)!;
      return { x: pixel.x * scale, y: pixel.y * scale };
    });

    chips.forEach(({ marker }, id) => {
      if (spots.has(id)) return;
      marker.setMap(null);
      chips.delete(id);
    });
    wanted.forEach(({ id, image }) => {
      const position = spots.get(id);
      if (!position) return;
      const chip = chips.get(id);
      if (!chip) {
        const marker = new google.maps.Marker({
          ...pinMarkerOptions(image),
          position,
          map,
          zIndex: ROUTE_CHIP_Z_INDEX,
          clickable: false,
        });
        chips.set(id, { marker, image });
        return;
      }
      chip.marker.setPosition(position);
      if (chip.image !== image) {
        chip.image = image;
        chip.marker.setOptions(pinMarkerOptions(image));
      }
    });
  }, [map, enabled, zoom, participants, venueLocation, routes, selectedId, draft, locale]);
}
