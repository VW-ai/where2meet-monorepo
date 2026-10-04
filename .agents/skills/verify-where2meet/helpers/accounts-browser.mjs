#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

assert(process.argv[2], 'Supply the absolute verification run directory');
const runDir = path.resolve(process.argv[2]);
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.kind, 'where2meet-verification-v1');
assert.equal(run.run_dir, runDir);
assert.equal(run.status, 'ready');
const doctor = JSON.parse(await readFile(path.join(runDir, 'evidence/doctor.json'), 'utf8'));
assert.equal(doctor.status, 'PASS', 'Run doctor before this browser driver');
const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = require('playwright');
const evidence = path.join(runDir, 'evidence');
const psql = existsSync('/opt/homebrew/opt/postgresql@14/bin/psql')
  ? '/opt/homebrew/opt/postgresql@14/bin/psql' : 'psql';
const account = {
  email: `verify-accounts-${Date.now()}-${randomBytes(4).toString('hex')}@example.test`,
  password: `Verify-${randomBytes(24).toString('hex')}!`,
  name: 'Verification account',
  updatedName: 'Verification renamed account',
};
let title = `Account verification ${run.run_id.slice(0, 8)} ${Date.now()}`;
const actions = [];
const network = [];
const pageErrors = [];
const consoleErrors = [];
const result = {
  status: 'FAIL',
  feature: 'accounts-claims-baseline',
  source_commit: run.source_commit,
  frontend_commit: run.frontend_commit,
  backend_mode: run.backend_mode,
  schema_mode: run.schema_mode,
  checks: [],
  observations: [],
  scope: [],
  not_verified: [
    'Participant claims after joining', 'Manual claim banner',
    'Default address and geolocation', 'Application of fuzzy preference when joining',
    'Password validation', 'Password recovery', 'External identities',
    'Settings and landing signout entry points', 'Cross-device organizer mutations',
    'Phone layouts', 'Historical data migration', 'Production build',
  ],
};
let browser;
let page;
let other;

function scrub(value) {
  return String(value)
    .replaceAll(account.password, '[password redacted]')
    .replaceAll(account.email, '[synthetic email redacted]')
    .replace(/\b(?:pt_|st_|ot_)[A-Za-z0-9._-]+/g, '[credential redacted]')
    .replace(/AIza[A-Za-z0-9_-]+/g, '[Google key redacted]')
    .replace(/https?:\/\/\S+/g, '[url removed]');
}

const save = (name, value) => writeFile(
  path.join(evidence, `accounts-${name}.json`),
  JSON.stringify(value, null, 2),
);

function action(name, details = {}) {
  actions.push({ at: new Date().toISOString(), name, ...details });
  console.log(name);
}

async function check(name, work, { fatal = true } = {}) {
  try {
    const detail = await work();
    result.checks.push({ name, status: 'PASS', ...detail });
    result.scope.push(name);
    action(name, { status: 'PASS' });
  } catch (error) {
    result.checks.push({ name, status: 'FAIL', error: scrub(error.stack || error) });
    action(name, { status: 'FAIL' });
    if (fatal) throw error;
  }
}

function responseFor(current, pathname, method, timeout = 45000) {
  const promise = current.waitForResponse(response =>
    new URL(response.url()).pathname === pathname && response.request().method() === method,
    { timeout },
  );
  promise.catch(() => {});
  return promise;
}

async function newPage(name) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce',
  });
  const current = await context.newPage();
  current.setDefaultTimeout(45000);
  current.setDefaultNavigationTimeout(120000);
  await current.addLocatorHandler(current.getByText('Skip tutorial', { exact: true }),
    async () => current.getByText('Skip tutorial', { exact: true }).click());
  current.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) {
      network.push({ browser: name, method: response.request().method(),
        origin: url.origin, path: url.pathname, status: response.status() });
    }
  });
  current.on('pageerror', error => pageErrors.push({ browser: name, message: scrub(error.message) }));
  current.on('console', message => {
    if (message.type() === 'error') consoleErrors.push({ browser: name, message: scrub(message.text()) });
  });
  return current;
}

async function capture(name, current = page) {
  await current.screenshot({
    path: path.join(evidence, `accounts-${name}.png`), fullPage: true,
    mask: [current.locator('input[type="password"], input[type="email"]'),
      current.getByText(account.email, { exact: true })],
  });
  await writeFile(path.join(evidence, `accounts-${name}.aria.txt`),
    scrub(await current.locator('body').ariaSnapshot()));
}

async function navigate(current, pathname, sessionStatus) {
  const session = responseFor(current, '/api/auth/session', 'GET');
  await current.goto(`${run.client_url}${pathname}`, { waitUntil: 'domcontentloaded' });
  const response = await session;
  assert.equal(response.status(), sessionStatus);
  return response;
}

async function cookieMetadata(current) {
  return (await current.context().cookies(run.client_url)).map(cookie => ({
    name: cookie.name, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite,
    secure: cookie.secure, path: cookie.path, expires: cookie.expires,
  }));
}

function stored({ eventId, userId = null, expectedName = account.name }) {
  assert.match(eventId, /^evt_[A-Za-z0-9_]+$/);
  if (userId) assert.match(userId, /^usr_[A-Za-z0-9_]+$/);
  assert([account.name, account.updatedName].includes(expectedName));
  const userWhere = userId ? `id = '${userId}'` : 'false';
  const linkWhere = userId ? `user_id = '${userId}' AND event_id = '${eventId}'` : 'false';
  const sql = `SELECT json_build_object(
    'event_exists', EXISTS(SELECT 1 FROM event WHERE id = '${eventId}'),
    'participants', (SELECT coalesce(json_agg(p), '[]'::json) FROM
      (SELECT id, is_organizer, token_hash IS NOT NULL AS has_credential,
        lat IS NULL AND lng IS NULL AS has_no_location
        FROM participant WHERE event_id = '${eventId}') p),
    'user', (SELECT row_to_json(u) FROM
      (SELECT id, name = '${expectedName}' AS name_matches,
        default_fuzzy_location, default_address IS NULL AS has_no_default_address
        FROM "user" WHERE ${userWhere}) u),
    'links', (SELECT coalesce(json_agg(l), '[]'::json) FROM
      (SELECT event_id, user_id, participant_id, role FROM user_event WHERE ${linkWhere}) l),
    'identities', (SELECT coalesce(json_agg(i), '[]'::json) FROM
      (SELECT id, user_id, provider,
        password_hash IS NOT NULL AND length(password_hash) > 0 AS has_password_hash
        FROM user_identity WHERE ${userId ? `user_id = '${userId}'` : 'false'}) i),
    'sessions', (SELECT coalesce(json_agg(s), '[]'::json) FROM
      (SELECT id, user_id, expires_at, expires_at > now() AS is_active,
        token_hash IS NOT NULL AND length(token_hash) > 0 AS has_token_hash
        FROM user_session WHERE ${userId ? `user_id = '${userId}'` : 'false'} ORDER BY created_at) s),
    'has_active_session', EXISTS(SELECT 1 FROM user_session
      WHERE ${userId ? `user_id = '${userId}'` : 'false'} AND expires_at > now()));`;
  return JSON.parse(execFileSync(psql,
    [run.database_url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c default_transaction_read_only=on' } },
  ).trim());
}

function eventCard(current) {
  return current.getByRole('link').filter({
    has: current.getByRole('heading', { name: title, exact: true }),
  });
}

async function dashboard(current, userId) {
  const events = responseFor(current, '/api/users/me/events', 'GET');
  await navigate(current, '/dashboard', 200);
  const session = await current.request.get(`${run.client_url}/api/auth/session`);
  assert.equal(session.status(), 200);
  assert.equal((await session.json()).user.id, userId);
  const listing = await events;
  assert.equal(listing.status(), 200);
  const persisted = await current.request.get(`${run.client_url}/api/users/me/events`);
  assert.equal(persisted.status(), 200);
  const payload = await persisted.json();
  assert(Array.isArray(payload.events), 'Dashboard event response must contain an events array');
  const entries = payload.events;
  const linked = entries.find(entry => entry.event?.id === result.event_id);
  assert(linked, 'Claimed event must appear in dashboard API response');
  assert.equal(linked.role, 'organizer');
  assert.equal(linked.participantId, result.participant_id);
  await current.getByRole('heading', { name: 'My Events', exact: true }).waitFor();
  await eventCard(current).getByText('Organizer', { exact: true }).waitFor();
  return { response_shape: 'events envelope', event_id: linked.event.id,
    participant_id: linked.participantId, role: linked.role };
}

async function signIn(current, userId) {
  await current.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
  await current.getByLabel('Email', { exact: true }).fill(account.email);
  await current.getByLabel('Password', { exact: true }).fill(account.password);
  const login = responseFor(current, '/api/auth/login', 'POST');
  await current.getByRole('button', { name: 'Sign In', exact: true }).click();
  const response = await login;
  assert.equal(response.status(), 200);
  await current.waitForURL(`${run.client_url}/dashboard`);
  await current.getByRole('heading', { name: 'My Events', exact: true }).waitFor();
  const session = await current.request.get(`${run.client_url}/api/auth/session`);
  assert.equal(session.status(), 200);
  assert.equal((await session.json()).user.id, userId);
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await newPage('account-owner');
  await check('Anonymous dashboard and settings redirect to sign-in', async () => {
    for (const route of ['/dashboard', '/dashboard/settings']) {
      await navigate(page, route, 401);
      await page.waitForURL(`${run.client_url}/auth/signin`);
      await page.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
    }
    await capture('01-protected-routes');
  });

  await check('Anonymous event creation persists organizer without location', async () => {
    await navigate(page, '/', 401);
    await page.getByRole('textbox', { name: 'Occasion', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Verification organizer');
    await page.getByRole('button', { name: 'Pick a date and time', exact: true }).click();
    await page.getByRole('button', { name: '09:00', exact: true }).click();
    await page.keyboard.press('Escape');
    await capture('02-create-form');
    const creation = responseFor(page, '/api/events', 'POST');
    await page.getByRole('button', { name: 'Create Meeting', exact: true }).click();
    const created = await creation;
    assert.equal(created.status(), 201);
    result.event_id = (await created.json()).id;
    assert.match(result.event_id, /^evt_[A-Za-z0-9_]+$/);
    await page.waitForURL(`${run.client_url}/meet/${result.event_id}`);
    await page.locator('.cat-portal').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click({ trial: true });
    const state = stored({ eventId: result.event_id });
    assert.equal(state.event_exists, true);
    assert.equal(state.participants.length, 1);
    assert.equal(state.participants[0].is_organizer, true);
    assert.equal(state.participants[0].has_credential, true);
    assert.equal(state.participants[0].has_no_location, true);
    result.participant_id = state.participants[0].id;
    await save('created-state', state);
    await capture('03-created-event');
  });

  await check('Anonymous reload retains cached organizer controls', async () => {
    const me = responseFor(page, `/api/events/${result.event_id}/me`, 'GET');
    await navigate(page, `/meet/${result.event_id}`, 401);
    const response = await me;
    assert.equal(response.status(), 200);
    const data = await response.json();
    await page.getByRole('button', { name: 'Settings', exact: true }).click({ trial: true });
    const cached = await page.evaluate(eventId => ({
      organizer_participant_id: localStorage.getItem(`organizer_participant_id_${eventId}`),
      participant_id: localStorage.getItem(`participant_id_${eventId}`),
      has_organizer_credential: Boolean(localStorage.getItem(`organizer_token_${eventId}`)),
      has_participant_credential: Boolean(localStorage.getItem(`participant_token_${eventId}`)),
    }), result.event_id);
    const identity = {
      api_status: response.status(), response_has_id: Object.hasOwn(data, 'id'),
      response_participant_id: data.participantId ?? null,
      response_is_organizer: data.isOrganizer,
      cached,
      organizer_settings_visible: await page.getByRole('button', { name: 'Settings', exact: true }).isVisible(),
    };
    await save('me-identity-observation', identity);
    assert.equal(identity.response_participant_id, result.participant_id);
    assert.equal(identity.response_is_organizer, true);
    assert.equal(cached.organizer_participant_id, result.participant_id);
    assert.equal(identity.organizer_settings_visible, true);
    await capture('04-reloaded-event');
  });
  await check('Event me response restores organizer identity from the UI-issued token alone', async () => {
    const before = await page.evaluate(eventId => {
      localStorage.removeItem(`organizer_participant_id_${eventId}`);
      localStorage.removeItem(`participant_id_${eventId}`);
      return {
        organizer_participant_id: localStorage.getItem(`organizer_participant_id_${eventId}`),
        participant_id: localStorage.getItem(`participant_id_${eventId}`),
        has_organizer_credential: Boolean(localStorage.getItem(`organizer_token_${eventId}`)),
        has_participant_credential: Boolean(localStorage.getItem(`participant_token_${eventId}`)),
      };
    }, result.event_id);
    await save('token-only-before-reload', before);
    assert.equal(before.organizer_participant_id, null);
    assert.equal(before.participant_id, null);
    assert.equal(before.has_organizer_credential, true, 'Retain the organizer token created through the UI');
    assert.equal(before.has_participant_credential, false);
    const me = responseFor(page, `/api/events/${result.event_id}/me`, 'GET');
    await navigate(page, `/meet/${result.event_id}`, 401);
    const response = await me;
    assert.equal(response.status(), 200);
    const data = await response.json();
    assert.equal(data.participantId, result.participant_id);
    assert.equal(data.isOrganizer, true);
    await page.waitForFunction(({ eventId, participantId }) =>
      localStorage.getItem(`organizer_participant_id_${eventId}`) === participantId,
    { eventId: result.event_id, participantId: result.participant_id });
    await page.getByRole('button', { name: 'Settings', exact: true }).click({ trial: true });
    const restored = await page.evaluate(eventId => ({
      organizer_participant_id: localStorage.getItem(`organizer_participant_id_${eventId}`),
      has_organizer_credential: Boolean(localStorage.getItem(`organizer_token_${eventId}`)),
      has_participant_credential: Boolean(localStorage.getItem(`participant_token_${eventId}`)),
    }), result.event_id);
    assert.equal(restored.organizer_participant_id, result.participant_id);
    assert.equal(restored.has_organizer_credential, true);
    assert.equal(restored.has_participant_credential, false);
    const identity = {
      api_status: response.status(), response_participant_id: data.participantId,
      response_is_organizer: data.isOrganizer, before, restored,
      organizer_settings_visible: await page.getByRole('button', { name: 'Settings', exact: true }).isVisible(),
    };
    assert.equal(identity.organizer_settings_visible, true);
    await save('token-only-identity-recovery', identity);
    await capture('04b-token-only-recovery');
  }, { fatal: false });

  let userId;
  let automaticClaim;
  await check('Signup creates an account and server session', async () => {
    await navigate(page, '/auth/signup', 401);
    await page.getByLabel('Name (optional)', { exact: true }).fill(account.name);
    await page.getByLabel('Email', { exact: true }).fill(account.email);
    await page.getByLabel('Password', { exact: true }).fill(account.password);
    await page.getByLabel('Confirm Password', { exact: true }).fill(account.password);
    await capture('05-signup-form');
    const registration = responseFor(page, '/api/auth/register', 'POST');
    automaticClaim = responseFor(page, '/api/users/me/events/claim', 'POST', 20000)
      .then(response => ({ status: response.status() }), () => ({ status: null }));
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    const registered = await registration;
    assert.equal(registered.status(), 201);
    userId = (await registered.json()).user.id;
    assert.match(userId, /^usr_[A-Za-z0-9_]+$/);
    result.user_id = userId;
    await page.waitForURL(`${run.client_url}/dashboard`);
    const state = stored({ eventId: result.event_id, userId });
    assert.equal(state.user.name_matches, true);
    assert.equal(state.has_active_session, true);
    assert.equal(state.identities.length, 1);
    assert.equal(state.identities[0].provider, 'email');
    assert.equal(state.identities[0].has_password_hash, true);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].has_token_hash, true);
    assert.equal(state.sessions[0].is_active, true);
    await save('registered-state', state);
    await save('registered-cookie-metadata', await cookieMetadata(page));
  });

  await check('Signup automatically claims the anonymous organizer event', async () => {
    const observed = await automaticClaim;
    const state = stored({ eventId: result.event_id, userId });
    await save('anonymous-claim-state', { observed_request_status: observed.status, database: state });
    await capture('05b-anonymous-claim-dashboard');
    assert.equal(observed.status, 201, 'No successful automatic claim response observed within 20 seconds of signup');
    assert.equal(state.links.length, 1);
    assert.equal(state.links[0].role, 'organizer');
    assert.equal(state.links[0].participant_id, result.participant_id);
  }, { fatal: false });

  result.anonymous_event_id = result.event_id;
  result.anonymous_participant_id = result.participant_id;
  await check('Signed-in creation claims the new organizer event', async () => {
    await page.getByRole('link', { name: 'Create New Event', exact: true }).click();
    await page.waitForURL(`${run.client_url}/`);
    title = `${title} signed in`;
    await page.getByRole('textbox', { name: 'Occasion', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Your name', exact: true }).fill('Verification signed-in organizer');
    await page.getByRole('button', { name: 'Pick a date and time', exact: true }).click();
    await page.getByRole('button', { name: '09:00', exact: true }).click();
    await page.keyboard.press('Escape');
    const creation = responseFor(page, '/api/events', 'POST');
    const claim = responseFor(page, '/api/users/me/events/claim', 'POST');
    await page.getByRole('button', { name: 'Create Meeting', exact: true }).click();
    const created = await creation;
    assert.equal(created.status(), 201);
    result.event_id = (await created.json()).id;
    assert.equal((await claim).status(), 201);
    await page.waitForURL(`${run.client_url}/meet/${result.event_id}`);
    await page.locator('.cat-portal').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click({ trial: true });
    const state = stored({ eventId: result.event_id, userId });
    assert.equal(state.participants.length, 1);
    assert.equal(state.participants[0].is_organizer, true);
    assert.equal(state.participants[0].has_no_location, true);
    result.participant_id = state.participants[0].id;
    assert.equal(state.links.length, 1);
    assert.equal(state.links[0].role, 'organizer');
    assert.equal(state.links[0].participant_id, result.participant_id);
    await save('signed-in-creation-state', state);
  });

  await check('Session and organizer dashboard card survive reload', async () => {
    const card = await dashboard(page, userId);
    await capture('06-claimed-dashboard');
    await save('dashboard-card', card);
  });

  await check('Name and fuzzy location default persist after save and reload', async () => {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.waitForURL(`${run.client_url}/dashboard/settings`);
    const nameInput = page.getByLabel('Name', { exact: true });
    await nameInput.waitFor();
    await page.waitForFunction(expected => document.getElementById('name')?.value === expected, account.name);
    await nameInput.fill(account.updatedName);
    await page.getByRole('checkbox', { name: 'Use fuzzy location by default', exact: true }).check();
    const update = responseFor(page, '/api/users/me', 'PATCH');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    const updated = await update;
    assert.equal(updated.status(), 200);
    const profile = await updated.json();
    assert.equal(profile.id, userId);
    assert.equal(profile.name, account.updatedName);
    assert.equal(profile.defaultFuzzyLocation, true);
    await page.getByText('Settings saved successfully!', { exact: true }).waitFor();
    await navigate(page, '/dashboard/settings', 200);
    await page.waitForFunction(expected => document.getElementById('name')?.value === expected, account.updatedName);
    assert.equal(await nameInput.inputValue(), account.updatedName);
    assert(await page.getByRole('checkbox', { name: 'Use fuzzy location by default', exact: true }).isChecked());
    assert(await page.getByLabel('Email', { exact: true }).isDisabled());
    const state = stored({ eventId: result.event_id, userId, expectedName: account.updatedName });
    assert.equal(state.user.name_matches, true);
    assert.equal(state.user.default_fuzzy_location, true);
    await save('settings-state', state);
    await capture('07-settings-reloaded');
  });

  await check('Cancel discards unsaved account settings', async () => {
    await page.getByLabel('Name', { exact: true }).fill('Unsaved verification draft');
    await page.getByRole('checkbox', { name: 'Use fuzzy location by default', exact: true }).uncheck();
    await page.getByRole('link', { name: 'Cancel', exact: true }).click();
    await page.waitForURL(`${run.client_url}/dashboard`);
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.waitForURL(`${run.client_url}/dashboard/settings`);
    await page.waitForFunction(expected => document.getElementById('name')?.value === expected, account.updatedName);
    assert(await page.getByRole('checkbox', { name: 'Use fuzzy location by default', exact: true }).isChecked());
  });

  await check('Dashboard signout invalidates the server session', async () => {
    await dashboard(page, userId);
    const logout = responseFor(page, '/api/auth/logout', 'POST');
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
    assert.equal((await logout).status(), 200);
    await page.waitForURL(`${run.client_url}/auth/signin`);
    const state = stored({ eventId: result.event_id, userId, expectedName: account.updatedName });
    assert.equal(state.has_active_session, false);
    assert.equal(state.sessions.length, 0);
    assert.equal(state.links.length, 1);
    await navigate(page, '/dashboard', 401);
    await page.waitForURL(`${run.client_url}/auth/signin`);
    await save('signed-out-state', state);
    await save('signed-out-cookie-metadata', await cookieMetadata(page));
    await capture('08-signed-out');
  });

  await check('Existing account signs in and restores its claimed event', async () => {
    await signIn(page, userId);
    const card = await dashboard(page, userId);
    const state = stored({ eventId: result.event_id, userId, expectedName: account.updatedName });
    assert.equal(state.has_active_session, true);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].has_token_hash, true);
    await save('signed-in-state', state);
    await save('signed-in-cookie-metadata', await cookieMetadata(page));
    await capture('09-signed-in-again');
    return card;
  });

  other = await newPage('separate-browser');
  await check('Separate browser is anonymous until account sign-in', async () => {
    await navigate(other, '/dashboard', 401);
    await other.waitForURL(`${run.client_url}/auth/signin`);
    await other.getByRole('heading', { name: 'Welcome Back', exact: true }).waitFor();
    await capture('10-separate-anonymous', other);
  });
  await check('Separate signed-in browser lists the claimed organizer card', async () => {
    await signIn(other, userId);
    const card = await dashboard(other, userId);
    await capture('11-separate-dashboard', other);
    await save('separate-dashboard-card', card);
    await save('separate-signed-in-state', stored({
      eventId: result.event_id, userId, expectedName: account.updatedName,
    }));
    await save('separate-signed-in-cookie-metadata', await cookieMetadata(other));
    return card;
  });

  await check('Separate browser opens the dashboard event card', async () => {
    const eventResponse = responseFor(other, `/api/events/${result.event_id}`, 'GET');
    await eventCard(other).click();
    await other.waitForURL(`${run.client_url}/meet/${result.event_id}`);
    assert.equal((await eventResponse).status(), 200);
    await other.getByRole('heading', { name: title, exact: true, level: 1 }).waitFor();
    const observed = {
      signed_in_account: true,
      dashboard_role: 'organizer',
      organizer_settings_visible: await other.getByRole('button', { name: 'Settings', exact: true }).isVisible(),
      join_event_visible: await other.getByRole('button', { name: 'Join Event', exact: true }).isVisible(),
    };
    result.observations.push({ name: 'Claimed card access in separate browser', ...observed });
    await save('separate-event-access', observed);
    await capture('12-separate-event', other);
  });

  await check('No uncaught browser errors during the selected account paths', async () => {
    assert.deepEqual(pageErrors, []);
  }, { fatal: false });
  result.status = result.checks.some(entry => entry.status === 'FAIL') ? 'FAIL' : 'PASS';
} catch (error) {
  result.error = scrub(error);
  try { if (page) await capture('failure', page); } catch (captureError) {
    result.capture_error = scrub(captureError);
  }
  try { if (other) await capture('separate-failure', other); } catch {}
} finally {
  await save('actions', actions);
  await save('network', network);
  await save('browser-errors', { page_errors: pageErrors, console_errors: consoleErrors });
  try { await browser?.close(); } catch (error) {
    result.status = 'FAIL';
    result.teardown_error = scrub(error);
  }
  await save('result', result);
  if (result.status !== 'PASS') process.exitCode = 1;
  console.log(JSON.stringify(result, null, 2));
}
