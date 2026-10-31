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
  describe("CreateEventSchema mapProvider", () => {
    it("accepts amap and google", () => {
      for (const mapProvider of ["amap", "google"]) {
        const result = CreateEventSchema.safeParse({ title: "Dinner", mapProvider });
        expect(result.success).toBe(true);
      }
    });

    it("leaves mapProvider unset when omitted so the database default applies", () => {
      const result = CreateEventSchema.safeParse({ title: "Dinner" });
      expect(result.success && result.data.mapProvider).toBeUndefined();
    });

    it("rejects unknown providers", () => {
      expect(CreateEventSchema.safeParse({ title: "Dinner", mapProvider: "baidu" }).success).toBe(
        false
      );
    });
  });

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

    it("accepts the organizer's IANA time zone", () => {
      const result = CreateEventSchema.safeParse({
        title: "Dinner",
        meetingTime: "2026-10-17T01:30:00.000Z",
        meetingTimeZone: "America/New_York",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingTimeZone).toBe("America/New_York");
      }
    });

    it("accepts a legacy alias zone that browsers still report", () => {
      const result = CreateEventSchema.safeParse({
        title: "Dinner",
        meetingTime: "2026-10-17T01:30:00.000Z",
        meetingTimeZone: "Asia/Calcutta",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingTimeZone).toBe("Asia/Calcutta");
      }
    });

    it("accepts IANA-shaped zones the server's tzdata may not know", () => {
      for (const meetingTimeZone of ["America/Coyhaique", "Mars/Olympus_Mons"]) {
        const result = CreateEventSchema.safeParse({
          title: "Dinner",
          meetingTime: "2026-10-17T01:30:00.000Z",
          meetingTimeZone,
        });

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.meetingTimeZone).toBe(meetingTimeZone);
        }
      }
    });

    it("rejects a zone that is not shaped like an IANA name", () => {
      for (const meetingTimeZone of ['"; DROP', "America/New York", ""]) {
        const result = CreateEventSchema.safeParse({
          title: "Dinner",
          meetingTime: "2026-10-17T01:30:00.000Z",
          meetingTimeZone,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toBe(
            "Meeting time zone must be an IANA time zone name"
          );
        }
      }
    });

    it("rejects a time zone over 64 characters", () => {
      const result = CreateEventSchema.safeParse({
        title: "Dinner",
        meetingTime: "2026-10-17T01:30:00.000Z",
        meetingTimeZone: `America/${"X".repeat(57)}`,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Meeting time zone must be 64 characters or less"
        );
      }
    });

    it("rejects a time zone without a meeting time", () => {
      const result = CreateEventSchema.safeParse({
        title: "Dinner",
        meetingTimeZone: "America/New_York",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Meeting time zone can only be sent with a meeting time"
        );
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

    it("accepts a new meeting time with its time zone", () => {
      const result = UpdateEventSchema.safeParse({
        meetingTime: "2026-10-17T23:00:00.000Z",
        meetingTimeZone: "Asia/Tokyo",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingTimeZone).toBe("Asia/Tokyo");
      }
    });

    it("accepts a null time zone to clear it", () => {
      const result = UpdateEventSchema.safeParse({
        meetingTime: "2026-10-17T23:00:00.000Z",
        meetingTimeZone: null,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.meetingTimeZone).toBeNull();
      }
    });

    it("rejects a zone that is not shaped like an IANA name", () => {
      const result = UpdateEventSchema.safeParse({
        meetingTime: "2026-10-17T23:00:00.000Z",
        meetingTimeZone: '"; DROP',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Meeting time zone must be an IANA time zone name"
        );
      }
    });

    it("rejects a body with only a time zone", () => {
      const result = UpdateEventSchema.safeParse({ meetingTimeZone: "America/New_York" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("At least one field must be provided");
      }
    });

    it("rejects a time zone sent with a title but no meeting time", () => {
      const result = UpdateEventSchema.safeParse({
        title: "Dinner",
        meetingTimeZone: "America/New_York",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Meeting time zone can only be sent with a meeting time"
        );
      }
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
