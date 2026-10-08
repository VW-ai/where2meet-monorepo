'use client';

import { Fragment, type CSSProperties } from 'react';
import { BriefcaseBusiness } from 'lucide';
import { COUNT_DELAY_MS, COUNT_MS, OUT, useCountTo, useExplainer } from './explainer-motion';
import {
  ExampleLabel,
  ExplainerFigure,
  MapFrame,
  PersonPin,
  Rail,
  Ring,
  Route,
  SegmentedToggle,
  Station,
  VenuePin,
} from './explainer-ui';
import {
  DINNER,
  GUESTS,
  LINES,
  RESTAURANTS,
  STATIONS,
  arrivals,
  clock,
  describeRestaurant,
  formatClock,
  holdEndsAt,
  lastArrival,
  type Restaurant,
  type RestaurantId,
} from './table-hold-example';

/**
 * Five friends, two restaurants and the 15 minutes a restaurant holds a table.
 * Switching redraws everyone's route and runs each friend's clock from the
 * moment they leave work to the moment they arrive.
 */

const RESTAURANT_IDS = Object.keys(RESTAURANTS) as RestaurantId[];
const toOption = (id: RestaurantId) => ({
  id,
  label: RESTAURANTS[id].label,
  badge: RESTAURANTS[id].letter,
});
const OPTIONS = [toOption('nearBen'), toOption('byStation')] as const;

const LATE = '#c83f49';
const HOLD_ENDS = holdEndsAt(DINNER);
/** The timeline shows the hour after everyone leaves work. */
const WINDOW_MINUTES = 60;
const share = (time: number) => ((time - DINNER.leaveAt) / WINDOW_MINUTES) * 100;
const percent = (time: number) => `${share(time)}%`;
const TICKS = [
  DINNER.leaveAt,
  DINNER.tableAt,
  HOLD_ENDS,
  clock(0, DINNER.leaveAt + WINDOW_MINUTES),
] as const;

/** The numbers that count up together: each friend's arrival, then the last one. */
const LAST = GUESTS.length;

function counts(restaurant: Restaurant): readonly number[] {
  const times = arrivals(restaurant);
  return [...GUESTS.map(({ id }) => times[id]), lastArrival(restaurant)];
}
/** Built once, so the tween sees a stable reference per restaurant. */
const COUNTS: Record<RestaurantId, readonly number[]> = {
  nearBen: counts(RESTAURANTS.nearBen),
  byStation: counts(RESTAURANTS.byStation),
};
/** The intro starts every clock at the moment everyone leaves work. */
const ARMED = COUNTS.nearBen.map(() => DINNER.leaveAt);

const showClock = (time: number) => formatClock(clock(0, Math.round(time)));

/**
 * Each friend's bar, in their color up to the end of the hold and in red after
 * it. The intro and every switch reveal it up to their arrival.
 */
function barStyle(color: string, arrival: number): CSSProperties {
  const hold = share(HOLD_ENDS);
  return {
    backgroundImage: `linear-gradient(to right, ${color} ${hold}%, ${LATE} ${hold}%)`,
    clipPath: `inset(0 ${100 - share(arrival)}% 0 0 round 999px)`,
  };
}

const css = `
  .tbh-bar { transition: clip-path ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms; }
  .tbh-late {
    opacity: 0;
    transition: left ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms, opacity 200ms ease;
  }
  .tbh-late[data-on] {
    opacity: 1;
    transition: left ${COUNT_MS}ms ${OUT} ${COUNT_DELAY_MS}ms,
      opacity 200ms ease ${COUNT_DELAY_MS + COUNT_MS}ms;
  }
  .explainer[data-armed] .tbh-bar, .explainer[data-armed] .tbh-late { transition: none; }
`;

export function TableHold() {
  const { figureRef, selected, select, armed, plays } = useExplainer<RestaurantId>('nearBen');
  const restaurant = RESTAURANTS[selected];
  const target = armed ? ARMED : COUNTS[selected];
  const counted = useCountTo(target, !armed);
  /** Flips as the last clock passes the end of the hold, in step with the bars. */
  const givenAway = counted[LAST] > HOLD_ENDS;
  const { nearBen, byStation } = RESTAURANTS;

  return (
    <ExplainerFigure
      figureRef={figureRef}
      armed={armed}
      css={css}
      live={describeRestaurant(restaurant)}
      caption={
        <>
          <ExampleLabel /> The numbers are made up. Everyone leaves work at{' '}
          {formatClock(DINNER.leaveAt)} for a {formatClock(DINNER.tableAt)} table, and the
          restaurant holds it until {formatClock(HOLD_ENDS)}. Only the local runs to Ben&apos;s
          side, so Eli changes trains at the station and takes {nearBen.trips.eli} minutes to reach
          the restaurant near Ben. He gets there at {formatClock(arrivals(nearBen).eli)}, after the
          table is given away. At the restaurant by the station, everyone is there by{' '}
          {formatClock(lastArrival(byStation))}.
        </>
      }
    >
      <SegmentedToggle label="Restaurant" options={OPTIONS} selected={selected} onSelect={select} />

      <MapFrame>
        <rect x="260" y="25" width="80" height="80" rx="7" fill="#d6ecd4" />
        <circle cx="282" cy="48" r="5" fill="#c2e2bf" />
        <circle cx="318" cy="84" r="4" fill="#c2e2bf" />

        <Rail d={LINES.local} />
        <Rail d={LINES.main} />
        <text x="128" y="128.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#8f99a4">
          Local
        </text>
        <text x="232" y="193" textAnchor="middle" fontSize="11" fontWeight="700" fill="#8f99a4">
          Main line
        </text>

        {RESTAURANT_IDS.map((id) =>
          GUESTS.map((guest, i) => (
            <Route
              key={`${id}-${guest.id}`}
              d={RESTAURANTS[id].routes[guest.id]}
              color={guest.color}
              i={i}
              on={id === selected}
            />
          ))
        )}

        {STATIONS.map((at) => (
          <Station key={`${at.x} ${at.y}`} at={at} />
        ))}

        {RESTAURANT_IDS.map((id) => {
          const { at, letter } = RESTAURANTS[id];
          return (
            <VenuePin key={id} at={at} on={id === selected}>
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
            </VenuePin>
          );
        })}
        {plays > 0 && !armed && <Ring key={plays} at={restaurant.at} />}

        {GUESTS.map((guest) => (
          <PersonPin key={guest.id} person={guest} side={-1} icon={BriefcaseBusiness} />
        ))}
      </MapFrame>

      <div
        aria-hidden="true"
        className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-1"
      >
        <div className="relative h-4" style={{ gridColumn: 2, gridRow: 1 }}>
          <span
            className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold leading-none text-[#5f6974] sm:text-xs"
            style={{ left: percent((DINNER.tableAt + HOLD_ENDS) / 2) }}
          >
            Table held
          </span>
        </div>
        <div
          className="relative -my-1.5 self-stretch"
          style={{ gridColumn: 2, gridRow: `2 / ${GUESTS.length + 2}` }}
        >
          <div
            className="absolute inset-y-0 bg-[#5f6974]/[0.09]"
            style={{
              left: percent(DINNER.tableAt),
              width: `${share(HOLD_ENDS) - share(DINNER.tableAt)}%`,
            }}
          >
            <span className="absolute inset-y-0 -left-px w-0.5 rounded-full bg-[#21252b]" />
            <span
              className="absolute inset-y-0 -right-px w-0.5 rounded-full transition-colors duration-200"
              style={{ backgroundColor: givenAway ? LATE : '#9aa1aa' }}
            />
          </div>
        </div>

        {GUESTS.map((guest, i) => {
          const late = counted[i] > HOLD_ENDS;
          return (
            <Fragment key={guest.id}>
              <span
                className="flex items-center gap-1.5 text-sm font-semibold text-[#21252b]"
                style={{ gridColumn: 1, gridRow: i + 2 }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: guest.color }}
                />
                {guest.name}
              </span>
              <span
                className="relative h-2.5 rounded-full bg-[#21252b]/[0.06]"
                style={{ gridColumn: 2, gridRow: i + 2 }}
              >
                <span
                  className="tbh-bar absolute inset-0 rounded-full"
                  style={barStyle(guest.color, target[i])}
                />
                <span
                  className="tbh-late absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                  data-on={target[i] > HOLD_ENDS || undefined}
                  style={{ left: percent(target[i]), backgroundColor: LATE }}
                />
              </span>
              <span
                className="w-10 text-right text-sm font-semibold tabular-nums transition-colors duration-200"
                style={{ gridColumn: 3, gridRow: i + 2, color: late ? LATE : '#21252b' }}
              >
                {showClock(counted[i])}
              </span>
            </Fragment>
          );
        })}

        <div className="relative h-4" style={{ gridColumn: 2, gridRow: GUESTS.length + 2 }}>
          {TICKS.map((time, i) => (
            <span
              key={time}
              className={`absolute top-0 whitespace-nowrap text-[11px] font-semibold leading-none tabular-nums sm:text-xs ${
                i === 0 ? '' : i === TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
              }`}
              style={{
                left: percent(time),
                color: time === HOLD_ENDS && givenAway ? LATE : '#666b73',
              }}
            >
              {formatClock(time)}
            </span>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="mt-4 grid grid-cols-2 gap-1.5 sm:gap-2">
        {[
          {
            label: 'Last one there',
            value: showClock(counted[LAST]),
            swatch: <span className="h-2 w-3 rounded-full bg-[#9aa1aa]" />,
          },
          {
            label: `Table at ${formatClock(DINNER.tableAt)}`,
            value: givenAway ? 'Given away' : 'Held',
            swatch: (
              <span className="relative h-3 w-2.5 bg-[#5f6974]/15">
                <span className="absolute inset-y-0 left-0 w-0.5 bg-[#21252b]" />
              </span>
            ),
          },
        ].map((chip) => (
          <div
            key={chip.label}
            className="flex flex-col justify-between gap-1 rounded-2xl bg-[#f7f8fa] px-2.5 py-2.5 sm:px-3"
          >
            <div className="flex items-start gap-1.5 text-[11px] font-semibold leading-tight text-[#666b73] sm:text-xs">
              <span className="mt-px flex h-3 shrink-0 items-center">{chip.swatch}</span>
              {chip.label}
            </div>
            <div
              className="text-lg font-bold leading-tight tabular-nums transition-colors duration-200 sm:text-xl"
              style={{ color: givenAway ? LATE : '#21252b' }}
            >
              {chip.value}
            </div>
          </div>
        ))}
      </div>
    </ExplainerFigure>
  );
}
