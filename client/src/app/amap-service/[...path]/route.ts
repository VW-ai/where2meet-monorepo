/**
 * AMap security proxy
 * GET/POST /amap-service/* - Forward AMap JS API service requests with the security code
 *
 * The AMap JS API sends its service requests to the serviceHost set in
 * src/shared/lib/amap/loader.ts. This adds `jscode` (the key's security code)
 * so the code never reaches the browser, as AMap recommends for production.
 * @see https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode
 */

import type { NextRequest } from 'next/server';

type Params = { path: string[] };

/** Upstreams from AMap's proxy guide; everything else is the REST API */
function upstreamUrl(segments: string[]): URL {
  const path = segments.map(encodeURIComponent).join('/');
  if (path.startsWith('v4/map/styles')) return new URL(`https://webapi.amap.com/${path}`);
  if (path.startsWith('v3/vectormap')) return new URL(`https://fmap01.amap.com/${path}`);
  return new URL(`https://restapi.amap.com/${path}`);
}

async function forward(request: NextRequest, { params }: { params: Promise<Params> }) {
  const securityCode = process.env.AMAP_JS_SECURITY_CODE;
  if (!securityCode) {
    return Response.json(
      { error: { code: 'NOT_CONFIGURED', message: 'AMAP_JS_SECURITY_CODE is not set' } },
      { status: 503 }
    );
  }

  const { path } = await params;
  const url = upstreamUrl(path);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
  url.searchParams.set('jscode', securityCode);

  const contentType = request.headers.get('content-type');
  const upstream = await fetch(url, {
    method: request.method,
    headers: contentType ? { 'Content-Type': contentType } : undefined,
    body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export { forward as GET, forward as POST };
