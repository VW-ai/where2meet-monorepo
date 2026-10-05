import { describe, expect, it } from 'vitest';
import { parseVisitorGeo } from '../visitor-geo';

describe('parseVisitorGeo', () => {
  it('reads a city and coordinates', () => {
    expect(parseVisitorGeo({ city: 'Chicago', lat: 41.88, lng: -87.63 })).toEqual({
      city: 'Chicago',
      lat: 41.88,
      lng: -87.63,
    });
  });

  it.each([
    ['null', null],
    ['a missing city', { lat: 41.88, lng: -87.63 }],
    ['an empty city', { city: '', lat: 41.88, lng: -87.63 }],
    ['a string latitude', { city: 'Chicago', lat: '41.88', lng: -87.63 }],
    ['an out-of-range longitude', { city: 'Chicago', lat: 41.88, lng: 200 }],
  ])('rejects %s', (_, body) => {
    expect(() => parseVisitorGeo(body)).toThrow('Unexpected /api/geo response');
  });
});
