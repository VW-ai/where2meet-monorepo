/**
 * Unit tests for WGS-84 / GCJ-02 coordinate conversion.
 */

import { describe, it, expect } from "vitest";
import { wgs84ToGcj02, gcj02ToWgs84, isOutsideChina } from "../../src/lib/geo/coords.js";

/** Approximate distance in meters between two nearby points. */
function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111320;
  const dLng = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

describe("geo coords", () => {
  const beijingWgs = { lat: 39.915, lng: 116.404 };

  it("shifts points inside mainland China by a few hundred meters", () => {
    const gcj = wgs84ToGcj02(beijingWgs);
    const shift = metersBetween(beijingWgs, gcj);
    expect(shift).toBeGreaterThan(200);
    expect(shift).toBeLessThan(700);
  });

  it("matches the published coordtransform reference values", () => {
    // wgs84togcj02(116.404, 39.915) and gcj02towgs84(116.404, 39.915) from the coordtransform README.
    const gcj = wgs84ToGcj02(beijingWgs);
    expect(gcj.lng).toBeCloseTo(116.41024449916938, 6);
    expect(gcj.lat).toBeCloseTo(39.91640428150164, 6);
    const wgs = gcj02ToWgs84(beijingWgs);
    expect(wgs.lng).toBeCloseTo(116.39775550083061, 4);
    expect(wgs.lat).toBeCloseTo(39.91359571849836, 4);
  });

  it("round-trips GCJ-02 back to WGS-84 within a meter", () => {
    const points = [
      beijingWgs,
      { lat: 31.2304, lng: 121.4737 }, // Shanghai
      { lat: 22.5431, lng: 114.0579 }, // Shenzhen
      { lat: 30.5728, lng: 104.0668 }, // Chengdu
    ];
    for (const point of points) {
      const back = gcj02ToWgs84(wgs84ToGcj02(point));
      expect(metersBetween(point, back)).toBeLessThan(1);
    }
  });

  it("leaves points outside China unchanged", () => {
    const newYork = { lat: 40.7128, lng: -74.006 };
    expect(isOutsideChina(newYork)).toBe(true);
    expect(wgs84ToGcj02(newYork)).toEqual(newYork);
    expect(gcj02ToWgs84(newYork)).toEqual(newYork);
  });

  it("does not mutate its input", () => {
    const input = { ...beijingWgs };
    wgs84ToGcj02(input);
    gcj02ToWgs84(input);
    expect(input).toEqual(beijingWgs);
  });
});
