/**
 * Token generation and verification utilities.
 *
 * Token format: pt_<64 hex chars> (256 bits entropy)
 * All participants (including organizer) use the same token format.
 * Authorization is determined by Participant.isOrganizer flag in database.
 *
 * Security:
 * - Storage: SHA-256 hash (never store plaintext)
 * - Comparison: timing-safe to prevent timing attacks
 * @module utils/token
 */

import crypto from "crypto";

/** Prefix for participant tokens */
const PARTICIPANT_TOKEN_PREFIX = "pt_";

/** Length of random hex string (32 bytes = 64 hex chars = 256 bits) */
const TOKEN_RANDOM_LENGTH = 32;

/**
 * Generates a secure participant token.
 *
 * Format: pt_<64 hex chars>
 * Entropy: 256 bits (cryptographically secure)
 * @returns Object containing plaintext token and its SHA-256 hash
 * @example
 * const { token, hash } = generateParticipantToken();
 * // token: "pt_a1b2c3d4..." (return to user, never store)
 * // hash: "abc123..." (store in database)
 */
export function generateParticipantToken(): { token: string; hash: string } {
  const randomBytes = crypto.randomBytes(TOKEN_RANDOM_LENGTH);
  const token = `${PARTICIPANT_TOKEN_PREFIX}${randomBytes.toString("hex")}`;
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Computes SHA-256 hash of a token.
 *
 * Used for storing tokens securely in the database.
 * @param token - Plaintext token to hash
 * @returns Hex-encoded SHA-256 hash (64 characters)
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies a token against a stored hash using timing-safe comparison.
 *
 * Important: Uses crypto.timingSafeEqual to prevent timing attacks.
 * @param token - Plaintext token to verify
 * @param storedHash - Hash stored in database
 * @returns True if token matches the stored hash
 */
export function verifyToken(token: string, storedHash: string): boolean {
  const inputHash = hashToken(token);

  // Both hashes are 64 characters (256 bits as hex)
  if (inputHash.length !== storedHash.length) {
    return false;
  }

  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(inputHash, "hex"), Buffer.from(storedHash, "hex"));
}
