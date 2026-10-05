#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

assert(process.argv.length === 3 && path.isAbsolute(process.argv[2]),
  'Supply the absolute local verification run directory');
const runDir = await realpath(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.kind, 'where2meet-verification-v1', 'Component fixtures cannot run against PPE');
assert.equal(await realpath(run.run_dir), runDir);
assert.equal(run.status, 'ready');
assert.match(run.run_id, /^[0-9a-f]{32}$/);
const app = await realpath(run.source_copy);
assert.equal(app, path.join(runDir, 'runtime/app'), 'Use only this run’s owned source copy');
const driver = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const source = createRequire(path.join(app, 'server/package.json'));
const { chromium } = driver('playwright');
const { build } = source('esbuild');
const client = path.join(app, 'client');
const settings = path.join(client, 'src/app/dashboard/settings/page.tsx');
const authStore = path.join(client, 'src/features/auth/model/auth-store.ts');
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const result = {
  status: 'FAIL',
  kind: 'component-fault-fixture',
  feature: 'accounts-ui-races',
  source_commit: run.source_commit,
  frontend_commit: run.frontend_commit,
  settings_sha256: await digest(settings),
  auth_store_sha256: await digest(authStore),
  actual: ['SettingsPage', 'auth-store', 'authClient', 'userClient'],
  fixtures: ['Next Link/Image and SVG facades', 'Address/geocoding facades',
    'Pending profile fetch cancelled by logout', 'Logout fetch returns 500, then 200'],
  not_verified: ['Real backend', 'PPE', 'HTTP cookies', 'Google Maps', 'Dashboard and UserMenu'],
  checks: [],
  page_errors: [],
  blocked_network: [],
};
let browser;
let scratch;
try {
  scratch = await mkdtemp(path.join(runDir, 'runtime/account-ui-races-'));
  const entry = path.join(scratch, 'entry.jsx');
  await writeFile(entry, `
import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPage from ${JSON.stringify(settings)};
import { useAuthStore } from ${JSON.stringify(authStore)};
window.fixture = {
  profileStarted: false, profileAborted: false, logoutCount: 0,
  account: () => ({ id: useAuthStore.getState().user?.id ?? null,
    authenticated: useAuthStore.getState().isAuthenticated }),
};
window.fetch = async (url, options = {}) => {
  if (url === '/api/users/me' && options.method === 'PATCH') {
    window.fixture.profileStarted = true;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      window.fixture.profileAborted = true;
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true }));
  }
  if (url === '/api/auth/logout' && options.method === 'POST') {
    window.fixture.logoutCount++;
    return new Response(JSON.stringify(window.fixture.logoutCount === 1
      ? { error: { code: 'INTERNAL_ERROR', message: 'Synthetic logout failure' } }
      : { success: true }), {
      status: window.fixture.logoutCount === 1 ? 500 : 200,
      headers: { 'content-type': 'application/json' },
    });
  }
  throw new Error('Unexpected component-fixture fetch: ' + options.method + ' ' + url);
};
useAuthStore.getState().setUser({
  id: 'A', email: 'a@example.test', name: 'Original A', avatarUrl: null,
  emailVerified: false, defaultAddress: null, defaultPlaceId: null,
  defaultFuzzyLocation: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});
createRoot(document.getElementById('root')).render(<SettingsPage />);
`);
  const facades = {
    'next/link': 'import React from "react"; export default ({children, ...props}) => <a {...props}>{children}</a>;',
    'next/image': 'import React from "react"; export default ({priority, ...props}) => <img {...props} />;',
    '@/shared/ui/address-autocomplete': 'export const AddressAutocomplete = () => null;',
    '@/shared/lib/google-maps/geocoding': 'export const reverseGeocode = async () => null;',
  };
  await build({
    entryPoints: [entry], outfile: path.join(scratch, 'bundle.js'), bundle: true,
    platform: 'browser', format: 'iife', jsx: 'automatic',
    nodePaths: [path.join(client, 'node_modules')], alias: { '@': path.join(client, 'src') },
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'development' }) },
    plugins: [{ name: 'explicit-component-facades', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => Object.hasOwn(facades, args.path)
        ? { path: args.path, namespace: 'facade' } : undefined);
      builder.onResolve({ filter: /\.svg$/ }, args => ({ path: args.path, namespace: 'svg' }));
      builder.onLoad({ filter: /.*/, namespace: 'facade' }, args => ({
        contents: facades[args.path], loader: 'jsx', resolveDir: client,
      }));
      builder.onLoad({ filter: /.*/, namespace: 'svg' }, () => ({
        contents: 'export default "data:image/svg+xml,%3Csvg/%3E";', loader: 'js',
      }));
    } }],
  });
  await writeFile(path.join(scratch, 'index.html'),
    '<div id="root"></div><script src="./bundle.js"></script>');
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route(/^https?:\/\//, async route => {
    result.blocked_network.push(new URL(route.request().url()).origin);
    await route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => result.page_errors.push(error.message));
  await page.goto(pathToFileURL(path.join(scratch, 'index.html')).href);
  await page.getByLabel('Name', { exact: true }).fill('Edited A');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.waitForFunction(() => window.fixture.profileStarted);
  await page.getByRole('button', { name: 'Saving...', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.waitForFunction(() => window.fixture.profileAborted && window.fixture.logoutCount === 1);
  assert.deepEqual(await page.evaluate(() => window.fixture.account()), { id: 'A', authenticated: true });
  result.checks.push('Aborted profile request and failed logout retain account A');
  await page.getByText('Failed to sign out. Please try again.', { exact: true }).waitFor();
  result.checks.push('Logout failure is visible to the user');
  const save = page.getByRole('button', { name: 'Save Changes', exact: true });
  await save.click({ trial: true });
  assert.equal(await save.isDisabled(), false);
  result.checks.push('Cancelled profile save releases its busy button');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.waitForFunction(() => window.fixture.logoutCount === 2 && window.fixture.account().id === null);
  assert.deepEqual(await page.evaluate(() => window.fixture.account()), { id: null, authenticated: false });
  await page.getByText('Failed to sign out. Please try again.', { exact: true }).waitFor({ state: 'hidden' });
  result.checks.push('Retrying logout succeeds and clears the visible error');
  assert.deepEqual(result.page_errors, [], 'Component produced uncaught errors');
  assert.deepEqual(result.blocked_network, [], 'Component attempted real network access');
  result.checks.push('No uncaught errors or real network requests');
  result.status = 'PASS';
} catch (error) {
  result.error = error.message;
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    if (scratch) await rm(scratch, { recursive: true, force: true });
    await writeFile(path.join(runDir, 'evidence/accounts-ui-races.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
}
