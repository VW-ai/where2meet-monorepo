import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

/**
 * Looping "how it works" scene for the landing page.
 *
 * Everything animates with opacity/transform/stroke-dashoffset only, so the card
 * never changes size mid-loop. Base styles are the final frame (the group picks
 * Coffee); keyframes start from hidden. With reduced motion the animations are
 * dropped and that final frame is what shows.
 */

const LOOP_S = 15;
/** Loop % where everything fades out before restarting. */
const END = 93;
/** Loop % where each caption step begins. */
const STEPS = [0, 20, 36, 52, 68] as const;

const captions = [
  'Everyone adds where they’re starting',
  'We find the middle',
  'Nearby spots show up',
  'Travel times are compared',
  'Coffee is fair for everyone',
];

const people = [
  { id: 'a', color: '#FF6B6B', ink: '#d9474a', cx: 48, cy: 44, time: '18 min', chip: [48, 17] },
  { id: 'b', color: '#4D96FF', ink: '#2f6fd6', cx: 352, cy: 44, time: '20 min', chip: [352, 17] },
  { id: 'c', color: '#6BCB77', ink: '#3a9447', cx: 200, cy: 214, time: '19 min', chip: [242, 214] },
] as const;

// Street routes from each person to Coffee at the middle (200, 120).
const routes = ['M48 44 H124 V120 H200', 'M352 44 H276 V120 H200', 'M200 214 V120'];

const spots: {
  name: string;
  color: string;
  iconColor: string;
  times: [string, string, string];
  cx: number;
  cy: number;
  mark: () => ReactNode;
}[] = [
  {
    name: 'Coffee',
    color: '#FFD93D',
    iconColor: '#3f3420',
    times: ['18m', '20m', '19m'],
    cx: 200,
    cy: 120,
    mark: () => (
      <>
        <path d="M10 2v2" />
        <path d="M14 2v2" />
        <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
        <path d="M6 2v2" />
      </>
    ),
  },
  {
    name: 'Ramen',
    color: '#FB923C',
    iconColor: '#ffffff',
    times: ['14m', '27m', '22m'],
    cx: 146,
    cy: 76,
    mark: () => (
      <>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </>
    ),
  },
  {
    name: 'Park',
    color: '#B695C0',
    iconColor: '#ffffff',
    times: ['25m', '12m', '24m'],
    cx: 238,
    cy: 158,
    mark: () => (
      <>
        <path d="M12 2.5 17.2 10h-2.4L19.5 17H4.5l4.7-7H6.8Z" fill="currentColor" stroke="none" />
        <path d="M10.4 17h3.2V21.5h-3.2Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
];

const FADE = 4;
const PICK = STEPS[4] + 1;

const POP_HIDDEN = 'opacity: 0; transform: scale(0.5);';
const POP_SHOWN = 'opacity: 1; transform: scale(1);';
const RISE_HIDDEN = 'opacity: 0; transform: translateY(4px);';
const RISE_SHOWN = 'opacity: 1; transform: translateY(0);';

/** `.cls` runs keyframes of the same name for the whole loop. */
function anim(cls: string, frames: string, timing = 'ease') {
  return `.${cls} { animation: ${cls} ${LOOP_S}s ${timing} infinite; }
  @keyframes ${cls} { ${frames} }`;
}
/** Hidden → shown from `start`% until `end`%, then hidden again. */
function show(start: number, end: number, hidden: string, shown: string) {
  return `0%, ${start}% { ${hidden} }
    ${start + FADE}%, ${end}% { ${shown} }
    ${Math.min(end + FADE, 100)}%, 100% { ${hidden} }`;
}
/** Like `show`, but settles into `after` once Coffee is picked. */
function showThenPick(start: number, hidden: string, shown: string, after: string) {
  return `0%, ${start}% { ${hidden} }
    ${start + FADE}%, ${PICK}% { ${shown} }
    ${PICK + FADE}%, ${END}% { ${after} }
    ${END + FADE}%, 100% { ${hidden} }`;
}

const css = [
  // Base styles are the final frame.
  `.story .s-pop { transform-box: fill-box; transform-origin: center; }
  .s-pulse, .s-pick-ring { opacity: 0; }
  .s-radius { fill: rgba(200, 63, 73, 0.07); stroke: rgba(200, 63, 73, 0.4); stroke-width: 1.5; stroke-dasharray: 4 4; }
  .s-pulse, .s-pick-ring { fill: none; stroke: #c83f49; stroke-width: 2; }
  .s-casing, .s-line { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 0; }
  .s-casing { stroke: #fff; stroke-width: 9; }
  .s-line { stroke-width: 4.5; }
  .s-venue-1 { transform: scale(1.18); }
  .s-venue-2, .s-venue-3 { opacity: 0.4; }
  .s-skeleton { opacity: 0; }
  .s-row-2, .s-row-3 { opacity: 0.45; }
  .s-fair { background: #fff0ef; box-shadow: inset 0 0 0 1.5px rgba(200, 63, 73, 0.35); }
  .s-cap { opacity: 0; }
  .s-cap-5 { opacity: 1; }
  .s-seg { transform-origin: left; }`,

  ...people.flatMap((_, i) => [
    anim(`s-person-${i + 1}`, show(3 + i * 3, END, POP_HIDDEN, POP_SHOWN)),
    anim(`s-chip-${i + 1}`, show(61 + i, END, RISE_HIDDEN, RISE_SHOWN)),
    anim(
      `s-route-${i + 1}`,
      `0%, ${53 + i * 2}% { stroke-dashoffset: 1; opacity: 0; }
    ${54 + i * 2}% { opacity: 1; }
    ${60 + i * 2}%, ${END}% { stroke-dashoffset: 0; opacity: 1; }
    ${END + FADE}%, 100% { stroke-dashoffset: 0; opacity: 0; }`
    ),
  ]),

  anim('s-radius', show(21, END, 'opacity: 0; transform: scale(0.3);', POP_SHOWN)),
  anim('s-middle', show(22, END, POP_HIDDEN, POP_SHOWN)),
  anim(
    's-pulse',
    `0%, 24% { opacity: 0; transform: scale(0.4); }
    26% { opacity: 0.7; }
    34%, 100% { opacity: 0; transform: scale(1.5); }`
  ),

  anim('s-venue-1', showThenPick(37, POP_HIDDEN, POP_SHOWN, 'opacity: 1; transform: scale(1.18);')),
  anim('s-venue-2', showThenPick(40, POP_HIDDEN, POP_SHOWN, 'opacity: 0.4; transform: scale(1);')),
  anim('s-venue-3', showThenPick(43, POP_HIDDEN, POP_SHOWN, 'opacity: 0.4; transform: scale(1);')),
  anim(
    's-pick-ring',
    `0%, ${PICK}% { opacity: 0; transform: scale(0.7); }
    ${PICK + 2}% { opacity: 0.8; }
    ${PICK + 12}%, 100% { opacity: 0; transform: scale(2); }`
  ),
  anim('s-flag', show(PICK + 2, END, RISE_HIDDEN, RISE_SHOWN)),

  ...spots.flatMap((_, i) => [
    anim(
      `s-skeleton-${i + 1}`,
      `0%, ${38 + i * 3}% { opacity: 1; }
    ${42 + i * 3}%, ${END}% { opacity: 0; }
    ${END + FADE}%, 100% { opacity: 1; }`
    ),
    anim(
      `s-row-${i + 1}`,
      i === 0
        ? show(38, END, RISE_HIDDEN, RISE_SHOWN)
        : showThenPick(
            38 + i * 3,
            RISE_HIDDEN,
            RISE_SHOWN,
            'opacity: 0.45; transform: translateY(0);'
          )
    ),
  ]),
  anim(
    's-fair',
    show(
      PICK,
      END,
      'background: transparent; box-shadow: inset 0 0 0 1.5px transparent;',
      'background: #fff0ef; box-shadow: inset 0 0 0 1.5px rgba(200, 63, 73, 0.35);'
    )
  ),
  anim('s-badge', show(PICK + 1, END, POP_HIDDEN, POP_SHOWN)),

  ...captions.flatMap((_, i) => {
    const start = STEPS[i];
    const end = i < STEPS.length - 1 ? STEPS[i + 1] : END;
    return [
      anim(
        `s-cap-${i + 1}`,
        i === 0
          ? // Already showing when the loop starts; fades back in as the last step fades out.
            `0%, ${end}% { ${RISE_SHOWN} }
    ${end + FADE}%, ${END}% { ${RISE_HIDDEN} }
    100% { ${RISE_SHOWN} }`
          : show(start, end, RISE_HIDDEN, RISE_SHOWN)
      ),
      anim(
        `s-seg-${i + 1}`,
        `0%, ${start}% { transform: scaleX(0); }
    ${end}%, ${END}% { transform: scaleX(1); }
    ${END + FADE}%, 100% { transform: scaleX(0); }`,
        'linear'
      ),
    ];
  }),

  `@media (prefers-reduced-motion: reduce) {
    .story * { animation: none !important; }
  }`,
].join('\n');

export function StoryPreview() {
  return (
    <div
      className="story flex flex-col overflow-hidden rounded-[28px] bg-white p-3 shadow-[0_4px_24px_rgba(23,37,45,0.1)] sm:p-4 lg:h-full"
      role="img"
      aria-label="Three friends add where they're starting. Where2Meet finds the middle, shows Coffee, Ramen and Park nearby, and compares everyone's travel time. Coffee wins: 18, 20 and 19 minutes, fair for everyone."
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[20px] bg-[#f7f8fa] ring-1 ring-[#e6eaef] lg:aspect-auto lg:min-h-[240px] lg:flex-1">
        <svg
          viewBox="20 0 360 240"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="story-blocks"
              width="76"
              height="76"
              x="48"
              y="44"
              patternUnits="userSpaceOnUse"
            >
              <rect x="6" y="6" width="64" height="64" rx="8" fill="#e9edf2" />
              <path d="M38 6v64" stroke="#f7f8fa" strokeWidth="3" />
            </pattern>
            <filter id="story-shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow
                dx="0"
                dy="1.5"
                stdDeviation="1.5"
                floodColor="#17252d"
                floodOpacity="0.22"
              />
            </filter>
          </defs>

          {/* Map: blocks extend past the viewBox so taller/wider cards still read as a map. */}
          <rect x="-400" y="-300" width="1200" height="840" fill="url(#story-blocks)" />
          <rect x="206" y="126" width="64" height="64" rx="8" fill="#d6ecd4" />
          <circle cx="222" cy="176" r="5" fill="#c2e2bf" />
          <circle cx="258" cy="136" r="4" fill="#c2e2bf" />
          <rect x="282" y="-26" width="64" height="64" rx="8" fill="#d6ecd4" />
          <ellipse cx="34" cy="244" rx="78" ry="46" fill="#d7e7f8" />
          <ellipse cx="392" cy="232" rx="60" ry="30" fill="#d7e7f8" />

          <circle className="s-radius s-pop" cx="200" cy="120" r="74" />
          <circle className="s-pulse s-pop" cx="200" cy="120" r="74" />

          {routes.map((d, i) => (
            <g key={d}>
              <path d={d} className={`s-casing s-route-${i + 1}`} pathLength={1} />
              <path
                d={d}
                className={`s-line s-route-${i + 1}`}
                stroke={people[i].color}
                pathLength={1}
              />
            </g>
          ))}

          <circle
            className="s-middle s-pop"
            cx="200"
            cy="120"
            r="5"
            fill="#c83f49"
            stroke="#fff"
            strokeWidth="2.5"
          />

          {spots.map((spot, i) => (
            <g key={spot.name} className={`s-venue-${i + 1} s-pop`} filter="url(#story-shadow)">
              <circle
                cx={spot.cx}
                cy={spot.cy}
                r="13"
                fill={spot.color}
                stroke="#fff"
                strokeWidth="2.5"
              />
              <g
                transform={`translate(${spot.cx - 7.2} ${spot.cy - 7.2}) scale(0.6)`}
                fill="none"
                stroke={spot.iconColor}
                color={spot.iconColor}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {spot.mark()}
              </g>
            </g>
          ))}
          <circle className="s-pick-ring s-pop" cx="200" cy="120" r="16" />

          <g className="s-flag" filter="url(#story-shadow)">
            <rect x="164" y="76" width="72" height="22" rx="11" fill="#fff" />
            <text x="200" y="91" textAnchor="middle" fontSize="11" fontWeight="700" fill="#c83f49">
              Meet here
            </text>
          </g>

          {people.map((person, i) => (
            <g key={person.id}>
              <g className={`s-person-${i + 1} s-pop`} filter="url(#story-shadow)">
                <circle
                  cx={person.cx}
                  cy={person.cy}
                  r="13"
                  fill={person.color}
                  stroke="#fff"
                  strokeWidth="3"
                />
                <g
                  transform={`translate(${person.cx - 7.2} ${person.cy - 7.8}) scale(0.6)`}
                  fill="none"
                  stroke="white"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="8" r="5" />
                  <path d="M20 21a8 8 0 0 0-16 0" />
                </g>
              </g>
              <g className={`s-chip-${i + 1}`} filter="url(#story-shadow)">
                <rect
                  x={person.chip[0] - 24}
                  y={person.chip[1] - 10}
                  width="48"
                  height="20"
                  rx="10"
                  fill="#fff"
                />
                <text
                  x={person.chip[0]}
                  y={person.chip[1] + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill={person.ink}
                >
                  {person.time}
                </text>
              </g>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 flex items-center gap-3 px-1" aria-hidden="true">
        <div className="flex shrink-0 gap-1">
          {captions.map((caption, i) => (
            <span key={caption} className="h-1 w-4 overflow-hidden rounded-full bg-[#e6eaef]">
              <span className={`s-seg s-seg-${i + 1} block h-full rounded-full bg-[#c83f49]`} />
            </span>
          ))}
        </div>
        <div className="grid min-w-0 flex-1">
          {captions.map((caption, i) => (
            <span
              key={caption}
              className={`s-cap s-cap-${i + 1} col-start-1 row-start-1 truncate text-sm font-semibold text-[#21252b]`}
            >
              {caption}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-1" aria-hidden="true">
        {spots.map((spot, i) => (
          <div
            key={spot.name}
            className={`relative h-10 rounded-2xl px-3 lg:h-11 ${i === 0 ? 's-fair' : ''}`}
          >
            <div
              className={`s-skeleton s-skeleton-${i + 1} absolute inset-x-3 inset-y-0 flex items-center gap-2`}
            >
              <span className="h-5 w-5 rounded-full bg-[#eef1f4]" />
              <span className="h-2.5 w-16 rounded-full bg-[#eef1f4]" />
              <span className="ml-auto h-2.5 w-20 rounded-full bg-[#eef1f4]" />
            </div>
            <div
              className={`s-row-${i + 1} absolute inset-x-3 inset-y-0 flex items-center justify-between gap-3`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: spot.color }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke={spot.iconColor}
                    color={spot.iconColor}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {spot.mark()}
                  </svg>
                </span>
                <span className="truncate text-sm font-semibold">{spot.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums">
                {spot.times.map((time, t) => (
                  <span key={people[t].id} style={{ color: people[t].ink }}>
                    {time}
                  </span>
                ))}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    i === 0 ? 's-badge bg-[#c83f49] text-white' : 'invisible'
                  }`}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{css}</style>
    </div>
  );
}
