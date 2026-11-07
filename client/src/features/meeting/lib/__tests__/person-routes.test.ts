import { describe, expect, it } from 'vitest';
import type { RouteInfo } from '@/features/meeting/model/map-store';
import type { TravelMode } from '@/shared/types/map';
import { mergeRoutes, personRouteKeys, planRouteFetch, routeKey } from '../person-routes';

const person = (id: string, travelMode: TravelMode = 'driving', lat: number | null = 1) => ({
  id,
  travelMode,
  location: lat === null ? null : { lat, lng: 2 },
});

const route = (participantId: string) => ({ participantId }) as RouteInfo;

describe('routeKey', () => {
  it('changes with the venue, the mode and the position', () => {
    const base = routeKey('v', person('a'));
    expect(routeKey('w', person('a'))).not.toBe(base);
    expect(routeKey('v', person('a', 'transit'))).not.toBe(base);
    expect(routeKey('v', person('a', 'driving', 5))).not.toBe(base);
  });

  it('names the same trip when asked for a mode someone is already on', () => {
    expect(routeKey('v', person('a', 'transit'), 'transit')).toBe(
      routeKey('v', person('a', 'transit'))
    );
  });
});

describe('personRouteKeys', () => {
  it('leaves out people with no starting point', () => {
    expect([...personRouteKeys('v', [person('a'), person('b', 'driving', null)]).keys()]).toEqual([
      'a',
    ]);
  });
});

describe('planRouteFetch', () => {
  const keys = (venue: string, ...people: ReturnType<typeof person>[]) =>
    personRouteKeys(venue, people);
  const before = keys('v', person('a'), person('b'), person('c'));

  it('fetches nobody when an event refresh changes nothing', () => {
    expect(planRouteFetch(before, keys('v', person('a'), person('b'), person('c')))).toEqual({
      changed: [],
      gone: [],
      everyone: false,
    });
  });

  it('fetches only the person whose mode changed', () => {
    const next = keys('v', person('a'), person('b', 'transit'), person('c'));
    expect(planRouteFetch(before, next)).toEqual({ changed: ['b'], gone: [], everyone: false });
  });

  it('fetches only the person who moved', () => {
    const next = keys('v', person('a', 'driving', 9), person('b'), person('c'));
    expect(planRouteFetch(before, next).changed).toEqual(['a']);
  });

  it('fetches only the new person when someone joins', () => {
    const next = keys('v', person('a'), person('b'), person('c'), person('d'));
    expect(planRouteFetch(before, next)).toEqual({ changed: ['d'], gone: [], everyone: false });
  });

  it('fetches everyone in one go for a new venue', () => {
    const next = keys('w', person('a'), person('b'), person('c'));
    expect(planRouteFetch(before, next)).toEqual({
      changed: ['a', 'b', 'c'],
      gone: [],
      everyone: true,
    });
  });

  it('fetches everyone when nothing has been fetched yet', () => {
    expect(planRouteFetch(new Map(), before).everyone).toBe(true);
  });

  it('drops someone who left, without fetching', () => {
    expect(planRouteFetch(before, keys('v', person('a'), person('b')))).toEqual({
      changed: [],
      gone: ['c'],
      everyone: false,
    });
  });

  it('drops someone whose starting point was cleared', () => {
    const next = keys('v', person('a'), person('b'), person('c', 'driving', null));
    expect(planRouteFetch(before, next).gone).toEqual(['c']);
  });

  it('never counts an empty plan as everyone', () => {
    expect(planRouteFetch(new Map(), new Map()).everyone).toBe(false);
  });
});

describe('mergeRoutes', () => {
  it('replaces one person and leaves the others', () => {
    const merged = mergeRoutes([route('a'), route('b')], ['b'], [route('b')]);
    expect(merged.map((r) => r.participantId)).toEqual(['a', 'b']);
    expect(merged).toHaveLength(2);
  });

  it('removes someone whose route is missing from the response', () => {
    expect(mergeRoutes([route('a'), route('b')], ['b'], [])).toEqual([route('a')]);
  });
});
