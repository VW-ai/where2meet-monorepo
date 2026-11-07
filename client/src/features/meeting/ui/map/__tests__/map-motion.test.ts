import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarkerDrops, revealStrokes, routePillImage, type RouteStroke } from '../map-motion';

const PATH = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 10 },
];

function fakePolyline() {
  return { setPath: vi.fn(), setOptions: vi.fn() };
}

function lastPath(polyline: ReturnType<typeof fakePolyline>) {
  return polyline.setPath.mock.lastCall?.[0];
}

describe('revealStrokes', () => {
  let frames: Array<(now: number) => void>;

  const runFrame = (now: number) => {
    const current = frames;
    frames = [];
    current.forEach((frame) => frame(now));
  };

  beforeEach(() => {
    frames = [];
    vi.stubGlobal('google', { maps: { SymbolPath: { CIRCLE: 0 } } });
    vi.stubGlobal('requestAnimationFrame', (frame: (now: number) => void) => frames.push(frame));
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts every stroke at its first point with a head dot', () => {
    const polyline = fakePolyline();
    revealStrokes([{ polyline, path: PATH, color: '#f00' }], () => {});
    expect(polyline.setPath).toHaveBeenCalledWith([{ lat: 0, lng: 0 }]);
    expect(polyline.setOptions.mock.lastCall?.[0].icons[0].offset).toBe('100%');
  });

  it('ends on the whole path with no dot, and arrives once', () => {
    const polyline = fakePolyline();
    const stroke: RouteStroke = { polyline, path: PATH, color: '#f00' };
    const onArrive = vi.fn();
    revealStrokes([stroke], onArrive);

    runFrame(0);
    runFrame(5000);

    expect(lastPath(polyline)).toEqual(PATH);
    expect(polyline.setOptions).toHaveBeenLastCalledWith({ icons: [] });
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onArrive).toHaveBeenCalledWith(stroke);
    expect(frames).toEqual([]);
  });

  it('staggers: a later stroke is still at the start when the first has moved', () => {
    const first = fakePolyline();
    const second = fakePolyline();
    revealStrokes(
      [
        { polyline: first, path: PATH, color: '#f00' },
        { polyline: second, path: PATH, color: '#0f0' },
      ],
      () => {}
    );

    runFrame(0);
    runFrame(200);

    expect(lastPath(first).at(-1).lng).toBeGreaterThan(0);
    expect(lastPath(second).at(-1).lng).toBe(0);
  });

  it('stops moving after cancel', () => {
    const polyline = fakePolyline();
    const onArrive = vi.fn();
    const cancel = revealStrokes([{ polyline, path: PATH, color: '#f00' }], onArrive);

    runFrame(0);
    cancel();
    runFrame(5000);

    expect(onArrive).not.toHaveBeenCalled();
    expect(lastPath(polyline)).not.toEqual(PATH);
  });
});

describe('createMarkerDrops', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('google', { maps: { Animation: { DROP: 'drop' } } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function fakeMarker() {
    let map: object | null = { map: true };
    return {
      getMap: vi.fn(() => map),
      setMap: vi.fn((next: object | null) => {
        map = next;
      }),
      setAnimation: vi.fn(),
    };
  }

  const place = (
    drops: ReturnType<typeof createMarkerDrops>,
    id: string,
    marker: ReturnType<typeof fakeMarker>,
    animate = true
  ) => drops.place(id, marker as unknown as google.maps.Marker, animate);

  it('hides a new marker, then drops it, staggered', () => {
    const drops = createMarkerDrops(100);
    const [a, b] = [fakeMarker(), fakeMarker()];
    place(drops, 'a', a);
    place(drops, 'b', b);
    expect(a.getMap()).toBeNull();
    expect(b.getMap()).toBeNull();

    vi.advanceTimersByTime(0);
    expect(a.setAnimation).toHaveBeenCalledWith('drop');
    expect(a.getMap()).not.toBeNull();
    expect(b.setAnimation).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(b.setAnimation).toHaveBeenCalledWith('drop');
  });

  it('never replays for a marker rebuilt with the same id', () => {
    const drops = createMarkerDrops(100);
    place(drops, 'a', fakeMarker());
    vi.advanceTimersByTime(0);

    const rebuilt = fakeMarker();
    place(drops, 'a', rebuilt);
    vi.runAllTimers();
    expect(rebuilt.setAnimation).not.toHaveBeenCalled();
    expect(rebuilt.setMap).not.toHaveBeenCalled();
  });

  it('remembers ids seen while animation was off', () => {
    const drops = createMarkerDrops(100);
    place(drops, 'a', fakeMarker(), false);

    const later = fakeMarker();
    place(drops, 'a', later);
    vi.runAllTimers();
    expect(later.setAnimation).not.toHaveBeenCalled();
  });

  it('does not bring a thrown-away marker back', () => {
    const drops = createMarkerDrops(100);
    const gone = fakeMarker();
    place(drops, 'a', gone);
    drops.cancelPending();
    vi.runAllTimers();
    expect(gone.getMap()).toBeNull();
    expect(gone.setAnimation).not.toHaveBeenCalled();
  });
});

describe('routePillImage', () => {
  it('draws the label in a pill bordered in the participant colour', () => {
    const { url, height } = routePillImage('11 min', '#847ce1');
    const svg = decodeURIComponent(url.replace('data:image/svg+xml,', ''));
    expect(height).toBe(24);
    expect(svg).toContain('stroke="#847ce1"');
    expect(svg).toContain('>11 min</text>');
  });

  it('leaves more room for Chinese than for the same count of Latin characters', () => {
    expect(routePillImage('十一分钟', '#000').width).toBeGreaterThan(
      routePillImage('abcd', '#000').width
    );
  });
});
