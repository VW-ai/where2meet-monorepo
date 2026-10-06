import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rm, rmdir, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const models = Object.freeze({ events: 'event', participants: 'participant', users: 'user',
  userSessions: 'userSession', userIdentities: 'userIdentity', userEvents: 'userEvent', venues: 'venue', votes: 'vote' });
export const counts = Object.freeze({ events: 2, participants: 3, users: 1, userSessions: 2,
  userIdentities: 1, userEvents: 2, venues: 1, votes: 3 });
const files = new Set(['owner.json', 'rows.json', 'credentials.json', 'manifest.json', 'consumer.json']);
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const normalize = value => JSON.parse(JSON.stringify(value));
export async function verifierIdentity() {
  return Object.fromEntries(await Promise.all(['control.py', 'legacy-fixture.mjs', 'migration-proof.mjs', 'migration-fixture.mjs']
    .map(async name => [name, sha256(await readFile(new URL(name, import.meta.url)))])));
}
export async function assertVerifierUnchanged(original) {
  requireProof(isDeepStrictEqual(await verifierIdentity(), original), 'Verification helpers changed during rehearsal');
}
export class ProofFailure extends Error {}
export function requireProof(value, message) { if (!value) throw new ProofFailure(message); }
export function parseProfile(options, accounts = false) {
  if (options.length === 0) return 'minimal';
  if (accounts && options.length === 1 && options[0] === '--accounts') return 'accounts';
  if (options.length === 2 && options[0] === '--profile' && options[1] === 'populated-v1') return 'populated-v1';
  if (accounts && options.length === 1 && options[0] === '--cleanup-only') return 'cleanup';
  throw new Error('Unknown migration fixture option');
}
export const rowIds = rows => Object.fromEntries(Object.keys(models).map(key => [key, rows[key].map(row => row.id).sort()]));

export function auditGraph(rows, credentials) {
  requireProof(rows.version === 1, 'Fixture version must be 1');
  for (const [model, count] of Object.entries(counts)) {
    requireProof(Array.isArray(rows[model]) && rows[model].length === count, `${model}: populated fixture count mismatch`);
    requireProof(new Set(rows[model].map(row => row.id)).size === count, `${model}: duplicate row IDs`);
  }
  const published = rows.events.filter(event => event.publishedVenueId !== null);
  const open = rows.events.filter(event => event.publishedVenueId === null);
  requireProof(published.length === 1 && open.length === 1 && published[0].publishedAt !== null && open[0].publishedAt === null,
    'events: expected one published and one open meeting');
  const venue = rows.venues[0];
  requireProof(published[0].publishedVenueId === venue.id, 'events.publishedVenueId: outside fixture');
  const user = rows.users[0];
  requireProof(rows.userIdentities[0].userId === user.id && rows.userIdentities[0].provider === 'email', 'userIdentities: account relationship mismatch');
  requireProof(rows.userSessions.every(row => row.userId === user.id), 'userSessions: account relationship mismatch');
  requireProof(rows.participants.every(row => rows.events.some(event => event.id === row.eventId)), 'participants.eventId: outside fixture');
  for (const event of rows.events) {
    const people = rows.participants.filter(row => row.eventId === event.id);
    requireProof(people.length === (event === published[0] ? 2 : 1) && people.filter(row => row.isOrganizer).length === 1,
      'participants: event membership or organizer mismatch');
    const votes = rows.votes.filter(row => row.eventId === event.id);
    requireProof(votes.length === people.length && new Set(votes.map(row => row.participantId)).size === people.length,
      'votes: duplicate or missing participant vote');
    requireProof(votes.every(row => row.venueId === venue.id && people.some(person => person.id === row.participantId)),
      'votes: cross-event or foreign venue relationship');
    const links = rows.userEvents.filter(row => row.eventId === event.id);
    requireProof(links.length === 1 && links[0].userId === user.id && links[0].role === 'organizer' &&
      links[0].participantId === people.find(row => row.isOrganizer).id, 'userEvents: organizer claim mismatch');
  }
  requireProof(credentials.participants?.length === 3 && new Set(credentials.participants.map(row => row.participantId)).size === 3,
    'credentials: participant membership mismatch');
  for (const credential of credentials.participants) {
    const person = rows.participants.find(row => row.id === credential.participantId);
    requireProof(person && credential.eventId === person.eventId && typeof credential.token === 'string' &&
      credential.token.startsWith('pt_') && sha256(credential.token) === person.tokenHash, 'credentials: participant binding mismatch');
  }
  const account = credentials.account;
  requireProof(account?.userId === user.id && account.email === user.email && typeof account.password === 'string', 'credentials: account binding mismatch');
  const sessions = ['validCookie', 'expiredCookie'].map(key => {
    requireProof(typeof account[key] === 'string' && /^session_token=st_[a-f0-9]+$/.test(account[key]), 'credentials: session format mismatch');
    return rows.userSessions.find(row => row.tokenHash === sha256(account[key].slice('session_token='.length)));
  });
  requireProof(sessions.every(Boolean) && sessions[0].id !== sessions[1].id && Date.parse(sessions[0].expiresAt) > Date.now() &&
    sessions[1].expiresAt === '2000-01-01T00:00:00.000Z', 'credentials: session expiration mismatch');
  return { publishedEventId: published[0].id, openEventId: open[0].id, sharedVenueId: venue.id, expiredSessionId: sessions[1].id };
}

export async function allRows(db) {
  return { version: 1, ...Object.fromEntries(await Promise.all(Object.entries(models).map(async ([key, delegate]) =>
    [key, normalize(await db[delegate].findMany())]))) };
}
export function compareRows(actual, expected) {
  for (const model of Object.keys(models)) {
    const sort = rows => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const found = sort(actual[model]); const wanted = sort(expected[model]);
    requireProof(isDeepStrictEqual(found.map(row => row.id), wanted.map(row => row.id)), `${model}: complete row set changed`);
    for (let index = 0; index < wanted.length; index++) {
      const keys = new Set([...Object.keys(wanted[index]), ...Object.keys(found[index])]);
      for (const key of keys) requireProof(isDeepStrictEqual(found[index][key], wanted[index][key]), `${model}.${key}: stored field changed; values omitted`);
    }
  }
}
export function assertImportCounts(result, inserted) {
  requireProof(isDeepStrictEqual(Object.keys(result).sort(), Object.keys(models).sort()), 'Importer result model set mismatch');
  for (const [key, count] of Object.entries(counts)) requireProof(isDeepStrictEqual(result[key],
    { inserted: inserted ? count : 0, unchanged: inserted ? 0 : count }), `${key}: importer count mismatch`);
}

async function privatePath(directory, existing) {
  const absolute = path.resolve(directory);
  const parent = await realpath(path.dirname(absolute));
  const canonical = path.join(parent, path.basename(absolute));
  const repository = spawnSync('git', ['-C', parent, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  requireProof(!repository.error && repository.status === 128 && repository.stderr.includes('not a git repository'),
    'Private fixture must be verifiably outside every Git checkout');
  if (existing) {
    const stat = await lstat(canonical);
    requireProof(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700,
      'Private fixture directory ownership or mode changed');
    requireProof(await realpath(canonical) === canonical, 'Private fixture directory resolves through a symlink');
  }
  return canonical;
}
async function privateFile(directory, name) {
  const target = path.join(directory, name); const stat = await lstat(target);
  requireProof(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.uid === process.getuid() &&
    (stat.mode & 0o777) === 0o600, 'Private fixture file ownership or mode changed');
  return readFile(target, 'utf8');
}
const writePrivate = (directory, name, value) => writeFile(path.join(directory, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
export async function createBundle(directory, source) {
  const canonical = await privatePath(directory, false);
  await mkdir(canonical, { mode: 0o700 });
  const owner = { kind: 'where2meet-private-fixture-owner-v1', nonce: randomUUID(), directory: canonical, sourceRunId: source.run_id };
  try { await writePrivate(canonical, 'owner.json', owner); }
  catch (error) { await rmdir(canonical); throw error; }
  return owner;
}
export async function writeBundle(owner, source, rows, credentials) {
  const graph = auditGraph(rows, credentials);
  await writePrivate(owner.directory, 'rows.json', rows);
  await writePrivate(owner.directory, 'credentials.json', credentials);
  const manifest = { kind: 'where2meet-legacy-fixture-v1', profile: 'populated-v1',
    source: { runId: source.run_id, runDirectory: source.run_dir, commit: source.source_commit, fingerprint: source.source_fingerprint },
    rowsSha256: sha256(await privateFile(owner.directory, 'rows.json')),
    credentialsSha256: sha256(await privateFile(owner.directory, 'credentials.json')), ids: rowIds(rows), ...graph,
    verifier: await verifierIdentity() };
  await writePrivate(owner.directory, 'manifest.json', manifest);
  return manifest;
}
export async function readBundle(directory) {
  directory = await privatePath(directory, true);
  const owner = JSON.parse(await privateFile(directory, 'owner.json'));
  requireProof(owner.kind === 'where2meet-private-fixture-owner-v1' && owner.directory === directory && typeof owner.nonce === 'string', 'Private ownership receipt mismatch');
  const manifest = JSON.parse(await privateFile(directory, 'manifest.json'));
  const rawRows = await privateFile(directory, 'rows.json'); const rawCredentials = await privateFile(directory, 'credentials.json');
  requireProof(manifest.kind === 'where2meet-legacy-fixture-v1' && manifest.profile === 'populated-v1' &&
    manifest.rowsSha256 === sha256(rawRows) && manifest.credentialsSha256 === sha256(rawCredentials), 'Private bundle identity or digest mismatch');
  requireProof(owner.sourceRunId === manifest.source.runId, 'Private bundle source ownership mismatch');
  const rows = JSON.parse(rawRows); const credentials = JSON.parse(rawCredentials);
  const graph = auditGraph(rows, credentials);
  requireProof(isDeepStrictEqual(manifest.ids, rowIds(rows)) && Object.entries(graph).every(([key, value]) => manifest[key] === value), 'Manifest graph does not match rows');
  return { owner, manifest, rows, credentials };
}
export async function removeBundle(owner) {
  const directory = await validateOwnedBundle(owner);
  await rm(directory, { recursive: true });
}
async function validateOwnedBundle(owner) {
  const directory = await privatePath(owner.directory, true);
  requireProof(isDeepStrictEqual(JSON.parse(await privateFile(directory, 'owner.json')), owner), 'Private cleanup ownership mismatch');
  for (const name of await readdir(directory)) {
    requireProof(files.has(name), 'Private cleanup refused an unexpected file');
    await privateFile(directory, name);
  }
  return directory;
}
function ownerProcess() { return { pid: process.pid, processIdentity: processIdentity(process.pid) }; }
function processIdentity(pid) {
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'stat=', '-o', 'lstart='], { encoding: 'utf8' });
  requireProof(!result.error && [0, 1].includes(result.status), 'Owner process identity inspection unavailable');
  const parts = (result.stdout ?? '').trim().match(/^(\S+)\s+(.+)$/);
  requireProof(result.status === 0 ? Boolean(parts) : !result.stdout.trim() && !result.stderr.trim(), 'Owner process identity inspection unavailable');
  return result.status === 0 && parts && !parts[1].startsWith('Z') ? parts[2] : null;
}
export async function claimExporter(run, database) {
  const receipt = { kind: 'where2meet-export-owner-v1', runId: run.run_id, runDirectory: run.run_dir, ...ownerProcess() };
  requireProof(receipt.processIdentity, 'Exporter process identity unavailable');
  await writePrivate(run.run_dir, 'migration-export-owner.json', receipt);
  const rows = await allRows(database);
  requireProof(Object.keys(models).every(key => rows[key].length === 0), 'Legacy fixture requires empty business tables; source preserved');
  return receipt;
}
export async function claimCandidate(run, bundle) {
  const receipt = { kind: 'where2meet-import-owner-v1', runId: run.run_id, runDirectory: run.run_dir,
    fixture: bundle.owner, rowsSha256: bundle.manifest.rowsSha256, ids: bundle.manifest.ids, ...ownerProcess() };
  requireProof(receipt.processIdentity, 'Candidate process identity unavailable');
  await writePrivate(run.run_dir, 'migration-owner.json', receipt);
  try { await writePrivate(bundle.owner.directory, 'consumer.json', receipt); }
  catch (error) { await rm(path.join(run.run_dir, 'migration-owner.json')); throw error; }
  return receipt;
}
export async function cleanupReceipt(run) {
  const receipt = JSON.parse(await privateFile(run.run_dir, 'migration-owner.json'));
  requireProof(receipt.kind === 'where2meet-import-owner-v1' && receipt.runId === run.run_id && receipt.runDirectory === run.run_dir,
    'Candidate cleanup ownership mismatch');
  requireProof(Number.isSafeInteger(receipt.pid) && receipt.pid > 0 && typeof receipt.processIdentity === 'string', 'Candidate owner process receipt invalid');
  if (receipt.pid !== process.pid) requireProof(processIdentity(receipt.pid) !== receipt.processIdentity, 'Migration owner process is still active; cleanup refused');
  return receipt;
}

export async function acquireCleanupLock(runDirectory) {
  const child = spawn('python3', [fileURLToPath(new URL('./control.py', import.meta.url)), 'hold-import-cleanup', '--run', runDirectory],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  child.stderr.resume();
  child.stdin.on('error', () => {});
  try { await new Promise((resolve, reject) => {
    let output = ''; let acquired = false;
    const failed = () => { clearTimeout(timer); if (!acquired) reject(new ProofFailure('Import cleanup lock unavailable or held by another owner')); };
    const timer = setTimeout(() => { child.stdin.destroy(); child.kill(); failed(); }, 5000);
    child.once('error', failed); child.once('exit', failed);
    child.stdout.on('data', bytes => {
      output += bytes;
      if (output === 'IMPORT_CLEANUP_LOCKED\n') { acquired = true; clearTimeout(timer); resolve(); }
    });
  }); } catch (error) {
    child.stdin.destroy();
    if (child.exitCode === null && child.signalCode === null && child.pid) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill(); await exited;
    }
    throw error;
  }
  return async () => {
    requireProof(child.exitCode === null && child.signalCode === null, 'Cleanup lock holder exited unexpectedly');
    const exited = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new ProofFailure('Cleanup lock holder did not exit')); }, 5000);
      child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new ProofFailure('Cleanup lock holder exited unexpectedly')); });
    });
    child.stdin.end();
    await exited;
  };
}

export async function cleanupCandidate(run, receipt, stopRuntime) {
  requireProof(isDeepStrictEqual(await cleanupReceipt(run), receipt), 'Candidate cleanup receipt changed');
  const release = await acquireCleanupLock(run.run_dir);
  const result = { runtime: false, private_bundle: false };
  try {
    let exists = true;
    try { await lstat(receipt.fixture.directory); } catch (error) { if (error.code === 'ENOENT') exists = false; else throw error; }
    if (exists) {
      await validateOwnedBundle(receipt.fixture);
      try { await privateFile(receipt.fixture.directory, 'consumer.json'); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        try { await writePrivate(receipt.fixture.directory, 'consumer.json', receipt); }
        catch (claimError) { if (claimError.code !== 'EEXIST') throw claimError; }
      }
      requireProof(isDeepStrictEqual(JSON.parse(await privateFile(receipt.fixture.directory, 'consumer.json')), receipt), 'Private cleanup consumer changed');
    }
    await stopRuntime(); result.runtime = true;
    if (exists) await removeBundle(receipt.fixture);
    result.private_bundle = true;
    return result;
  } finally { await release(); }
}

export function refreshedVenue(original, place, Decimal) {
  requireProof(place?.id === original.id && typeof place.name === 'string' && Number.isFinite(place.location?.lat) &&
    Number.isFinite(place.location?.lng) && Array.isArray(place.types), 'Observed provider response does not describe the owned venue');
  const decimal = (value, scale) => new Decimal(value).toDecimalPlaces(scale, Decimal.ROUND_HALF_UP).toString();
  const photo = place.photoUrl === null ? null : new URL(place.photoUrl);
  const photoPath = `/api/venues/${encodeURIComponent(place.id)}/photo`;
  requireProof(photo === null || photo.pathname === photoPath && !photo.search && !photo.hash && !photo.username && !photo.password,
    'Observed provider photo is not the relative owned venue endpoint');
  return { ...original, name: place.name, address: place.address || null, lat: decimal(place.location.lat, 7),
    lng: decimal(place.location.lng, 7), category: place.types[0] ?? null, rating: place.rating === null ? null : decimal(place.rating, 1),
    priceLevel: place.priceLevel, photoUrl: photo === null ? null : photoPath };
}
export function compareAfterBrowser(actual, expected, observations, Decimal, startedAt, endedAt) {
  requireProof(observations.length > 0, 'No successful owned venue detail response was observed');
  requireProof(actual.venues.length === 1, 'venues: complete row set changed');
  const row = actual.venues[0];
  requireProof(Date.parse(row.updatedAt) >= startedAt && Date.parse(row.updatedAt) <= endedAt, 'venues.updatedAt: outside browser refresh window');
  requireProof(observations.some(place => isDeepStrictEqual({ ...refreshedVenue(expected.venues[0], place, Decimal), updatedAt: row.updatedAt }, row)),
    'venues: final summary does not match an observed provider response');
  compareRows({ ...actual, venues: expected.venues }, expected);
}
