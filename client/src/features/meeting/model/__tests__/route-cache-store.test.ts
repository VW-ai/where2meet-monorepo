import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { directionsClient } from '@/features/meeting/api';
import { routeKey } from '@/features/meeting/lib/person-routes';
import { useRouteCacheStore } from '../route-cache-store';

const here = { lat: 40.7, lng: -74 };
const SAM = { id: 'sam', travelMode: 'driving' as const, location: here };
const MAYA = { id: 'maya', travelMode: 'driving' as const, location: here };
const lookup = () =>
  useRouteCacheStore
    .getState()
    .lookupVenue({ eventId: 'e', venueId: 'v', people: [SAM, MAYA], token: 't' });
const status = (person: typeof SAM) =>
  useRouteCacheStore.getState().entries[routeKey('v', person)]?.status;

const directionsRoute = (participantId: string) => ({
  participantId,
  participantName: participantId,
  distance: { text: '2 mi', value: 3200 },
  duration: { text: '9 mins', value: 540 },
  polyline: '',
  travelMode: 'driving' as const,
});

beforeEach(() => useRouteCacheStore.setState({ entries: {} }));
afterEach(() => vi.restoreAllMocks());

describe('lookupVenue', () => {
  it('records a person the server left out as having no route', async () => {
    vi.spyOn(directionsClient, 'getDirections').mockResolvedValue({
      routes: [directionsRoute('sam')],
    } as never);
    await lookup();
    expect(status(SAM)).toBe('found');
    expect(status(MAYA)).toBe('none');
  });

  it('forgets a failed lookup instead of recording no route', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(directionsClient, 'getDirections').mockRejectedValue(new Error('429'));
    await lookup();
    expect(status(SAM)).toBeUndefined();
    expect(status(MAYA)).toBeUndefined();
  });

  it('asks nothing when every trip is known', async () => {
    const spy = vi.spyOn(directionsClient, 'getDirections');
    useRouteCacheStore.getState().record([
      [routeKey('v', SAM), undefined],
      [routeKey('v', MAYA), undefined],
    ]);
    await lookup();
    expect(spy).not.toHaveBeenCalled();
  });
});
