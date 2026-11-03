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

  it('explains in Chinese for meetings in mainland China', () => {
    const notFound = new APIError(400, 'ADDRESS_NOT_FOUND', 'Could not geocode address: nowhere');
    const published = new APIError(
      409,
      'EVENT_ALREADY_PUBLISHED',
      'Event has already been published'
    );
    expect(participantErrorMessage(notFound, FALLBACK, 'zh')).toBe(
      '找不到这个地址。请从建议中选择，或试试附近的地标。'
    );
    expect(participantErrorMessage(published, FALLBACK, 'zh')).toBe(
      '这个见面已经确定，不能再更改参与者。'
    );
    expect(participantErrorMessage(new APIError(502, 'NETWORK_ERROR', 'x'), FALLBACK, 'zh')).toBe(
      '无法连接地图服务，请检查网络后重试。'
    );
  });
});
