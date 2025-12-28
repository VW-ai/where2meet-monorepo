/**
 * Session token generation and cookie configuration utilities.
 *
 * Session token format: st_<64 hex chars> (256 bits entropy)
 * Stored as SHA-256 hash in database, never plaintext.
 * @module utils/session
 */

import crypto from "crypto";
import type { CookieSerializeOptions } from "@fastify/cookie";
import { hashToken } from "./token.js";

/** Prefix for session tokens */
const SESSION_TOKEN_PREFIX = "st_";

/** Length of random bytes (32 bytes = 64 hex chars = 256 bits) */
const TOKEN_RANDOM_LENGTH = 32;

/** Cookie name for session token */
export const SESSION_COOKIE_NAME = "session_token";

/** Session expiry in days */
export const SESSION_EXPIRY_DAYS = 7;

/** Session expiry in milliseconds */
export const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Generates a secure session token.
 *
 * Format: st_<64 hex chars>
 * Entropy: 256 bits (cryptographically secure)
 * @returns Object containing plaintext token and its SHA-256 hash
 * @example
 * const { token, hash } = generateSessionToken();
 * // token: "st_a1b2c3d4..." (set in cookie, never store)
 * // hash: "abc123..." (store in database)
 */
export function generateSessionToken(): { token: string; hash: string } {
  const randomBytes = crypto.randomBytes(TOKEN_RANDOM_LENGTH);
  const token = `${SESSION_TOKEN_PREFIX}${randomBytes.toString("hex")}`;
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Calculates session expiration date.
 * @returns Date object set to SESSION_EXPIRY_DAYS from now
 */
export function getSessionExpiresAt(): Date {
  return new Date(Date.now() + SESSION_EXPIRY_MS);
}

/**
 * Returns cookie options for session token.
 *
 * Security settings:
 * - HttpOnly: Prevents JavaScript access (XSS protection)
 * - Secure: HTTPS only in production
 * - SameSite=Lax: CSRF protection
 * - Path=/: Available on all routes
 * @param isProduction - Whether running in production environment
 * @returns Cookie serialization options
 */
export function getSessionCookieOptions(
  isProduction: boolean
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // seconds
  };
}

/**
 * Returns cookie options for clearing the session cookie.
 *
 * Sets maxAge to 0 to delete the cookie.
 * @param isProduction - Whether running in production environment
 * @returns Cookie serialization options for deletion
 */
export function getClearSessionCookieOptions(
  isProduction: boolean
): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
