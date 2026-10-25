import type { PostHog } from 'posthog-js';

type PostHogCall = (posthog: PostHog) => void;

/**
 * posthog-js loads after the page does (instrumentation-client.ts).
 * Until then, calls wait in `queued`.
 */
type PostHogState =
  | { status: 'off' }
  | { status: 'queued'; key: string; calls: PostHogCall[] }
  | { status: 'ready'; posthog: PostHog };

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let state: PostHogState = key ? { status: 'queued', key, calls: [] } : { status: 'off' };

export function withPostHog(call: PostHogCall) {
  if (state.status === 'ready') call(state.posthog);
  else if (state.status === 'queued') state.calls.push(call);
}

export async function loadPostHog() {
  if (state.status !== 'queued') return;
  const { default: posthog } = await import('posthog-js');
  if (state.status !== 'queued') return;
  posthog.init(state.key, {
    // Same-origin proxy (rewrites in next.config.js) so ad blockers don't drop events.
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-08-30',
  });
  const { calls } = state;
  state = { status: 'ready', posthog };
  calls.forEach((call) => call(posthog));
}
