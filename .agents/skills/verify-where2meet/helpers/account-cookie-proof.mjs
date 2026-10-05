#!/usr/bin/env node
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { sessionCookiesForOrigin } from './ppe-accounts-browser.mjs';

assert(process.argv.length === 3 && path.isAbsolute(process.argv[2]),
  'Supply the absolute local verification run directory');
const runDir = await realpath(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.kind, 'where2meet-verification-v1', 'Cookie transport fixtures cannot target PPE');
assert.equal(await realpath(run.run_dir), runDir);
assert.equal(run.status, 'ready');
assert.match(run.run_id, /^[0-9a-f]{32}$/);
const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = require('playwright');
const token = `st_${randomBytes(32).toString('hex')}`;
const result = {
  status: 'FAIL', kind: 'synthetic-local-transport-fixture', feature: 'accounts-cookie-proof',
  source_commit: run.source_commit, frontend_commit: run.frontend_commit,
  scope: 'Fresh Chrome and ephemeral HTTP 127.0.0.1 server; synthetic Secure session cookie',
  not_verified: ['Real account authentication', 'PPE', 'Production', 'Cookie selector contamination'],
  checks: [], page_errors: [], blocked_network: [],
};
const scrub = value => String(value).replaceAll(token, '[synthetic cookie redacted]')
  .replace(/\bst_[A-Za-z0-9._-]+/g, '[session cookie redacted]');
const metadata = cookie => ({
  name: cookie.name, domain: cookie.domain, path: cookie.path,
  secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite,
});
const server = createServer((request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html',
      'Set-Cookie': `session_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/`,
    });
    response.end('<!doctype html><title>Local cookie transport fixture</title>');
  } else if (request.method === 'GET' && request.url === '/echo') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ cookie_matches: request.headers.cookie === `session_token=${token}` }));
  } else {
    response.writeHead(404);
    response.end();
  }
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route(/^https?:\/\//, async route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    result.blocked_network.push('[outside owned loopback origin]');
    await route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => result.page_errors.push(scrub(error.message)));
  assert.equal((await page.goto(origin)).status(), 200);
  const browserEcho = await page.evaluate(async () => {
    const response = await fetch('/echo');
    return { status: response.status, ...await response.json() };
  });
  assert.deepEqual(browserEcho, { status: 200, cookie_matches: true });
  result.checks.push('Real Chrome sends the Secure cookie over its trusted loopback origin');
  const jar = await context.cookies();
  assert.equal(jar.length, 1);
  const expected = { name: 'session_token', domain: '127.0.0.1', path: '/',
    secure: true, httpOnly: true, sameSite: 'Lax' };
  assert.deepEqual(metadata(jar[0]), expected);
  assert(jar[0].value === token, 'Chrome must store the cookie issued by the local server');
  result.checks.push('Stored cookie retains Secure, HttpOnly, SameSite=Lax and Path=/');
  const selected = await sessionCookiesForOrigin(context, origin);
  assert.equal(selected.length, 1);
  assert(selected[0].value === token, 'Selector must return the actual stored session value');
  assert.deepEqual(metadata(selected[0]), expected);
  result.checks.push('Shared selector retrieves the actual stored session cookie without changing flags');
  const apiEcho = await context.request.get(`${origin}/echo`, {
    headers: { cookie: selected.map(cookie => `${cookie.name}=${cookie.value}`).join('; ') },
    maxRedirects: 0, timeout: 7000,
  });
  assert.equal(apiEcho.status(), 200);
  assert.deepEqual(await apiEcho.json(), { cookie_matches: true });
  assert.deepEqual((await context.cookies()).map(metadata), [expected]);
  result.checks.push('Explicit APIRequestContext Cookie reaches the same server with flags unchanged');
  assert.deepEqual(result.page_errors, []);
  assert.deepEqual(result.blocked_network, []);
  result.cookie_metadata = expected;
  result.status = 'PASS';
} catch (error) {
  result.error = scrub(error.message);
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } catch (error) {
    result.status = 'FAIL';
    result.cleanup_error = scrub(error.message);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await writeFile(path.join(runDir, 'evidence/accounts-cookie-proof.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
}
