/** What every blog explainer shares: map points, the cast and the trip numbers. */

export interface Point {
  x: number;
  y: number;
}

/** The same three friends, in the same colors, in every post. */
export const PEOPLE = {
  ana: { id: 'ana', name: 'Ana', color: '#FF6B6B', ink: '#d9474a' },
  ben: { id: 'ben', name: 'Ben', color: '#4D96FF', ink: '#2f6fd6' },
  cy: { id: 'cy', name: 'Cy', color: '#6BCB77', ink: '#3a9447' },
} as const;

export function tripStats(minutes: readonly number[]) {
  const longest = Math.max(...minutes);
  return { longest, spread: longest - Math.min(...minutes) };
}
