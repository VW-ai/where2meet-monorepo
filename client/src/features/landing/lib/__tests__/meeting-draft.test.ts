import { describe, expect, it } from 'vitest';
import { missingDetailsMessage } from '../meeting-draft';

describe('missingDetailsMessage', () => {
  it('names every detail the organizer still has to add, and nothing once the draft is ready', () => {
    expect([
      missingDetailsMessage({ title: '', meetingTime: '', organizerName: '  ' }),
      missingDetailsMessage({ title: 'Date night', meetingTime: '', organizerName: '' }),
      missingDetailsMessage({
        title: 'Date night',
        meetingTime: '2026-10-30T23:00:00.000Z',
        organizerName: '',
      }),
      missingDetailsMessage({
        title: 'Date night',
        meetingTime: '2026-10-30T23:00:00.000Z',
        organizerName: 'Victor',
      }),
    ]).toEqual([
      'Add the occasion, a time and your name to create the meeting.',
      'Add a time and your name to create the meeting.',
      'Add your name to create the meeting.',
      null,
    ]);
  });
});
