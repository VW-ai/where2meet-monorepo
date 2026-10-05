'use client';

import { Bike, CarFront, TrainFront, Utensils, type IconNode } from 'lucide';
import { COUNT_DELAY_MS, COUNT_MS, OUT, useCountTo, useExplainer } from './explainer-motion';
import {
  ExampleLabel,
  ExplainerFigure,
  Icon,
  MapFrame,
  PersonPin,
  PinIcon,
  Rail,
  Ring,
  Route,
  SegmentedToggle,
  StatChips,
  Station,
  TripBars,
  VenuePin,
  waitingFill,
} from './explainer-ui';
import {
  DAYS,
  FRIENDS,
  LEGS,
  describeDay,
  summarizeDay,
  type DayId,
  type FriendId,
} from './weekend-travel-example';

/**
 * One food hall, three friends, a Tuesday and a Sunday. Switching days spreads
 * out the train's departures, fills the parking and tweens each trip's parts.
 */

const toOption = (id: DayId) => ({ id, label: DAYS[id].label, badge: DAYS[id].label.slice(0, 2) });
const OPTIONS = [toOption('tuesday'), toOption('sunday')] as const;
/** One scale for both days, so the bars compare across the switch. */
const SCALE_MINUTES = 40;
const LABEL_SIDE: Record<FriendId, 1 | -1> = { ana: -1, ben: 1, cy: -1 };
const MODE_ICON: Record<(typeof FRIENDS)[number]['mode'], IconNode> = {
  train: TrainFront,
  car: CarFront,
  bike: Bike,
};

const FOOD_HALL = { x: 300, y: 110 };
const PARKING = { x: 255, y: 65 };
const RAIL_Y = 132.5;
/** Ana's stop, the two the express skips, and the food hall's stop. */
const STOPS = [75, 150, 225, 300];

/** The timetable strip: an hour of departures from Ana's stop. */
const WINDOW_MINUTES = 60;
const TRACK = { x: 27, y: 186, width: 126 };
const MINUTE_WIDTH = TRACK.width / WINDOW_MINUTES;
const DEPARTURES =
  Math.floor(WINDOW_MINUTES / Math.min(...Object.values(DAYS).map((d) => d.trainEvery))) + 1;
const [ANA] = FRIENDS;

/** The numbers that count up together: each friend's minutes, then these. */
const LONGEST = FRIENDS.length;
const SPREAD = FRIENDS.length + 1;
const TRAIN_EVERY = FRIENDS.length + 2;

function counts(id: DayId): readonly number[] {
  const { minutes, longest, spread } = summarizeDay(DAYS[id]);
  return [...minutes, longest, spread, DAYS[id].trainEvery];
}
/** Built once, so the tween sees a stable reference per day. */
const COUNTS: Record<DayId, readonly number[]> = {
  tuesday: counts('tuesday'),
  sunday: counts('sunday'),
};
/** The intro grows the trips from zero, but the timetable keeps its label. */
const ARMED = COUNTS.tuesday.map((n, i) => (i === TRAIN_EVERY ? n : 0));

const css = `
  .wkt-departure {
    transition: transform ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms, opacity 200ms ease ${COUNT_DELAY_MS}ms;
  }
  .wkt-stop {
    transform-box: fill-box; transform-origin: center; opacity: 0.45; transform: scale(0.6);
    transition: transform 250ms ease, opacity 250ms ease;
  }
  .wkt-stop[data-on] {
    opacity: 1; transform: none;
    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${COUNT_DELAY_MS}ms, opacity 200ms ease ${COUNT_DELAY_MS}ms;
  }
  .wkt-full {
    transform-box: fill-box; transform-origin: center bottom; opacity: 0; transform: scale(0.5);
    transition: transform 250ms ease, opacity 250ms ease;
  }
  .wkt-full[data-on] {
    opacity: 1; transform: none;
    transition: transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${COUNT_DELAY_MS}ms, opacity 200ms ease ${COUNT_DELAY_MS}ms;
  }
  .explainer[data-armed] .wkt-departure { transition: none; }
`;

export function WeekendTravel() {
  const { figureRef, selected, select, armed, plays } = useExplainer<DayId>('tuesday');
  const day = DAYS[selected];
  const target = armed ? ARMED : COUNTS[selected];
  const counted = useCountTo(target, !armed);

  return (
    <ExplainerFigure
      figureRef={figureRef}
      armed={armed}
      css={css}
      live={describeDay(day)}
      caption={
        <>
          <ExampleLabel /> On Sunday the train comes every {DAYS.sunday.trainEvery} minutes instead
          of every {DAYS.tuesday.trainEvery} and the lots near the food hall fill up, so Ana&apos;s
          and Ben&apos;s trips grow while Cy&apos;s doesn&apos;t.
        </>
      }
    >
      <SegmentedToggle label="Day" options={OPTIONS} selected={selected} onSelect={select} />

      <MapFrame>
        <rect x="215" y="160" width="35" height="35" rx="7" fill="#d6ecd4" />
        <circle cx="238" cy="172" r="4" fill="#c2e2bf" />

        <Rail d={`M-10 ${RAIL_Y}H370`} />

        {FRIENDS.map((friend, i) => (
          <Route key={friend.id} d={friend.route} color={friend.color} i={i} on />
        ))}

        {STOPS.map((x, i) => {
          const skippable = i > 0 && i < STOPS.length - 1;
          return (
            <g
              key={x}
              className={skippable ? 'wkt-stop' : undefined}
              data-on={(skippable && day.allStops) || undefined}
            >
              <Station at={{ x, y: RAIL_Y }} />
            </g>
          );
        })}

        <g filter="url(#explainer-shadow)">
          <rect
            x={PARKING.x - 7.5}
            y={PARKING.y - 7.5}
            width="15"
            height="15"
            rx="4"
            fill="#5f6974"
          />
          <text
            x={PARKING.x}
            y={PARKING.y + 4}
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill="#fff"
          >
            P
          </text>
          <g className="wkt-full" data-on={day.parkingFull || undefined}>
            <rect
              x={PARKING.x - 17}
              y={PARKING.y - 29}
              width="34"
              height="16"
              rx="8"
              fill="#c83f49"
            />
            <text
              x={PARKING.x}
              y={PARKING.y - 17.5}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="700"
              fill="#fff"
            >
              Full
            </text>
          </g>
        </g>

        <VenuePin at={FOOD_HALL} on>
          <PinIcon at={FOOD_HALL} icon={Utensils} />
        </VenuePin>
        {plays > 0 && !armed && <Ring key={plays} at={FOOD_HALL} />}

        {FRIENDS.map((friend) => (
          <PersonPin
            key={friend.id}
            person={friend}
            side={LABEL_SIDE[friend.id]}
            icon={MODE_ICON[friend.mode]}
          />
        ))}

        <g filter="url(#explainer-shadow)">
          <rect x="14" y="150" width="152" height="52" rx="13" fill="#fff" />
        </g>
        <Icon
          icon={TrainFront}
          at={{ x: 23, y: 158.5 }}
          scale={0.5}
          color={ANA.ink}
          strokeWidth={2.4}
        />
        <text x="40" y="169.5" fontSize="11.5" fontWeight="700" fill="#21252b">
          Trains every <tspan fill={ANA.ink}>{Math.round(counted[TRAIN_EVERY])} min</tspan>
        </text>
        <line
          x1={TRACK.x}
          y1={TRACK.y}
          x2={TRACK.x + TRACK.width}
          y2={TRACK.y}
          stroke="#e1e5ea"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <clipPath id="wkt-track">
          <rect x={TRACK.x - 5} y={TRACK.y - 6} width={TRACK.width + 10} height="12" />
        </clipPath>
        <g clipPath="url(#wkt-track)">
          {Array.from({ length: DEPARTURES }, (_, i) => {
            const minute = i * target[TRAIN_EVERY];
            return (
              <circle
                key={i}
                className="wkt-departure"
                cx={TRACK.x}
                cy={TRACK.y}
                r="3.75"
                fill={ANA.color}
                stroke="#fff"
                strokeWidth="1.5"
                style={{
                  transform: `translateX(${armed ? 0 : minute * MINUTE_WIDTH}px)`,
                  opacity: !armed && minute <= WINDOW_MINUTES ? 1 : 0,
                }}
              />
            );
          })}
        </g>
      </MapFrame>

      <TripBars
        scale={SCALE_MINUTES}
        rows={FRIENDS.map((friend, i) => ({
          ...friend,
          segments: day.trips[friend.id].map(({ kind, minutes }) => ({
            minutes: armed ? 0 : minutes,
            waiting: LEGS[kind].waiting,
          })),
          shown: counted[i],
        }))}
      />

      <div
        aria-hidden="true"
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs font-semibold text-[#666b73]"
      >
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full bg-[#9aa1aa]" />
          Moving
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-full" style={waitingFill('#9aa1aa')} />
          Waiting for the train or parking
        </span>
      </div>

      <StatChips longest={Math.round(counted[LONGEST])} spread={Math.round(counted[SPREAD])} />
    </ExplainerFigure>
  );
}
