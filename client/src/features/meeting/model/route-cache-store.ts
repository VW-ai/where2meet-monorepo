import { create } from 'zustand';
import type { Participant } from '@/entities';
import { directionsClient } from '@/features/meeting/api';
import { routeKey, toRouteInfo } from '@/features/meeting/lib/person-routes';
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
}

export const useRouteCacheStore = create<RouteCacheState>((set, get) => ({
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
      set((state) => {
        const { [key]: _, ...entries } = state.entries;
        return { entries };
      });
    }
  },
}));
