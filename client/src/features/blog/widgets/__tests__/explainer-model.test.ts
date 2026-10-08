import { describe, expect, it } from 'vitest';
import { route, tripStats } from '../explainer-model';

describe('tripStats', () => {
  it('finds the longest trip and the spread for the trips in the post', () => {
    expect(tripStats([5, 10, 55])).toEqual({ longest: 55, spread: 50 });
    expect(tripStats([25, 20, 30])).toEqual({ longest: 30, spread: 10 });
  });
});

describe('route', () => {
  it('draws a path through the points in order', () => {
    expect(route({ x: 40, y: 110 }, { x: 40, y: 155 }, { x: 180, y: 155 })).toBe(
      'M40 110 L40 155 L180 155'
    );
  });
});
