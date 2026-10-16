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

/** The edit form's date ("yyyy-MM-dd") and time ("HH:mm") fields for a stored meeting time. */
export function toLocalFields(meetingTime: string): { date: string; time: string } {
  const at = new Date(meetingTime);
  return { date: at.toISOString().split('T')[0], time: at.toTimeString().slice(0, 5) };
}

/** The stored meeting time for the edit form's date and optional time fields. */
export function fromLocalFields(date: string, time: string): string {
  return time ? new Date(`${date}T${time}`).toISOString() : new Date(date).toISOString();
}
