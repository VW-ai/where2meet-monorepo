import { invitationFor, isPublished } from '@/features/invitation/model/invitation';
import { eventClient, venueClient } from '@/features/meeting/api';
import { isMissingEvent } from '@/features/meeting/lib/is-missing-event';
import { fetchJpeg } from '@/lib/og/photo';
import { renderInvitation } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';
import { forwardedClientHeaders } from '@/lib/api/forwarded-client';

export const dynamic = 'force-dynamic';

/** `?format=portrait` is the 1080x1350 image people copy, save and share; the default is the link preview. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const init = { headers: forwardedClientHeaders(request.headers) };
  const event = await eventClient.get(id, init).catch((error: unknown) => {
    if (isMissingEvent(error)) return null;
    throw error;
  });
  if (!event || !isPublished(event)) {
    return new Response('Not found', { status: 404 });
  }

  const venue = await venueClient.get(event.publishedVenueId, init).catch(() => null);
  const photo = venue?.photoUrl ? await fetchJpeg(venue.photoUrl) : null;
  const format =
    new URL(request.url).searchParams.get('format') === 'portrait' ? 'portrait' : 'landscape';
  const image = await renderInvitation({
    invitation: invitationFor(event, venue, process.env.NEXT_PUBLIC_APP_URL ?? SITE_CONFIG.url),
    format,
    photo,
  });
  image.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  return image;
}
