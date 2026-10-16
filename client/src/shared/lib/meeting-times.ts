/** Start times the meeting picker offers, as "HH:mm". */
export const MEETING_TIMES: readonly string[] = everyStep(9 * 60, 17 * 60 + 30, 30);

function everyStep(firstMinute: number, lastMinute: number, stepMinutes: number): string[] {
  const times: string[] = [];
  for (let minute = firstMinute; minute <= lastMinute; minute += stepMinutes) {
    times.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return times;
}
