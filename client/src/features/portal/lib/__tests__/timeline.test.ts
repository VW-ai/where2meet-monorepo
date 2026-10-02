import { describe, expect, it } from 'vitest';
import {
  DURATIONS,
  MAP_ZOOM_FROM,
  cubicBezier,
  mapTarget,
  openTime,
  portalFrame,
  portalGeometry,
} from '../timeline';
import { LOGO_POINTS } from '../cat-paths';

const phone = { width: 390, height: 844 };
const laptop = { width: 1280, height: 800 };
const badge = { left: 22, top: 22, width: 36, height: 36 };
const land = DURATIONS.flightStart + DURATIONS.flight;

describe('cubicBezier', () => {
  it('matches the end points and stays monotonic for an ease', () => {
    const ease = cubicBezier(0.65, 0, 0.35, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 3);
    let last = 0;
    for (let p = 0.05; p < 1; p += 0.05) {
      expect(ease(p)).toBeGreaterThanOrEqual(last);
      last = ease(p);
    }
  });

  it('overshoots for a back-out curve', () => {
    const pop = cubicBezier(0.34, 1.56, 0.64, 1);
    expect(Math.max(...[0.5, 0.6, 0.7, 0.8].map(pop))).toBeGreaterThan(1);
  });
});

describe('mapTarget', () => {
  it('uses the middle of the visible map above the phone sheet', () => {
    // The map container ends 43dvh - 24px above the bottom.
    expect(mapTarget(390, 844)).toEqual({ x: 195, y: (844 - (0.43 * 844 - 24)) / 2 });
  });

  it('shifts right by half the sidebar on wide screens, like MapArea', () => {
    expect(mapTarget(1280, 800)).toEqual({ x: 840, y: 400 });
    expect(mapTarget(1100, 800)).toEqual({ x: 730, y: 400 });
    expect(mapTarget(900, 700)).toEqual({ x: 610, y: 350 });
  });
});

describe('portalGeometry', () => {
  it('starts on the badge logo and waits in the middle', () => {
    const geo = portalGeometry(phone, badge);
    const k = 36 / 1024;
    expect(geo.start.k).toBeCloseTo(k);
    expect(geo.start.x).toBeCloseTo(22 + LOGO_POINTS.forehead.x * k);
    expect(geo.wait.k).toBeCloseTo(112 / 1024);
    expect(geo.anchor).toEqual(LOGO_POINTS.forehead);
  });

  it('grows from between the eyes on wide screens', () => {
    const geo = portalGeometry(laptop, null);
    expect(geo.anchor).toEqual(LOGO_POINTS.betweenEyes);
    expect(geo.waitSize).toBe(150);
    // Without a badge, the cat pops in where it waits.
    expect(geo.start.x).toBe(geo.wait.x);
  });
});

describe('openTime', () => {
  it('holds the cat for a moment after landing even if the map is already ready', () => {
    expect(openTime(0, false)).toBe(land + DURATIONS.minHold);
  });

  it('lets the idle loop come to rest after a late map', () => {
    expect(openTime(3000, false)).toBe(3000 + DURATIONS.idleRest);
  });
});

describe('portalFrame', () => {
  const geo = { ...portalGeometry(phone, badge), kEnd: 2.2 };
  const waiting = { reduced: false, openAt: null, hasPin: true };

  it('rests on the badge at the start', () => {
    const f = portalFrame(1, waiting, geo);
    expect(f.cat.x).toBeCloseTo(geo.start.x);
    expect(f.cat.k).toBeCloseTo(geo.start.k);
    expect(f.cover).toBe(0);
    expect(f.chrome).toBe('cover');
  });

  it('keeps waiting with the cover up until Open is known', () => {
    const f = portalFrame(10_000, waiting, geo);
    expect(f.cover).toBe(1);
    expect(f.hole).toBe(false);
    expect(f.caption).toBe(1);
    expect(f.done).toBe(false);
  });

  it('cuts the hole and zooms the map while growing, then settles', () => {
    const openAt = 1500;
    const plan = { ...waiting, openAt };
    const growAt = openAt + DURATIONS.squash;
    const settleAt = growAt + DURATIONS.grow;

    const growing = portalFrame(growAt + DURATIONS.grow / 2, plan, geo);
    expect(growing.hole).toBe(true);
    expect(growing.cat.k).toBeGreaterThan(geo.wait.k);
    expect(growing.mapScale).toBeLessThan(MAP_ZOOM_FROM);
    expect(growing.mapScale).toBeGreaterThan(1);

    const settling = portalFrame(settleAt + 10, plan, geo);
    expect(settling.chrome).toBe('settle');
    expect(settling.cover).toBe(0);
    expect(settling.passThrough).toBe(true);

    const pulsing = portalFrame(settleAt + 600, plan, geo);
    expect(pulsing.pulse).not.toBeNull();

    const finished = portalFrame(settleAt + DURATIONS.settle, plan, geo);
    expect(finished.done).toBe(true);
    expect(finished.chrome).toBe('done');
  });

  it('skips the pin pulse when the organizer has no starting point', () => {
    const plan = { reduced: false, openAt: 1500, hasPin: false };
    const settleAt = 1500 + DURATIONS.squash + DURATIONS.grow;
    expect(portalFrame(settleAt + 600, plan, geo).pulse).toBeNull();
  });

  it('only fades when reduced motion is on', () => {
    const plan = { reduced: true, openAt: 1000, hasPin: true };
    const waitFrame = portalFrame(800, plan, geo);
    expect(waitFrame.cat.x).toBe(geo.wait.x);
    expect(waitFrame.cat.k).toBe(geo.wait.k);
    expect(waitFrame.hole).toBe(false);
    expect(waitFrame.mapScale).toBe(1);

    const fading = portalFrame(1000 + DURATIONS.reducedCrossfade / 2, plan, geo);
    expect(fading.cover).toBeGreaterThan(0);
    expect(fading.cover).toBeLessThan(1);
    expect(fading.chrome).toBe('done');
    expect(portalFrame(1000 + DURATIONS.reducedCrossfade, plan, geo).done).toBe(true);
  });
});
