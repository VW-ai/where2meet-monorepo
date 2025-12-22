/**
 * Unit tests for distance and duration formatting utilities.
 *
 * Tests imperial formatting for distances (miles/feet) and
 * human-readable duration formatting (hours/minutes).
 */

import { describe, it, expect } from "vitest";
import {
  formatDistanceImperial,
  formatDuration,
} from "../../src/lib/directions/format.js";

describe("Directions Formatting", () => {
  describe("formatDistanceImperial", () => {
    it("formats small distances in feet", () => {
      // 80 meters ≈ 262 feet
      expect(formatDistanceImperial(80)).toBe("262 ft");
    });

    it("formats distances under 0.1 miles in feet", () => {
      // 160 meters ≈ 525 feet (about 0.099 miles)
      const result = formatDistanceImperial(160);
      expect(result).toMatch(/^\d+ ft$/);
    });

    it("formats 0.05 miles threshold correctly", () => {
      // Just under 0.1 miles (about 160 meters)
      const result = formatDistanceImperial(80);
      expect(result).toBe("262 ft");
    });

    it("formats distances in miles", () => {
      // 5149 meters ≈ 3.2 miles
      expect(formatDistanceImperial(5149)).toBe("3.2 mi");
    });

    it("formats 1 mile correctly", () => {
      // 1609.344 meters = 1 mile
      expect(formatDistanceImperial(1609.344)).toBe("1 mi");
    });

    it("formats 1.5 miles correctly", () => {
      // 2414 meters ≈ 1.5 miles
      expect(formatDistanceImperial(2414)).toBe("1.5 mi");
    });

    it("rounds miles to 1 decimal place", () => {
      // 5000 meters ≈ 3.107 miles, should round to 3.1
      expect(formatDistanceImperial(5000)).toBe("3.1 mi");
    });

    it("formats 0 meters as 0 feet", () => {
      expect(formatDistanceImperial(0)).toBe("0 ft");
    });

    it("formats large distances correctly", () => {
      // 16093 meters = 10 miles
      expect(formatDistanceImperial(16093.44)).toBe("10 mi");
    });
  });

  describe("formatDuration", () => {
    it("formats seconds under 1 minute as 1 min", () => {
      expect(formatDuration(30)).toBe("1 min");
      expect(formatDuration(59)).toBe("1 min");
    });

    it("formats 1 minute correctly", () => {
      expect(formatDuration(60)).toBe("1 min");
    });

    it("formats 90 seconds as 2 mins", () => {
      // 90 seconds rounds to 2 minutes
      expect(formatDuration(90)).toBe("2 mins");
    });

    it("formats minutes correctly", () => {
      expect(formatDuration(720)).toBe("12 mins");
    });

    it("formats exactly 1 hour", () => {
      expect(formatDuration(3600)).toBe("1 hour");
    });

    it("formats multiple hours", () => {
      expect(formatDuration(7200)).toBe("2 hours");
    });

    it("formats hours and minutes combined", () => {
      // 5400 seconds = 1 hour 30 minutes
      expect(formatDuration(5400)).toBe("1 hour 30 mins");
    });

    it("formats 1 hour 1 minute correctly", () => {
      // 3660 seconds = 1 hour 1 minute
      expect(formatDuration(3660)).toBe("1 hour 1 min");
    });

    it("formats 2 hours 1 minute correctly", () => {
      // 7260 seconds = 2 hours 1 minute
      expect(formatDuration(7260)).toBe("2 hours 1 min");
    });

    it("formats 2 hours 45 minutes correctly", () => {
      // 9900 seconds = 2 hours 45 minutes
      expect(formatDuration(9900)).toBe("2 hours 45 mins");
    });

    it("formats 0 seconds as 1 min", () => {
      expect(formatDuration(0)).toBe("1 min");
    });

    it("rounds partial minutes correctly", () => {
      // 1830 seconds = 30.5 minutes, should round to 31
      expect(formatDuration(1830)).toBe("31 mins");
    });

    it("handles hours with rounding", () => {
      // 3660 seconds = 61 minutes = 1 hour 1 min
      expect(formatDuration(3660)).toBe("1 hour 1 min");
    });
  });
});
