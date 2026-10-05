import { describe, expect, it } from 'vitest';
import {
  VENUES,
  describeVenue,
  straightLineMiles,
  summarize,
  type Venue,
} from '../travel-time-example';

describe('straightLineMiles', () => {
  it('measures as the crow flies at 100 map units per mile', () => {
    expect(straightLineMiles({ x: 0, y: 0 }, { x: 60, y: 80 })).toBe(1);
    expect(straightLineMiles({ x: 10, y: 10 }, { x: 10, y: 54 })).toBe(0.4);
  });
});

describe('describeVenue', () => {
  it('reads out every trip, the longest, the spread and the distance', () => {
    const venue: Venue = {
      letter: 'C',
      label: 'Somewhere',
      at: { x: 105, y: 206 },
      trips: {
        ana: { minutes: 20, route: '' },
        ben: { minutes: 25, route: '' },
        cy: { minutes: 30, route: '' },
      },
    };
    expect(describeVenue(venue)).toBe(
      'Somewhere: Ana 20 minutes, Ben 25 minutes, Cy 30 minutes. Longest trip 30 minutes, spread 10 minutes. 1.0 miles from the middle in a straight line.'
    );
  });
});

describe('the example', () => {
  it('puts the closer venue on the map behind on both travel-time numbers', () => {
    const closest = summarize(VENUES.closest);
    const easiest = summarize(VENUES.easiest);
    expect(closest.miles).toBeLessThan(easiest.miles);
    expect(closest.longest).toBeGreaterThan(easiest.longest);
    expect(closest.spread).toBeGreaterThan(easiest.spread);
  });
});
