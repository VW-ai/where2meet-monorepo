import { loadPostHog } from '@/lib/analytics/posthog';

// Matches next/script's lazyOnload, which loads gtag.js.
function afterLoadWhenIdle(run: () => void) {
  const whenIdle = () =>
    'requestIdleCallback' in window ? window.requestIdleCallback(run) : setTimeout(run, 1);
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}

afterLoadWhenIdle(() => void loadPostHog());
