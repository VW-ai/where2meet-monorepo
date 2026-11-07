import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseEventParticipants, parseParticipant } from '@/entities/participant/parse';
import { directionsApi, parseDirections } from '@/lib/api/directions';
import { participantsApi } from '@/lib/api/participants';

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
        {
          participantId: 'b',
          distance: null,
          duration: null,
          polyline: null,
          travelMode: 'walking',
        },
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

describe('requests', () => {
  const stubFetch = (body: unknown) => {
    const fetch = vi.fn(async (..._: unknown[]) => new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  afterEach(() => vi.unstubAllGlobals());

  it('claims with no body and no Content-Type, which the server rejects when empty', async () => {
    const fetch = stubFetch({ id: 'a', participantToken: 'pt_x' });
    const claimed = await participantsApi.claim('e', 'a');
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(claimed).toMatchObject({ participantToken: 'pt_x', claimable: false });
  });

  it.each([
    [{}, ''],
    [{ participantId: 'a' }, '?participantId=a'],
    [{ participantId: 'a', travelMode: 'transit' as const }, '?travelMode=transit&participantId=a'],
  ])('asks for directions with %j', async (options, query) => {
    const fetch = stubFetch({ venueId: 'v', travelMode: null, routes: [] });
    await directionsApi.getDirections('e', 'v', 'token', options);
    expect(String(fetch.mock.calls[0][0])).toMatch(
      new RegExp(`/api/events/e/venues/v/directions${query.replace('?', '\\?')}$`)
    );
  });
});
