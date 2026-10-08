import { PEOPLE, tripStats, type Point } from './explainer-model';

/**
 * The made-up example behind the trip home widget: Ana and Ben, two bars and
 * two train lines, getting there at 7 p.m. and getting home at 11 p.m.
 * Coordinates are in the widget's SVG units (viewBox 0 0 360 225).
 */

const ANA_HOME: Point = { x: 40, y: 110 };
const BEN_HOME: Point = { x: 315, y: 125 };
const LOCAL_Y = 65;
const MAIN_Y = 155;
/** The local's last stop, a short walk from the bar near Ben. */
const LOCAL_END: Point = { x: 270, y: LOCAL_Y };
const CENTRAL: Point = { x: 180, y: MAIN_Y };
const NEAR_BEN: Point = { x: BEN_HOME.x, y: 80 };
const BY_STATION: Point = { x: CENTRAL.x, y: 128 };

/** An SVG path through `points`, in order. */
function route(...points: readonly Point[]) {
  return points.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

export const LINES = {
  local: { label: 'Local line', rail: route({ x: -10, y: LOCAL_Y }, LOCAL_END) },
  main: { label: 'Main line', rail: route({ x: -10, y: MAIN_Y }, { x: 370, y: MAIN_Y }) },
} as const;

export type LineId = keyof typeof LINES;

export const STATIONS: readonly Point[] = [
  { x: ANA_HOME.x, y: LOCAL_Y },
  LOCAL_END,
  { x: ANA_HOME.x, y: MAIN_Y },
  CENTRAL,
  { x: BEN_HOME.x, y: MAIN_Y },
];

export const COUPLE = [
  { ...PEOPLE.ana, at: ANA_HOME },
  { ...PEOPLE.ben, at: BEN_HOME },
] as const;

export type PersonId = (typeof COUPLE)[number]['id'];

/** A wait lasts as long as the gap between trains on its line at that hour. */
export type Leg = { kind: 'walk' | 'ride'; minutes: number } | { kind: 'wait'; line: LineId };

const DIRECTIONS = {
  there: { title: 'Getting there', toward: 'To' },
  home: { title: 'Getting home', toward: 'From' },
} as const;

export interface Hour {
  /** A clock time such as "7 p.m.", so it ends a sentence on its own. */
  label: string;
  direction: keyof typeof DIRECTIONS;
  /** Minutes between trains on each line. */
  every: Record<LineId, number>;
}

export const HOURS = {
  evening: { label: '7 p.m.', direction: 'there', every: { local: 10, main: 5 } },
  late: { label: '11 p.m.', direction: 'home', every: { local: 30, main: 10 } },
} satisfies Record<string, Hour>;

export type HourId = keyof typeof HOURS;

export interface Spot {
  label: string;
  at: Point;
  /** The trip there. The trip home runs it backward in the same minutes. */
  trips: Record<PersonId, readonly Leg[]>;
  routes: Record<PersonId, string>;
}

export const SPOTS = {
  nearBen: {
    label: 'Bar near Ben',
    at: NEAR_BEN,
    trips: {
      ana: [
        { kind: 'walk', minutes: 5 },
        { kind: 'wait', line: 'local' },
        { kind: 'ride', minutes: 15 },
        { kind: 'walk', minutes: 5 },
      ],
      ben: [{ kind: 'walk', minutes: 5 }],
    },
    routes: {
      ana: route(
        ANA_HOME,
        { x: ANA_HOME.x, y: LOCAL_Y },
        LOCAL_END,
        { x: LOCAL_END.x, y: NEAR_BEN.y },
        NEAR_BEN
      ),
      ben: route(BEN_HOME, NEAR_BEN),
    },
  },
  byStation: {
    label: 'Bar by the station',
    at: BY_STATION,
    trips: {
      ana: [
        { kind: 'walk', minutes: 5 },
        { kind: 'wait', line: 'main' },
        { kind: 'ride', minutes: 8 },
        { kind: 'walk', minutes: 2 },
      ],
      ben: [
        { kind: 'walk', minutes: 3 },
        { kind: 'wait', line: 'main' },
        { kind: 'ride', minutes: 10 },
        { kind: 'walk', minutes: 2 },
      ],
    },
    routes: {
      ana: route(ANA_HOME, { x: ANA_HOME.x, y: MAIN_Y }, CENTRAL, BY_STATION),
      ben: route(BEN_HOME, { x: BEN_HOME.x, y: MAIN_Y }, CENTRAL, BY_STATION),
    },
  },
} satisfies Record<string, Spot>;

export type SpotId = keyof typeof SPOTS;

export function legMinutes(leg: Leg, hour: Hour) {
  return leg.kind === 'wait' ? hour.every[leg.line] : leg.minutes;
}

export function tripMinutes(legs: readonly Leg[], hour: Hour) {
  return legs.reduce((sum, leg) => sum + legMinutes(leg, hour), 0);
}

export function summarizeSpot(spot: Spot, hour: Hour) {
  const minutes = COUPLE.map(({ id }) => tripMinutes(spot.trips[id], hour));
  return { minutes, ...tripStats(minutes) };
}

/** "Getting home at 11 p.m." */
export function hourTitle(hour: Hour) {
  return `${DIRECTIONS[hour.direction].title} at ${hour.label}`;
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** What the live region reads out when an hour is selected. */
export function describeHour(hour: Hour) {
  const { local, main } = LINES;
  const service = `The ${lowerFirst(local.label)} comes every ${hour.every.local} minutes and the ${lowerFirst(main.label)} every ${hour.every.main}.`;
  const spots = Object.values(SPOTS).map((spot: Spot) => {
    const trips = COUPLE.map(({ id, name }) => {
      const legs = spot.trips[id];
      const parts =
        legs.length > 1
          ? ` (${legs.map((leg) => `${leg.kind} ${legMinutes(leg, hour)}`).join(', ')})`
          : '';
      return `${name} takes ${tripMinutes(legs, hour)} minutes${parts}`;
    }).join(' and ');
    return `${DIRECTIONS[hour.direction].toward} the ${lowerFirst(spot.label)}, ${trips}.`;
  });
  return [hourTitle(hour), service, ...spots].join(' ');
}
