'use client';

import { useCountTo, useExplainer } from './explainer-motion';
import {
  ExampleLabel,
  ExplainerFigure,
  MapFrame,
  PersonPin,
  Rail,
  Ring,
  Route,
  SegmentedToggle,
  StatChips,
  Station,
  TripBars,
  VenuePin,
} from './explainer-ui';
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
 * numbers.
 */

const VENUE_IDS = Object.keys(VENUES) as VenueId[];
const toOption = (id: VenueId) => ({ id, label: VENUES[id].label, badge: VENUES[id].letter });
const OPTIONS = [toOption('closest'), toOption('easiest')] as const;
/** One scale for both venues, so the bars compare across the switch. */
const SCALE_MINUTES = 60;
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

const css = `
  .ttd-crow { opacity: 0; transition: opacity 200ms ease; }
  .ttd-crow[data-on] { opacity: 1; transition: opacity 400ms ease 300ms; }
  .explainer[data-armed] .ttd-crow { opacity: 0; transition: none; }
`;

export function TravelTimeVsDistance() {
  const { figureRef, selected, select, armed, plays } = useExplainer<VenueId>('closest');
  const venue = VENUES[selected];
  const target = armed ? ZEROS : COUNTS[selected];
  const counted = useCountTo(target, !armed);

  return (
    <ExplainerFigure
      figureRef={figureRef}
      armed={armed}
      css={css}
      live={describeVenue(venue)}
      caption={
        <>
          <ExampleLabel /> A looks closest, but Cy is across the river from it and the only bridge
          is far away, so Cy&apos;s trip takes {VENUES.closest.trips.cy.minutes} minutes.
        </>
      }
    >
      <SegmentedToggle label="Venue" options={OPTIONS} selected={selected} onSelect={select} />

      <MapFrame>
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

        <Rail d="M227.5 -5V230" />

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
          TEAM.map((person, i) => (
            <Route
              key={`${id}-${person.id}`}
              d={VENUES[id].trips[person.id].route}
              color={person.color}
              i={i}
              on={id === selected}
            />
          ))
        )}

        <Station at={{ x: 227.5, y: 200 }} />
        <Station at={{ x: 227.5, y: 42 }} />

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
        {plays > 0 && !armed && <Ring key={plays} at={venue.at} />}

        {TEAM.map((person) => (
          <PersonPin key={person.id} person={person} side={LABEL_SIDE[person.id]} />
        ))}
      </MapFrame>

      <TripBars
        scale={SCALE_MINUTES}
        rows={TEAM.map((person, i) => ({
          ...person,
          segments: [{ minutes: target[i] }],
          shown: counted[i],
        }))}
      />

      <StatChips
        longest={Math.round(counted[LONGEST])}
        spread={Math.round(counted[SPREAD])}
        extra={[
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
        ]}
      />
    </ExplainerFigure>
  );
}
