import { describe, it, expect } from "vitest";
import { approximateLocation } from "../../src/utils/approximate-location.js";
import { drawWith } from "../helpers/random-draws.js";

const EXACT = { lat: 40.7128, lng: -74.006 };
const RADIUS_SPLITTING_RING_AREA_IN_HALF = Math.sqrt((800 ** 2 + 1600 ** 2) / 2);

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function distanceAndBearing(from: typeof EXACT, to: typeof EXACT) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const [lat1, lat2] = [radians(from.lat), radians(to.lat)];
  const dLat = lat2 - lat1;
  const dLng = radians(to.lng - from.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * 6_378_137 * Math.asin(Math.sqrt(h));
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { meters, bearing };
}

const rounded = ({ meters, bearing }: { meters: number; bearing: number }) => ({
  meters: Math.round(meters),
  bearing: Math.round(bearing) % 360,
});

describe("approximateLocation", () => {
  it("maps fixed draws to 800 m north, 1058 m east, 1265 m south, and 1600 m north", () => {
    const picks = [
      () => 0,
      (max: number) => max / 4,
      (max: number) => max / 2,
      (max: number) => max - 1,
    ];

    const areas = picks.map((pick) => {
      drawWith(pick);
      return rounded(distanceAndBearing(EXACT, approximateLocation(EXACT)));
    });

    expect(areas).toEqual([
      { meters: 800, bearing: 0 },
      { meters: 1058, bearing: 90 },
      { meters: 1265, bearing: 180 },
      { meters: 1600, bearing: 0 },
    ]);
  });

  it("spreads areas evenly over every direction and the whole 800 to 1600 m ring", () => {
    const next = mulberry32(20_261_016);
    drawWith((max) => Math.floor(next() * max));

    const samples = Array.from({ length: 10_000 }, () =>
      distanceAndBearing(EXACT, approximateLocation(EXACT))
    );
    const meters = samples.map((sample) => sample.meters);
    const shareByOctant = Array.from(
      { length: 8 },
      (_, octant) =>
        samples.filter((sample) => Math.floor(sample.bearing / 45) === octant).length /
        samples.length
    );
    const shareInInnerHalf =
      meters.filter((m) => m < RADIUS_SPLITTING_RING_AREA_IN_HALF).length / samples.length;

    expect(Math.min(...meters)).toBeGreaterThan(799.5);
    expect(Math.min(...meters)).toBeLessThan(802);
    expect(Math.max(...meters)).toBeGreaterThan(1598);
    expect(Math.max(...meters)).toBeLessThan(1600.5);
    expect(Math.min(...shareByOctant)).toBeGreaterThan(0.1);
    expect(Math.max(...shareByOctant)).toBeLessThan(0.15);
    expect(shareInInnerHalf).toBeGreaterThan(0.47);
    expect(shareInInnerHalf).toBeLessThan(0.53);
  });
});
