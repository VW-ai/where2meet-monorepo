import { describe, expect, it } from 'vitest';
import type { Event, Venue } from '@/entities';
import { formatWhen, invitationFor, shareText, timeZoneFor } from '../invitation';

const coffee: Venue = {
  id: 'ChIJ787',
  name: '787 Coffee',
  address: '159 2nd Ave, New York',
  location: { lat: 40.7297, lng: -73.9868 },
  types: ['cafe'],
  rating: null,
  userRatingsTotal: null,
  priceLevel: null,
  openNow: null,
  photoUrl: 'https://photos.example/787.jpg',
};

function event(overrides: Partial<Event> = {}): Event {
  return {
    id: 'evt_1_abc',
    title: 'Coffee test',
    meetingTime: '2026-10-17T15:00:00Z',
    createdAt: '2026-10-10T09:00:00Z',
    updatedAt: '2026-10-10T09:00:00Z',
    participants: [
      {
        id: 'p1',
        name: 'Ada',
        address: null,
        location: null,
        color: 'bg-mint-500',
        fuzzyLocation: false,
        isOrganizer: false,
      },
      {
        id: 'p2',
        name: 'Victor',
        address: null,
        location: null,
        color: 'bg-coral-500',
        fuzzyLocation: false,
        isOrganizer: true,
      },
    ],
    mec: { center: { lat: 40.73, lng: -73.99 }, radiusMeters: 1200 },
    publishedVenueId: coffee.id,
    publishedAt: '2026-10-14T12:00:00Z',
    settings: { allowParticipantsAfterPublish: true },
    ...overrides,
  };
}

describe('invitationFor', () => {
  it('reads the card off the event, its venue and the organizer', () => {
    expect(invitationFor(event(), coffee, 'https://www.where2meet.org')).toEqual({
      title: 'Coffee test',
      when: 'Saturday, October 17 at 11:00 AM EDT',
      host: 'Victor',
      venue: {
        name: '787 Coffee',
        address: '159 2nd Ave, New York',
        photoUrl: 'https://photos.example/787.jpg',
      },
      url: 'https://www.where2meet.org/meet/evt_1_abc',
    });
  });

  it('leaves out what the event does not have', () => {
    expect(
      invitationFor(
        event({ meetingTime: null, participants: [], mec: null }),
        null,
        'http://localhost:3001'
      )
    ).toEqual({
      title: 'Coffee test',
      when: null,
      host: null,
      venue: null,
      url: 'http://localhost:3001/meet/evt_1_abc',
    });
  });
});

describe('timeZoneFor', () => {
  it('takes the venue, then the participants center, then UTC', () => {
    expect(timeZoneFor(event(), coffee)).toBe('America/New_York');
    expect(
      timeZoneFor(event({ mec: { center: { lat: 51.5074, lng: -0.1278 }, radiusMeters: 1 } }), null)
    ).toBe('Europe/London');
    expect(timeZoneFor(event({ mec: null }), null)).toBe('UTC');
  });
});

describe('formatWhen', () => {
  it('spells out the day and the clock time in the given zone', () => {
    expect(formatWhen('2026-10-17T15:00:00Z', 'America/New_York')).toBe(
      'Saturday, October 17 at 11:00 AM EDT'
    );
    expect(formatWhen('2026-10-17T15:00:00Z', 'Asia/Tokyo')).toBe(
      'Sunday, October 18 at 12:00 AM GMT+9'
    );
  });
});

describe('shareText', () => {
  it('is one line with the title, the time and the place', () => {
    expect(shareText(invitationFor(event(), coffee, 'https://www.where2meet.org'))).toBe(
      "You're invited: Coffee test · Saturday, October 17 at 11:00 AM EDT · 787 Coffee, 159 2nd Ave, New York"
    );
  });

  it('skips a missing time or place', () => {
    expect(shareText({ title: 'Coffee test', when: null, host: null, venue: null, url: '' })).toBe(
      "You're invited: Coffee test"
    );
  });
});
