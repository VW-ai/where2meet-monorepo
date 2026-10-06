#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { allRows, assertVerifierUnchanged, claimExporter, createBundle, normalize, parseProfile, ProofFailure, removeBundle, requireProof, verifierIdentity, writeBundle } from './migration-fixture.mjs';

const [runArgument, privateArgument, ...options] = process.argv.slice(2);
const profile = parseProfile(options);
const verifier = profile === 'populated-v1' ? await verifierIdentity() : undefined;
assert(runArgument && privateArgument, 'Pass the owned legacy run directory and a private output directory');
process.umask(0o077);
const runDir = await realpath(path.resolve(runArgument));
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
const control = fileURLToPath(new URL('./control.py', import.meta.url));
let owner;
let producer;
let stage = 'validate source';

async function request(route, { method = 'GET', body, token, cookie } = {}) {
  const label = route.replace(/(\/events\/)[^/]+/, '$1:event').replace(/(\/participants\/)[^/]+/, '$1:participant')
    .replace(/^\/api\/venues\/(?!search$).+$/, '/api/venues/:venue');
  let response;
  try { response = await fetch(run.backend_url + route, {
    method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }); } catch { throw new ProofFailure(`${method} ${label}: transport failed`); }
  requireProof(response.ok, `${method} ${label}: HTTP ${response.status}`);
  let parsed;
  try { parsed = await response.json(); } catch { throw new ProofFailure(`${method} ${label}: response was not JSON`); }
  return { body: parsed, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

try {
  if (profile === 'populated-v1') {
    assert.equal(run.source_commit, '5a158d8b2545b1c75628f1d36efb7b9cc0c76de9', 'Use the pinned old-service revision');
    assert.equal(run.source_status.trim(), '', 'Legacy source must be clean');
    assert.equal(run.schema_mode, 'push');
    assert.equal(run.backend_mode, 'source');
    producer = await claimExporter(run, db);
    owner = await createBundle(privateDir, run);
  } else await mkdir(privateDir, { recursive: false, mode: 0o700 });
  stage = 'create old API fixture';
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
  let participants = [{ eventId, participantId, token }];
  let observedVenue;
  if (profile === 'populated-v1') {
    stage = 'create second event, guest and account claim';
    const second = (await request('/api/events', { method: 'POST', body: { title: `Legacy open ${suffix}` } })).body;
    const secondPerson = { eventId: second.id, participantId: second.organizerParticipantId, token: second.participantToken };
    await request(`/api/events/${second.id}/participants/${secondPerson.participantId}`, {
      method: 'PATCH', token: secondPerson.token, body: { name: 'Imported open organizer' },
    });
    const guest = (await request(`/api/events/${eventId}/participants`, { method: 'POST',
      body: { name: 'Imported guest', address: 'San Diego Central Library, San Diego, CA', fuzzyLocation: false } })).body;
    participants = [...participants, { eventId, participantId: guest.id, token: guest.participantToken }, secondPerson];
    for (const person of participants) {
      const identity = (await request(`/api/events/${person.eventId}/me`, { token: person.token })).body;
      assert.equal(identity.participantId, person.participantId);
    }
    await request('/api/users/me/events/claim', { method: 'POST', cookie: validCookie,
      body: { eventId: second.id, participantToken: secondPerson.token } });
    stage = 'search real legacy venue and read details';
    const search = (await request('/api/venues/search', { method: 'POST', body: {
      center: { lat: 32.7095, lng: -117.1535 }, searchRadius: 2000, query: 'coffee',
    } })).body;
    requireProof(Array.isArray(search.venues) && search.venues.length > 0, 'Old real Google search returned no venues');
    observedVenue = (await request(`/api/venues/${encodeURIComponent(search.venues[0].id)}`)).body;
    assert.equal(observedVenue.id, search.venues[0].id);
    const venueData = { name: observedVenue.name, address: observedVenue.address, lat: observedVenue.location.lat,
      lng: observedVenue.location.lng, category: observedVenue.types[0] ?? null, rating: observedVenue.rating,
      priceLevel: observedVenue.priceLevel, photoUrl: observedVenue.photoUrl };
    stage = 'cast three legacy votes';
    for (const person of participants) await request(`/api/events/${person.eventId}/participants/${person.participantId}/votes`, {
      method: 'POST', token: person.token, body: { venueId: observedVenue.id, venueData },
    });
    stage = 'publish legacy event';
    await request(`/api/events/${eventId}/publish`, { method: 'POST', token, body: { venueId: observedVenue.id } });
  }
  stage = 'issue and deliberately expire second old session';
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

  if (profile === 'populated-v1') {
    stage = 'stop old writer and audit frozen snapshot';
    execFileSync('python3', [control, 'stop-backend', '--run', runDir], { stdio: 'pipe', timeout: 60000 });
    const rows = await db.$transaction(tx => allRows(tx), { isolationLevel: 'RepeatableRead' });
    const manifest = await writeBundle(owner, run, normalize(rows), {
      participants, account: { userId, email, password, validCookie, expiredCookie },
    });
    assert.equal(manifest.sharedVenueId, observedVenue.id, 'Frozen venue must be observed in the old provider response');
    await assertVerifierUnchanged(verifier);
    const report = { status: 'PASS', profile, verifier, source_commit: run.source_commit, source_fingerprint: run.source_fingerprint,
      source_schema_mode: run.schema_mode, fixture_sha256: manifest.rowsSha256,
      counts: Object.fromEntries(Object.entries(rows).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])),
      ids: manifest.ids, source_writer: 'owned backend stopped before RepeatableRead snapshot; required committed graph audited',
      venue_provenance: 'one venue selected from real old Google search and details; all votes precede publication',
      expiry_provenance: 'Both sessions issued by old HTTP API; only the second expiresAt deliberately changed to 2000-01-01',
      raw_rows_and_credentials: 'private bundle only' };
    await writeFile(path.join(runDir, 'evidence/legacy-fixture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } else {

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
  }
} catch (error) {
  if (profile !== 'populated-v1') throw error;
  const cleanup = { runtime: false, private_bundle: !owner };
  await db.$disconnect();
  if (producer) try { execFileSync('python3', [control, 'cleanup', '--run', runDir], { stdio: 'pipe', timeout: 90000 }); cleanup.runtime = true; } catch {}
  if (owner) try { await removeBundle(owner); cleanup.private_bundle = true; } catch {}
  const report = { status: 'FAIL', profile, verifier, stage, error: 'Legacy populated fixture failed; private values omitted', cleanup,
    ...(error instanceof ProofFailure ? { failed_check: error.message } : {}) };
  if (producer) await writeFile(path.join(runDir, 'evidence/legacy-fixture.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
