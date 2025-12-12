/**
 * Event validation schemas.
 *
 * Zod schemas for validating event-related API requests.
 * @module schemas/event
 */

import { z } from "zod";

/**
 * Schema for creating a new event.
 */
export const CreateEventSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be 100 characters or less"),
  meetingTime: z.iso
    .datetime({ message: "Meeting time must be a valid ISO 8601 datetime" })
    .optional(),
});

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
  })
  .refine((data) => data.title !== undefined || data.meetingTime !== undefined, {
    message: "At least one field must be provided",
  });

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

/**
 * Schema for validating event ID parameter.
 */
export const EventIdSchema = z.object({
  id: z.uuid("Invalid event ID format"),
});

export type EventIdParam = z.infer<typeof EventIdSchema>;

/**
 * Participant response schema (for nested response).
 */
export const ParticipantResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  color: z.string(),
  fuzzyLocation: z.boolean(),
});

export type ParticipantResponse = z.infer<typeof ParticipantResponseSchema>;

/**
 * Event settings schema.
 */
export const EventSettingsSchema = z.object({
  allowParticipantsAfterPublish: z.boolean().default(false),
});

export type EventSettings = z.infer<typeof EventSettingsSchema>;

/**
 * Full event response schema (for GET /api/events/:id).
 * Note: organizerToken is NOT included in response.
 */
export const EventResponseSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  meetingTime: z.iso.datetime().nullable(),
  organizerId: z.string(),
  participants: z.array(ParticipantResponseSchema),
  publishedVenueId: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  settings: EventSettingsSchema,
});

export type EventResponse = z.infer<typeof EventResponseSchema>;

/**
 * Event creation response (includes organizerToken, only returned on create).
 */
export const CreateEventResponseSchema = EventResponseSchema.extend({
  organizerToken: z.string(),
});

export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;
