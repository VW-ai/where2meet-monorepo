/**
 * The made-up example behind the "travel time, not distance" widget: three
 * teammates, a river with one bridge, a train line, and two candidate venues.
 * Coordinates are in the widget's SVG units (viewBox 0 0 360 225).
 */

export interface Point {
  x: number;
  y: number;
}

export const TEAM = [
  { id: 'ana', name: 'Ana', color: '#FF6B6B', ink: '#d9474a', at: { x: 120, y: 38 } },
  { id: 'ben', name: 'Ben', color: '#4D96FF', ink: '#2f6fd6', at: { x: 30, y: 80 } },
  { id: 'cy', name: 'Cy', color: '#6BCB77', ink: '#3a9447', at: { x: 165, y: 200 } },
] as const;

export type TeammateId = (typeof TEAM)[number]['id'];

export interface Trip {
  minutes: number;
  /** SVG path along the streets (and, for the train, the rail line). */
  route: string;
}

export interface Venue {
  letter: string;
  label: string;
  at: Point;
  trips: Record<TeammateId, Trip>;
}

export const VENUES = {
  closest: {
    letter: 'A',
    label: 'Closest on the map',
    at: { x: 165, y: 110 },
    trips: {
      ana: { minutes: 12, route: 'M120 38 V65 H165 V110' },
      ben: { minutes: 15, route: 'M30 80 V110 H165' },
      // Straight across the river from A, but the only bridge is at x=300.
      cy: { minutes: 52, route: 'M165 200 V155 H300 V110 H165' },
    },
  },
  easiest: {
    letter: 'B',
    label: 'Easiest to reach',
    at: { x: 255, y: 42 },
    trips: {
      ana: { minutes: 24, route: 'M120 38 V20 H255 V42' },
      ben: { minutes: 27, route: 'M30 80 V65 H255 V42' },
      // Walk to the south station, ride the train over the river, walk out.
      cy: { minutes: 30, route: 'M165 200 H227.5 V42 H255' },
    },
  },
} satisfies Record<string, Venue>;

export type VenueId = keyof typeof VENUES;

/** The straight-line middle of where everyone starts. */
export const MIDDLE: Point = {
  x: TEAM.reduce((sum, { at }) => sum + at.x, 0) / TEAM.length,
  y: TEAM.reduce((sum, { at }) => sum + at.y, 0) / TEAM.length,
};

const UNITS_PER_MILE = 100;

export function tripStats(minutes: readonly number[]) {
  const longest = Math.max(...minutes);
  return { longest, spread: longest - Math.min(...minutes) };
}

/** As the crow flies, rounded to a tenth of a mile. */
export function straightLineMiles(from: Point, to: Point) {
  return Math.round((Math.hypot(to.x - from.x, to.y - from.y) / UNITS_PER_MILE) * 10) / 10;
}

export function summarize(venue: Venue) {
  const minutes = TEAM.map(({ id }) => venue.trips[id].minutes);
  return { minutes, ...tripStats(minutes), miles: straightLineMiles(MIDDLE, venue.at) };
}

/** What the live region reads out when a venue is selected. */
export function describeVenue(venue: Venue) {
  const { minutes, longest, spread, miles } = summarize(venue);
  const trips = TEAM.map(({ name }, i) => `${name} ${minutes[i]} minutes`).join(', ');
  return `${venue.label}: ${trips}. Longest trip ${longest} minutes, spread ${spread} minutes. ${miles.toFixed(1)} miles from the middle in a straight line.`;
}
