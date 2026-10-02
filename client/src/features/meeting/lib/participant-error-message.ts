import { APIError } from '@/lib/api/client';

/**
 * User-facing message for a failed add/update of a participant's details.
 *
 * Server messages are written for developers ("Could not geocode address: …"),
 * so the common, actionable cases get plain wording; anything else falls back
 * to the server's message or the caller's fallback.
 */
export function participantErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    switch (error.code) {
      case 'ADDRESS_NOT_FOUND':
        return 'We couldn’t find that address. Pick a suggestion or try a nearby landmark.';
      case 'EVENT_ALREADY_PUBLISHED':
        return 'This meeting is already finalized, so people can’t be changed anymore.';
      case 'EXTERNAL_SERVICE_ERROR':
      case 'NETWORK_ERROR':
        return 'We couldn’t reach the map service. Check your connection and try again.';
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
