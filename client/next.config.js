const createMDX = require('@next/mdx');

/** @type {import('next').NextConfig} */

/** Canonical production origin. Keep in sync with SITE_CONFIG.url in src/lib/seo/metadata.ts. */
const CANONICAL_ORIGIN = 'https://www.where2meet.org';

/** Hosts that serve the same build but must not be indexed as duplicates. */
const NON_CANONICAL_HOSTS = ['where2meet-steel.vercel.app', 'where2meet.org'];

/**
 * Baseline security headers.
 *
 * No Content-Security-Policy yet: the app loads Google Maps, Google Sign-In
 * and Google Analytics, and a wrong CSP would break them. Add one after
 * auditing the exact script/connect origins.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  },
];

/**
 * Debugging pages still shipped in /public. They must never be indexed.
 * (robots.ts also disallows them; the header covers crawlers that ignore robots.)
 */
const NOINDEX_STATIC_PAGES = ['/debug-claim-tokens.html', '/clear-invalid-tokens.html'];

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      ...NOINDEX_STATIC_PAGES.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ];
  },
  async redirects() {
    return [
      // Send the Vercel alias and the bare apex to the canonical www host with a
      // permanent (308) redirect so link equity consolidates on one origin.
      ...NON_CANONICAL_HOSTS.map((host) => ({
        source: '/:path*',
        has: [{ type: 'host', value: host }],
        destination: `${CANONICAL_ORIGIN}/:path*`,
        permanent: true,
      })),
      // Pages retired by the visual-story landing. The blog replaced the scenario pages.
      { source: '/how-it-works', destination: '/', permanent: true },
      { source: '/scenarios', destination: '/blog', permanent: true },
      { source: '/scenarios/:slug', destination: '/blog', permanent: true },
      // The local guides moved under the blog, at the same paths.
      { source: '/where-to-meet', destination: '/blog', permanent: true },
      { source: '/where-to-meet/:path*', destination: '/blog/:path*', permanent: true },
    ];
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
};

// Blog post bodies in src/content/blog are MDX, styled by src/mdx-components.tsx.
module.exports = createMDX()(nextConfig);
