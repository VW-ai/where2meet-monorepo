// Pinned so the expectations hold on any machine; evening Eastern times fall on the next UTC day.
process.env.TZ = 'America/New_York';

import { fromLocalFields, toLocalFields } from '@/shared/lib/meeting-times';

describe('meeting time form fields', () => {
  it('shows an evening meeting on its local day', () => {
    expect(toLocalFields('2026-10-17T01:30:00.000Z')).toEqual({
      date: '2026-10-16',
      time: '21:30',
    });
  });

  it('saves the fields back to the same instant', () => {
    expect(fromLocalFields('2026-10-16', '21:30')).toBe('2026-10-17T01:30:00.000Z');
  });

  it('keeps an evening meeting where it was when the form is saved unchanged', () => {
    const { date, time } = toLocalFields('2026-10-17T01:30:00.000Z');
    expect(fromLocalFields(date, time)).toBe('2026-10-17T01:30:00.000Z');
  });

  it('reads a date without a time as local midnight', () => {
    expect(fromLocalFields('2026-10-16', '')).toBe('2026-10-16T04:00:00.000Z');
  });
});
