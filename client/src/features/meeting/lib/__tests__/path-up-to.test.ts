import { describe, expect, it } from 'vitest';
import { pathUpTo } from '../path-up-to';

const L_SHAPE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
  { lat: 10, lng: 10 },
];

describe('pathUpTo', () => {
  it('starts on the first point', () => {
    expect(pathUpTo(L_SHAPE, 0)).toEqual([{ lat: 0, lng: 0 }]);
    expect(pathUpTo(L_SHAPE, -1)).toEqual([{ lat: 0, lng: 0 }]);
  });

  it('interpolates the head inside the first segment', () => {
    expect(pathUpTo(L_SHAPE, 0.25)).toEqual([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 5 },
    ]);
  });

  it('keeps earlier corners and interpolates inside a later segment', () => {
    expect(pathUpTo(L_SHAPE, 0.75)).toEqual([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 10 },
      { lat: 5, lng: 10 },
    ]);
  });

  it('returns the whole path at the end', () => {
    expect(pathUpTo(L_SHAPE, 1)).toEqual(L_SHAPE);
    expect(pathUpTo(L_SHAPE, 2)).toEqual(L_SHAPE);
  });

  it('handles paths too short to walk', () => {
    expect(pathUpTo([], 0.5)).toEqual([]);
    expect(pathUpTo([{ lat: 1, lng: 2 }], 0.5)).toEqual([{ lat: 1, lng: 2 }]);
  });

  it('survives a path of one repeated point', () => {
    const still = [
      { lat: 1, lng: 2 },
      { lat: 1, lng: 2 },
    ];
    expect(pathUpTo(still, 0.5)).toEqual(still);
  });
});
