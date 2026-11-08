/**
 * Server-side calls to the API leave from Vercel's shared IPs, so the API
 * would rate limit every visitor as one. These headers name the visitor; the
 * API trusts them only alongside the shared secret.
 */
export function forwardedClientHeaders(
  incoming: Headers,
  secret = process.env.RATE_LIMIT_PROXY_SECRET
): Record<string, string> {
  const clientIp =
    incoming.get('x-real-ip') ?? incoming.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (!secret || !clientIp) return {};
  return { 'x-w2m-proxy-secret': secret, 'x-w2m-client-ip': clientIp };
}
