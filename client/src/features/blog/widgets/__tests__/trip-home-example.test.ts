import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HOURS,
  SPOTS,
  describeHour,
  summarizeSpot,
  tripMinutes,
  type Hour,
  type Spot,
} from '../trip-home-example';

const midnight: Hour = { label: '12 a.m.', direction: 'home', every: { local: 40, main: 15 } };

const somewhere: Spot = {
  label: 'Somewhere',
  at: { x: 0, y: 0 },
  trips: {
    ana: [
      { kind: 'walk', minutes: 2 },
      { kind: 'wait', line: 'local' },
      { kind: 'ride', minutes: 10 },
    ],
    ben: [
      { kind: 'walk', minutes: 3 },
      { kind: 'wait', line: 'main' },
      { kind: 'ride', minutes: 12 },
      { kind: 'walk', minutes: 1 },
    ],
  },
  routes: { ana: '', ben: '' },
};

describe('tripMinutes', () => {
  it('adds up the parts of a trip, with each wait as long as the gap between trains', () => {
    expect(
      tripMinutes(
        [
          { kind: 'walk', minutes: 4 },
          { kind: 'wait', line: 'main' },
          { kind: 'ride', minutes: 6 },
          { kind: 'walk', minutes: 1 },
        ],
        midnight
      )
    ).toBe(26);
    expect(tripMinutes([{ kind: 'walk', minutes: 7 }], midnight)).toBe(7);
  });
});

describe('summarizeSpot', () => {
  it('totals both trips at that hour, then finds the longest and the spread', () => {
    expect(summarizeSpot(somewhere, midnight)).toEqual({
      minutes: [52, 31],
      longest: 52,
      spread: 21,
    });
  });
});

describe('the example', () => {
  it('grows Ana from 35 to 55 minutes near Ben, and both from 20 to 25 by the station', () => {
    expect(summarizeSpot(SPOTS.nearBen, HOURS.evening).minutes).toEqual([35, 5]);
    expect(summarizeSpot(SPOTS.nearBen, HOURS.late).minutes).toEqual([55, 5]);
    expect(summarizeSpot(SPOTS.byStation, HOURS.evening).minutes).toEqual([20, 20]);
    expect(summarizeSpot(SPOTS.byStation, HOURS.late).minutes).toEqual([25, 25]);
  });

  it('reads out each hour', () => {
    expect(describeHour(HOURS.evening)).toBe(
      'Getting there at 7 p.m. The local line comes every 10 minutes and the main line every 5. To the bar near Ben, Ana takes 35 minutes (walk 5, wait 10, ride 15, walk 5) and Ben takes 5 minutes. To the bar by the station, Ana takes 20 minutes (walk 5, wait 5, ride 8, walk 2) and Ben takes 20 minutes (walk 3, wait 5, ride 10, walk 2).'
    );
    expect(describeHour(HOURS.late)).toBe(
      'Getting home at 11 p.m. The local line comes every 30 minutes and the main line every 10. From the bar near Ben, Ana takes 55 minutes (walk 5, wait 30, ride 15, walk 5) and Ben takes 5 minutes. From the bar by the station, Ana takes 25 minutes (walk 5, wait 10, ride 8, walk 2) and Ben takes 25 minutes (walk 3, wait 10, ride 10, walk 2).'
    );
  });

  it('matches the sentence in the date night post', () => {
    const post = readFileSync(
      path.join(__dirname, '../../../../content/blog/how-to-pick-a-date-spot.mdx'),
      'utf8'
    );
    const { evening, late } = HOURS;
    const benWalk = tripMinutes(SPOTS.nearBen.trips.ben, evening);
    const [anaThere] = summarizeSpot(SPOTS.nearBen, evening).minutes;
    const [anaHome] = summarizeSpot(SPOTS.nearBen, late).minutes;
    const there = summarizeSpot(SPOTS.byStation, evening);
    const home = summarizeSpot(SPOTS.byStation, late);
    expect([there.spread, home.spread]).toEqual([0, 0]);
    expect(post).toContain(
      `For example, take a bar that's a ${benWalk}-minute walk from Ben's door. At ${evening.label}, Ana gets there in ${anaThere} minutes. At ${late.label}, her train comes every ${late.every.local} minutes instead of every ${evening.every.local}, so her trip home takes ${anaHome}. A bar by a busier station takes each of them ${there.longest} minutes to get there and ${home.longest} to get home.`
    );
  });
});
