import type { Participant } from '@/entities';
import { hasStartingPoint } from '@/features/meeting/lib/person-routes';
import type { Locale } from '@/shared/lib/i18n';
import type { TravelMode } from '@/shared/types/map';

/** One person's trip to one venue. `none` is the server answering without a route for them. */
export type Trip<R> =
  | { status: 'found'; route: R }
  | { status: 'none' }
  | { status: 'failed' }
  | { status: 'pending' }
  | { status: 'no-start' };

export type TripRequest = 'loading' | 'failed';

export function tripOf<R extends { participantId: string; travelMode: TravelMode }>(
  person: Pick<Participant, 'id' | 'travelMode' | 'location'>,
  routes: readonly R[],
  request?: TripRequest
): Trip<R> {
  if (!hasStartingPoint(person)) return { status: 'no-start' };
  if (request === 'loading') return { status: 'pending' };
  const route = routes.find((candidate) => candidate.participantId === person.id);
  // A route in another mode is the old trip, still on screen while the new one is asked for
  if (route)
    return route.travelMode === person.travelMode
      ? { status: 'found', route }
      : { status: 'pending' };
  return request === 'failed' ? { status: 'failed' } : { status: 'none' };
}

/** What can honestly be said about getting the whole group there. `reached === total` is everyone. */
export function tripClaim<R extends { durationSeconds: number }>(trips: readonly Trip<R>[]) {
  if (trips.some((trip) => trip.status === 'pending')) return null;
  const routes = trips.flatMap((trip) => (trip.status === 'found' ? [trip.route] : []));
  const slowest = slowestRoute(routes);
  return slowest && { slowest, reached: routes.length, total: trips.length };
}

export function slowestRoute<T extends { durationSeconds: number }>(
  routes: readonly T[]
): T | null {
  return routes.reduce<T | null>(
    (slowest, route) =>
      !slowest || route.durationSeconds > slowest.durationSeconds ? route : slowest,
    null
  );
}

/** en `25 min`, `1 hr 5 min`; zh `25 分钟`, `1 小时 5 分钟`. Never rounds a real trip down to zero. */
export function formatTripTime(seconds: number, locale: Locale): string {
  const total = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const [hr, min] = locale === 'zh' ? ['小时', '分钟'] : ['hr', 'min'];
  if (hours === 0) return `${minutes} ${min}`;
  return minutes === 0 ? `${hours} ${hr}` : `${hours} ${hr} ${minutes} ${min}`;
}
