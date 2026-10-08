import { PEOPLE, route, type Point } from './explainer-model';

/**
 * The made-up example behind the table hold widget. Five friends leave work at
 * 7 p.m. for a 7:30 table, and the restaurant holds the table for 15 minutes.
 * Coordinates are in the widget's SVG units (viewBox 0 0 360 225).
 *
 * Everyone walks except where a route runs along a line. The local is the only
 * line to Ben's side, so Eli's trip to the restaurant near Ben is his trip to the
 * station plus Ben's trip on the local, the other way.
 */

declare const minutesAfterMidnight: unique symbol;
/** A time of day, so it can't be mixed up with a trip's minutes. */
export type ClockTime = number & { readonly [minutesAfterMidnight]: true };

export function clock(hours: number, minutes = 0) {
  return (hours * 60 + minutes) as ClockTime;
}

function later(time: ClockTime, minutes: number) {
  return clock(0, time + minutes);
}

/** "7:55", on a 12-hour clock. */
export function formatClock(time: ClockTime) {
  return `${Math.floor(time / 60) % 12 || 12}:${String(time % 60).padStart(2, '0')}`;
}

export interface Dinner {
  leaveAt: ClockTime;
  tableAt: ClockTime;
  /** How long after `tableAt` the restaurant waits before giving the table away. */
  holdMinutes: number;
}

export const DINNER: Dinner = { leaveAt: clock(19), tableAt: clock(19, 30), holdMinutes: 15 };

export function holdEndsAt({ tableAt, holdMinutes }: Dinner) {
  return later(tableAt, holdMinutes);
}

const NEAR_BEN: Point = { x: 65, y: 90 };
/** The local's last stop, a 5-minute walk from both Ben's work and the restaurant near him. */
const LOCAL_END: Point = { x: NEAR_BEN.x, y: 115 };
/** Where the local ends and the main line runs through. */
const HUB: Point = { x: 190, y: LOCAL_END.y };
const ELI_STOP: Point = { x: 335, y: 200 };
const MAIN_TURN: Point = { x: HUB.x, y: ELI_STOP.y };
/** The street the walkers take into the station. */
const STATION_X = 175;

const WORK = {
  ana: { x: 152.5, y: 27.5 },
  ben: { x: NEAR_BEN.x, y: 140 },
  cy: { x: 140, y: 65 },
  dee: { x: 102.5, y: 177.5 },
  eli: { x: ELI_STOP.x, y: 175 },
} satisfies Record<string, Point>;

export const LINES = {
  local: route(LOCAL_END, HUB),
  main: route({ x: HUB.x, y: -10 }, MAIN_TURN, { x: 370, y: ELI_STOP.y }),
} as const;

export const STATIONS: readonly Point[] = [LOCAL_END, HUB, ELI_STOP];

export const GUESTS = [
  { ...PEOPLE.ana, at: WORK.ana },
  { ...PEOPLE.ben, at: WORK.ben },
  { ...PEOPLE.cy, at: WORK.cy },
  { ...PEOPLE.dee, at: WORK.dee },
  { ...PEOPLE.eli, at: WORK.eli },
] as const;

export type GuestId = (typeof GUESTS)[number]['id'];

export interface Restaurant {
  label: string;
  /** Marks the restaurant on the map and on the toggle. */
  letter: string;
  at: Point;
  /** Minutes from each friend's work. */
  trips: Record<GuestId, number>;
  routes: Record<GuestId, string>;
}

const { ana, ben, cy, dee, eli } = WORK;
const eliToHub = [eli, ELI_STOP, MAIN_TURN, HUB] as const;

export const RESTAURANTS = {
  nearBen: {
    label: 'Restaurant near Ben',
    letter: 'A',
    at: NEAR_BEN,
    trips: { ana: 30, ben: 10, cy: 20, dee: 25, eli: 55 },
    routes: {
      ana: route(ana, { x: ana.x, y: 45 }, { x: NEAR_BEN.x, y: 45 }, NEAR_BEN),
      ben: route(ben, NEAR_BEN),
      cy: route(cy, { x: cy.x, y: NEAR_BEN.y }, NEAR_BEN),
      dee: route(dee, { x: dee.x, y: NEAR_BEN.y }, NEAR_BEN),
      eli: route(...eliToHub, LOCAL_END, NEAR_BEN),
    },
  },
  byStation: {
    label: 'Restaurant by the station',
    letter: 'B',
    at: HUB,
    trips: { ana: 25, ben: 25, cy: 20, dee: 30, eli: 30 },
    routes: {
      ana: route(ana, { x: STATION_X, y: ana.y }, { x: STATION_X, y: HUB.y }, HUB),
      ben: route(ben, LOCAL_END, HUB),
      cy: route(cy, { x: STATION_X, y: cy.y }, { x: STATION_X, y: HUB.y }, HUB),
      dee: route(dee, { x: STATION_X, y: dee.y }, { x: STATION_X, y: HUB.y }, HUB),
      eli: route(...eliToHub),
    },
  },
} satisfies Record<string, Restaurant>;

export type RestaurantId = keyof typeof RESTAURANTS;

export function arrivals({ trips }: Restaurant): Record<GuestId, ClockTime> {
  const at = (id: GuestId) => later(DINNER.leaveAt, trips[id]);
  return { ana: at('ana'), ben: at('ben'), cy: at('cy'), dee: at('dee'), eli: at('eli') };
}

export function lastArrival(restaurant: Restaurant) {
  const times = arrivals(restaurant);
  return GUESTS.map(({ id }) => times[id]).reduce((last, time) => (time > last ? time : last));
}

/** Who gets there after the restaurant has given the table away. */
export function lateGuests(restaurant: Restaurant): GuestId[] {
  const times = arrivals(restaurant);
  const givenAway = holdEndsAt(DINNER);
  return GUESTS.filter(({ id }) => times[id] > givenAway).map(({ id }) => id);
}

/** What the live region reads out when a restaurant is selected. */
export function describeRestaurant(restaurant: Restaurant) {
  const times = arrivals(restaurant);
  const said = GUESTS.map(
    ({ id, name }, i) => `${name}${i === 0 ? ' arrives' : ''} at ${formatClock(times[id])}`
  );
  const outcome =
    lateGuests(restaurant).length > 0 ? 'it gives the table away' : 'the group keeps it';
  return [
    `${restaurant.label}.`,
    `${said.slice(0, -1).join(', ')} and ${said[said.length - 1]}.`,
    `The last friend gets there at ${formatClock(lastArrival(restaurant))}.`,
    `The restaurant holds the table until ${formatClock(holdEndsAt(DINNER))}, so ${outcome}.`,
  ].join(' ');
}
