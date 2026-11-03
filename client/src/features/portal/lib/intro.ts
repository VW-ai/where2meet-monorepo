/**
 * The home page's opening: the cat pops up in the middle of a cover, squashes,
 * then grows on a log scale with its outline cut out of the cover, like the
 * Open phase of the create-meeting portal, until the page underneath fills the screen.
 *
 * Frames here are viewport-free, so the server can sample them into keyframes
 * and a tiny inline script can place them before the first paint.
 */
import { ease } from './timeline';

/** Milliseconds. */
export const INTRO = {
  appear: 260,
  fadeIn: 120,
  squashAt: 280,
  squash: 120,
  grow: 560,
} as const;

export const INTRO_GROW_AT = INTRO.squashAt + INTRO.squash;
export const INTRO_DURATION = INTRO_GROW_AT + INTRO.grow;

/** The cat's size while it sits in the middle, in screen px. */
export const INTRO_SIZE = { phone: 112, wide: 150 } as const;

/**
 * Radius, in logo units, of the largest circle around `LOGO_POINTS.betweenEyes`
 * that fits inside the cat's outline. Growing past (screen half-diagonal / this)
 * leaves no cover on screen. Measured at 231 with `isPointInFill` on the outline paths.
 */
export const INTRO_HOLE_RADIUS = 225;

export interface IntroFrame {
  /** Multiplies the resting size while the cat pops in. */
  appear: number;
  /** Exponent from the resting size (0) to covering the screen (1), on a log scale. */
  grow: number;
  sx: number;
  sy: number;
  /** The black cat, which fades so the page shows through its outline. */
  opacity: number;
  cover: number;
}

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const progress = (t: number, start: number, duration: number) => clamp((t - start) / duration);

export function introFrame(t: number): IntroFrame {
  const pg = progress(t, INTRO_GROW_AT, INTRO.grow);
  const squash =
    t < INTRO_GROW_AT
      ? ease.squash(progress(t, INTRO.squashAt, INTRO.squash))
      : 1 - ease.slide(progress(t, INTRO_GROW_AT, INTRO.grow * 0.35));

  return {
    appear: 0.4 + 0.6 * ease.pop(progress(t, 0, INTRO.appear)),
    grow: ease.grow(pg),
    sx: 1 + 0.08 * squash,
    sy: 1 - 0.11 * squash,
    opacity: progress(t, 0, INTRO.fadeIn) * (1 - clamp((pg - 0.1) / 0.4)),
    // The hole uncovers the page; the late fade also covers a mask image that
    // hasn't loaded yet.
    cover: 1 - clamp((pg - 0.7) / 0.3),
  };
}

/** `[offset, appear, grow, sx, sy, opacity, cover]`, kept short because it ships inline in the HTML. */
export type IntroKeyframe = [number, number, number, number, number, number, number];

const round = (x: number) => Math.round(x * 1000) / 1000;

/** Evenly spaced samples of the opening for the Web Animations API, and the offset where it starts growing. */
export function introKeyframes(step = 40): { frames: IntroKeyframe[]; growAt: number } {
  const frames: IntroKeyframe[] = [];
  const count = Math.ceil(INTRO_DURATION / step);
  for (let i = 0; i <= count; i++) {
    const t = Math.min(INTRO_DURATION, i * step);
    const f = introFrame(t);
    const frame = [t / INTRO_DURATION, f.appear, f.grow, f.sx, f.sy, f.opacity, f.cover];
    frames.push(frame.map(round) as IntroKeyframe);
  }
  return { frames, growAt: round(INTRO_GROW_AT / INTRO_DURATION) };
}
