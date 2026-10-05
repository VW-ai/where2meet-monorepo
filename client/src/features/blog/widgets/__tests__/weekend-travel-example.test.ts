import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DAYS, describeDay, summarizeDay, tripMinutes, type Day } from '../weekend-travel-example';

const somewhere: Day = {
  label: 'Monday',
  trainEvery: 10,
  allStops: false,
  parkingFull: true,
  trips: {
    ana: [
      { kind: 'walk', minutes: 5 },
      { kind: 'wait', minutes: 10 },
      { kind: 'ride', minutes: 10 },
    ],
    ben: [
      { kind: 'drive', minutes: 14 },
      { kind: 'park', minutes: 6 },
    ],
    cy: [{ kind: 'bike', minutes: 30 }],
  },
};

describe('tripMinutes', () => {
  it('adds up the parts of a trip', () => {
    expect(
      tripMinutes([
        { kind: 'walk', minutes: 3 },
        { kind: 'wait', minutes: 20 },
        { kind: 'ride', minutes: 12 },
      ])
    ).toBe(35);
    expect(tripMinutes([{ kind: 'bike', minutes: 18 }])).toBe(18);
  });
});

describe('summarizeDay', () => {
  it('totals each trip, then finds the longest and the spread', () => {
    expect(summarizeDay(somewhere)).toEqual({ minutes: [25, 20, 30], longest: 30, spread: 10 });
  });
});

describe('describeDay', () => {
  it('reads out the service, every trip with its parts, the longest and the spread', () => {
    expect(describeDay(somewhere)).toBe(
      'Monday: the train comes every 10 minutes, and the parking near the food hall is full. Ana 25 minutes by train (walk 5, wait 10, ride 10), Ben 20 minutes by car (drive 14, parking 6), Cy 30 minutes by bike. Longest trip 30 minutes, spread 10 minutes.'
    );
  });
});

describe('the example', () => {
  it('grows Ana from 20 to 35 minutes and Ben from 15 to 22, and leaves Cy at 18', () => {
    expect(summarizeDay(DAYS.tuesday)).toEqual({ minutes: [20, 15, 18], longest: 20, spread: 5 });
    expect(summarizeDay(DAYS.sunday)).toEqual({ minutes: [35, 22, 18], longest: 35, spread: 17 });
  });

  it('makes Ana wait up to one gap between trains', () => {
    for (const day of Object.values(DAYS)) {
      const wait = day.trips.ana.find(({ kind }) => kind === 'wait');
      expect(wait?.minutes).toBe(day.trainEvery);
    }
  });

  it('matches the sentence in the weekend post', () => {
    const post = readFileSync(
      path.join(
        __dirname,
        '../../../../content/blog/how-to-plan-a-weekend-hangout-with-friends.mdx'
      ),
      'utf8'
    );
    const [tuesday, sunday] = [DAYS.tuesday, DAYS.sunday].map(summarizeDay);
    expect(post).toContain(
      `a place that's ${tuesday.minutes[0]} minutes away on a Tuesday can take ${sunday.minutes[0]} on a Sunday if the train comes every ${DAYS.sunday.trainEvery} minutes instead of every ${DAYS.tuesday.trainEvery}.`
    );
  });
});
