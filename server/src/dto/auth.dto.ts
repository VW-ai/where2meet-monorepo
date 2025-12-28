/**
 * Authentication response DTOs.
 *
 * Defines response types for auth-related endpoints.
 * @module dto/auth
 */

import { z } from "zod";

import { UserResponseSchema } from "./user.dto.js";

/**
 * Response for successful authentication (register/login).
 * Note: Session token is set via HttpOnly cookie, not in response body.
 */
export const AuthResponseSchema = z.object({
  user: UserResponseSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Response for session validation.
 */
export const SessionResponseSchema = z.object({
  user: UserResponseSchema,
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/**
 * Response for successful logout.
 */
export const LogoutResponseSchema = z.object({
  success: z.literal(true),
});

export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
