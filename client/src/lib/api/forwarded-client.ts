import { BlockList, isIP } from 'node:net';

// https://www.cloudflare.com/ips/ (checked 2026-11-08)
const CLOUDFLARE_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];
const CLOUDFLARE_V6 = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const cloudflare = new BlockList();
for (const [ranges, type] of [
  [CLOUDFLARE_V4, 'ipv4'],
  [CLOUDFLARE_V6, 'ipv6'],
] as const) {
  for (const range of ranges) {
    const [network, prefix] = range.split('/');
    cloudflare.addSubnet(network, Number(prefix), type);
  }
}

function isCloudflare(ip: string): boolean {
  const version = isIP(ip);
  return version !== 0 && cloudflare.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

/**
 * The visitor's IP. www.where2meet.org is proxied by Cloudflare, so Vercel's
 * x-real-ip is a Cloudflare edge and the visitor is in CF-Connecting-IP. That
 * header is only trusted when the request really came from Cloudflare, since
 * anyone can reach Vercel directly and set it.
 */
function visitorIp(incoming: Headers): string | undefined {
  const peer = incoming.get('x-real-ip') ?? incoming.get('x-forwarded-for')?.split(',')[0]?.trim();
  const viaCloudflare = incoming.get('cf-connecting-ip');
  if (peer && viaCloudflare && isCloudflare(peer)) return viaCloudflare;
  return peer;
}

/**
 * Server-side calls to the API leave from Vercel's shared IPs, so the API
 * would rate limit every visitor as one. These headers name the visitor; the
 * API trusts them only alongside the shared secret.
 */
export function forwardedClientHeaders(
  incoming: Headers,
  secret = process.env.RATE_LIMIT_PROXY_SECRET
): Record<string, string> {
  const clientIp = visitorIp(incoming);
  if (!secret || !clientIp) return {};
  return { 'x-w2m-proxy-secret': secret, 'x-w2m-client-ip': clientIp };
}
