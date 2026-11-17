/**
 * Generate the app icons from the cat logo.
 *
 * Outputs:
 *   - public/icon-192.png     192x192  PWA icon (white background, maskable-safe)
 *   - public/icon-512.png     512x512  PWA icon (white background, maskable-safe)
 *   - src/app/apple-icon.png  180x180  Apple touch icon
 *   - src/app/favicon.ico     16, 32 and 48 px, the cat in a white circle like the site header
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

/** Favicon: the white circle the site header draws behind the logo, so it shows on dark tabs too. */
function faviconIcon({ logoSrc, size }) {
  const logoSize = Math.round(size * 0.75);
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        backgroundColor: '#FFFFFF',
      },
    },
    h('img', { src: logoSrc, width: logoSize, height: logoSize, style: { objectFit: 'contain' } })
  );
}

async function png(element, { width, height }) {
  const response = new ImageResponse(element, { width, height });
  return Buffer.from(await response.arrayBuffer());
}

async function write(outFile, buffer, label) {
  await writeFile(outFile, buffer);
  console.log(`wrote ${path.relative(ROOT, outFile)} (${label}, ${buffer.length} bytes)`);
}

async function render(element, { width, height }, outFile) {
  await write(outFile, await png(element, { width, height }), `${width}x${height}`);
}

/** An ICO file whose images are PNGs, which every current browser reads. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
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

  const sizes = [16, 32, 48];
  const favicons = await Promise.all(
    sizes.map(async (size) => ({
      size,
      data: await png(faviconIcon({ logoSrc, size }), { width: size, height: size }),
    }))
  );
  await write(path.join(ROOT, 'src/app/favicon.ico'), ico(favicons), sizes.join(', '));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
