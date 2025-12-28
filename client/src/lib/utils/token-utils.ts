/**
 * Token Utilities
 * Handles token format transformations for backend compatibility
 */

const TOKEN_PREFIX_REGEX = /^(ot_|pt_)/;

/**
 * Strips ot_ or pt_ prefix from token if present
 * Returns raw 64-character hex token expected by backend claim endpoint
 *
 * Backend inconsistency:
 * - Event creation returns tokens WITH prefixes: "ot_abc123..."
 * - Claim endpoint expects tokens WITHOUT prefixes: "abc123..."
 *
 * @param token - Token with or without prefix
 * @returns Token without prefix
 *
 * @example
 * stripTokenPrefix('ot_019f65c7...') // '019f65c7...'
 * stripTokenPrefix('019f65c7...')    // '019f65c7...' (unchanged)
 */
export function stripTokenPrefix(token: string): string {
  return token.replace(TOKEN_PREFIX_REGEX, '');
}

/**
 * Checks if token has a valid prefix
 */
export function hasTokenPrefix(token: string): boolean {
  return TOKEN_PREFIX_REGEX.test(token);
}

/**
 * Validates token format (with or without prefix)
 */
export function isValidTokenFormat(token: string): boolean {
  const stripped = stripTokenPrefix(token);
  return /^[a-f0-9]{64}$/i.test(stripped);
}
