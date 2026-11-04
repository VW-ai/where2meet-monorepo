// Fails the build when a server function's file trace bundles the blog photos, which
// outputFileTracingExcludes in next.config.js keeps out.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SERVER_DIR = path.join('.next', 'server');

const bundling = readdirSync(SERVER_DIR, { recursive: true, encoding: 'utf8' }).filter(
  (name) =>
    name.endsWith('.nft.json') &&
    JSON.parse(readFileSync(path.join(SERVER_DIR, name), 'utf8')).files.some((file) =>
      file.includes('public/blog/images/')
    )
);

if (bundling.length > 0) {
  console.error(`These server traces bundle public/blog/images:\n${bundling.join('\n')}`);
  process.exitCode = 1;
}

// The invitation image reads these from disk at request time, and the trace can't see paths
// built from process.cwd(), so next.config.js lists them in outputFileTracingIncludes.
const INVITE_TRACE = path.join(SERVER_DIR, 'app/meet/[id]/invite.png/route.js.nft.json');
const traced = JSON.parse(readFileSync(INVITE_TRACE, 'utf8')).files;
const missing = [
  'src/components/cat/logo.svg',
  '@fontsource/inter/files/inter-latin-400-normal.woff',
  '@fontsource/inter/files/inter-latin-600-normal.woff',
  '@fontsource/inter/files/inter-latin-700-normal.woff',
  '@fontsource/inter/files/inter-latin-800-normal.woff',
  '@fontsource/anton/files/anton-latin-400-normal.woff',
  '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
].filter((file) => !traced.some((entry) => entry.endsWith(file)));

if (missing.length > 0) {
  console.error(`The invitation image's trace is missing:\n${missing.join('\n')}`);
  process.exitCode = 1;
}
