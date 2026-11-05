import { describe, expect, it } from 'vitest';
import type { ParticipantPreview } from '@/features/meeting/api';
import {
  addStep,
  draftPerson,
  modeEstimate,
  toDraftPreview,
  type DraftPreview,
} from '../add-person-form';
import { nextParticipantColor } from '../participant-colors';

const ASTORIA = { address: 'Astoria, Queens', placeId: 'astoria' };

const RESPONSE: ParticipantPreview = {
  location: { lat: 40.77, lng: -73.93 },
  formattedAddress: 'Astoria, NY',
  routes: [
    {
      travelMode: 'driving',
      distance: { value: 3000, text: '1.9 mi' },
      duration: { value: 660, text: '11 mins' },
      polyline: 'driving-line',
    },
    {
      travelMode: 'transit',
      distance: { value: 3500, text: '2.2 mi' },
      duration: { value: 1320, text: '22 mins' },
      polyline: 'transit-line',
    },
  ],
};
const READY = toDraftPreview(RESPONSE, true);

describe('addStep', () => {
  it('asks for a name first, even with only spaces typed', () => {
    expect(addStep('', null)).toBe('name');
    expect(addStep('   ', null)).toBe('name');
  });

  it('asks for a place once there is a name', () => {
    expect(addStep('Mom', null)).toBe('place');
  });

  it('asks how they are going once there is a place', () => {
    expect(addStep('Mom', ASTORIA)).toBe('mode');
  });

  it('goes back to the name when it is cleared', () => {
    expect(addStep('', ASTORIA)).toBe('name');
  });
});

describe('modeEstimate', () => {
  it('gives the time for a mode with a route', () => {
    expect(modeEstimate(READY, 'transit')).toEqual({ kind: 'time', seconds: 1320 });
  });

  it('says there is no route for a mode the answer left out', () => {
    expect(modeEstimate(READY, 'walking')).toEqual({ kind: 'none' });
  });

  it.each<[string, DraftPreview | null]>([
    ['nothing asked yet', null],
    ['an answer on its way', { status: 'loading' }],
    ['a failed preview', { status: 'failed' }],
    ['no venue selected', toDraftPreview({ ...RESPONSE, routes: [] }, false)],
  ])('falls back to the label with %s', (_, preview) => {
    expect(modeEstimate(preview, 'driving')).toEqual({ kind: 'label' });
  });
});

describe('draftPerson', () => {
  it('draws nothing until the place is known', () => {
    expect(draftPerson(null, 'driving', 'teal', 'Ana')).toBeNull();
    expect(draftPerson({ status: 'loading' }, 'driving', 'teal', 'Ana')).toBeNull();
    expect(draftPerson({ status: 'failed' }, 'driving', 'teal', 'Ana')).toBeNull();
  });

  it('carries the route for the chosen mode, from the one answer', () => {
    expect(draftPerson(READY, 'transit', 'teal', 'Ana')).toMatchObject({
      color: 'teal',
      location: RESPONSE.location,
      route: { travelMode: 'transit', polyline: 'transit-line', durationSeconds: 1320 },
    });
    expect(draftPerson(READY, 'driving', 'teal', 'Ana')?.route?.polyline).toBe('driving-line');
  });

  it('keeps the pin when the chosen mode has no route', () => {
    expect(draftPerson(READY, 'walking', 'teal', 'Ana')).toMatchObject({
      location: RESPONSE.location,
      route: null,
    });
  });
});

describe('nextParticipantColor', () => {
  it('takes the first color nobody has, as the server will', () => {
    expect(nextParticipantColor([])).toBe('coral');
    expect(nextParticipantColor([{ color: 'coral' }, { color: 'gold' }])).toBe('teal', 'Ana');
  });
});
