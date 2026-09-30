import type { ReactNode } from 'react';
import { Check, Search } from 'lucide-react';

const people = [
  {
    id: 'a',
    color: '#FF6B6B',
    time: '18m',
    cx: 72,
    cy: 58,
    labelX: 72,
    labelY: 36,
    route: 'M 86 66 C 118 74, 148 84, 168 94',
  },
  {
    id: 'b',
    color: '#4D96FF',
    time: '20m',
    cx: 288,
    cy: 58,
    labelX: 288,
    labelY: 36,
    route: 'M 274 66 C 242 74, 212 84, 192 94',
  },
  {
    id: 'c',
    color: '#6BCB77',
    time: '19m',
    cx: 180,
    cy: 148,
    labelX: 214,
    labelY: 156,
    route: 'M 180 134 C 180 126, 180 116, 180 108',
  },
];

const spots: {
  name: string;
  color: string;
  iconColor: string;
  times: string[];
  fair: boolean;
  cx: number;
  cy: number;
  mark: () => ReactNode;
}[] = [
  {
    name: 'Coffee',
    color: '#FFD93D',
    iconColor: '#3f3420',
    times: ['18m', '20m', '19m'],
    fair: true,
    cx: 136,
    cy: 62,
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
    times: ['12m', '35m', '28m'],
    fair: false,
    cx: 228,
    cy: 96,
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
    times: ['8m', '31m', '26m'],
    fair: false,
    cx: 148,
    cy: 118,
    mark: () => (
      <>
        <path
          d="M12 2.5 17.2 10h-2.4L19.5 17H4.5l4.7-7H6.8Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="M10.4 17h3.2V21.5h-3.2Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
];

export function StoryPreview() {
  return (
    <div
      className="story overflow-hidden rounded-[28px] bg-white px-3 py-3 shadow-[0_2px_8px_rgba(23,37,45,0.12)] lg:flex lg:h-full lg:flex-col lg:justify-center lg:px-8 lg:py-8"
      role="img"
      aria-label="Three people meet in about 20 minutes. Coffee, Ramen, and Park appear. The group picks Coffee, which is fair for everyone."
    >
      <div className="relative">
        <svg viewBox="0 0 360 176" className="mx-auto h-auto w-full" aria-hidden="true">
          <circle className="story-radius" cx="180" cy="90" r="54" />

          {people.map((person, index) => (
            <path
              key={person.id}
              d={person.route}
              className={`story-route story-route-${index + 1}`}
              stroke={person.color}
              pathLength={1}
            />
          ))}

          <g className="story-pin">
            <path
              d="M180 102 C180 102 169 88 169 82 a11 11 0 1 1 22 0 C191 88 180 102 180 102Z"
              fill="#c83f49"
            />
            <circle cx="180" cy="82" r="4" fill="white" />
          </g>

          {spots.map((spot, index) => (
            <g key={spot.name} className={`story-venue story-venue-${index + 1}`}>
              {spot.fair && (
                <circle className="story-venue-ring" cx={spot.cx} cy={spot.cy} r="16" />
              )}
              <circle cx={spot.cx} cy={spot.cy} r="12" fill={spot.color} />
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

          {people.map((person, index) => (
            <g key={person.id} className={`story-person story-person-${index + 1}`}>
              <circle cx={person.cx} cy={person.cy} r="13" fill={person.color} />
              <g
                transform={`translate(${person.cx - 7.2} ${person.cy - 7.8}) scale(0.6)`}
                fill="none"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 0 0-16 0" />
              </g>
            </g>
          ))}

          {people.map((person, index) => (
            <text
              key={`${person.id}-time`}
              x={person.labelX}
              y={person.labelY}
              textAnchor="middle"
              className={`story-time story-time-${index + 1}`}
            >
              {person.time}
            </text>
          ))}
        </svg>

        <div className="story-search">
          <Search size={14} aria-hidden="true" />
          <span>Places</span>
        </div>
      </div>

      <div className="story-list">
        {spots.map((spot, index) => (
          <div
            key={spot.name}
            className={`story-row story-row-${index + 1} flex items-center justify-between gap-3 overflow-hidden rounded-2xl px-3 ${
              spot.fair ? 'story-fair' : ''
            }`}
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
                  aria-hidden="true"
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
              {spot.times.map((time, timeIndex) => (
                <span key={time} style={{ color: people[timeIndex].color }}>
                  {time}
                </span>
              ))}
              <Check
                size={15}
                aria-hidden="true"
                className={spot.fair ? 'story-check text-[#c83f49]' : 'invisible'}
              />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .story-route {
          fill: none;
          stroke-width: 2.5;
          stroke-linecap: round;
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
        }
        .story-person, .story-venue, .story-radius, .story-pin {
          transform-box: fill-box;
          transform-origin: center;
          opacity: 0;
        }
        .story-pin { transform-origin: center bottom; }
        .story-radius {
          fill: rgba(200, 63, 73, 0.06);
          stroke: rgba(200, 63, 73, 0.28);
          stroke-width: 1.5;
        }
        .story-venue-ring {
          fill: none;
          stroke: #c83f49;
          stroke-width: 1.5;
          opacity: 0;
        }
        .story-time {
          font-size: 13px;
          font-weight: 650;
          fill: #666b73;
          opacity: 0;
        }
        .story-search {
          position: absolute;
          top: 8px;
          left: 0;
          right: 0;
          margin-inline: auto;
          display: flex;
          width: fit-content;
          align-items: center;
          gap: 6px;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          background: #f6f7f8;
          color: #21252b;
          font-size: 13px;
          font-weight: 650;
          box-shadow: 0 2px 8px rgba(23, 37, 45, 0.12);
          opacity: 0;
        }
        .story-row { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; }
        .story-check { opacity: 0; }
        .story-person-1 { animation: story-person-a 14s ease infinite; }
        .story-person-2 { animation: story-person-b 14s ease infinite; }
        .story-person-3 { animation: story-person-c 14s ease infinite; }
        .story-pin { animation: story-pin 14s ease infinite; }
        .story-route-1 { animation: story-draw-a 14s ease infinite; }
        .story-route-2 { animation: story-draw-b 14s ease infinite; }
        .story-route-3 { animation: story-draw-c 14s ease infinite; }
        .story-time { animation: story-time 14s ease infinite; }
        .story-radius { animation: story-radius 14s ease infinite; }
        .story-search { animation: story-search 14s ease infinite; }
        .story-venue-1 { animation: story-venue-a 14s ease infinite; }
        .story-venue-2 { animation: story-venue-b 14s ease infinite; }
        .story-venue-3 { animation: story-venue-c 14s ease infinite; }
        .story-venue-ring { animation: story-ring 14s ease infinite; }
        .story-row-1 { animation: story-row-a 14s ease infinite; }
        .story-row-2 { animation: story-row-b 14s ease infinite; }
        .story-row-3 { animation: story-row-c 14s ease infinite; }
        .story-fair { animation: story-fair 14s ease infinite; }
        .story-check { animation: story-check 14s ease infinite; }
        @keyframes story-person-a {
          0%, 2% { opacity: 0; transform: scale(0.4); }
          7%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; transform: scale(0.7); }
        }
        @keyframes story-person-b {
          0%, 4% { opacity: 0; transform: scale(0.4); }
          9%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; transform: scale(0.7); }
        }
        @keyframes story-person-c {
          0%, 6% { opacity: 0; transform: scale(0.4); }
          11%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; transform: scale(0.7); }
        }
        @keyframes story-pin {
          0%, 5% { opacity: 0; transform: translateY(-8px); }
          11%, 90% { opacity: 1; transform: translateY(0); }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-draw-a {
          0%, 8% { stroke-dashoffset: 1; opacity: 0; }
          12% { opacity: 1; }
          20%, 90% { stroke-dashoffset: 0; opacity: 1; }
          97%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes story-draw-b {
          0%, 10% { stroke-dashoffset: 1; opacity: 0; }
          14% { opacity: 1; }
          22%, 90% { stroke-dashoffset: 0; opacity: 1; }
          97%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes story-draw-c {
          0%, 12% { stroke-dashoffset: 1; opacity: 0; }
          16% { opacity: 1; }
          24%, 90% { stroke-dashoffset: 0; opacity: 1; }
          97%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }
        @keyframes story-time {
          0%, 22% { opacity: 0; }
          28%, 90% { opacity: 1; }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-radius {
          0%, 40% { opacity: 0; transform: scale(0.35); }
          48%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-search {
          0%, 40% { opacity: 0; transform: translateY(4px); }
          48%, 90% { opacity: 1; transform: translateY(0); }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-venue-a {
          0%, 44% { opacity: 0; transform: scale(0.4); }
          50%, 66% { opacity: 1; transform: scale(1); }
          74%, 90% { opacity: 1; transform: scale(1.35); }
          97%, 100% { opacity: 0; transform: scale(0.6); }
        }
        @keyframes story-venue-b {
          0%, 48% { opacity: 0; transform: scale(0.4); }
          56%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-venue-c {
          0%, 52% { opacity: 0; transform: scale(0.4); }
          60%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-ring {
          0%, 68% { opacity: 0; }
          76%, 90% { opacity: 1; }
          97%, 100% { opacity: 0; }
        }
        @keyframes story-row-a {
          0%, 46% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
          54%, 90% { opacity: 1; max-height: 44px; padding-top: 8px; padding-bottom: 8px; }
          97%, 100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
        }
        @keyframes story-row-b {
          0%, 50% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
          58%, 90% { opacity: 1; max-height: 44px; padding-top: 8px; padding-bottom: 8px; }
          97%, 100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
        }
        @keyframes story-row-c {
          0%, 54% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
          62%, 90% { opacity: 1; max-height: 44px; padding-top: 8px; padding-bottom: 8px; }
          97%, 100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
        }
        @keyframes story-fair {
          0%, 46% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; background: transparent; box-shadow: none; }
          54%, 66% { opacity: 1; max-height: 44px; padding-top: 8px; padding-bottom: 8px; background: transparent; box-shadow: none; }
          76%, 90% { opacity: 1; max-height: 44px; padding-top: 8px; padding-bottom: 8px; background: #fff0ef; box-shadow: inset 0 0 0 1.5px rgba(200, 63, 73, 0.35); }
          97%, 100% { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; background: transparent; box-shadow: none; }
        }
        @keyframes story-check {
          0%, 68% { opacity: 0; transform: scale(0.6); }
          78%, 90% { opacity: 1; transform: scale(1); }
          97%, 100% { opacity: 0; }
        }
        @media (min-width: 1024px) {
          .story-search {
            top: 20px;
            min-height: 40px;
            padding: 0 16px;
            font-size: 15px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .story-person, .story-route, .story-time, .story-pin, .story-radius, .story-venue, .story-search {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .story-route { stroke-dashoffset: 0; }
          .story-row, .story-check, .story-venue-ring {
            animation: none;
            opacity: 1;
            transform: none;
            max-height: 44px;
            padding-top: 8px;
            padding-bottom: 8px;
          }
          .story-search { position: static; margin: 4px auto 8px; }
          .story-fair {
            background: #fff0ef;
            box-shadow: inset 0 0 0 1.5px rgba(200, 63, 73, 0.35);
          }
        }
      `}</style>
    </div>
  );
}
