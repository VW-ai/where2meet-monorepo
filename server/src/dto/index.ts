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
export { ParticipantResponseSchema } from "./participant.dto.js";
export type { ParticipantResponse } from "./participant.dto.js";

// Event DTOs
export {
  MECResponseSchema,
  EventSettingsResponseSchema,
  EventResponseSchema,
  CreateEventResponseSchema,
} from "./event.dto.js";
export type {
  MECResponse,
  EventSettingsResponse,
  EventResponse,
  CreateEventResponse,
} from "./event.dto.js";
