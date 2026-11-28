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

describe('createEvent', () => {
  it('names the page and the seeded place only for a create that came from a link', () => {
    captured.length = 0;
    analyticsEvents.createEvent('evt_a');
    analyticsEvents.createEvent('evt_b', { src: 'study-spots', seededPlace: false });

    expect(captured).toEqual([
      ['create_event', { event_id: 'evt_a', event_category: 'engagement' }],
      [
        'create_event',
        { event_id: 'evt_b', event_category: 'engagement', src: 'study-spots', seededPlace: false },
      ],
    ]);
  });
});
