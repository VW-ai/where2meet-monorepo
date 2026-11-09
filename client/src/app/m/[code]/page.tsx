import { notFound, redirect } from 'next/navigation';
import { eventClient } from '@/features/meeting/api';
import { isMissingEvent } from '@/features/meeting/lib/is-missing-event';
import { SHORT_CODE_PATTERN } from '@/shared/lib/meeting-link';

export const dynamic = 'force-dynamic';

/** Short meeting link: where2meet.org/m/<code> opens the meeting it was copied from. */
export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!SHORT_CODE_PATTERN.test(code)) notFound();
  const id = await eventClient.resolveShortCode(code).catch((error: unknown) => {
    if (isMissingEvent(error)) return null;
    throw error;
  });
  if (!id) notFound();
  redirect(`/meet/${id}`);
}
