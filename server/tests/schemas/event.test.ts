/**
 * Unit tests for Event validation schemas.
 *
 * Tests CreateEventSchema, UpdateEventSchema, and EventIdSchema.
 */

import { describe, it, expect } from "vitest";
import {
  CreateEventSchema,
  UpdateEventSchema,
  EventIdSchema,
} from "../../src/schemas/event.js";

describe("Event Schemas", () => {
  describe("CreateEventSchema", () => {
    it("accepts valid input with all fields", () => {
      const input = {
        title: "Team Lunch",
        meetingTime: "2025-01-15T12:00:00Z",
      };

      const result = CreateEventSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Team Lunch");
        expect(result.data.meetingTime).toBe("2025-01-15T12:00:00Z");
      }
    });

    it("accepts valid input without meetingTime", () => {
      const input = {
        title: "Team Lunch",
      };

      const result = CreateEventSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Team Lunch");
        expect(result.data.meetingTime).toBeUndefined();
      }
    });

    it("rejects empty title", () => {
      const input = {
        title: "",
      };

      const result = CreateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Title is required");
      }
    });

    it("rejects title over 100 characters", () => {
      const input = {
        title: "A".repeat(101),
      };

      const result = CreateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Title must be 100 characters or less");
      }
    });

    it("rejects missing title", () => {
      const input = {
        meetingTime: "2025-01-15T12:00:00Z",
      };

      const result = CreateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime format", () => {
      const input = {
        title: "Team Lunch",
        meetingTime: "not-a-date",
      };

      const result = CreateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Meeting time must be a valid ISO 8601 datetime"
        );
      }
    });

    it("accepts various ISO 8601 datetime formats", () => {
      // z.iso.datetime() accepts UTC 'Z' format with optional milliseconds
      const validDatetimes = [
        "2025-01-15T12:00:00Z",
        "2025-01-15T12:00:00.000Z",
        "2025-01-15T12:00:00.123Z",
      ];

      for (const meetingTime of validDatetimes) {
        const result = CreateEventSchema.safeParse({
          title: "Test",
          meetingTime,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("UpdateEventSchema", () => {
    it("accepts valid partial update with title only", () => {
      const input = {
        title: "New Title",
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("New Title");
        expect(result.data.meetingTime).toBeUndefined();
      }
    });

    it("accepts valid partial update with meetingTime only", () => {
      const input = {
        meetingTime: "2025-02-20T18:00:00Z",
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingTime).toBe("2025-02-20T18:00:00Z");
        expect(result.data.title).toBeUndefined();
      }
    });

    it("accepts null meetingTime to clear it", () => {
      const input = {
        meetingTime: null,
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingTime).toBeNull();
      }
    });

    it("accepts valid update with all fields", () => {
      const input = {
        title: "New Title",
        meetingTime: "2025-02-20T18:00:00Z",
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects empty object (no fields provided)", () => {
      const input = {};

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("At least one field must be provided");
      }
    });

    it("rejects empty title string", () => {
      const input = {
        title: "",
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Title cannot be empty");
      }
    });

    it("rejects title over 100 characters", () => {
      const input = {
        title: "A".repeat(101),
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects invalid datetime format", () => {
      const input = {
        meetingTime: "invalid-date",
      };

      const result = UpdateEventSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("EventIdSchema", () => {
    it("accepts valid semantic event ID", () => {
      const input = {
        id: "evt_1734100000000_abc123def456ghij",
      };

      const result = EventIdSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects invalid event ID format - missing prefix", () => {
      const input = {
        id: "1734100000000_abc123def456ghij",
      };

      const result = EventIdSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Invalid event ID format");
      }
    });

    it("rejects invalid event ID format - wrong prefix", () => {
      const input = {
        id: "event_1734100000000_abc123def456ghij",
      };

      const result = EventIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects UUID format", () => {
      const input = {
        id: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = EventIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects empty string", () => {
      const input = {
        id: "",
      };

      const result = EventIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects missing id", () => {
      const input = {};

      const result = EventIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});
