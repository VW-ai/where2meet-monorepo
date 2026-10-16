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
