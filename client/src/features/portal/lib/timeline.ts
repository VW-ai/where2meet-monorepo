/**
 * Timing and geometry for the create-meeting transition ("cat portal").
 *
 * Everything here is a pure function of elapsed time, so the overlay can draw
 * any frame and the wait can stretch for as long as the server takes:
 *
 * 1. Gather: the landing fades and the header logo flies to the middle.
 * 2. Wait: the cat idles until the meeting exists and the map has settled.
 * 3. Open: the cat squashes, then grows on a log scale. Its outline is a hole
 *    in the cover, so the real meeting page shows through until it fills the screen.
 * 4. Settle: the meeting page's own controls animate in (CSS, keyed off
 *    `html[data-portal="settle"]`) and the organizer's pin pulses once.
 */
import { LOGO_POINTS, LOGO_WIDTH } from './cat-paths';

/** Solves a CSS cubic-bezier so the motion here matches the CSS in cat-portal.css. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (p: number) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let t = p;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - p;
      if (Math.abs(error) < 1e-6) return sampleY(t);
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 40; i++) {
      const x = sampleX(t);
      if (Math.abs(x - p) < 1e-6) break;
      if (x < p) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

export const CURVES = {
  fade: [0.4, 0, 1, 1],
  flight: [0.65, 0, 0.35, 1],
  squash: [0.45, 0, 0.55, 1],
  grow: [0.45, 0, 0.6, 0.6],
  mapZoom: [0.16, 1, 0.3, 1],
  slide: [0.22, 1, 0.36, 1],
} as const;

type CurveName = keyof typeof CURVES;
const ease = Object.fromEntries(
  Object.entries(CURVES).map(([name, [x1, y1, x2, y2]]) => [name, cubicBezier(x1, y1, x2, y2)])
) as Record<CurveName, (p: number) => number>;

/** Milliseconds at normal speed. */
export const DURATIONS = {
  flightStart: 60,
  flight: 440,
  coverStart: 120,
  coverFade: 300,
  /** The cat sits at least this long after landing, even if everything is ready. */
  minHold: 180,
  /** Time for the idle bob to come to rest once the map is ready. */
  idleRest: 120,
  /** Status line appears once the wait has lasted this long. */
  captionAfter: 500,
  squash: 140,
  grow: 700,
  mapZoom: 1100,
  settle: 1120,
  /** Open anyway if the map hasn't reported in this long after the meeting exists. */
  mapFallback: 4000,
  reducedFade: 200,
  reducedCrossfade: 320,
  failFade: 220,
} as const;

export const MAP_ZOOM_FROM = 1.45;
const WIDE_MIN = 768;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the cat's anchor point sits on screen, and its scale (screen px per logo unit). */
export interface Placement extends Point {
  k: number;
}

export interface PortalGeometry {
  width: number;
  height: number;
  /** Logo point the cat grows from. */
  anchor: Point;
  start: Placement;
  wait: Placement;
  /** Control point of the flight curve. */
  arc: Point;
  /** Where the organizer's pin lands, or the middle of the visible map. */
  target: Point;
  /** Bottom edge of the waiting cat, for the shadow and status line. */
  waitBottom: number;
  waitSize: number;
  /** Scale at which the outline covers the whole screen. */
  kEnd: number;
}

/**
 * Where the meeting map puts a single participant: the middle of the visible map.
 * Mirrors the map container in phone-meeting.css and the sidebar offset in MapArea.
 */
export function mapTarget(width: number, height: number): Point {
  if (width < WIDE_MIN) {
    const mapHeight = height - (0.43 * height - 24);
    return { x: width / 2, y: mapHeight / 2 };
  }
  const sidebar = width >= 1280 ? 400 : width >= 1024 ? 360 : 320;
  return { x: width / 2 + sidebar / 2, y: height / 2 };
}

export function portalGeometry(
  viewport: { width: number; height: number },
  from: Rect | null,
  kEnd = 4.5
): PortalGeometry {
  const { width, height } = viewport;
  const wide = width >= WIDE_MIN;
  // From the forehead on a phone; on a wide screen growing from between the eyes
  // covers the window at about a third of the scale.
  const anchor = wide ? LOGO_POINTS.betweenEyes : LOGO_POINTS.forehead;
  const waitSize = wide ? 150 : 112;
  const kWait = waitSize / LOGO_WIDTH;
  const center = { x: width / 2, y: height * 0.46 };
  const wait = {
    x: center.x + (anchor.x - 512) * kWait,
    y: center.y + (anchor.y - 420) * kWait,
    k: kWait,
  };

  let start: Placement;
  if (from && from.width > 0) {
    // The logo image is letterboxed in a square box, like an <img> of the SVG.
    const k = from.width / LOGO_WIDTH;
    const top = from.top + (from.height - 840 * k) / 2;
    start = { x: from.left + anchor.x * k, y: top + anchor.y * k, k };
  } else {
    start = { x: wait.x, y: wait.y, k: kWait * 0.3 };
  }

  return {
    width,
    height,
    anchor,
    start,
    wait,
    arc: { x: start.x + (wait.x - start.x) * 1.2, y: start.y + 0.06 * (wait.y - start.y) },
    target: mapTarget(width, height),
    waitBottom: center.y + 420 * kWait,
    waitSize,
    kEnd,
  };
}

export interface PortalPlan {
  reduced: boolean;
  /** When Open starts, once known. */
  openAt: number | null;
  /** Show a pulse where the organizer's pin is. */
  hasPin: boolean;
}

/** Open starts once the map is ready, after the cat has rested for a moment. */
export function openTime(readyAt: number, reduced: boolean): number {
  const land = reduced ? DURATIONS.reducedFade : DURATIONS.flightStart + DURATIONS.flight;
  return Math.max(land + DURATIONS.minHold, readyAt + DURATIONS.idleRest);
}

export interface CatPose {
  x: number;
  y: number;
  k: number;
  sx: number;
  sy: number;
  rotate: number;
  opacity: number;
  /** Opacity of the black head and hat. */
  fill: number;
  /** Opacity of the eyes, mouth and brim. */
  features: number;
  /** 0 while on the white badge, 1 once over the cover. */
  featureTint: number;
  hatRotate: number;
  blink: number;
}

export type ChromeState = 'cover' | 'settle' | 'done';

export interface PortalFrame {
  cover: number;
  /** Cut the cat's outline out of the cover. */
  hole: boolean;
  cat: CatPose;
  shadow: number;
  caption: number;
  /** Scale for the meeting map while it shows through the cat. */
  mapScale: number;
  chrome: ChromeState;
  pulse: { opacity: number; scale: number } | null;
  /** Lets clicks through to the page. */
  passThrough: boolean;
  done: boolean;
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
const progress = (t: number, start: number, duration: number) => clamp((t - start) / duration);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export function portalFrame(t: number, plan: PortalPlan, geo: PortalGeometry): PortalFrame {
  return plan.reduced ? reducedFrame(t, plan, geo) : fullFrame(t, plan, geo);
}

function fullFrame(t: number, plan: PortalPlan, geo: PortalGeometry): PortalFrame {
  const D = DURATIONS;
  const land = D.flightStart + D.flight;
  const openAt = plan.openAt;
  const growAt = openAt === null ? Infinity : openAt + D.squash;
  const settleAt = growAt + D.grow;
  const end = settleAt + D.settle;
  const { start, wait, arc } = geo;

  // Gather: a quadratic curve from the badge to the middle, growing on a log scale.
  const pf = ease.flight(progress(t, D.flightStart, D.flight));
  const u = 1 - pf;
  let x = u * u * start.x + 2 * u * pf * arc.x + pf * pf * wait.x;
  let y = u * u * start.y + 2 * u * pf * arc.y + pf * pf * wait.y;
  let k = start.k * Math.pow(wait.k / start.k, pf);
  const rotate = -14 * Math.sin(Math.PI * pf);

  // A small squash on landing.
  const pl = progress(t, land, 240);
  const landing = Math.sin(Math.PI * pl) * (1 - pl);
  let sx = 1 + 0.05 * landing;
  let sy = 1 - 0.07 * landing;

  // Wait: bob, hat wiggle and blink, easing out before Open.
  const idle = t - land;
  const rest = openAt === null ? 1 : clamp((openAt - t) / D.idleRest);
  const envelope = t < (openAt ?? Infinity) ? clamp(idle / 260) * rest : 0;
  let hatRotate = 0;
  let blink = 1;
  if (envelope > 0) {
    y += -4 * (geo.waitSize / 112) * Math.sin((2 * Math.PI * idle) / 1100) * envelope;
    hatRotate = 9 * Math.sin((2 * Math.PI * idle) / 760) * envelope;
    const phase = (idle - 700) % 1800;
    if (idle > 700 && phase < 180) blink = 1 - 0.92 * Math.sin((Math.PI * phase) / 180);
  }
  const shadow = t > land ? clamp(idle / 200) * (1 - progress(t, openAt ?? Infinity, D.squash)) : 0;

  // Open: squash, then grow while the page shows through.
  const squash =
    t < growAt
      ? ease.squash(progress(t, openAt ?? Infinity, D.squash))
      : 1 - ease.slide(progress(t, growAt, D.grow * 0.35));
  sx *= 1 + 0.08 * squash;
  sy *= 1 - 0.11 * squash;

  let fill = 1;
  let features = 1;
  let opacity = t > 0 ? 1 : 0;
  let hole = false;
  if (t >= growAt) {
    const pg = progress(t, growAt, D.grow);
    k = wait.k * Math.pow(geo.kEnd / wait.k, ease.grow(pg));
    const drift = ease.flight(pg);
    x = lerp(wait.x, geo.target.x, drift);
    y = lerp(wait.y, geo.target.y, drift);
    fill = 1 - clamp((pg - 0.04) / 0.36);
    features = 1 - clamp((pg - 0.3) / 0.3);
    hole = pg < 1;
    opacity = pg < 1 ? 1 : 0;
  }

  const cover = t < settleAt ? progress(t, D.coverStart, D.coverFade) : 0;
  const caption =
    progress(t, land + D.captionAfter, 220) * (1 - progress(t, openAt ?? Infinity, 160));

  let pulse: PortalFrame['pulse'] = null;
  if (plan.hasPin) {
    const pp = progress(t, settleAt + 466, 640);
    if (pp > 0 && pp < 1) pulse = { opacity: 0.55 * (1 - pp), scale: lerp(1, 3.8, ease.slide(pp)) };
  }

  return {
    cover,
    hole,
    cat: {
      x,
      y,
      k,
      sx,
      sy,
      rotate,
      opacity,
      fill,
      features,
      featureTint: clamp(pf * 4),
      hatRotate,
      blink,
    },
    shadow,
    caption,
    mapScale:
      t < growAt
        ? MAP_ZOOM_FROM
        : lerp(MAP_ZOOM_FROM, 1, ease.mapZoom(progress(t, growAt, D.mapZoom))),
    chrome: t < settleAt ? 'cover' : t < end ? 'settle' : 'done',
    pulse,
    passThrough: t >= settleAt,
    done: t >= end,
  };
}

/** Reduced motion: no flight or growth, just fades. */
function reducedFrame(t: number, plan: PortalPlan, geo: PortalGeometry): PortalFrame {
  const D = DURATIONS;
  const openAt = plan.openAt ?? Infinity;
  const out = progress(t, openAt, D.reducedCrossfade);
  const land = D.reducedFade;
  return {
    cover: progress(t, 0, D.reducedFade) * (1 - out),
    hole: false,
    cat: {
      x: geo.wait.x,
      y: geo.wait.y,
      k: geo.wait.k,
      sx: 1,
      sy: 1,
      rotate: 0,
      opacity: progress(t, 120, 200) * (1 - out),
      fill: 1,
      features: 1,
      featureTint: 1,
      hatRotate: 0,
      blink: 1,
    },
    shadow: 0,
    caption: progress(t, land + D.captionAfter, 220) * (1 - out),
    mapScale: 1,
    chrome: t < openAt ? 'cover' : 'done',
    pulse: null,
    passThrough: t >= openAt,
    done: t >= openAt + D.reducedCrossfade,
  };
}
