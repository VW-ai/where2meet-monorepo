import { randomBytes } from 'crypto';

/**
 * Generate unique IDs with consistent format: {prefix}_{timestamp}_{random}
 *
 * @param prefix - Prefix for the ID (e.g., 'usr', 'evt', 'prt')
 * @returns Unique ID string
 *
 * @example
 * generateId('usr') // 'usr_1234567890123_a1b2c3d4e5f6'
 */
export function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

// Convenience functions for common ID types
export const createUserId = () => generateId('usr');
export const createSessionId = () => generateId('ses');
export const createEventId = () => generateId('evt');
export const createParticipantId = () => generateId('prt');
export const createVenueId = () => generateId('ven');
export const createIdentityId = () => generateId('ident');
export const createOAuthStateId = () => generateId('state');
export const createPasswordResetTokenId = () => generateId('token');
