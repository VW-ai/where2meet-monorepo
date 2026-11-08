import { hasStartingPoint, routeKey } from '@/features/meeting/lib/person-routes';
import { tripOf, type Trip } from '@/features/meeting/lib/route-summary';
import { useMapStore, type RouteInfo } from '@/features/meeting/model/map-store';
import { useMeetingStore } from '@/features/meeting/model/meeting-store';
import { useRouteCacheStore } from '@/features/meeting/model/route-cache-store';

/**
 * Everyone's trip to one venue, in the order of the event's people. The map holds live routes only
 * for the selected venue; any other venue reads what the route cache remembers, and a trip it
 * hasn't been asked about is pending.
 */
export function useVenueTrips(venueId: string | null): Trip<RouteInfo>[] {
  const people = useMeetingStore((state) => state.currentEvent?.participants) ?? [];
  const selected = useMeetingStore((state) => !!venueId && state.selectedVenue?.id === venueId);
  const { routes, tripRequests, isCalculatingRoutes } = useMapStore();
  const entries = useRouteCacheStore((state) => state.entries);
  if (!venueId) return [];
  if (selected) {
    return people.map((person) =>
      tripOf(person, routes, isCalculatingRoutes ? 'loading' : tripRequests[person.id])
    );
  }
  return people.map((person) => {
    if (!hasStartingPoint(person)) return { status: 'no-start' };
    const lookup = entries[routeKey(venueId, person)];
    if (lookup?.status === 'found') return { status: 'found', route: lookup.route };
    return lookup?.status === 'none' ? { status: 'none' } : { status: 'pending' };
  });
}
