import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { GUIDES_TAG } from '@/features/guides/lib/catalog';

/**
 * POST /api/revalidate: the control plane calls this after it publishes, unpublishes or
 * edits a guide. The guides expire at once, so the next request renders fresh content.
 */
export async function POST(request: Request) {
  const secret = process.env.WHERE2MEET_REVALIDATE_SECRET;
  if (!secret || !matches(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('tag' in body) || body.tag !== GUIDES_TAG) {
    return Response.json({ error: `Expected {"tag":"${GUIDES_TAG}"}` }, { status: 400 });
  }
  revalidateTag(GUIDES_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}

/** Compares digests so the time taken doesn't depend on how much of the secret matched. */
function matches(actual: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}
