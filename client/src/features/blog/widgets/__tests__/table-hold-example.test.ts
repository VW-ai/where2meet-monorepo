import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DINNER,
  GUESTS,
  RESTAURANTS,
  arrivals,
  clock,
  describeRestaurant,
  formatClock,
  holdEndsAt,
  lastArrival,
  lateGuests,
  type Restaurant,
} from '../table-hold-example';

const somewhere: Restaurant = {
  label: 'Somewhere',
  letter: 'C',
  at: { x: 0, y: 0 },
  trips: { ana: 15, ben: 50, cy: 45, dee: 20, eli: 60 },
  routes: { ana: '', ben: '', cy: '', dee: '', eli: '' },
};

const shown = (times: ReturnType<typeof arrivals>) =>
  Object.fromEntries(Object.entries(times).map(([id, time]) => [id, formatClock(time)]));

describe('formatClock', () => {
  it('shows a time on a 12-hour clock with two-digit minutes', () => {
    expect(formatClock(clock(19, 5))).toBe('7:05');
    expect(formatClock(clock(20))).toBe('8:00');
    expect(formatClock(clock(12, 30))).toBe('12:30');
    expect(formatClock(clock(0, 15))).toBe('12:15');
  });
});

describe('holdEndsAt', () => {
  it('adds the hold to the table time', () => {
    expect(
      formatClock(holdEndsAt({ leaveAt: clock(18), tableAt: clock(18, 30), holdMinutes: 10 }))
    ).toBe('6:40');
  });
});

describe('arrivals, lastArrival and lateGuests', () => {
  it('adds each trip to the time everyone leaves work', () => {
    expect(shown(arrivals(somewhere))).toEqual({
      ana: '7:15',
      ben: '7:50',
      cy: '7:45',
      dee: '7:20',
      eli: '8:00',
    });
  });

  it('finds the last one there', () => {
    expect(formatClock(lastArrival(somewhere))).toBe('8:00');
  });

  it('counts only those after the hold runs out as late, not someone right at 7:45', () => {
    expect(lateGuests(somewhere)).toEqual(['ben', 'eli']);
  });
});

describe('the example', () => {
  const { nearBen, byStation } = RESTAURANTS;

  it('gets Eli to the restaurant near Ben at 7:55, the only one after the 7:45 hold', () => {
    expect(formatClock(holdEndsAt(DINNER))).toBe('7:45');
    expect(shown(arrivals(nearBen))).toEqual({
      ana: '7:30',
      ben: '7:10',
      cy: '7:20',
      dee: '7:25',
      eli: '7:55',
    });
    expect(lateGuests(nearBen)).toEqual(['eli']);
  });

  it('gets everyone to the restaurant by the station by 7:30', () => {
    expect(shown(arrivals(byStation))).toEqual({
      ana: '7:25',
      ben: '7:25',
      cy: '7:20',
      dee: '7:30',
      eli: '7:30',
    });
    expect(formatClock(lastArrival(byStation))).toBe('7:30');
    expect(lateGuests(byStation)).toEqual([]);
  });

  it('reads out each restaurant', () => {
    expect(describeRestaurant(nearBen)).toBe(
      'Restaurant near Ben. Ana arrives at 7:30, Ben at 7:10, Cy at 7:20, Dee at 7:25 and Eli at 7:55. The last friend gets there at 7:55. The restaurant holds the table until 7:45, so it gives the table away.'
    );
    expect(describeRestaurant(byStation)).toBe(
      'Restaurant by the station. Ana arrives at 7:25, Ben at 7:25, Cy at 7:20, Dee at 7:30 and Eli at 7:30. The last friend gets there at 7:30. The restaurant holds the table until 7:45, so the group keeps it.'
    );
  });

  it('matches the sentence in the group dinner post', () => {
    const post = readFileSync(
      path.join(
        __dirname,
        '../../../../content/blog/how-to-pick-a-restaurant-for-a-group-dinner.mdx'
      ),
      'utf8'
    );
    const inWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
    const friends = inWords[GUESTS.length];
    expect(post).toContain(
      `So compare arrival times, not just distance. For example, if ${friends} friends leave work at ${formatClock(DINNER.leaveAt)} for a ${formatClock(DINNER.tableAt)} table, a place ${nearBen.trips.eli} minutes from one of them gets that friend there at ${formatClock(arrivals(nearBen).eli)}, after a ${DINNER.holdMinutes}-minute hold runs out. A place by a busier station gets all ${friends} there by ${formatClock(lastArrival(byStation))}.`
    );
  });
});
