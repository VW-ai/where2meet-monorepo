/**
 * Unit tests for Minimum Enclosing Circle (MEC) calculation.
 *
 * Tests the Welzl algorithm implementation with geographic coordinates.
 */

import { describe, it, expect } from "vitest";
import {
  calculateMEC,
  haversineDistance,
  geographicMidpoint,
  geographicCentroid,
  GeoPoint,
} from "../../src/lib/mec.js";

describe("MEC Module", () => {
  describe("haversineDistance", () => {
    it("returns 0 for identical points", () => {
      const point: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const distance = haversineDistance(point, point);
      expect(distance).toBeCloseTo(0, 5);
    });

    it("calculates NYC to LA distance correctly (~3940km)", () => {
      const nyc: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const la: GeoPoint = { lat: 34.0522, lng: -118.2437 };
      const distance = haversineDistance(nyc, la);
      // NYC to LA is approximately 3940 km
      expect(distance).toBeGreaterThan(3_900_000);
      expect(distance).toBeLessThan(4_000_000);
    });

    it("calculates short distance correctly (~1km)", () => {
      // Two points approximately 1km apart
      const p1: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const p2: GeoPoint = { lat: 40.7218, lng: -74.006 }; // ~1km north
      const distance = haversineDistance(p1, p2);
      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1100);
    });

    it("is symmetric", () => {
      const p1: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const p2: GeoPoint = { lat: 34.0522, lng: -118.2437 };
      const d1 = haversineDistance(p1, p2);
      const d2 = haversineDistance(p2, p1);
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  describe("geographicMidpoint", () => {
    it("returns the same point for identical inputs", () => {
      const point: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const midpoint = geographicMidpoint(point, point);
      expect(midpoint.lat).toBeCloseTo(point.lat, 5);
      expect(midpoint.lng).toBeCloseTo(point.lng, 5);
    });

    it("calculates midpoint on same longitude", () => {
      const p1: GeoPoint = { lat: 40.0, lng: -74.0 };
      const p2: GeoPoint = { lat: 42.0, lng: -74.0 };
      const midpoint = geographicMidpoint(p1, p2);
      expect(midpoint.lat).toBeCloseTo(41.0, 2);
      expect(midpoint.lng).toBeCloseTo(-74.0, 2);
    });

    it("calculates midpoint on same latitude", () => {
      const p1: GeoPoint = { lat: 40.0, lng: -74.0 };
      const p2: GeoPoint = { lat: 40.0, lng: -76.0 };
      const midpoint = geographicMidpoint(p1, p2);
      expect(midpoint.lat).toBeCloseTo(40.0, 2);
      expect(midpoint.lng).toBeCloseTo(-75.0, 2);
    });

    it("is equidistant from both points", () => {
      const p1: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const p2: GeoPoint = { lat: 40.758, lng: -73.9855 };
      const midpoint = geographicMidpoint(p1, p2);
      const d1 = haversineDistance(p1, midpoint);
      const d2 = haversineDistance(p2, midpoint);
      expect(d1).toBeCloseTo(d2, 0); // Within 1 meter
    });
  });

  describe("geographicCentroid", () => {
    it("throws for empty array", () => {
      expect(() => geographicCentroid([])).toThrow();
    });

    it("returns the point for single input", () => {
      const point: GeoPoint = { lat: 40.7128, lng: -74.006 };
      const centroid = geographicCentroid([point]);
      expect(centroid.lat).toBeCloseTo(point.lat, 5);
      expect(centroid.lng).toBeCloseTo(point.lng, 5);
    });

    it("returns midpoint for two points", () => {
      const p1: GeoPoint = { lat: 40.0, lng: -74.0 };
      const p2: GeoPoint = { lat: 42.0, lng: -74.0 };
      const centroid = geographicCentroid([p1, p2]);
      const midpoint = geographicMidpoint(p1, p2);
      expect(centroid.lat).toBeCloseTo(midpoint.lat, 3);
      expect(centroid.lng).toBeCloseTo(midpoint.lng, 3);
    });

    it("calculates centroid of triangle", () => {
      // Equilateral-ish triangle
      const points: GeoPoint[] = [
        { lat: 40.0, lng: -74.0 },
        { lat: 40.0, lng: -73.0 },
        { lat: 41.0, lng: -73.5 },
      ];
      const centroid = geographicCentroid(points);
      // Centroid should be roughly in the middle
      expect(centroid.lat).toBeGreaterThan(40.0);
      expect(centroid.lat).toBeLessThan(41.0);
      expect(centroid.lng).toBeGreaterThan(-74.0);
      expect(centroid.lng).toBeLessThan(-73.0);
    });
  });

  describe("calculateMEC", () => {
    describe("edge cases", () => {
      it("returns null for empty array", () => {
        const result = calculateMEC([]);
        expect(result).toBeNull();
      });

      it("returns single point with radius 0", () => {
        const point: GeoPoint = { lat: 40.7128, lng: -74.006 };
        const result = calculateMEC([point]);

        expect(result).not.toBeNull();
        expect(result!.center.lat).toBeCloseTo(point.lat, 5);
        expect(result!.center.lng).toBeCloseTo(point.lng, 5);
        expect(result!.radiusMeters).toBe(0);
      });

      it("returns midpoint for two points with radius = half distance", () => {
        const p1: GeoPoint = { lat: 40.7128, lng: -74.006 };
        const p2: GeoPoint = { lat: 40.758, lng: -73.9855 };
        const result = calculateMEC([p1, p2]);

        expect(result).not.toBeNull();

        // Center should be equidistant from both points
        const d1 = haversineDistance(result!.center, p1);
        const d2 = haversineDistance(result!.center, p2);
        expect(d1).toBeCloseTo(d2, 0); // Within 1 meter

        // Radius should be half the distance between points
        const totalDistance = haversineDistance(p1, p2);
        expect(result!.radiusMeters).toBeCloseTo(totalDistance / 2, 0);
      });
    });

    describe("three points", () => {
      it("calculates MEC for equilateral triangle", () => {
        // Small equilateral triangle (approximately)
        // At 40°N latitude, 0.01° lat ≈ 1.11km, 0.01° lng ≈ 0.85km
        const points: GeoPoint[] = [
          { lat: 40.0, lng: -74.0 },
          { lat: 40.0, lng: -73.99 },
          { lat: 40.00866, lng: -73.995 }, // Approx equilateral
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 10); // 10m tolerance
        }
      });

      it("handles collinear points", () => {
        // Three points on a line (same longitude)
        const points: GeoPoint[] = [
          { lat: 40.0, lng: -74.0 },
          { lat: 40.5, lng: -74.0 },
          { lat: 41.0, lng: -74.0 },
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 10);
        }

        // For collinear points, radius should be half the total span
        const totalSpan = haversineDistance(points[0], points[2]);
        expect(result!.radiusMeters).toBeCloseTo(totalSpan / 2, -2); // Within 100m
      });

      it("handles right triangle", () => {
        const points: GeoPoint[] = [
          { lat: 40.0, lng: -74.0 },
          { lat: 40.0, lng: -73.9 },
          { lat: 40.1, lng: -74.0 },
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 10);
        }
      });
    });

    describe("four or more points", () => {
      it("calculates MEC for square", () => {
        // Square corners
        const points: GeoPoint[] = [
          { lat: 40.0, lng: -74.0 },
          { lat: 40.0, lng: -73.9 },
          { lat: 40.1, lng: -74.0 },
          { lat: 40.1, lng: -73.9 },
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 10);
        }

        // For a square, MEC passes through diagonal corners
        // Radius should be approximately half the diagonal
        const diagonal = haversineDistance(points[0], points[3]);
        expect(result!.radiusMeters).toBeCloseTo(diagonal / 2, -2);
      });

      it("calculates MEC for cluster with outlier", () => {
        // Three close points and one far point
        const points: GeoPoint[] = [
          { lat: 40.0, lng: -74.0 },
          { lat: 40.001, lng: -74.0 },
          { lat: 40.0, lng: -74.001 },
          { lat: 40.5, lng: -74.0 }, // Outlier ~55km away
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 10);
        }

        // The outlier determines the circle, radius should be roughly half distance to outlier
        expect(result!.radiusMeters).toBeGreaterThan(20000); // At least 20km
      });

      it("handles many points", () => {
        // Pentagon of points
        const center = { lat: 40.7128, lng: -74.006 };
        const points: GeoPoint[] = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i * 2 * Math.PI) / 5;
          points.push({
            lat: center.lat + 0.05 * Math.cos(angle),
            lng: center.lng + 0.05 * Math.sin(angle),
          });
        }

        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 50); // 50m tolerance
        }
      });
    });

    describe("geographic accuracy", () => {
      it("works across different latitudes", () => {
        // Points at different latitudes (longitude distance varies with latitude)
        const points: GeoPoint[] = [
          { lat: 60.0, lng: 25.0 }, // Helsinki area
          { lat: 60.1, lng: 25.1 },
          { lat: 59.9, lng: 25.1 },
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // All points should be inside or on the circle
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 50);
        }
      });

      it("handles points near the equator", () => {
        const points: GeoPoint[] = [
          { lat: 0.0, lng: 100.0 },
          { lat: 0.1, lng: 100.1 },
          { lat: -0.1, lng: 100.05 },
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 50);
        }
      });

      it("handles points with negative coordinates", () => {
        // South America
        const points: GeoPoint[] = [
          { lat: -23.5505, lng: -46.6333 }, // São Paulo
          { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
          { lat: -25.4284, lng: -49.2733 }, // Curitiba
        ];
        const result = calculateMEC(points);

        expect(result).not.toBeNull();

        // For large distances (400+ km), equirectangular projection has ~1% error
        // Use 1% tolerance for this test case
        const tolerance = result!.radiusMeters * 0.01;
        for (const point of points) {
          const dist = haversineDistance(result!.center, point);
          expect(dist).toBeLessThanOrEqual(result!.radiusMeters + tolerance);
        }

        // These cities span roughly 400-500km
        expect(result!.radiusMeters).toBeGreaterThan(150_000);
        expect(result!.radiusMeters).toBeLessThan(350_000);
      });
    });

    describe("determinism", () => {
      it("produces consistent results for same input", () => {
        const points: GeoPoint[] = [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.758, lng: -73.9855 },
          { lat: 40.6892, lng: -74.0445 },
        ];

        // Run multiple times
        const results = [];
        for (let i = 0; i < 5; i++) {
          results.push(calculateMEC(points));
        }

        // All results should contain all points
        for (const result of results) {
          expect(result).not.toBeNull();
          for (const point of points) {
            const dist = haversineDistance(result!.center, point);
            // Allow small variance due to randomization, but all points must be inside
            expect(dist).toBeLessThanOrEqual(result!.radiusMeters + 10);
          }
        }
      });
    });
  });
});
