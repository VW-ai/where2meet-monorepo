/**
 * Participant service module.
 *
 * Contains business logic for participant operations including
 * geocoding and color assignment.
 * @module services/participant
 */

import type { PrismaClient, Participant } from "@prisma/client";
import {
  createParticipantRepository,
  type ParticipantRepository,
  type UpdateParticipantData,
} from "../repositories/participant.js";
import { createEventRepository, type EventRepository } from "../repositories/event.js";
import type { CreateParticipantInput, UpdateParticipantInput } from "../schemas/participant.js";
import {
  EventNotFoundError,
  ParticipantNotFoundError,
  EventAlreadyPublishedError,
  AddressNotFoundError as BusinessAddressNotFoundError,
  ExternalServiceError,
  ForbiddenError,
  ValidationError,
} from "../types/errors.js";
import { geocode, AddressNotFoundError, GeocodingApiError } from "../lib/maps.js";
import { assignColor } from "../utils/colors.js";
import { createLogger } from "../lib/logger.js";
import { generateParticipantToken, verifyToken, hashToken } from "../utils/token.js";

/**
 * Result of adding a participant, optionally includes token for self-registration.
 */
export interface AddParticipantResult {
  participant: Participant;
  participantToken?: string;
}

const logger = createLogger("ParticipantService");

export const HIDE_ADDRESS_UNAVAILABLE =
  'Hiding the exact address is no longer available. Turn off "Hide exact address" and save again.';

/**
 * Geocodes an address and converts errors to business errors.
 * @param address - Address to geocode
 * @returns Geocode result
 * @throws BusinessAddressNotFoundError if address not found
 * @throws ExternalServiceError on API failures
 */
async function geocodeWithBusinessErrors(
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  try {
    return await geocode(address);
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      throw new BusinessAddressNotFoundError();
    }
    if (error instanceof GeocodingApiError) {
      logger.error({ err: error }, "Geocoding API error");
      throw new ExternalServiceError("Google Maps", error.message);
    }
    throw error;
  }
}

/**
 * Service for participant business logic.
 */
export class ParticipantService {
  private readonly participantRepo: ParticipantRepository;
  private readonly eventRepo: EventRepository;

  constructor(db: PrismaClient) {
    this.participantRepo = createParticipantRepository(db);
    this.eventRepo = createEventRepository(db);
  }

  /**
   * Checks if an event is published.
   * Uses lightweight query that only fetches publishedAt field.
   * @param eventId - Event ID
   * @returns True if event is published
   * @throws EventNotFoundError if event doesn't exist
   */
  private async isEventPublished(eventId: string): Promise<boolean> {
    const status = await this.eventRepo.getPublishStatus(eventId);
    if (!status) {
      throw new EventNotFoundError(eventId);
    }
    return status.publishedAt !== null;
  }

  /**
   * Ensures an event exists and is not published.
   * @param eventId - Event ID
   * @throws EventNotFoundError if event doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   */
  private async ensureEventModifiable(eventId: string): Promise<void> {
    if (await this.isEventPublished(eventId)) {
      throw new EventAlreadyPublishedError();
    }
  }

  /**
   * Adds a new participant to an event.
   * @param eventId - Event ID
   * @param input - Participant creation data
   * @param options - Options for participant creation
   * @param options.generateToken - If true, generates a participantToken for self-management
   * @returns Created participant and optional token
   * @throws EventNotFoundError if event doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   * @throws ValidationError if the input asks to hide the exact address
   * @throws BusinessAddressNotFoundError if address cannot be geocoded
   */
  async addParticipant(
    eventId: string,
    input: CreateParticipantInput,
    options: { generateToken?: boolean } = {}
  ): Promise<AddParticipantResult> {
    // Check event exists and is not published
    await this.ensureEventModifiable(eventId);

    if (input.fuzzyLocation) {
      throw new ValidationError(HIDE_ADDRESS_UNAVAILABLE);
    }

    const { lat, lng, formattedAddress } = await geocodeWithBusinessErrors(input.address);

    // Assign color
    const usedColors = await this.participantRepo.getUsedColors(eventId);
    const color = assignColor(usedColors);

    // Generate token if requested (for self-registration)
    let tokenHash: string | undefined;
    let participantToken: string | undefined;
    if (options.generateToken) {
      const tokenData = generateParticipantToken();
      tokenHash = tokenData.hash;
      participantToken = tokenData.token;
    }

    // Create participant
    const participant = await this.participantRepo.create({
      eventId,
      name: input.name,
      address: input.address,
      formattedAddress,
      lat,
      lng,
      color,
      tokenHash,
    });

    logger.info(
      { eventId, participantId: participant.id, color, hasToken: !!participantToken },
      "Participant added"
    );

    return { participant, participantToken };
  }

  /**
   * Updates a participant.
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @param input - Fields to update
   * @returns Updated participant entity
   * @throws EventNotFoundError if event doesn't exist
   * @throws ParticipantNotFoundError if participant doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   * @throws ValidationError if the input asks to hide the exact address
   * @throws BusinessAddressNotFoundError if new address cannot be geocoded
   */
  async updateParticipant(
    eventId: string,
    participantId: string,
    input: UpdateParticipantInput
  ): Promise<Participant> {
    // Check event exists and is not published
    await this.ensureEventModifiable(eventId);

    // Check participant exists and belongs to event
    const exists = await this.participantRepo.belongsToEvent(participantId, eventId);
    if (!exists) {
      throw new ParticipantNotFoundError(participantId);
    }

    const current = await this.participantRepo.findById(participantId);
    if (!current) {
      throw new ParticipantNotFoundError(participantId);
    }

    if (input.fuzzyLocation === true && (input.address !== undefined || !current.fuzzyLocation)) {
      throw new ValidationError(HIDE_ADDRESS_UNAVAILABLE);
    }

    const newAddress =
      input.address !== undefined && input.address !== current.address ? input.address : undefined;
    const updateData: UpdateParticipantData = { name: input.name };
    if (newAddress !== undefined) {
      const { lat, lng, formattedAddress } = await geocodeWithBusinessErrors(newAddress);
      updateData.exactLocation = { address: newAddress, formattedAddress, lat, lng };
    }

    const updated = await this.participantRepo.update(participantId, updateData);

    logger.info({ eventId, participantId }, "Participant updated");

    return updated;
  }

  /**
   * Deletes a participant.
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @throws EventNotFoundError if event doesn't exist
   * @throws ParticipantNotFoundError if participant doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   * @throws ForbiddenError if participant is the organizer
   */
  async deleteParticipant(eventId: string, participantId: string): Promise<void> {
    // Check event exists and is not published
    await this.ensureEventModifiable(eventId);

    // Fetch participant to check isOrganizer
    const participant = await this.participantRepo.findById(participantId);
    if (participant?.eventId !== eventId) {
      throw new ParticipantNotFoundError(participantId);
    }

    // Prevent organizer deletion
    if (participant.isOrganizer) {
      throw new ForbiddenError("Cannot delete the organizer participant");
    }

    await this.participantRepo.delete(participantId);

    logger.info({ eventId, participantId }, "Participant deleted");
  }

  /**
   * Gets a participant by ID.
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @returns Participant entity
   * @throws EventNotFoundError if event doesn't exist
   * @throws ParticipantNotFoundError if participant doesn't exist
   */
  async getParticipant(eventId: string, participantId: string): Promise<Participant> {
    // Verify event exists
    const eventExists = await this.eventRepo.exists(eventId);
    if (!eventExists) {
      throw new EventNotFoundError(eventId);
    }

    // Check participant exists and belongs to event
    const participant = await this.participantRepo.findById(participantId);
    if (participant?.eventId !== eventId) {
      throw new ParticipantNotFoundError(participantId);
    }

    return participant;
  }

  /**
   * Verifies a participant token.
   * @param participantId - Participant ID
   * @param token - Plaintext participant token
   * @returns True if token is valid for the participant
   */
  async verifyParticipantToken(participantId: string, token: string): Promise<boolean> {
    const storedHash = await this.participantRepo.getTokenHash(participantId);
    if (!storedHash) {
      return false;
    }
    return verifyToken(token, storedHash);
  }

  /**
   * Finds a participant within an event by their token.
   * Used for event-level authentication where any participant token is valid.
   * @param eventId - Event ID to search within
   * @param token - Plaintext participant token
   * @returns Participant ID if found, null otherwise
   */
  async findParticipantByToken(eventId: string, token: string): Promise<string | null> {
    const tokenHash = hashToken(token);
    return this.participantRepo.findByTokenHash(eventId, tokenHash);
  }

  /**
   * Finds a participant within an event by their token, including isOrganizer flag.
   * Used for unified authentication where authorization is based on isOrganizer.
   * @param eventId - Event ID to search within
   * @param token - Plaintext participant token
   * @returns Participant ID and isOrganizer flag if found, null otherwise
   */
  async findParticipantByTokenWithDetails(
    eventId: string,
    token: string
  ): Promise<{ participantId: string; isOrganizer: boolean } | null> {
    const tokenHash = hashToken(token);
    const result = await this.participantRepo.findByTokenHashWithDetails(eventId, tokenHash);
    if (!result) {
      return null;
    }
    return { participantId: result.id, isOrganizer: result.isOrganizer };
  }
}

/**
 * Creates a new ParticipantService instance.
 * @param db - Prisma client instance
 * @returns ParticipantService instance
 */
export function createParticipantService(db: PrismaClient): ParticipantService {
  return new ParticipantService(db);
}
