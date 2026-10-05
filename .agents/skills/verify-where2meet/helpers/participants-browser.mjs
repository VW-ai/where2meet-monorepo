import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const participantKeys = ['address', 'color', 'fuzzyLocation', 'id', 'isOrganizer', 'location', 'name'];
const scrub = value => String(value).replace(/AIza[\w-]+/g, '[Google key redacted]')
  .replace(/\bpt_[a-zA-Z0-9.]+/g, '[participant credential redacted]')
  .replace(/https?:\/\/\S+/g, '[url removed]');

function pointNear(actual, expected, tolerance = 0.03) {
  assert(actual && Number.isFinite(actual.lat) && Number.isFinite(actual.lng), 'Expected finite geocoded coordinates');
  assert(Math.abs(actual.lat - expected.lat) < tolerance && Math.abs(actual.lng - expected.lng) < tolerance,
    'Geocoded point must be near the selected public landmark');
}

function samePoint(actual, expected) {
  pointNear(actual, expected, 0.000001);
}

function distanceMetres(left, right) {
  const radians = degrees => degrees * Math.PI / 180;
  const latitude = radians(right.lat - left.lat);
  const longitude = radians(right.lng - left.lng);
  const distance = Math.sin(latitude / 2) ** 2 + Math.cos(radians(left.lat)) *
    Math.cos(radians(right.lat)) * Math.sin(longitude / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(distance), Math.sqrt(1 - distance));
}

function safeParticipant(participant) {
  return Object.fromEntries(participantKeys.map(key => [key, participant[key]]));
}

async function watchParticipants(adapter, eventId, token) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 45000);
  let response;
  try {
    response = await adapter.openStream(eventId, token, abort.signal);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
  } catch (error) {
    abort.abort();
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const frames = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamError;
  let ended = false;
  const pump = (async () => {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const lines = buffer.slice(0, boundary).split('\n');
          buffer = buffer.slice(boundary + 2);
          const type = lines.find(line => line.startsWith('event:'))?.slice(6).trim();
          const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
          if ((type === 'heartbeat' || type?.startsWith('participant:')) && data) frames.push({ type, data: JSON.parse(data) });
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) streamError = error;
    } finally {
      ended = true;
    }
  })();
  const wait = async (predicate, after = 0) => {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const found = frames.slice(after).find(predicate);
      if (found) return found;
      assert(!streamError && !ended, 'Participant SSE connection ended before expected evidence');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail('Expected participant SSE frame was not received');
  };
  try {
    await wait(frame => frame.type === 'heartbeat' && Number.isFinite(Date.parse(frame.data.timestamp)));
  } catch (error) {
    abort.abort();
    await pump;
    throw error;
  }
  return {
    cursor: () => frames.length,
    evidence: () => frames.map(({ type, data }) => ({ type, data: data.participant
      ? { participant: Object.fromEntries(['id', 'name', 'address', 'lat', 'lng', 'color', 'fuzzyLocation', 'isOrganizer']
        .map(key => [key, data.participant[key]])) }
      : type === 'heartbeat' ? { timestamp: data.timestamp } : { participantId: data.participantId } })),
    async participant(kind, id, after, expected) {
      const frame = await wait(item => item.type === `participant:${kind}` &&
        (item.data.participant?.id ?? item.data.participantId) === id, after);
      if (expected) {
        const participant = frame.data.participant;
        assert.deepEqual(Object.keys(participant).sort(), ['address', 'color', 'fuzzyLocation', 'id', 'isOrganizer', 'lat', 'lng', 'name']);
        assert.equal(participant.name, expected.name);
        assert.equal(participant.address, expected.address);
        assert.equal(participant.fuzzyLocation, expected.fuzzyLocation);
        samePoint({ lat: participant.lat, lng: participant.lng }, expected.location);
      }
      await adapter.checkpoint();
      return frame;
    },
    async close() {
      abort.abort();
      await pump;
      assert(!streamError, 'Participant SSE connection failed');
    },
  };
}

export async function runParticipantsScenario({ page, browser, run, eventId, organizerId, evidence, capture, action, adapter }) {
  const observations = [];
  const errors = [];
  const network = [];
  const streams = [];
  let guestContext;
  let guest;
  let status = 'FAIL';
  const collection = `/api/events/${eventId}/participants`;
  const meetingUrl = `${run.client_url}/meet/${eventId}?view=participant`;
  const save = () => writeFile(path.join(evidence, 'participants-state.json'), JSON.stringify({ status, event_id: eventId,
    observations, streams: streams.map(stream => stream.evidence()), network, errors }, null, 2));
  const event = async () => {
    const response = await adapter.read(`/api/events/${eventId}`);
    assert.equal(response.status, 200);
    return response.body;
  };
  const responseFor = (activePage, pathname, method) => activePage.waitForResponse(response =>
    new URL(response.url()).origin === run.backend_url && new URL(response.url()).pathname === pathname && response.request().method() === method);
  const mutate = async (activePage, pathname, method, trigger) => {
    const [response] = await Promise.all([responseFor(activePage, pathname, method), trigger()]);
    assert.equal(response.status(), method === 'POST' ? 201 : 200);
    return { body: await response.json(), input: response.request().postDataJSON() };
  };
  const selectAddress = async (activePage, label, query, match) => {
    const field = activePage.getByRole('combobox', { name: label, exact: true });
    await field.fill(query);
    const option = activePage.getByRole('listbox').getByRole('option').filter({ hasText: match }).first();
    await option.waitFor();
    const selected = await option.innerText();
    await option.click();
    const address = await field.inputValue();
    assert(address.trim());
    action('Select a real Google suggestion for a synthetic public landmark', { query, selected, address });
    return address;
  };
  const settlePage = async activePage => {
    await activePage.getByRole('heading', { name: 'Participants', exact: true }).waitFor();
    const skip = activePage.getByText('Skip tutorial', { exact: true });
    if (await skip.isVisible()) await skip.click();
    await activePage.locator('.cat-portal').waitFor({ state: 'detached' });
  };
  const edit = async (activePage, name) => {
    await activePage.getByText(name, { exact: true }).hover();
    await activePage.getByRole('button', { name: `Edit ${name}`, exact: true }).click();
    await activePage.getByRole('heading', { name: 'Edit Participant', exact: true }).waitFor();
    await activePage.getByRole('button', { name: 'Save Changes', exact: true }).click({ trial: true });
  };
  const saveEdit = async (activePage, id) => {
    const result = await mutate(activePage, `${collection}/${id}`, 'PATCH', () =>
      activePage.getByRole('button', { name: 'Save Changes', exact: true }).click());
    await activePage.getByRole('heading', { name: 'Edit Participant', exact: true }).waitFor({ state: 'hidden' });
    return result;
  };
  const state = async (label, id, expected) => {
    const publicEvent = await event();
    const participant = publicEvent.participants.find(item => item.id === id);
    assert(participant, `${label}: participant must exist publicly`);
    assert.deepEqual(Object.keys(participant).sort(), participantKeys);
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(participant[key], value, `${label}: public ${key}`);
    const database = await adapter.stored(eventId);
    const row = database.participants.find(item => item.id === id);
    assert(row, `${label}: participant must persist`);
    assert.equal(row.name, participant.name);
    assert.equal(row.fuzzy_location, participant.fuzzyLocation);
    assert.equal(row.color, participant.color);
    samePoint(participant.location, { lat: Number(row.lat), lng: Number(row.lng) });
    if (!participant.fuzzyLocation) assert.equal(row.address, participant.address);
    else assert.equal(participant.address, null);
    observations.push({ label, participant: safeParticipant(participant), database: row });
    await adapter.checkpoint();
    await save();
    return { participant, row };
  };
  const credentials = async (activePage, role) => {
    const token = await activePage.evaluate(({ id, role }) => localStorage.getItem(`${role}_token_${id}`), { id: eventId, role });
    assert(typeof token === 'string' && /^pt_[0-9a-f]{64}$/.test(token), 'Expected a credential issued by the UI flow');
    return token;
  };
  try {
    await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await settlePage(page);
    const organizerToken = await credentials(page, 'organizer');
    const organizerStream = await watchParticipants(adapter, eventId, organizerToken);
    streams.push(organizerStream);
    const organizerAddress = await selectAddress(page, 'Where are you coming from?', 'San Diego Central Library', /Central Library/);
    let cursor = organizerStream.cursor();
    const located = await mutate(page, `${collection}/${organizerId}`, 'PATCH', () => page.getByRole('button', { name: 'Save my location', exact: true }).click());
    pointNear(located.body.location, { lat: 32.7098, lng: -117.1537 });
    await organizerStream.participant('updated', organizerId, cursor, located.body);
    await state('organizer location', organizerId, { address: organizerAddress, fuzzyLocation: false });
    await page.getByRole('button', { name: 'Save my location', exact: true }).waitFor({ state: 'hidden' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settlePage(page);
    assert.equal(await page.getByRole('button', { name: 'Save my location', exact: true }).count(), 0);
    await capture('participants-01-organizer-location', page);

    guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await adapter.guardContext(guestContext);
    guest = await guestContext.newPage();
    guest.setDefaultTimeout(45000);
    guest.on('pageerror', error => errors.push(scrub(error.message)));
    guest.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/')) network.push({ method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() });
    });
    await guest.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await settlePage(guest);
    await guest.getByRole('button', { name: 'Join Event', exact: true }).click();
    let guestName = 'Verification participant';
    await guest.getByLabel('Name', { exact: true }).fill(guestName);
    const guestAddress = await selectAddress(guest, 'Starting location', 'Balboa Park San Diego', /Balboa Park/);
    cursor = organizerStream.cursor();
    const joined = await mutate(guest, collection, 'POST', () => guest.getByRole('button', { name: 'Add Participant', exact: true }).click());
    assert.match(joined.body.participantToken, /^pt_[0-9a-f]{64}$/);
    const guestId = joined.body.id;
    const guestToken = joined.body.participantToken;
    pointNear(joined.body.location, { lat: 32.732, lng: -117.145 });
    await page.getByText(guestName, { exact: true }).waitFor();
    await guest.getByRole('button', { name: `Edit ${guestName}`, exact: true }).waitFor();
    assert.equal(await credentials(guest, 'participant'), guestToken);
    await organizerStream.participant('added', guestId, cursor, joined.body);
    assert.equal((await state('self join', guestId, { address: guestAddress, fuzzyLocation: false })).row.has_credential, true);
    action('Guest joins through a fresh browser; UI-issued token, stored row and organizer live update agree');
    await guest.evaluate(id => localStorage.removeItem(`participant_id_${id}`), eventId);
    const [identity] = await Promise.all([responseFor(guest, `/api/events/${eventId}/me`, 'GET'), guest.reload({ waitUntil: 'domcontentloaded' })]);
    assert.equal(identity.status(), 200);
    await settlePage(guest);
    await guest.getByRole('button', { name: `Edit ${guestName}`, exact: true }).waitFor();
    assert.equal(await guest.evaluate(id => localStorage.getItem(`participant_id_${id}`), eventId), guestId);
    const guestStream = await watchParticipants(adapter, eventId, guestToken);
    streams.push(guestStream);
    await capture('participants-02-joined', guest);

    const addedPeople = [];
    await page.getByRole('button', { name: 'Add Participant', exact: true }).click();
    for (const [name, query, match, point] of [
      ['Verification friend', 'San Diego Natural History Museum', /Natural History Museum/, { lat: 32.732, lng: -117.147 }],
      ['Verification second friend', 'San Diego Museum of Art', /Museum of Art/, { lat: 32.732, lng: -117.150 }],
    ]) {
      await page.getByLabel('Name', { exact: true }).fill(name);
      const address = await selectAddress(page, 'Starting location', query, match);
      cursor = guestStream.cursor();
      const added = await mutate(page, collection, 'POST', () => page.getByRole('button', { name: 'Add Participant', exact: true }).click());
      assert.equal(Object.hasOwn(added.body, 'participantToken'), false);
      pointNear(added.body.location, point);
      await page.getByRole('status').filter({ hasText: `${name} added.` }).waitFor();
      assert.equal(await page.getByLabel('Name', { exact: true }).inputValue(), '');
      await guest.getByText(name, { exact: true }).waitFor();
      await guestStream.participant('added', added.body.id, cursor, added.body);
      assert.equal((await state('organizer addition', added.body.id, { name, address, fuzzyLocation: false })).row.has_credential, false);
      addedPeople.push({ id: added.body.id, name });
    }
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await credentials(page, 'organizer'), organizerToken);
    await capture('participants-03-added', page);

    await edit(guest, guestName);
    guestName = 'Verification participant renamed';
    await guest.getByLabel('Name', { exact: true }).fill(guestName);
    cursor = organizerStream.cursor();
    const renamed = await saveEdit(guest, guestId);
    assert.equal(Object.hasOwn(renamed.input, 'address'), false, 'Unchanged address must be omitted');
    await page.getByText(guestName, { exact: true }).waitFor();
    await organizerStream.participant('updated', guestId, cursor, renamed.body);
    samePoint(renamed.body.location, joined.body.location);
    await state('name-only edit', guestId, { name: guestName, address: guestAddress });

    await edit(guest, guestName);
    const privacy = guest.getByRole('switch', { name: 'Hide exact address', exact: true });
    assert.equal(await privacy.getAttribute('aria-checked'), 'false');
    await privacy.click();
    cursor = organizerStream.cursor();
    const hidden = await saveEdit(guest, guestId);
    assert.equal(hidden.body.address, null);
    assert.equal(hidden.body.fuzzyLocation, true);
    assert.equal(Object.hasOwn(hidden.input, 'address'), false);
    await organizerStream.participant('updated', guestId, cursor, hidden.body);
    const fuzzy = await state('fuzzy location', guestId, { name: guestName, address: null, fuzzyLocation: true });
    assert.equal(fuzzy.row.address, guestAddress);
    assert.notDeepEqual(fuzzy.participant.location, joined.body.location);
    const displacement = distanceMetres(fuzzy.participant.location, joined.body.location);
    assert(displacement >= 803 && displacement <= 1611, 'Fuzzy displacement must match the displayed 0.5 to 1 mile range');
    const own = await adapter.read(`/api/events/${eventId}/me`, { token: guestToken });
    assert.equal(own.status, 200);
    assert.equal(own.body.participantId, guestId);
    assert.equal(own.body.address, guestAddress);
    observations.push({ label: 'private own address', participant_id: guestId, private_address_matches_selected: true });
    await page.getByText('Approximate location', { exact: true }).waitFor();
    await guest.getByText('Approximate location', { exact: true }).waitFor();
    await guest.reload({ waitUntil: 'domcontentloaded' });
    await settlePage(guest);
    await guest.getByText('Approximate location', { exact: true }).waitFor();
    assert.equal(await guest.getByRole('button', { name: 'Save my location', exact: true }).count(), 0);
    await edit(guest, guestName);
    assert.equal(await guest.getByRole('combobox', { name: 'Starting location', exact: true }).inputValue(), guestAddress);
    guestName = 'Verification participant after reload';
    await guest.getByLabel('Name', { exact: true }).fill(guestName);
    cursor = organizerStream.cursor();
    const guestRenameCursor = guestStream.cursor();
    const hiddenRename = await saveEdit(guest, guestId);
    assert.equal(Object.hasOwn(hiddenRename.input, 'address'), false);
    samePoint(hiddenRename.body.location, hidden.body.location);
    await organizerStream.participant('updated', guestId, cursor, hiddenRename.body);
    await guestStream.participant('updated', guestId, guestRenameCursor, hiddenRename.body);
    await page.getByText(guestName, { exact: true }).waitFor();
    assert.equal((await state('fuzzy rename after reload', guestId, { name: guestName, address: null, fuzzyLocation: true })).row.address, guestAddress);
    await capture('participants-04-fuzzy-reloaded-edit', guest);
    action('Private own address remains editable after reload; unchanged edits preserve stored fuzzy coordinates and redact public HTTP/SSE');

    await edit(page, guestName);
    assert.equal(await page.getByRole('combobox', { name: 'Starting location', exact: true }).inputValue(), '',
      'An organizer editing another fuzzy participant must not receive the private address');
    assert.equal(await page.getByRole('switch', { name: 'Hide exact address', exact: true }).getAttribute('aria-checked'), 'true');
    guestName = 'Verification participant organizer renamed';
    await page.getByLabel('Name', { exact: true }).fill(guestName);
    cursor = guestStream.cursor();
    const organizerRenameCursor = organizerStream.cursor();
    const organizerRename = await saveEdit(page, guestId);
    assert.equal(Object.hasOwn(organizerRename.input, 'address'), false, 'A blank hidden address must be omitted from the edit');
    assert.equal(organizerRename.input.fuzzyLocation, true);
    assert.equal(organizerRename.body.address, null);
    samePoint(organizerRename.body.location, hidden.body.location);
    await guestStream.participant('updated', guestId, cursor, organizerRename.body);
    await organizerStream.participant('updated', guestId, organizerRenameCursor, organizerRename.body);
    await guest.getByText(guestName, { exact: true }).waitFor();
    const organizerRenamedState = await state('organizer renames hidden participant', guestId,
      { name: guestName, address: null, fuzzyLocation: true });
    assert.equal(organizerRenamedState.row.address, guestAddress);
    assert.equal(organizerRenamedState.row.formatted_address, fuzzy.row.formatted_address);
    observations.push({ label: 'organizer hidden-address edit', participant_id: guestId,
      editor_address_blank: true, patch_omits_address: true, private_address_unchanged: true });
    await capture('participants-04b-organizer-hidden-edit', page);
    action('Organizer renames another fuzzy participant with a blank address field; the live update preserves private address and stored coordinates');

    await edit(guest, guestName);
    await guest.getByRole('switch', { name: 'Hide exact address', exact: true }).click();
    cursor = organizerStream.cursor();
    const restored = await saveEdit(guest, guestId);
    assert.equal(Object.hasOwn(restored.input, 'address'), false);
    samePoint(restored.body.location, joined.body.location);
    await organizerStream.participant('updated', guestId, cursor, restored.body);
    await state('exact location restored', guestId, { name: guestName, address: guestAddress, fuzzyLocation: false });
    await page.getByText('Approximate location', { exact: true }).waitFor({ state: 'hidden' });

    await edit(guest, guestName);
    const replacementAddress = await selectAddress(guest, 'Starting location', 'USS Midway Museum San Diego', /USS Midway/);
    assert.notEqual(replacementAddress, guestAddress);
    cursor = organizerStream.cursor();
    const replacement = await saveEdit(guest, guestId);
    assert.equal(replacement.input.address, replacementAddress);
    assert.equal(replacement.input.fuzzyLocation, false);
    pointNear(replacement.body.location, { lat: 32.7137, lng: -117.1752 }, 0.005);
    assert(distanceMetres(replacement.body.location, restored.body.location) > 500,
      'Replacing Balboa Park with USS Midway must move the stored location');
    await organizerStream.participant('updated', guestId, cursor, replacement.body);
    await page.getByText(replacementAddress, { exact: true }).waitFor();
    const replacedState = await state('own address replacement', guestId,
      { name: guestName, address: replacementAddress, fuzzyLocation: false });
    assert.notEqual(replacedState.row.formatted_address, fuzzy.row.formatted_address);
    const replacedIdentity = await adapter.read(`/api/events/${eventId}/me`, { token: guestToken });
    assert.equal(replacedIdentity.status, 200);
    assert.equal(replacedIdentity.body.address, replacementAddress);
    await capture('participants-04c-address-replaced', guest);
    action('Participant selects another real public landmark; HTTP, live organizer view, SSE, private identity and stored coordinates reflect the replacement');

    const cancelledWrites = [];
    const observeCancelledWrite = request => {
      const url = new URL(request.url());
      if (url.origin === run.backend_url && url.pathname.startsWith(`/api/events/${eventId}`) &&
          !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        cancelledWrites.push({ method: request.method(), path: url.pathname });
      }
    };
    guest.on('request', observeCancelledWrite);
    try {
      await edit(guest, guestName);
      assert.equal(await guest.getByRole('combobox', { name: 'Starting location', exact: true }).inputValue(), replacementAddress);
      await guest.getByLabel('Name', { exact: true }).fill('Unsubmitted participant draft');
      await guest.getByRole('combobox', { name: 'Starting location', exact: true }).fill('Unsubmitted address draft');
      await guest.getByRole('switch', { name: 'Hide exact address', exact: true }).click();
      await guest.getByRole('button', { name: 'Cancel', exact: true }).click();
      await guest.getByRole('heading', { name: 'Edit Participant', exact: true }).waitFor({ state: 'hidden' });
      await guest.getByText(guestName, { exact: true }).waitFor();
      const afterCancel = await state('cancelled participant edit', guestId,
        { name: guestName, address: replacementAddress, fuzzyLocation: false });
      assert.deepEqual(afterCancel.row, replacedState.row);
      await guest.reload({ waitUntil: 'domcontentloaded' });
      await settlePage(guest);
      await guest.getByText(guestName, { exact: true }).waitFor();
      await guest.getByText(replacementAddress, { exact: true }).waitFor();
      assert.equal(await page.getByText('Unsubmitted participant draft', { exact: true }).count(), 0);
      assert.deepEqual(cancelledWrites, [], 'Cancelling an edit must not send any meeting mutation');
      observations.push({ label: 'cancelled edit has no mutation', participant_id: guestId, mutation_requests: 0 });
      await capture('participants-04d-edit-cancelled', guest);
      action('Cancel discards draft name, address and privacy changes; no mutation is sent and reload preserves the saved participant');
    } finally {
      guest.off('request', observeCancelledWrite);
    }

    for (const participant of addedPeople) {
      await page.getByText(participant.name, { exact: true }).hover();
      await page.getByRole('button', { name: `Remove ${participant.name}`, exact: true }).click();
      await page.getByRole('heading', { name: 'Delete Participant', exact: true }).waitFor();
      cursor = guestStream.cursor();
      await mutate(page, `${collection}/${participant.id}`, 'DELETE', () => page.getByRole('button', { name: 'Delete', exact: true }).click());
      await guest.getByText(participant.name, { exact: true }).waitFor({ state: 'hidden' });
      await guestStream.participant('removed', participant.id, cursor);
      assert(!(await event()).participants.some(item => item.id === participant.id));
      assert(!(await adapter.stored(eventId)).participants.some(item => item.id === participant.id));
    }
    await guest.getByText(guestName, { exact: true }).hover();
    await guest.getByRole('button', { name: `Remove ${guestName}`, exact: true }).click();
    await guest.getByRole('heading', { name: 'Leave Event', exact: true }).waitFor();
    cursor = organizerStream.cursor();
    await mutate(guest, `${collection}/${guestId}`, 'DELETE', () => guest.getByRole('button', { name: 'Leave', exact: true }).click());
    await guest.getByRole('button', { name: 'Join Event', exact: true }).waitFor();
    await page.getByText(guestName, { exact: true }).waitFor({ state: 'hidden' });
    await organizerStream.participant('removed', guestId, cursor);
    const rejected = await adapter.read(`/api/events/${eventId}/me`, { token: guestToken });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.body.error.code, 'FORBIDDEN');
    const finalDatabase = await adapter.stored(eventId);
    assert.deepEqual(finalDatabase.participants.map(item => item.id), [organizerId]);
    await guest.reload({ waitUntil: 'domcontentloaded' });
    await settlePage(guest);
    await guest.getByRole('button', { name: 'Join Event', exact: true }).waitFor();
    observations.push({ label: 'participants removed', database: finalDatabase, departed_identity_status: rejected.status });
    await capture('participants-05-left', guest);
    assert.deepEqual(errors, [], 'Guest browser errors invalidate participant acceptance');
    assert(network.filter(entry => entry.path.startsWith('/api/events')).every(entry => entry.origin === run.backend_url));
    action('Organizer removes tokenless additions; guest leaves; second browsers, storage and rejected old credential agree');
    status = 'PASS';
    return { scope: ['real Google autocomplete and participant geocoding', 'organizer inline location', 'guest join and token-only recovery', 'consecutive organizer additions without credentials', 'own name-only edit', 'fuzzy HTTP/SSE privacy and private /me', 'fuzzy reload and unchanged-address edit', 'organizer renames another fuzzy participant without address disclosure', 'privacy off restores exact location', 'self address replacement with live update', 'cancelled edit preserves saved state', 'organizer removal and self leave with live updates'],
      not_verified: ['phone layouts', 'current-location permission', 'account default address', 'organizer override of self-joined privacy', 'removal cancellation', 'published-state controls', 'routes', 'vote writes and publishing', 'account writes', 'historical data import', 'production frontend serving'] };
  } catch (error) {
    observations.push({ label: 'failure', error: scrub(error) });
    try { await capture('participants-failure', guest ?? page); } catch {}
    throw error;
  } finally {
    const closed = await Promise.allSettled([
      ...streams.map(stream => stream.close()),
      ...(guestContext ? [guestContext.close()] : []),
    ]);
    if (closed.some(result => result.status === 'rejected')) {
      status = 'FAIL';
      observations.push({ label: 'teardown failure', errors: closed.filter(result => result.status === 'rejected').map(result => scrub(result.reason)) });
    }
    await save();
    assert(closed.every(result => result.status === 'fulfilled'), 'Participant browser or SSE teardown failed');
  }
}
