#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPpeDriver } from './ppe-browser.mjs';
import { runParticipantsScenario } from './participants-browser.mjs';
import { runPlacesScenario, scrubPlacesError } from './places-browser.mjs';

const runDir = path.resolve(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
const isPpe = run.kind === 'where2meet-ppe-run-v1';
const cleanupOnly = isPpe && process.argv[3] === '--cleanup';
const scenario = run.scenario ?? 'event-lifecycle';
assert(['event-lifecycle', 'participants', 'places-routes'].includes(scenario), 'Unknown verification scenario');
assert(['where2meet-verification-v1', 'where2meet-ppe-run-v1'].includes(run.kind));
assert.equal(run.run_dir, runDir);
if (!cleanupOnly) assert.equal(run.status, 'ready');
const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = require('playwright');
const evidence = path.join(runDir, 'evidence');
const actions = [];
const network = [];
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  ...(cleanupOnly ? { storageState: path.join(runDir, 'runtime/browser-state.json') } : {}) });
const ppe = isPpe ? await createPpeDriver(runDir, run, context, { phase: cleanupOnly ? 'cleanup' : 'verification' }) : null;
const page = await context.newPage();
page.setDefaultTimeout(45000);
if (scenario !== 'places-routes' || cleanupOnly) await page.addLocatorHandler(page.getByText('Skip tutorial', { exact: true }), async () => {
  await page.getByText('Skip tutorial', { exact: true }).click();
  action('Dismiss visible tutorial using Skip tutorial');
});
page.on('response', (res) => {
  const url = new URL(res.url());
  if (url.pathname.startsWith('/api/')) {
    network.push({ method: res.request().method(), origin: url.origin, path: url.pathname, status: res.status() });
  }
});
page.on('pageerror', (error) => errors.push(scrubPlacesError(error.message)));

function action(name, details = {}) {
  actions.push({ at: new Date().toISOString(), name, ...details });
}

async function settleRequests() {
  if (ppe && scenario === 'places-routes') await ppe.settleRequests();
}

async function capture(name, activePage = page) {
  await activePage.screenshot({ path: path.join(evidence, `${name}.png`), fullPage: true });
  await writeFile(path.join(evidence, `${name}.aria.txt`), await activePage.locator('body').ariaSnapshot());
}

async function dismissTutorial(activePage = page) {
  await activePage.keyboard.press('Escape');
  const skip = activePage.getByText('Skip tutorial', { exact: true });
  if (await skip.isVisible()) await skip.click();
}

async function eventRead(eventId) {
  const res = await fetch(`${run.backend_url}/api/events/${eventId}`);
  assert.equal(res.status, 200);
  const event = await res.json();
  return { id: event.id, title: event.title, meetingTime: event.meetingTime,
    publishedVenueId: event.publishedVenueId, publishedAt: event.publishedAt,
    participants: event.participants.map(({ id, name, isOrganizer }) => ({ id, name, isOrganizer })) };
}

async function stored(eventId) {
  if (ppe) return ppe.bridge({ operation: 'stored', event_id: eventId });
  assert.match(eventId, /^[A-Za-z0-9_-]+$/);
  const locationColumns = ['participants', 'places-routes'].includes(scenario) ? ', address, formatted_address, lat, lng, fuzzy_location, color' : '';
  const sql = `SELECT json_build_object(
    'event', (SELECT row_to_json(e) FROM (SELECT id, title, meeting_time, published_at FROM event WHERE id = '${eventId}') e),
    'participants', (SELECT coalesce(json_agg(p), '[]'::json) FROM
      (SELECT id, event_id, name, is_organizer, token_hash IS NOT NULL AS has_credential${locationColumns}
       FROM participant WHERE event_id = '${eventId}' ORDER BY id) p));`;
  return JSON.parse(execFileSync('psql', [run.database_url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim());
}

let result = { status: 'FAIL', feature: scenario, source_commit: run.source_commit,
  frontend_commit: run.frontend_commit,
  scope: ['create without location', 'organizer name', 'reload identity', 'token-only identity recovery', 'edit title', 'shared read-only view', 'delete'],
  backend_mode: run.backend_mode ?? 'source', frontend_mode: 'development',
  not_verified: ['Google Maps', 'participant location', 'routes', 'votes and publishing', 'accounts', 'data import', 'production frontend serving'],
  external_boundary: run.google_keys };

if (cleanupOnly) {
  try {
    await ppe.cleanupOwned(page);
    await settleRequests();
  } catch {
    await writeFile(path.join(evidence, 'ppe-ui-cleanup.json'), JSON.stringify({ status: 'FAIL', error: 'UI cleanup could not prove ownership and deletion' }));
    process.exitCode = 1;
  } finally {
    await ppe.evidence();
    await browser.close();
  }
  process.exit(process.exitCode ?? 0);
}

let stream;
let participantProof;
let placesProof;

try {
  const title = `Verification meeting ${run.run_id.slice(0, 8)}`;
  const editedTitle = `${title} edited`;
  const [initialSession] = await Promise.all([
    page.waitForResponse(res => res.url() === `${run.client_url}/api/auth/session`),
    page.goto(run.client_url, { waitUntil: 'domcontentloaded' }),
  ]);
  assert.equal(initialSession.status(), 401);
  await initialSession.finished();
  action('Open landing page', { url: run.client_url });
  await page.getByRole('textbox', { name: 'Occasion', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Verification organizer');
  await page.getByRole('button', { name: 'Pick a date and time', exact: true }).click();
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('textbox', { name: 'Occasion', exact: true }).inputValue(), title);
  assert.equal(await page.getByRole('textbox', { name: 'Your name', exact: true }).inputValue(), 'Verification organizer');
  await capture('01-create-form');
  action('Enter title, organizer name and selected date/time; leave optional location empty');
  const [created] = await Promise.all([
    page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events` && res.request().method() === 'POST'),
    page.getByRole('button', { name: 'Create Meeting', exact: true }).click(),
  ]);
  assert.equal(created.status(), 201);
  await page.waitForURL(url => url.origin === run.client_url && /^\/meet\/evt_[A-Za-z0-9_]+$/.test(url.pathname), { timeout: 120000 });
  const eventId = new URL(page.url()).pathname.split('/').at(-1);
  assert.match(eventId, /^evt_[A-Za-z0-9_]+$/);
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  await page.locator('.cat-portal').waitFor({ state: 'detached' });
  if (scenario === 'places-routes') {
    const skip = page.getByText('Skip tutorial', { exact: true });
    await skip.click();
    await skip.waitFor({ state: 'hidden' });
    action('Dismiss the first organizer tutorial before any address entry');
  }
  await dismissTutorial();
  if (ppe) await ppe.saveSession();
  await page.getByRole('button', { name: 'Settings', exact: true }).click({ trial: true });
  const afterCreate = await eventRead(eventId);
  assert.equal(afterCreate.title, title);
  assert.equal(afterCreate.participants.length, 1);
  assert.equal(afterCreate.participants[0].name, 'Verification organizer');
  const initialDatabase = await stored(eventId);
  assert.equal(initialDatabase.participants[0].has_credential, true);
  assert.equal(initialDatabase.participants[0].is_organizer, true);
  await writeFile(path.join(evidence, 'created-state.json'), JSON.stringify({ api: afterCreate, database: initialDatabase }, null, 2));
  action('Create Meeting returns 201; transition completes; persisted event and organizer confirmed', { eventId });
  await capture('02-created');
  await settleRequests();

  const [meResponse] = await Promise.all([
    page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}/me`),
    page.reload({ waitUntil: 'domcontentloaded' }),
  ]);
  assert.equal(meResponse.status(), 200);
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  await dismissTutorial();
  action('Reload restores organizer identity via /me with 200');
  await capture('03-reloaded');
  await settleRequests();

  const retainedToken = await page.evaluate((id) => {
    localStorage.removeItem(`organizer_participant_id_${id}`);
    localStorage.removeItem(`participant_id_${id}`);
    return Boolean(localStorage.getItem(`organizer_token_${id}`));
  }, eventId);
  assert.equal(retainedToken, true, 'Use only the token created by the UI; never inject a replacement');
  const [recoveredMe] = await Promise.all([
    page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}/me`),
    page.reload({ waitUntil: 'domcontentloaded' }),
  ]);
  assert.equal(recoveredMe.status(), 200);
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  await dismissTutorial();
  const recoveredId = await page.evaluate((id) => localStorage.getItem(`organizer_participant_id_${id}`), eventId);
  assert.equal(recoveredId, afterCreate.participants[0].id);
  action('Remove cached participant IDs while retaining the UI-issued token; reload repairs the ID from /me');
  await capture('03b-token-only-recovery');

  if (ppe) {
    await ppe.negativeChecks(page, eventId);
    stream = await ppe.watchTitle(page, eventId);
  }

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Event', exact: true }).click();
  await page.getByRole('textbox', { name: 'Event Title', exact: true }).fill(editedTitle);
  await capture('04-edit-form');
  action('Edit Event form receives changed title');
  const [editResponse] = await Promise.all([
    page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}` && res.request().method() === 'PATCH'),
    page.getByRole('button', { name: 'Save Changes', exact: true }).click(),
  ]);
  assert.equal(editResponse.status(), 200);
  await page.getByRole('heading', { name: 'Edit Event', exact: true }).waitFor({ state: 'hidden' });
  const edited = await eventRead(eventId);
  assert.equal(edited.title, editedTitle);
  const editedDatabase = await stored(eventId);
  assert.equal(editedDatabase.event.title, editedTitle);
  await writeFile(path.join(evidence, 'edited-state.json'), JSON.stringify({ api: edited, database: editedDatabase }, null, 2));
  action('Save Changes returns 200; changed title confirmed by API and database');
  if (stream) await stream.verify(editedTitle);

  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  if (ppe) await ppe.guardContext(guestContext);
  const guest = await guestContext.newPage();
  await guest.goto(`${run.client_url}/meet/${eventId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await guest.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
  assert.equal(await guest.getByRole('button', { name: 'Settings', exact: true }).count(), 0);
  await dismissTutorial(guest);
  await capture('05-shared-view', guest);
  action('Open shared link in a fresh browser context; updated title visible and organizer Settings absent');
  await settleRequests();
  await guestContext.close();

  if (['participants', 'places-routes'].includes(scenario)) {
    const scenarioDriver = scenario === 'participants' ? runParticipantsScenario : runPlacesScenario;
    const proof = await scenarioDriver({ page, browser, run, eventId,
      organizerId: afterCreate.participants[0].id, evidence, capture, action,
      adapter: {
        settleRequests,
        guardContext: activeContext => ppe ? ppe.guardContext(activeContext) : Promise.resolve(),
        stored,
        async read(route, { token } = {}) {
          if (ppe) return ppe.read(route, { token });
          const response = await fetch(run.backend_url + route, { headers: token ? { authorization: `Bearer ${token}` } : {},
            redirect: 'error', signal: AbortSignal.timeout(30000) });
          return { status: response.status, body: await response.json() };
        },
        async openStream(id, token, signal) {
          if (ppe) return ppe.openParticipantStream(id, token, signal);
          return fetch(`${run.backend_url}/api/events/${id}/stream`, {
            headers: { authorization: `Bearer ${token}`, origin: run.client_url }, redirect: 'error', signal,
          });
        },
        async checkpoint() {
          if (ppe) {
            await settleRequests();
            await ppe.saveSession();
            await ppe.bridge({ operation: 'postflight' });
          }
        },
      },
    });
    if (scenario === 'participants') participantProof = proof;
    else placesProof = proof;
  }

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
  await page.getByPlaceholder('Type DELETE', { exact: true }).fill('DELETE');
  await capture('06-delete-confirmation');
  await settleRequests();
  action('Confirm deletion of this run’s synthetic event');
  const [deletedResponse] = await Promise.all([
    page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}` && res.request().method() === 'DELETE'),
    page.getByRole('button', { name: 'Delete Event', exact: true }).click(),
  ]);
  assert.equal(deletedResponse.status(), 200);
  await page.waitForURL(run.client_url + '/');
  const removed = await fetch(`${run.backend_url}/api/events/${eventId}`);
  assert.equal(removed.status, 404);
  const deletedDatabase = await stored(eventId);
  assert.equal(deletedDatabase.event, null);
  assert.deepEqual(deletedDatabase.participants, []);
  if (ppe) await ppe.bridge({ operation: 'closed', event_id: eventId });
  await writeFile(path.join(evidence, 'deleted-state.json'), JSON.stringify({ api_status: 404, database: deletedDatabase }, null, 2));
  await capture('07-deleted');
  action('Delete returns 200; link returns 404; event and participant rows removed');
  assert(network.some((entry) => entry.path.endsWith('/me') && entry.status === 200));
  assert(network.filter((entry) => entry.path.startsWith('/api/events')).every((entry) => entry.origin === run.backend_url));
  assert.deepEqual(errors, [], 'Uncaught browser errors invalidate this lifecycle proof');
  if (ppe) {
    await settleRequests();
    ppe.assertGuard();
    result.scope.push('public HTTP invalid input and credential rejection', 'empty vote read', 'anonymous and unknown session reads', 'authenticated SSE heartbeat and title update');
    result.not_verified = ['Google Maps', 'participant location and join', 'routes', 'vote writes and publishing', 'account writes', 'valid and expired imported sessions', 'data import', 'production frontend serving'];
    result.target = run.target;
    result.deployment_check = 'Fresh pre/post checks; HTTP mutation cannot be atomically pinned';
    result.source_provenance = 'Setup-attested uploaded input archive; not independent runtime source identity or Railway transport bytes';
  }
  if (participantProof) {
    result.feature = 'participants';
    result.scope.push(...participantProof.scope);
    result.not_verified = participantProof.not_verified;
  }
  if (placesProof) {
    result.scope.push(...placesProof.scope);
    result.not_verified = placesProof.not_verified;
    result.shared_provider_cache = placesProof.shared_provider_cache;
    result.external_boundary = 'real Google Maps, Places and Directions; no provider fixture';
    if (ppe) result.streaming_api_policy = 'Owned SSE continues without buffering; observed redirects or invalid response headers invalidate proof. Finite API redirects are blocked before forwarding, except validated photos.';
    result.synthetic_cleanup = 'exact UI-created event and participant rows absent; shared provider cache rows are separate';
  }
  result = { ...result, status: 'PASS', event_id: eventId };
} catch (error) {
  result.error = scrubPlacesError(error);
  try { await capture('failure'); } catch {}
  process.exitCode = 1;
} finally {
  if (stream) {
    try { await stream.close(); } catch {
      result.status = 'FAIL';
      result.stream_error = 'Authenticated SSE teardown failed';
      process.exitCode = 1;
    }
  }
  if (ppe) {
    try {
      await ppe.saveSession();
      await ppe.cleanupOwned(page);
    } catch {
      result.status = 'FAIL';
      result.cleanup_error = 'PPE UI cleanup incomplete; exact owned event IDs retained';
      process.exitCode = 1;
    }
    try { await settleRequests(); } catch {
      result.status = 'FAIL';
      result.guard_error = 'PPE request validation did not finish successfully';
      process.exitCode = 1;
    }
    await ppe.evidence();
  }
  await writeFile(path.join(evidence, 'actions.json'), JSON.stringify(actions, null, 2));
  await writeFile(path.join(evidence, 'network.json'), JSON.stringify(network, null, 2));
  await writeFile(path.join(evidence, 'page-errors.json'), JSON.stringify(errors, null, 2));
  try {
    await browser.close();
  } catch (error) {
    result.status = 'FAIL';
    result.error = `Browser teardown failed: ${scrubPlacesError(error)}`;
    process.exitCode = 1;
  }
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
