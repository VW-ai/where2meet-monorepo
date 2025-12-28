import type { Metadata } from 'next';
import { createMeetingMetadata } from '@/lib/seo/metadata';
import { eventClient } from '@/features/meeting/api';

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
  try {
    const { id } = await params;
    const event = await eventClient.get(id);

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

    return createMeetingMetadata({
      title: `${event.title} - Meeting Planner`,
      description: `Join the meeting "${event.title}"${dateTimeText}. Add your location and vote on the best venue.`,
      canonical: `/meet/${id}`,
    });
  } catch (error) {
    // Fallback metadata if event can't be loaded
    console.error('[Meeting Layout] Failed to load event for metadata:', error);
    return createMeetingMetadata({
      title: 'Meeting Event',
      description: 'Plan your group meeting with Where2Meet. Find the perfect spot for everyone.',
    });
  }
}

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
