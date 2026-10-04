#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const [runArgument, privateArgument] = process.argv.slice(2);
assert(runArgument && privateArgument, 'Pass the candidate run and private legacy fixture directories');
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
  not_verified: ['production export', 'production cutover', 'new login or account writes', 'historical schema upgrade'] };

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

try {
  importRows(1);
  await compareRows();
  check('Exact IDs, nullable fields, hashes, timestamps, relationships and original expiration preserved');
  importRows(2);
  await compareRows();
  check('Second identical import leaves every selected row unchanged');
  await identityCheck();
  check('Old participant token and old valid session work; deliberately expired session returns 401');
  execFileSync('python3', [control, 'restart-backend', '--run', runDir], { stdio: 'pipe', timeout: 60000 });
  await identityCheck();
  check('Same credentials and expiration behavior survive backend process restart');

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
