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

/** The original posts at /blog/<slug>, now local posts in these New York towns. */
const MOVED_POSTS = [
  ['how-to-choose-a-team-meeting-location', 'midtown'],
  ['how-to-pick-a-restaurant-for-a-group-dinner', 'lower-manhattan'],
  ['how-to-pick-a-date-spot', 'union-square'],
  ['how-to-plan-a-weekend-hangout-with-friends', 'upper-west-side'],
];

/** @type {import('next').NextConfig} */
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
      {
        // A changed photo gets a new file_name (docs/blog-posts-contract.md), so browsers and the
        // image optimizer can keep each one for a year.
        source: '/blog/images/:file',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      ...NOINDEX_STATIC_PAGES.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ];
  },
  // Next's built-in trailing-slash redirect would bounce PostHog's /ingest/e/ calls,
  // so it is off and the first redirect below does the same job for every other path.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      { source: '/ingest/:path*', destination: 'https://us.i.posthog.com/:path*' },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:path((?!ingest(?:/|$)).+)/',
        destination: '/:path',
        permanent: true,
      },
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
      { source: '/where-to-meet', destination: '/blog', permanent: true },
      { source: '/where-to-meet/:path*', destination: '/blog/:path*', permanent: true },
      // The cover moves too, because share previews keep the og:image URL they first fetched.
      ...MOVED_POSTS.flatMap(([slug, town]) =>
        ['', '/cover.png'].map((suffix) => ({
          source: `/blog/${slug}${suffix}`,
          destination: `/blog/new-york/${town}/${slug}${suffix}`,
          permanent: true,
        }))
      ),
    ];
  },
  // Only the build reads the blog photos, to prerender the force-static cover.png routes, so no
  // server function needs the JPEGs that tracing public/ would bundle into each one.
  outputFileTracingExcludes: { '/**': ['public/blog/images/**'] },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
