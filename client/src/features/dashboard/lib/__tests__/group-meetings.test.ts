import { describe, expect, it } from 'vitest';
import type { UserEventResponse } from '@/features/auth/types';
import { groupMeetings } from '../group-meetings';

const meeting = (id: string, meetingTime: string | null, createdAt = '2026-11-01T00:00:00Z') =>
  ({
    id,
    role: 'organizer',
    participantId: null,
    event: {
      id,
      title: id,
      meetingTime,
      meetingTimeZone: null,
      publishedAt: null,
      createdAt,
      participantCount: 1,
      participants: [],
    },
  }) satisfies UserEventResponse;

describe('groupMeetings', () => {
  it('splits by meeting time and puts meetings without a time after dated upcoming ones', () => {
    const now = Date.parse('2026-11-16T12:00:00Z');
    const { upcoming, past } = groupMeetings(
      [
        meeting('last-week', '2026-11-09T19:00:00Z'),
        meeting('no-time-old', null, '2026-11-01T00:00:00Z'),
        meeting('next-month', '2026-12-16T19:00:00Z'),
        meeting('yesterday', '2026-11-15T19:00:00Z'),
        meeting('no-time-new', null, '2026-11-10T00:00:00Z'),
        meeting('tonight', '2026-11-16T19:00:00Z'),
      ],
      now
    );

    expect(upcoming.map((m) => m.id)).toEqual([
      'tonight',
      'next-month',
      'no-time-new',
      'no-time-old',
    ]);
    expect(past.map((m) => m.id)).toEqual(['yesterday', 'last-week']);
  });
});
