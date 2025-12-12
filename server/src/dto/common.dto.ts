/**
 * Common DTO interfaces and schemas shared across domains.
 *
 * Each DTO has both a Zod schema (runtime validation) and
 * a TypeScript type derived from it (compile-time safety).
 *
 * @module dto/common
 */

import { z } from "zod";

/**
 * Location coordinates for map display.
 */
export const LocationResponseSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export type LocationResponse = z.infer<typeof LocationResponseSchema>;

/**
 * Success response for delete operations.
 */
export const DeleteSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type DeleteSuccessResponse = z.infer<typeof DeleteSuccessResponseSchema>;

/**
 * Creates a standardized delete success response.
 */
export function createDeleteSuccessResponse(message: string): DeleteSuccessResponse {
  return { success: true, message };
}
