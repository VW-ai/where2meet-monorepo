import { describe, expect, it } from 'vitest';
import { APIError } from '@/lib/api/client';
import { isMissingEvent } from '@/features/meeting/lib/is-missing-event';

describe('isMissingEvent', () => {
  it('treats an unknown event as missing', () => {
    expect(isMissingEvent(new APIError(404, 'EVENT_NOT_FOUND', 'Event not found'))).toBe(true);
  });

  it('treats a malformed event ID as missing', () => {
    expect(isMissingEvent(new APIError(400, 'VALIDATION_ERROR', 'Invalid event ID format'))).toBe(
      true
    );
  });

  it('does not turn backend outages into 404s', () => {
    expect(isMissingEvent(new APIError(500, 'INTERNAL_ERROR', 'Server error'))).toBe(false);
    expect(isMissingEvent(new APIError(503, 'UNAVAILABLE', 'Service unavailable'))).toBe(false);
    expect(isMissingEvent(new APIError(0, 'NETWORK_ERROR', 'Failed to connect'))).toBe(false);
    expect(isMissingEvent(new Error('boom'))).toBe(false);
  });
});
