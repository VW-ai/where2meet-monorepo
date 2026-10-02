import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import type { Event } from '@/entities';
import { createMeetingPageMetadata } from '@/lib/seo/metadata';
import { APIError } from '@/lib/api/client';
import { eventClient } from '@/features/meeting/api';

type EventLookup =
  | { status: 'found'; event: Event }
  | { status: 'not-found' }
  | { status: 'error'; error: unknown };

/**
 * Load the event once per request (React `cache` dedupes the call between
 * generateMetadata and the layout render).
 *
 * A 404 from the backend is a definitive "no such event"; any other failure
 * (backend down, 5xx) is reported separately so the page can still render
 * with fallback metadata instead of turning an outage into 404s.
 */
const lookupEvent = cache(async (id: string): Promise<EventLookup> => {
  try {
    return { status: 'found', event: await eventClient.get(id) };
  } catch (error) {
    if (error instanceof APIError && error.status === 404) {
      return { status: 'not-found' };
    }
    return { status: 'error', error };
  }
});

/**
 * Generate dynamic metadata for meeting pages
 *
 * Strategy: noindex but follow
 * - noindex: Prevents spam event pages from diluting site authority
 * - follow: Allows Google to crawl for Open Graph data (enables social sharing)
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lookup = await lookupEvent(id);

  if (lookup.status === 'not-found') {
    notFound();
  }

  if (lookup.status === 'error') {
    // Fallback metadata if event can't be loaded
    console.error('[Meeting Layout] Failed to load event for metadata:', lookup.error);
    return createMeetingPageMetadata({
      title: 'Meeting Event',
      description: 'Plan your group meeting with Where2Meet. Find the perfect spot for everyone.',
    });
  }

  const { event } = lookup;

  // Format meeting date/time for description (if available)
  let dateTimeText = '';
  if (event.meetingTime) {
    const meetingDate = new Date(event.meetingTime);
    const formattedDate = meetingDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const formattedTime = meetingDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    dateTimeText = ` on ${formattedDate} at ${formattedTime}`;
  }

  return createMeetingPageMetadata({
    title: `${event.title} - Meeting Planner`,
    description: `Join the meeting "${event.title}"${dateTimeText}. Add your location and vote on the best venue.`,
    canonical: `/meet/${id}`,
  });
}

/**
 * The layout (not just generateMetadata) decides whether the event exists.
 * Metadata is streamed after the HTML shell for regular browsers, so a
 * notFound() raised only from generateMetadata would still answer with a
 * 200 status: a soft 404. Throwing from the layout, which is part of the
 * shell, produces a real 404 response.
 */
export default async function MeetLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lookup = await lookupEvent(id);

  if (lookup.status === 'not-found') {
    notFound();
  }

  return children;
}
