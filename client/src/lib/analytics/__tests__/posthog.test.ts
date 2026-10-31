import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SITE = 'https://www.where2meet.org';
const at = (second: number) => new Date(Date.UTC(2026, 9, 25, 16, 0, second));
const sdk = { evaluated: false, calls: [] as unknown[][], recording: false };

function fakePostHogModule() {
  sdk.evaluated = true;
  const record = (...call: unknown[]) => sdk.calls.push(call);
  return {
    default: {
      init: (key: string) => {
        record('init', key);
        // posthog-js sends the initial pageview for the current URL on the next tick after init.
        setTimeout(() => record('capture', '$pageview', { $current_url: window.location.href }), 1);
      },
      capture: (event: string, properties?: unknown, options?: unknown) =>
        record('capture', event, properties, ...(options ? [options] : [])),
      identify: (id: string, properties?: unknown) => record('identify', id, properties),
      reset: () => record('reset'),
      startSessionRecording: () => {
        sdk.recording = true;
      },
      stopSessionRecording: () => {
        sdk.recording = false;
      },
    },
  };
}

function stubBrowser(pathname = '/') {
  const location = { href: `${SITE}${pathname}`, pathname };
  const loadListeners: Array<() => void> = [];
  const idleCallbacks: Array<() => void> = [];
  vi.stubGlobal('document', { readyState: 'interactive' });
  vi.stubGlobal('window', {
    location,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'load') loadListeners.push(listener);
    },
    requestIdleCallback: (callback: () => void) => {
      idleCallbacks.push(callback);
    },
  });
  return {
    load: () => loadListeners.splice(0).forEach((listener) => listener()),
    idle: async () => {
      idleCallbacks.splice(0).forEach((callback) => callback());
      await vi.dynamicImportSettled();
      await new Promise((resolve) => setTimeout(resolve, 5));
    },
    navigate: (to: string) => {
      location.pathname = to;
      location.href = `${SITE}${to}`;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock('posthog-js', fakePostHogModule);
  sdk.evaluated = false;
  sdk.calls = [];
  sdk.recording = false;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at(0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('PostHog loading', () => {
  it.each([
    { key: 'phc_test', evaluated: [false, false, true] },
    { key: '', evaluated: [false, false, false] },
  ])(
    'evaluates posthog-js only after load and idle time, and only with a key ("$key")',
    async ({ key, evaluated }) => {
      vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', key);
      const browser = stubBrowser();
      await import('@/instrumentation-client');
      await import('@/lib/analytics/events');
      await import('@/features/auth/ui/session-provider');
      await import('@/components/analytics/session-replay-scope');
      const afterImport = sdk.evaluated;
      browser.load();
      const afterLoad = sdk.evaluated;
      await browser.idle();

      expect([afterImport, afterLoad, sdk.evaluated]).toEqual(evaluated);
    }
  );

  it('sends calls made before init right after it, in the order they were made', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    const browser = stubBrowser();
    await import('@/instrumentation-client');
    const { trackEvent } = await import('@/lib/analytics/events');
    const { withPostHog } = await import('@/lib/analytics/posthog');

    withPostHog((posthog) => posthog.identify('usr_1', { email: 'ada@example.com', name: 'Ada' }));
    vi.setSystemTime(at(1));
    trackEvent('create_event', { event_id: 'evt_1' });
    withPostHog((posthog) => posthog.reset());
    vi.setSystemTime(at(3));
    browser.load();
    await browser.idle();
    vi.setSystemTime(at(4));
    trackEvent('join_event', { event_id: 'evt_1' });

    const home = { $current_url: `${SITE}/`, $pathname: '/' };
    expect(sdk.calls).toEqual([
      ['init', 'phc_test'],
      ['identify', 'usr_1', { email: 'ada@example.com', name: 'Ada' }],
      ['capture', 'create_event', { event_id: 'evt_1', ...home }, { timestamp: at(1) }],
      ['reset'],
      ['capture', '$pageview', { $current_url: `${SITE}/` }],
      ['capture', 'join_event', { event_id: 'evt_1', ...home }, { timestamp: at(4) }],
    ]);
  });

  it('sends one pageview when the visitor is still on the landing page at init', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    const browser = stubBrowser('/blog');
    await import('@/instrumentation-client');

    vi.setSystemTime(at(3));
    browser.load();
    await browser.idle();

    expect(sdk.calls.filter(([, event]) => event === '$pageview')).toEqual([
      ['capture', '$pageview', { $current_url: `${SITE}/blog` }],
    ]);
  });

  it('keeps the landing pageview and a queued event on their own page when the visitor navigates before init', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    const browser = stubBrowser('/');
    await import('@/instrumentation-client');
    const { trackEvent } = await import('@/lib/analytics/events');

    vi.setSystemTime(at(1));
    trackEvent('create_event', { event_id: 'evt_1' });
    browser.navigate('/meet/evt_1');
    vi.setSystemTime(at(3));
    browser.load();
    await browser.idle();

    const home = { $current_url: `${SITE}/`, $pathname: '/' };
    expect(sdk.calls.filter(([method]) => method === 'capture')).toEqual([
      ['capture', '$pageview', home, { timestamp: at(0) }],
      ['capture', 'create_event', { event_id: 'evt_1', ...home }, { timestamp: at(1) }],
      ['capture', '$pageview', { $current_url: `${SITE}/meet/evt_1` }],
    ]);
  });

  it('turns PostHog off without an unhandled rejection when posthog-js fails to load', async () => {
    let importAttempts = 0;
    vi.doMock('posthog-js', () => {
      importAttempts += 1;
      throw new Error('Loading chunk 52c376855bd3276a failed.');
    });
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const browser = stubBrowser();
      await import('@/instrumentation-client');
      const { loadPostHog } = await import('@/lib/analytics/posthog');
      browser.load();
      await browser.idle();
      await loadPostHog();
      await new Promise((resolve) => setTimeout(resolve, 10));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect({ importAttempts, unhandled }).toEqual({ importAttempts: 1, unhandled: [] });
  });

  it('records replay on meeting pages only, and stops after the visitor leaves one', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
    const browser = stubBrowser();
    await import('@/instrumentation-client');
    const { scopeReplayTo } = await import('@/lib/analytics/posthog');

    scopeReplayTo('/meet/evt_1');
    browser.load();
    await browser.idle();
    const recording = [sdk.recording];
    for (const pathname of ['/blog/new-york/midtown', '/meet/evt_2', '/', '/meet', '/meetings']) {
      scopeReplayTo(pathname);
      recording.push(sdk.recording);
    }

    expect(recording).toEqual([true, false, true, false, false, false]);
  });
});
