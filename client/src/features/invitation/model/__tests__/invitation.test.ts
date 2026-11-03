import { describe, expect, it } from 'vitest';
import type { Event, Venue } from '@/entities';
import { calendarFile } from '../calendar';
import {
  invitationCode,
  invitationFor,
  isPublished,
  shareText,
  VENUE_KINDS,
  type PublishedEvent,
} from '../invitation';

const coffee: Venue = {
  id: 'ChIJ787',
  name: '787 Coffee',
  address: '159 2nd Ave, New York',
  location: { lat: 40.7297, lng: -73.9868 },
  types: ['cafe', 'food'],
  rating: null,
  userRatingsTotal: null,
  priceLevel: null,
  openNow: null,
  photoUrl: 'https://photos.example/787.jpg',
};

function event(overrides: Partial<PublishedEvent> = {}): PublishedEvent {
  return {
    id: 'evt_1702000000000_a8K3mX2pQrS7nBvW',
    title: 'Coffee test',
    meetingTime: '2026-10-17T15:00:00Z',
    meetingTimeZone: 'America/New_York',
    mapProvider: 'google',
    createdAt: '2026-10-10T09:00:00Z',
    updatedAt: '2026-10-10T09:00:00Z',
    participants: [
      {
        id: 'p1',
        name: 'Victor',
        address: null,
        location: null,
        color: 'coral',
        fuzzyLocation: false,
        isOrganizer: true,
      },
      {
        id: 'p2',
        name: 'ada lovelace',
        address: null,
        location: null,
        color: 'bg-blue-500',
        fuzzyLocation: false,
        isOrganizer: false,
      },
    ],
    mec: { center: { lat: 40.73, lng: -73.99 }, radiusMeters: 1200 },
    publishedVenueId: coffee.id,
    publishedAt: '2026-10-15T01:41:00Z',
    settings: { allowParticipantsAfterPublish: true },
    ...overrides,
  };
}

describe('invitationFor', () => {
  it('reads the ticket off the event, its venue and its people, in the meeting zone', () => {
    expect(invitationFor(event(), coffee, 'https://www.where2meet.org')).toEqual({
      locale: 'en',
      title: 'Coffee test',
      host: 'Victor',
      url: 'https://www.where2meet.org/meet/evt_1702000000000_a8K3mX2pQrS7nBvW',
      code: 'W2M-A8K3-MX2P',
      kind: 'coffee',
      when: { startsAt: '2026-10-17T15:00:00Z', date: 'Sat, Oct 17', time: '11:00 AM EDT' },
      venue: {
        name: '787 Coffee',
        address: '159 2nd Ave, New York',
        photoUrl: 'https://photos.example/787.jpg',
      },
      going: [
        { initial: 'V', color: '#FF7F50' },
        { initial: 'A', color: '#3B82F6' },
      ],
      issued: '10.14.26 9:41 PM',
    });
  });

  it('speaks Chinese for an Amap meeting', () => {
    const invitation = invitationFor(
      event({
        mapProvider: 'amap',
        title: '周末火锅',
        meetingTimeZone: 'Asia/Shanghai',
        participants: [{ ...event().participants[0], name: '小王' }],
      }),
      { ...coffee, types: ['restaurant'] },
      'https://www.where2meet.org'
    );
    expect(invitation).toMatchObject({
      locale: 'zh',
      kind: 'food',
      when: { date: '10月17日周六', time: '23:00 GMT+8' },
      going: [{ initial: '小', color: '#FF7F50' }],
      issued: '2026.10.15 09:41',
    });
    expect(shareText(invitation)).toBe(
      '邀请你来：周末火锅 · 10月17日周六, 23:00 GMT+8 · 787 Coffee, 159 2nd Ave, New York'
    );
  });

  it('leaves out the time without a zone, and the venue when it cannot be loaded', () => {
    expect(
      invitationFor(
        event({ meetingTimeZone: null, participants: [] }),
        null,
        'http://localhost:3001'
      )
    ).toMatchObject({
      host: null,
      kind: 'place',
      when: null,
      venue: null,
      going: [],
      issued: null,
    });
  });

  it('maps venue types to a kind through the registry', () => {
    const kindOf = (types: string[]) => invitationFor(event(), { ...coffee, types }, '').kind;
    expect([['bar'], ['restaurant'], ['park'], []].map(kindOf)).toEqual([
      'drinks',
      'food',
      'place',
      'place',
    ]);
    expect(VENUE_KINDS.place.word).toEqual({ en: 'MEET UP', zh: '见面' });
  });
});

describe('isPublished', () => {
  it('needs both the publish time and the venue', () => {
    expect(isPublished(event())).toBe(true);
    expect(isPublished({ ...event(), publishedAt: null })).toBe(false);
    expect(isPublished({ ...event(), publishedVenueId: null })).toBe(false);
  });
});

describe('invitationCode', () => {
  it('prints the id’s random part in groups of four', () => {
    expect(invitationCode('evt_1702000000000_a8K3mX2pQrS7nBvW')).toBe('W2M-A8K3-MX2P');
    expect(invitationCode('evt_1_abc')).toBe('W2M-ABC');
  });
});

describe('shareText', () => {
  it('is one line with the title, the time and the place', () => {
    expect(shareText(invitationFor(event(), coffee, 'https://www.where2meet.org'))).toBe(
      "You're invited: Coffee test · Sat, Oct 17, 11:00 AM EDT · 787 Coffee, 159 2nd Ave, New York"
    );
  });

  it('skips a missing time or place', () => {
    expect(
      shareText(invitationFor(event({ meetingTime: null }), null, 'https://www.where2meet.org'))
    ).toBe("You're invited: Coffee test");
  });
});

describe('calendarFile', () => {
  it('is a two-hour event at the venue, with escaped text and folded lines', () => {
    const invitation = invitationFor(
      event({ title: 'Coffee, then a long walk; bring shoes and a good playlist for the trip' }),
      coffee,
      'https://www.where2meet.org'
    );
    expect(calendarFile(invitation, new Date('2026-10-16T12:00:00.250Z'))).toBe(
      [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Where2Meet//Invitation//EN',
        'BEGIN:VEVENT',
        'UID:https://www.where2meet.org/meet/evt_1702000000000_a8K3mX2pQrS7nBvW',
        'DTSTAMP:20261016T120000Z',
        'DTSTART:20261017T150000Z',
        'DTEND:20261017T170000Z',
        'SUMMARY:Coffee\\, then a long walk\\; bring shoes and a good playlist for the',
        '  trip',
        'LOCATION:787 Coffee\\, 159 2nd Ave\\, New York',
        'URL:https://www.where2meet.org/meet/evt_1702000000000_a8K3mX2pQrS7nBvW',
        'DESCRIPTION:https://www.where2meet.org/meet/evt_1702000000000_a8K3mX2pQrS7n',
        ' BvW',
        'END:VEVENT',
        'END:VCALENDAR',
        '',
      ].join('\r\n')
    );
  });

  it('has nothing to add without a time', () => {
    expect(calendarFile(invitationFor(event({ meetingTime: null }), coffee, ''), new Date())).toBe(
      null
    );
  });
});
