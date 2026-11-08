import type { Participant } from '@/entities';
import type { DirectionsRoute } from '@/features/meeting/api';
import type { RouteInfo } from '@/features/meeting/model/map-store';
import type { TravelMode } from '@/shared/types/map';

type RoutePerson = Pick<Participant, 'id' | 'travelMode' | 'location'>;

/** Everything a trip depends on. Two trips with the same key are the same trip. */
export function routeKey(
  venueId: string,
  person: RoutePerson,
  mode: TravelMode = person.travelMode
): string {
  return `${venueId}|${person.id}|${mode}|${person.location?.lat ?? ''},${person.location?.lng ?? ''}`;
}

export function hasStartingPoint({ location }: Pick<Participant, 'location'>): boolean {
  return location != null && location.lat != null && location.lng != null;
}

/** The trip each person should have on the map right now, by person. */
export function personRouteKeys(
  venueId: string,
  participants: readonly RoutePerson[]
): Map<string, string> {
  return new Map(
    participants.filter(hasStartingPoint).map((person) => [person.id, routeKey(venueId, person)])
  );
}

/**
 * What it takes to get from the trips already asked for to the ones wanted.
 * `everyone` means one request with no override does it, as when a new venue changes every key.
 */
export function planRouteFetch(
  fetched: ReadonlyMap<string, string>,
  wanted: ReadonlyMap<string, string>
) {
  const changed = [...wanted.keys()].filter((id) => fetched.get(id) !== wanted.get(id));
  return {
    changed,
    gone: [...fetched.keys()].filter((id) => !wanted.has(id)),
    everyone: changed.length > 0 && changed.length === wanted.size,
  };
}

/** The routes with these people's taken out and any new ones of theirs put in. */
export function mergeRoutes(
  current: readonly RouteInfo[],
  replacedIds: readonly string[],
  fresh: readonly RouteInfo[]
): RouteInfo[] {
  return [...current.filter((route) => !replacedIds.includes(route.participantId)), ...fresh];
}

export function toRouteInfo(route: DirectionsRoute): RouteInfo {
  return {
    participantId: route.participantId,
    distance: route.distance.text,
    duration: route.duration.text,
    durationSeconds: route.duration.value,
    polyline: route.polyline,
    travelMode: route.travelMode,
  };
}
