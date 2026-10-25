import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = { evaluated: false, calls: [] as unknown[][] };

function fakePostHogModule() {
  sdk.evaluated = true;
  const record = (...call: unknown[]) => sdk.calls.push(call);
  return {
    default: {
      init: (key: string) => record('init', key),
      capture: (event: string, properties?: unknown) => record('capture', event, properties),
      identify: (id: string, properties?: unknown) => record('identify', id, properties),
      reset: () => record('reset'),
    },
  };
}

function stubBrowser() {
  const loadListeners: Array<() => void> = [];
  const idleCallbacks: Array<() => void> = [];
  vi.stubGlobal('document', { readyState: 'interactive' });
  vi.stubGlobal('window', {
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
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.doMock('posthog-js', fakePostHogModule);
  sdk.evaluated = false;
  sdk.calls = [];
});

afterEach(() => {
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
    trackEvent('create_event', { event_id: 'evt_1' });
    withPostHog((posthog) => posthog.reset());
    browser.load();
    await browser.idle();
    trackEvent('join_event', { event_id: 'evt_1' });

    expect(sdk.calls).toEqual([
      ['init', 'phc_test'],
      ['identify', 'usr_1', { email: 'ada@example.com', name: 'Ada' }],
      ['capture', 'create_event', { event_id: 'evt_1' }],
      ['reset'],
      ['capture', 'join_event', { event_id: 'evt_1' }],
    ]);
  });
});
