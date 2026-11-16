import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }));

import { trackEvent } from '@/lib/analytics/events';
import { isNudgeSnoozed, requestSignInNudge, useSignInNudge } from '../sign-in-nudge';

const store = () => useSignInNudge.getState();

describe('sign-in nudge', () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => items.get(key) ?? null,
        setItem: (key: string, value: string) => items.set(key, value),
      },
    });
    useSignInNudge.setState({ phase: { status: 'idle' } });
    vi.mocked(trackEvent).mockClear();
  });

  it('shows once per visit for the first trigger, and a dismiss snoozes it for a week', () => {
    requestSignInNudge('vote');
    requestSignInNudge('time');
    store().show();
    expect(store().phase).toEqual({ status: 'open', trigger: 'vote' });

    store().dismiss();
    expect(trackEvent).toHaveBeenCalledWith('nudge_dismissed', { trigger: 'vote' });
    expect(isNudgeSnoozed()).toBe(true);
    expect(isNudgeSnoozed(Date.now() + 8 * 24 * 60 * 60 * 1000)).toBe(false);

    // Next visit, still snoozed
    useSignInNudge.setState({ phase: { status: 'idle' } });
    requestSignInNudge('join');
    expect(store().phase).toEqual({ status: 'idle' });
  });
});
