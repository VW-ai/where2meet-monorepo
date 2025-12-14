/**
 * Event mapper module.
 *
 * Transforms database entities to Response DTOs with runtime validation.
 * Centralizes all transformation logic for Event and Participant entities.
 * @module mappers/event
 */

import type { Participant } from "../generated/prisma/index.js";
import type { EventWithParticipants } from "../repositories/event.js";
import {
  EventResponseSchema,
  CreateEventResponseSchema,
  ParticipantResponseSchema,
  CreateParticipantResponseSchema,
  type EventResponse,
  type CreateEventResponse,
  type ParticipantResponse,
  type CreateParticipantResponse,
  type MECResponse,
  type EventSettingsResponse,
} from "../dto/index.js";

/**
 * Transforms a Participant entity to ParticipantResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 */
export function toParticipantResponse(entity: Participant): ParticipantResponse {
  const response = {
    id: entity.id,
    name: entity.name,
    address: entity.address,
    location: {
      lat: Number(entity.lat),
      lng: Number(entity.lng),
    },
    color: entity.color,
    fuzzyLocation: entity.fuzzyLocation,
  };

  return ParticipantResponseSchema.parse(response);
}

/**
 * Transforms a Participant entity to CreateParticipantResponse DTO.
 * Includes optional participantToken for self-registration.
 * Validates output at runtime to ensure contract compliance.
 */
export function toCreateParticipantResponse(
  entity: Participant,
  participantToken?: string
): CreateParticipantResponse {
  const response = {
    id: entity.id,
    name: entity.name,
    address: entity.address,
    location: {
      lat: Number(entity.lat),
      lng: Number(entity.lng),
    },
    color: entity.color,
    fuzzyLocation: entity.fuzzyLocation,
    participantToken,
  };

  return CreateParticipantResponseSchema.parse(response);
}

/**
 * Transforms MEC data from event entity to MECResponse DTO.
 * Returns null if no MEC data exists.
 */
export function toMECResponse(_entity: EventWithParticipants): MECResponse | null {
  // MEC fields will be added in Milestone 3
  // For now, return null since Event doesn't have MEC fields yet
  return null;
}

/**
 * Transforms event settings to EventSettingsResponse DTO.
 * Currently uses default values; will be configurable in future.
 */
export function toEventSettingsResponse(): EventSettingsResponse {
  return {
    allowParticipantsAfterPublish: false,
  };
}

/**
 * Transforms an Event entity to EventResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 * Does NOT include organizerToken.
 */
export function toEventResponse(entity: EventWithParticipants): EventResponse {
  const response = {
    id: entity.id,
    title: entity.title,
    meetingTime: entity.meetingTime?.toISOString() ?? null,
    participants: entity.participants.map(toParticipantResponse),
    mec: toMECResponse(entity),
    publishedVenueId: entity.publishedVenueId,
    publishedAt: entity.publishedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    settings: toEventSettingsResponse(),
  };

  return EventResponseSchema.parse(response);
}

/**
 * Transforms an Event entity to CreateEventResponse DTO.
 * Validates output at runtime to ensure contract compliance.
 * Includes organizerToken (only used after creation).
 */
export function toCreateEventResponse(
  entity: EventWithParticipants,
  organizerToken: string
): CreateEventResponse {
  const response = {
    id: entity.id,
    title: entity.title,
    meetingTime: entity.meetingTime?.toISOString() ?? null,
    participants: entity.participants.map(toParticipantResponse),
    mec: toMECResponse(entity),
    publishedVenueId: entity.publishedVenueId,
    publishedAt: entity.publishedAt?.toISOString() ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    settings: toEventSettingsResponse(),
    organizerToken,
  };

  return CreateEventResponseSchema.parse(response);
}
