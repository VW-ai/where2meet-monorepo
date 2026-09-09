/**
 * Participant repository module.
 *
 * Handles all database operations for Participant entities.
 * @module repositories/participant
 */

import type { PrismaClient, Participant } from "@prisma/client";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("ParticipantRepository");

/**
 * Data for creating a new participant in the database.
 * Coordinates come from geocoding service, color from assignment logic.
 * Note: Location fields are nullable for organizer participants.
 */
export interface CreateParticipantData {
  eventId: string;
  name: string;
  address: string | null;
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  fuzzyLocation: boolean;
  color: string;
  tokenHash?: string;
  isOrganizer?: boolean;
}

/**
 * Data for updating a participant.
 * If address changes, new coordinates should be provided.
 */
export interface UpdateParticipantData {
  name?: string;
  address?: string;
  formattedAddress?: string;
  lat?: number;
  lng?: number;
  fuzzyLocation?: boolean;
}

/**
 * Repository for Participant database operations.
 */
export class ParticipantRepository {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Creates a new participant in the database.
   * @param data - Participant data including geocoded coordinates and assigned color
   * @returns Created participant
   */
  async create(data: CreateParticipantData): Promise<Participant> {
    logger.debug({ eventId: data.eventId, name: data.name }, "Creating participant");

    return this.db.participant.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        address: data.address,
        formattedAddress: data.formattedAddress,
        lat: data.lat,
        lng: data.lng,
        fuzzyLocation: data.fuzzyLocation,
        color: data.color,
        tokenHash: data.tokenHash,
        isOrganizer: data.isOrganizer ?? false,
      },
    });
  }

  /**
   * Finds a participant by its ID.
   * @param id - Participant UUID
   * @returns Participant or null if not found
   */
  async findById(id: string): Promise<Participant | null> {
    return this.db.participant.findUnique({
      where: { id },
    });
  }

  /**
   * Finds all participants for an event.
   * @param eventId - Event ID
   * @returns Array of participants ordered by creation time
   */
  async findByEventId(eventId: string): Promise<Participant[]> {
    return this.db.participant.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Gets colors already used by participants in an event.
   * Used for color assignment to avoid duplicates.
   * @param eventId - Event ID
   * @returns Array of color strings currently in use
   */
  async getUsedColors(eventId: string): Promise<string[]> {
    const participants = await this.db.participant.findMany({
      where: { eventId },
      select: { color: true },
    });
    return participants.map((p) => p.color);
  }

  /**
   * Counts participants in an event.
   * @param eventId - Event ID
   * @returns Number of participants
   */
  async countByEventId(eventId: string): Promise<number> {
    return this.db.participant.count({
      where: { eventId },
    });
  }

  /**
   * Updates a participant.
   * @param id - Participant UUID
   * @param data - Fields to update
   * @returns Updated participant
   */
  async update(id: string, data: UpdateParticipantData): Promise<Participant> {
    logger.debug({ participantId: id }, "Updating participant");

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.address !== undefined) {
      updateData.address = data.address;
    }

    if (data.formattedAddress !== undefined) {
      updateData.formattedAddress = data.formattedAddress;
    }

    if (data.lat !== undefined) {
      updateData.lat = data.lat;
    }

    if (data.lng !== undefined) {
      updateData.lng = data.lng;
    }

    if (data.fuzzyLocation !== undefined) {
      updateData.fuzzyLocation = data.fuzzyLocation;
    }

    return this.db.participant.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Deletes a participant.
   * @param id - Participant UUID
   * @returns Deleted participant
   */
  async delete(id: string): Promise<Participant> {
    logger.debug({ participantId: id }, "Deleting participant");

    return this.db.participant.delete({
      where: { id },
    });
  }

  /**
   * Checks if a participant exists.
   * @param id - Participant UUID
   * @returns True if participant exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.db.participant.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Checks if a participant belongs to a specific event.
   * @param id - Participant UUID
   * @param eventId - Event ID
   * @returns True if participant exists and belongs to the event
   */
  async belongsToEvent(id: string, eventId: string): Promise<boolean> {
    const count = await this.db.participant.count({
      where: { id, eventId },
    });
    return count > 0;
  }

  /**
   * Gets the tokenHash for a participant.
   * @param id - Participant UUID
   * @returns Token hash or null if participant doesn't exist or has no token
   */
  async getTokenHash(id: string): Promise<string | null> {
    const participant = await this.db.participant.findUnique({
      where: { id },
      select: { tokenHash: true },
    });
    return participant?.tokenHash ?? null;
  }

  /**
   * Finds a participant by token hash within an event.
   * Used for event-level authentication where any participant token is valid.
   * @param eventId - Event ID to search within
   * @param tokenHash - Hashed token to match
   * @returns Participant ID if found, null otherwise
   */
  async findByTokenHash(eventId: string, tokenHash: string): Promise<string | null> {
    const participant = await this.db.participant.findFirst({
      where: {
        eventId,
        tokenHash,
      },
      select: { id: true },
    });
    return participant?.id ?? null;
  }

  /**
   * Finds a participant by token hash within an event, including isOrganizer flag.
   * Used for unified authentication where authorization is based on isOrganizer.
   * @param eventId - Event ID to search within
   * @param tokenHash - Hashed token to match
   * @returns Participant ID and isOrganizer flag if found, null otherwise
   */
  async findByTokenHashWithDetails(
    eventId: string,
    tokenHash: string
  ): Promise<{ id: string; isOrganizer: boolean } | null> {
    const participant = await this.db.participant.findFirst({
      where: {
        eventId,
        tokenHash,
      },
      select: { id: true, isOrganizer: true },
    });
    return participant;
  }
}

/**
 * Creates a new ParticipantRepository instance.
 * @param db - Prisma client instance
 * @returns ParticipantRepository instance
 */
export function createParticipantRepository(db: PrismaClient): ParticipantRepository {
  return new ParticipantRepository(db);
}
