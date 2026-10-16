import { MEETING_TIMES } from '@/shared/lib/meeting-times';

describe('MEETING_TIMES', () => {
  it('offers every half hour from 6:00 to 23:30, evenings included', () => {
    expect(MEETING_TIMES).toHaveLength(36);
    expect(MEETING_TIMES.slice(0, 3)).toEqual(['06:00', '06:30', '07:00']);
    expect(MEETING_TIMES.slice(24, 28)).toEqual(['18:00', '18:30', '19:00', '19:30']);
    expect(MEETING_TIMES.slice(-2)).toEqual(['23:00', '23:30']);
  });
});
