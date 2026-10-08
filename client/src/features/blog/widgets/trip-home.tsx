'use client';

import { TrainFront, Wine } from 'lucide';
import { COUNT_DELAY_MS, COUNT_MS, OUT, useCountTo, useExplainer } from './explainer-motion';
import type { Point } from './explainer-model';
import {
  ExampleLabel,
  ExplainerFigure,
  Icon,
  MapFrame,
  PersonPin,
  PinIcon,
  Rail,
  Route,
  SegmentedToggle,
  Station,
  TripBars,
  VenuePin,
  waitingFill,
} from './explainer-ui';
import {
  COUPLE,
  HOURS,
  LINES,
  SPOTS,
  STATIONS,
  describeHour,
  hourTitle,
  legMinutes,
  summarizeSpot,
  tripMinutes,
  type Hour,
  type HourId,
  type LineId,
  type PersonId,
  type SpotId,
} from './trip-home-example';

/**
 * Two bars, Ana and Ben, getting there at 7 p.m. and getting home at 11 p.m.
 * Switching hours spreads out each line's departures and tweens every wait.
 */

const INITIAL: HourId = 'evening';
/** Keeps a time such as "7 p.m." on one line when the text wraps on a phone. */
const nowrap = (text: string) => text.replaceAll(' ', '\u00a0');
const toOption = (id: HourId) => {
  const hour = HOURS[id];
  const time = `at ${hour.label}`;
  return {
    id,
    label: hourTitle(hour).replace(time, nowrap(time)),
    badge: hour.label.split(' ')[0],
  };
};
const OPTIONS = [toOption('evening'), toOption('late')] as const;
const SPOT_IDS = Object.keys(SPOTS) as SpotId[];
const LINE_IDS = Object.keys(LINES) as LineId[];
/** One scale for both hours, so the bars compare across the switch. */
const SCALE_MINUTES = 60;
const LABEL_SIDE: Record<PersonId, 1 | -1> = { ana: 1, ben: -1 };

/** Each line's timetable card shows an hour of departures. */
const WINDOW_MINUTES = 60;
const CARD = { width: 172, height: 46 };
const TRACK = { dx: 14, dy: 34, width: CARD.width - 28 };
const CARD_AT: Record<LineId, Point> = { local: { x: 10, y: 10 }, main: { x: 10, y: 169 } };

/** Enough dots to fill the hour when the line runs most often. */
function departures(line: LineId) {
  return (
    Math.floor(WINDOW_MINUTES / Math.min(...Object.values(HOURS).map((h) => h.every[line]))) + 1
  );
}

/** The numbers that count up together: each trip, bar by bar, then each line's gap. */
const TRIPS = SPOT_IDS.length * COUPLE.length;

function counts(hour: Hour): readonly number[] {
  return [
    ...SPOT_IDS.flatMap((id) => summarizeSpot(SPOTS[id], hour).minutes),
    ...LINE_IDS.map((id) => hour.every[id]),
  ];
}
/** Built once, so the tween sees a stable reference per hour. */
const COUNTS: Record<HourId, readonly number[]> = {
  evening: counts(HOURS.evening),
  late: counts(HOURS.late),
};
/** The intro grows the trips from zero, but the timetables keep their labels. */
const ARMED = COUNTS[INITIAL].map((n, i) => (i < TRIPS ? 0 : n));

const css = `
  .trh-departure {
    transition: transform ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms, opacity 200ms ease ${COUNT_DELAY_MS}ms;
  }
  .trh-night { opacity: 0; transition: opacity 600ms ease; }
  .trh-night[data-on] { opacity: 1; }
  .explainer[data-armed] .trh-departure { transition: none; }
`;

export function TripHome() {
  const { figureRef, selected, select, armed } = useExplainer(INITIAL);
  const hour = HOURS[selected];
  const target = armed ? ARMED : COUNTS[selected];
  const counted = useCountTo(target, !armed);

  return (
    <ExplainerFigure
      figureRef={figureRef}
      armed={armed}
      css={css}
      live={describeHour(hour)}
      caption={
        <>
          <ExampleLabel /> The numbers are made up. At {nowrap(HOURS.late.label)} the local line
          comes every {HOURS.late.every.local} minutes instead of every {HOURS.evening.every.local},
          so Ana&apos;s trip home from the bar near Ben takes{' '}
          {tripMinutes(SPOTS.nearBen.trips.ana, HOURS.late)} minutes. The main line comes every{' '}
          {HOURS.late.every.main}, so both of them get home from the bar by the station in{' '}
          {summarizeSpot(SPOTS.byStation, HOURS.late).longest}.
        </>
      }
    >
      <SegmentedToggle label="Trip" options={OPTIONS} selected={selected} onSelect={select} />

      <MapFrame>
        <rect
          className="trh-night"
          data-on={selected === 'late' || undefined}
          x="-45"
          y="-45"
          width="450"
          height="315"
          fill="#1d2b4f"
          fillOpacity="0.14"
        />

        {LINE_IDS.map((id) => (
          <Rail key={id} d={LINES[id].rail} />
        ))}

        {SPOT_IDS.map((spotId, s) =>
          COUPLE.map((person, p) => (
            <Route
              key={`${spotId}-${person.id}`}
              d={SPOTS[spotId].routes[person.id]}
              color={person.color}
              i={s * COUPLE.length + p}
              on
            />
          ))
        )}

        {STATIONS.map((at) => (
          <Station key={`${at.x} ${at.y}`} at={at} />
        ))}

        {SPOT_IDS.map((id) => {
          const { at } = SPOTS[id];
          return (
            <VenuePin key={id} at={at} on>
              <PinIcon at={at} icon={Wine} />
            </VenuePin>
          );
        })}

        {COUPLE.map((person) => (
          <PersonPin key={person.id} person={person} side={LABEL_SIDE[person.id]} />
        ))}

        {LINE_IDS.map((id, l) => {
          const at = CARD_AT[id];
          const track = { x: at.x + TRACK.dx, y: at.y + TRACK.dy };
          return (
            <g key={id}>
              <g filter="url(#explainer-shadow)">
                <rect
                  x={at.x}
                  y={at.y}
                  width={CARD.width}
                  height={CARD.height}
                  rx="13"
                  fill="#fff"
                />
              </g>
              <Icon
                icon={TrainFront}
                at={{ x: at.x + 9, y: at.y + 8.5 }}
                scale={0.5}
                color="#5f6974"
                strokeWidth={2.4}
              />
              <text x={at.x + 26} y={at.y + 19.5} fontSize="11.5" fontWeight="700" fill="#21252b">
                {LINES[id].label} every{' '}
                <tspan fill="#c83f49">{Math.round(counted[TRIPS + l])} min</tspan>
              </text>
              <line
                x1={track.x}
                y1={track.y}
                x2={track.x + TRACK.width}
                y2={track.y}
                stroke="#e1e5ea"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <clipPath id={`trh-track-${id}`}>
                <rect x={track.x - 5} y={track.y - 6} width={TRACK.width + 10} height="12" />
              </clipPath>
              <g clipPath={`url(#trh-track-${id})`}>
                {Array.from({ length: departures(id) }, (_, i) => {
                  const minute = i * target[TRIPS + l];
                  return (
                    <circle
                      key={i}
                      className="trh-departure"
                      cx={track.x}
                      cy={track.y}
                      r="3.75"
                      fill="#5f6974"
                      stroke="#fff"
                      strokeWidth="1.5"
                      style={{
                        transform: `translateX(${armed ? 0 : (minute * TRACK.width) / WINDOW_MINUTES}px)`,
                        opacity: !armed && minute <= WINDOW_MINUTES ? 1 : 0,
                      }}
                    />
                  );
                })}
              </g>
            </g>
          );
        })}
      </MapFrame>

      {SPOT_IDS.map((spotId, s) => (
        <div key={spotId} aria-hidden="true" className="mt-4">
          <div className="flex items-center gap-2 px-1 text-sm font-semibold text-[#21252b]">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
              <circle cx="12" cy="12" r="12" fill="#c83f49" />
              <PinIcon at={{ x: 12, y: 12 }} icon={Wine} />
            </svg>
            {SPOTS[spotId].label}
          </div>
          <TripBars
            scale={SCALE_MINUTES}
            rows={COUPLE.map((person, p) => ({
              ...person,
              segments: SPOTS[spotId].trips[person.id].map((leg) => ({
                minutes: armed ? 0 : legMinutes(leg, hour),
                waiting: leg.kind === 'wait',
              })),
              shown: counted[s * COUPLE.length + p],
            }))}
          />
        </div>
      ))}

      <div
        aria-hidden="true"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs font-semibold text-[#666b73]"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-[#9aa1aa]" />
          Walking or riding
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full" style={waitingFill('#9aa1aa')} />
          Waiting for the train
        </span>
      </div>
    </ExplainerFigure>
  );
}
