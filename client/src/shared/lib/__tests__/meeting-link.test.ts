import { describe, expect, it } from 'vitest';
import { SHORT_CODE_PATTERN, meetingShareUrl } from '../meeting-link';

describe('meetingShareUrl', () => {
  it('shares the first ten characters of the random part under /m', () => {
    expect(
      meetingShareUrl('https://www.where2meet.org', 'evt_1794201181214_HEKtmQTvo9TnqAiS')
    ).toBe('https://www.where2meet.org/m/HEKtmQTvo9');
  });

  it('makes codes the short link page accepts', () => {
    const code = meetingShareUrl('', 'evt_1702000000000_a8K3mX2pQrS7nBvW').split('/m/')[1] ?? '';
    expect(SHORT_CODE_PATTERN.test(code)).toBe(true);
  });
});
