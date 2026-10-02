/**
 * Generate the static share images and app icons from the cat logo.
 *
 * Outputs (all in /public unless noted):
 *   - og-image.png     1200x630  default Open Graph / Twitter card
 *   - og-landing.png   1200x630  home page Open Graph / Twitter card
 *   - icon-192.png     192x192   PWA icon (white background, maskable-safe)
 *   - icon-512.png     512x512   PWA icon (white background, maskable-safe)
 *   - src/app/apple-icon.png 180x180  Apple touch icon
 *
 * Usage:  node scripts/generate-og-images.mjs
 *
 * Rendering uses `next/og` (Satori + resvg), the same engine Next.js uses for
 * `opengraph-image.tsx`, so no extra dependencies are needed. Fonts: Arial /
 * Arial Bold from macOS when available, otherwise the Noto Sans that ships
 * with `@vercel/og` (regular weight only).
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ImageResponse } = require('next/og');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOGO_PATH = path.join(ROOT, 'src/components/cat/image.png');
const LOGO_ASPECT = 876 / 1042; // source logo is 1042x876
const SITE_HOST = 'www.where2meet.org';

// Brand palette (tailwind.config.ts)
const COLORS = {
  coral500: '#FF6B6B',
  coral50: '#FFF5F5',
  mint50: '#F0FDF4',
  lavender50: '#F5F3FF',
  gray900: '#111827',
  gray600: '#4B5563',
  gray500: '#6B7280',
  white: '#FFFFFF',
};

const BACKGROUND = `linear-gradient(135deg, ${COLORS.coral50} 0%, ${COLORS.mint50} 50%, ${COLORS.lavender50} 100%)`;

/** Minimal React.createElement replacement understood by Satori. */
const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.length === 1 ? children[0] : children },
});

async function loadFonts() {
  const regular = '/System/Library/Fonts/Supplemental/Arial.ttf';
  const bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
  if (!existsSync(regular) || !existsSync(bold)) {
    console.warn('Arial not found; falling back to the bundled Noto Sans (regular weight only).');
    return { fonts: undefined, fontFamily: undefined };
  }
  return {
    fonts: [
      { name: 'Arial', data: await readFile(regular), weight: 400, style: 'normal' },
      { name: 'Arial', data: await readFile(bold), weight: 700, style: 'normal' },
    ],
    fontFamily: 'Arial',
  };
}

/** The logo inside a white rounded card (the source PNG has a white backdrop). */
function logoCard({ logoSrc, logoWidth, radius }) {
  const logoHeight = Math.round(logoWidth * LOGO_ASPECT);
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: logoWidth + 56,
        height: logoHeight + 56,
        backgroundColor: COLORS.white,
        borderRadius: radius,
        boxShadow: '0 20px 45px rgba(17, 24, 39, 0.10)',
        flexShrink: 0,
      },
    },
    h('img', {
      src: logoSrc,
      width: logoWidth,
      height: logoHeight,
      style: { width: logoWidth, height: logoHeight, objectFit: 'contain' },
    })
  );
}

/**
 * Split a headline into per-word spans so lines wrap at word boundaries, and
 * colour the words that belong to the accent phrase coral. (A single span per
 * phrase would wrap as a block and Satori collapses its trailing spaces.)
 */
function headlineWords(headline, accent) {
  const start = headline.indexOf(accent);
  const end = start + accent.length;
  let offset = 0;
  return headline.split(' ').map((word) => {
    const wordStart = offset;
    offset += word.length + 1;
    const inAccent = start >= 0 && wordStart >= start && wordStart < end;
    return h(
      'span',
      { style: { whiteSpace: 'pre', color: inAccent ? COLORS.coral500 : undefined } },
      `${word} `
    );
  });
}

function ogCard({ logoSrc, fontFamily, eyebrow, headline, accent, subline }) {
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '64px 72px',
        backgroundImage: BACKGROUND,
        fontFamily,
        color: COLORS.gray900,
      },
    },
    logoCard({ logoSrc, logoWidth: 300, radius: 40 }),
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 64 } },
      h(
        'div',
        { style: { fontSize: 30, fontWeight: 700, color: COLORS.gray600, marginBottom: 20 } },
        eyebrow
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1,
          },
        },
        ...headlineWords(headline, accent)
      ),
      h(
        'div',
        { style: { fontSize: 28, color: COLORS.gray600, marginTop: 28, lineHeight: 1.4 } },
        subline
      ),
      h(
        'div',
        { style: { fontSize: 24, color: COLORS.gray500, marginTop: 36, fontWeight: 700 } },
        SITE_HOST
      )
    )
  );
}

/**
 * App icon: white background with the logo centred inside the maskable safe
 * zone (an inscribed circle of 80% diameter), so it survives any mask shape.
 */
function appIcon({ logoSrc, size, logoScale }) {
  const logoWidth = Math.round(size * logoScale);
  const logoHeight = Math.round(logoWidth * LOGO_ASPECT);
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.white,
      },
    },
    h('img', {
      src: logoSrc,
      width: logoWidth,
      height: logoHeight,
      style: { width: logoWidth, height: logoHeight, objectFit: 'contain' },
    })
  );
}

async function render(element, { width, height, fonts }, outFile) {
  const response = new ImageResponse(element, { width, height, fonts });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outFile, buffer);
  console.log(`wrote ${path.relative(ROOT, outFile)} (${width}x${height}, ${buffer.length} bytes)`);
}

async function main() {
  const logo = await readFile(LOGO_PATH);
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;
  const { fonts, fontFamily } = await loadFonts();
  const og = { width: 1200, height: 630, fonts };

  await render(
    ogCard({
      logoSrc,
      fontFamily,
      eyebrow: 'Where2Meet',
      headline: 'Fair meeting spots, equal travel times',
      accent: 'equal travel times',
      subline: 'Compare real travel times for everyone in your group, then vote on a venue.',
    }),
    og,
    path.join(PUBLIC_DIR, 'og-image.png')
  );

  await render(
    ogCard({
      logoSrc,
      fontFamily,
      eyebrow: 'Where2Meet · free meeting spot finder',
      headline: 'Find fair meeting spots for your group',
      accent: 'fair meeting spots',
      subline: 'See routes and travel times on a map. Vote on venues together. No sign-up needed.',
    }),
    og,
    path.join(PUBLIC_DIR, 'og-landing.png')
  );

  await render(
    appIcon({ logoSrc, size: 512, logoScale: 0.6 }),
    { width: 512, height: 512, fonts },
    path.join(PUBLIC_DIR, 'icon-512.png')
  );
  await render(
    appIcon({ logoSrc, size: 192, logoScale: 0.6 }),
    { width: 192, height: 192, fonts },
    path.join(PUBLIC_DIR, 'icon-192.png')
  );
  await render(
    appIcon({ logoSrc, size: 180, logoScale: 0.78 }),
    { width: 180, height: 180, fonts },
    path.join(ROOT, 'src/app/apple-icon.png')
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
