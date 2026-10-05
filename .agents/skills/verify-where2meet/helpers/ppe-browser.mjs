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

export async function createPpeDriver(runDir, run, context) {
  const checks = [];
  const failures = [];
  const snapshotPath = path.join(runDir, 'runtime', 'browser-state.json');
  const bridge = payload => ppeBridge(runDir, payload);
  const freshRun = async () => JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
  const saveSession = async () => {
    await context.storageState({ path: snapshotPath });
    await chmod(snapshotPath, 0o600);
  };

  async function guardContext(activeContext) {
    await activeContext.route('**/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      try {
        assert.equal(request.redirectedFrom(), null, 'API redirects are not accepted');
        if (run.scenario === 'participants' && url.origin === 'https://maps.googleapis.com' &&
            url.pathname.startsWith('/maps/api/') && request.method() === 'GET') {
          return await route.continue();
        }
        if (url.origin === run.client_url) {
          assert.equal(url.pathname, '/api/auth/session', 'Only the fixed Next session proxy is permitted');
          assert.equal(request.method(), 'GET');
          return await route.continue();
        }
        assert.equal(url.origin, run.backend_url, 'API destination differs from confirmed PPE');
        if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return await route.continue();
        const body = request.postDataJSON();
        await bridge({ operation: 'guard', method: request.method(), url: request.url(), body });
        const response = await route.fetch({ maxRedirects: 0, timeout: 45000 });
        assert(response.status() < 300 || response.status() >= 400, 'Mutation returned a redirect');
        if (request.method() === 'POST' && url.pathname === '/api/events' && response.status() === 201) {
          const created = await response.json();
          await bridge({ operation: 'record', event_id: created.id, organizer_id: created.organizerParticipantId, title: created.title });
        }
        const participantCollection = url.pathname.match(/^\/api\/events\/(evt_[A-Za-z0-9_]+)\/participants$/);
        if (request.method() === 'POST' && participantCollection && response.status() === 201) {
          assert.equal(run.scenario, 'participants');
          const participant = await response.json();
          await bridge({ operation: 'record-participant', event_id: participantCollection[1], participant_id: participant.id });
        }
        await bridge({ operation: 'postflight' });
        await route.fulfill({ response });
      } catch {
        failures.push({ method: request.method(), origin: url.origin, path: url.pathname });
        await route.abort('blockedbyclient');
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
      const [removed] = await Promise.all([
        page.waitForResponse(res => res.url() === `${run.backend_url}/api/events/${entry.event_id}` && res.request().method() === 'DELETE'),
        page.getByRole('button', { name: 'Delete Event', exact: true }).click(),
      ]);
      assert.equal(removed.status(), 200);
      assert.equal((await request('GET', `/api/events/${entry.event_id}`)).status, 404);
      await bridge({ operation: 'closed', event_id: entry.event_id });
    }
    await writeFile(path.join(runDir, 'evidence', 'ppe-ui-cleanup.json'), JSON.stringify({ status: 'PASS', scope: 'exact UI-created event IDs only' }, null, 2));
  }

  return { bridge, guardContext, saveSession, negativeChecks, watchTitle, cleanupOwned,
    read(route, options) { return request('GET', route, options); },
    async openParticipantStream(eventId, token, signal) {
      assert.equal(run.scenario, 'participants');
      const url = `${run.backend_url}/api/events/${eventId}/stream`;
      await bridge({ operation: 'guard', method: 'GET', url });
      const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, origin: run.client_url },
        redirect: 'error', signal });
      await bridge({ operation: 'postflight' });
      return response;
    },
    assertGuard() { assert.deepEqual(failures, [], 'A PPE API request was blocked by target checks'); },
    async evidence() {
      await writeFile(path.join(runDir, 'evidence', 'ppe-request-guards.json'), JSON.stringify({ blocked: failures }, null, 2));
    },
  };
}
