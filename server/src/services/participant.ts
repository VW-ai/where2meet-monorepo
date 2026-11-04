/**
 * Participant service module.
 *
 * Contains business logic for participant operations including
 * geocoding and color assignment.
 * @module services/participant
 */

import type { MapProvider, PrismaClient, Participant } from "@prisma/client";
import type { ParticipantAuthContext } from "../hooks/auth.js";
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
  ParticipantNotClaimableError,
  ValidationError,
} from "../types/errors.js";
import { AddressNotFoundError, GeocodingApiError } from "../lib/maps.js";
import { providerFor } from "../lib/providers/index.js";
import { assignColor } from "../utils/colors.js";
import { createLogger } from "../lib/logger.js";
import { generateParticipantToken, verifyToken, hashToken } from "../utils/token.js";
import { isClaimable } from "../utils/claimable.js";

/**
 * Result of adding a participant, optionally includes token for self-registration.
 */
export interface AddParticipantResult {
  participant: Participant;
  participantToken?: string;
}

const logger = createLogger("ParticipantService");

const HIDE_ADDRESS_UNAVAILABLE =
  "Hiding the exact address is no longer available. Reload the page, then enter a nearby cross street or station instead of your address.";

/**
 * Geocodes an address and converts errors to business errors.
 * @param mapProvider - Provider of the participant's event
 * @param address - Address to geocode
 * @returns Geocode result
 * @throws BusinessAddressNotFoundError if address not found
 * @throws ExternalServiceError on API failures
 */
async function geocodeWithBusinessErrors(
  mapProvider: MapProvider,
  address: string
): Promise<{ lat: number; lng: number; formattedAddress: string }> {
  const provider = providerFor(mapProvider);
  try {
    return await provider.geocode(address);
  } catch (error) {
    if (error instanceof AddressNotFoundError) {
      throw new BusinessAddressNotFoundError();
    }
    if (error instanceof GeocodingApiError) {
      logger.error({ err: error }, "Geocoding API error");
      throw new ExternalServiceError(provider.displayName, error.message);
    }
    throw error;
  }
}

/**
 * People own their travel mode. The organizer picks it only for rows nobody has
 * claimed, so a row that holds its own token is off limits to them.
 * @param actor - Who is making the change
 * @param target - Participant whose mode would change
 * @returns True if the actor may set the target's travel mode
 */
function canSetTravelMode(actor: ParticipantAuthContext, target: Participant): boolean {
  return actor.participantId === target.id || (actor.isOrganizer && isClaimable(target));
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
   * Ensures an event exists and is not published.
   * @param eventId - Event ID
   * @returns The event's map provider, which geocodes participant addresses
   * @throws EventNotFoundError if event doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   */
  private async ensureEventModifiable(eventId: string): Promise<MapProvider> {
    const status = await this.eventRepo.getStatus(eventId);
    if (!status) {
      throw new EventNotFoundError(eventId);
    }
    if (status.publishedAt !== null) {
      throw new EventAlreadyPublishedError();
    }
    return status.mapProvider;
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
   * @throws ValidationError if the input sets fuzzyLocation to true
   * @throws BusinessAddressNotFoundError if address cannot be geocoded
   */
  async addParticipant(
    eventId: string,
    input: CreateParticipantInput,
    options: { generateToken?: boolean } = {}
  ): Promise<AddParticipantResult> {
    // Check event exists and is not published
    const mapProvider = await this.ensureEventModifiable(eventId);

    if (input.fuzzyLocation) {
      throw new ValidationError(HIDE_ADDRESS_UNAVAILABLE);
    }

    const { lat, lng, formattedAddress } = await geocodeWithBusinessErrors(
      mapProvider,
      input.address
    );

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
      travelMode: input.travelMode,
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
   * @param actor - Authenticated participant making the change
   * @returns Updated participant entity
   * @throws EventNotFoundError if event doesn't exist
   * @throws ParticipantNotFoundError if participant doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   * @throws ValidationError if the input sets fuzzyLocation to true
   * @throws ForbiddenError if the actor may not set this participant's travel mode
   * @throws BusinessAddressNotFoundError if new address cannot be geocoded
   */
  async updateParticipant(
    eventId: string,
    participantId: string,
    input: UpdateParticipantInput,
    actor: ParticipantAuthContext
  ): Promise<Participant> {
    // Check event exists and is not published
    const mapProvider = await this.ensureEventModifiable(eventId);

    if (input.fuzzyLocation) {
      throw new ValidationError(HIDE_ADDRESS_UNAVAILABLE);
    }

    // Check participant exists and belongs to event
    const exists = await this.participantRepo.belongsToEvent(participantId, eventId);
    if (!exists) {
      throw new ParticipantNotFoundError(participantId);
    }

    const current = await this.participantRepo.findById(participantId);
    if (!current) {
      throw new ParticipantNotFoundError(participantId);
    }

    if (input.travelMode !== undefined && !canSetTravelMode(actor, current)) {
      throw new ForbiddenError("This person chooses their own travel mode");
    }

    const newAddress =
      input.address !== undefined && input.address !== current.address ? input.address : undefined;
    const updateData: UpdateParticipantData = { name: input.name, travelMode: input.travelMode };
    if (newAddress !== undefined) {
      const { lat, lng, formattedAddress } = await geocodeWithBusinessErrors(
        mapProvider,
        newAddress
      );
      updateData.startingPoint = { address: newAddress, formattedAddress, lat, lng };
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
   * Claims a row the organizer added. Open to anyone with the event link, by design.
   * @param eventId - Event ID
   * @param participantId - Participant ID
   * @returns Claimed participant and its new token
   * @throws EventNotFoundError if event doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   * @throws ParticipantNotFoundError if participant isn't in this event
   * @throws ParticipantNotClaimableError if the row has a token holder or is the organizer's
   */
  async claimParticipant(
    eventId: string,
    participantId: string
  ): Promise<Required<AddParticipantResult>> {
    await this.ensureEventModifiable(eventId);

    const { token, hash } = generateParticipantToken();
    const participant = await this.participantRepo.claim(participantId, eventId, hash);
    if (!participant) {
      const exists = await this.participantRepo.belongsToEvent(participantId, eventId);
      throw exists
        ? new ParticipantNotClaimableError()
        : new ParticipantNotFoundError(participantId);
    }

    logger.info({ eventId, participantId }, "Participant claimed");

    return { participant, participantToken: token };
  }

  /**
   * Undoes a claim. The holder's token stops working and their votes are removed,
   * so a claimable row never carries votes.
   * @param eventId - Event ID
   * @param participantId - Participant ID, already verified as the caller's own row
   * @returns Updated participant entity
   * @throws EventNotFoundError if event doesn't exist
   * @throws EventAlreadyPublishedError if event is published
   * @throws ParticipantNotFoundError if participant isn't in this event
   * @throws ForbiddenError if participant is the organizer
   */
  async unclaimParticipant(eventId: string, participantId: string): Promise<Participant> {
    await this.ensureEventModifiable(eventId);

    const participant = await this.participantRepo.findById(participantId);
    if (participant?.eventId !== eventId) {
      throw new ParticipantNotFoundError(participantId);
    }
    if (participant.isOrganizer) {
      throw new ForbiddenError("The organizer cannot give up their own row");
    }

    const unclaimed = await this.participantRepo.unclaim(participantId);

    logger.info({ eventId, participantId }, "Participant unclaimed");

    return unclaimed;
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
