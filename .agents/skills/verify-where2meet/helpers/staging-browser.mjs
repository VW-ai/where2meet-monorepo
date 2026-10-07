#!/usr/bin/env node
import assert from 'node:assert/strict';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const backend = 'https://where2meet-server-staging.up.railway.app';
const client = 'http://127.0.0.1:4317';
export async function parseArgs(args) {
  const names = ['backend-origin', 'client-origin', 'backend-sha', 'frontend-sha', 'deployment-id', 'run-dir', 'run-id'];
  const config = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.slice(2);
    assert(args[i]?.startsWith('--') && names.includes(key) && !Object.hasOwn(config, key) && args[i + 1], 'Invalid arguments');
    config[key] = args[i + 1];
  }
  assert(names.every(name => config[name]), 'Missing arguments');
  assert.equal(config['backend-origin'], backend, 'Invalid backend origin');
  assert.equal(config['client-origin'], client, 'Invalid client origin');
  for (const name of ['backend-sha', 'frontend-sha']) assert.match(config[name], /^[0-9a-f]{40}$/i, 'Invalid SHA');
  assert.match(config['deployment-id'], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid deployment ID');
  assert.match(config['run-id'], /^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/, 'Invalid run ID');
  assert(path.isAbsolute(config['run-dir']), 'Run directory must be absolute');
  const stat = await lstat(config['run-dir']);
  assert(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && stat.uid === process.getuid(), 'Run directory must be private and owned');
  assert.equal(await realpath(config['run-dir']), config['run-dir'], 'Run directory must not contain symlinks');
  return config;
}
async function request(url, options = {}) {
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
}
export async function cleanupOwned(receipt, send = request) {
  if (!receipt) return { status: 'PASS', owned_event: false, absent: true };
  assert.match(receipt.event_id, /^evt_[A-Za-z0-9_]+$/);
  assert.match(receipt.participant_token, /^pt_[0-9a-f]{64}$/);
  const url = `${backend}/api/events/${receipt.event_id}`;
  let deletion;
  try { deletion = (await send(url, { method: 'DELETE', headers: { authorization: `Bearer ${receipt.participant_token}` } })).status; } catch {}
  try {
    const status = (await send(url)).status;
    return { status: status === 404 ? 'PASS' : 'FAIL', owned_event: true, delete_status: deletion ?? null, get_status: status, absent: status === 404 };
  } catch { return { status: 'FAIL', owned_event: true, delete_status: deletion ?? null, absent: false }; }
}
async function evidenceDirectory(dir) {
  const evidenceDir = path.join(dir, 'evidence');
  await mkdir(evidenceDir, { mode: 0o700, recursive: true });
  const stat = await lstat(evidenceDir);
  assert(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0, 'Evidence directory must be private');
  return evidenceDir;
}
export async function run(config) {
  const dir = config['run-dir'];
  const evidenceDir = await evidenceDirectory(dir);
  const identity = { backend_sha: config['backend-sha'], frontend_sha: config['frontend-sha'], deployment_id: config['deployment-id'], run_id: config['run-id'], backend_origin: backend, client_origin: client };
  const save = (name, value, exclusive = false) => writeFile(path.join(name === 'receipt.json' ? dir : evidenceDir, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: exclusive ? 'wx' : 'w' });
  await save('result.json', { status: 'RUNNING', run_id: config['run-id'] }, true);
  let receipt, browser, failure, stage = 'readiness';
  const steps = [];
  let guardFailure = false;
  try {
    const readiness = await request(`${backend}/health/ready`, { headers: { 'cache-control': 'no-store' } });
    assert.equal(readiness.status, 200);
    assert.equal((await readiness.json()).deploymentId, config['deployment-id']);
    stage = 'cors';
    const cors = await request(`${backend}/api/events`, { method: 'OPTIONS', headers: { origin: client, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,authorization' } });
    assert.equal(cors.status, 204);
    assert.equal(cors.headers.get('access-control-allow-origin'), client);
    assert.equal(cors.headers.get('access-control-allow-credentials'), 'true');
    assert(cors.headers.get('access-control-allow-methods')?.split(',').map(s => s.trim()).includes('POST'));
    const headers = cors.headers.get('access-control-allow-headers')?.toLowerCase().split(',').map(s => s.trim()).sort();
    assert.deepEqual(headers, ['authorization', 'content-type']);
    stage = 'browser_start';
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    async function context() {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
      await ctx.route('**/*', async route => {
        try {
          const req = route.request();
          const url = new URL(req.url());
          assert(!req.redirectedFrom(), 'Redirect blocked');
          assert(url.origin === client || url.origin === backend, 'Destination blocked');
          if (url.origin === backend) assert(url.pathname.startsWith('/api/'), 'Backend destination blocked');
          if (url.pathname.startsWith('/api/') && req.method() === 'POST' && url.pathname === '/api/events') {
            assert(!receipt, 'Duplicate create blocked');
            const response = await route.fetch({ maxRedirects: 0 });
            assert(response.status() < 300 || response.status() >= 400, 'Redirect blocked');
            if (response.status() === 201) {
              const body = await response.json();
              assert.match(body.id, /^evt_[A-Za-z0-9_]+$/);
              assert.match(body.participantToken, /^pt_[0-9a-f]{64}$/);
              receipt = { event_id: body.id, participant_token: body.participantToken };
              await save('receipt.json', receipt, true);
            }
            await route.fulfill({ response });
          } else await route.continue();
        } catch { guardFailure = true; await route.abort(); }
      });
      return ctx;
    }
    const ctx = await context();
    const page = await ctx.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', () => { guardFailure = true; });
    page.on('response', response => { if (response.status() >= 300 && response.status() < 400) guardFailure = true; });
    await page.addLocatorHandler(page.getByText('Skip tutorial', { exact: true }), async () => page.getByText('Skip tutorial', { exact: true }).click());
    const title = `Staging verification ${config['run-id']}`;
    await page.goto(client, { waitUntil: 'domcontentloaded' });
    stage = 'create';
    await page.getByRole('textbox', { name: 'Occasion', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Verification organizer');
    await page.getByRole('button', { name: 'Pick a date and time', exact: true }).click();
    await page.getByRole('button', { name: '09:00', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Create Meeting', exact: true }).click();
    await page.waitForURL(url => url.pathname === `/meet/${receipt?.event_id}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
    steps.push('landing_create_without_location');
    stage = 'reload_identity';
    const [identity] = await Promise.all([page.waitForResponse(res => new URL(res.url()).pathname === `/api/events/${receipt.event_id}/me`), page.reload()]);
    assert.equal(identity.status(), 200);
    await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
    steps.push('reload_identity');
    stage = 'edit_title';
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Event', exact: true }).click();
    await page.getByRole('textbox', { name: 'Event Title', exact: true }).fill(`${title} edited`);
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.getByRole('heading', { name: `${title} edited`, exact: true, level: 1 }).waitFor();
    steps.push('edit_title');
    stage = 'shared_view';
    const guestContext = await context();
    const guest = await guestContext.newPage();
    await guest.goto(`${client}/meet/${receipt.event_id}`);
    await guest.getByRole('heading', { name: `${title} edited`, exact: true, level: 1 }).waitFor();
    assert.equal(await guest.getByRole('button', { name: 'Settings', exact: true }).count(), 0);
    steps.push('fresh_context_shared_view');
    stage = 'ui_delete';
    await guestContext.close();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
    await page.getByPlaceholder('Type DELETE', { exact: true }).fill('DELETE');
    const [deleted] = await Promise.all([page.waitForResponse(res => res.request().method() === 'DELETE' && new URL(res.url()).pathname === `/api/events/${receipt.event_id}`), page.getByRole('button', { name: 'Delete Event', exact: true }).click()]);
    assert.equal(deleted.status(), 200);
    await page.waitForURL(client + '/');
    steps.push('ui_delete');
    assert.equal(guardFailure, false);
  } catch { failure = stage; }
  finally {
    try { await browser?.close(); } catch { failure ??= 'browser_teardown'; }
    const cleanup = await cleanupOwned(receipt);
    await save('cleanup.json', { ...cleanup, identity });
    const expectedSteps = ['landing_create_without_location', 'reload_identity', 'edit_title', 'fresh_context_shared_view', 'ui_delete'];
    const result = { identity, status: !failure && cleanup.status === 'PASS' && expectedSteps.every((step, index) => steps[index] === step) && steps.length === expectedSteps.length ? 'PASS' : 'FAIL', run_id: config['run-id'], backend_sha: config['backend-sha'], frontend_sha: config['frontend-sha'], deployment_id: config['deployment-id'], steps, failure_stage: failure ?? null, cleanup_complete: cleanup.status === 'PASS', scope: 'No-location event lifecycle against staging with local frontend' };
    await save('result.json', result);
    return result;
  }
}
export async function cleanupSaved(config, send = request) {
  const dir = config['run-dir'];
  const evidenceDir = await evidenceDirectory(dir);
  let receipt;
  try { receipt = JSON.parse(await readFile(path.join(dir, 'receipt.json'), 'utf8')); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const identity = { backend_sha: config['backend-sha'], frontend_sha: config['frontend-sha'], deployment_id: config['deployment-id'], run_id: config['run-id'], backend_origin: backend, client_origin: client };
  const cleanup = await cleanupOwned(receipt, send);
  await writeFile(path.join(evidenceDir, 'cleanup.json'), JSON.stringify({ ...cleanup, identity }, null, 2) + '\n', { mode: 0o600 });
  return cleanup;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const cleanupOnly = process.argv[2] === 'cleanup';
    const config = await parseArgs(process.argv.slice(cleanupOnly ? 3 : 2));
    const result = cleanupOnly ? await cleanupSaved(config) : await run(config);
    console.log(JSON.stringify(cleanupOnly ? { status: result.status, absent: result.absent } : result));
    process.exitCode = result.status === 'PASS' ? 0 : 1;
  }
  catch { console.error('Staging verification rejected arguments or private evidence setup'); process.exitCode = 1; }
}
