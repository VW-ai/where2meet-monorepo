/**
 * Event DTO interfaces and schemas.
 * @module dto/event
 */

import { z } from "zod";

import { EVENT_ID_PATTERN } from "../utils/id.js";
import { LocationResponseSchema } from "./common.dto.js";
import { ParticipantResponseSchema } from "./participant.dto.js";

/**
 * Minimum Enclosing Circle result.
 */
export const MECResponseSchema = z.object({
  center: LocationResponseSchema,
  radiusMeters: z.number(),
});

export type MECResponse = z.infer<typeof MECResponseSchema>;

/**
 * Event settings.
 */
export const EventSettingsResponseSchema = z.object({
  allowParticipantsAfterPublish: z.boolean(),
});

export type EventSettingsResponse = z.infer<typeof EventSettingsResponseSchema>;

/**
 * Event data in API response.
 * Note: organizerToken is NOT included.
 */
export const EventResponseSchema = z.object({
  id: z.string().regex(EVENT_ID_PATTERN),
  title: z.string(),
  meetingTime: z.string().nullable(),
  participants: z.array(ParticipantResponseSchema),
  mec: MECResponseSchema.nullable(),
  publishedVenueId: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: EventSettingsResponseSchema,
});

export type EventResponse = z.infer<typeof EventResponseSchema>;

/**
 * Event creation response.
 * Includes organizerToken and organizerParticipantId (only returned on create).
 */
export const CreateEventResponseSchema = EventResponseSchema.extend({
  organizerToken: z.string(),
  organizerParticipantId: z.uuid(),
});

export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;
