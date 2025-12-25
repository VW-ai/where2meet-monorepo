/**
 * Participant service module.
 *
 * Contains business logic for participant operations including
 * geocoding, color assignment, and fuzzy location handling.
 * @module services/participant
 */

import type { PrismaClient, Participant } from "@prisma/client";
import {
  createParticipantRepository,
  type ParticipantRepository,
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

/** Maximum offset in meters for fuzzy location (~0.5 mile) */
const FUZZY_OFFSET_METERS = 800;

/** Meters per degree of latitude (approximate) */
const METERS_PER_LAT_DEGREE = 111_320;

/**
 * Applies a deterministic fuzzy offset to coordinates.
 *
 * Uses participant name as seed for consistent offset across requests.
 * @param lat - Original latitude
 * @param lng - Original longitude
 * @param seed - Seed string for deterministic randomness (e.g., participant name)
 * @returns Offset coordinates
 */
function applyFuzzyOffset(lat: number, lng: number, seed: string): { lat: number; lng: number } {
  // Simple hash function for deterministic "randomness"
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use hash to generate angle and distance
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const distance = (Math.abs(hash >> 8) % FUZZY_OFFSET_METERS) + 100; // 100m - 800m

  // Calculate offset in degrees
  const latOffset = (distance * Math.cos(angle)) / METERS_PER_LAT_DEGREE;
  const lngOffset =
    (distance * Math.sin(angle)) / (METERS_PER_LAT_DEGREE * Math.cos(lat * (Math.PI / 180)));

  return {
    lat: lat + latOffset,
    lng: lng + lngOffset,
  };
}

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
      throw new BusinessAddressNotFoundError(address);
    }
    if (error instanceof GeocodingApiError) {
      logger.error({ err: error, address }, "Geocoding API error");
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
   * @throws BusinessAddressNotFoundError if address cannot be geocoded
   */
  async addParticipant(
    eventId: string,
    input: CreateParticipantInput,
    options: { generateToken?: boolean } = {}
  ): Promise<AddParticipantResult> {
    // Check event exists and is not published
    await this.ensureEventModifiable(eventId);

    // Geocode the address
    const geocodeResult = await geocodeWithBusinessErrors(input.address);

    // Apply fuzzy offset if requested
    let { lat, lng } = geocodeResult;
    if (input.fuzzyLocation) {
      const offset = applyFuzzyOffset(lat, lng, input.name);
      lat = offset.lat;
      lng = offset.lng;
    }

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
      formattedAddress: geocodeResult.formattedAddress,
      lat,
      lng,
      fuzzyLocation: input.fuzzyLocation,
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

    // Get current participant for potential re-geocoding
    const current = await this.participantRepo.findById(participantId);
    if (!current) {
      throw new ParticipantNotFoundError(participantId);
    }

    // Build update data
    const updateData: {
      name?: string;
      address?: string;
      formattedAddress?: string;
      lat?: number;
      lng?: number;
      fuzzyLocation?: boolean;
    } = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
    }

    if (input.fuzzyLocation !== undefined) {
      updateData.fuzzyLocation = input.fuzzyLocation;
    }

    // Re-geocode if address changed
    if (input.address !== undefined && input.address !== current.address) {
      const geocodeResult = await geocodeWithBusinessErrors(input.address);

      updateData.address = input.address;
      updateData.formattedAddress = geocodeResult.formattedAddress;

      // Apply fuzzy offset using the name (current or updated)
      const nameForOffset = input.name ?? current.name;
      const shouldFuzzy = input.fuzzyLocation ?? current.fuzzyLocation;

      if (shouldFuzzy) {
        const offset = applyFuzzyOffset(geocodeResult.lat, geocodeResult.lng, nameForOffset);
        updateData.lat = offset.lat;
        updateData.lng = offset.lng;
      } else {
        updateData.lat = geocodeResult.lat;
        updateData.lng = geocodeResult.lng;
      }
    } else if (
      input.fuzzyLocation !== undefined &&
      input.fuzzyLocation !== current.fuzzyLocation &&
      current.address !== null
    ) {
      // Fuzzy setting changed but address didn't - need to re-apply or remove offset
      // For simplicity, we re-geocode to get clean coordinates
      // Note: Skip this for organizer participants (null address)
      const geocodeResult = await geocodeWithBusinessErrors(current.address);
      const nameForOffset = input.name ?? current.name;

      if (input.fuzzyLocation) {
        const offset = applyFuzzyOffset(geocodeResult.lat, geocodeResult.lng, nameForOffset);
        updateData.lat = offset.lat;
        updateData.lng = offset.lng;
      } else {
        updateData.lat = geocodeResult.lat;
        updateData.lng = geocodeResult.lng;
      }
      updateData.formattedAddress = geocodeResult.formattedAddress;
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
}

/**
 * Creates a new ParticipantService instance.
 * @param db - Prisma client instance
 * @returns ParticipantService instance
 */
export function createParticipantService(db: PrismaClient): ParticipantService {
  return new ParticipantService(db);
}
