import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPpeAccountsDriver, safeAccountRequest } from './ppe-accounts-browser.mjs';

const run = { kind: 'where2meet-ppe-run-v1', scenario: 'accounts',
  client_url: 'http://127.0.0.1:4317', backend_url: 'https://ppe.example.test' };

async function subject(runDir = '/unused-account-test') {
  const registrations = [];
  const receipts = [];
  const driver = await createPpeAccountsDriver(runDir, run, async payload => {
    if (payload.operation === 'account-plan') return { account: { name: 'Verification account' }, titles: {} };
    if (payload.operation === 'account-guard') {
      const url = new URL(payload.url);
      assert([run.client_url, run.backend_url].includes(url.origin));
      assert(url.pathname === '/api/auth/session' || url.pathname === '/api/auth/register');
      return { receipt: 'owned-test-request' };
    }
    if (payload.operation === 'account-response') {
      receipts.push(payload);
      return { status: 'recorded' };
    }
    assert.fail('Unexpected controller operation');
  });
  const context = {
    async route(matches, handler) { registrations.push({ matches, handler }); },
    async cookies() { return []; },
  };
  await driver.guardContext(context);
  await driver.guardContext(context);
  assert.equal(registrations.length, 1);
  return { driver, context, receipts,
    async route(url, { method = 'GET', status = 200, redirected = false, data = { user: { id: 'usr_test' } } } = {}) {
      const registered = registrations.find(item => item.matches(new URL(url)));
      if (!registered) return 'not-intercepted';
      let outcome;
      await registered.handler({
        request: () => ({ url: () => url, method: () => method, redirectedFrom: () => redirected ? {} : null,
          postData: () => method === 'POST' ? '{}' : null, postDataJSON: () => ({}), allHeaders: async () => ({}) }),
        async fetch(options) {
          assert.equal(options.maxRedirects, 0);
          return { status: () => status, headers: () => ({ 'content-type': 'application/json', 'set-cookie': `session_token=st_${'a'.repeat(64)}; HttpOnly; Path=/` }), json: async () => data };
        },
        async fulfill({ response }) { outcome = { status: response.status(), body: await response.json() }; },
        async abort(reason) { outcome = reason; },
      });
      return outcome;
    },
  };
}

test('account proxies return actual responses after ownership receipts, while assets bypass API guards', async () => {
  const browser = await subject();
  assert.equal(await browser.route('https://maps.googleapis.com/maps-api-v3/api/js/66/7/map.js'), 'not-intercepted');
  assert.deepEqual(await browser.route(run.client_url + '/api/auth/register', { method: 'POST', status: 201 }),
    { status: 201, body: { user: { id: 'usr_test' } } });
  assert.deepEqual(browser.receipts, [{ operation: 'account-response', receipt: 'owned-test-request', status: 201,
    body: { user: { id: 'usr_test' } }, session_token: 'st_' + 'a'.repeat(64) }]);
  browser.driver.assertGuard();
});

test('redirects and rejected origins abort before fulfilling a browser response', async () => {
  const browser = await subject();
  assert.deepEqual(await browser.route(run.client_url + '/api/auth/session'), { status: 200, body: { user: { id: 'usr_test' } } });
  for (const [url, options] of [
    ['https://production.example.test/api/auth/register', { method: 'POST' }],
    [run.client_url + '/api/auth/register', { method: 'POST', status: 302 }],
    [run.client_url + '/api/auth/session', { redirected: true }],
  ]) assert.equal(await browser.route(url, options), 'blockedbyclient');
  assert.equal(browser.receipts.length, 1);
  assert.throws(() => browser.driver.assertGuard(), /blocked/);
});

test('explicit API requests use the same ownership policy and never follow redirects', async () => {
  const browser = await subject();
  let status = 200;
  const page = { context: () => browser.context, request: {
    async fetch(url, options) {
      assert.equal(url, run.client_url + '/api/auth/session');
      assert.equal(options.maxRedirects, 0);
      assert.equal(options.method, 'GET');
      return { status: () => status, headers: () => ({ 'content-type': 'application/json' }), json: async () => ({ user: { id: 'usr_test' } }) };
    },
  } };
  assert.deepEqual(await (await browser.driver.request(page, 'GET', '/api/auth/session')).json(), { user: { id: 'usr_test' } });
  await assert.rejects(browser.driver.request(page, 'GET', '/api/users/me/identities'), /assert/);
  status = 307;
  await assert.rejects(browser.driver.request(page, 'GET', '/api/auth/session'), /redirects/);
});

test('explicit proxy reads use the stored frontend session without leaking cookies to meeting requests', async () => {
  const session = 'st_' + 'e'.repeat(64);
  const sent = [];
  const guarded = [];
  const driver = await createPpeAccountsDriver('/unused-cookie-test', run, async payload => {
    if (payload.operation === 'account-plan') return { account: {}, titles: {} };
    if (payload.operation === 'account-guard') {
      guarded.push({ url: payload.url, cookie: payload.headers.cookie ?? null });
      return { receipt: 'owned-cookie-request' };
    }
    if (payload.operation === 'account-response') return { status: 'recorded' };
    assert.fail('Unexpected cookie-probe operation');
  });
  const context = { async cookies(url) {
    if (url) return [];
    return [
      { name: 'session_token', value: session, domain: '127.0.0.1', path: '/', secure: true },
      { name: 'session_token', value: 'foreign-host', domain: 'ppe.example.test', path: '/', secure: true },
      { name: 'session_token', value: 'foreign-path', domain: '127.0.0.1', path: '/elsewhere', secure: true },
      { name: 'other_cookie', value: 'unrelated', domain: '127.0.0.1', path: '/', secure: false },
    ];
  } };
  const page = { context: () => context, request: { async fetch(url, options) {
    sent.push({ url, cookie: options.headers.cookie ?? null });
    return { status: () => 200, headers: () => ({ 'content-type': 'application/json' }), json: async () => ({ ok: true }) };
  } } };
  await driver.request(page, 'GET', '/api/auth/session');
  await driver.request(page, 'GET', '/api/events/evt_1234567890123_abcdefghijklmnop');
  const expected = [
    { url: run.client_url + '/api/auth/session', cookie: 'session_token=' + session },
    { url: run.backend_url + '/api/events/evt_1234567890123_abcdefghijklmnop', cookie: null },
  ];
  assert.deepEqual(sent, expected);
  assert.deepEqual(guarded, expected);
});

test('a successful cleanup attempt cannot overwrite the original blocked-request evidence', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ppe-accounts-evidence-'));
  try {
    await mkdir(path.join(directory, 'evidence'));
    const verification = await subject(directory);
    assert.equal(await verification.route(run.client_url + '/api/users/me', { method: 'PATCH' }), 'blockedbyclient');
    await verification.driver.finish();
    const original = await readFile(path.join(directory, 'evidence/ppe-accounts-request-guards.json'), 'utf8');
    assert.equal(JSON.parse(original).blocked.length, 1);
    const cleanup = await subject(directory);
    cleanup.driver.assertGuard();
    await cleanup.driver.finish({ phase: 'cleanup' });
    assert.equal(await readFile(path.join(directory, 'evidence/ppe-accounts-request-guards.json'), 'utf8'), original);
    const cleanupFiles = (await readdir(path.join(directory, 'evidence'))).filter(name => name.startsWith('ppe-accounts-cleanup-request-guards-'));
    assert.equal(cleanupFiles.length, 1);
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'evidence', cleanupFiles[0]), 'utf8')).blocked, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('blocked request evidence excludes tokens, encoded account credentials, and unknown hosts', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ppe-accounts-redaction-'));
  try {
    await mkdir(path.join(directory, 'evidence'));
    const browser = await subject(directory);
    const sentinels = ['st_' + 'b'.repeat(64), 'pt_' + 'c'.repeat(64), 'ot_' + 'd'.repeat(64),
      'Verify-synthetic-password-!@', 'verify-accounts-private@example.test', 'AIzaSyntheticVerificationKey1234567890'];
    for (const secret of sentinels) {
      assert.equal(await browser.route(`${run.client_url}/api/users/me/${encodeURIComponent(secret)}`), 'blockedbyclient');
    }
    assert.equal(await browser.route(`https://${sentinels[0]}.example.test/api/auth/session`), 'blockedbyclient');
    await browser.driver.finish();
    const stored = await readFile(path.join(directory, 'evidence/ppe-accounts-request-guards.json'), 'utf8');
    for (const secret of sentinels) {
      assert.equal(stored.includes(secret) || stored.includes(encodeURIComponent(secret)), false, 'Shareable guard evidence leaked a synthetic secret sentinel');
    }
    const blocked = JSON.parse(stored).blocked;
    assert.equal(blocked.length, 7);
    assert.deepEqual(blocked[0], { method: 'GET', origin: run.client_url, path: '/api/[unrecognized]' });
    assert.deepEqual(blocked.at(-1), { method: 'GET', origin: '[outside-target]', path: '/api/auth/session' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('shared request metadata keeps useful route names without query values or dynamic identifiers', () => {
  const eventId = 'evt_1760000000000_0123456789abcdef';
  const participantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  assert.deepEqual(safeAccountRequest('GET', run.client_url + '/api/auth/session?token=private#credential', run),
    { method: 'GET', origin: run.client_url, path: '/api/auth/session' });
  assert.deepEqual(safeAccountRequest('POST', new URL(run.client_url + '/api/users/me/events/claim'), run),
    { method: 'POST', origin: run.client_url, path: '/api/users/me/events/claim' });
  assert.deepEqual(safeAccountRequest('GET', `${run.backend_url}/api/events/${eventId}/stream`, run),
    { method: 'GET', origin: run.backend_url, path: '/api/events/:eventId/stream' });
  assert.deepEqual(safeAccountRequest('PATCH', `${run.backend_url}/api/events/${eventId}/participants/${participantId}`, run),
    { method: 'PATCH', origin: run.backend_url, path: '/api/events/:eventId/participants/:participantId' });
  assert.deepEqual(safeAccountRequest('st_' + 'f'.repeat(64), 'https://private.example.test/api/unknown', run),
    { method: '[unrecognized]', origin: '[outside-target]', path: '/api/[unrecognized]' });
});
