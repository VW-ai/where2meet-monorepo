import { Coffee, MapPin, Utensils, Wine, type IconNode } from 'lucide';
import { invitationFor } from '@/features/invitation/model/invitation';
import { eventClient, venueClient } from '@/features/meeting/api';
import { isMissingEvent } from '@/features/meeting/lib/is-missing-event';
import { fetchJpeg } from '@/lib/og/photo';
import { renderInvitationCard } from '@/lib/og/share-card';
import { SITE_CONFIG } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

/** The pin for a venue's first Google Places type; any other type gets a plain pin. */
const VENUE_ICONS: Record<string, IconNode> = { cafe: Coffee, restaurant: Utensils, bar: Wine };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await eventClient.get(id).catch((error: unknown) => {
    if (isMissingEvent(error)) return null;
    throw error;
  });
  if (!event?.publishedAt || !event.publishedVenueId) {
    return new Response('Not found', { status: 404 });
  }

  const venue = await venueClient.get(event.publishedVenueId).catch(() => null);
  const jpeg = venue?.photoUrl ? await fetchJpeg(venue.photoUrl) : null;
  const image = await renderInvitationCard({
    ...invitationFor(event, venue, process.env.NEXT_PUBLIC_APP_URL ?? SITE_CONFIG.url),
    icon: VENUE_ICONS[venue?.types[0] ?? ''] ?? MapPin,
    photo: jpeg ? { jpeg, credit: 'Google Maps' } : undefined,
  });
  image.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
  return image;
}
