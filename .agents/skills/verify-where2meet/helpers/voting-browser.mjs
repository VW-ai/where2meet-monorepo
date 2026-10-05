import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { scrubPlacesError } from './places-browser.mjs';

const keys = (value, expected) => {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected a contract object');
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), 'Unexpected response fields');
};
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
const sorted = values => [...values].sort();

export function assertVoteWrite(result, { method, deleted = true }) {
  assert.equal(result.status, method === 'POST' ? 201 : 200);
  keys(result.body, method === 'POST' ? ['success', 'voteId'] : ['success', 'deleted']);
  assert.equal(result.body.success, true);
  if (method === 'POST') assert(uuid(result.body.voteId), 'Vote response needs its stored UUID');
  else assert.equal(result.body.deleted, deleted);
  return result;
}

export function assertVoteRead(data, { venue, voters }) {
  keys(data, ['venues', 'totalVotes']);
  assert.equal(data.totalVotes, voters.length);
  assert(Array.isArray(data.venues));
  assert.equal(data.venues.length, voters.length ? 1 : 0);
  for (const row of data.venues) {
    keys(row, ['id', 'name', 'address', 'location', 'category', 'rating', 'priceLevel', 'photoUrl', 'voteCount', 'voters']);
    assert.equal(row.id, venue.id);
    assert.equal(row.name, venue.name);
    assert.equal(row.address, venue.address);
    keys(row.location, ['lat', 'lng']);
    assert(Number.isFinite(row.location.lat) && Number.isFinite(row.location.lng));
    assert(Math.abs(row.location.lat - venue.location.lat) < 0.000001 && Math.abs(row.location.lng - venue.location.lng) < 0.000001);
    assert(row.category === null || typeof row.category === 'string');
    assert(row.rating === null || typeof row.rating === 'number' && row.rating >= 0 && row.rating <= 5);
    assert(row.priceLevel === null || Number.isInteger(row.priceLevel) && row.priceLevel >= 0 && row.priceLevel <= 4);
    assert(row.photoUrl === null || row.photoUrl === venue.photoUrl, 'Vote photo must remain the observed safe photo URL');
    assert.equal(row.voteCount, voters.length);
    assert.deepEqual(sorted(row.voters), sorted(voters));
  }
  return data;
}

export function assertVoteSnapshot(data, { eventId, venueId, voters, sse = false }) {
  keys(data, ['eventId', 'seq', 'venues', 'totalVotes', 'updatedAt']);
  assert.equal(data.eventId, eventId);
  assert(Number.isSafeInteger(data.seq) && data.seq >= 0);
  assert(timestamp(data.updatedAt));
  assert.equal(data.totalVotes, voters.length);
  assert(Array.isArray(data.venues));
  assert.equal(data.venues.length, voters.length ? 1 : 0);
  for (const row of data.venues) {
    const deprecatedNames = sse && Object.hasOwn(row, 'voterNames');
    keys(row, ['venueId', 'voteCount', 'voterIds', ...(deprecatedNames ? ['voterNames'] : [])]);
    assert.equal(row.venueId, venueId);
    assert.equal(row.voteCount, voters.length);
    assert.deepEqual(sorted(row.voterIds), sorted(voters));
    if (deprecatedNames) assert.deepEqual(sorted(row.voterNames), sorted(voters));
  }
  return data;
}

export function assertPublication(event, { eventId, participantIds, venueId }) {
  keys(event, ['id', 'title', 'meetingTime', 'participants', 'mec', 'publishedVenueId', 'publishedAt', 'createdAt', 'updatedAt', 'settings']);
  assert.equal(event.id, eventId);
  assert(typeof event.title === 'string' && event.title.length > 0);
  assert(event.meetingTime === null || timestamp(event.meetingTime));
  assert(timestamp(event.createdAt) && timestamp(event.updatedAt));
  assert.equal(event.mec, null);
  assert.deepEqual(event.settings, { allowParticipantsAfterPublish: false });
  assert.equal(event.publishedVenueId, venueId);
  assert(venueId === null ? event.publishedAt === null : timestamp(event.publishedAt));
  assert.deepEqual(sorted(event.participants.map(person => person.id)), sorted(participantIds));
  for (const person of event.participants) {
    keys(person, ['id', 'name', 'address', 'location', 'color', 'fuzzyLocation', 'isOrganizer']);
    assert(uuid(person.id) && typeof person.name === 'string' && typeof person.color === 'string');
    assert(person.address === null || typeof person.address === 'string');
    assert(typeof person.fuzzyLocation === 'boolean' && typeof person.isOrganizer === 'boolean');
    if (person.location !== null) {
      keys(person.location, ['lat', 'lng']);
      assert(Number.isFinite(person.location.lat) && Number.isFinite(person.location.lng));
    }
  }
  return event;
}

export function votingStoredProjection(stored) {
  return { event: stored.event === null ? null : {
    id: stored.event.id, published_at: stored.event.published_at, published_venue_id: stored.event.published_venue_id,
  }, participants: stored.participants.map(({ id, event_id }) => ({ id, event_id })),
  votes: stored.votes.map(({ id, event_id, participant_id, venue_id }) => ({ id, event_id, participant_id, venue_id })) };
}

async function poll(check, message, timeout = 45000) {
  const end = Date.now() + timeout;
  do {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < end);
  assert.fail(message);
}

async function recordStream(adapter, eventId, token) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45000);
  let reader;
  try {
    const response = await adapter.openStream(eventId, token, abort.signal);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/event-stream(?:\s*;|$)/i);
    reader = response.body.getReader();
  } catch (error) { abort.abort(); throw error; }
  finally { clearTimeout(timer); }
  const frames = [];
  let streamError;
  const decoder = new TextDecoder();
  const pump = (async () => {
    let buffer = '';
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          if (!abort.signal.aborted) throw new Error('Voting stream ended before verification completed');
          break;
        }
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
          const lines = buffer.slice(0, end).split('\n');
          buffer = buffer.slice(end + 2);
          const type = lines.find(line => line.startsWith('event: '))?.slice(7);
          const data = lines.filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
          if (type && data) frames.push({ type, data: JSON.parse(data) });
        }
      }
    } catch (error) { if (!abort.signal.aborted) streamError = error; }
  })();
  const wait = async (after, type, matches) => {
    let found;
    await poll(() => {
      if (streamError) throw new Error('Voting stream failed');
      found = frames.slice(after).find(frame => frame.type === type && matches(frame.data));
      return !!found;
    }, `Missing ${type} frame after the UI action`);
    return found;
  };
  try { await wait(0, 'heartbeat', data => timestamp(data.timestamp)); }
  catch (error) { abort.abort(); await pump; throw error; }
  return { mark: () => frames.length, wait,
    async close() { abort.abort(); await pump; if (streamError) throw new Error('Voting stream failed'); } };
}

export async function runVotingScenario({ page, guest, browser, run, eventId, organizerId, guestId, venue, evidence, capture, action, adapter }) {
  const observations = [];
  const errors = [];
  const network = [];
  const voteRequests = [];
  const navigations = new Map([[page, 0], [guest, 0]]);
  const voteIds = new Map();
  let status = 'FAIL';
  let stage = 'observer setup';
  let stream;
  let anonymous;
  const root = `/api/events/${eventId}`;
  const participantIds = [organizerId, guestId];
  const observeError = error => errors.push(scrubPlacesError(error.message));
  const observeResponse = response => {
    const url = new URL(response.url());
    if (url.origin === run.backend_url && url.pathname.startsWith(root)) network.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  };
  const observeRequest = request => {
    const url = new URL(request.url());
    if (url.origin === run.backend_url && url.pathname.startsWith(`${root}/participants/`) &&
      url.pathname.endsWith('/votes') && request.method() === 'POST') voteRequests.push({ method: 'POST', path: url.pathname });
  };
  const navigationHandlers = new Map([page, guest].map(active => [active, frame => {
    if (frame === active.mainFrame()) navigations.set(active, navigations.get(active) + 1);
  }]));
  for (const active of [page, guest]) {
    active.on('pageerror', observeError);
    active.on('response', observeResponse);
    active.on('request', observeRequest);
    active.on('framenavigated', navigationHandlers.get(active));
  }
  const save = async () => writeFile(path.join(evidence, 'voting-state.json'), JSON.stringify({ status, stage, event_id: eventId,
    selected_place_id: venue.id, participant_ids: participantIds, observations, network, errors,
    external_boundary: 'real Google venue from completed M3 setup; no successful write fixtures',
    sequence_policy: 'nonnegative diagnostic counter; no ordering or replay guarantee',
    shared_provider_cache: 'trusted cache rows may remain; never deleted or restored' }, null, 2));
  const responseFor = (active, pathname, method) => active.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === run.backend_url && url.pathname === pathname && response.request().method() === method;
  });
  const card = active => active.getByRole('button').filter({ has: active.getByRole('heading', { level: 3, name: venue.name, exact: true }) });
  const panel = active => active.getByRole('complementary', { name: venue.name, exact: true });
  const closeDetails = async active => {
    const close = active.getByRole('button', { name: 'Close venue details', exact: true });
    if (await close.isVisible()) await close.click();
  };
  const count = async (active, voters, participantId, published = false) => {
    const mine = voters.includes(participantId);
    const label = published ? 'Voting disabled after publish' : mine ? 'Remove vote' : 'Vote for venue';
    const button = card(active).getByRole('button', { name: label, exact: true });
    await button.waitFor();
    await poll(async () => Number(await button.innerText()) === voters.length && await button.getAttribute('aria-busy') === 'false', 'Visible card count did not settle');
    assert.equal(await button.getAttribute('aria-pressed'), String(mine));
    assert.equal(await button.isDisabled(), published);
  };
  const liked = async active => {
    await closeDetails(active);
    const expand = active.getByRole('button', { name: /^Expand liked venues filter/ });
    if (await expand.isVisible()) await expand.click();
    await active.getByRole('heading', { name: 'Liked Venues', exact: true }).waitFor();
  };
  const search = async active => {
    const field = active.getByRole('combobox', { name: 'Search venues', exact: true });
    await field.fill('coffee');
    await active.getByRole('option', { name: /Search.*coffee.*near your group/ }).waitFor();
    const [response] = await Promise.all([responseFor(active, '/api/venues/search', 'POST'), field.press('Enter')]);
    assert.equal(response.status(), 200);
    assert((await response.json()).venues.some(item => item.id === venue.id && item.name === venue.name), 'The observer must find the same real place');
    await card(active).waitFor();
  };
  const mutate = async (active, pathname, method, trigger) => {
    const [response] = await Promise.all([responseFor(active, pathname, method), trigger()]);
    return { status: response.status(), body: await response.json() };
  };
  const storedState = async (voters, publishedVenueId, publishedAt) => {
    const stored = votingStoredProjection(await adapter.stored(eventId));
    assert.equal(stored.event.id, eventId);
    assert.equal(stored.event.published_venue_id, publishedVenueId);
    if (publishedVenueId === null) assert.equal(stored.event.published_at, null);
    else assert.equal(Date.parse(stored.event.published_at), Date.parse(publishedAt));
    assert.deepEqual(sorted(stored.participants.map(person => person.id)), sorted(participantIds));
    assert(stored.participants.every(person => person.event_id === eventId));
    assert.deepEqual(sorted(stored.votes.map(vote => vote.participant_id)), sorted(voters));
    for (const vote of stored.votes) {
      assert(uuid(vote.id) && vote.event_id === eventId && vote.venue_id === venue.id);
      assert.equal(vote.id, voteIds.get(vote.participant_id), 'The stored vote must be the observed mutation receipt');
    }
    return stored;
  };
  const readVotes = async voters => {
    const read = await adapter.read(`${root}/votes`);
    assert.equal(read.status, 200);
    assertVoteRead(read.body, { venue, voters });
    const statistics = await adapter.read(`${root}/votes/statistics`);
    assert.equal(statistics.status, 200);
    assertVoteSnapshot(statistics.body, { eventId, venueId: venue.id, voters });
    return { read: read.body, statistics: statistics.body };
  };
  const snapshot = async (mark, voters) => {
    const frame = await stream.wait(mark, 'vote:statistics', data => data.eventId === eventId && data.totalVotes === voters.length &&
      Array.isArray(data.venues) && (voters.length === 0 ? data.venues.length === 0 : data.venues.length === 1 &&
        data.venues[0].venueId === venue.id && JSON.stringify(sorted(data.venues[0].voterIds ?? [])) === JSON.stringify(sorted(voters))));
    assertVoteSnapshot(frame.data, { eventId, venueId: venue.id, voters, sse: true });
    return frame;
  };
  const publicationNotice = async (mark, event) => {
    const frame = await stream.wait(mark, 'event:published', data => data.event?.id === eventId);
    keys(frame.data, ['event', 'venue']);
    assert.deepEqual(frame.data.event, { id: eventId, title: event.title, meetingTime: event.meetingTime,
      publishedAt: event.publishedAt, publishedVenueId: venue.id });
    keys(frame.data.venue, ['id', 'name', 'address', 'lat', 'lng']);
    assert.equal(frame.data.venue.id, venue.id);
    assert.equal(frame.data.venue.name, venue.name);
    assert.equal(frame.data.venue.address, venue.address);
    assert(Number.isFinite(frame.data.venue.lat) && Number.isFinite(frame.data.venue.lng));
    assert(Math.abs(frame.data.venue.lat - venue.location.lat) < 0.000001 && Math.abs(frame.data.venue.lng - venue.location.lng) < 0.000001);
    return frame;
  };
  const proveVote = async (label, writer, participantId, method, trigger, voters, publishedEvent = null) => {
    stage = label;
    const mark = stream.mark();
    const beforeNavigations = new Map(navigations);
    const pathname = `${root}/participants/${participantId}/votes${method === 'DELETE' ? '/' + encodeURIComponent(venue.id) : ''}`;
    const receipt = assertVoteWrite(await mutate(writer, pathname, method, trigger), { method });
    if (method === 'POST') voteIds.set(participantId, receipt.body.voteId);
    else voteIds.delete(participantId);
    const sse = await snapshot(mark, voters);
    const http = await readVotes(voters);
    const database = await storedState(voters, publishedEvent?.publishedVenueId ?? null, publishedEvent?.publishedAt);
    if (publishedEvent && voters.length === 0) {
      for (const active of [page, guest]) await active.getByText('No venues were voted for in this event', { exact: true }).waitFor();
    } else {
      await count(page, voters, organizerId, !!publishedEvent);
      await count(guest, voters, guestId, !!publishedEvent);
    }
    assert.deepEqual(navigations, beforeNavigations, 'Live vote proof cannot use a compensating navigation');
    observations.push({ label, receipt, http, database, sse, observer_untouched: true });
    await adapter.checkpoint();
    await save();
    action(label);
  };
  try {
    await adapter.settleRequests();
    await guest.goto(`${run.client_url}/meet/${eventId}?view=venue`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await search(guest);
    const token = await page.evaluate(id => localStorage.getItem(`organizer_token_${id}`), eventId);
    assert(typeof token === 'string' && /^pt_[0-9a-f]{64}$/.test(token), 'The recorder requires the UI-issued credential');
    stream = await recordStream(adapter, eventId, token);
    await adapter.checkpoint();
    await proveVote('organizer card vote', page, organizerId, 'POST', () => card(page).getByRole('button', { name: 'Vote for venue', exact: true }).click(), [organizerId]);
    await card(guest).click();
    await panel(guest).getByRole('heading', { level: 2, name: venue.name, exact: true }).waitFor();
    await proveVote('guest detail-heart vote', guest, guestId, 'POST', () => panel(guest).getByRole('button', { name: 'Save venue', exact: true }).click(), participantIds);
    await proveVote('organizer removal retains the guest vote', page, organizerId, 'DELETE', () => card(page).getByRole('button', { name: 'Remove vote', exact: true }).click(), [guestId]);
    await proveVote('last guest vote removal clears both live counts', guest, guestId, 'DELETE', () => panel(guest).getByRole('button', { name: 'Remove from saved', exact: true }).click(), []);
    stage = 'empty live shortlists';
    for (const active of [page, guest]) {
      await liked(active);
      await active.getByText('No liked venues yet', { exact: true }).waitFor();
      assert.equal(await card(active).count(), 0);
    }
    observations.push({ label: stage, organizer_empty: true, guest_empty: true, reload_used: false });
    await capture('voting-01-empty-guest', guest);
    await adapter.settleRequests();
    await guest.reload({ waitUntil: 'domcontentloaded' });
    await liked(guest);
    await guest.getByText('No liked venues yet', { exact: true }).waitFor();
    await page.getByRole('button', { name: /^Collapse liked venues filter/ }).click();
    await card(page).click();

    stage = 'publication automatically votes for the selected venue';
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Publish Event', exact: true }).click();
    const publishMark = stream.mark();
    const guestNavigation = navigations.get(guest);
    const [autoVote, publishedResponse] = await Promise.all([
      responseFor(page, `${root}/participants/${organizerId}/votes`, 'POST'), responseFor(page, `${root}/publish`, 'POST'),
      page.getByRole('button', { name: 'Publish Event', exact: true }).click(),
    ]);
    const autoReceipt = assertVoteWrite({ status: autoVote.status(), body: await autoVote.json() }, { method: 'POST' });
    voteIds.set(organizerId, autoReceipt.body.voteId);
    assert.equal(publishedResponse.status(), 200);
    const published = assertPublication(await publishedResponse.json(), { eventId, participantIds, venueId: venue.id });
    await page.getByRole('heading', { name: 'Event Published!', exact: true }).waitFor();
    const voteFrame = await snapshot(publishMark, [organizerId]);
    const publicationFrame = await publicationNotice(publishMark, published);
    await card(guest).getByText('Published', { exact: true }).waitFor();
    await count(page, [organizerId], organizerId, true);
    await count(guest, [organizerId], guestId, true);
    assert.equal(navigations.get(guest), guestNavigation);
    observations.push({ label: stage, auto_vote: autoReceipt, receipt: { status: 200, body: published },
      http: await readVotes([organizerId]), database: await storedState([organizerId], venue.id, published.publishedAt),
      sse: [voteFrame, publicationFrame], observer_untouched: true });
    await adapter.checkpoint();
    await capture('voting-02-published-guest', guest);
    await save();

    await page.getByRole('heading', { name: 'Event Published!', exact: true }).waitFor({ state: 'hidden' });
    if (!await panel(page).isVisible()) await card(page).click();
    await proveVote('published detail-heart DELETE remains allowed', page, organizerId, 'DELETE', () => panel(page).getByRole('button', { name: 'Remove from saved', exact: true }).click(), [], published);
    stage = 'published detail-heart POST rejects and rolls back';
    const beforeRejected = new Map(navigations);
    const rejected = await mutate(page, `${root}/participants/${organizerId}/votes`, 'POST', () => panel(page).getByRole('button', { name: 'Save venue', exact: true }).click());
    assert.deepEqual(rejected, { status: 409, body: { error: { code: 'EVENT_ALREADY_PUBLISHED', message: 'Event has already been published' } } });
    await panel(page).getByRole('button', { name: 'Save venue', exact: true }).waitFor();
    for (const active of [page, guest]) await active.getByText('No venues were voted for in this event', { exact: true }).waitFor();
    const unchanged = await adapter.read(root);
    assert.deepEqual(unchanged, { status: 200, body: published });
    assert.deepEqual(navigations, beforeRejected);
    observations.push({ label: stage, receipt: rejected, http: await readVotes([]), database: await storedState([], venue.id, published.publishedAt), publication_unchanged: true, observer_untouched: true });
    await adapter.checkpoint();
    await save();

    stage = 'published reload and anonymous join lock';
    await adapter.settleRequests();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await guest.reload({ waitUntil: 'domcontentloaded' });
    for (const active of [page, guest]) {
      await active.getByText('No venues were voted for in this event', { exact: true }).waitFor();
      assert(await active.getByRole('button', { name: /^Collapse liked venues filter/ }).isDisabled());
    }
    assert.deepEqual(await adapter.read(root), { status: 200, body: published });
    anonymous = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await adapter.guardContext(anonymous);
    const stranger = await anonymous.newPage();
    stranger.setDefaultTimeout(45000);
    stranger.on('pageerror', observeError);
    stranger.on('response', observeResponse);
    await stranger.goto(`${run.client_url}/meet/${eventId}?view=participant`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await stranger.getByRole('button', { name: 'Join Event', exact: true }).waitFor();
    assert(await stranger.getByRole('button', { name: 'Join Event', exact: true }).isDisabled());
    await stranger.getByText('Event Published', { exact: true }).waitFor();
    observations.push({ label: stage, organizer_and_guest_persisted: true, anonymous_join_disabled: true,
      database: await storedState([], venue.id, published.publishedAt) });
    await capture('voting-03-anonymous-published', stranger);
    await adapter.settleRequests();
    await anonymous.close();
    anonymous = null;
    await save();

    stage = 'reopening restores the live observer';
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const reopenMark = stream.mark();
    const guestBeforeReopen = navigations.get(guest);
    const reopenedResponse = await mutate(page, `${root}/publish`, 'DELETE', () => page.getByRole('button', { name: 'Unpublish Event', exact: true }).click());
    assert.equal(reopenedResponse.status, 200);
    const reopened = assertPublication(reopenedResponse.body, { eventId, participantIds, venueId: null });
    const reopenFrame = await stream.wait(reopenMark, 'event:updated', data => data.event?.id === eventId && data.event.publishedAt === null && data.event.publishedVenueId === null);
    keys(reopenFrame.data, ['event']);
    assert.deepEqual(reopenFrame.data.event, { id: eventId, title: reopened.title, meetingTime: reopened.meetingTime, publishedAt: null, publishedVenueId: null });
    await guest.getByRole('combobox', { name: 'Search venues', exact: true }).waitFor();
    assert(await guest.getByRole('button', { name: 'Travel by Car', exact: true }).isEnabled());
    assert.equal(navigations.get(guest), guestBeforeReopen);
    assert.deepEqual(await adapter.read(root), reopenedResponse);
    observations.push({ label: stage, receipt: reopenedResponse, sse: reopenFrame,
      database: await storedState([], null), observer_untouched: true });
    await adapter.checkpoint();
    await save();
    await liked(page);
    await search(guest);
    await proveVote('guest can vote after reopening', guest, guestId, 'POST', () => card(guest).getByRole('button', { name: 'Vote for venue', exact: true }).click(), [guestId]);
    stage = 'reopened vote survives reload';
    await adapter.settleRequests();
    for (const active of [page, guest]) {
      await active.reload({ waitUntil: 'domcontentloaded' });
      await liked(active);
    }
    await count(page, [guestId], organizerId);
    await count(guest, [guestId], guestId);
    assert.deepEqual(await adapter.read(root), reopenedResponse);
    observations.push({ label: stage, http: await readVotes([guestId]), database: await storedState([guestId], null) });
    assert.deepEqual(errors, [], 'Browser errors invalidate voting acceptance');
    await adapter.checkpoint();
    await capture('voting-04-reopened-guest', guest);
    await save();

    await proveVote('organizer votes before a second publication', page, organizerId, 'POST', () => card(page).getByRole('button', { name: 'Vote for venue', exact: true }).click(), participantIds);
    stage = 'publication retains the existing organizer vote';
    await card(page).click();
    await panel(page).getByRole('heading', { level: 2, name: venue.name, exact: true }).waitFor();
    await adapter.settleRequests();
    const beforePublication = await storedState(participantIds, null);
    const priorVoteRequests = voteRequests.length;
    const repeatPublishMark = stream.mark();
    const guestBeforeRepeatPublish = navigations.get(guest);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Publish Event', exact: true }).click();
    const repeatReceipt = await mutate(page, `${root}/publish`, 'POST', () => page.getByRole('button', { name: 'Publish Event', exact: true }).click());
    assert.equal(repeatReceipt.status, 200);
    const republished = assertPublication(repeatReceipt.body, { eventId, participantIds, venueId: venue.id });
    await page.getByRole('heading', { name: 'Event Published!', exact: true }).waitFor();
    const repeatFrame = await publicationNotice(repeatPublishMark, republished);
    await card(guest).getByText('Published', { exact: true }).waitFor();
    await count(page, participantIds, organizerId, true);
    await count(guest, participantIds, guestId, true);
    assert.equal(navigations.get(guest), guestBeforeRepeatPublish);
    assert.deepEqual(await adapter.read(root), repeatReceipt);
    const retainedVotes = await storedState(participantIds, venue.id, republished.publishedAt);
    assert.deepEqual(retainedVotes.votes, beforePublication.votes, 'Publication must preserve both exact vote IDs');
    const repeatedHttp = await readVotes(participantIds);
    await page.getByRole('heading', { name: 'Event Published!', exact: true }).waitFor({ state: 'hidden' });
    await adapter.checkpoint();
    assert.equal(voteRequests.length, priorVoteRequests, 'Publication with an existing organizer vote must issue no extra POST vote request');
    observations.push({ label: stage, receipt: repeatReceipt, http: repeatedHttp, database: retainedVotes,
      before_votes: beforePublication.votes, additional_vote_requests: voteRequests.slice(priorVoteRequests),
      sse: repeatFrame, observer_untouched: true });
    await capture('voting-05-existing-vote-publication', guest);
    await save();

    stage = 'reopen after publication with an existing vote';
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const finalReopenMark = stream.mark();
    const guestBeforeFinalReopen = navigations.get(guest);
    const finalReceipt = await mutate(page, `${root}/publish`, 'DELETE', () => page.getByRole('button', { name: 'Unpublish Event', exact: true }).click());
    assert.equal(finalReceipt.status, 200);
    const finalEvent = assertPublication(finalReceipt.body, { eventId, participantIds, venueId: null });
    const finalFrame = await stream.wait(finalReopenMark, 'event:updated', data => data.event?.id === eventId && data.event.publishedAt === null && data.event.publishedVenueId === null);
    keys(finalFrame.data, ['event']);
    assert.deepEqual(finalFrame.data.event, { id: eventId, title: finalEvent.title, meetingTime: finalEvent.meetingTime, publishedAt: null, publishedVenueId: null });
    await count(page, participantIds, organizerId);
    await count(guest, participantIds, guestId);
    assert.equal(navigations.get(guest), guestBeforeFinalReopen);
    assert.deepEqual(await adapter.read(root), finalReceipt);
    const finalStored = await storedState(participantIds, null);
    assert.deepEqual(finalStored.votes, beforePublication.votes);
    observations.push({ label: stage, receipt: finalReceipt, http: await readVotes(participantIds), database: finalStored,
      sse: finalFrame, observer_untouched: true });
    assert.deepEqual(errors, [], 'Browser errors invalidate voting acceptance');
    await adapter.checkpoint();
    status = 'PASS';
    stage = 'complete';
    return { scope: ['organizer card and guest detail-heart votes', 'non-final and final removal with empty live shortlist',
      'exact mutation bodies, public vote reads, statistics and stored membership', 'complete SSE snapshots and untouched observer',
      'publication automatic organizer vote and complete Event response', 'published detail-heart DELETE and rejected POST rollback',
      'published reload and anonymous disabled join', 'live reopening with explicit nulls and persisted guest vote',
      'publication with an existing organizer vote issues no extra vote request and preserves both vote IDs'],
    not_verified: ['phone layouts', 'ordinary detail counter as a separate entry', 'no-selection and modal cancellation',
      'concurrent snapshot ordering or reconnect recovery',
      'historical import', 'production frontend serving'] };
  } catch (error) {
    observations.push({ label: 'failure', stage, error: scrubPlacesError(error) });
    try { await capture('voting-failure', page); await capture('voting-guest-failure', guest); } catch {}
    throw error;
  } finally {
    for (const active of [page, guest]) {
      active.off('pageerror', observeError);
      active.off('response', observeResponse);
      active.off('request', observeRequest);
      active.off('framenavigated', navigationHandlers.get(active));
    }
    try {
      if (stream) await stream.close();
      await adapter.settleRequests();
      if (anonymous) await anonymous.close();
    } catch (error) {
      status = 'FAIL';
      observations.push({ label: 'teardown failure', error: scrubPlacesError(error) });
    }
    await save();
    assert(status === 'PASS' || observations.some(item => item.label === 'failure'), 'Voting teardown failed');
  }
}
