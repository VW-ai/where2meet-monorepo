/**
 * DTO barrel exports.
 *
 * Re-exports all DTO types, schemas, and helpers for convenient importing.
 * @module dto
 */

// Common DTOs
export {
  LocationResponseSchema,
  DeleteSuccessResponseSchema,
  createDeleteSuccessResponse,
} from "./common.dto.js";
export type { LocationResponse, DeleteSuccessResponse } from "./common.dto.js";

// Participant DTOs
export { ParticipantResponseSchema, CreateParticipantResponseSchema } from "./participant.dto.js";
export type { ParticipantResponse, CreateParticipantResponse } from "./participant.dto.js";

// Event DTOs
export {
  MECResponseSchema,
  GetMECResponseSchema,
  EventSettingsResponseSchema,
  EventResponseSchema,
  CreateEventResponseSchema,
} from "./event.dto.js";
export type {
  MECResponse,
  GetMECResponse,
  EventSettingsResponse,
  EventResponse,
  CreateEventResponse,
} from "./event.dto.js";

// Venue DTOs
export {
  VenueResponseSchema,
  VenueDetailsResponseSchema,
  VenueSearchResponseSchema,
} from "./venue.dto.js";
export type { VenueResponse, VenueDetailsResponse, VenueSearchResponse } from "./venue.dto.js";

// Vote DTOs
export {
  VoteResponseSchema,
  VenueWithVotesSchema,
  VoteStatisticsResponseSchema,
  VoteRemovalResponseSchema,
} from "./vote.dto.js";
export type {
  VoteResponse,
  VenueWithVotes,
  VoteStatisticsResponse,
  VoteRemovalResponse,
} from "./vote.dto.js";

// Directions DTOs
export {
  TravelModeSchema,
  FormattedValueSchema,
  RouteResponseSchema,
  DirectionsResponseSchema,
} from "./directions.dto.js";
export type {
  TravelMode,
  FormattedValue,
  RouteResponse,
  DirectionsResponse,
} from "./directions.dto.js";
