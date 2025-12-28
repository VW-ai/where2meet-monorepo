/**
 * Meeting API Client Facade
 * Barrel export for all meeting-related API clients.
 * Components must use these clients instead of @/lib/api/* directly.
 */

export * from './event-client';
export * from './participant-client';
export * from './venue-client';
export * from './directions-client';
