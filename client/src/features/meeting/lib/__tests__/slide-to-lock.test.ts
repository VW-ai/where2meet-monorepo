import { describe, expect, it } from 'vitest';
import { slideLocks, slideOffset } from '../slide-to-lock';

describe('slideOffset', () => {
  it('stays on the track', () => {
    expect(slideOffset(-20, 200)).toBe(0);
    expect(slideOffset(120, 200)).toBe(120);
    expect(slideOffset(300, 200)).toBe(200);
  });
});

describe('slideLocks', () => {
  it('locks when dragged most of the way, however slowly', () => {
    expect(slideLocks(170, 200, 0)).toBe(true);
  });

  it('springs back from a slow release short of that', () => {
    expect(slideLocks(160, 200, 0.1)).toBe(false);
  });

  it('lets a quick flick past halfway finish on its own', () => {
    expect(slideLocks(110, 200, 1)).toBe(true);
    expect(slideLocks(90, 200, 1)).toBe(false);
  });

  it('never locks on a track with no room', () => {
    expect(slideLocks(0, 0, 5)).toBe(false);
  });
});
