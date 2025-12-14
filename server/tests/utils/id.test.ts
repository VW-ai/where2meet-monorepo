import { describe, it, expect } from "vitest";

import {
  generateEventId,
  isValidEventId,
  EVENT_ID_PATTERN,
} from "../../src/utils/id.js";

describe("ID Generation Utilities", () => {
  describe("generateEventId", () => {
    it("should generate a valid event ID format", () => {
      const id = generateEventId();
      expect(id).toMatch(EVENT_ID_PATTERN);
    });

    it("should start with evt_ prefix", () => {
      const id = generateEventId();
      expect(id.startsWith("evt_")).toBe(true);
    });

    it("should contain a valid timestamp", () => {
      const before = Date.now();
      const id = generateEventId();
      const after = Date.now();

      const parts = id.split("_");
      const timestamp = parseInt(parts[1], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it("should have 16-character random suffix", () => {
      const id = generateEventId();
      const parts = id.split("_");
      const randomPart = parts[2];

      expect(randomPart).toHaveLength(16);
      expect(randomPart).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it("should generate unique IDs (10,000 iterations)", () => {
      const ids = new Set<string>();
      const count = 10000;

      for (let i = 0; i < count; i++) {
        ids.add(generateEventId());
      }

      expect(ids.size).toBe(count);
    });

    it("should generate unique IDs even in rapid succession", () => {
      // Generate 100 IDs as fast as possible (same millisecond)
      const ids: string[] = [];
      for (let i = 0; i < 100; i++) {
        ids.push(generateEventId());
      }

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });

  describe("EVENT_ID_PATTERN", () => {
    it("should match valid event IDs", () => {
      const validIds = [
        "evt_1702000000000_abcdefghijklmnop",
        "evt_1702000000000_ABCDEFGHIJKLMNOP",
        "evt_1702000000000_0123456789abcdef",
        "evt_9999999999999_aBcDeFgHiJkLmNoP",
        "evt_100000000000000_1234567890123456", // 15-digit timestamp (future)
      ];

      for (const id of validIds) {
        expect(EVENT_ID_PATTERN.test(id)).toBe(true);
      }
    });

    it("should reject invalid event IDs", () => {
      const invalidIds = [
        "", // empty
        "evt", // incomplete
        "evt_", // incomplete
        "evt_123_abc", // timestamp too short
        "evt_1702000000000_abc", // random too short (3 chars)
        "evt_1702000000000_abcdefghijklmno", // random too short (15 chars)
        "evt_1702000000000_abcdefghijklmnopq", // random too long (17 chars)
        "evt_1702000000000_abcdefghijklmno!", // invalid char
        "evt_1702000000000_abcdefghijklmno-", // invalid char
        "event_1702000000000_abcdefghijklmnop", // wrong prefix
        "EVT_1702000000000_abcdefghijklmnop", // wrong prefix case
        "550e8400-e29b-41d4-a716-446655440000", // UUID format
        "evt-1702000000000-abcdefghijklmnop", // wrong separator
      ];

      for (const id of invalidIds) {
        expect(EVENT_ID_PATTERN.test(id)).toBe(false);
      }
    });
  });

  describe("isValidEventId", () => {
    it("should return true for valid event IDs", () => {
      expect(isValidEventId("evt_1702000000000_abcdefghijklmnop")).toBe(true);
      expect(isValidEventId(generateEventId())).toBe(true);
    });

    it("should return false for invalid event IDs", () => {
      expect(isValidEventId("")).toBe(false);
      expect(isValidEventId("invalid")).toBe(false);
      expect(isValidEventId("evt_123_abc")).toBe(false);
      expect(isValidEventId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    });

    it("should return false for null/undefined-like inputs", () => {
      expect(isValidEventId("null")).toBe(false);
      expect(isValidEventId("undefined")).toBe(false);
    });
  });
});
