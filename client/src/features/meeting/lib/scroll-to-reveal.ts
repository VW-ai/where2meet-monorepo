/** Room the add button takes at the top of the list where it sticks. */
const STICKY_TOP = 64;

interface Span {
  top: number;
  bottom: number;
}

/**
 * How far to scroll a list so an item is in full view below its sticky button, or 0 if it already
 * is. An item taller than the view shows its top.
 */
export function scrollToReveal(item: Span, view: Span, buttonSticks = true): number {
  const viewTop = view.top + (buttonSticks ? STICKY_TOP : 0);
  if (item.top < viewTop) return item.top - viewTop;
  const overBottom = item.bottom - view.bottom;
  return overBottom > 0 ? Math.min(overBottom, item.top - viewTop) : 0;
}
