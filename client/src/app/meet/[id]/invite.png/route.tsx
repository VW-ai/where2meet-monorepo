import { invitationFor, isPublished, VENUE_KINDS } from '@/features/invitation/model/invitation';
import { eventClient, venueClient } from '@/features/meeting/api';
import { isMissingEvent } from '@/features/meeting/lib/is-missing-event';
import { fetchJpeg } from '@/lib/og/photo';
import { renderInvitationCard } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await eventClient.get(id).catch((error: unknown) => {
    if (isMissingEvent(error)) return null;
    throw error;
  });
  if (!event || !isPublished(event)) {
    return new Response('Not found', { status: 404 });
  }

  const venue = await venueClient.get(event.publishedVenueId).catch(() => null);
  const jpeg = venue?.photoUrl ? await fetchJpeg(venue.photoUrl) : null;
  const invitation = invitationFor(
    event,
    venue,
    process.env.NEXT_PUBLIC_APP_URL ?? SITE_CONFIG.url
  );
  const image = await renderInvitationCard({
    ...invitation,
    when: invitation.when && `${invitation.when.date}, ${invitation.when.time}`,
    icon: VENUE_KINDS[invitation.kind].icon,
    photo: jpeg ? { jpeg, credit: 'Google Maps' } : undefined,
  });
  image.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  return image;
}
