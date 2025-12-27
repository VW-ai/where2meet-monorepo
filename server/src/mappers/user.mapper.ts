/**
 * User mapper module.
 *
 * Transforms database entities to Response DTOs with runtime validation.
 * Centralizes all transformation logic for User and UserEvent entities.
 * @module mappers/user
 */

import type { User, UserEvent } from "@prisma/client";
import type { UserEventWithEvent } from "../repositories/userEvent.js";
import {
  UserResponseSchema,
  UserEventResponseSchema,
  ClaimEventResponseSchema,
  type UserResponse,
  type UserEventResponse,
  type ClaimEventResponse,
} from "../dto/index.js";

/**
 * Transforms a User entity to UserResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 * Excludes sensitive fields like password hashes.
 */
export function toUserResponse(entity: User): UserResponse {
  const response = {
    id: entity.id,
    email: entity.email,
    name: entity.name,
    avatarUrl: entity.avatarUrl,
    emailVerified: entity.emailVerified,
    defaultAddress: entity.defaultAddress,
    defaultPlaceId: entity.defaultPlaceId,
    defaultFuzzyLocation: entity.defaultFuzzyLocation,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };

  return UserResponseSchema.parse(response);
}

/**
 * Transforms a UserEvent with event details to UserEventResponse DTO.
 * Includes event summary with participants.
 */
export function toUserEventResponse(entity: UserEventWithEvent): UserEventResponse {
  const response = {
    id: entity.id,
    role: entity.role as "organizer" | "participant",
    participantId: entity.participantId,
    createdAt: entity.createdAt.toISOString(),
    event: {
      id: entity.event.id,
      title: entity.event.title,
      meetingTime: entity.event.meetingTime?.toISOString() ?? null,
      publishedAt: entity.event.publishedAt?.toISOString() ?? null,
      createdAt: entity.event.createdAt.toISOString(),
      participantCount: entity.event._count.participants,
      participants: entity.event.participants.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        isOrganizer: p.isOrganizer,
      })),
    },
  };

  return UserEventResponseSchema.parse(response);
}

/**
 * Transforms a UserEvent to ClaimEventResponse DTO.
 * Used after successfully claiming an event.
 */
export function toClaimEventResponse(entity: UserEvent): ClaimEventResponse {
  const response = {
    success: true as const,
    userEvent: {
      id: entity.id,
      role: entity.role as "organizer" | "participant",
      participantId: entity.participantId,
      eventId: entity.eventId,
      createdAt: entity.createdAt.toISOString(),
    },
  };

  return ClaimEventResponseSchema.parse(response);
}
