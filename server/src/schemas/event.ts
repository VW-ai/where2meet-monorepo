/**
 * Event validation schemas (Request DTOs).
 *
 * Zod schemas for validating event-related API requests.
 * Response DTOs are defined in dto/.
 * @module schemas/event
 */

import { z } from "zod";

import { EVENT_ID_PATTERN } from "../utils/id.js";

const IANA_ZONE_NAME = /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/;

const MeetingTimeZoneSchema = z
  .string()
  .max(64, "Meeting time zone must be 64 characters or less")
  .regex(IANA_ZONE_NAME, "Meeting time zone must be an IANA time zone name");

function zoneHasTime(data: { meetingTime?: string | null; meetingTimeZone?: string | null }) {
  return data.meetingTimeZone === undefined || data.meetingTime !== undefined;
}

const ZONE_WITHOUT_TIME = {
  message: "Meeting time zone can only be sent with a meeting time",
  path: ["meetingTimeZone"],
};

/**
 * Schema for creating a new event.
 */
export const CreateEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(100, "Title must be 100 characters or less"),
    meetingTime: z.iso
      .datetime({ message: "Meeting time must be a valid ISO 8601 datetime" })
      .optional(),
    meetingTimeZone: MeetingTimeZoneSchema.optional(),
  })
  .refine(zoneHasTime, ZONE_WITHOUT_TIME);

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

/**
 * Schema for updating an existing event.
 */
export const UpdateEventSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title cannot be empty")
      .max(100, "Title must be 100 characters or less")
      .optional(),
    meetingTime: z.iso
      .datetime({ message: "Meeting time must be a valid ISO 8601 datetime" })
      .nullable()
      .optional(),
    meetingTimeZone: MeetingTimeZoneSchema.nullable().optional(),
  })
  .refine((data) => data.title !== undefined || data.meetingTime !== undefined, {
    message: "At least one field must be provided",
  })
  .refine(zoneHasTime, ZONE_WITHOUT_TIME);

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

/**
 * Schema for validating event ID parameter.
 * Expects semantic ID format: evt_<timestamp>_<random16>
 */
export const EventIdSchema = z.object({
  id: z.string().regex(EVENT_ID_PATTERN, "Invalid event ID format"),
});

export type EventIdParam = z.infer<typeof EventIdSchema>;

/**
 * Schema for publishing an event with a venue.
 */
export const PublishEventSchema = z.object({
  venueId: z.string().min(1, "Venue ID is required"),
});

export type PublishEventInput = z.infer<typeof PublishEventSchema>;
