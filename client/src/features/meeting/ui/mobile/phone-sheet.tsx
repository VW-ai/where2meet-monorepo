'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  phonePlan,
  usePanelMode,
  usePhonePlanStore,
  type Detent,
  type PanelMode,
} from '@/features/meeting/model/phone-plan-store';

const AXIS_SLOP = 6;
const PROJECT_MS = 180;
const TOP_GAP = 58;

export interface SheetSizes {
  small: number;
  mid: number;
  full: number;
}

/** A sheet stops only at the detents that make sense for what it shows. */
const FLOAT_GAP = 8;

export function detentsFor(mode: PanelMode): readonly Detent[] {
  if (mode === 'aim') return ['small'];
  if (mode === 'locked') return ['small', 'full'];
  return ['small', 'mid', 'full'];
}

export function sheetSizes(
  mode: PanelMode,
  height: number,
  safeBottom: number,
  lockable: boolean
): SheetSizes {
  const small =
    mode === 'places'
      ? 22 + 54 + 158 + (lockable ? 76 : 10) + safeBottom
      : mode === 'locked'
        ? Math.max(300 + safeBottom, 340)
        : mode === 'aim'
          ? 22 + 70 + 76 + safeBottom
          : 22 + 66 + 76 + safeBottom;
  return { small, mid: Math.max(height * 0.46, 380), full: height - TOP_GAP };
}

/** The keyboard shrinks the visual viewport only, so the sheet has to move up by hand. */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () =>
      setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

function useSafeBottom(): number {
  const [safe, setSafe] = useState(0);
  useLayoutEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;height:var(--pp-safe-bottom,env(safe-area-inset-bottom,0px))';
    document.querySelector('.pp-plan')?.appendChild(probe);
    setSafe(probe.getBoundingClientRect().height);
    probe.remove();
  }, []);
  return safe;
}

export function PhoneSheet({ lockable, children }: { lockable: boolean; children: ReactNode }) {
  const mode = usePanelMode();
  const detent = usePhonePlanStore((state) => state.detent);
  const keyboard = useKeyboardInset();
  const safeBottom = useSafeBottom();
  const [viewHeight, setViewHeight] = useState(() => window.innerHeight);
  const rootRef = useRef<HTMLDivElement>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setViewHeight(window.innerHeight);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const sizes = sheetSizes(mode, viewHeight, safeBottom, lockable);
  const allowed = detentsFor(mode);
  const settled = allowed.includes(detent) ? detent : allowed[0];
  const height = Math.min(dragHeight ?? sizes[settled], viewHeight - TOP_GAP - keyboard);

  const live = useRef({ sizes, allowed, settled, height });
  live.current = { sizes, allowed, settled, height };

  useEffect(() => {
    usePhonePlanStore.setState({ panelHeight: sizes[settled] });
  }, [sizes, settled]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let gesture: {
      startY: number;
      startX: number;
      startHeight: number;
      axis: 'none' | 'x' | 'y' | 'scroll';
      lastY: number;
      lastAt: number;
      velocity: number;
      scroller: HTMLElement | null;
    } | null = null;

    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gesture = null;
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('[data-pp-own-gesture]')) return;
      const touch = event.touches[0];
      gesture = {
        startY: touch.clientY,
        startX: touch.clientX,
        startHeight: live.current.height,
        axis: 'none',
        lastY: touch.clientY,
        lastAt: event.timeStamp,
        velocity: 0,
        scroller: target.closest<HTMLElement>('[data-pp-scroll]'),
      };
    };

    const move = (event: TouchEvent) => {
      if (!gesture) return;
      const touch = event.touches[0];
      const dy = touch.clientY - gesture.startY;
      const dx = touch.clientX - gesture.startX;
      if (gesture.axis === 'none') {
        const full = live.current.settled === 'full';
        const scrollable =
          gesture.scroller && gesture.scroller.scrollHeight > gesture.scroller.clientHeight;
        const atTop = !gesture.scroller || gesture.scroller.scrollTop <= 0;
        // An unclaimed first move would hand the touch to the browser's own scrolling for good
        if (full && scrollable && !(atTop && dy > 0)) {
          gesture.axis = 'scroll';
          return;
        }
        if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) {
          if (event.cancelable) event.preventDefault();
          return;
        }
        gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (gesture.axis !== 'y') return;
      if (event.cancelable) event.preventDefault();
      const elapsed = event.timeStamp - gesture.lastAt;
      if (elapsed > 0) gesture.velocity = (touch.clientY - gesture.lastY) / elapsed;
      gesture.lastY = touch.clientY;
      gesture.lastAt = event.timeStamp;
      const { sizes: bounds, allowed: stops } = live.current;
      const top = bounds[stops[stops.length - 1]];
      const bottom = bounds[stops[0]];
      const next = gesture.startHeight - dy;
      // Past either end the sheet resists instead of stopping dead
      const rubber =
        next > top
          ? top + (next - top) * 0.25
          : next < bottom
            ? bottom - (bottom - next) * 0.25
            : next;
      setDragHeight(rubber);
    };

    const end = () => {
      const finished = gesture;
      gesture = null;
      if (!finished || finished.axis !== 'y') return;
      const { sizes: bounds, allowed: stops, height: current } = live.current;
      const projected = current - finished.velocity * PROJECT_MS;
      const nearest = stops.reduce((best, stop) =>
        Math.abs(bounds[stop] - projected) < Math.abs(bounds[best] - projected) ? stop : best
      );
      setDragHeight(null);
      if (document.activeElement instanceof HTMLElement && nearest !== 'full') {
        document.activeElement.blur();
      }
      phonePlan.setDetent(nearest);
    };

    root.addEventListener('touchstart', start, { passive: true });
    root.addEventListener('touchmove', move, { passive: false });
    root.addEventListener('touchend', end);
    root.addEventListener('touchcancel', end);
    return () => {
      root.removeEventListener('touchstart', start);
      root.removeEventListener('touchmove', move);
      root.removeEventListener('touchend', end);
      root.removeEventListener('touchcancel', end);
    };
  }, []);

  const cycle = () => {
    const index = allowed.indexOf(settled);
    phonePlan.setDetent(allowed[(index + 1) % allowed.length]);
  };

  return (
    <div
      ref={rootRef}
      className="pp-sheet"
      data-dragging={dragHeight !== null || undefined}
      data-detent={settled}
      data-mode={mode}
      style={{ height, bottom: keyboard || (settled === 'full' ? 0 : FLOAT_GAP) }}
    >
      <button type="button" className="pp-grabber" aria-label="Resize panel" onClick={cycle}>
        <span />
      </button>
      {children}
    </div>
  );
}
