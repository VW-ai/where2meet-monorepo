import { create } from 'zustand';
import type { Participant } from '@/entities';
import { directionsClient } from '@/features/meeting/api';
import { hasStartingPoint, routeKey, toRouteInfo } from '@/features/meeting/lib/person-routes';
import type { TravelMode } from '@/shared/types/map';
import type { RouteInfo } from './map-store';

export type RouteLookup =
  | { status: 'loading' }
  | { status: 'found'; route: RouteInfo }
  | { status: 'none' };

interface RouteCacheState {
  /** By `routeKey`, so a move or a new venue simply misses. Lasts as long as the page. */
  entries: Record<string, RouteLookup>;
  record: (results: ReadonlyArray<readonly [key: string, route: RouteInfo | undefined]>) => void;
  /** Looks up one person's trip in one mode, at most once. A failed call can be tried again. */
  compare: (request: {
    eventId: string;
    venueId: string;
    person: Pick<Participant, 'id' | 'travelMode' | 'location'>;
    mode: TravelMode;
    token: string;
  }) => Promise<void>;
  /** Looks up everyone's trip to one venue in the mode they have, for whoever isn't known yet. */
  lookupVenue: (request: {
    eventId: string;
    venueId: string;
    people: ReadonlyArray<Pick<Participant, 'id' | 'travelMode' | 'location'>>;
    token: string;
  }) => Promise<void>;
}

export const useRouteCacheStore = create<RouteCacheState>((set, get) => {
  const forget = (keys: readonly string[]) =>
    set((state) => ({
      entries: Object.fromEntries(
        Object.entries(state.entries).filter(([key]) => !keys.includes(key))
      ),
    }));
  return {
    entries: {},
    record: (results) =>
      set((state) => ({
        entries: {
          ...state.entries,
          ...Object.fromEntries(
            results.map(([key, route]): [string, RouteLookup] => [
              key,
              route ? { status: 'found', route } : { status: 'none' },
            ])
          ),
        },
      })),
    compare: async ({ eventId, venueId, person, mode, token }) => {
      const key = routeKey(venueId, person, mode);
      if (get().entries[key]) return;
      set((state) => ({ entries: { ...state.entries, [key]: { status: 'loading' } } }));
      try {
        const { routes } = await directionsClient.getDirections(eventId, venueId, token, {
          participantId: person.id,
          travelMode: mode,
        });
        const route = routes.find((candidate) => candidate.participantId === person.id);
        get().record([[key, route && toRouteInfo(route)]]);
      } catch (error) {
        console.error('[Routes] Could not compare a travel mode:', error);
        forget([key]);
      }
    },
    lookupVenue: async ({ eventId, venueId, people, token }) => {
      const wanted = people
        .filter(hasStartingPoint)
        .map((person) => ({ person, key: routeKey(venueId, person) }))
        .filter(({ key }) => !get().entries[key]);
      if (wanted.length === 0) return;
      set((state) => ({
        entries: {
          ...state.entries,
          ...Object.fromEntries(wanted.map(({ key }) => [key, { status: 'loading' }])),
        },
      }));
      try {
        const { routes } = await directionsClient.getDirections(eventId, venueId, token);
        const answered = wanted.map(({ person, key }) => {
          const route = routes.find((candidate) => candidate.participantId === person.id);
          return { key, route, lagging: !!route && route.travelMode !== person.travelMode };
        });
        get().record(
          answered
            .filter(({ lagging }) => !lagging)
            .map(({ key, route }) => [key, route && toRouteInfo(route)])
        );
        forget(answered.filter(({ lagging }) => lagging).map(({ key }) => key));
      } catch (error) {
        console.error('[Routes] Could not look up trips to a venue:', error);
        forget(wanted.map(({ key }) => key));
      }
    },
  };
});
