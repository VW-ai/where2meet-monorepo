import { describe, expect, it } from 'vitest';
import { tripStats } from '../explainer-model';

describe('tripStats', () => {
  it('finds the longest trip and the spread for the trips in the post', () => {
    expect(tripStats([5, 10, 55])).toEqual({ longest: 55, spread: 50 });
    expect(tripStats([25, 20, 30])).toEqual({ longest: 30, spread: 10 });
  });
});
