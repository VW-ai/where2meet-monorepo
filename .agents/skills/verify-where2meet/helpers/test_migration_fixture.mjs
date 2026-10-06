import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, chmod, symlink, lstat, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { acquireCleanupLock, auditGraph, assertImportCounts, claimCandidate, claimExporter, cleanupCandidate, cleanupReceipt, compareAfterBrowser, compareRows,
  counts, createBundle, models, parseProfile, readBundle, refreshedVenue, removeBundle, sha256, writeBundle } from './migration-fixture.mjs';

const requireServer = createRequire(new URL('../../../../server/package.json', import.meta.url));
const { Decimal } = requireServer('@prisma/client/runtime/library');
const clone = value => structuredClone(value);
function fixture() {
  const participants = [
    { id: 'organizer-a', eventId: 'event-a', isOrganizer: true, name: 'Organizer A', tokenHash: sha256('pt_a') },
    { id: 'guest-a', eventId: 'event-a', isOrganizer: false, name: 'Guest A', tokenHash: sha256('pt_guest') },
    { id: 'organizer-b', eventId: 'event-b', isOrganizer: true, name: 'Organizer B', tokenHash: sha256('pt_b') },
  ];
  const rows = { version: 1,
    events: [{ id: 'event-a', title: 'Published', publishedVenueId: 'place-shared', publishedAt: '2026-01-01T00:00:00.123Z' },
      { id: 'event-b', title: 'Open', publishedVenueId: null, publishedAt: null }], participants,
    users: [{ id: 'user-a', email: 'synthetic@example.com' }],
    userSessions: [{ id: 'session-live', userId: 'user-a', tokenHash: sha256('st_aabb'), expiresAt: '2099-01-01T00:00:00.000Z' },
      { id: 'session-expired', userId: 'user-a', tokenHash: sha256('st_ccdd'), expiresAt: '2000-01-01T00:00:00.000Z' }],
    userIdentities: [{ id: 'identity-a', userId: 'user-a', provider: 'email', passwordHash: 'PRIVATE-HASH-CANARY' }],
    userEvents: [{ id: 'link-a', userId: 'user-a', eventId: 'event-a', participantId: 'organizer-a', role: 'organizer' },
      { id: 'link-b', userId: 'user-a', eventId: 'event-b', participantId: 'organizer-b', role: 'organizer' }],
    venues: [{ id: 'place-shared', name: 'Old name', address: 'Old address', lat: '32.1', lng: '-117.1', category: 'cafe', rating: '4.5',
      priceLevel: 1, photoUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    votes: participants.map((person, index) => ({ id: `vote-${index}`, eventId: person.eventId, participantId: person.id, venueId: 'place-shared' })),
  };
  const credentials = { participants: participants.map((person, index) => ({ eventId: person.eventId, participantId: person.id, token: ['pt_a', 'pt_guest', 'pt_b'][index] })),
    account: { userId: 'user-a', email: 'synthetic@example.com', password: 'PRIVATE-PASSWORD-CANARY', validCookie: 'session_token=st_aabb', expiredCookie: 'session_token=st_ccdd' } };
  return { rows, credentials };
}
async function scratch(t) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'where2meet-import-guard-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = { run_id: 'old-owned-run', run_dir: path.join(directory, 'source'), source_commit: 'old', source_fingerprint: 'fingerprint' };
  const run = { kind: 'where2meet-verification-v1', run_id: 'new-owned-run', run_dir: path.join(directory, 'candidate') };
  await mkdir(run.run_dir, { mode: 0o700 });
  await writeFile(path.join(run.run_dir, 'run.json'), JSON.stringify(run));
  return { directory, source, run };
}
async function bundle(t) {
  const context = await scratch(t); const input = fixture();
  const owner = await createBundle(path.join(context.directory, 'fixture'), context.source);
  await writeBundle(owner, context.source, input.rows, input.credentials);
  return { ...context, ...input, ...(await readBundle(owner.directory)) };
}

test('old commands retain minimal and accounts modes; populated and cleanup options are exact', () => {
  assert.equal(parseProfile([]), 'minimal'); assert.equal(parseProfile(['--accounts'], true), 'accounts');
  assert.equal(parseProfile(['--profile', 'populated-v1']), 'populated-v1'); assert.equal(parseProfile(['--cleanup-only'], true), 'cleanup');
  for (const options of [['--accounts'], ['--profile'], ['--profile', 'other'], ['--cleanup-only'], ['--profile', 'populated-v1', '--accounts']])
    assert.throws(() => parseProfile(options));
});
test('complete two-event graph resolves the one expired session and shared venue', () => {
  const { rows, credentials } = fixture();
  assert.deepEqual(auditGraph(rows, credentials), { publishedEventId: 'event-a', openEventId: 'event-b', sharedVenueId: 'place-shared', expiredSessionId: 'session-expired' });
});
for (const [name, mutate] of [
  ['missing model row', rows => rows.votes.pop()],
  ['duplicate row ID', rows => { rows.votes[1].id = rows.votes[0].id; }],
  ['cross-event vote', rows => { rows.votes[0].participantId = 'organizer-b'; }],
  ['foreign venue', rows => { rows.votes[0].venueId = 'foreign'; }],
  ['partial publication', rows => { rows.events[1].publishedAt = '2026-01-01T00:00:00.000Z'; }],
  ['wrong claim role', rows => { rows.userEvents[0].role = 'participant'; }],
  ['foreign identity', rows => { rows.userIdentities[0].userId = 'foreign'; }],
  ['invalid expired session', rows => { rows.userSessions[1].expiresAt = '2099-01-01T00:00:00.000Z'; }],
]) test(`graph rejects ${name}`, () => { const { rows, credentials } = fixture(); mutate(rows); assert.throws(() => auditGraph(rows, credentials)); });
test('credential bindings fail without exposing values', () => {
  const { rows, credentials } = fixture(); credentials.participants[0].token = 'pt_PRIVATE-CANARY';
  assert.throws(() => auditGraph(rows, credentials), error => !error.message.includes('CANARY') && /binding/.test(error.message));
});
test('full row comparison rejects extras, missing rows, hash changes and unlisted field changes', () => {
  const { rows } = fixture(); compareRows(clone(rows), rows);
  for (const mutate of [actual => actual.users.push({ id: 'extra' }), actual => actual.votes.pop(),
    actual => { actual.userIdentities[0].passwordHash = 'SECRET-CHANGED'; }, actual => { actual.events[0].unexpected = true; }]) {
    const actual = clone(rows); mutate(actual);
    assert.throws(() => compareRows(actual, rows), error => !/PRIVATE|SECRET/.test(error.message));
  }
});
test('only exact known expired session removal passes the post-auth row comparison', () => {
  const { rows } = fixture(); const after = { ...rows, userSessions: rows.userSessions.slice(0, 1) };
  compareRows(clone(after), after);
  assert.throws(() => compareRows(rows, after));
  assert.throws(() => compareRows({ ...after, userSessions: [] }, after));
});
test('both importer result counts are exact', () => {
  const first = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, { inserted: value, unchanged: 0 }]));
  const retry = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, { inserted: 0, unchanged: value }]));
  assertImportCounts(first, true); assertImportCounts(retry, false);
  assert.throws(() => assertImportCounts(first, false)); delete first.votes;
  assert.throws(() => assertImportCounts(first, true));
});
test('private manifest binds graph, provenance and both digests', async t => {
  const value = await bundle(t);
  assert.equal(value.manifest.source.runId, value.source.run_id);
  assert.equal(value.manifest.ids.votes.length, 3);
  assert.equal((await lstat(value.owner.directory)).mode & 0o777, 0o700);
  for (const name of ['owner.json', 'rows.json', 'credentials.json', 'manifest.json']) assert.equal((await lstat(path.join(value.owner.directory, name))).mode & 0o777, 0o600);
  await writeFile(path.join(value.owner.directory, 'credentials.json'), '{}\n');
  await assert.rejects(readBundle(value.owner.directory), /digest/);
});
test('bundle refuses symlink file and world-readable credentials', async t => {
  const value = await bundle(t); const credentialPath = path.join(value.owner.directory, 'credentials.json');
  await chmod(credentialPath, 0o644); await assert.rejects(readBundle(value.owner.directory), /mode/);
  await chmod(credentialPath, 0o600);
  const elsewhere = path.join(value.directory, 'credentials-copy'); await writeFile(elsewhere, await readFile(credentialPath), { mode: 0o600 });
  await rm(credentialPath); await symlink(elsewhere, credentialPath);
  await assert.rejects(readBundle(value.owner.directory), /mode/);
  await assert.rejects(removeBundle(value.owner), /mode/);
});
test('exclusive creation refuses existing private artifacts', async t => {
  const value = await bundle(t);
  await assert.rejects(createBundle(value.owner.directory, value.source), { code: 'EEXIST' });
  assert.equal((await readBundle(value.owner.directory)).manifest.rowsSha256, value.manifest.rowsSha256);
});
test('owner-write failure removes only its newly created empty directory', async t => {
  const { directory, source } = await scratch(t); const target = path.join(directory, 'fixture');
  await assert.rejects(createBundle(target, { ...source, run_id: 1n }), /BigInt/);
  await assert.rejects(lstat(target), { code: 'ENOENT' });
});
test('partial export failure can remove its receipt-bound bundle without touching a sibling', async t => {
  const { directory, source } = await scratch(t); const sibling = path.join(directory, 'unrelated');
  await writeFile(sibling, 'retain'); const owner = await createBundle(path.join(directory, 'fixture'), source);
  await writeFile(path.join(owner.directory, 'rows.json'), 'partial private output', { mode: 0o600 });
  await removeBundle(owner);
  await assert.rejects(lstat(owner.directory), { code: 'ENOENT' }); assert.equal(await readFile(sibling, 'utf8'), 'retain');
});
test('claimed failed import cleans its runtime first and only its private bundle; retry cleanup is safe', async t => {
  const value = await bundle(t); const receipt = await claimCandidate(value.run, value);
  await writeFile(path.join(value.run.run_dir, 'import-failed.json'), '{"status":"FAIL"}');
  let stopped = 0;
  const stop = async () => { assert((await lstat(value.owner.directory)).isDirectory()); stopped++; };
  assert.deepEqual(await cleanupCandidate(value.run, receipt, stop), { runtime: true, private_bundle: true });
  assert.equal(stopped, 1); assert.equal(JSON.parse(await readFile(path.join(value.run.run_dir, 'import-failed.json'))).status, 'FAIL');
  assert.deepEqual(await cleanupCandidate(value.run, receipt, () => {}), { runtime: true, private_bundle: true });
});
test('runtime cleanup failure retains private artifacts and allows a later cleanup', async t => {
  const value = await bundle(t); const receipt = await claimCandidate(value.run, value);
  await assert.rejects(cleanupCandidate(value.run, receipt, () => { throw new Error('owned process remains'); }), /remains/);
  await readBundle(value.owner.directory);
  await cleanupCandidate(value.run, receipt, () => {});
});
test('a second writer cannot claim either the consumed fixture or an already-owned candidate', async t => {
  const value = await bundle(t); await claimCandidate(value.run, value);
  await assert.rejects(claimCandidate({ ...value.run, run_id: 'other' }, value), { code: 'EEXIST' });
  const another = await createBundle(path.join(value.directory, 'other-fixture'), value.source);
  await writeBundle(another, value.source, value.rows, value.credentials);
  await assert.rejects(claimCandidate(value.run, await readBundle(another.directory)), { code: 'EEXIST' });
  await assert.rejects(lstat(path.join(another.directory, 'consumer.json')), { code: 'ENOENT' });
});
test('export ownership is exclusive per source run, including different private bundle paths', async t => {
  const { run } = await scratch(t);
  const database = Object.fromEntries(Object.values(models).map(model => [model, { findMany: async () => [] }]));
  const owner = await claimExporter(run, database);
  await assert.rejects(claimExporter(run, database), { code: 'EEXIST' });
  assert.deepEqual(JSON.parse(await readFile(path.join(run.run_dir, 'migration-export-owner.json'))), owner);
});
test('nonempty legacy source refuses acceptance without returning an automatic-cleanup owner', async t => {
  const { run } = await scratch(t); const existing = [{ id: 'preexisting' }];
  const database = Object.fromEntries(Object.values(models).map(model => [model, { findMany: async () => model === 'event' ? existing : [] }]));
  let accepted;
  await assert.rejects(async () => { accepted = await claimExporter(run, database); }, /empty business tables; source preserved/);
  assert.equal(accepted, undefined); assert.deepEqual(existing, [{ id: 'preexisting' }]);
  assert.equal(JSON.parse(await readFile(path.join(run.run_dir, 'run.json'))).run_id, run.run_id);
});
test('cleanup rejects changed owner, extra files and live foreign owner', async t => {
  const value = await bundle(t); const receipt = await claimCandidate(value.run, value);
  await assert.rejects(removeBundle({ ...value.owner, nonce: 'changed' }), /ownership/);
  await writeFile(path.join(value.owner.directory, 'unknown'), 'retain', { mode: 0o600 });
  await assert.rejects(removeBundle(value.owner), /unexpected/); await rm(path.join(value.owner.directory, 'unknown'));
  const parentIdentity = spawnSync('ps', ['-p', String(process.ppid), '-o', 'lstart='], { encoding: 'utf8' }).stdout.trim();
  await writeFile(path.join(value.run.run_dir, 'migration-owner.json'), JSON.stringify({ ...receipt, pid: process.ppid, processIdentity: parentIdentity }));
  await assert.rejects(cleanupReceipt(value.run), /active/);
});
test('interrupted candidate receipt before consumer claim is recoverable without import', async t => {
  const value = await bundle(t); const receipt = await claimCandidate(value.run, value);
  await rm(path.join(value.owner.directory, 'consumer.json'));
  let stopped = false;
  await cleanupCandidate(value.run, receipt, () => { stopped = true; });
  assert.equal(stopped, true); await assert.rejects(lstat(value.owner.directory), { code: 'ENOENT' });
});
test('a foreign consumer is rejected before any runtime or private cleanup', async t => {
  const value = await bundle(t); const receipt = await claimCandidate(value.run, value);
  const other = { ...receipt, runId: 'other-run' };
  await writeFile(path.join(value.owner.directory, 'consumer.json'), JSON.stringify(other));
  await assert.rejects(cleanupCandidate(value.run, receipt, () => assert.fail('must not stop')), /consumer/);
  assert.deepEqual(JSON.parse(await readFile(path.join(value.owner.directory, 'consumer.json'))), other);
});
test('cleanup refuses an active kernel lock and reuses its retained file after release', async t => {
  const value = await bundle(t); const receipt = await claimCandidate(value.run, value);
  const release = await acquireCleanupLock(value.run.run_dir);
  try { await assert.rejects(cleanupCandidate(value.run, receipt, () => assert.fail('must not stop')), /lock/); }
  finally { await release(); }
  assert((await lstat(path.join(value.run.run_dir, 'migration-cleanup.lock'))).isFile());
  await cleanupCandidate(value.run, receipt, () => {});
});
test('owner process death closes the lock pipe and permits cleanup without deleting the lock file', async t => {
  const { run } = await scratch(t);
  const module = new URL('./migration-fixture.mjs', import.meta.url).href;
  const child = spawn(process.execPath, ['--input-type=module', '-e',
    `import { acquireCleanupLock } from ${JSON.stringify(module)}; await acquireCleanupLock(process.argv[1]); process.stdout.write('ready\\n'); await new Promise(() => {});`, run.run_dir],
  { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill(); });
  child.stderr.resume();
  await once(child.stdout, 'data');
  await assert.rejects(acquireCleanupLock(run.run_dir), /lock/);
  const closed = once(child, 'exit'); child.kill('SIGKILL'); await closed;
  let release;
  const deadline = Date.now() + 5000;
  while (!release && Date.now() < deadline) {
    try { release = await acquireCleanupLock(run.run_dir); }
    catch { await new Promise(resolve => setTimeout(resolve, 20)); }
  }
  assert(release, 'Kernel lock did not recover after owner pipe closed'); await release();
});
const place = { id: 'place-shared', name: 'Current Google name', address: '', location: { lat: 32.12345675, lng: -117.12345675 },
  types: ['cafe'], rating: 4.55, priceLevel: 2, photoUrl: 'http://127.0.0.1:1234/api/venues/place-shared/photo' };
test('observed venue projection uses database decimal rounding and relative photo endpoint', () => {
  const row = refreshedVenue(fixture().rows.venues[0], place, Decimal);
  assert.equal(row.lat, '32.1234568'); assert.equal(row.lng, '-117.1234568'); assert.equal(row.rating, '4.6');
  assert.equal(row.address, null); assert.equal(row.photoUrl, '/api/venues/place-shared/photo');
  assert.throws(() => refreshedVenue(row, { ...place, photoUrl: 'https://example.com/foreign?key=PRIVATE' }, Decimal));
});
test('browser permits only one observed venue refresh; immutable fields and every other row remain exact', () => {
  const { rows } = fixture(); const started = Date.parse('2026-10-05T00:00:00.000Z');
  const updated = new Date(started + 100).toISOString();
  const actual = { ...clone(rows), venues: [{ ...refreshedVenue(rows.venues[0], place, Decimal), updatedAt: updated }] };
  compareAfterBrowser(actual, rows, [{ ...place, name: 'Earlier' }, place], Decimal, started, started + 1000);
  for (const mutate of [value => { value.venues[0].createdAt = updated; }, value => { value.venues[0].name = 'Unobserved'; },
    value => { value.venues[0].updatedAt = '2099-01-01T00:00:00.000Z'; }, value => value.votes.pop(), value => value.venues.push({ id: 'foreign' })]) {
    const changed = clone(actual); mutate(changed); assert.throws(() => compareAfterBrowser(changed, rows, [place], Decimal, started, started + 1000));
  }
  assert.throws(() => compareAfterBrowser(actual, rows, [], Decimal, started, started + 1000));
});
