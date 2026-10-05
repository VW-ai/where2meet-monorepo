import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const controller = fileURLToPath(new URL('./ppe.py', import.meta.url));

export function ppeBridge(runDir, payload) {
  return new Promise((resolve, reject) => {
    const process = execFile('python3', [controller, '_bridge', '--run', runDir], { timeout: 90000 }, (error, stdout, stderr) => {
      if (error) {
        let reason = 'subprocess output withheld';
        try { reason = JSON.parse(stderr).error; } catch {}
        return reject(new Error(`PPE ${payload.operation} failed: ${reason}`));
      }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('PPE bridge returned invalid JSON')); }
    });
    process.stdin.end(JSON.stringify(payload));
  });
}

export function validatePhotoRedirect(status, headers) {
  assert.equal(status, 302, 'The owned photo endpoint must return 302');
  const target = new URL(headers.location);
  let decoded = headers.location;
  for (let attempt = 0; attempt < 4 && /%[0-9a-f]{2}/i.test(decoded); attempt++) decoded = decodeURIComponent(decoded);
  assert(target.protocol === 'https:' && target.hostname === 'lh3.googleusercontent.com' && !target.port &&
    !target.username && !target.password && !target.search && !target.hash &&
    !/[?#]/.test(decoded) && !/AIza|pt_|(?:api[_-]?key|key|token|credential|password)=|%[0-9a-f]{2}/i.test(decoded), 'Photo redirect is outside the allowed public image origin');
  assert(headers['cache-control']?.split(',').map(value => value.trim()).includes('no-store'), 'Photo redirect must not be cached');
  return target;
}

export async function createPpeDriver(runDir, run, context, dependencies = {}) {
  const placesGuard = ['places-routes', 'voting-publication'].includes(run.scenario);
  const checks = [];
  const failures = [];
  const pendingStreams = new Set();
  const pendingRequests = new Set();
  const streamResponses = [];
  const cancelledStreams = [];
  const validatedStreams = new Map();
  let requestSequence = 0;
  const snapshotPath = path.join(runDir, 'runtime', 'browser-state.json');
  let mutationTail = Promise.resolve();
  const bridge = payload => {
    const invoke = () => dependencies.bridge ? dependencies.bridge(payload) : ppeBridge(runDir, payload);
    if (!['record', 'record-participant', 'record-places', 'closed'].includes(payload.operation)) return invoke();
    const result = mutationTail.then(invoke);
    mutationTail = result.catch(() => {});
    return result;
  };
  const freshRun = async () => JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
  const saveSession = async () => {
    await context.storageState({ path: snapshotPath });
    await chmod(snapshotPath, 0o600);
  };

  async function guardContext(activeContext) {
    await activeContext.route(url => url.pathname === '/api' || url.pathname.startsWith('/api/'), async route => {
      const request = route.request();
      const url = new URL(request.url());
      const requestId = ++requestSequence;
      let finish;
      const pending = new Promise(resolve => { finish = resolve; });
      pendingRequests.add(pending);
      const streamCandidate = placesGuard && url.origin === run.backend_url &&
        request.method() === 'GET' && /^\/api\/events\/evt_[A-Za-z0-9_]+\/stream$/.test(url.pathname);
      if (streamCandidate) pendingStreams.add(request);
      let continued = false;
      let phase = 'redirect-check';
      let responseStatus = null;
      try {
        assert.equal(request.redirectedFrom(), null, 'API redirects are not accepted');
        if (url.origin === run.client_url) {
          assert.equal(url.pathname, '/api/auth/session', 'Only the fixed Next session proxy is permitted');
          assert.equal(request.method(), 'GET');
          if (placesGuard) {
            phase = 'fetch';
            const response = await route.fetch({ maxRedirects: 0, timeout: 45000 });
            responseStatus = response.status();
            phase = 'response-check';
            assert(response.status() < 300 || response.status() >= 400, 'The fixed session proxy cannot redirect');
            phase = 'fulfill';
            return await route.fulfill({ response });
          }
          return await route.continue();
        }
        assert.equal(url.origin, run.backend_url, 'API destination differs from confirmed PPE');
        const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method());
        if (read && !placesGuard) return await route.continue();
        const body = read ? undefined : request.postDataJSON();
        phase = 'guard';
        await bridge({ operation: 'guard', method: request.method(), url: request.url(), body });
        if (streamCandidate) {
          continued = true;
          phase = 'continue';
          await route.continue();
          phase = 'headers';
          const response = await request.response();
          const status = response?.status() ?? null;
          responseStatus = status;
          const streamPage = request.frame().page();
          if (response === null && request.failure()?.errorText === 'net::ERR_ABORTED') {
            cancelledStreams.push({ requestId, page: streamPage, path: url.pathname });
            phase = 'postflight';
            await bridge({ operation: 'postflight' });
            return;
          }
          const validType = /^text\/event-stream(?:\s*;|$)/i.test(response?.headers()['content-type'] ?? '');
          streamResponses.push({ status, content_type_valid: validType });
          assert(status === 200 && validType, 'The continued owned SSE response must be 200 text/event-stream without redirects');
          phase = 'postflight';
          await bridge({ operation: 'postflight' });
          const pageStreams = validatedStreams.get(streamPage) ?? new Map();
          pageStreams.set(url.pathname, Math.max(requestId, pageStreams.get(url.pathname) ?? 0));
          validatedStreams.set(streamPage, pageStreams);
          return;
        }
        phase = 'fetch';
        const response = await route.fetch({ maxRedirects: 0, timeout: 45000 });
        responseStatus = response.status();
        phase = 'response-check';
        const photo = placesGuard && read && /^\/api\/venues\/[^/]+\/photo$/.test(url.pathname);
        if (response.status() >= 300 && response.status() < 400) {
          assert(photo, 'Only an observed venue photo may redirect');
          validatePhotoRedirect(response.status(), response.headers());
        }
        if (request.method() === 'POST' && url.pathname === '/api/events' && response.status() === 201) {
          phase = 'record-event';
          const created = await response.json();
          await bridge({ operation: 'record', event_id: created.id, organizer_id: created.organizerParticipantId, title: created.title });
        }
        const participantCollection = url.pathname.match(/^\/api\/events\/(evt_[A-Za-z0-9_]+)\/participants$/);
        if (request.method() === 'POST' && participantCollection && response.status() === 201) {
          phase = 'record-participant';
          assert(['participants', 'places-routes', 'voting-publication'].includes(run.scenario));
          const participant = await response.json();
          await bridge({ operation: 'record-participant', event_id: participantCollection[1], participant_id: participant.id });
        }
        if (placesGuard && request.method() === 'POST' && url.pathname === '/api/venues/search' && response.status() === 200) {
          phase = 'record-places';
          await bridge({ operation: 'record-places', body: await response.json() });
        }
        phase = 'postflight';
        await bridge({ operation: 'postflight' });
        phase = 'fulfill';
        await route.fulfill({ response });
      } catch {
        const safePath = url.pathname === '/api/venues/search' ? url.pathname : /^\/api\/venues\/[^/]+\/photo$/.test(url.pathname)
          ? '/api/venues/:placeId/photo' : /^\/api\/venues\/[^/]+$/.test(url.pathname) ? '/api/venues/:placeId'
            : /\/directions$/.test(url.pathname) ? '/api/events/:eventId/venues/:placeId/directions'
              : /^\/api\/events\/evt_[A-Za-z0-9_]+\/(me|stream|votes)$/.test(url.pathname)
                ? `/api/events/:eventId/${url.pathname.split('/').at(-1)}`
                : /^\/api\/events\/evt_[A-Za-z0-9_]+$/.test(url.pathname) ? '/api/events/:eventId' : '/api/[blocked]';
        const failure = request.failure?.()?.errorText;
        failures.push({ request_id: requestId, at: new Date().toISOString(), phase, response_status: responseStatus,
          request_failure: failure === 'net::ERR_ABORTED' ? 'aborted' : failure ? 'transport-failure' : null,
          method: request.method(), origin: [run.client_url, run.backend_url].includes(url.origin) ? url.origin : '[outside-target]',
          path: placesGuard ? safePath : url.pathname });
        if (!continued) await route.abort('blockedbyclient');
      } finally {
        if (streamCandidate) pendingStreams.delete(request);
        pendingRequests.delete(pending);
        finish();
      }
    });
  }

  await guardContext(context);

  async function request(method, route, { token, body, cookie } = {}) {
    const url = run.backend_url + route;
    await bridge({ operation: 'guard', method, url, body, purpose: 'negative' });
    const headers = { ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}) };
    const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(30000) });
    const result = { status: response.status, body: await response.json() };
    await bridge({ operation: 'postflight' });
    return result;
  }

  async function negativeChecks(page, eventId) {
    await saveSession();
    const token = await page.evaluate(id => localStorage.getItem(`organizer_token_${id}`), eventId);
    assert(typeof token === 'string' && /^pt_[0-9a-f]{64}$/.test(token), 'Expected the UI-issued organizer credential');
    const original = await request('GET', `/api/events/${eventId}`);
    const database = await bridge({ operation: 'stored', event_id: eventId });
    const wrongToken = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    const cases = [
      ['missing identity credential', 'GET', `/api/events/${eventId}/me`, {}, 401, 'UNAUTHORIZED'],
      ['wrong identity credential', 'GET', `/api/events/${eventId}/me`, { token: wrongToken }, 403, 'FORBIDDEN'],
      ['missing edit credential', 'PATCH', `/api/events/${eventId}`, { body: { title: 'Must not persist' } }, 401, 'UNAUTHORIZED'],
      ['wrong edit credential', 'PATCH', `/api/events/${eventId}`, { token: wrongToken, body: { title: 'Must not persist' } }, 403, 'FORBIDDEN'],
      ['missing delete credential', 'DELETE', `/api/events/${eventId}`, {}, 401, 'UNAUTHORIZED'],
      ['wrong delete credential', 'DELETE', `/api/events/${eventId}`, { token: wrongToken }, 403, 'FORBIDDEN'],
      ['empty title', 'PATCH', `/api/events/${eventId}`, { token, body: { title: '' } }, 400, 'VALIDATION_ERROR'],
      ['overlong title', 'PATCH', `/api/events/${eventId}`, { token, body: { title: 'x'.repeat(101) } }, 400, 'VALIDATION_ERROR'],
    ];
    for (const [name, method, route, options, status, code] of cases) {
      const result = await request(method, route, options);
      assert.equal(result.status, status, name);
      assert.equal(result.body.error.code, code, name);
      const unchanged = await request('GET', `/api/events/${eventId}`);
      assert.deepEqual(unchanged, original, `${name} leaves meeting state unchanged`);
      checks.push({ name, status, code, state_unchanged: true });
    }
    assert.deepEqual(await bridge({ operation: 'stored', event_id: eventId }), database);
    const votes = await request('GET', `/api/events/${eventId}/votes`);
    assert.deepEqual(votes, { status: 200, body: { venues: [], totalVotes: 0 } });
    checks.push({ name: 'empty vote read', status: 200, body: votes.body });
    for (const options of [{}, { cookie: 'session_token=ppe-unknown-synthetic-session' }]) {
      const session = await request('GET', '/api/auth/session', options);
      assert.equal(session.status, 401);
      assert.equal(session.body.error.code, 'UNAUTHORIZED');
    }
    checks.push({ name: 'anonymous and unknown session reads', status: 401 });
    await writeFile(path.join(runDir, 'evidence', 'ppe-http-checks.json'), JSON.stringify(checks, null, 2));
  }

  async function watchTitle(page, eventId) {
    const token = await page.evaluate(id => localStorage.getItem(`organizer_token_${id}`), eventId);
    await bridge({ operation: 'guard', method: 'GET', url: `${run.backend_url}/api/events/${eventId}/stream` });
    const abort = new AbortController();
    const connectionTimer = setTimeout(() => abort.abort(), 45000);
    let response;
    try {
      response = await fetch(`${run.backend_url}/api/events/${eventId}/stream`, {
        headers: { authorization: `Bearer ${token}`, origin: run.client_url }, redirect: 'error', signal: abort.signal,
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/event-stream/);
    } catch (error) {
      abort.abort();
      throw error;
    } finally {
      clearTimeout(connectionTimer);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const frames = [];
    let streamError;
    const pump = (async () => {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let index;
          while ((index = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const type = frame.split('\n').find(line => line.startsWith('event: '))?.slice(7);
            const data = frame.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
            if (type && data) frames.push({ type, data: JSON.parse(data) });
          }
        }
      } catch (error) {
        if (!abort.signal.aborted) streamError = error;
      }
    })();
    const waitFor = async predicate => {
      const deadline = Date.now() + 45000;
      while (!frames.some(predicate) && Date.now() < deadline) {
        if (streamError) throw new Error('Authenticated SSE connection failed');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(frames.some(predicate), 'Expected authenticated SSE frame was not received');
    };
    try {
      await waitFor(frame => frame.type === 'heartbeat' && Number.isFinite(Date.parse(frame.data.timestamp)));
    } catch (error) {
      abort.abort();
      await pump;
      throw error;
    }
    return {
      async verify(title) {
        await waitFor(frame => frame.type === 'event:updated' && frame.data.event.id === eventId && frame.data.event.title === title);
        await bridge({ operation: 'postflight' });
        await writeFile(path.join(runDir, 'evidence', 'ppe-sse.json'), JSON.stringify({ status: 'PASS', event_id: eventId, title, heartbeat: true, update: true }, null, 2));
      },
      async close() {
        abort.abort();
        await pump;
        if (streamError) throw new Error('Authenticated SSE connection failed');
      },
    };
  }

  async function cleanupOwned(page) {
    const current = await freshRun();
    for (const entry of current.owned_events.filter(item => item.cleanup_state === 'pending')) {
      const existing = await request('GET', `/api/events/${entry.event_id}`);
      if (existing.status === 404) {
        await bridge({ operation: 'closed', event_id: entry.event_id });
        continue;
      }
      assert.equal(existing.status, 200);
      assert([entry.initial_title, `${entry.initial_title} edited`].includes(existing.body.title), 'Owned event title changed unexpectedly');
      assert(existing.body.participants.some(item => item.id === entry.organizer_id && item.isOrganizer), 'Recorded organizer no longer owns the event');
      await drainRequests();
      await page.goto(`${run.client_url}/meet/${entry.event_id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.getByRole('button', { name: 'Settings', exact: true }).waitFor();
      const skip = page.getByText('Skip tutorial', { exact: true });
      if (await skip.isVisible()) await skip.click();
      await page.locator('.cat-portal').waitFor({ state: 'detached' });
      const token = await page.evaluate(id => localStorage.getItem(`organizer_token_${id}`), entry.event_id);
      const identity = await request('GET', `/api/events/${entry.event_id}/me`, { token });
      assert.equal(identity.status, 200);
      assert.equal(identity.body.participantId, entry.organizer_id);
      assert.equal(identity.body.isOrganizer, true);
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
      await page.getByPlaceholder('Type DELETE', { exact: true }).fill('DELETE');
      await drainRequests();
      const [removed] = await Promise.all([
        page.waitForResponse(res => res.url() === `${run.backend_url}/api/events/${entry.event_id}` && res.request().method() === 'DELETE'),
        page.getByRole('button', { name: 'Delete Event', exact: true }).click(),
      ]);
      assert.equal(removed.status(), 200);
      assert.equal((await request('GET', `/api/events/${entry.event_id}`)).status, 404);
      await bridge({ operation: 'closed', event_id: entry.event_id });
    }
    await writeFile(path.join(runDir, 'evidence', 'ppe-ui-cleanup.json'), JSON.stringify({ status: 'PASS',
      scope: run.scenario === 'voting-publication' ? 'exact UI-created event, participant and vote rows absent; Venue rows retained' : 'exact UI-created event IDs only' }, null, 2));
  }

  function assertGuard() {
    assert.deepEqual(failures, [], 'A PPE API request was blocked by target checks');
    assert.equal(pendingStreams.size, 0, 'Owned SSE response validation has not completed');
    assert.equal(pendingRequests.size, 0, 'Owned API response validation has not completed');
    assert(cancelledStreams.every(attempt => (validatedStreams.get(attempt.page)?.get(attempt.path) ?? 0) > attempt.requestId),
      'A cancelled owned SSE attempt has no later valid replacement on the same page and event');
  }

  async function drainRequests({ timeoutMs = 120000 } = {}) {
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Owned API response validation did not finish before navigation')), timeoutMs);
    });
    try {
      while (pendingRequests.size) await Promise.race([Promise.all([...pendingRequests]), deadline]);
    } finally { clearTimeout(timer); }
  }

  async function settleRequests(options) {
    await drainRequests(options);
    assertGuard();
  }

  return { bridge, guardContext, saveSession, negativeChecks, watchTitle, cleanupOwned, settleRequests,
    read(route, options) { return request('GET', route, options); },
    async openParticipantStream(eventId, token, signal) {
      assert(['participants', 'voting-publication'].includes(run.scenario));
      const url = `${run.backend_url}/api/events/${eventId}/stream`;
      await bridge({ operation: 'guard', method: 'GET', url });
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, origin: run.client_url },
        redirect: 'error', signal });
      await bridge({ operation: 'postflight' });
      return response;
    },
    assertGuard,
    async evidence() {
      const filename = dependencies.phase === 'cleanup' ? 'ppe-request-guards-cleanup.json' : 'ppe-request-guards.json';
      await writeFile(path.join(runDir, 'evidence', filename), JSON.stringify({ blocked: failures, pending_requests: pendingRequests.size,
        ...(placesGuard ? { streaming_api: {
          policy: 'Owned SSE continues without buffering. Invalid observed headers or redirects fail. A browser-confirmed pre-response cancellation requires a later validated replacement on the same page and event.',
          pending: pendingStreams.size, responses: streamResponses,
          cancelled_attempts: cancelledStreams.map(attempt => ({ request_id: attempt.requestId,
            replacement_request_id: validatedStreams.get(attempt.page)?.get(attempt.path) ?? null,
            replacement_verified: (validatedStreams.get(attempt.page)?.get(attempt.path) ?? 0) > attempt.requestId })),
        } } : {}) }, null, 2));
    },
  };
}
