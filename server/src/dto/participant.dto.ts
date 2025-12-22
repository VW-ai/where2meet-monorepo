/**
 * Participant DTO interfaces and schemas.
 * @module dto/participant
 */

import { z } from "zod";
import { LocationResponseSchema } from "./common.dto.js";

/**
 * Participant data in API response.
 * Note: address and location are nullable for organizer participants.
 */
export const ParticipantResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string().nullable(),
  location: LocationResponseSchema.nullable(),
  color: z.string(),
  fuzzyLocation: z.boolean(),
  isOrganizer: z.boolean(),
});

export type ParticipantResponse = z.infer<typeof ParticipantResponseSchema>;

/**
 * Response when creating a participant via self-registration.
 * Includes participantToken for self-management.
 */
export const CreateParticipantResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string().nullable(),
  location: LocationResponseSchema.nullable(),
  color: z.string(),
  fuzzyLocation: z.boolean(),
  isOrganizer: z.boolean(),
  participantToken: z.string().optional(),
});

export type CreateParticipantResponse = z.infer<typeof CreateParticipantResponseSchema>;
