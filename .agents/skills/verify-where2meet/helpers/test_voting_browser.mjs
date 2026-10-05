import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPpeDriver } from './ppe-browser.mjs';
import { assertPublication, assertVoteRead, assertVoteSnapshot, assertVoteWrite, runVotingScenario,
  votingStoredProjection } from './voting-browser.mjs';

const backend = 'https://ppe.example.test';
const client = 'http://127.0.0.1:4317';
const eventId = 'evt_1760000000000_0123456789abcdef';
const organizerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const guestId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const placeId = 'ChIJ_fixture_place';
const eventPath = `/api/events/${eventId}`;
const votePath = `${eventPath}/participants/${organizerId}/votes`;
const streamPath = `${eventPath}/stream`;
const photoPath = `/api/venues/${placeId}/photo`;
const voteBody = { venueId: placeId, venueData: { name: 'Fixture cafe', lat: 32.71, lng: -117.15 } };
const streamHeaders = { 'content-type': 'text/event-stream; charset=utf-8' };
const createdAt = '2026-10-05T12:00:00.000Z';
const voteId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const observedVenue = () => ({ id: placeId, name: 'Fixture cafe', address: 'Fixture address',
  location: { lat: 32.71, lng: -117.15 }, photoUrl: backend + photoPath });
const voteRead = () => ({ venues: [{ ...observedVenue(), category: 'cafe', rating: 4.5, priceLevel: 2,
  voteCount: 2, voters: [organizerId, guestId] }], totalVotes: 2 });
const voteSnapshot = () => ({ eventId, seq: 4, updatedAt: createdAt,
  venues: [{ venueId: placeId, voteCount: 2, voterIds: [organizerId, guestId] }], totalVotes: 2 });
const publication = () => ({ id: eventId, title: 'Fixture meeting', meetingTime: null, mec: null,
  publishedVenueId: placeId, publishedAt: createdAt, createdAt, updatedAt: createdAt,
  settings: { allowParticipantsAfterPublish: false }, participants: [organizerId, guestId].map((id, index) => ({
    id, name: index === 0 ? 'Fixture organizer' : 'Fixture guest', address: 'Fixture public landmark',
    location: { lat: 32.71, lng: -117.15 }, color: '#336699', fuzzyLocation: false, isOrganizer: index === 0,
  })) });

function barrier(phase) {
  let release;
  let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  return { release, waiting, async hold(current) { if (current === phase) { entered(); await pending; } } };
}

async function guardFixture(t, { reject, pause } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'voting-boundary-'));
  await mkdir(path.join(directory, 'evidence'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const handlers = [];
  const calls = [];
  const page = {};
  let postflights = 0;
  const run = { scenario: 'voting-publication', backend_url: backend, client_url: client };
  const context = () => ({ async route(_match, handler) { handlers.push(handler); } });
  const driver = await createPpeDriver(directory, run, context(), {
    async bridge(payload) {
      calls.push(payload);
      if (payload.operation === 'postflight') postflights++;
      if (pause) await pause.hold(payload.operation);
      if (reject?.(payload, postflights)) throw new Error('Fixture identity check rejected');
      return {};
    },
  });
  await driver.guardContext(context());
  return { driver, page, calls, run, directory,
    async send({ pathname = votePath, method = 'POST', body = voteBody, status = 200, headers = {}, responseBody = {},
      activePage = page, contextIndex = 0, redirectedFrom = null, missing = false, absent = false, failure = null } = {}) {
      let outcome;
      const url = pathname.startsWith('http') ? pathname : backend + pathname;
      const response = { status: () => status, headers: () => headers, json: async () => responseBody };
      const request = { url: () => url, method: () => method, redirectedFrom: () => redirectedFrom,
        postDataJSON: () => body, frame: () => ({ page: () => activePage }),
        failure: () => failure === null ? null : { errorText: failure },
        async response() {
          if (pause) await pause.hold('headers');
          return missing ? null : absent ? undefined : response;
        } };
      await handlers[contextIndex]({ request: () => request,
        async fetch(options) {
          assert.equal(options.maxRedirects, 0);
          assert(!url.endsWith('/stream'), 'SSE must not be buffered');
          calls.push({ operation: 'fetch', method, url });
          if (pause) await pause.hold('fetch');
          return response;
        },
        async continue() { calls.push({ operation: 'continue' }); outcome = 'continued'; },
        async fulfill() {
          if (pause) await pause.hold('fulfill');
          calls.push({ operation: 'fulfill', status }); outcome = 'fulfilled';
        },
        async abort() { calls.push({ operation: 'abort' }); outcome = 'blocked'; },
      });
      return outcome;
    },
    async evidence() {
      await driver.evidence();
      return JSON.parse(await readFile(path.join(directory, 'evidence/ppe-request-guards.json'), 'utf8'));
    },
  };
}

test('M4 vote, publication, removal and statistics traffic keeps preflight and postflight checks', async t => {
  const run = await guardFixture(t);
  for (const [method, pathname, body] of [
    ['POST', votePath, voteBody], ['DELETE', `${votePath}/${placeId}`, null],
    ['POST', `${eventPath}/publish`, { venueId: placeId }], ['DELETE', `${eventPath}/publish`, null],
    ['GET', `${eventPath}/votes/statistics`, null],
  ]) {
    const start = run.calls.length;
    assert.equal(await run.send({ method, pathname, body }), 'fulfilled');
    assert.deepEqual(run.calls.slice(start).map(call => call.operation), ['guard', 'fetch', 'postflight', 'fulfill']);
    assert.deepEqual(run.calls[start], { operation: 'guard', method, url: backend + pathname,
      body: method === 'GET' ? undefined : body });
  }
  await run.driver.settleRequests();
  assert.deepEqual((await run.evidence()).blocked, []);
});

for (const phase of ['guard', 'postflight']) {
  test(`M4 ${phase} failure prevents the mutation response reaching the browser`, async t => {
    const run = await guardFixture(t, { reject: payload => payload.operation === phase });
    assert.equal(await run.send(), 'blocked');
    assert.deepEqual(run.calls.map(call => call.operation), phase === 'guard' ? ['guard', 'abort'] : ['guard', 'fetch', 'postflight', 'abort']);
    await assert.rejects(run.driver.settleRequests(), /blocked/);
    const evidence = await run.evidence();
    assert.equal(evidence.blocked[0].phase, phase);
    assert.equal(evidence.pending_requests, 0);
  });
}

test('M4 search and guest receipts are persisted before successful response fulfillment', async t => {
  const run = await guardFixture(t);
  const places = { venues: [{ id: placeId }], totalResults: 1, searchCenter: { lat: 32.71, lng: -117.15 } };
  assert.equal(await run.send({ pathname: '/api/venues/search', responseBody: places }), 'fulfilled');
  assert.deepEqual(run.calls.map(call => call.operation), ['guard', 'fetch', 'record-places', 'postflight', 'fulfill']);
  assert.deepEqual(run.calls[2], { operation: 'record-places', body: places });
  const start = run.calls.length;
  assert.equal(await run.send({ pathname: `${eventPath}/participants`, status: 201, responseBody: { id: guestId } }), 'fulfilled');
  assert.deepEqual(run.calls.slice(start).map(call => call.operation), ['guard', 'fetch', 'record-participant', 'postflight', 'fulfill']);
  assert.deepEqual(run.calls[start + 2], { operation: 'record-participant', event_id: eventId, participant_id: guestId });
});

test('M4 rejects redirected requests and finite redirects except validated owned photos', async t => {
  for (const pathname of [votePath, `${eventPath}/publish`, `${eventPath}/votes/statistics`, `${client}/api/auth/session`]) {
    const run = await guardFixture(t);
    assert.equal(await run.send({ pathname, method: pathname.endsWith('/session') || pathname.endsWith('/statistics') ? 'GET' : 'POST',
      status: 302, headers: { location: 'https://outside.example.test/page' } }), 'blocked');
    await assert.rejects(run.driver.settleRequests(), /blocked/);
    assert.equal((await run.evidence()).blocked[0].phase, 'response-check');
  }
  const redirected = await guardFixture(t);
  assert.equal(await redirected.send({ redirectedFrom: {} }), 'blocked');
  assert.deepEqual(redirected.calls.map(call => call.operation), ['abort']);
  const photo = await guardFixture(t);
  assert.equal(await photo.send({ pathname: photoPath, method: 'GET', status: 302,
    headers: { location: 'https://lh3.googleusercontent.com/fixture-image', 'cache-control': 'no-store' } }), 'fulfilled');
  await photo.driver.settleRequests();
  const unsafePhoto = await guardFixture(t);
  assert.equal(await unsafePhoto.send({ pathname: photoPath, method: 'GET', status: 302,
    headers: { location: 'https://lh3.googleusercontent.com/image?key=fixture-only', 'cache-control': 'no-store' } }), 'blocked');
});

for (const stream of [false, true]) {
  for (const phase of stream ? ['guard', 'headers', 'postflight'] : ['guard', 'fetch', 'postflight', 'fulfill']) {
    test(`M4 request draining waits for ${stream ? 'stream' : 'mutation'} ${phase}`, async t => {
      const pause = barrier(phase);
      const run = await guardFixture(t, { pause });
      const pending = run.send(stream ? { pathname: streamPath, method: 'GET', headers: streamHeaders } : {});
      await pause.waiting;
      let completed = false;
      const settling = run.driver.settleRequests({ timeoutMs: 1000 }).then(() => { completed = true; });
      try {
        assert.throws(() => run.driver.assertGuard(), /validation has not completed/);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(completed, false);
        const waitingEvidence = await run.evidence();
        assert.equal(waitingEvidence.pending_requests, 1);
        assert.equal(waitingEvidence.streaming_api.pending, stream ? 1 : 0);
        pause.release();
        assert.equal(await pending, stream ? 'continued' : 'fulfilled');
        await settling;
        assert.equal(completed, true);
        assert.equal((await run.evidence()).pending_requests, 0);
      } finally { pause.release(); await Promise.allSettled([pending, settling]); }
    });
  }
}

test('M4 draining fails on a late stream redirect and on a pending mutation timeout', async t => {
  const pause = barrier('headers');
  const run = await guardFixture(t, { pause });
  const pending = run.send({ pathname: streamPath, method: 'GET', status: 302, headers: streamHeaders });
  await pause.waiting;
  const settling = assert.rejects(run.driver.settleRequests({ timeoutMs: 1000 }), /blocked/);
  pause.release();
  assert.equal(await pending, 'continued');
  await settling;
  assert.deepEqual((await run.evidence()).streaming_api.responses, [{ status: 302, content_type_valid: true }]);
  const held = barrier('fulfill');
  const mutation = await guardFixture(t, { pause: held });
  const unresolved = mutation.send();
  try {
    await held.waiting;
    await assert.rejects(mutation.driver.settleRequests({ timeoutMs: 10 }), /did not finish/);
    assert.throws(() => mutation.driver.assertGuard(), /validation has not completed/);
    held.release();
    assert.equal(await unresolved, 'fulfilled');
    await mutation.driver.settleRequests();
  } finally { held.release(); await unresolved; }
});

test('M4 confirmed cancelled streams require a later valid same-page exact-path replacement', async t => {
  const run = await guardFixture(t);
  const send = options => run.send({ pathname: streamPath, method: 'GET', headers: streamHeaders, ...options });
  assert.equal(await send({ missing: true, failure: 'net::ERR_ABORTED' }), 'continued');
  await assert.rejects(run.driver.settleRequests(), /no later valid replacement/);
  await send({ missing: true, failure: 'net::ERR_ABORTED' });
  await send({});
  await run.driver.settleRequests();
  const evidence = await run.evidence();
  assert.deepEqual(evidence.streaming_api.responses, [{ status: 200, content_type_valid: true }]);
  assert.deepEqual(evidence.streaming_api.cancelled_attempts, [
    { request_id: 1, replacement_request_id: 3, replacement_verified: true },
    { request_id: 2, replacement_request_id: 3, replacement_verified: true },
  ]);
});

for (const mismatch of ['older', 'page', 'context', 'path']) {
  test(`M4 rejects cancellation replacement with ${mismatch} mismatch`, async t => {
    const run = await guardFixture(t);
    const send = options => run.send({ pathname: streamPath, method: 'GET', headers: streamHeaders, ...options });
    if (mismatch === 'older') await send({});
    await send({ missing: true, failure: 'net::ERR_ABORTED' });
    if (mismatch !== 'older') await send(mismatch === 'path' ? { pathname: '/api/events/evt_other/stream' }
      : { activePage: {}, contextIndex: mismatch === 'context' ? 1 : 0 });
    await assert.rejects(run.driver.settleRequests(), /no later valid replacement/);
    assert.deepEqual((await run.evidence()).streaming_api.cancelled_attempts, [{
      request_id: mismatch === 'older' ? 2 : 1, replacement_request_id: mismatch === 'older' ? 1 : null,
      replacement_verified: false,
    }]);
  });
}

for (const invalid of [{ missing: true }, { missing: true, failure: 'net::ERR_FAILED' },
  { absent: true, failure: 'net::ERR_ABORTED' }, { status: 302, failure: 'net::ERR_ABORTED' },
  { headers: { 'content-type': 'application/json' }, failure: 'net::ERR_ABORTED' }]) {
  test(`M4 does not excuse an invalid stream response ${JSON.stringify(invalid)}`, async t => {
    const run = await guardFixture(t);
    assert.equal(await run.send({ pathname: streamPath, method: 'GET', headers: streamHeaders, ...invalid }), 'continued');
    await run.send({ pathname: streamPath, method: 'GET', headers: streamHeaders });
    await assert.rejects(run.driver.settleRequests(), /blocked/);
    const evidence = await run.evidence();
    assert.equal(evidence.blocked.length, 1);
    assert.deepEqual(evidence.streaming_api.cancelled_attempts, []);
  });
}

for (const rejectedPostflight of [1, 2]) {
  test(`M4 cancellation proof retains postflight failure ${rejectedPostflight}`, async t => {
    const run = await guardFixture(t, { reject: (payload, count) => payload.operation === 'postflight' && count === rejectedPostflight });
    await run.send({ pathname: streamPath, method: 'GET', missing: true, failure: 'net::ERR_ABORTED' });
    await run.send({ pathname: streamPath, method: 'GET', headers: streamHeaders });
    await assert.rejects(run.driver.settleRequests(), /blocked/);
    const evidence = await run.evidence();
    assert.equal(evidence.blocked[0].phase, 'postflight');
    assert.equal(evidence.streaming_api.cancelled_attempts[0].replacement_verified, rejectedPostflight === 1);
  });
}

test('M4 cleanup preserves prior failure evidence and strips secret-bearing request paths', async t => {
  const run = await guardFixture(t, { reject: () => true });
  assert.equal(await run.send({ pathname: `${eventPath}/participants/${organizerId}/votes/%41%49%7A%61secret` }), 'blocked');
  const evidence = await run.evidence();
  assert.equal(evidence.blocked[0].phase, 'guard');
  const filename = path.join(run.directory, 'evidence/ppe-request-guards.json');
  const original = await readFile(filename, 'utf8');
  assert(!original.includes('secret') && !original.includes('%41'));
  const cleanup = await createPpeDriver(run.directory, run.run, { async route() {} }, { phase: 'cleanup' });
  await cleanup.evidence();
  assert.equal(await readFile(filename, 'utf8'), original);
  const cleaned = JSON.parse(await readFile(path.join(run.directory, 'evidence/ppe-request-guards-cleanup.json'), 'utf8'));
  assert.deepEqual(cleaned.blocked, []);
  assert.equal(cleaned.pending_requests, 0);
});

test('vote mutation validators require exact status, success and stored receipt fields', () => {
  const added = { status: 201, body: { success: true, voteId } };
  assert.deepEqual(assertVoteWrite(added, { method: 'POST' }), added);
  const removed = { status: 200, body: { success: true, deleted: true } };
  assert.deepEqual(assertVoteWrite(removed, { method: 'DELETE' }), removed);
  const absent = { status: 200, body: { success: true, deleted: false } };
  assert.deepEqual(assertVoteWrite(absent, { method: 'DELETE', deleted: false }), absent);
  for (const result of [{ ...added, status: 200 }, { status: 201, body: {} },
    { status: 201, body: { success: false, voteId } }, { status: 201, body: { success: true, voteId: 'not-a-uuid' } },
    { status: 201, body: { ...added.body, token: 'fixture-secret' } }]) {
    assert.throws(() => assertVoteWrite(result, { method: 'POST' }));
  }
  for (const result of [{ ...removed, status: 201 }, { status: 200, body: { success: true } },
    { status: 200, body: { success: true, deleted: false } }, { status: 200, body: { success: true, deleted: 'true' } },
    { status: 200, body: { ...removed.body, token: 'fixture-secret' } }]) {
    assert.throws(() => assertVoteWrite(result, { method: 'DELETE' }));
  }
});

test('vote reads require complete venue fields and exact voter membership', () => {
  const options = { venue: observedVenue(), voters: [guestId, organizerId] };
  assert.deepEqual(assertVoteRead(voteRead(), options), voteRead());
  const changes = [
    data => data.venues.pop(), data => data.totalVotes = 1, data => data.venues[0].voteCount = 1,
    data => data.venues[0].id = 'unobserved', data => data.venues[0].voters[0] = guestId,
    data => data.venues[0].voters = [organizerId], data => delete data.venues[0].address,
    data => data.venues[0].name = 'Unobserved cafe', data => data.venues[0].location.lat = '32.71',
    data => data.venues[0].location.lng = NaN, data => data.venues[0].rating = '4.5',
    data => data.venues[0].priceLevel = 5, data => data.venues[0].photoUrl = 'https://outside.example.test/photo',
    data => data.token = 'fixture-secret', data => data.venues[0].token = 'fixture-secret',
    data => data.venues[0].location.token = 'fixture-secret',
  ];
  for (const change of changes) {
    const data = voteRead();
    change(data);
    assert.throws(() => assertVoteRead(data, options), undefined, change.toString());
  }
});

test('last-vote reads and snapshots must have an exact empty venue list', () => {
  const emptyRead = { venues: [], totalVotes: 0 };
  const emptySnapshot = { eventId, seq: 19, updatedAt: createdAt, venues: [], totalVotes: 0 };
  assert.deepEqual(assertVoteRead(emptyRead, { venue: observedVenue(), voters: [] }), emptyRead);
  assert.deepEqual(assertVoteSnapshot(emptySnapshot, { eventId, venueId: placeId, voters: [] }), emptySnapshot);
  for (const data of [null, {}, { totalVotes: 0 }, { ...emptyRead, venues: null },
    { ...emptyRead, venues: [{ ...voteRead().venues[0], voteCount: 0, voters: [] }] }]) {
    assert.throws(() => assertVoteRead(data, { venue: observedVenue(), voters: [] }));
  }
  for (const data of [null, {}, { ...emptySnapshot, venues: null },
    { ...emptySnapshot, venues: [{ venueId: placeId, voteCount: 0, voterIds: [] }] },
    { ...emptySnapshot, totalVotes: 1 }, { ...emptySnapshot, token: 'fixture-secret' }]) {
    assert.throws(() => assertVoteSnapshot(data, { eventId, venueId: placeId, voters: [] }));
  }
});

test('statistics validate exact event and voter identities without a sequence-order claim', () => {
  const options = { eventId, venueId: placeId, voters: [guestId, organizerId] };
  for (const seq of [0, 4, 2]) assert.deepEqual(assertVoteSnapshot({ ...voteSnapshot(), seq }, options), { ...voteSnapshot(), seq });
  const withNames = voteSnapshot();
  withNames.venues[0].voterNames = [guestId, organizerId];
  assert.deepEqual(assertVoteSnapshot(withNames, { ...options, sse: true }), withNames);
  assert.throws(() => assertVoteSnapshot(withNames, options));
  for (const change of [
    data => delete data.eventId, data => delete data.updatedAt, data => data.eventId = 'evt_foreign',
    data => data.seq = -1, data => data.seq = 1.2, data => data.seq = '4', data => data.seq = Infinity,
    data => data.updatedAt = 'not-a-timestamp', data => data.totalVotes = 1,
    data => data.venues[0].voterIds[0] = guestId, data => data.venues[0].venueId = 'unobserved',
    data => data.venues[0].voteCount = 1, data => data.venues[0].voterNames = ['Organizer', 'Guest'],
    data => data.token = 'fixture-secret', data => data.venues[0].token = 'fixture-secret',
  ]) {
    const data = voteSnapshot();
    change(data);
    assert.throws(() => assertVoteSnapshot(data, { ...options, sse: true }));
  }
});

test('publication validators require complete event and participant contracts and explicit reopen nulls', () => {
  const options = { eventId, participantIds: [guestId, organizerId], venueId: placeId };
  assert.deepEqual(assertPublication(publication(), options), publication());
  const reopened = { ...publication(), publishedAt: null, publishedVenueId: null };
  assert.deepEqual(assertPublication(reopened, { ...options, venueId: null }), reopened);
  for (const change of [
    event => delete event.publishedAt, event => event.publishedAt = null, event => event.publishedAt = 'invalid',
    event => delete event.settings, event => event.id = 'evt_foreign', event => event.publishedVenueId = 'unobserved',
    event => event.participants.pop(), event => event.participants[0].id = guestId,
    event => delete event.participants[0].fuzzyLocation, event => event.participants[0].location.lat = '32.71',
    event => event.token = 'fixture-secret', event => event.participants[0].token = 'fixture-secret',
    event => event.participants[0].location.token = 'fixture-secret',
  ]) {
    const event = publication();
    change(event);
    assert.throws(() => assertPublication(event, options));
  }
  for (const event of [{ ...reopened, publishedAt: createdAt }, { ...reopened, publishedVenueId: placeId },
    { ...reopened, publishedAt: undefined }, { ...reopened, publishedVenueId: undefined }]) {
    assert.throws(() => assertPublication(event, { ...options, venueId: null }));
  }
});

test('voting stored evidence projects only exact membership and publication fields', () => {
  const secret = 'fixture-secret';
  const stored = { token: secret,
    event: { id: eventId, published_at: createdAt, published_venue_id: placeId, title: 'Private title', token: secret },
    participants: [{ id: organizerId, event_id: eventId, token_hash: secret, address: 'Private address', token: secret }],
    votes: [{ id: voteId, event_id: eventId, participant_id: organizerId, venue_id: placeId, token: secret }],
  };
  assert.deepEqual(votingStoredProjection(stored), {
    event: { id: eventId, published_at: createdAt, published_venue_id: placeId },
    participants: [{ id: organizerId, event_id: eventId }],
    votes: [{ id: voteId, event_id: eventId, participant_id: organizerId, venue_id: placeId }],
  });
  assert.deepEqual(votingStoredProjection({ event: null, participants: [], votes: [] }), { event: null, participants: [], votes: [] });
});

test('database publication time preserves UTC milliseconds in a non-UTC verifier process', () => {
  const moduleUrl = new URL('./voting-browser.mjs', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { votingStoredProjection } from ${JSON.stringify(moduleUrl)};
    const raw = '2026-10-05T20:01:03.876';
    const projected = votingStoredProjection({ event: { id: 'evt_fixture', published_at: raw,
      published_venue_id: 'observed-place' }, participants: [], votes: [] });
    console.log(JSON.stringify({ unzoned_ms: Date.parse(raw), publication: projected.event.published_at,
      publication_ms: Date.parse(projected.event.published_at) }));
  `], { encoding: 'utf8', env: { ...process.env, TZ: 'America/Los_Angeles' } });
  assert.deepEqual(JSON.parse(output), { unzoned_ms: 1791255663876,
    publication: '2026-10-05T20:01:03.876Z', publication_ms: 1791230463876 });
});

test('voting failures preserve each capture and redact credentials when another capture and teardown fail', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'voting-failure-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const registered = new Set();
  const page = { on(type) { registered.add(type); }, off(type) { registered.delete(type); } };
  const guest = { on() {}, off() {} };
  const captures = [];
  const secret = 'pt_' + 'a'.repeat(64);
  let attempts = 0;
  await assert.rejects(runVotingScenario({ page, guest, browser: {}, run: { backend_url: backend, client_url: client },
    eventId, organizerId, guestId, venue: observedVenue(), evidence: directory,
    async capture(name) { captures.push(name); if (name === 'voting-failure') throw new Error('Fixture capture failed'); }, action() {}, adapter: {
      async settleRequests() { attempts++; throw new Error('Fixture failed Ai' + 'zaFixtureSecret ' + secret); },
    } }), /Fixture failed/);
  const raw = await readFile(path.join(directory, 'voting-state.json'), 'utf8');
  const saved = JSON.parse(raw);
  assert.equal(saved.status, 'FAIL');
  assert.equal(saved.stage, 'observer setup');
  assert.equal(saved.event_id, eventId);
  assert.deepEqual(saved.participant_ids, [organizerId, guestId]);
  assert.deepEqual(saved.observations.map(item => item.label), ['failure', 'teardown failure']);
  assert.deepEqual(captures, ['voting-failure', 'voting-guest-failure']);
  assert.equal(attempts, 2);
  assert.equal(registered.size, 0);
  assert.match(saved.external_boundary, /real Google/);
  assert(!raw.includes('AIzaFixtureSecret') && !raw.includes(secret));
});
