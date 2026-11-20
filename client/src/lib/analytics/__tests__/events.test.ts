import { describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => [] as unknown[][]);
vi.mock('../posthog', () => ({
  captureEvent: (name: string, properties?: unknown) => captured.push([name, properties]),
}));

import { analyticsEvents } from '../events';

vi.stubGlobal('window', {});

describe('sharePromptShown', () => {
  it('counts a meeting once however often the people panel opens', () => {
    analyticsEvents.sharePromptShown('evt_a', 'phone');
    analyticsEvents.sharePromptShown('evt_a', 'phone');
    analyticsEvents.sharePromptShown('evt_b', 'desktop');

    expect(captured.map(([name, properties]) => [name, properties])).toEqual([
      ['share_prompt_shown', { event_id: 'evt_a', surface: 'phone', event_category: 'engagement' }],
      [
        'share_prompt_shown',
        { event_id: 'evt_b', surface: 'desktop', event_category: 'engagement' },
      ],
    ]);
  });
});
