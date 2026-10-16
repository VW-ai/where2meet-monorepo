import { afterEach, describe, expect, it } from 'vitest';
import { browserTimeZone } from '@/shared/lib/meeting-times';

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('browserTimeZone', () => {
  it("names the zone the browser's clock is set to", () => {
    process.env.TZ = 'America/New_York';
    expect(browserTimeZone()).toBe('America/New_York');
  });

  it('sends no zone when the system zone is unknown and V8 reports Etc/Unknown', () => {
    process.env.TZ = '';
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Etc/Unknown');
    expect(browserTimeZone()).toBeUndefined();
  });
});
