process.env.TZ = 'UTC';

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from '@/entities';
import { generateMetadata } from '@/app/meet/[id]/layout';

const FRIDAY_DINNER: Event = {
  id: 'evt_1792168931306_f2UvebTGVhGJcrbK',
  title: 'Friday dinner',
  meetingTime: '2026-10-17T01:30:00.000Z',
  meetingTimeZone: 'America/New_York',
  createdAt: '2026-10-16T16:00:00.000Z',
  updatedAt: '2026-10-16T16:00:00.000Z',
  participants: [],
  mec: null,
  publishedVenueId: null,
  publishedAt: null,
  settings: { allowParticipantsAfterPublish: false },
};

async function linkPreview(event: Event) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(event))
  );
  const metadata = await generateMetadata({ params: Promise.resolve({ id: event.id }) });
  return {
    description: metadata.description,
    og: metadata.openGraph?.description,
    twitter: metadata.twitter?.description,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('/meet/[id] link preview rendered on a UTC server', () => {
  it('spells out the meeting time in the zone it was planned in', async () => {
    const text =
      'Join the meeting "Friday dinner" on Friday, October 16, 2026 at 9:30 PM EDT. Add your location and vote on the best venue.';
    expect(await linkPreview(FRIDAY_DINNER)).toEqual({
      description: text,
      og: text,
      twitter: text,
    });
  });

  it('leaves the time out rather than guess a zone', async () => {
    const text = 'Join the meeting "Friday dinner". Add your location and vote on the best venue.';
    expect(await linkPreview({ ...FRIDAY_DINNER, meetingTimeZone: null })).toEqual({
      description: text,
      og: text,
      twitter: text,
    });
  });
});
