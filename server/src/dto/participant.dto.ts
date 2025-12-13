/**
 * Participant DTO interfaces and schemas.
 * @module dto/participant
 */

import { z } from "zod";
import { LocationResponseSchema } from "./common.dto.js";

/**
 * Participant data in API response.
 */
export const ParticipantResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  location: LocationResponseSchema,
  color: z.string(),
  fuzzyLocation: z.boolean(),
});

export type ParticipantResponse = z.infer<typeof ParticipantResponseSchema>;
