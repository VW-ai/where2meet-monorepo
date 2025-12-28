/**
 * User response DTOs.
 *
 * Defines response types for user-related endpoints.
 * @module dto/user
 */

import { z } from "zod";

/**
 * User profile response.
 * Excludes sensitive data like password hashes and session tokens.
 */
export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  emailVerified: z.boolean(),
  defaultAddress: z.string().nullable(),
  defaultPlaceId: z.string().nullable(),
  defaultFuzzyLocation: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;

/**
 * Participant summary in event listing (minimal info).
 */
export const ParticipantSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  isOrganizer: z.boolean(),
});

export type ParticipantSummary = z.infer<typeof ParticipantSummarySchema>;

/**
 * Event summary for user's event listing.
 */
export const UserEventSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  meetingTime: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  participantCount: z.number(),
  participants: z.array(ParticipantSummarySchema),
});

export type UserEventSummary = z.infer<typeof UserEventSummarySchema>;

/**
 * User's link to an event.
 */
export const UserEventResponseSchema = z.object({
  id: z.string(),
  role: z.enum(["organizer", "participant"]),
  participantId: z.string().nullable(),
  createdAt: z.string(),
  event: UserEventSummarySchema,
});

export type UserEventResponse = z.infer<typeof UserEventResponseSchema>;

/**
 * Response for listing user's events.
 */
export const UserEventsListResponseSchema = z.object({
  events: z.array(UserEventResponseSchema),
});

export type UserEventsListResponse = z.infer<typeof UserEventsListResponseSchema>;

/**
 * Response for claiming an event.
 */
export const ClaimEventResponseSchema = z.object({
  success: z.literal(true),
  userEvent: z.object({
    id: z.string(),
    role: z.enum(["organizer", "participant"]),
    participantId: z.string().nullable(),
    eventId: z.string(),
    createdAt: z.string(),
  }),
});

export type ClaimEventResponse = z.infer<typeof ClaimEventResponseSchema>;
