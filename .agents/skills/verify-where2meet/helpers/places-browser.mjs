import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validatePhotoRedirect } from './ppe-browser.mjs';

export const scrubPlacesError = value => String(value).replace(/AIza[\w-]+/g, '[Google key redacted]')
  .replace(/\bpt_[a-zA-Z0-9.]+/g, '[participant credential redacted]')
  .replace(/https?:\/\/\S+/g, '[url removed]');

const point = value => value && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
  Number.isFinite(value.lng) && Math.abs(value.lng) <= 180;
const nullableNumber = value => value === null || Number.isFinite(value);
const venueKeys = ['id', 'name', 'address', 'location', 'types', 'rating', 'userRatingsTotal', 'priceLevel', 'openNow', 'photoUrl'];
const near = (value, expected) => point(value) && Math.abs(value.lat - expected.lat) < 0.03 && Math.abs(value.lng - expected.lng) < 0.03;

export function assertVenue(venue, backendOrigin, { id, details = false } = {}) {
  assert(venue && typeof venue === 'object', 'Venue must be an object');
  assert.deepEqual(Object.keys(venue).sort(), [...venueKeys, ...(details ? ['formattedPhoneNumber', 'website', 'openingHours'] : [])].sort());
  assert(typeof venue.id === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(venue.id) && !/AIza|pt_/.test(venue.id), 'Expected an observed provider place ID');
  if (id) assert.equal(venue.id, id, 'Details must describe the selected provider place');
  assert(typeof venue.name === 'string' && venue.name.length && typeof venue.address === 'string' && point(venue.location), 'Venue identity and geometry must be complete');
  assert(Array.isArray(venue.types) && venue.types.every(type => typeof type === 'string'), 'Venue types must be strings');
  assert(nullableNumber(venue.rating) && nullableNumber(venue.userRatingsTotal) && nullableNumber(venue.priceLevel), 'Venue numeric metadata must be nullable numbers');
  assert(venue.openNow === null || typeof venue.openNow === 'boolean', 'Venue opening state must be nullable boolean');
  assert(venue.photoUrl === null || venue.photoUrl === `${backendOrigin}/api/venues/${encodeURIComponent(venue.id)}/photo`, 'Venue photos must use the owned backend endpoint without credentials');
  if (details) {
    assert(venue.formattedPhoneNumber === null || typeof venue.formattedPhoneNumber === 'string');
    assert(venue.website === null || typeof venue.website === 'string');
    assert(venue.openingHours === null || Array.isArray(venue.openingHours) && venue.openingHours.every(line => typeof line === 'string'));
  }
  return { id: venue.id, name: venue.name, address: venue.address, location: venue.location,
    types: venue.types, has_photo: venue.photoUrl !== null };
}

export function assertDirections(data, venueId, mode, participantIds) {
  const keys = (value, expected) => {
    assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected a directions object');
    assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), 'Directions evidence accepts only declared fields');
  };
  keys(data, ['venueId', 'travelMode', 'routes', 'outcomes']);
  assert.equal(data?.venueId, venueId);
  assert.equal(data.travelMode, mode);
  assert(Array.isArray(data.routes) && Array.isArray(data.outcomes), 'Directions must include routes and explicit outcomes');
  assert.deepEqual(data.routes.map(route => route.participantId).sort(), [...participantIds].sort(), 'Both synthetic participants need one real route');
  assert.deepEqual(data.outcomes.map(outcome => outcome.participantId).sort(), [...participantIds].sort(), 'Outcomes must cover the exact participant set');
  for (const outcome of data.outcomes) {
    keys(outcome, ['participantId', 'status']);
    assert.equal(outcome.status, 'found', 'Unavailable or missing routes are incomplete real-provider proof');
  }
  for (const route of data.routes) {
    keys(route, ['participantId', 'distance', 'duration', 'polyline']);
    keys(route.distance, ['value', 'text']);
    keys(route.duration, ['value', 'text']);
    assert(Number.isFinite(route.distance?.value) && route.distance.value > 0 && typeof route.distance.text === 'string' && route.distance.text.length,
      'This distinct-landmark fixture requires positive distance and visible text');
    assert(Number.isFinite(route.duration?.value) && route.duration.value > 0 && typeof route.duration.text === 'string' && route.duration.text.length,
      'This distinct-landmark fixture requires positive duration and visible text');
    assert(typeof route.polyline === 'string' && /^[\x3f-\x7e]+$/.test(route.polyline), 'Expected a nonempty encoded polyline');
  }
  return data;
}

export function placesStoredProjection(stored) {
  return { event: { id: stored.event.id, published_at: stored.event.published_at },
    participants: stored.participants.map(({ id, event_id, name, is_organizer, has_credential, lat, lng, fuzzy_location }) =>
      ({ id, event_id, name, is_organizer, has_credential, lat, lng, fuzzy_location })) };
}

export async function runPlacesScenario({ page, browser, run, eventId, organizerId, evidence, capture, action, adapter }) {
  const observations = [];
  const network = [];
  const errors = [];
  const photoResponses = [];
  const touchedPlaces = new Set();
  let status = 'FAIL';
  let stage = 'participant setup';
  let guestContext;
  const collection = `/api/events/${eventId}/participants`;
  const observeResponse = response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) network.push({ method: response.request().method(), origin: url.origin, path: url.pathname, status: response.status() });
    if (url.origin === run.backend_url && /\/photo$/.test(url.pathname)) photoResponses.push(response);
  };
  const observeError = error => errors.push(scrubPlacesError(error.message));
  page.on('response', observeResponse);
  page.on('pageerror', observeError);
  const save = async () => writeFile(path.join(evidence, 'places-state.json'), JSON.stringify({ status, stage, event_id: eventId,
    external_boundary: 'real Google Maps, Places and Directions; no provider fixture', observations, network, errors,
    shared_provider_cache: { policy: 'trusted provider cache rows may remain; no Venue deletion or restoration',
      touched_place_ids: [...touchedPlaces], touched_place_count: touchedPlaces.size,
      exact_retained_row_count: 'not asserted' } }, null, 2));
  const responseFor = (activePage, pathname, method, mode) => activePage.waitForResponse(response => {
    const url = new URL(response.url());
    return url.origin === run.backend_url && url.pathname === pathname && response.request().method() === method &&
      (!mode || url.searchParams.get('travelMode') === mode);
  });
  const settle = async activePage => {
    await activePage.getByRole('heading', { name: 'Participants', exact: true }).waitFor();
    const skip = activePage.getByText('Skip tutorial', { exact: true });
    if (await skip.isVisible()) await skip.click();
    await activePage.locator('.cat-portal').waitFor({ state: 'detached' });
  };
  const address = async (activePage, label, query, match) => {
    const field = activePage.getByRole('combobox', { name: label, exact: true });
    await field.fill(query);
    const option = activePage.getByRole('listbox').getByRole('option').filter({ hasText: match }).first();
    await option.waitFor();
    await option.click();
    assert((await field.inputValue()).trim(), 'A real suggestion must provide the starting address');
    action('Select a real Google public-landmark suggestion', { query });
  };
  const mutate = async (activePage, pathname, method, trigger) => {
    const [response] = await Promise.all([responseFor(activePage, pathname, method), trigger()]);
    assert.equal(response.status(), method === 'POST' ? 201 : 200);
    return response.json();
  };
  try {
    await page.goto(`${run.client_url}/meet/${eventId}?view=participant`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await settle(page);
    await page.getByRole('region', { name: 'Map', exact: true }).waitFor();
    assert.equal(await page.getByText('Map temporarily unavailable', { exact: true }).count(), 0);
    await address(page, 'Where are you coming from?', 'San Diego Central Library', /Central Library/);
    const organizer = await mutate(page, `${collection}/${organizerId}`, 'PATCH', () =>
      page.getByRole('button', { name: 'Save my location', exact: true }).click());
    assert.equal(organizer.id, organizerId);
    assert(near(organizer.location, { lat: 32.7098, lng: -117.1537 }), 'Organizer location must be geocoded near the selected library');
    await page.getByRole('button', { name: 'Save my location', exact: true }).waitFor({ state: 'hidden' });
    await adapter.checkpoint();

    guestContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await adapter.guardContext(guestContext);
    const guest = await guestContext.newPage();
    guest.setDefaultTimeout(45000);
    guest.on('response', observeResponse);
    guest.on('pageerror', observeError);
    await guest.goto(`${run.client_url}/meet/${eventId}?view=participant`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await settle(guest);
    await guest.getByRole('button', { name: 'Join Event', exact: true }).click();
    await guest.getByLabel('Name', { exact: true }).fill('Verification guest');
    await address(guest, 'Starting location', 'Balboa Park San Diego', /Balboa Park/);
    const joined = await mutate(guest, collection, 'POST', () => guest.getByRole('button', { name: 'Add Participant', exact: true }).click());
    assert(typeof joined.participantToken === 'string' && /^pt_[0-9a-f]{64}$/.test(joined.participantToken), 'Guest needs a UI-issued credential');
    assert(near(joined.location, { lat: 32.732, lng: -117.145 }) && joined.id !== organizerId, 'Guest must have a separate geocoded origin near the selected park');
    await page.getByText('Verification guest', { exact: true }).waitFor();
    const participantIds = [organizerId, joined.id];
    const stored = await adapter.stored(eventId);
    assert.deepEqual(stored.participants.map(person => person.id).sort(), [...participantIds].sort());
    for (const person of [organizer, joined]) {
      const row = stored.participants.find(entry => entry.id === person.id);
      assert(row.has_credential && Math.abs(Number(row.lat) - person.location.lat) < 0.000001 &&
        Math.abs(Number(row.lng) - person.location.lng) < 0.000001, 'Persisted origin must match the real participant response');
    }
    const people = [organizer, joined].map(({ id, name, location }) => ({ id, name, location }));
    observations.push({ label: 'two persisted public-landmark origins', participants: people, database: placesStoredProjection(stored) });
    await adapter.checkpoint();
    await save();
    await capture('places-01-participants', page);

    stage = 'search';
    await page.goto(`${run.client_url}/meet/${eventId}?view=venue`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const field = page.getByRole('combobox', { name: 'Search venues', exact: true });
    await field.fill('coffee');
    await page.getByRole('option', { name: /Search.*coffee.*near your group/ }).waitFor();
    const [searchResponse] = await Promise.all([responseFor(page, '/api/venues/search', 'POST'), field.press('Enter')]);
    assert.equal(searchResponse.status(), 200, 'Nearby search must succeed against the real provider');
    const search = await searchResponse.json();
    assert(Array.isArray(search.venues) && search.venues.length > 0 && search.totalResults === search.venues.length && point(search.searchCenter),
      'Search needs the complete nonempty venue envelope');
    assert.deepEqual(search.searchCenter, searchResponse.request().postDataJSON().center);
    const summaries = search.venues.map(venue => assertVenue(venue, run.backend_url));
    const candidates = search.venues.filter(venue => search.venues.filter(other => other.name === venue.name).length === 1 &&
      people.every(person => Math.hypot(venue.location.lat - person.location.lat, venue.location.lng - person.location.lng) > 0.001));
    const venue = candidates.find(candidate => candidate.photoUrl) ?? candidates[0];
    assert(venue, 'Need a uniquely named real venue with a destination distinct from both starting landmarks');
    observations.push({ label: 'coffee search', search_center: search.searchCenter, venues: summaries, selected_place_id: venue.id });
    touchedPlaces.add(venue.id);
    await save();
    const card = page.getByRole('button').filter({ has: page.getByRole('heading', { level: 3, name: venue.name, exact: true }) });
    const directionsPath = `/api/events/${eventId}/venues/${encodeURIComponent(venue.id)}/directions`;
    stage = 'details and driving';
    const [detailResponse, drivingResponse] = await Promise.all([
      responseFor(page, `/api/venues/${encodeURIComponent(venue.id)}`, 'GET'),
      responseFor(page, directionsPath, 'GET', 'driving'),
      card.click(),
    ]);
    assert.equal(detailResponse.status(), 200, 'A retained search card does not prove details succeeded');
    const detail = await detailResponse.json();
    observations.push({ label: 'selected details', venue: assertVenue(detail, run.backend_url, { id: venue.id, details: true }) });
    await save();
    const panel = page.getByRole('complementary', { name: detail.name, exact: true });
    await panel.getByRole('heading', { level: 2, name: detail.name, exact: true }).waitFor();
    await panel.getByText(detail.address, { exact: true }).waitFor();
    if (detail.photoUrl) {
      stage = 'photo';
      const photo = panel.getByRole('img', { name: detail.name, exact: true });
      assert.equal(await photo.getAttribute('src'), detail.photoUrl);
      await photo.evaluate(image => image.decode());
      assert(await photo.evaluate(image => image.complete && image.naturalWidth > 0), 'Selected venue photo must load');
      const imageResponse = photoResponses.find(response => response.url() === detail.photoUrl);
      assert(imageResponse, 'The loaded image needs an observed backend photo response');
      validatePhotoRedirect(imageResponse.status(), await imageResponse.allHeaders());
      observations.push({ label: 'owned photo loaded', place_id: venue.id, backend_status: imageResponse.status(),
        redirect_origin: 'https://lh3.googleusercontent.com', redirect_has_query_or_credentials: false, cache_control: 'no-store' });
      await save();
    } else {
      observations.push({ label: 'provider venue has no photo', place_id: venue.id });
    }
    const showRoutes = async (response, mode) => {
      assert.equal(response.status(), 200);
      const data = assertDirections(await response.json(), venue.id, mode, participantIds);
      await panel.getByRole('heading', { name: 'Travel Times', exact: true }).waitFor();
      await panel.getByText('Calculating routes...', { exact: true }).waitFor({ state: 'hidden' });
      for (const person of people) {
        const row = panel.locator('div.rounded-xl').filter({ has: panel.getByText(person.name, { exact: true }) });
        assert.equal(await row.count(), 1, 'Each participant must have one visible travel row');
        const route = data.routes.find(item => item.participantId === person.id);
        await row.getByText(route.duration.text, { exact: true }).waitFor();
        await row.getByText(route.distance.text, { exact: true }).waitFor();
      }
      assert.equal(await panel.getByText('No route', { exact: true }).count(), 0);
      const decoded = await page.evaluate(routes => routes.map(route =>
        google.maps.geometry.encoding.decodePath(route.polyline).length), data.routes);
      assert(decoded.every(length => length >= 2), 'Each real route needs a decodable polyline');
      observations.push({ label: `${mode} routes and per-person displayed values`, ...data });
      await save();
    };
    stage = 'driving';
    await showRoutes(drivingResponse, 'driving');
    await capture('places-02-driving', page);
    stage = 'walking';
    const [walking] = await Promise.all([responseFor(page, directionsPath, 'GET', 'walking'),
      page.getByRole('button', { name: 'Travel by Walk', exact: true }).click()]);
    await showRoutes(walking, 'walking');
    assert.equal(await page.getByRole('button', { name: 'Travel by Walk', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(new URL(page.url()).searchParams.get('travelMode'), 'walk');
    await capture('places-03-walking', page);
    const event = await adapter.read(`/api/events/${eventId}`);
    assert.equal(event.status, 200);
    assert.equal(event.body.publishedAt, null);
    assert.equal(event.body.publishedVenueId, null);
    const votes = await adapter.read(`/api/events/${eventId}/votes`);
    assert.deepEqual(votes, { status: 200, body: { venues: [], totalVotes: 0 } });
    assert(network.filter(entry => !['GET', 'HEAD', 'OPTIONS'].includes(entry.method)).every(entry =>
      entry.origin === run.backend_url && [collection, `${collection}/${organizerId}`, '/api/venues/search'].includes(entry.path)),
    'The M3 scenario cannot write votes or publication state');
    assert.deepEqual(errors, [], 'Browser errors invalidate real-provider acceptance');
    await adapter.checkpoint();
    await page.keyboard.press('Escape');
    status = 'PASS';
    stage = 'complete';
    action('Real coffee search, complete selected details, optional photo and both participants driving/walking values verified');
    return { scope: ['real Google map and public-landmark autocomplete', 'two persisted participant origins', 'coffee text search',
      'selected-ID full venue details', ...(detail.photoUrl ? ['owned photo redirect and loaded image'] : []),
      'driving and walking with exact participant outcomes and visible distance/duration', 'unpublished meeting with no vote writes'],
    not_verified: ['phone layouts', 'venue suggestion selection', 'category-only search', 'transit and bicycle routes', 'travel statistics',
      'vote writes and publication', 'account writes', 'historical import', 'production frontend serving'],
    shared_provider_cache: { touched_place_ids: [...touchedPlaces], touched_place_count: touchedPlaces.size,
      policy: 'trusted provider cache rows may remain; exact synthetic cleanup is separate', exact_retained_row_count: 'not asserted' } };
  } catch (error) {
    observations.push({ label: 'failure', stage, error: scrubPlacesError(error) });
    try { await capture('places-failure', page); } catch {}
    throw error;
  } finally {
    page.off('response', observeResponse);
    page.off('pageerror', observeError);
    try { if (guestContext) await guestContext.close(); }
    catch { status = 'FAIL'; observations.push({ label: 'guest browser teardown failed' }); }
    await save();
    assert(status === 'PASS' || observations.some(item => item.label === 'failure'), 'M3 guest teardown failed');
  }
}
