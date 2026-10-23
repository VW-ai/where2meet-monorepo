import posthog from 'posthog-js';

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    // Same-origin proxy (rewrites in next.config.js) so ad blockers don't drop events.
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-08-30',
  });
}
