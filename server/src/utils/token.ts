/**
 * Token generation and verification utilities.
 *
 * Token formats:
 * - Organizer: ot_<64 hex chars> (256 bits entropy)
 * - Participant: pt_<64 hex chars> (256 bits entropy)
 *
 * Security:
 * - Storage: SHA-256 hash (never store plaintext)
 * - Comparison: timing-safe to prevent timing attacks
 * @module utils/token
 */

import crypto from "crypto";

/** Prefix for organizer tokens */
const ORGANIZER_TOKEN_PREFIX = "ot_";

/** Prefix for participant tokens */
const PARTICIPANT_TOKEN_PREFIX = "pt_";

/** Length of random hex string (32 bytes = 64 hex chars = 256 bits) */
const TOKEN_RANDOM_LENGTH = 32;

/**
 * Generates a secure token with the given prefix.
 * @param prefix - Token prefix (e.g., "ot_" or "pt_")
 * @returns Object containing plaintext token and its SHA-256 hash
 */
function generateToken(prefix: string): { token: string; hash: string } {
  const randomBytes = crypto.randomBytes(TOKEN_RANDOM_LENGTH);
  const token = `${prefix}${randomBytes.toString("hex")}`;
  const hash = hashToken(token);
  return { token, hash };
}

/**
 * Generates a secure organizer token.
 *
 * Format: ot_<64 hex chars>
 * Entropy: 256 bits (cryptographically secure)
 * @returns Object containing plaintext token and its SHA-256 hash
 * @example
 * const { token, hash } = generateOrganizerToken();
 * // token: "ot_a1b2c3d4..." (return to user, never store)
 * // hash: "abc123..." (store in database)
 */
export function generateOrganizerToken(): { token: string; hash: string } {
  return generateToken(ORGANIZER_TOKEN_PREFIX);
}

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
  return generateToken(PARTICIPANT_TOKEN_PREFIX);
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
