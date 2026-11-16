import type { UserEventResponse } from '@/features/auth/types';

export interface MeetingGroups {
  upcoming: UserEventResponse[];
  past: UserEventResponse[];
}

const time = (iso: string) => new Date(iso).getTime();

// Upcoming: soonest first, then meetings with no time yet (newest first).
// Past: most recent first.
export function groupMeetings(userEvents: UserEventResponse[], now: number): MeetingGroups {
  const dated: UserEventResponse[] = [];
  const undated: UserEventResponse[] = [];
  const past: UserEventResponse[] = [];

  for (const userEvent of userEvents) {
    const { meetingTime } = userEvent.event;
    if (!meetingTime) undated.push(userEvent);
    else if (time(meetingTime) >= now) dated.push(userEvent);
    else past.push(userEvent);
  }

  dated.sort((a, b) => time(a.event.meetingTime!) - time(b.event.meetingTime!));
  undated.sort((a, b) => time(b.event.createdAt) - time(a.event.createdAt));
  past.sort((a, b) => time(b.event.meetingTime!) - time(a.event.meetingTime!));

  return { upcoming: [...dated, ...undated], past };
}
