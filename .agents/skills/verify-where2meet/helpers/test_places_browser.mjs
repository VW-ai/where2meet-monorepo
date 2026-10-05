import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPpeDriver, validatePhotoRedirect } from './ppe-browser.mjs';
import { assertDirections, assertVenue, placesStoredProjection, runPlacesScenario } from './places-browser.mjs';

const backend = 'https://ppe.example.test';
const placeId = 'ChIJ_fixture_place';
const photoPath = `/api/venues/${placeId}/photo`;
const imageHeaders = { location: 'https://lh3.googleusercontent.com/fixture-image', 'cache-control': 'no-store' };
const venue = () => ({ id: placeId, name: 'Fixture cafe', address: 'Fixture address', location: { lat: 32.71, lng: -117.15 },
  types: ['cafe'], rating: null, userRatingsTotal: null, priceLevel: null, openNow: null, photoUrl: backend + photoPath });

async function guard({ status = 200, headers = {}, body = {}, rejectGuard = false } = {}) {
  let handler;
  const calls = [];
  const driver = await createPpeDriver('/unused-places-guard-fixture', {
    scenario: 'places-routes', client_url: 'http://127.0.0.1:4317', backend_url: backend,
  }, { async route(_match, callback) { handler = callback; } }, {
    async bridge(payload) {
      calls.push(payload.operation);
      if (rejectGuard && payload.operation === 'guard') throw new Error('Unknown place');
      return {};
    },
  });
  return { calls, driver, async send(pathname, method = 'GET') {
    let outcome;
    const url = pathname.startsWith('http') ? pathname : backend + pathname;
    await handler({
      request: () => ({ url: () => url, method: () => method, redirectedFrom: () => null, postDataJSON: () => ({ query: 'coffee' }),
        response: async () => ({ status: () => status, headers: () => headers }) }),
      async continue() { calls.push('continue'); outcome = 'continued'; },
      async fetch(options) {
        assert.equal(options.maxRedirects, 0);
        calls.push('fetch');
        return { status: () => status, headers: () => headers, json: async () => body };
      },
      async fulfill() { calls.push('fulfill'); outcome = 'fulfilled'; },
      async abort() { calls.push('abort'); outcome = 'blocked'; },
    });
    return outcome;
  } };
}

test('PPE records successful observed search IDs before the browser receives them', async () => {
  const run = await guard({ body: { venues: [venue()], totalResults: 1, searchCenter: { lat: 32.71, lng: -117.15 } } });
  assert.equal(await run.send('/api/venues/search', 'POST'), 'fulfilled');
  assert.deepEqual(run.calls, ['guard', 'fetch', 'record-places', 'postflight', 'fulfill']);
  run.driver.assertGuard();
});

test('PPE records the M3 guest before its successful join reaches the browser', async () => {
  const run = await guard({ status: 201, body: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' } });
  assert.equal(await run.send('/api/events/evt_fixture/participants', 'POST'), 'fulfilled');
  assert.deepEqual(run.calls, ['guard', 'fetch', 'record-participant', 'postflight', 'fulfill']);
});

test('only an allowed owned photo receives the public Google image redirect exception', async () => {
  const run = await guard({ status: 302, headers: imageHeaders });
  assert.equal(await run.send(photoPath), 'fulfilled');
  assert.deepEqual(run.calls, ['guard', 'fetch', 'postflight', 'fulfill']);
  run.driver.assertGuard();
  for (const pathname of [`/api/venues/${placeId}`, `/api/events/evt_fixture/venues/${placeId}/directions?travelMode=driving`]) {
    const redirected = await guard({ status: 302, headers: imageHeaders });
    assert.equal(await redirected.send(pathname), 'blocked');
    assert.throws(() => redirected.driver.assertGuard(), /blocked/);
  }
});

test('unrecorded venue/photo/directions requests never reach the backend fetch', async () => {
  for (const pathname of [photoPath, `/api/venues/${placeId}`, `/api/events/evt_fixture/venues/${placeId}/directions?travelMode=walking`]) {
    const run = await guard({ rejectGuard: true });
    assert.equal(await run.send(pathname), 'blocked');
    assert.deepEqual(run.calls, ['guard', 'abort']);
  }
});

test('finite owned-event reads reject redirects before forwarding them to the browser', async () => {
  for (const pathname of ['/api/events/evt_fixture', '/api/events/evt_fixture/me', '/api/events/evt_fixture/votes']) {
    const redirected = await guard({ status: 302, headers: { location: 'https://outside.example.test/page' } });
    assert.equal(await redirected.send(pathname), 'blocked');
    assert.deepEqual(redirected.calls, ['guard', 'fetch', 'abort']);
    assert.throws(() => redirected.driver.assertGuard(), /blocked/);
    const valid = await guard();
    assert.equal(await valid.send(pathname), 'fulfilled');
    assert.deepEqual(valid.calls, ['guard', 'fetch', 'postflight', 'fulfill']);
  }
});

test('owned SSE stays streamed and invalid observed headers or redirects fail the proof', async () => {
  const pathname = '/api/events/evt_fixture/stream';
  const valid = await guard({ headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
  assert.equal(await valid.send(pathname), 'continued');
  assert.deepEqual(valid.calls, ['guard', 'continue', 'postflight']);
  valid.driver.assertGuard();
  for (const [status, headers] of [[302, { location: 'https://outside.example.test/page' }],
    [200, { 'content-type': 'application/json' }], [403, { 'content-type': 'text/event-stream' }]]) {
    const invalid = await guard({ status, headers });
    assert.equal(await invalid.send(pathname), 'continued');
    assert.deepEqual(invalid.calls, ['guard', 'continue']);
    assert.throws(() => invalid.driver.assertGuard(), /blocked/);
  }
});

for (const heldPhase of ['guard', 'headers']) {
  test(`SSE remains pending during held ${heldPhase} and a later redirect preserves failed proof`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'places-pending-stream-'));
    await mkdir(path.join(directory, 'evidence'));
    let handler;
    let release;
    let reached;
    const gate = new Promise(resolve => { release = resolve; });
    const waiting = new Promise(resolve => { reached = resolve; });
    const hold = async () => { reached(); await gate; };
    const driver = await createPpeDriver(directory, { scenario: 'places-routes', backend_url: backend }, {
      async route(_match, callback) { handler = callback; },
    }, { async bridge(payload) { if (payload.operation === 'guard' && heldPhase === 'guard') await hold(); } });
    const request = { url: () => backend + '/api/events/evt_fixture/stream', method: () => 'GET', redirectedFrom: () => null,
      async response() {
        if (heldPhase === 'headers') await hold();
        return { status: () => 302, headers: () => ({ location: 'https://outside.example.test/page' }) };
      } };
    let continued = false;
    const pending = handler({ request: () => request, async continue() { continued = true; },
      async fetch() { assert.fail('SSE must not be buffered'); }, async abort() { assert.fail('This response was already continued'); } });
    try {
      await waiting;
      assert.equal(continued, heldPhase === 'headers');
      assert.throws(() => driver.assertGuard(), /validation has not completed/);
      await driver.evidence();
      const snapshot = JSON.parse(await readFile(path.join(directory, 'evidence/ppe-request-guards.json'), 'utf8'));
      assert.equal(snapshot.streaming_api.pending, 1);
      assert.deepEqual(snapshot.blocked, []);
      release();
      await pending;
      assert.throws(() => driver.assertGuard(), /blocked/);
      await driver.evidence();
      const completed = JSON.parse(await readFile(path.join(directory, 'evidence/ppe-request-guards.json'), 'utf8'));
      assert.equal(completed.streaming_api.pending, 0);
      assert.equal(completed.blocked.length, 1);
      assert.deepEqual(completed.streaming_api.responses, [{ status: 302, content_type_valid: false }]);
      assert.equal(snapshot.streaming_api.pending, 1, 'The earlier incomplete proof stays incomplete');
    } finally {
      release();
      await pending;
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('the fixed frontend session proxy also rejects finite redirects in M3', async () => {
  const redirected = await guard({ status: 302, headers: { location: 'https://outside.example.test/page' } });
  assert.equal(await redirected.send('http://127.0.0.1:4317/api/auth/session'), 'blocked');
  assert.deepEqual(redirected.calls, ['fetch', 'abort']);
  assert.throws(() => redirected.driver.assertGuard(), /blocked/);
  const anonymous = await guard({ status: 401 });
  assert.equal(await anonymous.send('http://127.0.0.1:4317/api/auth/session'), 'fulfilled');
  anonymous.driver.assertGuard();
});

test('photo validation rejects unsafe origins, secrets, cached responses, and other redirects', () => {
  assert.equal(validatePhotoRedirect(302, imageHeaders).origin, 'https://lh3.googleusercontent.com');
  for (const location of [
    'http://lh3.googleusercontent.com/image', 'https://foreign.example.test/image',
    'https://user:password@lh3.googleusercontent.com/image', 'https://lh3.googleusercontent.com:8443/image',
    'https://lh3.googleusercontent.com/image?key=secret', 'https://lh3.googleusercontent.com/image#secret',
    'https://lh3.googleusercontent.com/image?', 'https://lh3.googleusercontent.com/AIzaFixtureSecret',
    'https://lh3.googleusercontent.com/%41%49%7A%61FixtureSecret',
    'https://lh3.googleusercontent.com/%2541%2549%257A%2561FixtureSecret',
    'https://lh3.googleusercontent.com/%70%74_sensitive', 'https://lh3.googleusercontent.com/image%3Fkey%3Dsecret',
  ]) assert.throws(() => validatePhotoRedirect(302, { ...imageHeaders, location }));
  assert.throws(() => validatePhotoRedirect(307, imageHeaders));
  assert.throws(() => validatePhotoRedirect(302, { ...imageHeaders, 'cache-control': 'public, max-age=3600' }));
});

test('concurrent receipts serialize run-state writes across all guarded browser contexts', async () => {
  let state = [];
  let active = 0;
  let maximum = 0;
  const driver = await createPpeDriver('/unused-race-fixture', { scenario: 'places-routes' }, { async route() {} }, {
    async bridge(payload) {
      active++;
      maximum = Math.max(maximum, active);
      const read = [...state];
      await new Promise(resolve => setImmediate(resolve));
      state = [...read, payload.receipt];
      active--;
      return {};
    },
  });
  await Promise.all([
    driver.bridge({ operation: 'record-places', receipt: 'first search' }),
    driver.bridge({ operation: 'record-participant', receipt: 'guest' }),
    driver.bridge({ operation: 'record-places', receipt: 'second search' }),
  ]);
  assert.deepEqual(state, ['first search', 'guest', 'second search']);
  assert.equal(maximum, 1);
});

test('cleanup keeps failed request evidence and blocked paths contain no encoded secrets', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'places-guard-evidence-'));
  await mkdir(path.join(directory, 'evidence'));
  const run = { scenario: 'places-routes', client_url: 'http://127.0.0.1:4317', backend_url: backend };
  let handler;
  try {
    const driver = await createPpeDriver(directory, run, { async route(_match, callback) { handler = callback; } }, {
      async bridge() { throw new Error('Unrecorded path'); },
    });
    await handler({ request: () => ({ url: () => backend + '/api/venues/%41%49%7A%61secret/photo', method: () => 'GET', redirectedFrom: () => null }),
      async abort() {} });
    await driver.evidence();
    const original = await readFile(path.join(directory, 'evidence/ppe-request-guards.json'), 'utf8');
    const cleanup = await createPpeDriver(directory, run, { async route() {} }, { phase: 'cleanup' });
    await cleanup.evidence();
    assert.equal(await readFile(path.join(directory, 'evidence/ppe-request-guards.json'), 'utf8'), original);
    assert.equal(JSON.parse(original).blocked.length, 1);
    assert(!original.includes('secret') && !original.includes('%41'));
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'evidence/ppe-request-guards-cleanup.json'), 'utf8')).blocked, []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('venue assertions require complete shapes and an origin-correct owned photo URL', () => {
  assert.equal(assertVenue(venue(), backend).has_photo, true);
  for (const invalid of [null, { ...venue(), types: null }, { ...venue(), rating: '4' },
    { ...venue(), photoUrl: 'https://maps.googleapis.com/maps/api/place/photo?key=AIzaFixtureSecret' },
    { ...venue(), photoUrl: 'http://127.0.0.1:3000' + photoPath }]) {
    assert.throws(() => assertVenue(invalid, backend));
  }
  const details = { ...venue(), formattedPhoneNumber: null, website: null, openingHours: null };
  assertVenue(details, backend, { id: placeId, details: true });
  assert.throws(() => assertVenue(details, backend, { id: 'another-place', details: true }));
});

test('route proof rejects partial, missing, duplicate, null, and unavailable participant results', () => {
  const data = { venueId: placeId, travelMode: 'walking', routes: ['organizer', 'guest'].map(participantId => ({
    participantId, distance: { value: 500, text: '0.3 mi' }, duration: { value: 360, text: '6 mins' }, polyline: '??AA',
  })), outcomes: ['organizer', 'guest'].map(participantId => ({ participantId, status: 'found' })) };
  assertDirections(data, placeId, 'walking', ['guest', 'organizer']);
  for (const mutate of [
    value => value.routes.pop(), value => value.outcomes.pop(), value => value.routes[1].participantId = 'organizer',
    value => value.outcomes[1].status = 'unavailable', value => value.routes[1].distance = null,
    value => value.routes[1].duration.value = 0, value => value.routes[1].polyline = '',
    value => value.venueId = 'another-place', value => value.travelMode = 'driving',
    value => value.debugUrl = 'https://provider.example/?key=AIzaFixtureSecret',
    value => value.routes[0].debugUrl = 'https://provider.example/?key=AIzaFixtureSecret',
    value => value.routes[0].distance.debugUrl = 'https://provider.example/?key=AIzaFixtureSecret',
    value => value.routes[0].duration.debugUrl = 'https://provider.example/?key=AIzaFixtureSecret',
    value => value.outcomes[0].debugUrl = 'https://provider.example/?key=AIzaFixtureSecret',
  ]) {
    const invalid = structuredClone(data);
    mutate(invalid);
    assert.throws(() => assertDirections(invalid, placeId, 'walking', ['organizer', 'guest']));
  }
});

test('stored participant evidence drops arbitrary fields at every observed object level', () => {
  const debugUrl = 'https://provider.example/?key=AIzaFixtureSecret';
  const stored = { debugUrl, event: { id: 'evt_fixture', published_at: null, debugUrl }, participants: [{
    id: 'person', event_id: 'evt_fixture', name: 'Verification guest', is_organizer: false, has_credential: true,
    lat: 32.7, lng: -117.1, fuzzy_location: false, address: 'Unneeded private field', debugUrl,
  }] };
  const projection = placesStoredProjection(stored);
  assert.deepEqual(Object.keys(projection.event), ['id', 'published_at']);
  assert.equal(projection.participants[0].lat, 32.7);
  assert(!JSON.stringify(projection).includes('debugUrl') && !JSON.stringify(projection).includes('AIzaFixtureSecret'));
  assert(!JSON.stringify(projection).includes('Unneeded private field'));
});

test('a failed real-provider segment preserves labeled failure evidence and redacts credentials', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'places-evidence-test-'));
  const page = { on() {}, off() {}, async goto() { throw new Error('Provider failed Ai' + 'zaFixtureSecret pt_' + 'a'.repeat(64)); } };
  try {
    await assert.rejects(runPlacesScenario({ page, browser: {}, run: { backend_url: backend, client_url: 'http://127.0.0.1:4317' },
      eventId: 'evt_fixture', organizerId: 'organizer', evidence: directory, capture: async () => {}, action() {}, adapter: {} }));
    const raw = await readFile(path.join(directory, 'places-state.json'), 'utf8');
    const result = JSON.parse(raw);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.stage, 'participant setup');
    assert.equal(result.observations.at(-1).label, 'failure');
    assert.match(result.external_boundary, /real Google/);
    assert.equal(result.shared_provider_cache.exact_retained_row_count, 'not asserted');
    assert(!raw.includes('AIzaFixtureSecret') && !raw.includes('pt_' + 'a'.repeat(64)));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
