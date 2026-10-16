import { format } from 'date-fns';

/** Start times the meeting picker offers, as "HH:mm": every half hour from 6:00 to 23:30, so evening plans fit. */
export const MEETING_TIMES: readonly string[] = everyStep(6 * 60, 23 * 60 + 30, 30);

function everyStep(firstMinute: number, lastMinute: number, stepMinutes: number): string[] {
  const times: string[] = [];
  for (let minute = firstMinute; minute <= lastMinute; minute += stepMinutes) {
    times.push(
      `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
    );
  }
  return times;
}

export interface LocalFields {
  date: string;
  time: string;
}

/** The edit form's date ("yyyy-MM-dd") and time ("HH:mm") fields for a stored meeting time. */
export function toLocalFields(meetingTime: string): LocalFields {
  const at = new Date(meetingTime);
  return { date: format(at, 'yyyy-MM-dd'), time: format(at, 'HH:mm') };
}

/** The stored meeting time for the edit form's date and optional time fields. */
export function fromLocalFields(date: string, time: string): string {
  // A date-time string without an offset parses as local time; a bare date would parse as UTC.
  return new Date(`${date}T${time || '00:00'}`).toISOString();
}

export function meetingWhen(meetingTime: string, timeZone: string | null): string | null {
  if (!timeZone) return null;
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone,
    }).format(new Date(meetingTime));
  } catch {
    return null;
  }
}

export function browserTimeZone(): string | undefined {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}
