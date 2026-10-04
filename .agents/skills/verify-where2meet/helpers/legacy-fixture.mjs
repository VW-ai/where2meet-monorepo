#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [runArgument, privateArgument] = process.argv.slice(2);
assert(runArgument && privateArgument, 'Pass the owned legacy run directory and a private output directory');
process.umask(0o077);
const runDir = path.resolve(runArgument);
const privateDir = path.resolve(privateArgument);
const privateParent = await realpath(path.dirname(privateDir));
const repository = spawnSync('git', ['-C', privateParent, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
assert.notEqual(repository.status, 0, 'Private fixture output must be outside every Git checkout');
execFileSync('python3', [fileURLToPath(new URL('./control.py', import.meta.url)), 'doctor', '--run', runDir], { stdio: 'pipe' });
const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
assert.equal(run.kind, 'where2meet-verification-v1');
assert.equal(run.run_dir, runDir);
assert.equal(run.status, 'ready');
assert.equal(new URL(run.backend_url).hostname, '127.0.0.1');
assert.equal(new URL(run.database_url).hostname, '127.0.0.1');
assert.equal(Number(new URL(run.database_url).port), run.ports.postgres);
assert.equal(new URL(run.database_url).pathname, '/where2meet_verify');
const require = createRequire(path.join(run.source_copy, 'server/package.json'));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: run.database_url } } });

async function request(route, { method = 'GET', body, token, cookie } = {}) {
  const response = await fetch(run.backend_url + route, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert(response.ok, `${method} ${route} returned ${response.status}`);
  return { body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

try {
  await mkdir(privateDir, { recursive: false, mode: 0o700 });
  const suffix = randomUUID();
  const created = await request('/api/events', { method: 'POST', body: { title: `Legacy import ${suffix}` } });
  const eventId = created.body.id;
  const token = created.body.participantToken;
  const participantId = created.body.organizerParticipantId;
  assert.match(eventId, /^evt_[A-Za-z0-9_]+$/);
  assert(typeof token === 'string' && token.startsWith('pt_'), 'Expected an old participant credential');
  const me = await request(`/api/events/${eventId}/me`, { token });
  assert.equal(me.body.participantId, participantId);
  assert.equal(me.body.isOrganizer, true);
  await request(`/api/events/${eventId}/participants/${participantId}`, {
    method: 'PATCH', token, body: { name: 'Imported organizer' },
  });

  const email = `migration-${suffix}@example.com`;
  const password = `Test-only-${randomUUID()}!`;
  const registered = await request('/api/auth/register', {
    method: 'POST', body: { email, password, name: 'Imported account' },
  });
  const validCookie = registered.cookie;
  assert(validCookie?.startsWith('session_token=st_'));
  const userId = registered.body.user.id;
  assert.equal((await request('/api/auth/session', { cookie: validCookie })).body.user.id, userId);
  await request('/api/users/me/events/claim', {
    method: 'POST', cookie: validCookie, body: { eventId, participantToken: token },
  });
  const loggedIn = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  const expiredCookie = loggedIn.cookie;
  assert(expiredCookie?.startsWith('session_token=st_'));
  assert(validCookie !== expiredCookie, 'Login must issue a distinct test session');
  assert.equal((await request('/api/auth/session', { cookie: expiredCookie })).body.user.id, userId);
  const expiredToken = expiredCookie.slice('session_token='.length);
  await db.userSession.update({
    where: { tokenHash: createHash('sha256').update(expiredToken).digest('hex') },
    data: { expiresAt: new Date('2000-01-01T00:00:00.000Z') },
  });

  const data = await db.$transaction(async (tx) => ({
    version: 1,
    events: await tx.event.findMany({ where: { id: eventId } }),
    participants: await tx.participant.findMany({ where: { eventId } }),
    users: await tx.user.findMany({ where: { id: userId } }),
    userSessions: await tx.userSession.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    userIdentities: await tx.userIdentity.findMany({ where: { userId } }),
    userEvents: await tx.userEvent.findMany({ where: { userId, eventId } }),
    venues: [],
    votes: [],
  }), { isolationLevel: 'RepeatableRead' });
  assert.equal(data.events.length, 1);
  assert.equal(data.participants.length, 1);
  assert.equal(data.users.length, 1);
  assert.equal(data.userSessions.length, 2);
  assert.equal(data.userIdentities.length, 1);
  assert.equal(data.userEvents.length, 1);
  const json = JSON.stringify(data, null, 2) + '\n';
  await writeFile(path.join(privateDir, 'rows.json'), json, { flag: 'wx', mode: 0o600 });
  await writeFile(path.join(privateDir, 'credentials.json'), JSON.stringify({
    eventId, participantId, token, userId, email, password, validCookie, expiredCookie,
  }), { flag: 'wx', mode: 0o600 });
  const report = {
    status: 'PASS', source_commit: run.source_commit, source_fingerprint: run.source_fingerprint,
    source_schema_mode: run.schema_mode, fixture_sha256: createHash('sha256').update(json).digest('hex'),
    counts: Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
    expiry_provenance: 'Both sessions issued by old HTTP API; second expiry changed to 2000-01-01 only in the isolated fixture database',
    old_http_checks: ['create', 'organizer identity', 'name update', 'register', 'valid session', 'explicit claim', 'login', 'second valid session'],
  };
  await writeFile(path.join(runDir, 'evidence/legacy-fixture.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
