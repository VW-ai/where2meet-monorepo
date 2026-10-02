import { describe, expect, it } from 'vitest';
import { APIError } from '@/lib/api/client';
import { participantErrorMessage } from '@/features/meeting/lib/participant-error-message';

const FALLBACK = 'Fallback message';

describe('participantErrorMessage', () => {
  it('explains an address the server could not find', () => {
    const error = new APIError(400, 'ADDRESS_NOT_FOUND', 'Could not geocode address: nowhere');
    expect(participantErrorMessage(error, FALLBACK)).toMatch(/couldn’t find that address/);
  });

  it('explains a finalized meeting', () => {
    const error = new APIError(409, 'EVENT_ALREADY_PUBLISHED', 'Event has already been published');
    expect(participantErrorMessage(error, FALLBACK)).toMatch(/already finalized/);
  });

  it('explains connection problems', () => {
    for (const code of ['EXTERNAL_SERVICE_ERROR', 'NETWORK_ERROR']) {
      expect(participantErrorMessage(new APIError(502, code, 'x'), FALLBACK)).toMatch(
        /couldn’t reach the map service/
      );
    }
  });

  it('falls back to the server message, then the caller’s fallback', () => {
    expect(participantErrorMessage(new APIError(403, 'FORBIDDEN', 'Not allowed'), FALLBACK)).toBe(
      'Not allowed'
    );
    expect(participantErrorMessage('weird', FALLBACK)).toBe(FALLBACK);
  });
});
