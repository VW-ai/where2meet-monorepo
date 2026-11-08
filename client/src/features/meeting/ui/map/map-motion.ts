import { pathUpTo, type PathPoint } from '@/features/meeting/lib/path-up-to';
import { usePhonePlanStore } from '@/features/meeting/model/phone-plan-store';
import type { TravelMode } from '@/shared/types/map';

const REVEAL_LEAD_MS = 120;
const REVEAL_STAGGER_MS = 140;
const REVEAL_DURATION_MS = 850;
const PULSE_DURATION_MS = 800;
const DROP_STAGGER_MS = 90;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export interface RouteStroke {
  polyline: Pick<google.maps.Polyline, 'setPath' | 'setOptions'>;
  path: PathPoint[];
  color: string;
  /** What draws the line when its own stroke is hidden, as a dashed route's is */
  icons?: google.maps.IconSequence[];
}

export function drawStroke(stroke: RouteStroke) {
  stroke.polyline.setPath(stroke.path);
  stroke.polyline.setOptions({ icons: stroke.icons ?? [] });
}

/** Classic's one line for everyone stays solid, so it never reads as anyone's own mode. */
export type RouteLine = TravelMode | 'solid';

/** Dash and gap in pixels. Walking is a line of dots. */
const ROUTE_DASH: Record<RouteLine, readonly [dash: number, gap: number] | null> = {
  solid: null,
  driving: [18, 9],
  transit: [11, 8],
  bicycling: [3, 7],
  walking: [0, 8],
};

const PHONE_ROUTE_DASH = [12, 8] as const;

/** Google polylines have no dash option: a dashed line is a hidden stroke with a repeating symbol. */
export function routeStrokeStyle(line: RouteLine, focused: boolean) {
  const strokeOpacity = focused ? 0.9 : 0.3;
  const strokeWeight = focused ? 5 : 3;
  const zIndex = focused ? 20 : 5;
  // The phone flow draws everyone's line the same way, whatever the mode
  const dash = usePhonePlanStore.getState().active ? PHONE_ROUTE_DASH : ROUTE_DASH[line];
  if (!dash) return { strokeOpacity, strokeWeight, zIndex, icons: [] };

  const [length, gap] = dash;
  const icon: google.maps.Symbol =
    length === 0
      ? {
          path: google.maps.SymbolPath.CIRCLE,
          scale: strokeWeight / 2,
          fillOpacity: strokeOpacity,
          strokeOpacity: 0,
        }
      : {
          path: `M 0,0 0,${length}`,
          scale: 1,
          strokeOpacity,
          strokeWeight,
        };
  return {
    strokeOpacity: 0,
    strokeWeight,
    zIndex,
    icons: [{ icon, offset: '0', repeat: `${length + gap}px` }],
  };
}

function headDot(color: string): google.maps.IconSequence[] {
  return [
    {
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
      offset: '100%',
    },
  ];
}

/**
 * Grows each stroke from its start, staggered, with a dot on the head.
 * Returns a cancel that stops the animation where it is; the caller owns the polylines.
 */
export function revealStrokes(strokes: readonly RouteStroke[]): () => void {
  const waiting = new Set(strokes);
  let frame = 0;
  let start: number | null = null;

  strokes.forEach((stroke) => {
    stroke.polyline.setPath(pathUpTo(stroke.path, 0));
    stroke.polyline.setOptions({ icons: [...(stroke.icons ?? []), ...headDot(stroke.color)] });
  });

  const tick = (now: number) => {
    start ??= now;
    strokes.forEach((stroke, index) => {
      if (!waiting.has(stroke)) return;
      const elapsed = now - start! - REVEAL_LEAD_MS - index * REVEAL_STAGGER_MS;
      const t = Math.max(0, Math.min(1, elapsed / REVEAL_DURATION_MS));
      if (t < 1) {
        stroke.polyline.setPath(pathUpTo(stroke.path, easeInOut(t)));
        return;
      }
      drawStroke(stroke);
      waiting.delete(stroke);
    });
    if (waiting.size > 0) frame = requestAnimationFrame(tick);
  };

  if (waiting.size > 0) frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}

type DropMarker = Pick<google.maps.Marker, 'getMap' | 'setMap' | 'setAnimation'>;

/**
 * Markers here are rebuilt on every hover and selection, so an entrance is remembered by id:
 * each id drops once, and only when `animate` is on the first time it is placed.
 */
export function createMarkerDrops(stepMs = DROP_STAGGER_MS) {
  const seen = new Set<string>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    place(id: string, marker: DropMarker, animate: boolean) {
      if (seen.has(id)) return;
      if (!animate) {
        seen.add(id);
        return;
      }
      const map = marker.getMap();
      marker.setMap(null);
      const timer = setTimeout(() => {
        pending.delete(id);
        seen.add(id);
        marker.setAnimation(google.maps.Animation.DROP);
        marker.setMap(map);
      }, pending.size * stepMs);
      pending.set(id, timer);
    },
    /** For when the markers themselves are about to be thrown away. */
    cancelPending() {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    },
    forget(id: string) {
      clearTimeout(pending.get(id));
      pending.delete(id);
    },
  };
}

/** One expanding ring on the selected venue. Returns a cancel. */
export function pulseAt(map: google.maps.Map, position: PathPoint): () => void {
  const ring = new google.maps.Marker({ position, map, clickable: false, zIndex: 40 });
  let frame = 0;
  let start: number | null = null;

  const tick = (now: number) => {
    start ??= now;
    const t = Math.min(1, (now - start) / PULSE_DURATION_MS);
    ring.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 8 + t * 18,
      fillOpacity: 0,
      strokeColor: '#21252b',
      strokeOpacity: 0.75 * (1 - t),
      strokeWeight: 2.5,
    });
    if (t < 1) frame = requestAnimationFrame(tick);
    else ring.setMap(null);
  };

  ring.setIcon({ path: google.maps.SymbolPath.CIRCLE, scale: 8, strokeOpacity: 0 });
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    ring.setMap(null);
  };
}
