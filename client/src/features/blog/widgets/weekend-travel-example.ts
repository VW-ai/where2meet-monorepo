import { PEOPLE, tripStats } from './explainer-model';

/**
 * The made-up example behind the weekend travel widget: three friends heading
 * to one food hall by train, car and bike, on a Tuesday and on a Sunday.
 * Coordinates are in the widget's SVG units (viewBox 0 0 360 225).
 */

/** The parts of a trip. Waiting covers both the platform and the hunt for a spot. */
export const LEGS = {
  walk: { label: 'walk', waiting: false },
  wait: { label: 'wait', waiting: true },
  ride: { label: 'ride', waiting: false },
  drive: { label: 'drive', waiting: false },
  park: { label: 'parking', waiting: true },
  bike: { label: 'bike', waiting: false },
} as const;

export type LegKind = keyof typeof LEGS;

export interface Leg {
  kind: LegKind;
  minutes: number;
}

export const FRIENDS = [
  { ...PEOPLE.ana, mode: 'train', at: { x: 75, y: 75 }, route: 'M75 75 V132.5 H300 V110' },
  { ...PEOPLE.ben, mode: 'car', at: { x: 30, y: 20 }, route: 'M30 20 H210 V65 H255' },
  { ...PEOPLE.cy, mode: 'bike', at: { x: 345, y: 200 }, route: 'M345 200 V110 H300' },
] as const;

export type FriendId = (typeof FRIENDS)[number]['id'];

export interface Day {
  label: string;
  /** Minutes between trains, so also the longest wait on the platform. */
  trainEvery: number;
  /** Weekend trains call at every station instead of running express. */
  allStops: boolean;
  parkingFull: boolean;
  trips: Record<FriendId, readonly Leg[]>;
}

export const DAYS = {
  tuesday: {
    label: 'Tuesday',
    trainEvery: 8,
    allStops: false,
    parkingFull: false,
    trips: {
      ana: [
        { kind: 'walk', minutes: 3 },
        { kind: 'wait', minutes: 8 },
        { kind: 'ride', minutes: 9 },
      ],
      ben: [
        { kind: 'drive', minutes: 12 },
        { kind: 'park', minutes: 3 },
      ],
      cy: [{ kind: 'bike', minutes: 18 }],
    },
  },
  sunday: {
    label: 'Sunday',
    trainEvery: 20,
    allStops: true,
    parkingFull: true,
    trips: {
      ana: [
        { kind: 'walk', minutes: 3 },
        { kind: 'wait', minutes: 20 },
        { kind: 'ride', minutes: 12 },
      ],
      ben: [
        { kind: 'drive', minutes: 12 },
        { kind: 'park', minutes: 10 },
      ],
      cy: [{ kind: 'bike', minutes: 18 }],
    },
  },
} satisfies Record<string, Day>;

export type DayId = keyof typeof DAYS;

export function tripMinutes(legs: readonly Leg[]) {
  return legs.reduce((sum, leg) => sum + leg.minutes, 0);
}

export function summarizeDay(day: Day) {
  const minutes = FRIENDS.map(({ id }) => tripMinutes(day.trips[id]));
  return { minutes, ...tripStats(minutes) };
}

/** What the live region reads out when a day is selected. */
export function describeDay(day: Day) {
  const { minutes, longest, spread } = summarizeDay(day);
  const service = `the train comes every ${day.trainEvery} minutes${
    day.allStops ? ' and stops at every station' : ''
  }, and the parking near the food hall is ${day.parkingFull ? 'full' : 'open'}`;
  const trips = FRIENDS.map(({ id, name, mode }, i) => {
    const legs = day.trips[id];
    const parts =
      legs.length > 1
        ? ` (${legs.map(({ kind, minutes }) => `${LEGS[kind].label} ${minutes}`).join(', ')})`
        : '';
    return `${name} ${minutes[i]} minutes by ${mode}${parts}`;
  }).join(', ');
  return `${day.label}: ${service}. ${trips}. Longest trip ${longest} minutes, spread ${spread} minutes.`;
}
