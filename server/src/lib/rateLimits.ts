/**
 * Per-route rate limits, keyed per client IP (see rateLimitKey). They exist to
 * stop scripts from spending our paid map quota or guessing passwords, so
 * routes outside these classes are not limited at all. Each route counts in
 * its own bucket.
 */
export const RATE_LIMITS = {
  /**
   * Routes that call Google or AMap. Opening a venue costs one details and one
   * directions call; 60 a minute per route covers six people on one Wi-Fi each
   * opening a venue every six seconds.
   */
  maps: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  /** Password guessing and account spam. */
  auth: { rateLimit: { max: 10, timeWindow: "15 minutes" } },
  /** Meeting spam. A real organizer creates a handful a day. */
  eventCreate: { rateLimit: { max: 30, timeWindow: "1 hour" } },
} as const;
