import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SHARE_IMAGE, SITE_CONFIG } from '@/lib/seo/metadata';

export const alt = SHARE_IMAGE.alt;
export const size = { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height };
export const contentType = 'image/png';

const INK = '#21252b';
const MUTED = '#666b73';
const ACCENT = '#bc3942';
const PICKED = '#c83f49';
const CARD_SHADOW = '0 8px 40px rgba(23, 37, 45, 0.12)';

/** The final frame of the landing story: three people, routes meeting at Coffee. */
const people = [
  { color: '#FF6B6B', ink: '#d9474a', x: 48, y: 44, route: 'M48 44 H124 V120 H200', time: '18m' },
  { color: '#4D96FF', ink: '#2f6fd6', x: 352, y: 44, route: 'M352 44 H276 V120 H200', time: '20m' },
  { color: '#6BCB77', ink: '#3a9447', x: 200, y: 214, route: 'M200 214 V120', time: '19m' },
];

const COFFEE = { color: '#FFD93D', ink: '#3f3420', x: 200, y: 120 };
const coffeeIcon =
  '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/>' +
  '<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>';

const map = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 -8 360 274">
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
<circle cx="${COFFEE.x}" cy="${COFFEE.y}" r="17" fill="${COFFEE.color}" stroke="#fff" stroke-width="3"/>
<g transform="translate(${COFFEE.x - 10} ${COFFEE.y - 10}) scale(0.833)" fill="none" stroke="${COFFEE.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${coffeeIcon}</g>
</g>
${people
  .map(
    (p) => `<g filter="url(#shadow)">
<circle cx="${p.x}" cy="${p.y}" r="15" fill="${p.color}" stroke="#fff" stroke-width="3"/>
<g transform="translate(${p.x - 9} ${p.y - 9.6}) scale(0.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></g>
</g>`
  )
  .join('')}
</svg>`;

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

const coffeeBadge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${COFFEE.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${coffeeIcon}</svg>`;
const check = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;

function svgDataUri(svg: string | Buffer) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function readClientFile(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath));
}

export default async function OpengraphImage() {
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
        width={size.width}
        height={size.height}
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
        <div
          style={{
            marginTop: 36,
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          {SITE_CONFIG.tagline}
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            lineHeight: 1.35,
            color: MUTED,
            textWrap: 'balance',
          }}
        >
          {SITE_CONFIG.pitch}
        </div>
        <div style={{ marginTop: 32, fontSize: 26, fontWeight: 600, color: ACCENT }}>
          {new URL(SITE_CONFIG.url).host}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 470,
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
          <img src={svgDataUri(map)} width={434} height={330} alt="" />
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
              backgroundColor: COFFEE.color,
            }}
          >
            <img src={svgDataUri(coffeeBadge)} width={22} height={22} alt="" />
          </div>
          <div style={{ marginLeft: 12, flex: 1 }}>Coffee</div>
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
            <img src={svgDataUri(check)} width={20} height={20} alt="" />
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
      ],
    }
  );
}
