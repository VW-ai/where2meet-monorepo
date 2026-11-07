import { describe, expect, it } from 'vitest';
import { scrollToReveal } from '../scroll-to-reveal';

const VIEW = { top: 100, bottom: 500 };

describe('scrollToReveal', () => {
  it('leaves an item alone when it is in full view', () => {
    expect(scrollToReveal({ top: 200, bottom: 300 }, VIEW)).toBe(0);
  });

  it('scrolls up to bring an item out from under the sticky button', () => {
    expect(scrollToReveal({ top: 120, bottom: 220 }, VIEW)).toBe(-44);
  });

  it('scrolls down just enough to show an item past the bottom', () => {
    expect(scrollToReveal({ top: 450, bottom: 550 }, VIEW)).toBe(50);
  });

  it('shows the top of an item too tall to fit', () => {
    expect(scrollToReveal({ top: 300, bottom: 900 }, VIEW)).toBe(136);
  });
});
