process.env.TZ = 'UTC';

import { meetingWhen } from '@/shared/lib/meeting-times';

const FRIDAY_EVENING_IN_NEW_YORK = '2026-10-17T01:30:00.000Z';

describe('meetingWhen on a UTC server', () => {
  it('reads the meeting in New York, where it was planned', () => {
    expect(meetingWhen(FRIDAY_EVENING_IN_NEW_YORK, 'America/New_York')).toBe(
      'Friday, October 16, 2026 at 9:30 PM EDT'
    );
  });

  it('reads the same meeting in Los Angeles', () => {
    expect(meetingWhen(FRIDAY_EVENING_IN_NEW_YORK, 'America/Los_Angeles')).toBe(
      'Friday, October 16, 2026 at 6:30 PM PDT'
    );
  });

  it('reads the same meeting in Tokyo, already the next morning', () => {
    expect(meetingWhen(FRIDAY_EVENING_IN_NEW_YORK, 'Asia/Tokyo')).toBe(
      'Saturday, October 17, 2026 at 10:30 AM GMT+9'
    );
  });

  it('has no answer without a zone', () => {
    expect(meetingWhen(FRIDAY_EVENING_IN_NEW_YORK, null)).toBeNull();
  });

  it('has no answer for a zone the API accepts but this runtime does not know', () => {
    expect(meetingWhen(FRIDAY_EVENING_IN_NEW_YORK, 'Mars/Olympus_Mons')).toBeNull();
  });
});
