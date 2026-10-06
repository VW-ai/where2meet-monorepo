import assert from 'node:assert/strict';
import test from 'node:test';
import { browserRequestAllowed, candidate, proofRequestAllowed, refreshWindow, remoteKind, runtimeEnvironment, validateBrowserResponse } from './migration-remote.mjs';

const directory = '/tmp/owned-import';
const local = { kind: 'where2meet-verification-v1', run_dir: directory, status: 'ready', schema_mode: 'migrations', backend_mode: 'compiled',
  source_status: '', frontend_status: '', ports: { postgres: 5544 }, database_url: 'postgresql://verify@127.0.0.1:5544/where2meet_verify' };
const remote = { ...local, kind: remoteKind, backend_mode: 'railway-ppe', ports: { frontend: 4317 }, tunnel: { port: 5545 },
  source_copy: directory + '/runtime/app', client_url: 'http://127.0.0.1:4317', backend_url: 'https://owned.example', target: { railway: { backend_origin: 'https://owned.example' } } };
delete remote.database_url;
const environment = { DATABASE_URL: 'postgresql://test:placeholder@127.0.0.1:5545/where2meet_import' };
const bundle = { rows: { events: [{ id: 'event-a' }, { id: 'event-b' }], userEvents: [{ eventId: 'event-a', participantId: 'person-a' }] },
  manifest: { sharedVenueId: 'place/one' }, credentials: { participants: [{ participantId: 'person-a', eventId: 'event-a', token: 'pt_test_a' }],
    account: { email: 'fixture@example.test', password: 'synthetic-password', validCookie: 'session_token=st_valid', expiredCookie: 'session_token=st_expired' } } };

test('local candidate keeps its database instead of trusting a remote environment override', () => {
  assert.deepEqual(candidate(local, directory, environment), { remote: false, databaseUrl: local.database_url });
  for (const database_url of ['postgresql://verify@example.test:5544/where2meet_verify', 'postgresql://verify@127.0.0.1:5545/where2meet_verify',
    'postgresql://verify@127.0.0.1:5544/where2meet_import']) assert.throws(() => candidate({ ...local, database_url }, directory, environment));
});

test('remote candidate requires explicit kind, receipt tunnel port and a memory-only database URL', () => {
  assert.deepEqual(candidate(remote, directory, environment), { remote: true, databaseUrl: environment.DATABASE_URL });
  for (const changes of [{ kind: 'other' }, { backend_mode: 'compiled' }, { database_url: environment.DATABASE_URL },
    { tunnel: { port: 5546 } }, { source_copy: '/other/runtime/app' }, { backend_url: 'https://foreign.example' }]) {
    assert.throws(() => candidate({ ...remote, ...changes }, directory, environment));
  }
  assert.throws(() => candidate(remote, directory, {}));
  assert.throws(() => candidate(remote, '/other', environment));
});

test('importer and browser environment excludes provider credentials, key paths, and inherited database URLs', () => {
  assert.deepEqual(runtimeEnvironment({ PATH: '/bin', HOME: '/tmp/home', TMPDIR: '/tmp', RAILWAY_TOKEN: 'synthetic', RAILWAY_API_TOKEN: 'synthetic',
    PPE_SSH_KEY: '/private/key', PPE_SSH_KNOWN_HOSTS: '/private/hosts', DATABASE_URL: 'synthetic', NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: 'synthetic' }),
  { PATH: '/bin', HOME: '/tmp/home', TMPDIR: '/tmp' });
});

test('browser admits only the two meeting reads, one place and anonymous proxy session', () => {
  const allowed = ['/api/events/event-a', '/api/events/event-b', '/api/events/event-a/votes', '/api/events/event-b/votes',
    '/api/venues/place%2Fone', '/api/venues/place%2Fone/photo'];
  for (const route of allowed) assert.equal(browserRequestAllowed(remote, bundle, 'GET', remote.backend_url + route), true);
  assert.equal(browserRequestAllowed(remote, bundle, 'GET', remote.client_url + '/api/auth/session'), true);
  for (const url of [remote.backend_url + '/api/events/foreign', remote.backend_url + '/api/events/event-a/me',
    remote.backend_url + '/api/venues/place%2Ftwo', remote.backend_url + '/api/events/event-a?extra=1',
    remote.client_url + '/api/users/me/events', 'https://foreign.example/api/events/event-a', 'https://user:password@owned.example/api/events/event-a']) {
    assert.equal(browserRequestAllowed(remote, bundle, 'GET', url), false);
  }
  for (const method of ['POST', 'DELETE', 'PATCH']) assert.equal(browserRequestAllowed(remote, bundle, method, remote.backend_url + allowed[0]), false);
});

test('credential proof bounds tokens, account writes and newly observed sessions', () => {
  assert.equal(proofRequestAllowed(bundle, '/api/events/event-a/me', { token: 'pt_test_a' }), true);
  assert.equal(proofRequestAllowed(bundle, '/api/events/event-b/me', { token: 'pt_test_a' }), true);
  assert.equal(proofRequestAllowed(bundle, '/api/events/event-a/me', { token: 'pt_foreign' }), false);
  assert.equal(proofRequestAllowed(bundle, '/api/events/foreign/me', { token: 'pt_test_a' }), false);
  const login = { method: 'POST', proxy: true, body: { email: 'fixture@example.test', password: 'synthetic-password' } };
  assert.equal(proofRequestAllowed(bundle, '/api/auth/login', login), true);
  assert.equal(proofRequestAllowed(bundle, '/api/auth/login', { ...login, body: { ...login.body, extra: true } }), false);
  assert.equal(proofRequestAllowed(bundle, '/api/auth/register', login), false);
  const claim = { method: 'POST', proxy: true, cookie: 'session_token=st_valid', body: { eventId: 'event-a', participantToken: 'pt_test_a' } };
  assert.equal(proofRequestAllowed(bundle, '/api/users/me/events/claim', claim), true);
  assert.equal(proofRequestAllowed(bundle, '/api/users/me/events/claim', { ...claim, body: { ...claim.body, eventId: 'event-b' } }), false);
  assert.equal(proofRequestAllowed(bundle, '/api/auth/session', { proxy: true, cookie: 'session_token=st_unobserved' }), false);
  const sessions = new Set(['session_token=st_new']);
  assert.equal(proofRequestAllowed(bundle, '/api/auth/logout', { proxy: true, method: 'POST', cookie: 'session_token=st_new' }, sessions), true);
  assert.equal(proofRequestAllowed(bundle, '/api/auth/logout', { proxy: true, method: 'POST', cookie: 'session_token=st_new', body: {} }, sessions), false);
});

test('only the owned photo may redirect to the validated public Google image origin', () => {
  const photo = remote.backend_url + '/api/venues/place%2Fone/photo';
  const headers = { location: 'https://lh3.googleusercontent.com/places/public-image', 'cache-control': 'no-store' };
  assert.doesNotThrow(() => validateBrowserResponse(remote, bundle, photo, 302, headers));
  for (const route of ['/api/events/event-a', '/api/events/event-a/votes', '/api/venues/place%2Fone', '/api/venues/foreign/photo']) {
    assert.throws(() => validateBrowserResponse(remote, bundle, remote.backend_url + route, 302, headers));
  }
  assert.throws(() => validateBrowserResponse(remote, bundle, remote.client_url + '/api/auth/session', 302, headers));
  for (const location of ['https://foreign.example/photo', 'http://lh3.googleusercontent.com/photo', 'https://lh3.googleusercontent.com/photo?key=synthetic']) {
    assert.throws(() => validateBrowserResponse(remote, bundle, photo, 302, { ...headers, location }));
  }
  assert.throws(() => validateBrowserResponse(remote, bundle, photo, 307, headers));
});

test('refresh time uses measured server offset instead of workstation timezone or arbitrary tolerance', () => {
  const observations = [{ started: 1000, ended: 1020, server: 6010 }, { started: 2000, ended: 2040, server: 7020 }];
  assert.deepEqual(refreshWindow(1100, 1900, observations), { startedAt: 6090, endedAt: 6910, offset: { lower: 4990, upper: 5010 }, observations });
  assert.throws(() => refreshWindow(1100, 1900, [observations[0], { started: 2000, ended: 2040, server: 8000 }]));
  assert.throws(() => refreshWindow(1100, 1900, [{ started: -10000, ended: 1020, server: 6010 }, observations[1]]));
  assert.throws(() => refreshWindow(1000, 1900, observations));
  assert.throws(() => refreshWindow(1100, 2050, observations));
});
