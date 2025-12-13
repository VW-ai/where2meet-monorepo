/**
 * Unit tests for participant color assignment utility.
 */

import { describe, it, expect } from "vitest";
import {
  PARTICIPANT_COLORS,
  assignColor,
  getColorByIndex,
} from "../../src/utils/colors.js";

describe("Color Utility", () => {
  describe("PARTICIPANT_COLORS", () => {
    it("has 16 colors", () => {
      expect(PARTICIPANT_COLORS).toHaveLength(16);
    });

    it("has unique colors", () => {
      const uniqueColors = new Set(PARTICIPANT_COLORS);
      expect(uniqueColors.size).toBe(PARTICIPANT_COLORS.length);
    });

    it("starts with coral", () => {
      expect(PARTICIPANT_COLORS[0]).toBe("coral");
    });
  });

  describe("assignColor", () => {
    it("returns first color when no colors used", () => {
      const color = assignColor([]);
      expect(color).toBe("coral");
    });

    it("returns second color when first is used", () => {
      const color = assignColor(["coral"]);
      expect(color).toBe("teal");
    });

    it("skips used colors", () => {
      const color = assignColor(["coral", "teal", "gold"]);
      expect(color).toBe("orchid");
    });

    it("returns first unused color regardless of order", () => {
      // Skip coral and gold, should return teal
      const color = assignColor(["coral", "gold"]);
      expect(color).toBe("teal");
    });

    it("cycles when all colors are used", () => {
      const allUsed = [...PARTICIPANT_COLORS];
      const color = assignColor(allUsed);
      // 16 % 16 = 0, so returns first color
      expect(color).toBe("coral");
    });

    it("cycles to second color when all used plus one", () => {
      const allPlusOne = [...PARTICIPANT_COLORS, "coral"];
      const color = assignColor(allPlusOne);
      // 17 % 16 = 1, so returns second color
      expect(color).toBe("teal");
    });

    it("handles duplicate used colors", () => {
      const color = assignColor(["coral", "coral", "teal"]);
      expect(color).toBe("gold");
    });
  });

  describe("getColorByIndex", () => {
    it("returns first color for index 0", () => {
      expect(getColorByIndex(0)).toBe("coral");
    });

    it("returns second color for index 1", () => {
      expect(getColorByIndex(1)).toBe("teal");
    });

    it("returns third color for index 2", () => {
      expect(getColorByIndex(2)).toBe("gold");
    });

    it("wraps around at palette length", () => {
      expect(getColorByIndex(16)).toBe("coral");
      expect(getColorByIndex(17)).toBe("teal");
    });

    it("handles large indices", () => {
      const color = getColorByIndex(1000);
      // 1000 % 16 = 8
      expect(color).toBe(PARTICIPANT_COLORS[8]);
    });
  });
});
