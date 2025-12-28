/**
 * User validation schemas (Request DTOs).
 *
 * Zod schemas for validating user-related API requests.
 * Response DTOs are defined in dto/.
 * @module schemas/user
 */

import { z } from "zod";

import { EVENT_ID_PATTERN } from "../utils/id.js";

/**
 * Schema for updating user profile.
 */
export const UpdateUserSchema = z
  .object({
    name: z.string().max(255, "Name must be 255 characters or less").nullable().optional(),
    avatarUrl: z.url("Invalid URL format").max(512, "URL must be 512 characters or less").nullable().optional(),
    defaultAddress: z.string().nullable().optional(),
    defaultPlaceId: z.string().max(255, "Place ID must be 255 characters or less").nullable().optional(),
    defaultFuzzyLocation: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.avatarUrl !== undefined ||
      data.defaultAddress !== undefined ||
      data.defaultPlaceId !== undefined ||
      data.defaultFuzzyLocation !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/** Pattern for participant token format (pt_ + 64 hex characters) */
const PARTICIPANT_TOKEN_PATTERN = /^pt_[0-9a-f]{64}$/;

/**
 * Schema for claiming an event.
 * Links a user's account to their anonymous participant token.
 */
export const ClaimEventSchema = z.object({
  eventId: z.string().regex(EVENT_ID_PATTERN, "Invalid event ID format"),
  participantToken: z.string().regex(PARTICIPANT_TOKEN_PATTERN, "Invalid participant token format"),
});

export type ClaimEventInput = z.infer<typeof ClaimEventSchema>;
