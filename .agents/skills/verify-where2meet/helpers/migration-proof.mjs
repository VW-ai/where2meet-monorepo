#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { allRows, assertImportCounts, assertVerifierUnchanged, claimCandidate, cleanupCandidate, cleanupReceipt, compareAfterBrowser, compareRows as compareAllRows,
  models, parseProfile, ProofFailure, readBundle, refreshedVenue, requireProof, verifierIdentity } from './migration-fixture.mjs';
import { browserRequestAllowed, candidate, proofRequestAllowed, refreshWindow, remoteKind, runtimeEnvironment, validateBrowserResponse } from './migration-remote.mjs';

const [runArgument, privateArgument, ...options] = process.argv.slice(2);
assert(runArgument && privateArgument, 'Pass the candidate run and private legacy fixture directories');
const profile = parseProfile(options, true);
const verifyAccounts = options.includes('--accounts');
process.umask(0o077);
const runDir = await realpath(path.resolve(runArgument));
const fixtureDir = path.resolve(privateArgument);
const control = fileURLToPath(new URL('./control.py', import.meta.url));
if (profile === 'populated-v1' || profile === 'cleanup') {
  await populatedProof();
} else {
execFileSync('python3', [control, 'doctor', '--run', runDir], { stdio: 'pipe' });
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.schema_mode, 'migrations');
assert.equal(run.backend_mode, 'compiled');
const expected = JSON.parse(await readFile(path.join(fixtureDir, 'rows.json'), 'utf8'));
const credentials = JSON.parse(await readFile(path.join(fixtureDir, 'credentials.json'), 'utf8'));
const requireServer = createRequire(path.join(run.source_copy, 'server/package.json'));
const { PrismaClient } = requireServer('@prisma/client');
const requireDriver = createRequire(path.join(runDir, 'runtime/driver/package.json'));
const { chromium } = requireDriver('playwright');
const db = new PrismaClient({ datasources: { db: { url: run.database_url } } });
const checks = [];
let browser;
let result = { status: 'FAIL', source_commit: run.source_commit,
  source_fingerprint: run.source_fingerprint, frontend_commit: run.frontend_commit,
  frontend_fingerprint: run.frontend_fingerprint,
  scope: 'Synthetic old HTTP fixture imported to new database, original credentials after restart',
  transport: 'Fresh HTTP connections for credential checks across process restart',
  not_verified: ['production export', 'production cutover', 'historical schema upgrade',
    ...(verifyAccounts ? ['registration and profile writes'] : ['new login or account writes'])] };

function check(name) { checks.push({ name, status: 'PASS' }); }

function importRows(attempt) {
  const imported = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/import-cli.ts', path.join(fixtureDir, 'rows.json')], {
    cwd: path.join(run.source_copy, 'server'),
    env: { ...process.env, DATABASE_URL: run.database_url }, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(imported.status, 0, `Import attempt ${attempt} failed; credentials omitted`);
}

async function compareRows() {
  const delegates = { events: db.event, participants: db.participant, users: db.user,
    userSessions: db.userSession, userIdentities: db.userIdentity, userEvents: db.userEvent,
    venues: db.venue, votes: db.vote };
  for (const [key, delegate] of Object.entries(delegates)) {
    const wanted = expected[key] ?? [];
    const actual = await delegate.findMany({ where: { id: { in: wanted.map(row => row.id) } } });
    const normalized = JSON.parse(JSON.stringify(actual));
    const sort = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    assert(isDeepStrictEqual(sort(normalized), sort(wanted)), `${key} changed during import; values omitted`);
  }
}

async function identityCheck() {
  const me = await fetch(`${run.backend_url}/api/events/${credentials.eventId}/me`, {
    headers: { authorization: `Bearer ${credentials.token}`, connection: 'close' },
  });
  assert.equal(me.status, 200);
  const identity = await me.json();
  assert.equal(identity.participantId, credentials.participantId);
  assert.equal(identity.isOrganizer, true);
  for (const [cookie, status] of [[credentials.validCookie, 200], [credentials.expiredCookie, 401]]) {
    const session = await fetch(`${run.client_url}/api/auth/session`, { headers: { cookie, connection: 'close' } });
    assert.equal(session.status, status);
    assert.equal(session.headers.get('set-cookie'), null, 'Session read must not extend or replace the old cookie');
    if (status === 200) assert.equal((await session.json()).user.id, credentials.userId);
    else await session.arrayBuffer();
  }
}

async function accountCheck() {
  const oldSessionIds = expected.userSessions.map(row => row.id);
  const originalSessions = await db.userSession.findMany({ where: { id: { in: oldSessionIds } }, orderBy: { id: 'asc' } });
  const originalIdentity = await db.userIdentity.findUnique({ where: { id: expected.userIdentities[0].id } });
  assert(originalIdentity, 'Imported password identity must exist before login');
  const originalLink = expected.userEvents[0];
  const response = await fetch(`${run.client_url}/api/auth/login`, {
    method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json', connection: 'close' },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  assert.equal(response.status, 200, 'Old password must authenticate through the Next proxy');
  assert.equal((await response.json()).user.id, credentials.userId);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert(cookie?.startsWith('session_token=st_'), 'Login must issue a session cookie');
  try {
    const headers = { cookie, connection: 'close' };
    const listing = await fetch(`${run.client_url}/api/users/me/events`, { headers, redirect: 'error' });
    assert.equal(listing.status, 200);
    const { events } = await listing.json();
    const link = events.find(entry => entry.event.id === credentials.eventId);
    assert(link, 'Imported account relationship must appear in the dashboard');
    assert.equal(link.id, originalLink.id);
    assert.equal(link.participantId, credentials.participantId);
    assert.equal(link.role, originalLink.role);
    assert.equal(link.createdAt, originalLink.createdAt);
    const claimed = await fetch(`${run.client_url}/api/users/me/events/claim`, {
      method: 'POST', redirect: 'error',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: credentials.eventId, participantToken: credentials.token }),
    });
    assert.equal(claimed.status, 201);
    const repeated = (await claimed.json()).userEvent;
    assert.equal(repeated.id, originalLink.id);
    assert.equal(repeated.participantId, credentials.participantId);
    assert.equal(repeated.createdAt, originalLink.createdAt);
    assert(isDeepStrictEqual(await db.userIdentity.findUnique({ where: { id: originalIdentity.id } }), originalIdentity), 'Login must preserve the imported password identity');
    assert(isDeepStrictEqual(await db.userSession.findMany({ where: { id: { in: oldSessionIds } }, orderBy: { id: 'asc' } }), originalSessions), 'New login must not extend original sessions');
  } finally {
    const logout = await fetch(`${run.client_url}/api/auth/logout`, {
      method: 'POST', redirect: 'error', headers: { cookie, connection: 'close' },
    });
    assert.equal(logout.status, 200);
    assert.deepEqual(await logout.json(), { success: true });
    const invalid = await fetch(`${run.client_url}/api/auth/session`, { headers: { cookie, connection: 'close' }, redirect: 'error' });
    assert.equal(invalid.status, 401, 'Logout must revoke the newly issued session');
    await invalid.arrayBuffer();
  }
  await identityCheck();
}

try {
  importRows(1);
  await compareRows();
  check('Exact IDs, nullable fields, hashes, timestamps, relationships and original expiration preserved');
  importRows(2);
  await compareRows();
  check('Second identical import leaves every selected row unchanged');
  await identityCheck();
  check('Old participant token and old valid session work; deliberately expired session returns 401');
  if (verifyAccounts) {
    await accountCheck();
    check('Old password logs in through Next; claim ID and credential hashes persist; new logout leaves old valid session intact');
  }
  execFileSync('python3', [control, 'restart-backend', '--run', runDir], { stdio: 'pipe', timeout: 60000 });
  await identityCheck();
  check('Same credentials and expiration behavior survive backend process restart');
  if (verifyAccounts) {
    await accountCheck();
    check('Old password, account relationship and session isolation survive backend process restart');
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${run.client_url}/meet/${credentials.eventId}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: expected.events[0].title, exact: true, level: 1 }).waitFor({ timeout: 60000 });
  assert.equal(await page.getByRole('button', { name: 'Settings', exact: true }).count(), 0);
  await page.screenshot({ path: path.join(runDir, 'evidence/imported-share-link.png'), fullPage: true });
  assert.deepEqual(errors, [], 'Imported share link has uncaught browser errors');
  check('Original event ID opens its imported title in a fresh anonymous browser without organizer controls');
  result.status = 'PASS';
} catch (error) {
  result.error = error instanceof Error ? error.message : 'Migration verification failed';
  if (error?.cause?.code) result.transport_error_code = error.cause.code;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await db.$disconnect();
  await writeFile(path.join(runDir, 'evidence/migration-result.json'), JSON.stringify({ ...result, checks }, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, checks }, null, 2));
}
}

async function populatedProof() {
  const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
  const remote = run.kind === remoteKind;
  const result = { status: 'FAIL', profile: 'populated-v1', source_commit: run.source_commit,
    source_fingerprint: run.source_fingerprint, frontend_commit: run.frontend_commit,
    frontend_fingerprint: run.frontend_fingerprint, checks: [],
    candidate: remote ? 'RemoteImportRun' : 'LocalCandidate',
    not_verified: ['historical or production data', ...remote ? [] : ['remote import'], 'production database version parity', 'large-pack import'] };
  result.verifier = await verifierIdentity();
  let stage = 'validate owned candidate';
  let db; let browser; let receipt; let bundle;
  const checked = name => result.checks.push({ name, status: 'PASS' });
  const operate = operation => execFileSync('python3', [remote ? fileURLToPath(new URL('./ppe_import.py', import.meta.url)) : control,
    remote ? ({ doctor: '_doctor', 'restart-backend': '_restart', cleanup: '_dispose', clock: '_clock' })[operation] : operation,
    '--run', runDir], { stdio: 'pipe', timeout: remote ? 240000 : 90000 });
  const identity = () => { if (remote) operate('doctor'); };
  try {
    requireProof([remoteKind, 'where2meet-verification-v1'].includes(run.kind) && run.run_dir === runDir, 'Candidate ownership mismatch');
    if (profile === 'cleanup') {
      const owned = await cleanupReceipt(run);
      const selected = path.join(await realpath(path.dirname(fixtureDir)), path.basename(fixtureDir));
      requireProof(selected === owned.fixture.directory, 'Cleanup fixture path differs from receipt');
      receipt = owned;
      result.recovery_only = true;
    } else {
      operate('doctor');
      const { databaseUrl } = candidate(run, runDir);
      const requireServer = createRequire(path.join(run.source_copy, 'server/package.json'));
      const { PrismaClient, Prisma } = requireServer('@prisma/client');
      db = new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: [] });
      if (remote) {
        const observed = await db.$queryRaw`SELECT current_database() AS database, current_setting('server_version') AS version, inet_server_port() AS port`;
        requireProof(observed.length === 1 && observed[0].database === 'where2meet_import' && /^17(?:\.|$)/.test(observed[0].version) && observed[0].port === 5432,
          'SSH database identity is not the owned PostgreSQL 17 target');
        result.database = { name: observed[0].database, version: observed[0].version, port: observed[0].port };
      }
      const empty = await allRows(db);
      requireProof(Object.keys(models).every(key => empty[key].length === 0), 'Populated rehearsal requires empty business tables');
      bundle = await readBundle(fixtureDir);
      receipt = await claimCandidate(run, bundle);
      result.fixture_sha256 = bundle.manifest.rowsSha256;
      result.ids = bundle.manifest.ids;
      result.legacy_commit = bundle.manifest.source.commit;
      result.legacy_verifier = bundle.manifest.verifier;
      stage = 'verify legacy writer cutoff';
      const source = JSON.parse(await readFile(path.join(bundle.manifest.source.runDirectory, 'run.json'), 'utf8'));
      requireProof(source.run_id === bundle.manifest.source.runId && source.source_commit === bundle.manifest.source.commit &&
        source.source_fingerprint === bundle.manifest.source.fingerprint && source.run_dir !== runDir && source.database_url !== databaseUrl,
        'Legacy source receipt mismatch');
      execFileSync('python3', [control, 'stop-backend', '--run', source.run_dir], { stdio: 'pipe', timeout: 60000 });
      checked('Private graph/digests and exact owned source cutoff verified; candidate business tables empty');
      for (const attempt of [1, 2]) {
        stage = `import attempt ${attempt} and exact pre-auth rows`;
        identity();
        const imported = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/import-cli.ts', path.join(bundle.owner.directory, 'rows.json')], {
          cwd: path.join(run.source_copy, 'server'), env: { ...(remote ? runtimeEnvironment() : process.env), DATABASE_URL: databaseUrl }, encoding: 'utf8', timeout: 120000,
        });
        identity();
        requireProof(imported.status === 0 && !imported.error, 'Importer failed; private output omitted');
        const counts = JSON.parse(imported.stdout.trim());
        assertImportCounts(counts, attempt === 1);
        compareAllRows(await allRows(db), bundle.rows);
        result.import_counts ??= []; result.import_counts.push(counts);
        checked(`Import ${attempt}: exact complete row sets and every field before auth/browser; counts checked`);
      }
      const afterAuth = { ...bundle.rows, userSessions: bundle.rows.userSessions.filter(row => row.id !== bundle.manifest.expiredSessionId) };
      const sessionCookies = new Set([bundle.credentials.account.validCookie, bundle.credentials.account.expiredCookie]);
      const http = async (route, { method = 'GET', body, token, cookie, status = 200, proxy = false } = {}) => {
        if (remote) requireProof(proofRequestAllowed(bundle, route, { method, body, token, cookie, proxy }, sessionCookies), 'Remote proof request outside owned fixture policy');
        const response = await fetch((proxy ? run.client_url : run.backend_url) + route, { method, redirect: 'error', signal: AbortSignal.timeout(30000),
          headers: { connection: 'close', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        requireProof(response.status === status, 'Imported API status mismatch; private request omitted');
        return { body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], setCookie: response.headers.get('set-cookie') };
      };
      const authenticate = async () => {
        for (const credential of bundle.credentials.participants) {
          const person = bundle.rows.participants.find(row => row.id === credential.participantId);
          const me = (await http(`/api/events/${credential.eventId}/me`, { token: credential.token })).body;
          requireProof(me.participantId === person.id && me.isOrganizer === person.isOrganizer && me.name === person.name, 'Old participant identity mismatch');
          const otherEvent = bundle.rows.events.find(row => row.id !== credential.eventId).id;
          await http(`/api/events/${otherEvent}/me`, { token: credential.token, status: 403 });
        }
        for (const [cookie, status] of [[bundle.credentials.account.validCookie, 200], [bundle.credentials.account.expiredCookie, 401]]) {
          const session = await http('/api/auth/session', { cookie, status, proxy: true });
          requireProof(session.setCookie === null, 'Session read altered cookie');
          if (status === 200) requireProof(session.body.user.id === bundle.credentials.account.userId, 'Old session user mismatch');
        }
        compareAllRows(await allRows(db), afterAuth);
        const account = bundle.credentials.account;
        const login = await http('/api/auth/login', { method: 'POST', proxy: true, body: { email: account.email, password: account.password } });
        requireProof(login.body.user.id === account.userId && login.cookie?.startsWith('session_token=st_'), 'Old password login failed');
        sessionCookies.add(login.cookie);
        try {
          const listing = (await http('/api/users/me/events', { cookie: login.cookie, proxy: true })).body.events;
          requireProof(listing.length === 2, 'Imported account listing must contain exactly two links');
          for (const link of bundle.rows.userEvents) {
            const actual = listing.find(row => row.event.id === link.eventId);
            requireProof(actual && ['id', 'participantId', 'role', 'createdAt'].every(key => actual[key] === link[key]), 'Imported account link changed');
            const credential = bundle.credentials.participants.find(row => row.participantId === link.participantId);
            const claimed = (await http('/api/users/me/events/claim', { method: 'POST', proxy: true, cookie: login.cookie, status: 201,
              body: { eventId: link.eventId, participantToken: credential.token } })).body.userEvent;
            requireProof(['id', 'participantId', 'role', 'createdAt'].every(key => claimed[key] === link[key]), 'Repeated imported claim changed');
          }
        } finally {
          const logout = await http('/api/auth/logout', { method: 'POST', cookie: login.cookie, proxy: true });
          requireProof(isDeepStrictEqual(logout.body, { success: true }), 'New session logout failed');
          await http('/api/auth/session', { cookie: login.cookie, status: 401, proxy: true });
        }
        compareAllRows(await allRows(db), afterAuth);
      };
      const savedMeetings = async () => {
        for (const expected of bundle.rows.events) {
          const event = (await http(`/api/events/${expected.id}`)).body;
          requireProof(['id', 'title', 'meetingTime', 'publishedVenueId', 'publishedAt', 'createdAt', 'updatedAt'].every(key => event[key] === expected[key]), 'Imported public event fields changed');
          const people = bundle.rows.participants.filter(row => row.eventId === expected.id);
          requireProof(isDeepStrictEqual(event.participants.map(row => row.id).sort(), people.map(row => row.id).sort()), 'Imported event participant set changed');
          const votes = (await http(`/api/events/${expected.id}/votes`)).body;
          requireProof(votes.totalVotes === people.length && votes.venues.length === 1 && votes.venues[0].id === bundle.manifest.sharedVenueId &&
            votes.venues[0].voteCount === people.length && isDeepStrictEqual([...votes.venues[0].voters].sort(), people.map(row => row.id).sort()), 'Imported vote totals or event scoping changed');
        }
      };
      stage = 'old credentials and account links before restart';
      identity();
      await authenticate(); await savedMeetings(); compareAllRows(await allRows(db), afterAuth);
      identity();
      checked('All three old tokens, cross-event rejection, password, both exact claims and session isolation; only known expired session deleted');
      stage = 'owned backend restart and repeat old credentials';
      operate('restart-backend');
      compareAllRows(await allRows(db), afterAuth);
      await authenticate(); await savedMeetings(); compareAllRows(await allRows(db), afterAuth);
      identity();
      checked('Owned restart preserves all remaining fields, old credentials and both meetings; no reimport after expired-session consumption');
      stage = 'anonymous original links and visible saved state';
      const requireDriver = createRequire(path.join(runDir, 'runtime/driver/package.json'));
      const { chromium } = requireDriver('playwright');
      browser = await chromium.launch({ channel: 'chrome', headless: true, ...remote ? { env: runtimeEnvironment() } : {} });
      const errors = []; const details = []; const pending = new Set(); const responses = [];
      if (remote) result.browser_guard = { blocked: [], responses: [], pending: 0 };
      identity();
      const clockBefore = remote ? JSON.parse(operate('clock')) : undefined;
      const startedAt = Date.now();
      for (const event of bundle.rows.events) {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        const guarded = new Set();
        if (remote) await context.route('**/*', route => {
          const request = route.request(); const url = new URL(request.url());
          if (url.origin !== run.backend_url && !url.pathname.startsWith('/api/')) return route.continue();
          const task = (async () => {
            if (!browserRequestAllowed(run, bundle, request.method(), request.url()) || request.postData() !== null || request.redirectedFrom()) {
              result.browser_guard.blocked.push('request outside owned fixture policy');
              errors.push('browser request blocked by owned fixture policy'); await route.abort(); return;
            }
            const response = await route.fetch({ maxRedirects: 0, timeout: 30000 });
            validateBrowserResponse(run, bundle, request.url(), response.status(), response.headers());
            if (url.origin === run.client_url) requireProof(response.status() === 401, 'Anonymous session proxy did not reject missing credentials');
            result.browser_guard.responses.push({ path: url.pathname, method: 'GET', status: response.status() });
            await route.fulfill({ response });
          })().catch(async () => { result.browser_guard.blocked.push('application response failed validation'); errors.push('guarded application request failed'); await route.abort().catch(() => {}); });
          guarded.add(task); result.browser_guard.pending++;
          task.finally(() => { guarded.delete(task); result.browser_guard.pending--; }); return task;
        });
        const page = await context.newPage();
        const reads = [];
        const inFlight = new Set();
        const relevant = request => {
          const url = new URL(request.url());
          return url.origin === run.backend_url && [`/api/events/${event.id}`, `/api/events/${event.id}/votes`,
            `/api/venues/${encodeURIComponent(bundle.manifest.sharedVenueId)}`].includes(url.pathname);
        };
        page.on('request', request => { if (relevant(request)) inFlight.add(request); });
        page.on('requestfinished', request => inFlight.delete(request));
        page.on('pageerror', () => errors.push('uncaught page error'));
        page.on('requestfailed', request => {
          inFlight.delete(request);
          if (relevant(request)) errors.push('relevant browser request failed');
        });
        page.on('response', response => {
          const url = new URL(response.url());
          if (url.origin === run.backend_url && response.request().method() === 'GET' &&
            [`/api/events/${event.id}`, `/api/events/${event.id}/votes`].includes(url.pathname)) {
            reads.push({ path: url.pathname, status: response.status() });
          }
          if (url.origin !== run.backend_url || url.pathname !== `/api/venues/${encodeURIComponent(bundle.manifest.sharedVenueId)}` || response.request().method() !== 'GET') return;
          const task = (async () => {
            requireProof(response.status() === 200, 'Owned venue hydration response failed');
            const place = await response.json();
            const projected = refreshedVenue(bundle.rows.venues[0], place, Prisma.Decimal);
            details.push(place);
            responses.push({ event_id: event.id, status: response.status(), venue: { id: projected.id, name: projected.name,
              address: projected.address, lat: projected.lat, lng: projected.lng, category: projected.category,
              rating: projected.rating, priceLevel: projected.priceLevel, photoUrl: projected.photoUrl } });
          })();
          pending.add(task); task.catch(() => errors.push('owned detail response could not be verified')).finally(() => pending.delete(task));
        });
        try {
          await page.goto(`${run.client_url}/meet/${event.id}?view=participant`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { level: 1, name: event.title, exact: true }).waitFor({ timeout: 60000 });
          const published = event.id === bundle.manifest.publishedEventId;
          if (published) await page.getByRole('heading', { level: 2, name: 'Event Published', exact: true }).waitFor();
          const join = page.getByRole('button', { name: 'Join Event', exact: true });
          await join.waitFor();
          for (const person of bundle.rows.participants.filter(row => row.eventId === event.id)) await page.getByText(person.name, { exact: true }).first().waitFor();
          requireProof(await join.isDisabled() === published, 'Loaded imported Join Event lock mismatch');
          requireProof(await page.getByRole('button', { name: 'Settings', exact: true }).count() === 0, 'Anonymous link exposes organizer controls');
          await page.getByRole('button', { name: 'Share event', exact: true }).click();
          await page.getByRole('heading', { name: 'Share Event', exact: true }).waitFor();
          await page.getByText(event.title, { exact: true }).last().waitFor();
          await page.getByRole('button', { name: 'Done', exact: true }).click();
          await page.getByRole('button', { name: 'Venues', exact: true }).click();
          await page.getByRole('button', { name: /^(Expand|Collapse) liked venues filter/ }).waitFor();
          const expand = page.getByRole('button', { name: /^Expand liked venues filter/ });
          if (await expand.isVisible()) await expand.click();
          await page.getByRole('heading', { name: 'Liked Venues', exact: true }).waitFor();
          await page.waitForFunction(() => document.querySelector('h3') !== null);
          const deadline = Date.now() + 30000;
          let matched = false;
          while (Date.now() < deadline) {
            const names = [...new Set(details.map(place => place.name))];
            for (const name of names) {
              const card = page.getByRole('button').filter({ has: page.getByRole('heading', { level: 3, name: name + (published ? 'Published' : ''), exact: true }) });
              const button = card.getByRole('button', { name: published ? 'Voting disabled after publish' : 'Vote for venue', exact: true });
              if (await button.count() === 1 && await button.isVisible() && Number(await button.innerText()) === (published ? 2 : 1) &&
                await button.getAttribute('aria-busy') === 'false' && await button.getAttribute('aria-pressed') === 'false' && await button.isDisabled() === published) matched = true;
            }
            if (matched) break;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          requireProof(matched, 'Imported venue card/count/lock did not settle');
          requireProof(reads.every(read => read.status === 200) && [`/api/events/${event.id}`, `/api/events/${event.id}/votes`]
            .every(route => reads.some(read => read.path === route)), 'Required browser event/vote responses absent or unsuccessful');
          requireProof(responses.some(response => response.event_id === event.id), 'This anonymous context did not complete owned detail hydration');
          const drainedBy = Date.now() + 30000;
          while ((inFlight.size || pending.size || guarded.size) && Date.now() < drainedBy) {
            await Promise.allSettled([...pending, ...guarded]);
            if (inFlight.size) await new Promise(resolve => setTimeout(resolve, 100));
          }
          requireProof(inFlight.size === 0 && pending.size === 0 && guarded.size === 0, 'Relevant browser requests did not drain before context close');
          await page.screenshot({ path: path.join(runDir, `evidence/imported-${published ? 'published' : 'open'}.png`), fullPage: true });
          await writeFile(path.join(runDir, `evidence/imported-${published ? 'published' : 'open'}.aria.txt`), await page.locator('body').ariaSnapshot());
        } catch (error) {
          await page.screenshot({ path: path.join(runDir, 'evidence/imported-failure.png'), fullPage: true }).catch(() => {});
          await writeFile(path.join(runDir, 'evidence/imported-failure.aria.txt'), await page.locator('body').ariaSnapshot()).catch(() => {});
          throw error;
        } finally { await context.close(); await Promise.allSettled([...guarded]); }
      }
      await browser.close(); browser = undefined;
      await Promise.allSettled([...pending]);
      const endedAt = Date.now();
      const window = remote ? refreshWindow(startedAt, endedAt, [clockBefore, JSON.parse(operate('clock'))]) : { startedAt, endedAt };
      if (remote) result.backend_clock_window = window;
      identity();
      result.venue_refresh_responses = responses;
      requireProof(errors.length === 0, 'Imported links had uncaught page errors or unverified detail responses');
      compareAfterBrowser(await allRows(db), afterAuth, details, Prisma.Decimal, window.startedAt, window.endedAt);
      checked('Both original anonymous links render imported names, shared venue, scoped counts 2/1 and publication lock');
      checked('Every other row/field exact after browser; sole Venue refresh matches an observed provider projection and bounded timestamp');
      result.status = 'PASS';
    }
  } catch (error) {
    result.error = 'Populated migration proof failed; private values omitted';
    if (error instanceof ProofFailure) result.failed_check = error.message;
    result.failed_stage = stage;
    process.exitCode = 1;
  } finally {
    await browser?.close().catch(() => {});
    await db?.$disconnect().catch(() => {});
    try { await assertVerifierUnchanged(result.verifier); }
    catch { result.status = 'FAIL'; result.verifier_changed = true; process.exitCode = 1; }
    if (receipt) {
      try {
        result.cleanup = await cleanupCandidate(run, receipt, () => operate('cleanup'));
        if (profile === 'cleanup') result.status = 'PASS';
      } catch { result.status = 'FAIL'; result.cleanup_error = 'Owned cleanup incomplete; retain receipts and use --cleanup-only'; process.exitCode = 1; }
    } else result.cleanup = { ownership_not_claimed: true, caller_cleanup_required: true };
    try { await assertVerifierUnchanged(result.verifier); }
    catch { result.status = 'FAIL'; result.verifier_changed = true; process.exitCode = 1; }
    const name = !receipt ? `migration-refused-${process.pid}.json` : profile === 'cleanup' ? 'migration-recovery.json' : 'migration-result.json';
    await writeFile(path.join(runDir, 'evidence', name), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  }
}
