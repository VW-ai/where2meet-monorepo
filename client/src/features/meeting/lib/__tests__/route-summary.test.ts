import { describe, expect, it } from 'vitest';
import { formatTripTime, slowestRoute } from '../route-summary';

describe('slowestRoute', () => {
  it('picks the longest trip by seconds, whatever the display text says', () => {
    const routes = [
      { participantId: 'a', duration: '9 mins', durationSeconds: 540 },
      { participantId: 'b', duration: '1 hour 2 mins', durationSeconds: 3720 },
      { participantId: 'c', duration: '12 mins', durationSeconds: 720 },
    ];
    expect(slowestRoute(routes)?.participantId).toBe('b');
  });

  it('keeps the first of a tie', () => {
    expect(
      slowestRoute([
        { participantId: 'a', durationSeconds: 600 },
        { participantId: 'b', durationSeconds: 600 },
      ])?.participantId
    ).toBe('a');
  });

  it('has no answer without routes', () => {
    expect(slowestRoute([])).toBeNull();
  });
});

describe('formatTripTime', () => {
  it('reads as minutes under an hour', () => {
    expect(formatTripTime(660, 'en')).toBe('11 min');
    expect(formatTripTime(660, 'zh')).toBe('11 分钟');
  });

  it('adds hours when it needs them', () => {
    expect(formatTripTime(3900, 'en')).toBe('1 hr 5 min');
    expect(formatTripTime(3900, 'zh')).toBe('1 小时 5 分钟');
    expect(formatTripTime(7200, 'en')).toBe('2 hr');
  });

  it('never says a trip takes zero minutes', () => {
    expect(formatTripTime(10, 'en')).toBe('1 min');
  });
});
