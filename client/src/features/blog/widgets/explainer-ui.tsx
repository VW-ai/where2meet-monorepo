import { Fragment, createElement, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { UserRound, type IconNode } from 'lucide';
import type { Point } from './explainer-model';
import { COUNT_DELAY_MS, COUNT_MS, OUT } from './explainer-motion';

/**
 * The pieces every blog explainer is built from: a card with a two-way toggle,
 * a small street map, bars per friend, stat chips and a caption, in the motion
 * language of the landing's story card.
 */

const CSS = `
  .explainer-route {
    fill: none; stroke-linecap: round; stroke-linejoin: round;
    stroke-dasharray: 1; stroke-dashoffset: 1;
    transition: stroke-dashoffset 250ms cubic-bezier(0.4, 0, 1, 1);
  }
  .explainer-casing { stroke: #fff; stroke-width: 8; }
  .explainer-line { stroke-width: 4; }
  .explainer-route[data-on] {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 900ms cubic-bezier(0.65, 0, 0.35, 1) calc(200ms + var(--i) * 150ms);
  }
  .explainer-venue {
    transform-box: fill-box; transform-origin: center; opacity: 0.55;
    transition: transform 250ms ease, opacity 250ms ease;
  }
  .explainer-venue-dot { fill: #9aa1aa; transition: fill 250ms ease; }
  .explainer-venue[data-on] {
    opacity: 1; transform: scale(1.18);
    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease;
  }
  .explainer-venue[data-on] .explainer-venue-dot { fill: #c83f49; }
  .explainer-ring {
    fill: none; stroke: #c83f49; stroke-width: 2; opacity: 0;
    transform-box: fill-box; transform-origin: center;
    animation: explainer-ring 900ms ease-out;
  }
  @keyframes explainer-ring {
    from { opacity: 0.8; transform: scale(0.7); }
    to { opacity: 0; transform: scale(2); }
  }
  .explainer-bar, .explainer-band {
    transition: width ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms, left ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms,
      opacity 200ms ease ${COUNT_DELAY_MS}ms;
  }
  .explainer-thumb { transition: transform 350ms ${OUT}; }
  .explainer-badge { transition: background-color 250ms ease; }

  .explainer[data-armed] .explainer-route { stroke-dashoffset: 1; transition: none; }
  .explainer[data-armed] .explainer-venue { opacity: 0; transform: scale(0.5); transition: none; }
  .explainer[data-armed] .explainer-bar { transition: none; }
  .explainer[data-armed] .explainer-band { opacity: 0; transition: none; }

  @media (prefers-reduced-motion: reduce) {
    .explainer * { transition: none !important; animation: none !important; }
  }
`;

export function ExplainerFigure({
  figureRef,
  armed,
  css,
  live,
  caption,
  children,
}: {
  figureRef: RefObject<HTMLElement | null>;
  armed: boolean;
  /** Rules for the explainer's own pieces, scoped under `.explainer`. */
  css: string;
  /** Read out politely after every switch. */
  live: string;
  /** Opens with <ExampleLabel />. */
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure ref={figureRef} className="explainer mt-6" data-armed={armed || undefined}>
      <style>{CSS + css}</style>
      <div className="-mx-2.5 rounded-[24px] bg-white p-2.5 shadow-[0_4px_24px_rgba(23,37,45,0.1)] ring-1 ring-[#e6eaef] sm:mx-0 sm:p-4">
        {children}
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
      </div>
      <figcaption className="mt-3 px-1 text-sm leading-relaxed text-[#666b73]">
        {caption}
      </figcaption>
    </figure>
  );
}

export function ExampleLabel() {
  return <strong className="font-semibold text-[#21252b]">Example.</strong>;
}

export interface ToggleOption<Id extends string> {
  id: Id;
  label: string;
  badge: string;
}

export function SegmentedToggle<Id extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly [ToggleOption<Id>, ToggleOption<Id>];
  selected: Id;
  onSelect: (id: Id) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="relative grid grid-cols-2 rounded-[16px] bg-[#eef1f4] p-1"
    >
      <span
        aria-hidden="true"
        className="explainer-thumb absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[12px] bg-white shadow-[0_2px_8px_rgba(23,37,45,0.12)]"
        style={{ transform: selected === options[1].id ? 'translateX(100%)' : undefined }}
      />
      {options.map((option) => {
        const pressed = option.id === selected;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(option.id)}
            className={`relative flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] px-1.5 py-1.5 text-[13px] font-semibold leading-tight sm:flex-row sm:gap-2 sm:px-2 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b73540] sm:text-sm ${
              pressed ? 'text-[#bc3942]' : 'text-[#666b73] hover:text-[#21252b]'
            }`}
          >
            <span
              aria-hidden="true"
              className={`explainer-badge flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                pressed ? 'bg-[#c83f49]' : 'bg-[#9aa1aa]'
              }`}
            >
              {option.badge}
            </span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A 360 x 225 street map. Children draw on top of the blocks. */
export function MapFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-2.5 aspect-[16/10] overflow-hidden rounded-[20px] bg-[#f7f8fa] ring-1 ring-[#e6eaef] sm:mt-3">
      <svg viewBox="0 0 360 225" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern
            id="explainer-blocks"
            width="45"
            height="45"
            x="30"
            y="20"
            patternUnits="userSpaceOnUse"
          >
            <rect x="5" y="5" width="35" height="35" rx="7" fill="#e9edf2" />
            <path d="M22.5 5v35" stroke="#f7f8fa" strokeWidth="2" />
          </pattern>
          <filter id="explainer-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="1.5"
              stdDeviation="1.5"
              floodColor="#17252d"
              floodOpacity="0.22"
            />
          </filter>
        </defs>
        <rect x="-45" y="-45" width="450" height="315" fill="url(#explainer-blocks)" />
        {children}
      </svg>
    </div>
  );
}

/** Drawn along its path when `on`, staggered by `i`. */
export function Route({ d, color, i, on }: { d: string; color: string; i: number; on: boolean }) {
  const style = { '--i': i } as CSSProperties;
  return (
    <g>
      <path
        d={d}
        className="explainer-route explainer-casing"
        pathLength={1}
        data-on={on || undefined}
        style={style}
      />
      <path
        d={d}
        className="explainer-route explainer-line"
        stroke={color}
        pathLength={1}
        data-on={on || undefined}
        style={style}
      />
    </g>
  );
}

export function Rail({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke="#c4cbd3" strokeWidth="7" strokeDasharray="1.5 4" />
      <path d={d} stroke="#8f99a4" strokeWidth="2.5" />
    </>
  );
}

export function Station({ at }: { at: Point }) {
  return <circle cx={at.x} cy={at.y} r="4.5" fill="#fff" stroke="#5f6974" strokeWidth="2" />;
}

/** A 24-unit lucide icon, centered on a 12-unit pin. */
export function PinIcon({ at, icon }: { at: Point; icon: IconNode }) {
  return (
    <g
      transform={`translate(${at.x - 6.6} ${at.y - 7.2}) scale(0.55)`}
      fill="none"
      stroke="white"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </g>
  );
}

export interface Person {
  name: string;
  color: string;
  ink: string;
  at: Point;
}

/** A friend's pin with their name on a pill to the `side`. */
export function PersonPin({
  person,
  side,
  icon = UserRound,
}: {
  person: Person;
  side: 1 | -1;
  icon?: IconNode;
}) {
  const { x, y } = person.at;
  const width = 14 + person.name.length * 8.2;
  const labelX = side === 1 ? x + 17 : x - 17 - width;
  return (
    <g filter="url(#explainer-shadow)">
      <circle cx={x} cy={y} r="12" fill={person.color} stroke="#fff" strokeWidth="2.5" />
      <PinIcon at={person.at} icon={icon} />
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
}

/** Gray until `on`, then red and a little larger. */
export function VenuePin({ at, on, children }: { at: Point; on: boolean; children: ReactNode }) {
  return (
    <g className="explainer-venue" data-on={on || undefined} filter="url(#explainer-shadow)">
      <circle
        className="explainer-venue-dot"
        cx={at.x}
        cy={at.y}
        r="12"
        stroke="#fff"
        strokeWidth="2.5"
      />
      {children}
    </g>
  );
}

/** Pulses once when mounted, so key it by the explainer's `plays`. */
export function Ring({ at }: { at: Point }) {
  return <circle className="explainer-ring" cx={at.x} cy={at.y} r="15" />;
}

export interface BarSegment {
  minutes: number;
}

export interface BarRow {
  id: string;
  name: string;
  color: string;
  ink: string;
  segments: readonly BarSegment[];
  /** The total as it counts. */
  shown: number;
}

/**
 * A bar per friend on one shared scale, under a band from the shortest trip to
 * the longest. Widths are targets: CSS tweens them, in step with the counts.
 */
export function TripBars({
  scale,
  rows,
  longest,
  spread,
}: {
  scale: number;
  rows: readonly BarRow[];
  longest: number;
  spread: number;
}) {
  const percent = (minutes: number) => `${(minutes / scale) * 100}%`;
  return (
    <div
      aria-hidden="true"
      className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-1"
    >
      <div
        className="relative -my-1.5 self-stretch"
        style={{ gridColumn: 2, gridRow: `1 / ${rows.length + 1}` }}
      >
        <div
          className="explainer-band absolute inset-y-0 border-l-[1.5px] border-dashed border-[#c83f49]/40 bg-[#c83f49]/[0.07]"
          style={{ left: percent(longest - spread), width: percent(spread) }}
        >
          <span className="absolute inset-y-0 -right-px w-0.5 rounded-full bg-[#c83f49]" />
        </div>
      </div>
      {rows.map((row, i) => {
        let start = 0;
        return (
          <Fragment key={row.id}>
            <span
              className="flex items-center gap-1.5 text-sm font-semibold text-[#21252b]"
              style={{ gridColumn: 1, gridRow: i + 1 }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
              {row.name}
            </span>
            <span
              className="relative h-2.5 rounded-full bg-[#21252b]/[0.06]"
              style={{ gridColumn: 2, gridRow: i + 1 }}
            >
              {row.segments.map((segment, j) => {
                const left = start;
                start += segment.minutes;
                return (
                  <span
                    key={j}
                    className={`explainer-bar absolute inset-y-0 ${j === 0 ? 'rounded-l-full' : ''} ${
                      j === row.segments.length - 1 ? 'rounded-r-full' : ''
                    }`}
                    style={{
                      left: percent(left),
                      width: percent(segment.minutes),
                      backgroundColor: row.color,
                    }}
                  />
                );
              })}
            </span>
            <span
              className="w-[52px] text-right text-sm font-semibold tabular-nums"
              style={{ gridColumn: 3, gridRow: i + 1, color: row.ink }}
            >
              {Math.round(row.shown)} min
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

export interface Stat {
  label: string;
  value: ReactNode;
  unit: string;
  swatch: ReactNode;
}

/** The longest trip and the spread, keyed to the band over the bars, then `extra`. */
export function StatChips({
  longest,
  spread,
  extra = [],
}: {
  longest: number;
  spread: number;
  extra?: readonly Stat[];
}) {
  const stats: readonly Stat[] = [
    {
      label: 'Longest trip',
      value: longest,
      unit: 'min',
      swatch: <span className="h-3 w-0.5 rounded-full bg-[#c83f49]" />,
    },
    {
      label: 'Spread',
      value: spread,
      unit: 'min',
      swatch: (
        <span className="h-3 w-2.5 border-l-[1.5px] border-dashed border-[#c83f49]/40 bg-[#c83f49]/15" />
      ),
    },
    ...extra,
  ];
  return (
    <div
      aria-hidden="true"
      className="mt-4 grid gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((stat) => (
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
  );
}
