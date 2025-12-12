/**
 * Semantic ID generation utilities.
 *
 * Format: evt_<timestamp>_<random>
 * - timestamp: Date.now() in milliseconds (13-15 digits, depending on year)
 * - random: 16 character base62 string
 *
 * Entropy and Collision Analysis:
 * - Base62 charset: a-z, A-Z, 0-9 (62 characters)
 * - With 16 chars: 62^16 ≈ 4.7 × 10^28 combinations (~95 bits of entropy)
 * - Birthday paradox: need ~10^14 IDs for 50% collision probability
 * - At 1M IDs/second, would take ~3,000 years to reach 50% collision chance
 *
 * Additional safety:
 * - Database has @unique constraint on id field
 * - Repository layer implements collision retry logic
 *
 * @module utils/id
 */

import crypto from "crypto";

/** Base62 character set for URL-safe random string generation */
const BASE62_CHARS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Length of random suffix in generated IDs (16 chars = ~95 bits entropy) */
const RANDOM_SUFFIX_LENGTH = 16;

/**
 * Generates a cryptographically random base62 string.
 *
 * Uses crypto.randomBytes for cryptographically secure randomness.
 * Note: Using modulo 62 introduces slight bias (~2.3%) but is acceptable
 * for ID generation purposes given the high entropy.
 *
 * @param length - Number of characters to generate
 * @returns Random base62 string of specified length
 */
function generateBase62(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
  }
  return result;
}

/**
 * Generates a semantic Event ID.
 *
 * Format: evt_<timestamp>_<random>
 * Total length: 4 + 13-15 + 1 + 16 = 34-36 characters
 *
 * @returns Generated event ID
 * @example
 * generateEventId() // "evt_1702000000000_a8K3mX2pQrS7nBvW"
 */
export function generateEventId(): string {
  const timestamp = Date.now();
  const random = generateBase62(RANDOM_SUFFIX_LENGTH);
  return `evt_${timestamp}_${random}`;
}

/**
 * Regex pattern for validating Event IDs.
 *
 * Matches: evt_ + 13-15 digit timestamp + _ + exactly 16 alphanumeric chars
 * Kept in sync with generateEventId() output format.
 */
export const EVENT_ID_PATTERN = /^evt_\d{13,15}_[a-zA-Z0-9]{16}$/;

/**
 * Validates whether a string is a valid Event ID format.
 *
 * @param id - String to validate
 * @returns True if the string matches Event ID format
 */
export function isValidEventId(id: string): boolean {
  return EVENT_ID_PATTERN.test(id);
}
