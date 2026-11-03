import catLogo from '@/components/cat/logo.svg';
import { LOGO_POINTS, LOGO_WIDTH } from '../lib/cat-paths';
import {
  INTRO_DURATION,
  INTRO_HOLE_RADIUS,
  INTRO_SIZE,
  introKeyframes,
  type IntroKeyframe,
} from '../lib/intro';
import './opening-intro.css';

export interface IntroConfig {
  storageKey: string;
  duration: number;
  /** Offset where the hole opens; the cat covers it before then. */
  growAt: number;
  frames: IntroKeyframe[];
  anchor: { x: number; y: number };
  logoWidth: number;
  /** The logo files letterbox the 1024×840 cat in a square viewBox starting at y = -92. */
  logoTop: number;
  size: typeof INTRO_SIZE;
  holeRadius: number;
}

/**
 * The home page's opening, server-rendered as a decorative overlay above the
 * real page. It stays `display: none` unless the inline script below marks
 * `html[data-intro]` before the first paint, so crawlers, no-JS visitors,
 * reduced motion and repeat views in the same tab get the page straight away.
 *
 * The cat is the header's logo file, already loading for the header, and the
 * hole is a CSS mask of its outline (cat-hole.svg), so little ships inline.
 */
export function OpeningIntro() {
  const config: IntroConfig = {
    storageKey: 'w2m-intro-seen',
    duration: INTRO_DURATION,
    ...introKeyframes(),
    anchor: LOGO_POINTS.betweenEyes,
    logoWidth: LOGO_WIDTH,
    logoTop: -92,
    size: INTRO_SIZE,
    holeRadius: INTRO_HOLE_RADIUS,
  };

  return (
    <div className="opening-intro" aria-hidden="true">
      <div className="opening-intro__cover" />
      <img className="opening-intro__cat" src={catLogo.src} alt="" width={1024} height={1024} />
      <script
        dangerouslySetInnerHTML={{ __html: `(${playIntro.toString()})(${JSON.stringify(config)})` }}
      />
    </div>
  );
}

/**
 * Runs inline while the page parses, so it must not reference anything outside
 * itself. Any input (a tap, a key, a scroll) skips straight to the page.
 */
export function playIntro(c: IntroConfig) {
  const html = document.documentElement;
  const root = document.currentScript?.parentElement;
  if (!root || typeof root.animate !== 'function') return;
  try {
    if (sessionStorage.getItem(c.storageKey)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    sessionStorage.setItem(c.storageKey, '1');
  } catch {
    return;
  }

  const width = innerWidth;
  const height = innerHeight;
  const kWait = (width >= 768 ? c.size.wide : c.size.phone) / c.logoWidth;
  // Where the anchor rests, matching the portal's waiting cat.
  const x = width / 2 + (c.anchor.x - c.logoWidth / 2) * kWait;
  const y = height * 0.46 + (c.anchor.y - 420) * kWait;
  const reach = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const ratio = (1.1 * reach) / c.holeRadius / kWait;
  const ax = c.anchor.x;
  const ay = c.anchor.y - c.logoTop;

  const cat: Keyframe[] = [];
  const hole: Keyframe[] = [];
  for (const [offset, appear, grow, sx, sy, opacity, coverOpacity] of c.frames) {
    const k = kWait * appear * Math.pow(ratio, grow);
    const kx = k * sx;
    const ky = k * sy;
    cat.push({
      offset,
      opacity,
      transform: `translate(${x - ax * kx}px, ${y - ay * ky}px) scale(${kx}, ${ky})`,
    });
    hole.push({
      offset,
      opacity: coverOpacity,
      maskSize:
        offset < c.growAt
          ? '0px 0px, 100% 100%'
          : `${c.logoWidth * kx}px ${c.logoWidth * ky}px, 100% 100%`,
      maskPosition: `${x - ax * kx}px ${y - ay * ky}px, 0px 0px`,
    });
  }

  const timing = { duration: c.duration, fill: 'forwards' as const };
  const animations = [
    root.querySelector('.opening-intro__cat')!.animate(cat, timing),
    root.querySelector('.opening-intro__cover')!.animate(hole, timing),
  ];

  const skipOn = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const end = () => {
    html.removeAttribute('data-intro');
    for (const animation of animations) animation.cancel();
    for (const type of skipOn) removeEventListener(type, end, true);
  };
  for (const type of skipOn) addEventListener(type, end, { capture: true, passive: true });
  animations[0].onfinish = end;
  html.setAttribute('data-intro', '');
}
