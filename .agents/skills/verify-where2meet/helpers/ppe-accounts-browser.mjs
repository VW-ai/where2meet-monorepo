import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ppeBridge } from './ppe-browser.mjs';

export function safeAccountRequest(method, value, run) {
  const url = value instanceof URL ? value : new URL(value);
  const accountPaths = new Set(['/api/auth/session', '/api/auth/register', '/api/auth/login', '/api/auth/logout',
    '/api/users/me', '/api/users/me/events', '/api/users/me/events/claim']);
  let pathname = '/api/[unrecognized]';
  if (accountPaths.has(url.pathname) || url.pathname === '/api/events') pathname = url.pathname;
  const event = /^\/api\/events\/evt_[0-9]{13,15}_[A-Za-z0-9]{16}(\/(?:me|votes|stream))?$/.exec(url.pathname);
  if (event) pathname = '/api/events/:eventId' + (event[1] ?? '');
  if (/^\/api\/events\/evt_[0-9]{13,15}_[A-Za-z0-9]{16}\/participants\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(url.pathname)) {
    pathname = '/api/events/:eventId/participants/:participantId';
  }
  return {
    method: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method) ? method : '[unrecognized]',
    origin: [run.client_url, run.backend_url].includes(url.origin) ? url.origin : '[outside-target]',
    path: pathname,
  };
}

export async function createPpeAccountsDriver(runDir, run, bridge = payload => ppeBridge(runDir, payload)) {
  assert.equal(run.kind, 'where2meet-ppe-run-v1');
  assert.equal(run.scenario, 'accounts');
  const { account, titles } = await bridge({ operation: 'account-plan' });
  const failures = [];
  const guarded = new WeakSet();
  const apiPath = url => url.pathname === '/api' || url.pathname.startsWith('/api/');

  async function recordResponse(receipt, response) {
    assert(response.status() < 300 || response.status() >= 400, 'Account API redirects are not accepted');
    const contentType = response.headers()['content-type'] ?? '';
    const body = contentType.includes('application/json') ? await response.json() : null;
    const cookie = response.headers()['set-cookie'] ?? '';
    const session = /(?:^|[,\s])session_token=(st_[0-9a-f]{64})(?:;|$)/.exec(cookie)?.[1];
    await bridge({ operation: 'account-response', receipt, status: response.status(), body,
      ...(session ? { session_token: session } : {}) });
  }

  async function guardContext(context) {
    if (guarded.has(context)) return;
    guarded.add(context);
    await context.route(apiPath, async route => {
      const request = route.request();
      const url = new URL(request.url());
      try {
        assert.equal(request.redirectedFrom(), null, 'Account API redirects are not accepted');
        const body = request.postData() ? request.postDataJSON() : null;
        const { receipt } = await bridge({ operation: 'account-guard', method: request.method(), url: request.url(),
          body, headers: await request.allHeaders(), purpose: 'ui' });
        if (request.method() === 'GET' && url.pathname.endsWith('/stream')) {
          await bridge({ operation: 'account-stream-open', receipt });
          return await route.continue();
        }
        const response = await route.fetch({ maxRedirects: 0, timeout: 45000 });
        await recordResponse(receipt, response);
        await route.fulfill({ response });
      } catch {
        failures.push(safeAccountRequest(request.method(), url, run));
        await route.abort('blockedbyclient');
      }
    });
  }

  async function request(page, method, requestPath, { body, headers = {}, token, purpose = 'read' } = {}) {
    assert(requestPath.startsWith('/api/'), 'Use a fixed application API path');
    const origin = requestPath.startsWith('/api/auth/') || requestPath.startsWith('/api/users/')
      ? run.client_url : run.backend_url;
    const url = origin + requestPath;
    const cookies = await page.context().cookies(url);
    const requestHeaders = { ...headers, ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookies.length ? { cookie: cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ') } : {}) };
    const { receipt } = await bridge({ operation: 'account-guard', method, url, body: body ?? null,
      headers: requestHeaders, purpose });
    const response = await page.request.fetch(url, { method, headers: requestHeaders, ...(body ? { data: body } : {}),
      maxRedirects: 0, timeout: 45000 });
    await recordResponse(receipt, response);
    return response;
  }

  async function cleanupOwned(page) {
    await guardContext(page.context());
    let current = await bridge({ operation: 'account-cleanup-plan' });
    if (current.account_state === 'registration-pending') {
      const recovery = await request(page, 'POST', '/api/auth/login', {
        body: { email: account.email, password: account.password }, purpose: 'cleanup',
      });
      assert.equal(recovery.status(), 200, 'Pending registration could not be recovered');
      current = await bridge({ operation: 'account-cleanup-plan' });
    }
    await page.context().clearCookies();
    const credentials = current.events.filter(entry => entry.state === 'created');
    await page.addInitScript(entries => {
      for (const entry of entries) {
        localStorage.setItem(`organizer_token_${entry.event_id}`, entry.token);
        localStorage.setItem(`organizer_participant_id_${entry.event_id}`, entry.organizer_id);
      }
    }, credentials);
    for (const entry of credentials) {
      const existing = await request(page, 'GET', `/api/events/${entry.event_id}`);
      if (existing.status() === 404) {
        await bridge({ operation: 'account-event-closed', event_id: entry.event_id });
        continue;
      }
      assert.equal(existing.status(), 200);
      const event = await existing.json();
      assert.equal(event.title, entry.title);
      assert(event.participants.some(participant => participant.id === entry.organizer_id && participant.isOrganizer));
      const identity = await request(page, 'GET', `/api/events/${entry.event_id}/me`, { token: entry.token });
      assert.equal(identity.status(), 200);
      assert.equal((await identity.json()).participantId, entry.organizer_id);
      await page.goto(`${run.client_url}/meet/${entry.event_id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      const skip = page.getByText('Skip tutorial', { exact: true });
      if (await skip.isVisible()) await skip.click();
      await page.locator('.cat-portal').waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('button', { name: 'Delete Event', exact: true }).click();
      await page.getByPlaceholder('Type DELETE', { exact: true }).fill('DELETE');
      const [deleted] = await Promise.all([
        page.waitForResponse(response => response.url() === `${run.backend_url}/api/events/${entry.event_id}` && response.request().method() === 'DELETE'),
        page.getByRole('button', { name: 'Delete Event', exact: true }).click(),
      ]);
      assert.equal(deleted.status(), 200);
      assert.equal((await request(page, 'GET', `/api/events/${entry.event_id}`)).status(), 404);
      await bridge({ operation: 'account-event-closed', event_id: entry.event_id });
    }
    await writeFile(path.join(runDir, 'evidence', 'accounts-ui-cleanup.json'), JSON.stringify({ status: 'PASS',
      scope: 'exact UI-created organizer events', event_ids: credentials.map(entry => entry.event_id) }, null, 2));
  }

  return {
    account, titles, guardContext, request, cleanupOwned,
    async saveSession(context) {
      const snapshot = path.join(runDir, 'runtime', 'accounts-browser-state.json');
      await context.storageState({ path: snapshot });
      await chmod(snapshot, 0o600);
    },
    storedAccount({ eventId, userId = null, expectedName = account.name }) {
      return bridge({ operation: 'stored-account', event_id: eventId, user_id: userId, expected_name: expectedName });
    },
    assertGuard() { assert.deepEqual(failures, [], 'A PPE account API request was blocked'); },
    async finish({ phase = 'verification' } = {}) {
      assert(['verification', 'cleanup'].includes(phase), 'Unknown account evidence phase');
      const filename = phase === 'cleanup'
        ? `ppe-accounts-cleanup-request-guards-${randomUUID()}.json`
        : 'ppe-accounts-request-guards.json';
      await writeFile(path.join(runDir, 'evidence', filename), JSON.stringify({ phase, blocked: failures }, null, 2), { flag: 'wx', mode: 0o600 });
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv[3], '--cleanup');
  const runDir = path.resolve(process.argv[2]);
  const run = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));
  const require = createRequire(path.join(runDir, 'runtime/driver/package.json'));
  const { chromium } = require('playwright');
  const driver = await createPpeAccountsDriver(runDir, run);
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    await driver.cleanupOwned(page);
    driver.assertGuard();
  } catch {
    process.exitCode = 1;
  } finally {
    await driver.finish({ phase: 'cleanup' });
    await browser?.close();
  }
}
