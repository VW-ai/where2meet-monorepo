import { describe, expect, it } from 'vitest';
import { formatTripTime, slowestRoute, tripClaim, tripOf, type Trip } from '../route-summary';

const here = { lat: 40.7, lng: -74 };
const person = (id: string, travelMode: 'driving' | 'transit' = 'driving') => ({
  id,
  travelMode,
  location: here,
});
const route = (
  participantId: string,
  durationSeconds: number,
  travelMode = 'driving' as const
) => ({
  participantId,
  durationSeconds,
  travelMode,
});

describe('tripOf', () => {
  it('reads a returned route as found', () => {
    expect(tripOf(person('a'), [route('a', 60)]).status).toBe('found');
  });

  it('reads a 200 without the person as no route, and a failed request as failed', () => {
    expect(tripOf(person('a'), [route('b', 60)]).status).toBe('none');
    expect(tripOf(person('a'), [], 'failed').status).toBe('failed');
  });

  it('waits while a request is out or the route is for another mode', () => {
    expect(tripOf(person('a'), [route('a', 60)], 'loading').status).toBe('pending');
    expect(tripOf(person('a', 'transit'), [route('a', 60)]).status).toBe('pending');
  });

  it('knows someone without a starting point has no trip to look up', () => {
    expect(tripOf({ ...person('a'), location: null }, [], 'failed').status).toBe('no-start');
  });
});

describe('tripClaim', () => {
  const found = (s: number): Trip<{ durationSeconds: number }> => ({
    status: 'found',
    route: { durationSeconds: s },
  });

  it('claims everyone only when everyone has a route', () => {
    expect(tripClaim([found(60), found(600)])).toMatchObject({ reached: 2, total: 2 });
    expect(tripClaim([found(600), { status: 'none' }, { status: 'failed' }])).toMatchObject({
      reached: 1,
      total: 3,
      slowest: { durationSeconds: 600 },
    });
  });

  it('claims nothing while a trip is pending or when nobody has a route', () => {
    expect(tripClaim([found(60), { status: 'pending' }])).toBeNull();
    expect(tripClaim([{ status: 'failed' }, { status: 'no-start' }])).toBeNull();
  });
});

describe('slowestRoute', () => {
  it('picks the longest trip by seconds, whatever the display text says', () => {
    const routes = [
      { participantId: 'a', duration: '9 mins', durationSeconds: 540 },
      { participantId: 'b', duration: '1 hour 2 mins', durationSeconds: 3720 },
      { participantId: 'c', duration: '12 mins', durationSeconds: 720 },
    ];
    expect(slowestRoute(routes)?.participantId).toBe('b');
  });

  it('keeps the first of a tie', () => {
    expect(
      slowestRoute([
        { participantId: 'a', durationSeconds: 600 },
        { participantId: 'b', durationSeconds: 600 },
      ])?.participantId
    ).toBe('a');
  });

  it('has no answer without routes', () => {
    expect(slowestRoute([])).toBeNull();
  });
});

describe('formatTripTime', () => {
  it('reads as minutes under an hour', () => {
    expect(formatTripTime(660, 'en')).toBe('11 min');
    expect(formatTripTime(660, 'zh')).toBe('11 分钟');
  });

  it('adds hours when it needs them', () => {
    expect(formatTripTime(3900, 'en')).toBe('1 hr 5 min');
    expect(formatTripTime(3900, 'zh')).toBe('1 小时 5 分钟');
    expect(formatTripTime(7200, 'en')).toBe('2 hr');
  });

  it('never says a trip takes zero minutes', () => {
    expect(formatTripTime(10, 'en')).toBe('1 min');
  });
});
