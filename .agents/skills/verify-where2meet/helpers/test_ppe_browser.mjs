import assert from 'node:assert/strict';
import test from 'node:test';
import { createPpeDriver } from './ppe-browser.mjs';

async function guardedBrowser() {
  const registrations = [];
  const run = { scenario: 'participants', client_url: 'http://127.0.0.1:4317', backend_url: 'https://ppe.example.test' };
  const driver = await createPpeDriver('/unused-ppe-test-run', run, {
    async route(match, handler) {
      const glob = typeof match === 'string'
        ? new RegExp('^' + match.split('**').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
        : null;
      registrations.push({ matches: glob ? url => glob.test(url.href) : match, handler });
    },
  });
  assert.equal(registrations.length, 1);
  return {
    driver,
    async request(url, { method = 'GET', redirected = false } = {}) {
      const registration = registrations.find(({ matches }) => matches(new URL(url)));
      if (!registration) return 'not-intercepted';
      let outcome;
      await registration.handler({
        request: () => ({ url: () => url, method: () => method, redirectedFrom: () => redirected ? {} : null }),
        async continue() { outcome = 'continued'; },
        async abort(reason) { outcome = reason; },
        async fetch() { assert.fail('Routing regression tests must not contact Railway'); },
      });
      return outcome;
    },
  };
}

test('Google modules from the failed PPE run bypass the application API guard', async () => {
  const browser = await guardedBrowser();
  for (const module of ['map', 'poly', 'marker']) {
    assert.equal(await browser.request(`https://maps.googleapis.com/maps-api-v3/api/js/66/7/${module}.js`), 'not-intercepted');
  }
  assert.equal(await browser.request('https://maps.googleapis.com/maps/api/js?libraries=places'), 'not-intercepted');
  assert.equal(await browser.request('https://cdn.example.test/assets/api/map.js'), 'not-intercepted');
  browser.driver.assertGuard();
});

test('root API requests still pass through origin and fixed session checks', async () => {
  const browser = await guardedBrowser();
  assert.equal(await browser.request('https://ppe.example.test/api'), 'continued');
  assert.equal(await browser.request('https://ppe.example.test/api/events/evt_test'), 'continued');
  assert.equal(await browser.request('https://ppe.example.test/api/events', { method: 'OPTIONS' }), 'continued');
  assert.equal(await browser.request('http://127.0.0.1:4317/api/auth/session'), 'continued');
  browser.driver.assertGuard();
  for (const url of [
    'https://foreign.example.test/api',
    'https://foreign.example.test/api/events',
    'https://maps.googleapis.com/api/events',
    'http://127.0.0.1:4317/api/events',
  ]) {
    assert.equal(await browser.request(url), 'blockedbyclient');
  }
  assert.equal(await browser.request('https://foreign.example.test/api/events', { method: 'POST' }), 'blockedbyclient');
  assert.equal(await browser.request('http://127.0.0.1:4317/api/auth/session', { method: 'POST' }), 'blockedbyclient');
  assert.throws(() => browser.driver.assertGuard(), /blocked by target checks/);
});

test('redirected application API requests fail before continuing', async () => {
  const browser = await guardedBrowser();
  assert.equal(await browser.request('https://ppe.example.test/api/events', { redirected: true }), 'blockedbyclient');
  assert.equal(await browser.request('http://127.0.0.1:4317/api/auth/session', { redirected: true }), 'blockedbyclient');
  assert.throws(() => browser.driver.assertGuard(), /blocked by target checks/);
});
