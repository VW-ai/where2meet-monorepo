process.env.TZ = 'America/New_York';

import { describe, expect, it } from 'vitest';
import { eventEdits } from '@/features/meeting/lib/event-edits';
import { toLocalFields } from '@/shared/lib/meeting-times';

const STORED_WITH_SECONDS = '2026-10-17T01:30:45.000Z';

describe('eventEdits from the edit form in New York', () => {
  it('sends only the title when a meeting stored with seconds is opened and renamed', () => {
    const opened = toLocalFields(STORED_WITH_SECONDS);
    expect(eventEdits('Renamed dinner', opened, opened, 'America/Los_Angeles')).toEqual({
      title: 'Renamed dinner',
    });
  });

  it("sends the new time with the editor's zone when the time changes", () => {
    const opened = toLocalFields(STORED_WITH_SECONDS);
    expect(
      eventEdits('Friday dinner', opened, { date: '2026-10-16', time: '22:00' }, 'America/New_York')
    ).toEqual({
      title: 'Friday dinner',
      meetingTime: '2026-10-17T02:00:00.000Z',
      meetingTimeZone: 'America/New_York',
    });
  });
});
