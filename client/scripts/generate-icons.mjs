/**
 * Generate the app icons from the cat logo.
 *
 * Outputs:
 *   - public/icon-192.png     192x192  PWA icon (white background, maskable-safe)
 *   - public/icon-512.png     512x512  PWA icon (white background, maskable-safe)
 *   - src/app/apple-icon.png  180x180  Apple touch icon
 *
 * Usage:  node scripts/generate-icons.mjs
 *
 * Rendering uses `next/og` (Satori + resvg), so no extra dependencies are
 * needed. The link preview image is not made here. `src/app/opengraph-image.tsx`
 * renders it at build time.
 */

import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { ImageResponse } = require('next/og');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LOGO_PATH = path.join(ROOT, 'src/components/cat/logo.svg');

/** Minimal React.createElement replacement understood by Satori. */
const h = (type, props = {}, ...children) => ({
  type,
  props: { ...props, children: children.length === 1 ? children[0] : children },
});

/**
 * App icon: white background with the logo centred inside the maskable safe
 * zone (an inscribed circle of 80% diameter), so it survives any mask shape.
 */
function appIcon({ logoSrc, size, logoScale }) {
  const logoSize = Math.round(size * logoScale);
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
      },
    },
    h('img', {
      src: logoSrc,
      width: logoSize,
      height: logoSize,
      style: { width: logoSize, height: logoSize, objectFit: 'contain' },
    })
  );
}

async function render(element, { width, height }, outFile) {
  const response = new ImageResponse(element, { width, height });
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outFile, buffer);
  console.log(`wrote ${path.relative(ROOT, outFile)} (${width}x${height}, ${buffer.length} bytes)`);
}

async function main() {
  const logo = await readFile(LOGO_PATH);
  const logoSrc = `data:image/svg+xml;base64,${logo.toString('base64')}`;

  await render(
    appIcon({ logoSrc, size: 512, logoScale: 0.6 }),
    { width: 512, height: 512 },
    path.join(PUBLIC_DIR, 'icon-512.png')
  );
  await render(
    appIcon({ logoSrc, size: 192, logoScale: 0.6 }),
    { width: 192, height: 192 },
    path.join(PUBLIC_DIR, 'icon-192.png')
  );
  await render(
    appIcon({ logoSrc, size: 180, logoScale: 0.78 }),
    { width: 180, height: 180 },
    path.join(ROOT, 'src/app/apple-icon.png')
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
