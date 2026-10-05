import { useEffect, useRef, useState } from 'react';

/** Share of the figure that must be on screen before the intro plays. */
const PLAY_AT = 0.5;
export const COUNT_DELAY_MS = 150;
export const COUNT_MS = 700;
export const OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Which option an explainer shows, and whether its intro is still pending.
 *
 * The server renders the final frame of `initial`. The intro only arms (hides
 * that frame) when the figure starts fully below the screen, then plays once
 * on the first scroll into view. Reduced motion skips all of it. `plays`
 * counts intros and picks, so a keyed element can replay its entrance.
 */
export function useExplainer<Id extends string>(initial: Id) {
  const [selected, setSelected] = useState(initial);
  const [armed, setArmed] = useState(false);
  const [plays, setPlays] = useState(0);
  const figureRef = useRef<HTMLElement>(null);
  const introRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || prefersReducedMotion()) return;
    let first = true;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        const above = entry.boundingClientRect.top < 0;
        if (first) {
          first = false;
          // Only hide the final frame while the reader has yet to scroll down to it.
          if (entry.intersectionRatio === 0 && !above) setArmed(true);
          else observer.disconnect();
          return;
        }
        // Coming back up from below (or jumping past it) plays at once, so the
        // stats under the map never show the hidden frame.
        if (entry.intersectionRatio >= PLAY_AT || above) {
          observer.disconnect();
          setArmed(false);
          setPlays((n) => n + 1);
        }
      },
      { threshold: [0, PLAY_AT] }
    );
    observer.observe(figure);
    introRef.current = observer;
    return () => observer.disconnect();
  }, []);

  function select(id: Id) {
    if (id === selected && !armed) return;
    introRef.current?.disconnect();
    setArmed(false);
    setSelected(id);
    setPlays((n) => n + 1);
  }

  return { figureRef, selected, select, armed, plays };
}

/** Counts each number from what it shows now to `target`, in step with the bars. */
export function useCountTo(target: readonly number[], animate: boolean) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const show = (values: readonly number[]) => {
      shownRef.current = values;
      setShown(values);
    };
    if (!animate || prefersReducedMotion()) {
      show(target);
      return;
    }
    let start = 0;
    let frame = requestAnimationFrame(function tick(now) {
      start ||= now;
      const t = Math.min(Math.max((now - start - COUNT_DELAY_MS) / COUNT_MS, 0), 1);
      const eased = 1 - (1 - t) ** 3;
      show(target.map((to, i) => from[i] + (to - from[i]) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, animate]);

  return shown;
}
