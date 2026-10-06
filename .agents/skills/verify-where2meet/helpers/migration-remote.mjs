import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { requireProof } from './migration-fixture.mjs';
import { validatePhotoRedirect } from './ppe-browser.mjs';

export const remoteKind = 'where2meet-remote-import-run-v1';
export function runtimeEnvironment(environment = process.env) {
  return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS']
    .filter(key => typeof environment[key] === 'string').map(key => [key, environment[key]]));
}
export function candidate(run, directory, environment = process.env) {
  requireProof(run.run_dir === directory, 'Candidate ownership mismatch');
  const remote = run.kind === remoteKind;
  requireProof(remote || run.kind === 'where2meet-verification-v1', 'Candidate kind is unsupported');
  requireProof(run.status === 'ready' && run.schema_mode === 'migrations' && run.backend_mode === (remote ? 'railway-ppe' : 'compiled'), 'Candidate must be a ready migrated run');
  requireProof(run.source_status.trim() === '' && run.frontend_status.trim() === '', 'Candidate and frontend sources must be clean');
  const databaseUrl = remote ? environment.DATABASE_URL : run.database_url;
  requireProof(typeof databaseUrl === 'string', 'Candidate database connection unavailable');
  const database = new URL(databaseUrl);
  requireProof(['postgres:', 'postgresql:'].includes(database.protocol) && database.hostname === '127.0.0.1' &&
    Number(database.port) === (remote ? run.tunnel?.port : run.ports.postgres) &&
    database.pathname === (remote ? '/where2meet_import' : '/where2meet_verify'), 'Candidate database is not its owned loopback target');
  if (remote) requireProof(!Object.hasOwn(run, 'database_url') && run.source_copy === path.join(directory, 'runtime/app') &&
    run.ports.frontend === 4317 && run.client_url === 'http://127.0.0.1:4317' &&
    run.backend_url === run.target?.railway?.backend_origin && new URL(run.backend_url).protocol === 'https:', 'Remote candidate runtime boundary changed');
  return { remote, databaseUrl };
}

export function proofRequestAllowed(bundle, route, { method = 'GET', body, token, cookie, proxy = false } = {},
  sessionCookies = new Set([bundle.credentials.account.validCookie, bundle.credentials.account.expiredCookie])) {
  if (route.includes('?') || route.includes('#')) return false;
  if (!proxy) {
    if (method !== 'GET' || body || cookie) return false;
    return bundle.rows.events.some(event => route === `/api/events/${event.id}/me` ?
      bundle.credentials.participants.some(person => person.token === token) :
      [ `/api/events/${event.id}`, `/api/events/${event.id}/votes` ].includes(route) && !token);
  }
  if (token) return false;
  if (cookie && !sessionCookies.has(cookie)) return false;
  if (method === 'GET' && !body && ['/api/auth/session', '/api/users/me/events'].includes(route)) return Boolean(cookie);
  if (method !== 'POST') return false;
  if (route === '/api/auth/logout') return Boolean(cookie) && !body;
  if (route === '/api/auth/login') return !cookie && isDeepStrictEqual(body,
    { email: bundle.credentials.account.email, password: bundle.credentials.account.password });
  return route === '/api/users/me/events/claim' && Boolean(cookie) && bundle.rows.userEvents.some(link =>
    isDeepStrictEqual(body, { eventId: link.eventId, participantToken: bundle.credentials.participants.find(person => person.participantId === link.participantId)?.token }));
}

export function browserRequestAllowed(run, bundle, method, rawUrl) {
  const url = new URL(rawUrl);
  if (url.search || url.hash || url.username || url.password || method !== 'GET') return false;
  if (url.origin === run.client_url) return url.pathname === '/api/auth/session';
  if (url.origin !== run.backend_url) return false;
  return bundle.rows.events.some(event => [`/api/events/${event.id}`, `/api/events/${event.id}/votes`].includes(url.pathname)) ||
    [`/api/venues/${encodeURIComponent(bundle.manifest.sharedVenueId)}`, `/api/venues/${encodeURIComponent(bundle.manifest.sharedVenueId)}/photo`].includes(url.pathname);
}

export function validateBrowserResponse(run, bundle, rawUrl, status, headers) {
  if (status < 300 || status >= 400) return;
  const url = new URL(rawUrl);
  requireProof(url.origin === run.backend_url && url.pathname === `/api/venues/${encodeURIComponent(bundle.manifest.sharedVenueId)}/photo`,
    'Only the owned venue photo may redirect');
  validatePhotoRedirect(status, headers);
}

export function refreshWindow(startedAt, endedAt, observations) {
  requireProof(Number.isSafeInteger(startedAt) && Number.isSafeInteger(endedAt) && startedAt <= endedAt && observations.length === 2,
    'Browser clock bounds are invalid');
  for (const sample of observations) requireProof(['started', 'ended', 'server'].every(key => Number.isSafeInteger(sample[key])) &&
    sample.started <= sample.ended && sample.ended - sample.started <= 10000, 'Backend clock observation invalid or too imprecise');
  requireProof(observations[0].ended <= startedAt && observations[1].started >= endedAt, 'Clock observations do not bracket browser');
  const lower = Math.max(...observations.map(sample => sample.server - sample.ended));
  const upper = Math.min(...observations.map(sample => sample.server - sample.started));
  requireProof(lower <= upper, 'Backend clock offset changed between observations');
  return { startedAt: startedAt + lower, endedAt: endedAt + upper, offset: { lower, upper }, observations };
}
