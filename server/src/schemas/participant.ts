/**
 * Participant validation schemas (Request DTOs).
 *
 * Zod schemas for validating participant-related API requests.
 * Response DTOs are defined in dto/.
 * @module schemas/participant
 */

import { z } from "zod";

/**
 * Schema for creating a new participant.
 */
export const CreateParticipantSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  address: z
    .string()
    .min(1, "Address is required")
    .max(255, "Address must be 255 characters or less"),
  fuzzyLocation: z.boolean().optional().default(false),
});

export type CreateParticipantInput = z.infer<typeof CreateParticipantSchema>;

/**
 * Schema for updating an existing participant.
 */
export const UpdateParticipantSchema = z
  .object({
    name: z
      .string()
      .min(1, "Name cannot be empty")
      .max(50, "Name must be 50 characters or less")
      .optional(),
    address: z
      .string()
      .min(1, "Address cannot be empty")
      .max(255, "Address must be 255 characters or less")
      .optional(),
    fuzzyLocation: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.address !== undefined ||
      data.fuzzyLocation !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export type UpdateParticipantInput = z.infer<typeof UpdateParticipantSchema>;

/**
 * Schema for validating participant ID parameter.
 * Expects UUID format.
 */
export const ParticipantIdSchema = z.object({
  participantId: z.uuid("Invalid participant ID format"),
});

export type ParticipantIdParam = z.infer<typeof ParticipantIdSchema>;
