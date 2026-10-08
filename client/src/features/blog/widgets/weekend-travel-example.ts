import { PEOPLE, route, tripStats, type Point } from './explainer-model';

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

interface Leg {
  kind: keyof typeof LEGS;
  minutes: number;
}

export const FOOD_HALL: Point = { x: 300, y: 110 };
/** The lot Ben drives to, a block from the food hall. */
export const PARKING: Point = { x: 255, y: 65 };
export const RAIL_Y = 132.5;

const ANA_HOME: Point = { x: 75, y: 75 };
const BEN_HOME: Point = { x: 120, y: 20 };
const CY_HOME: Point = { x: 345, y: 200 };

/** Stations west to east. The express calls only at Ana's stop and the food hall's. */
export const STOPS = [
  { x: ANA_HOME.x, express: true },
  { x: 150, express: false },
  { x: 225, express: false },
  { x: FOOD_HALL.x, express: true },
] as const;

export const FRIENDS = [
  {
    ...PEOPLE.ana,
    mode: 'train',
    at: ANA_HOME,
    route: route(ANA_HOME, { x: ANA_HOME.x, y: RAIL_Y }, { x: FOOD_HALL.x, y: RAIL_Y }, FOOD_HALL),
  },
  {
    ...PEOPLE.ben,
    mode: 'car',
    at: BEN_HOME,
    route: route(BEN_HOME, { x: 210, y: BEN_HOME.y }, { x: 210, y: PARKING.y }, PARKING),
  },
  {
    ...PEOPLE.cy,
    mode: 'bike',
    at: CY_HOME,
    route: route(CY_HOME, { x: CY_HOME.x, y: FOOD_HALL.y }, FOOD_HALL),
  },
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
