/**
 * Redis SSE sequence tracking tests.
 *
 * Tests the monotonic sequence counter functions for SSE events.
 * @module tests/lib/redis-sse-sequence
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  getNextSSESequence,
  getCurrentSSESequence,
  resetSSESequence,
  disconnectRedis,
} from "../../src/lib/redis.js";

describe("Redis SSE Sequence Tracking", () => {
  const testEventId = "evt_test_sequence_" + Date.now();

  beforeEach(async () => {
    // Reset sequence before each test
    await resetSSESequence(testEventId);
  });

  afterAll(async () => {
    // Cleanup: reset sequence and disconnect
    await resetSSESequence(testEventId);
    await disconnectRedis();
  });

  describe("getNextSSESequence", () => {
    it("should start sequence at 1 for new event", async () => {
      const seq = await getNextSSESequence(testEventId);
      expect(seq).toBe(1);
    });

    it("should increment sequence monotonically", async () => {
      const seq1 = await getNextSSESequence(testEventId);
      const seq2 = await getNextSSESequence(testEventId);
      const seq3 = await getNextSSESequence(testEventId);

      expect(seq1).toBe(1);
      expect(seq2).toBe(2);
      expect(seq3).toBe(3);
    });

    it("should handle concurrent increments atomically", async () => {
      // Simulate concurrent requests
      const promises = Array.from({ length: 10 }, () => getNextSSESequence(testEventId));
      const sequences = await Promise.all(promises);

      // All sequences should be unique
      const uniqueSequences = new Set(sequences);
      expect(uniqueSequences.size).toBe(10);

      // Sequences should be consecutive (1-10 in any order)
      const sortedSequences = sequences.sort((a, b) => a - b);
      expect(sortedSequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });

  describe("getCurrentSSESequence", () => {
    it("should return 0 for uninitialized event", async () => {
      const seq = await getCurrentSSESequence(testEventId);
      expect(seq).toBe(0);
    });

    it("should return current sequence without incrementing", async () => {
      await getNextSSESequence(testEventId); // Increment to 1
      await getNextSSESequence(testEventId); // Increment to 2

      const current1 = await getCurrentSSESequence(testEventId);
      const current2 = await getCurrentSSESequence(testEventId);

      expect(current1).toBe(2);
      expect(current2).toBe(2); // Should not increment
    });

    it("should reflect increments from getNextSSESequence", async () => {
      await getNextSSESequence(testEventId); // 1
      expect(await getCurrentSSESequence(testEventId)).toBe(1);

      await getNextSSESequence(testEventId); // 2
      expect(await getCurrentSSESequence(testEventId)).toBe(2);

      await getNextSSESequence(testEventId); // 3
      expect(await getCurrentSSESequence(testEventId)).toBe(3);
    });
  });

  describe("resetSSESequence", () => {
    it("should reset sequence to 0", async () => {
      await getNextSSESequence(testEventId); // 1
      await getNextSSESequence(testEventId); // 2

      await resetSSESequence(testEventId);

      const current = await getCurrentSSESequence(testEventId);
      expect(current).toBe(0);
    });

    it("should allow sequence to restart from 1 after reset", async () => {
      await getNextSSESequence(testEventId); // 1
      await getNextSSESequence(testEventId); // 2

      await resetSSESequence(testEventId);

      const seq = await getNextSSESequence(testEventId);
      expect(seq).toBe(1);
    });
  });

  describe("Multiple events isolation", () => {
    it("should maintain separate sequences for different events", async () => {
      const eventId1 = `${testEventId}_1`;
      const eventId2 = `${testEventId}_2`;

      // Increment event1
      await getNextSSESequence(eventId1); // 1
      await getNextSSESequence(eventId1); // 2

      // Increment event2
      await getNextSSESequence(eventId2); // 1

      // Verify isolation
      expect(await getCurrentSSESequence(eventId1)).toBe(2);
      expect(await getCurrentSSESequence(eventId2)).toBe(1);

      // Cleanup
      await resetSSESequence(eventId1);
      await resetSSESequence(eventId2);
    });
  });
});
