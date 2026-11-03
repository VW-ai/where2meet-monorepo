import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAT_HAT, CAT_HAT_FILL, CAT_HEAD } from '../cat-paths';
import { INTRO_DURATION, INTRO_GROW_AT, introFrame, introKeyframes } from '../intro';

describe('introFrame', () => {
  it('starts on a full cover with the cat about to pop in', () => {
    expect(introFrame(0)).toEqual({ appear: 0.4, grow: 0, sx: 1, sy: 1, opacity: 0, cover: 1 });
  });

  it('rests at full size, fully visible, until it grows', () => {
    const resting = introFrame(INTRO_GROW_AT - 1);
    expect(resting.appear).toBeCloseTo(1, 6);
    expect(resting.opacity).toBe(1);
    expect(resting.cover).toBe(1);
    expect(resting.grow).toBe(0);
  });

  it('grows on a rising curve and ends with nothing on screen', () => {
    let last = -1;
    for (let t = INTRO_GROW_AT; t <= INTRO_DURATION; t += 20) {
      const { grow } = introFrame(t);
      expect(grow).toBeGreaterThanOrEqual(last);
      last = grow;
    }
    expect(introFrame(INTRO_DURATION)).toMatchObject({ grow: 1, opacity: 0, cover: 0 });
  });

  it('lasts under a second', () => {
    expect(INTRO_DURATION).toBe(960);
  });
});

describe('introKeyframes', () => {
  it('samples the whole opening, with a frame exactly where growing starts', () => {
    const { frames, growAt } = introKeyframes(40);
    expect(frames).toHaveLength(25);
    expect(frames[0]).toEqual([0, 0.4, 0, 1, 1, 0, 1]);
    expect(frames[frames.length - 1]).toEqual([1, 1, 1, 1, 1, 0, 0]);
    expect(growAt).toBe(0.417);
    expect(frames.map((f) => f[0])).toContain(growAt);
  });
});

describe('cat-hole.svg', () => {
  it('is the cat outline from cat-paths', () => {
    const svg = readFileSync(join(__dirname, '../../ui/cat-hole.svg'), 'utf8');
    expect(svg).toContain(`d="${CAT_HEAD + CAT_HAT + CAT_HAT_FILL}"`);
  });
});
