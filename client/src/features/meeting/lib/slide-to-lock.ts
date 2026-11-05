const FULL_TRAVEL = 0.82;
const FLICK_TRAVEL = 0.5;
const FLICK_PX_PER_MS = 0.6;

export function slideOffset(dragged: number, span: number): number {
  return Math.min(span, Math.max(0, dragged));
}

/** Most of the way locks, and so does a quick flick past halfway. Anything less springs back. */
export function slideLocks(offset: number, span: number, pxPerMs: number): boolean {
  if (span <= 0) return false;
  return offset > span * FULL_TRAVEL || (offset > span * FLICK_TRAVEL && pxPerMs > FLICK_PX_PER_MS);
}
