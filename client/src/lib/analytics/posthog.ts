import type { PostHog, Properties } from 'posthog-js';

type PostHogCall = (posthog: PostHog) => void;

/** The page and time of a call, so an event sent after init still reports where and when it happened. */
type Moment = { url: string; pathname: string; at: Date };

/**
 * posthog-js loads after the page does (instrumentation-client.ts).
 * Until then, calls wait in `queued`, which also keeps the landing page.
 */
type PostHogState =
  | { status: 'off' }
  | { status: 'queued'; key: string; landing: Moment; calls: PostHogCall[] }
  | { status: 'ready'; posthog: PostHog };

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

function now(): Moment {
  return { url: window.location.href, pathname: window.location.pathname, at: new Date() };
}

let state: PostHogState =
  key && typeof window !== 'undefined'
    ? { status: 'queued', key, landing: now(), calls: [] }
    : { status: 'off' };

function send(posthog: PostHog, moment: Moment, event: string, properties?: Properties) {
  posthog.capture(
    event,
    { ...properties, $current_url: moment.url, $pathname: moment.pathname },
    { timestamp: moment.at }
  );
}

export function withPostHog(call: PostHogCall) {
  if (state.status === 'ready') call(state.posthog);
  else if (state.status === 'queued') state.calls.push(call);
}

export function captureEvent(event: string, properties?: Properties) {
  const moment = now();
  withPostHog((posthog) => send(posthog, moment, event, properties));
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
    disable_surveys: true,
    capture_dead_clicks: false,
    // scopeReplayTo() turns replay on for meeting pages.
    disable_session_recording: true,
  });
  const { landing, calls } = state;
  state = { status: 'ready', posthog };
  // posthog-js sends a pageview for the current URL only, so a landing page left before init needs its own.
  if (landing.pathname !== window.location.pathname) send(posthog, landing, '$pageview');
  calls.forEach((call) => call(posthog));
}

export function scopeReplayTo(pathname: string) {
  withPostHog((posthog) => {
    if (pathname.startsWith('/meet/')) posthog.startSessionRecording();
    else posthog.stopSessionRecording();
  });
}
