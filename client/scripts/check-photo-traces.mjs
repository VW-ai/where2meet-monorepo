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
