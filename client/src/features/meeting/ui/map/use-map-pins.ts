import { useEffect, useRef, useState } from 'react';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useUIStore } from '@/features/meeting/model/ui-store';
import { useVotingStore } from '@/features/voting/model/voting-store';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { useDraftPersonStore } from '@/features/meeting/model/draft-person-store';
import { DRAFT_PERSON_ID } from '@/features/meeting/lib/add-person-form';
import { participantRights, viewerFromAuth } from '@/features/meeting/lib/participant-rights';
import { hasStartingPoint } from '@/features/meeting/lib/person-routes';
import { useMapStore } from '@/features/meeting/model/map-store';
import {
  phonePlan,
  usePhonePlanStore,
  usePlanMapLayers,
} from '@/features/meeting/model/phone-plan-store';
import { useLocale } from '@/shared/lib/i18n';
import type { Venue } from '@/entities/venue/types';
import type { Location } from '@/shared/types/map';
import { likedVenueMarkerTitle } from './map-common';
import { createMarkerDrops, prefersReducedMotion } from './map-motion';
import {
  personPinImage,
  personPinLook,
  personPinZIndex,
  venuePinImage,
  venuePinLook,
  venuePinZIndex,
  venuesOnMap,
  type PinImage,
} from './map-pins';

export function pinMarkerOptions(image: PinImage): google.maps.MarkerOptions {
  return {
    icon: {
      url: image.url,
      size: new google.maps.Size(image.width, image.height),
      scaledSize: new google.maps.Size(image.width, image.height),
      anchor: new google.maps.Point(image.anchorX, image.anchorY),
    },
    shape: { type: 'circle', coords: [image.hit.x, image.hit.y, image.hit.radius] },
    // Each pin is its own element: sharp on any screen, and what a spinning draft ring needs
    optimized: false,
  };
}

interface VenuePin {
  marker: google.maps.Marker;
  image: PinImage;
  venue: Venue;
}

/** One marker per venue for as long as it's on the map, whatever happens to its likes or selection. */
export function useVenuePins(map: google.maps.Map | null, enabled: boolean) {
  const locale = useLocale();
  const searched = useMeetingStore((state) => state.searchedVenues);
  const venueById = useMeetingStore((state) => state.venueById);
  const selected = useMeetingStore((state) => state.selectedVenue);
  const publishedId = useMeetingStore((state) => state.currentEvent?.publishedVenueId);
  const setSelectedVenue = useMeetingStore((state) => state.setSelectedVenue);
  const openVenueInfo = useUIStore((state) => state.openVenueInfo);
  const voteStats = useVotingStore((state) => state.voteStatsByVenueId);
  const hoveredId = useMapStore((state) => state.hoveredVenueId);
  const layers = usePlanMapLayers();
  const venueLayer = layers?.venues ?? 'all';

  const [drops] = useState(() => createMarkerDrops());
  const pinsRef = useRef(new Map<string, VenuePin>());

  useEffect(() => {
    if (!map || !enabled) return;
    const pins = pinsRef.current;
    return () => {
      drops.cancelPending();
      pins.forEach(({ marker }) => marker.setMap(null));
      pins.clear();
    };
  }, [map, enabled, drops]);

  useEffect(() => {
    if (!map || !enabled) return;
    const pins = pinsRef.current;
    const venues =
      venueLayer === 'none'
        ? []
        : venueLayer === 'selected'
          ? selected
            ? [selected]
            : []
          : venuesOnMap({
              searched,
              venueById,
              likedIds: Object.keys(voteStats),
              selected,
              publishedId,
            });

    const wanted = new Set(venues.map(({ id }) => id));
    pins.forEach(({ marker }, id) => {
      if (wanted.has(id)) return;
      drops.forget(id);
      marker.setMap(null);
      pins.delete(id);
    });

    venues.forEach((venue) => {
      const votes = voteStats[venue.id];
      const isPublished = venue.id === publishedId;
      const look = venuePinLook(venue, {
        likes: votes?.voteCount ?? 0,
        isSaved: votes !== undefined,
        isSelected: venue.id === selected?.id,
        isHovered: venue.id === hoveredId,
        isPublished,
      });
      const image = venuePinImage(look);
      const zIndex = venuePinZIndex(look);
      const title =
        votes || isPublished ? likedVenueMarkerTitle(venue.name, isPublished, locale) : venue.name;

      const pin = pins.get(venue.id);
      if (!pin) {
        const marker = new google.maps.Marker({
          ...pinMarkerOptions(image),
          position: venue.location,
          map,
          title,
          zIndex,
        });
        marker.addListener('click', () => {
          const current = pinsRef.current.get(venue.id)?.venue ?? venue;
          if (usePhonePlanStore.getState().active) {
            phonePlan.tapVenuePin(current);
            return;
          }
          setSelectedVenue(current);
          openVenueInfo(current.id);
        });
        pins.set(venue.id, { marker, image, venue });
        drops.place(venue.id, marker, !prefersReducedMotion());
        return;
      }
      pin.venue = venue;
      if (pin.marker.getTitle() !== title) pin.marker.setTitle(title);
      if (pin.image !== image) {
        pin.image = image;
        pin.marker.setOptions({ ...pinMarkerOptions(image), zIndex });
      }
    });
  }, [
    map,
    enabled,
    searched,
    venueById,
    voteStats,
    selected,
    hoveredId,
    publishedId,
    locale,
    setSelectedVenue,
    openVenueInfo,
    drops,
    venueLayer,
  ]);
}

interface PersonPin {
  marker: google.maps.Marker;
  image: PinImage;
  location: Location;
}

/** One marker per person. A chip change or a selection redraws the icon and leaves the marker alone. */
export function usePersonPins(map: google.maps.Map | null, enabled: boolean) {
  const locale = useLocale();
  const participants = useMeetingStore((state) => state.currentEvent?.participants);
  const selectedVenueId = useMeetingStore((state) => state.selectedVenue?.id);
  const organizerParticipantId = useAuthStore((state) => state.organizerParticipantId);
  const currentParticipantId = useAuthStore((state) => state.currentParticipantId);
  const routes = useMapStore((state) => state.routes);
  const selectedId = useMapStore((state) => state.selectedParticipantId);
  const draft = useDraftPersonStore((state) => state.draft);
  const layers = usePlanMapLayers();
  const inPlan = layers !== null;
  const showTrips = layers?.routes ?? true;

  const [drops] = useState(() => createMarkerDrops());
  const pinsRef = useRef(new Map<string, PersonPin>());

  useEffect(() => {
    if (!map || !enabled) return;
    const pins = pinsRef.current;
    return () => {
      drops.cancelPending();
      pins.forEach(({ marker }) => marker.setMap(null));
      pins.clear();
    };
  }, [map, enabled, drops]);

  useEffect(() => {
    if (!map || !enabled) return;
    const pins = pinsRef.current;
    const viewer = viewerFromAuth({ organizerParticipantId, currentParticipantId });

    const wanted = (participants ?? []).filter(hasStartingPoint).map((person) => {
      const route = selectedVenueId
        ? routes.find((candidate) => candidate.participantId === person.id)
        : undefined;
      const look = personPinLook(person, {
        isSelf: participantRights(viewer, person, { isPublished: false, hostName: null }).isSelf,
        isSelected: selectedId === person.id,
        tripSeconds: showTrips ? route?.durationSeconds : undefined,
        locale,
        round: inPlan,
      });
      return {
        id: person.id,
        title: person.name,
        location: person.location!,
        look,
        image: personPinImage(look),
      };
    });
    if (draft) {
      // On the map, but not in anyone's count or the routes everyone shares
      const look = personPinLook(draft, {
        isSelf: false,
        isSelected: false,
        isDraft: true,
        tripSeconds: draft.route?.durationSeconds,
        locale,
      });
      wanted.push({
        id: DRAFT_PERSON_ID,
        title: draft.name,
        location: draft.location,
        look,
        image: personPinImage(look, !prefersReducedMotion()),
      });
    }

    const wantedIds = new Set(wanted.map(({ id }) => id));
    pins.forEach(({ marker }, id) => {
      if (wantedIds.has(id)) return;
      drops.forget(id);
      marker.setMap(null);
      pins.delete(id);
    });

    wanted.forEach(({ id, title, location, look, image }) => {
      const zIndex = personPinZIndex(look);
      const pin = pins.get(id);
      if (!pin) {
        const isDraft = id === DRAFT_PERSON_ID;
        const marker = new google.maps.Marker({
          ...pinMarkerOptions(image),
          position: location,
          map,
          title,
          zIndex,
          clickable: !isDraft,
        });
        pins.set(id, { marker, image, location });
        if (isDraft) return;
        marker.addListener('click', () => {
          if (usePhonePlanStore.getState().active) {
            phonePlan.showPeople();
            return;
          }
          const { selectedParticipantId, setSelectedParticipantId } = useMapStore.getState();
          setSelectedParticipantId(selectedParticipantId === id ? null : id);
        });
        drops.place(id, marker, !prefersReducedMotion());
        return;
      }
      if (pin.location.lat !== location.lat || pin.location.lng !== location.lng) {
        pin.location = location;
        pin.marker.setPosition(location);
      }
      if (pin.marker.getTitle() !== title) pin.marker.setTitle(title);
      if (pin.image !== image) {
        pin.image = image;
        pin.marker.setOptions({ ...pinMarkerOptions(image), zIndex });
      }
    });
  }, [
    map,
    enabled,
    participants,
    selectedVenueId,
    organizerParticipantId,
    currentParticipantId,
    routes,
    selectedId,
    draft,
    locale,
    drops,
    inPlan,
    showTrips,
  ]);
}
