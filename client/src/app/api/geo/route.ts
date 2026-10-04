import { geoFromHeaders } from '@/shared/lib/visitor-geo';

export const dynamic = 'force-dynamic';

/** GET /api/geo: the reader's approximate city, or San Francisco when Vercel can't tell. */
export function GET(request: Request) {
  return Response.json(geoFromHeaders(request.headers), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
