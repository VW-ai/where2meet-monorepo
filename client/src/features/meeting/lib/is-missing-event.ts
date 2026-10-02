import { APIError } from '@/lib/api/client';

/**
 * Whether an error from `GET /api/events/:id` means the event can never be
 * loaded, so the meeting page should answer with a real 404.
 *
 * - 404: no event with this ID.
 * - 400: the ID is not in the event ID format (`evt_<timestamp>_<random>`).
 *   That is the endpoint's only validation, so a malformed link can never
 *   point at a meeting. (APIError.code is not reliable here: the backend nests
 *   the code inside `error`, so match on the status.)
 *
 * Anything else (5xx, network failure) is treated as an outage, not a 404.
 */
export function isMissingEvent(error: unknown): boolean {
  return error instanceof APIError && (error.status === 404 || error.status === 400);
}
