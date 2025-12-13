/**
 * Unit tests for Participant validation schemas.
 *
 * Tests CreateParticipantSchema, UpdateParticipantSchema, and ParticipantIdSchema.
 */

import { describe, it, expect } from "vitest";
import {
  CreateParticipantSchema,
  UpdateParticipantSchema,
  ParticipantIdSchema,
} from "../../src/schemas/participant.js";

describe("Participant Schemas", () => {
  describe("CreateParticipantSchema", () => {
    it("accepts valid input with all fields", () => {
      const input = {
        name: "John Doe",
        address: "123 Main St, New York, NY",
        fuzzyLocation: true,
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("John Doe");
        expect(result.data.address).toBe("123 Main St, New York, NY");
        expect(result.data.fuzzyLocation).toBe(true);
      }
    });

    it("accepts valid input without fuzzyLocation (defaults to false)", () => {
      const input = {
        name: "Jane Doe",
        address: "456 Oak Ave",
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fuzzyLocation).toBe(false);
      }
    });

    it("rejects empty name", () => {
      const input = {
        name: "",
        address: "123 Main St",
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Name is required");
      }
    });

    it("rejects name over 50 characters", () => {
      const input = {
        name: "A".repeat(51),
        address: "123 Main St",
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Name must be 50 characters or less");
      }
    });

    it("rejects empty address", () => {
      const input = {
        name: "John Doe",
        address: "",
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Address is required");
      }
    });

    it("rejects address over 255 characters", () => {
      const input = {
        name: "John Doe",
        address: "A".repeat(256),
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Address must be 255 characters or less");
      }
    });

    it("rejects missing name", () => {
      const input = {
        address: "123 Main St",
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects missing address", () => {
      const input = {
        name: "John Doe",
      };

      const result = CreateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("UpdateParticipantSchema", () => {
    it("accepts valid partial update with name only", () => {
      const input = {
        name: "New Name",
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("New Name");
        expect(result.data.address).toBeUndefined();
      }
    });

    it("accepts valid partial update with address only", () => {
      const input = {
        address: "New Address",
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe("New Address");
        expect(result.data.name).toBeUndefined();
      }
    });

    it("accepts valid partial update with fuzzyLocation only", () => {
      const input = {
        fuzzyLocation: true,
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fuzzyLocation).toBe(true);
      }
    });

    it("accepts valid update with all fields", () => {
      const input = {
        name: "New Name",
        address: "New Address",
        fuzzyLocation: false,
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects empty object (no fields provided)", () => {
      const input = {};

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("At least one field must be provided");
      }
    });

    it("rejects empty name string", () => {
      const input = {
        name: "",
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Name cannot be empty");
      }
    });

    it("rejects empty address string", () => {
      const input = {
        address: "",
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Address cannot be empty");
      }
    });

    it("rejects name over 50 characters", () => {
      const input = {
        name: "A".repeat(51),
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects address over 255 characters", () => {
      const input = {
        address: "A".repeat(256),
      };

      const result = UpdateParticipantSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("ParticipantIdSchema", () => {
    it("accepts valid UUID", () => {
      const input = {
        participantId: "550e8400-e29b-41d4-a716-446655440000",
      };

      const result = ParticipantIdSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID format", () => {
      const input = {
        participantId: "not-a-uuid",
      };

      const result = ParticipantIdSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Invalid participant ID format");
      }
    });

    it("rejects empty string", () => {
      const input = {
        participantId: "",
      };

      const result = ParticipantIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("rejects missing participantId", () => {
      const input = {};

      const result = ParticipantIdSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});
