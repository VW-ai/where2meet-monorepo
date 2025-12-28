/**
 * Password hashing and verification utilities.
 *
 * Uses bcrypt with cost factor 12 for secure password storage.
 * @module utils/password
 */

import bcrypt from "bcrypt";

/** bcrypt cost factor (2^12 = 4096 iterations) */
const BCRYPT_ROUNDS = 12;

/**
 * Hashes a password using bcrypt.
 * @param password - Plaintext password to hash
 * @returns bcrypt hash string
 * @example
 * const hash = await hashPassword("myPassword123");
 * // "$2b$12$..."
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a stored bcrypt hash.
 *
 * Uses constant-time comparison internally to prevent timing attacks.
 * @param password - Plaintext password to verify
 * @param hash - Stored bcrypt hash
 * @returns True if password matches hash
 * @example
 * const valid = await verifyPassword("myPassword123", storedHash);
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
