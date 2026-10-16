#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const runDir = path.resolve(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.kind, 'where2meet-verification-v1');
assert.equal(run.run_dir, runDir);
assert.equal(run.status, 'ready');
const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = require('playwright');
const evidence = path.join(runDir, 'evidence');
const actions = [];
const network = [];
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(45000);
await page.addLocatorHandler(page.getByText('Skip tutorial', { exact: true }), async () => {
  await page.getByText('Skip tutorial', { exact: true }).click();
  action('Dismiss visible tutorial using Skip tutorial');
});
page.on('response', (res) => {
  const url = new URL(res.url());
  if (url.pathname.startsWith('/api/')) {
    network.push({ method: res.request().method(), origin: url.origin, path: url.pathname, status: res.status() });
  }
});
page.on('pageerror', (error) => errors.push(error.message.replace(/https?:\/\/\S+/g, '[url removed]')));

function action(name, details = {}) {
  actions.push({ at: new Date().toISOString(), name, ...details });
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

function stored(eventId) {
  assert.match(eventId, /^[A-Za-z0-9_-]+$/);
  const sql = `SELECT json_build_object(
    'event', (SELECT row_to_json(e) FROM (SELECT id, title, meeting_time, published_at FROM event WHERE id = '${eventId}') e),
    'participants', (SELECT coalesce(json_agg(p), '[]'::json) FROM
      (SELECT id, event_id, name, is_organizer, token_hash IS NOT NULL AS has_credential
       FROM participant WHERE event_id = '${eventId}') p));`;
  return JSON.parse(execFileSync('psql', [run.database_url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' }).trim());
}

let result = { status: 'FAIL', feature: 'event-lifecycle', source_commit: run.source_commit,
  scope: ['create without location', 'organizer name', 'reload identity', 'edit title', 'shared read-only view', 'delete'],
  not_verified: ['Google Maps', 'participant location', 'routes', 'votes and publishing', 'accounts', 'data import', 'production build'],
  external_boundary: run.google_keys };

try {
  const title = `Verification meeting ${run.run_id.slice(0, 8)}`;
  const editedTitle = `${title} edited`;
  await page.goto(run.client_url, { waitUntil: 'domcontentloaded' });
  action('Open landing page', { url: run.client_url });
  await page.getByRole('textbox', { name: 'Occasion', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Verification organizer');
  await page.getByRole('button', { name: 'Pick a date and time', exact: true }).click();
  await page.getByRole('button', { name: '09:00', exact: true }).click();
  await page.keyboard.press('Escape');
  await capture('01-create-form');
  action('Enter title, organizer name and selected date/time; leave optional location empty');
  const createdResponse = page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events` && res.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create Meeting', exact: true }).click();
  const created = await createdResponse;
  assert.equal(created.status(), 201);
  const eventId = (await created.json()).id;
  assert.match(eventId, /^evt_[A-Za-z0-9_]+$/);
  await page.waitForURL(`${run.client_url}/meet/${eventId}`, { timeout: 120000 });
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  await page.locator('.cat-portal').waitFor({ state: 'detached' });
  await dismissTutorial();
  await page.getByRole('button', { name: 'Settings', exact: true }).click({ trial: true });
  const afterCreate = await eventRead(eventId);
  assert.equal(afterCreate.title, title);
  assert.equal(afterCreate.participants.length, 1);
  assert.equal(afterCreate.participants[0].name, 'Verification organizer');
  const initialDatabase = stored(eventId);
  assert.equal(initialDatabase.participants[0].has_credential, true);
  assert.equal(initialDatabase.participants[0].is_organizer, true);
  await writeFile(path.join(evidence, 'created-state.json'), JSON.stringify({ api: afterCreate, database: initialDatabase }, null, 2));
  action('Create Meeting returns 201; transition completes; persisted event and organizer confirmed', { eventId });
  await capture('02-created');

  const meResponse = page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}/me`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal((await meResponse).status(), 200);
  await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
  await dismissTutorial();
  action('Reload restores organizer identity via /me with 200');
  await capture('03-reloaded');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Event', exact: true }).click();
  await page.getByRole('textbox', { name: 'Event Title', exact: true }).fill(editedTitle);
  await capture('04-edit-form');
  action('Edit Event form receives changed title');
  const editResponse = page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}` && res.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  assert.equal((await editResponse).status(), 200);
  await page.getByRole('heading', { name: 'Edit Event', exact: true }).waitFor({ state: 'hidden' });
  const edited = await eventRead(eventId);
  assert.equal(edited.title, editedTitle);
  const editedDatabase = stored(eventId);
  assert.equal(editedDatabase.event.title, editedTitle);
  await writeFile(path.join(evidence, 'edited-state.json'), JSON.stringify({ api: edited, database: editedDatabase }, null, 2));
  action('Save Changes returns 200; changed title confirmed by API and database');

  const guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const guest = await guestContext.newPage();
  await guest.goto(`${run.client_url}/meet/${eventId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await guest.getByRole('heading', { name: editedTitle, exact: true, level: 1 }).waitFor();
  assert.equal(await guest.getByRole('button', { name: 'Settings', exact: true }).count(), 0);
  await dismissTutorial(guest);
  await capture('05-shared-view', guest);
  action('Open shared link in a fresh browser context; updated title visible and organizer Settings absent');
  await guestContext.close();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
  await page.getByPlaceholder('Type DELETE', { exact: true }).fill('DELETE');
  await capture('06-delete-confirmation');
  action('Confirm deletion of this run’s synthetic event');
  const deletedResponse = page.waitForResponse((res) => res.url() === `${run.backend_url}/api/events/${eventId}` && res.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
  assert.equal((await deletedResponse).status(), 200);
  await page.waitForURL(run.client_url + '/');
  const removed = await fetch(`${run.backend_url}/api/events/${eventId}`);
  assert.equal(removed.status, 404);
  const deletedDatabase = stored(eventId);
  assert.equal(deletedDatabase.event, null);
  assert.deepEqual(deletedDatabase.participants, []);
  await writeFile(path.join(evidence, 'deleted-state.json'), JSON.stringify({ api_status: 404, database: deletedDatabase }, null, 2));
  await capture('07-deleted');
  action('Delete returns 200; link returns 404; event and participant rows removed');
  assert(network.some((entry) => entry.path.endsWith('/me') && entry.status === 200));
  assert(network.filter((entry) => entry.path.startsWith('/api/events')).every((entry) => entry.origin === run.backend_url));
  assert.deepEqual(errors, [], 'Uncaught browser errors invalidate this lifecycle proof');
  result = { ...result, status: 'PASS', event_id: eventId };
} catch (error) {
  result.error = String(error).replace(/https?:\/\/\S+/g, '[url removed]');
  try { await capture('failure'); } catch {}
  process.exitCode = 1;
} finally {
  await writeFile(path.join(evidence, 'actions.json'), JSON.stringify(actions, null, 2));
  await writeFile(path.join(evidence, 'network.json'), JSON.stringify(network, null, 2));
  await writeFile(path.join(evidence, 'page-errors.json'), JSON.stringify(errors, null, 2));
  try {
    await browser.close();
  } catch (error) {
    result.status = 'FAIL';
    result.error = `Browser teardown failed: ${String(error)}`;
    process.exitCode = 1;
  }
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
