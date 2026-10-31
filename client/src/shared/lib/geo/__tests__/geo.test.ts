import { describe, it, expect } from 'vitest';
import { wgs84ToGcj02, gcj02ToWgs84, isOutsideChina } from '../coords';
import { decodePolyline } from '../polyline';

describe('geo coords', () => {
  const beijingWgs = { lat: 39.915, lng: 116.404 };

  it('matches the server conversion for a Beijing point', () => {
    // Same reference values as server/tests/unit/geo-coords.test.ts.
    const gcj = wgs84ToGcj02(beijingWgs);
    expect(gcj.lng).toBeCloseTo(116.41024449916938, 6);
    expect(gcj.lat).toBeCloseTo(39.91640428150164, 6);
  });

  it('round-trips GCJ-02 back to WGS-84', () => {
    const back = gcj02ToWgs84(wgs84ToGcj02(beijingWgs));
    expect(back.lat).toBeCloseTo(beijingWgs.lat, 6);
    expect(back.lng).toBeCloseTo(beijingWgs.lng, 6);
  });

  it('leaves points outside China unchanged', () => {
    const newYork = { lat: 40.7128, lng: -74.006 };
    expect(isOutsideChina(newYork)).toBe(true);
    expect(wgs84ToGcj02(newYork)).toEqual(newYork);
  });
});

describe('decodePolyline', () => {
  it('decodes the example from Google’s documentation', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('returns no points for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});
