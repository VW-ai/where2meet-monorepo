import { describe, it, expect } from "vitest";
import { approximateArea } from "../../src/utils/approximate-area.js";

const SECRET = "test-location-shift-secret-0123456789";
const OTHER_SECRET = "another-location-shift-secret-98765";

const WGS84_EQUATORIAL_RADIUS_M = 6_378_137;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

type Point = { lat: number; lng: number };

function haversineMeters(from: Point, to: Point): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * WGS84_EQUATORIAL_RADIUS_M * Math.asin(Math.sqrt(h));
}

function initialBearingRadians(from: Point, to: Point): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const bearing = Math.atan2(
    Math.sin(dLng) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  );
  return (bearing + 2 * Math.PI) % (2 * Math.PI);
}

function chiSquare(observed: number[]): number {
  const expected = observed.reduce((sum, count) => sum + count, 0) / observed.length;
  return observed.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
}

describe("approximateArea", () => {
  const areaA = {
    lat: expect.closeTo(40.711103370522, 9),
    lng: expect.closeTo(-74.015356395905, 9),
  };
  const areaB = {
    lat: expect.closeTo(40.718147351808, 9),
    lng: expect.closeTo(-73.990205257613, 9),
  };

  it("gives the same area for the same point and secret, and another area under another secret", () => {
    const point = { lat: 40.7128, lng: -74.006 };

    expect([
      approximateArea(point, SECRET),
      approximateArea(point, SECRET),
      approximateArea(point, OTHER_SECRET),
    ]).toEqual([areaA, areaA, areaB]);
  });

  it("treats points that round to the same 5 decimals as one point", () => {
    expect(approximateArea({ lat: 40.712801, lng: -74.006004 }, SECRET)).toEqual(areaA);
  });

  it("keeps every area 800 to 1,600 m away, spread evenly over the ring's area and over directions", () => {
    const distances: number[] = [];
    const annuli = Array<number>(10).fill(0);
    const sectors = Array<number>(8).fill(0);

    for (let i = 0; i < 10_000; i++) {
      const point = {
        lat: (((i * 7919) % 12_000_000) - 6_000_000) / 1e5,
        lng: (((i * 104_729) % 36_000_000) - 18_000_000) / 1e5,
      };
      const area = approximateArea(point, SECRET);
      const distance = haversineMeters(point, area);
      distances.push(distance);
      const annulus = Math.floor((10 * (distance ** 2 - 800 ** 2)) / (1600 ** 2 - 800 ** 2));
      annuli[Math.min(9, Math.max(0, annulus))]++;
      const sector = Math.floor(initialBearingRadians(point, area) / (Math.PI / 4));
      sectors[Math.min(7, sector)]++;
    }

    expect({
      outsideRing: distances.filter((d) => d < 800 - 1 || d > 1600 + 1).length,
      nearest: Math.min(...distances),
      farthest: Math.max(...distances),
      annuli,
      sectors,
    }).toEqual({
      outsideRing: 0,
      nearest: expect.closeTo(800.383, 3),
      farthest: expect.closeTo(1599.773, 3),
      annuli: [941, 971, 1037, 1043, 988, 1008, 980, 1018, 1006, 1008],
      sectors: [1240, 1256, 1305, 1233, 1216, 1227, 1285, 1238],
    });
    const annuliChiSquare = chiSquare(annuli);
    const sectorsChiSquare = chiSquare(sectors);
    expect(annuliChiSquare).toBeCloseTo(8.572, 3);
    expect(sectorsChiSquare).toBeCloseTo(5.2032, 4);
    expect(annuliChiSquare).toBeLessThan(27.88);
    expect(sectorsChiSquare).toBeLessThan(24.32);
  });
});
