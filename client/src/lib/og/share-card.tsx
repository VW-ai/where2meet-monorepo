import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ReactElement } from 'react';
import { ImageResponse } from 'next/og';
import { Check, UserRound, type IconNode } from 'lucide';
import { BigWord, Ticket, TicketBackdrop, ticketMessages } from '@/features/invitation/ui/ticket';
import { VENUE_KINDS, type Invitation } from '@/features/invitation/model/invitation';
import { SHARE_IMAGE } from '@/lib/seo/metadata';

export const INK = '#21252b';
export const MUTED = '#666b73';
export const ACCENT = '#bc3942';
const PICKED = '#c83f49';
const CARD_SHADOW = '0 8px 40px rgba(23, 37, 45, 0.12)';
const SIZE = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
/** The map card and the photo that can take its place share one size. */
const CARD_SIZE = { width: 470, height: 448 };

/** The venue every person travels to, drawn on the map's center pin and in the result row. */
export interface MapPin {
  icon: IconNode;
  label?: string;
}

export interface CardPhoto {
  jpeg: Buffer;
  credit: string;
}

/** The final frame of the landing story: three people, routes meeting at the venue. */
const people = [
  { color: '#FF6B6B', ink: '#d9474a', x: 48, y: 44, route: 'M48 44 H124 V120 H200', time: '18m' },
  { color: '#4D96FF', ink: '#2f6fd6', x: 352, y: 44, route: 'M352 44 H276 V120 H200', time: '20m' },
  { color: '#6BCB77', ink: '#3a9447', x: 200, y: 214, route: 'M200 214 V120', time: '19m' },
];

const VENUE = { color: '#FFD93D', ink: '#3f3420', x: 200, y: 120 };

/** Serializes a lucide icon's shapes; the caller's wrapper sets stroke and size. */
export function iconSvg(icon: IconNode) {
  return icon
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([name, value]) => `${name}="${value}"`)
          .join(' ')}/>`
    )
    .join('');
}

export function iconDataUri(icon: IconNode, stroke: string, strokeWidth: number) {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${iconSvg(icon)}</svg>`
  );
}

function mapSvg(venueIcon: IconNode) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 -8 360 274">
<defs>
<pattern id="blocks" width="76" height="76" x="48" y="44" patternUnits="userSpaceOnUse">
<rect x="6" y="6" width="64" height="64" rx="8" fill="#e9edf2"/>
<path d="M38 6v64" stroke="#f7f8fa" stroke-width="3"/>
</pattern>
<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
<feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#17252d" flood-opacity="0.22"/>
</filter>
</defs>
<rect x="-400" y="-300" width="1200" height="840" fill="url(#blocks)"/>
<rect x="206" y="126" width="64" height="64" rx="8" fill="#d6ecd4"/>
<rect x="282" y="-26" width="64" height="64" rx="8" fill="#d6ecd4"/>
<ellipse cx="34" cy="244" rx="78" ry="46" fill="#d7e7f8"/>
<ellipse cx="392" cy="232" rx="60" ry="30" fill="#d7e7f8"/>
<circle cx="200" cy="120" r="74" fill="rgba(200,63,73,0.07)" stroke="rgba(200,63,73,0.4)" stroke-width="1.5" stroke-dasharray="4 4"/>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
${people.map((p) => `<path d="${p.route}" stroke="#fff" stroke-width="10"/>`).join('')}
${people.map((p) => `<path d="${p.route}" stroke="${p.color}" stroke-width="5.5"/>`).join('')}
</g>
<g filter="url(#shadow)">
<circle cx="${VENUE.x}" cy="${VENUE.y}" r="17" fill="${VENUE.color}" stroke="#fff" stroke-width="3"/>
<g transform="translate(${VENUE.x - 10} ${VENUE.y - 10}) scale(0.833)" fill="none" stroke="${VENUE.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconSvg(venueIcon)}</g>
</g>
${people
  .map(
    (p) => `<g filter="url(#shadow)">
<circle cx="${p.x}" cy="${p.y}" r="15" fill="${p.color}" stroke="#fff" stroke-width="3"/>
<g transform="translate(${p.x - 9} ${p.y - 9.6}) scale(0.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${iconSvg(UserRound)}</g>
</g>`
  )
  .join('')}
</svg>`;
}

const glows = [
  { color: '#FF6B6B', x: 40, y: 40 },
  { color: '#4D96FF', x: 1180, y: 120 },
  { color: '#6BCB77', x: 560, y: 760 },
];

/** The landing backdrop: faint city blocks under three participant-colored glows. */
const backdrop = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
<defs>
<pattern id="tiles" width="288" height="288" x="-60" y="-40" patternUnits="userSpaceOnUse">
<g fill="#e4e8ed">
<rect x="7" y="7" width="82" height="82" rx="12"/>
<rect x="103" y="7" width="178" height="82" rx="12"/>
<rect x="7" y="103" width="82" height="178" rx="12"/>
<rect x="199" y="103" width="82" height="82" rx="12"/>
<rect x="103" y="199" width="82" height="82" rx="12"/>
<rect x="199" y="199" width="82" height="82" rx="12"/>
</g>
<rect x="103" y="103" width="82" height="82" rx="12" fill="#dbe9da"/>
</pattern>
${glows
  .map(
    (
      g,
      i
    ) => `<radialGradient id="glow${i}" cx="${g.x}" cy="${g.y}" r="420" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="${g.color}" stop-opacity="0.24"/>
<stop offset="1" stop-color="${g.color}" stop-opacity="0"/>
</radialGradient>`
  )
  .join('')}
</defs>
<rect width="1200" height="630" fill="#eef1f4"/>
<rect width="1200" height="630" fill="url(#tiles)" opacity="0.35"/>
${glows.map((_, i) => `<rect width="1200" height="630" fill="url(#glow${i})"/>`).join('')}
</svg>`;

function svgDataUri(svg: string | Buffer) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function readClientFile(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath));
}

export function MapCard({ pin }: { pin: MapPin }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...CARD_SIZE,
        padding: 18,
        borderRadius: 28,
        backgroundColor: '#fff',
        boxShadow: CARD_SHADOW,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 434,
          height: 330,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: '#f7f8fa',
          border: '1.5px solid #e6eaef',
        }}
      >
        <img src={svgDataUri(mapSvg(pin.icon))} width={434} height={330} alt="" />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 14,
          height: 68,
          padding: '0 16px',
          borderRadius: 20,
          backgroundColor: '#fff0ef',
          border: '2px solid rgba(200, 63, 73, 0.35)',
          fontSize: 26,
          fontWeight: 600,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: VENUE.color,
          }}
        >
          <img src={iconDataUri(pin.icon, VENUE.ink, 2.4)} width={22} height={22} alt="" />
        </div>
        <div style={{ marginLeft: 12, flex: 1 }}>{pin.label}</div>
        {people.map((p) => (
          <div key={p.color} style={{ marginLeft: 14, color: p.ink }}>
            {p.time}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 16,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: PICKED,
          }}
        >
          <img src={iconDataUri(Check, '#fff', 3)} width={20} height={20} alt="" />
        </div>
      </div>
    </div>
  );
}

/** A photo cropped to fill the map card's place, with its credit on the bottom-left. */
function PhotoCard({ jpeg, credit }: { jpeg: Buffer; credit: string }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        ...CARD_SIZE,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: CARD_SHADOW,
      }}
    >
      <img
        src={`data:image/jpeg;base64,${jpeg.toString('base64')}`}
        {...CARD_SIZE}
        style={{ objectFit: 'cover' }}
        alt=""
      />
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          maxWidth: CARD_SIZE.width - 32,
          padding: '6px 14px',
          borderRadius: 12,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          color: '#fff',
          fontSize: 18,
        }}
      >
        {`Photo: ${credit}`}
      </div>
    </div>
  );
}

/** The pill badge between the logo and a card's title. */
function Pill({ icon, label }: { icon: IconNode; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginTop: 28,
        padding: '8px 20px 8px 10px',
        borderRadius: 30,
        backgroundColor: '#fff',
        boxShadow: '0 3px 16px rgba(23, 37, 45, 0.12)',
        fontSize: 24,
        fontWeight: 600,
        color: ACCENT,
      }}
    >
      <img src={iconDataUri(icon, ACCENT, 2.4)} width={28} height={28} alt="" />
      <div style={{ marginLeft: 10 }}>{label}</div>
    </div>
  );
}

/**
 * An article's cover: a pill badge, the title and a site address under the logo, with
 * `icon` on the badge. On the right, `photo` when given, else the map with `icon` at its
 * meeting point.
 */
export async function renderArticleCover({
  icon,
  badge,
  title,
  address,
  photo,
}: {
  icon: IconNode;
  badge: string;
  title: string;
  /** Shown under the title, like `www.where2meet.org/blog`. */
  address: string;
  photo?: CardPhoto;
}) {
  return renderShareCard({
    card: photo ? (
      <PhotoCard jpeg={photo.jpeg} credit={photo.credit} />
    ) : (
      <MapCard pin={{ icon }} />
    ),
    text: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <Pill icon={icon} label={badge} />
        <div
          style={{
            marginTop: 24,
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            textWrap: 'balance',
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 28, fontSize: 26, fontWeight: 600, color: ACCENT }}>{address}</div>
      </div>
    ),
  });
}

/**
 * Draws a 1200x630 share card: the landing backdrop, the cat logo above `text`
 * on the left, and `card` on the right.
 */
export async function renderShareCard({ text, card }: { text: ReactElement; card: ReactElement }) {
  const [logo, regular, semibold, bold] = await Promise.all([
    readClientFile('src/components/cat/logo.svg'),
    readClientFile('node_modules/@fontsource/inter/files/inter-latin-400-normal.woff'),
    readClientFile('node_modules/@fontsource/inter/files/inter-latin-600-normal.woff'),
    readClientFile('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff'),
  ]);

  return new ImageResponse(
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        padding: '0 64px 0 72px',
        fontFamily: 'Inter',
        color: INK,
      }}
    >
      <img
        src={svgDataUri(backdrop)}
        width={SIZE.width}
        height={SIZE.height}
        style={{ position: 'absolute', left: 0, top: 0 }}
        alt=""
      />

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 48 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 104,
            height: 104,
            borderRadius: 52,
            backgroundColor: '#fff',
            boxShadow: '0 6px 24px rgba(23, 37, 45, 0.15)',
          }}
        >
          <img src={svgDataUri(logo)} width={80} height={80} alt="" />
        </div>
        {text}
      </div>

      {card}
    </div>,
    {
      ...SIZE,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
      ],
    }
  );
}

/** The link preview, and the image people copy, save and share. */
export const INVITATION_FORMATS = {
  landscape: { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height },
  portrait: { width: 1080, height: 1350 },
} as const;

export type InvitationFormat = keyof typeof INVITATION_FORMATS;

/**
 * The invitation ticket over its backdrop: landscape puts the venue kind's word on the
 * left and the ticket on the right; portrait stacks the word above the ticket.
 */
export async function renderInvitation({
  invitation,
  format,
  photo,
}: {
  invitation: Invitation;
  format: InvitationFormat;
  photo: Buffer | null;
}) {
  const size = INVITATION_FORMATS[format];
  const photoSrc = photo && `data:image/jpeg;base64,${photo.toString('base64')}`;
  const [logo, fonts] = await Promise.all([
    readClientFile('src/components/cat/logo.svg'),
    invitationFonts(invitation),
  ]);
  const portrait = format === 'portrait';
  return new ImageResponse(
    <div
      lang={invitation.locale === 'zh' ? 'zh-CN' : 'en-US'}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: portrait ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: size.width,
        height: size.height,
        padding: portrait ? '0 115px' : '0 48px 0 56px',
      }}
    >
      <TicketBackdrop photo={photoSrc} size={size} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          ...(portrait ? { marginBottom: 44 } : { flex: 1, minWidth: 0, paddingRight: 40 }),
        }}
      >
        <BigWord invitation={invitation} size={portrait ? 210 : 150} />
      </div>
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <Ticket
          invitation={invitation}
          u={portrait ? 2.3 : 1.45}
          photo={photoSrc}
          cat={svgDataUri(logo)}
        />
      </div>
    </div>,
    { ...size, fonts }
  );
}

type Font = NonNullable<ConstructorParameters<typeof ImageResponse>[1]>['fonts'] extends
  | (infer F)[]
  | undefined
  ? F
  : never;

async function invitationFonts(invitation: Invitation): Promise<Font[]> {
  const file = (name: string) => readClientFile(`node_modules/@fontsource/${name}.woff`);
  const [inter400, inter600, inter700, inter800, anton, mono, cjk] = await Promise.all([
    file('inter/files/inter-latin-400-normal'),
    file('inter/files/inter-latin-600-normal'),
    file('inter/files/inter-latin-700-normal'),
    file('inter/files/inter-latin-800-normal'),
    file('anton/files/anton-latin-400-normal'),
    file('jetbrains-mono/files/jetbrains-mono-latin-400-normal'),
    cjkFonts(invitationText(invitation)),
  ]);
  return [
    { name: 'Inter', data: inter400, weight: 400, style: 'normal' },
    { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
    { name: 'Inter', data: inter700, weight: 700, style: 'normal' },
    { name: 'Inter', data: inter800, weight: 800, style: 'normal' },
    { name: 'Anton', data: anton, weight: 400, style: 'normal' },
    { name: 'JetBrains Mono', data: mono, weight: 400, style: 'normal' },
    ...cjk,
  ];
}

/** Every string the ticket can print for this invitation. */
function invitationText(invitation: Invitation): string {
  const t = ticketMessages[invitation.locale];
  const kind = VENUE_KINDS[invitation.kind];
  return [
    invitation.title,
    invitation.host && t.hostedBy(invitation.host),
    invitation.venue?.name,
    invitation.venue?.address,
    invitation.when?.date ?? t.dateToBeSet,
    invitation.when?.time ?? t.timeToBeSet,
    invitation.issued,
    t.invited,
    t.when,
    t.going,
    t.confirmed,
    kind.label[invitation.locale],
    kind.word[invitation.locale],
  ].join('');
}

/** Characters the Latin subsets of Inter and Anton draw. */
const LATIN = /[\u0000-\u024f\u2000-\u206f\u20ac\u2122]/u;

/** Old Safari gets TrueType from Google Fonts; satori cannot read WOFF2. */
const TTF_USER_AGENT =
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1';

/**
 * Noto Sans SC cut down to exactly the non-Latin characters on the ticket, so Chinese
 * titles draw in any event: regular for body text and bold, registered as the display
 * family, for the title and the big word. Without the network the ticket still renders
 * (satori then tries its own fallback, or draws boxes).
 */
async function cjkFonts(text: string): Promise<Font[]> {
  const chars = [...new Set(Array.from(text))].filter((c) => !LATIN.test(c)).join('');
  if (!chars) return [];
  try {
    const css = await fetchOk(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&text=${encodeURIComponent(chars)}`
    ).then((r) => r.text());
    const urls = Object.fromEntries(
      [...css.matchAll(/font-weight:\s*(\d+);[^}]*?src:\s*url\(([^)]+)\)/g)].map((m) => [
        m[1],
        m[2],
      ])
    );
    if (!urls['400'] || !urls['700']) return [];
    const [regular, bold] = await Promise.all(
      [urls['400'], urls['700']].map((url) => fetchOk(url).then((r) => r.arrayBuffer()))
    );
    return [
      { name: 'NotoSansSC', data: regular, weight: 400, style: 'normal' },
      { name: 'NotoSansSC', data: bold, weight: 700, style: 'normal' },
      { name: 'NotoSansSCDisplay', data: bold, weight: 400, style: 'normal' },
    ];
  } catch (error) {
    console.warn('[invitation] CJK font unavailable:', error);
    return [];
  }
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { 'User-Agent': TTF_USER_AGENT },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response;
}
