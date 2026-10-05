#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const [runArgument, privateArgument, ...options] = process.argv.slice(2);
assert(runArgument && privateArgument, 'Pass the candidate run and private legacy fixture directories');
assert(options.length === 0 || (options.length === 1 && options[0] === '--accounts'), 'Unknown migration proof option');
const verifyAccounts = options.includes('--accounts');
process.umask(0o077);
const runDir = path.resolve(runArgument);
const fixtureDir = path.resolve(privateArgument);
const control = fileURLToPath(new URL('./control.py', import.meta.url));
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
    env: { ...process.env, DATABASE_URL: run.database_url }, encoding: 'utf8', timeout: 60000,
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
