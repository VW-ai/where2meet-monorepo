import { createElement, type CSSProperties } from 'react';
import type { IconNode } from 'lucide';
import { CAT_HEAD_PATH } from '@/features/meeting/lib/cat-head';
import { defineMessages } from '@/shared/lib/locale';
import { VENUE_KINDS, type Invitation } from '../model/invitation';

/**
 * The invitation ticket, drawn by both the share screen in the browser and the
 * server's PNGs (satori). Satori reads a subset of CSS: every element with more
 * than one child is a flex box, sizes are numbers, and there are no animations,
 * so `live` switches on the two things only a browser can do.
 */

export const ACCENT = '#bc3942';
const ACCENT_ON_DARK = '#ff8a8f';
const PAPER = '#fffdfa';
const INK = '#21252b';

/** Satori falls back through the listed families first; the CJK names are the server's Noto subsets. */
export const DISPLAY_FONT = 'Anton, NotoSansSCDisplay, "PingFang SC", sans-serif';
export const BODY_FONT = 'Inter, NotoSansSC, system-ui, "PingFang SC", sans-serif';
const MONO_FONT = '"JetBrains Mono", ui-monospace, monospace';

export const ticketMessages = defineMessages({
  en: {
    invited: "You're invited",
    when: 'When',
    dateToBeSet: 'TBD',
    timeToBeSet: 'Time to be set',
    going: 'Going',
    hostedBy: (name: string) => `Hosted by ${name}`,
    confirmed: 'CONFIRMED',
  },
  zh: {
    invited: '邀请你来',
    when: '时间',
    dateToBeSet: '待定',
    timeToBeSet: '时间待定',
    going: '参加',
    hostedBy: (name: string) => `${name} 发起`,
    confirmed: '已确定',
  },
});

export type TicketTheme = 'dark' | 'paper';

/** A dark ticket over the venue's photo; a paper one on brand red without it. */
export function ticketTheme(photo: string | null): TicketTheme {
  return photo ? 'dark' : 'paper';
}

const THEMES = {
  dark: {
    color: '#fff',
    accent: ACCENT_ON_DARK,
    ring: '#111',
    strip: 'rgba(255, 138, 143, 0.12)',
    card: {
      backgroundImage: 'linear-gradient(180deg, rgba(10,10,12,0.92), rgba(10,10,12,0.98))',
      border: '1px solid rgba(255, 255, 255, 0.14)',
    },
    cat: { filter: 'invert(1)' },
  },
  paper: {
    color: INK,
    accent: ACCENT,
    ring: PAPER,
    strip: 'rgba(188, 57, 66, 0.16)',
    card: { backgroundColor: PAPER, boxShadow: '0 12px 40px rgba(23, 37, 45, 0.22)' },
    cat: {},
  },
} satisfies Record<TicketTheme, unknown>;

export function Icon({
  icon,
  size,
  color,
  strokeWidth = 2,
}: {
  icon: IconNode;
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {icon.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

function clamp(lines: number, live: boolean): CSSProperties {
  return live
    ? {
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }
    : { display: 'block', lineClamp: lines };
}

const MAX_AVATARS = 5;

export interface TicketProps {
  invitation: Invitation;
  /** Pixels per point of the 354-point-wide design. */
  u: number;
  /** The venue photo's src, or null to show the kind's icon. */
  photo: string | null;
  /** The black cat logo's src; the dark theme inverts it. */
  cat: string;
  /** Wraps text the browser way and lets the strip run. */
  live?: boolean;
}

export function Ticket({ invitation, u, photo, cat, live = false }: TicketProps) {
  const t = ticketMessages[invitation.locale];
  const theme = THEMES[ticketTheme(photo)];
  const kind = VENUE_KINDS[invitation.kind];
  const { when, venue, going } = invitation;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: live ? '100%' : 354 * u,
        borderRadius: 26 * u,
        overflow: 'hidden',
        fontFamily: BODY_FONT,
        color: theme.color,
        ...theme.card,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${16 * u}px ${20 * u}px`,
          borderBottom: `${1.5 * u}px dashed rgba(127, 127, 127, 0.35)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 13 * u,
            fontWeight: 700,
            letterSpacing: 1.5 * u,
          }}
        >
          <Icon icon={kind.icon} size={20 * u} color={theme.color} />
          <div style={{ marginLeft: 8 * u }}>{kind.label[invitation.locale]}</div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 19 * u,
            fontWeight: 800,
            letterSpacing: -0.4 * u,
            color: theme.accent,
          }}
        >
          <img src={cat} width={24 * u} height={24 * u} style={theme.cat} alt="" />
          <div style={{ marginLeft: 6 * u }}>where2meet</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: `${16 * u}px ${20 * u}px ${18 * u}px`,
        }}
      >
        <div style={{ fontSize: 15 * u, opacity: 0.85 }}>{t.invited}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 12 * u }}>
          <Thumb photo={photo} icon={kind.icon} size={58 * u} border={2.5 * u} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minWidth: 0,
              marginLeft: 14 * u,
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 30 * u,
                lineHeight: 1.1,
                letterSpacing: 0.3 * u,
                ...clamp(2, live),
              }}
            >
              {invitation.title}
            </div>
            {venue && (
              <div style={{ fontSize: 14 * u, opacity: 0.8, marginTop: 3 * u, ...clamp(2, live) }}>
                {`${venue.name} · ${venue.address}`}
              </div>
            )}
          </div>
        </div>
      </div>

      <Strip
        code={invitation.code}
        u={u}
        live={live}
        background={theme.strip}
        accent={theme.accent}
      />

      <div style={{ display: 'flex', padding: `${18 * u}px ${20 * u}px ${6 * u}px` }}>
        <Stat label={t.when} u={u}>
          <div style={{ fontFamily: DISPLAY_FONT, fontSize: 28 * u, marginTop: 4 * u }}>
            {when?.date ?? t.dateToBeSet}
          </div>
          <div style={{ fontSize: 13 * u, opacity: 0.75 }}>{when?.time ?? t.timeToBeSet}</div>
        </Stat>
        <Stat label={t.going} u={u} color={theme.accent}>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 * u }}>
            <div style={{ fontFamily: DISPLAY_FONT, fontSize: 28 * u }}>{String(going.length)}</div>
            <div style={{ display: 'flex', marginLeft: 10 * u }}>
              {going.slice(0, MAX_AVATARS).map((person, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28 * u,
                    height: 28 * u,
                    marginLeft: i ? -8 * u : 0,
                    paddingTop: 5 * u,
                    color: '#fff',
                    fontSize: 11 * u,
                    fontWeight: 700,
                  }}
                >
                  {/* The margin in the viewBox keeps the outline inside the box satori clips to */}
                  <svg
                    width={28 * u}
                    height={28 * u}
                    viewBox="-6 -6 112 112"
                    style={{ position: 'absolute', left: 0, top: 0 }}
                  >
                    <path
                      d={CAT_HEAD_PATH}
                      fill={person.color}
                      stroke={theme.ring}
                      strokeWidth={8}
                      paintOrder="stroke"
                    />
                  </svg>
                  <div style={{ position: 'relative' }}>{person.initial}</div>
                </div>
              ))}
            </div>
          </div>
          {invitation.host && (
            <div style={{ fontSize: 13 * u, opacity: 0.75, color: theme.color, ...clamp(1, live) }}>
              {t.hostedBy(invitation.host)}
            </div>
          )}
        </Stat>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: `${12 * u}px ${20 * u}px ${16 * u}px`,
          fontFamily: MONO_FONT,
          fontSize: 11 * u,
          letterSpacing: 3 * u,
          opacity: 0.45,
        }}
      >
        <div>{invitation.issued}</div>
        <div>{t.confirmed}</div>
      </div>
    </div>
  );
}

function Thumb({
  photo,
  icon,
  size,
  border,
}: {
  photo: string | null;
  icon: IconNode;
  size: number;
  border: number;
}) {
  const frame: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    border: `${border}px solid #fff`,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  };
  return photo ? (
    <img src={photo} width={size} height={size} style={{ ...frame, objectFit: 'cover' }} alt="" />
  ) : (
    <div style={{ ...frame, backgroundColor: ACCENT }}>
      <Icon icon={icon} size={size * 0.45} color="#fff" />
    </div>
  );
}

function Stat({
  label,
  u,
  color,
  children,
}: {
  label: string;
  u: number;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, color }}>
      <div
        style={{
          fontSize: 12 * u,
          fontWeight: 700,
          letterSpacing: 2 * u,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/** Two identical halves, so the running strip loops by sliding one half's width. */
const STRIP_REPEATS = 6;

function Strip({
  code,
  u,
  live,
  background,
  accent,
}: {
  code: string;
  u: number;
  live: boolean;
  background: string;
  accent: string;
}) {
  const items = (copy: number) =>
    Array.from({ length: STRIP_REPEATS }, (_, i) => (
      <div
        key={`${copy}-${i}`}
        style={{ display: 'flex', flexShrink: 0, alignItems: 'center', fontSize: 13 * u }}
      >
        <div style={{ margin: `0 ${12 * u}px`, fontWeight: 800, color: accent }}>where2meet</div>
        <div
          style={{
            margin: `0 ${12 * u}px`,
            fontFamily: MONO_FONT,
            letterSpacing: 2 * u,
            opacity: 0.7,
          }}
        >
          {code}
        </div>
      </div>
    ));
  return (
    <div
      style={{
        display: 'flex',
        overflow: 'hidden',
        padding: `${9 * u}px 0`,
        backgroundColor: background,
      }}
    >
      <div
        className={live ? 'invitation-strip' : undefined}
        style={{ display: 'flex', flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        {items(0)}
        {live && items(1)}
      </div>
    </div>
  );
}

const GRID_CELL = 52;
const GRID_PATH = `M49 0v${GRID_CELL}M0 49h${GRID_CELL}`;
const GRID_TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID_CELL}" height="${GRID_CELL}"><path d="${GRID_PATH}" stroke="#000" stroke-opacity="0.06" stroke-width="6"/></svg>`;
const LIGHT = 'rgba(255,255,255,0.18)';

/** Satori has no repeating backgrounds, so the image draws the whole grid at its size. */
function gridSvg(width: number, height: number) {
  const r = Math.hypot(width * 0.8, height * 0.9) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><pattern id="g" width="${GRID_CELL}" height="${GRID_CELL}" patternUnits="userSpaceOnUse"><path d="${GRID_PATH}" stroke="#000" stroke-opacity="0.06" stroke-width="6"/></pattern><radialGradient id="l" cx="${width * 0.2}" cy="${height * 0.1}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="${ACCENT}"/><rect width="${width}" height="${height}" fill="url(#g)"/><rect width="${width}" height="${height}" fill="url(#l)"/></svg>`;
}

function svgSrc(svg: string) {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Fills its positioned parent: the venue photo darkened, or brand red with a faint grid
 * and a soft light from the top left. Images pass their pixel size; the live screen
 * passes none and lets CSS tile the grid.
 */
export function TicketBackdrop({
  photo,
  size,
}: {
  photo: string | null;
  size?: { width: number; height: number };
}) {
  const fill: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: size?.width ?? '100%',
    height: size?.height ?? '100%',
  };
  if (photo) {
    return (
      <div style={{ ...fill, display: 'flex' }}>
        <img src={photo} style={{ ...fill, objectFit: 'cover' }} alt="" />
        <div
          style={{
            ...fill,
            backgroundImage: 'linear-gradient(180deg, rgba(15,12,14,0.35), rgba(15,12,14,0.78))',
          }}
        />
      </div>
    );
  }
  return size ? (
    <img src={svgSrc(gridSvg(size.width, size.height))} style={fill} alt="" />
  ) : (
    <div
      style={{
        ...fill,
        backgroundColor: ACCENT,
        backgroundImage: `radial-gradient(circle at 20% 10%, ${LIGHT}, transparent 50%), url("${svgSrc(GRID_TILE)}")`,
      }}
    />
  );
}

/** The venue kind's word above the ticket, like COFFEE. */
export function BigWord({ invitation, size }: { invitation: Invitation; size: number }) {
  return (
    <div
      style={{
        fontFamily: DISPLAY_FONT,
        // Anton has no CJK; the browser's fallback is regular weight unless asked for bold.
        fontWeight: invitation.locale === 'zh' ? 700 : 400,
        fontSize: size,
        lineHeight: 0.95,
        letterSpacing: size / 96,
        color: '#fff',
        textAlign: 'center',
        textShadow: '0 4px 18px rgba(0, 0, 0, 0.25)',
      }}
    >
      {VENUE_KINDS[invitation.kind].word[invitation.locale]}
    </div>
  );
}
