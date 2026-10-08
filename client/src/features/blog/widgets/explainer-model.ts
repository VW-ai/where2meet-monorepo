/** What every blog explainer shares: map points, the cast and the trip numbers. */

export interface Point {
  x: number;
  y: number;
}

/** An SVG path through `points`, in order. */
export function route(...points: readonly Point[]) {
  return points.map(({ x, y }, i) => `${i === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

/** The same friends, in the same colors, in every post. Each post picks the ones it needs. */
export const PEOPLE = {
  ana: { id: 'ana', name: 'Ana', color: '#FF6B6B', ink: '#d9474a' },
  ben: { id: 'ben', name: 'Ben', color: '#4D96FF', ink: '#2f6fd6' },
  cy: { id: 'cy', name: 'Cy', color: '#6BCB77', ink: '#3a9447' },
  dee: { id: 'dee', name: 'Dee', color: '#F5A524', ink: '#b36d00' },
  eli: { id: 'eli', name: 'Eli', color: '#AE7CF4', ink: '#8a55e0' },
} as const;

export function tripStats(minutes: readonly number[]) {
  const longest = Math.max(...minutes);
  return { longest, spread: longest - Math.min(...minutes) };
}
