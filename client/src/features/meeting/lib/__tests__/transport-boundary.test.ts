import { describe, expect, it } from 'vitest';
import { parseEventParticipants, parseParticipant } from '@/entities/participant/parse';
import { parseDirections } from '@/lib/api/directions';

describe('parseParticipant', () => {
  it('fills what an older server leaves out', () => {
    expect(parseParticipant({ id: 'a' })).toEqual({
      id: 'a',
      travelMode: 'driving',
      claimable: false,
    });
  });

  it('keeps what the server sent', () => {
    expect(parseParticipant({ id: 'a', travelMode: 'transit', claimable: true })).toEqual({
      id: 'a',
      travelMode: 'transit',
      claimable: true,
    });
  });
});

describe('parseEventParticipants', () => {
  it('parses everyone in the event', () => {
    expect(parseEventParticipants({ participants: [{ id: 'a' }] }).participants).toEqual([
      { id: 'a', travelMode: 'driving', claimable: false },
    ]);
  });

  it('leaves an event without a participant list alone', () => {
    expect(parseEventParticipants({ id: 'e' })).toEqual({ id: 'e' });
  });
});

describe('parseDirections', () => {
  const real = {
    participantId: 'a',
    distance: { text: '1 mi', value: 1600 },
    duration: { text: '5 mins', value: 300 },
    polyline: 'abc',
  };

  it('drops a person with no route instead of carrying nulls', () => {
    const { routes } = parseDirections({
      venueId: 'v',
      travelMode: null,
      routes: [
        { ...real, travelMode: 'walking' },
        { participantId: 'b', distance: null, duration: null, polyline: null, travelMode: 'walking' },
      ],
    });
    expect(routes.map((route) => route.participantId)).toEqual(['a']);
  });

  it('reads the mode from the route, then the request, then the default', () => {
    const modeOf = (top: 'transit' | undefined, own: 'walking' | undefined) =>
      parseDirections({
        venueId: 'v',
        travelMode: top,
        routes: [{ ...real, travelMode: own }],
      }).routes[0].travelMode;
    expect(modeOf('transit', 'walking')).toBe('walking');
    expect(modeOf('transit', undefined)).toBe('transit');
    expect(modeOf(undefined, undefined)).toBe('driving');
  });
});
