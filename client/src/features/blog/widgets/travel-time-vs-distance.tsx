'use client';

import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  MIDDLE,
  TEAM,
  VENUES,
  describeVenue,
  summarize,
  type TeammateId,
  type Venue,
  type VenueId,
} from './travel-time-example';

/**
 * Two venues on a small city map: one closest to the middle, one easiest to
 * reach. Switching redraws the routes, pops the venue and tweens the bars and
 * numbers, in the motion language of the landing's story card.
 *
 * The server renders the final frame of venue A. The intro only arms (hides
 * that frame) when the map starts fully off screen, then plays once on the
 * first scroll into view. Reduced motion skips all of it.
 */

const VENUE_IDS = Object.keys(VENUES) as VenueId[];
/** One scale for both venues, so the bars compare across the switch. */
const SCALE_MINUTES = 60;
/** Share of the figure that must be on screen before the intro plays. */
const PLAY_AT = 0.5;
const COUNT_DELAY_MS = 150;
const COUNT_MS = 700;
const LABEL_SIDE: Record<TeammateId, 1 | -1> = { ana: -1, ben: 1, cy: -1 };

/** The numbers that count up together: each teammate's minutes, then these. */
const LONGEST = TEAM.length;
const SPREAD = TEAM.length + 1;
const MILES = TEAM.length + 2;

function counts(venue: Venue): readonly number[] {
  const { minutes, longest, spread, miles } = summarize(venue);
  return [...minutes, longest, spread, miles];
}
/** Built once, so the tween sees a stable reference per venue. */
const COUNTS: Record<VenueId, readonly number[]> = {
  closest: counts(VENUES.closest),
  easiest: counts(VENUES.easiest),
};
const ZEROS = COUNTS.closest.map(() => 0);

const OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

const css = `
  .ttd-route {
    fill: none; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 1; stroke-dashoffset: 1;
    transition: stroke-dashoffset 250ms cubic-bezier(0.4, 0, 1, 1);
  }
  .ttd-casing { stroke: #fff; stroke-width: 8; }
  .ttd-line { stroke-width: 4; }
  .ttd-route[data-on] {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 900ms cubic-bezier(0.65, 0, 0.35, 1) calc(200ms + var(--i) * 150ms);
  }
  .ttd-venue {
    transform-box: fill-box; transform-origin: center; opacity: 0.55;
    transition: transform 250ms ease, opacity 250ms ease;
  }
  .ttd-venue-dot { fill: #9aa1aa; transition: fill 250ms ease; }
  .ttd-venue[data-on] {
    opacity: 1; transform: scale(1.18);
    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease;
  }
  .ttd-venue[data-on] .ttd-venue-dot { fill: #c83f49; }
  .ttd-crow { opacity: 0; transition: opacity 200ms ease; }
  .ttd-crow[data-on] { opacity: 1; transition: opacity 400ms ease 300ms; }
  .ttd-ring {
    fill: none; stroke: #c83f49; stroke-width: 2; opacity: 0;
    transform-box: fill-box; transform-origin: center;
    animation: ttd-ring 900ms ease-out;
  }
  @keyframes ttd-ring {
    from { opacity: 0.8; transform: scale(0.7); }
    to { opacity: 0; transform: scale(2); }
  }
  .ttd-bar, .ttd-band {
    transition: width ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms, left ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms,
      opacity 200ms ease ${COUNT_DELAY_MS}ms;
  }
  .ttd-thumb { transition: transform 350ms ${OUT}; }
  .ttd-letter { transition: background-color 250ms ease; }

  .ttd[data-armed] .ttd-route { stroke-dashoffset: 1; transition: none; }
  .ttd[data-armed] .ttd-venue { opacity: 0; transform: scale(0.5); transition: none; }
  .ttd[data-armed] .ttd-crow { opacity: 0; transition: none; }
  .ttd[data-armed] .ttd-bar { transition: none; }
  .ttd[data-armed] .ttd-band { opacity: 0; transition: none; }

  @media (prefers-reduced-motion: reduce) {
    .ttd * { transition: none !important; animation: none !important; }
  }
`;

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts each number from what it shows now to `target`, in step with the bars. */
function useCountTo(target: readonly number[], animate: boolean) {
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

const percent = (minutes: number) => `${(minutes / SCALE_MINUTES) * 100}%`;

export function TravelTimeVsDistance() {
  const [selected, setSelected] = useState<VenueId>('closest');
  const [armed, setArmed] = useState(false);
  /** Bumped on every pick, so the ring remounts and pulses again. */
  const [picks, setPicks] = useState(0);
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
          setPicks((n) => n + 1);
        }
      },
      { threshold: [0, PLAY_AT] }
    );
    observer.observe(figure);
    introRef.current = observer;
    return () => observer.disconnect();
  }, []);

  function select(id: VenueId) {
    if (id === selected && !armed) return;
    introRef.current?.disconnect();
    setArmed(false);
    setSelected(id);
    setPicks((n) => n + 1);
  }

  const venue = VENUES[selected];
  const target = armed ? ZEROS : COUNTS[selected];
  const counted = useCountTo(target, !armed);

  return (
    <figure ref={figureRef} className="ttd mt-6" data-armed={armed || undefined}>
      <style>{css}</style>
      <div className="-mx-2.5 rounded-[24px] bg-white p-2.5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] ring-1 ring-[#e6eaef] sm:mx-0 sm:p-4">
        <div
          role="group"
          aria-label="Venue"
          className="relative grid grid-cols-2 rounded-[16px] bg-[#eef1f4] p-1"
        >
          <span
            aria-hidden="true"
            className="ttd-thumb absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[12px] bg-white shadow-[0_2px_8px_rgba(23,37,45,0.12)]"
            style={{ transform: selected === 'easiest' ? 'translateX(100%)' : undefined }}
          />
          {VENUE_IDS.map((id) => {
            const pressed = id === selected;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={pressed}
                onClick={() => select(id)}
                className={`relative flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] px-1.5 py-1.5 text-[13px] font-semibold leading-tight sm:flex-row sm:gap-2 sm:px-2 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] sm:text-sm ${
                  pressed ? 'text-[#bc3942]' : 'text-[#666b73] hover:text-[#21252b]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`ttd-letter flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                    pressed ? 'bg-[#c83f49]' : 'bg-[#9aa1aa]'
                  }`}
                >
                  {VENUES[id].letter}
                </span>
                <span>{VENUES[id].label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative mt-2.5 aspect-[16/10] overflow-hidden rounded-[20px] bg-[#f7f8fa] ring-1 ring-[#e6eaef] sm:mt-3">
          <svg viewBox="0 0 360 225" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <pattern
                id="ttd-blocks"
                width="45"
                height="45"
                x="30"
                y="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="5" y="5" width="35" height="35" rx="7" fill="#e9edf2" />
                <path d="M22.5 5v35" stroke="#f7f8fa" strokeWidth="2" />
              </pattern>
              <filter id="ttd-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow
                  dx="0"
                  dy="1.5"
                  stdDeviation="1.5"
                  floodColor="#17252d"
                  floodOpacity="0.22"
                />
              </filter>
            </defs>

            <rect x="-45" y="-45" width="450" height="315" fill="url(#ttd-blocks)" />
            <rect x="260" y="160" width="35" height="35" rx="7" fill="#d6ecd4" />
            <circle cx="272" cy="182" r="4" fill="#c2e2bf" />
            <rect x="35" y="160" width="35" height="35" rx="7" fill="#d6ecd4" />
            <circle cx="58" cy="172" r="4" fill="#c2e2bf" />

            <path
              d="M-10 112 C50 109 110 117 180 113 S300 110 370 113 V152 C310 155 240 149 180 152 S60 155 -10 151 Z"
              fill="#d7e7f8"
            />
            <rect x="290" y="106" width="20" height="52" fill="#fff" />
            <path
              d="M286 102l4 6v44l-4 6M314 102l-4 6v44l4 6"
              fill="none"
              stroke="#9aa4af"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path d="M227.5 -5V230" stroke="#c4cbd3" strokeWidth="7" strokeDasharray="1.5 4" />
            <path d="M227.5 -5V230" stroke="#8f99a4" strokeWidth="2.5" />

            {VENUE_IDS.map((id) => (
              <line
                key={id}
                className="ttd-crow"
                data-on={id === selected || undefined}
                x1={MIDDLE.x}
                y1={MIDDLE.y}
                x2={VENUES[id].at.x}
                y2={VENUES[id].at.y}
                stroke="#666b73"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                strokeLinecap="round"
              />
            ))}

            {VENUE_IDS.map((id) =>
              TEAM.map((person, i) => {
                const on = id === selected || undefined;
                const d = VENUES[id].trips[person.id].route;
                const style = { '--i': i } as CSSProperties;
                return (
                  <g key={`${id}-${person.id}`}>
                    <path
                      d={d}
                      className="ttd-route ttd-casing"
                      pathLength={1}
                      data-on={on}
                      style={style}
                    />
                    <path
                      d={d}
                      className="ttd-route ttd-line"
                      stroke={person.color}
                      pathLength={1}
                      data-on={on}
                      style={style}
                    />
                  </g>
                );
              })
            )}

            {[200, 42].map((y) => (
              <circle
                key={y}
                cx="227.5"
                cy={y}
                r="4.5"
                fill="#fff"
                stroke="#5f6974"
                strokeWidth="2"
              />
            ))}

            <circle
              cx={MIDDLE.x}
              cy={MIDDLE.y}
              r="7"
              fill="#fff"
              fillOpacity="0.85"
              stroke="#666b73"
              strokeWidth="1.25"
              strokeDasharray="2 2"
            />
            <circle cx={MIDDLE.x} cy={MIDDLE.y} r="2.25" fill="#666b73" />

            {VENUE_IDS.map((id) => {
              const { at, letter } = VENUES[id];
              return (
                <g
                  key={id}
                  className="ttd-venue"
                  data-on={id === selected || undefined}
                  filter="url(#ttd-shadow)"
                >
                  <circle
                    className="ttd-venue-dot"
                    cx={at.x}
                    cy={at.y}
                    r="12"
                    stroke="#fff"
                    strokeWidth="2.5"
                  />
                  <text
                    x={at.x}
                    y={at.y + 4.2}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="700"
                    fill="#fff"
                  >
                    {letter}
                  </text>
                </g>
              );
            })}
            {picks > 0 && !armed && (
              <circle key={picks} className="ttd-ring" cx={venue.at.x} cy={venue.at.y} r="15" />
            )}

            {TEAM.map((person) => {
              const { x, y } = person.at;
              const side = LABEL_SIDE[person.id];
              const width = 14 + person.name.length * 8.2;
              const labelX = side === 1 ? x + 17 : x - 17 - width;
              return (
                <g key={person.id} filter="url(#ttd-shadow)">
                  <circle
                    cx={x}
                    cy={y}
                    r="12"
                    fill={person.color}
                    stroke="#fff"
                    strokeWidth="2.5"
                  />
                  <g
                    transform={`translate(${x - 6.6} ${y - 7.2}) scale(0.55)`}
                    fill="none"
                    stroke="white"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </g>
                  <rect x={labelX} y={y - 11} width={width} height="22" rx="11" fill="#fff" />
                  <text
                    x={labelX + width / 2}
                    y={y + 4.6}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill={person.ink}
                  >
                    {person.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div
          aria-hidden="true"
          className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-1"
        >
          <div
            className="relative -my-1.5 self-stretch"
            style={{ gridColumn: 2, gridRow: '1 / 4' }}
          >
            <div
              className="ttd-band absolute inset-y-0 border-l-[1.5px] border-dashed border-[#c83f49]/40 bg-[#c83f49]/[0.07]"
              style={{
                left: percent(target[LONGEST] - target[SPREAD]),
                width: percent(target[SPREAD]),
              }}
            >
              <span className="absolute inset-y-0 -right-px w-0.5 rounded-full bg-[#c83f49]" />
            </div>
          </div>
          {TEAM.map((person, i) => (
            <Fragment key={person.id}>
              <span
                className="flex items-center gap-1.5 text-sm font-semibold text-[#21252b]"
                style={{ gridColumn: 1, gridRow: i + 1 }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                {person.name}
              </span>
              <span
                className="relative h-2.5 rounded-full bg-[#21252b]/[0.06]"
                style={{ gridColumn: 2, gridRow: i + 1 }}
              >
                <span
                  className="ttd-bar absolute inset-y-0 left-0 rounded-full"
                  style={{ width: percent(target[i]), backgroundColor: person.color }}
                />
              </span>
              <span
                className="w-[52px] text-right text-sm font-semibold tabular-nums"
                style={{ gridColumn: 3, gridRow: i + 1, color: person.ink }}
              >
                {Math.round(counted[i])} min
              </span>
            </Fragment>
          ))}
        </div>

        <div aria-hidden="true" className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            {
              label: 'Longest trip',
              value: Math.round(counted[LONGEST]),
              unit: 'min',
              swatch: <span className="h-3 w-0.5 rounded-full bg-[#c83f49]" />,
            },
            {
              label: 'Spread',
              value: Math.round(counted[SPREAD]),
              unit: 'min',
              swatch: (
                <span className="h-3 w-2.5 border-l-[1.5px] border-dashed border-[#c83f49]/40 bg-[#c83f49]/15" />
              ),
            },
            {
              label: 'Straight line',
              value: counted[MILES].toFixed(1),
              unit: 'mi',
              swatch: (
                <svg viewBox="0 0 12 12" className="h-3 w-3">
                  <path
                    d="M2 10 10 2"
                    stroke="#666b73"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    strokeLinecap="round"
                  />
                </svg>
              ),
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col justify-between gap-1 rounded-2xl bg-[#f7f8fa] px-2.5 py-2.5 sm:px-3"
            >
              <div className="flex items-start gap-1.5 text-[11px] font-semibold leading-tight text-[#666b73] sm:text-xs">
                <span className="mt-px flex h-3 shrink-0 items-center">{stat.swatch}</span>
                {stat.label}
              </div>
              <div className="text-lg font-bold leading-tight tabular-nums text-[#21252b] sm:text-xl">
                {stat.value}
                <span className="ml-0.5 text-xs font-semibold text-[#666b73]">{stat.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          {describeVenue(venue)}
        </p>
      </div>

      <figcaption className="mt-3 px-1 text-sm leading-relaxed text-[#666b73]">
        <strong className="font-semibold text-[#21252b]">Example.</strong> A looks closest, but Cy
        is across the river from it and the only bridge is far away, so Cy&rsquo;s trip takes{' '}
        {VENUES.closest.trips.cy.minutes} minutes.
      </figcaption>
    </figure>
  );
}
