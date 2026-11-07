'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { CAT_HEAD_PATH } from '@/features/meeting/lib/cat-head';
import { slideLocks, slideOffset } from '@/features/meeting/lib/slide-to-lock';
import { cn } from '@/shared/lib/cn';
import { defineMessages, useMessages } from '@/shared/lib/i18n';

const messages = defineMessages({
  en: {
    slide: (venue: string) => `Slide to lock in ${venue}`,
    lock: (venue: string) => `Lock in ${venue}`,
    locking: 'Locking in…',
  },
  zh: {
    slide: (venue: string) => `滑动，就定${venue}`,
    lock: (venue: string) => `就定${venue}`,
    locking: '正在确定…',
  },
});

const THUMB = 44;
const INSET = 4;
const NUDGE = 26;
const NUDGE_MS = 220;
const CLICK_SLOP = 3;

/** The last decision is a physical gesture, so it can't happen by accident. Keyboard and screen readers activate the thumb instead. */
export function SlideToLock({
  venueName,
  onLock,
}: {
  venueName: string;
  onLock: () => Promise<boolean>;
}) {
  const t = useMessages(messages);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; lastX: number; lastAt: number; pxPerMs: number } | null>(
    null
  );
  const [offset, setOffset] = useState(0);
  const [nudged, setNudged] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [locking, setLocking] = useState(false);

  const spanOf = () => (trackRef.current?.clientWidth ?? 0) - THUMB - INSET * 2;

  const nudge = () => {
    setNudged(true);
    setTimeout(() => setNudged(false), NUDGE_MS);
  };

  const lock = async () => {
    if (locking) return;
    setOffset(spanOf());
    setLocking(true);
    const locked = await onLock();
    setLocking(false);
    if (!locked) setOffset(0);
  };

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (locking || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      startX: event.clientX,
      lastX: event.clientX,
      lastAt: event.timeStamp,
      pxPerMs: 0,
    };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    const elapsed = event.timeStamp - current.lastAt;
    if (elapsed > 0) current.pxPerMs = (event.clientX - current.lastX) / elapsed;
    current.lastX = event.clientX;
    current.lastAt = event.timeStamp;
    setOffset(slideOffset(event.clientX - current.startX, spanOf()));
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setDragging(false);
    const dragged = event.clientX - current.startX;
    const span = spanOf();
    if (Math.abs(dragged) <= CLICK_SLOP) nudge();
    if (slideLocks(slideOffset(dragged, span), span, current.pxPerMs)) void lock();
    else setOffset(0);
  };

  const cancelDrag = () => {
    drag.current = null;
    setDragging(false);
    setOffset(0);
  };

  const span = Math.max(1, spanOf());
  const shown = offset + (nudged ? NUDGE : 0);
  // Only a released thumb animates. Under the pointer, any transition makes it trail behind.
  const settle =
    !dragging && 'duration-300 ease-[cubic-bezier(.2,1.3,.4,1)] motion-reduce:transition-none';

  return (
    <div
      ref={trackRef}
      onClick={(event) => {
        if (event.target === event.currentTarget && !locking) nudge();
      }}
      aria-busy={locking}
      className="rad-border relative h-[52px] w-full select-none rounded-full"
    >
      <div className="pointer-events-none absolute inset-[2px] overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full bg-v2-coral', settle, settle && 'transition-[width]')}
          style={{ width: THUMB + INSET + shown }}
        />
      </div>
      <span
        aria-live="polite"
        className="pointer-events-none absolute inset-y-0 left-[56px] right-4 flex items-center justify-center"
      >
        <span
          className="truncate text-[13.5px] font-semibold text-white"
          style={{ opacity: locking ? 1 : Math.max(0, 1 - (offset / span) * 1.2) }}
        >
          {locking ? t.locking : t.slide(venueName)}
        </span>
      </span>
      <button
        type="button"
        aria-label={t.lock(venueName)}
        disabled={locking}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onClick={(event) => {
          // A pointer's click is the drag's to judge. Keyboard and assistive clicks have no detail.
          if (event.detail === 0) void lock();
        }}
        className={cn(
          'absolute grid touch-none place-items-center rounded-full bg-white text-v2-ink shadow-[0_2px_8px_rgba(0,0,0,.28)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
          settle,
          settle && 'transition-transform'
        )}
        style={{
          top: INSET,
          left: INSET,
          width: THUMB,
          height: THUMB,
          transform: `translateX(${shown}px)`,
        }}
      >
        {locking ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 100 100" aria-hidden="true" className="size-[26px]">
            <path d={CAT_HEAD_PATH} fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}
