import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scanLocalStorageForTokens, claimAllTokens, reconcileClaims } from '../token-claimer';
import { useAuthStore } from '@/features/auth/model/auth-store';
import type { User, UserEventResponse } from '@/features/auth/types';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventCard } from '@/features/dashboard/ui/event-card';

const storage = new Map<string, string>();
const token = `pt_${'a'.repeat(64)}`;
const guestToken = `pt_${'b'.repeat(64)}`;
const user = (id: string, name = id): User => ({
  id,
  name,
  email: `${id}@example.test`,
  avatarUrl: null,
  emailVerified: false,
  defaultAddress: null,
  defaultPlaceId: null,
  defaultFuzzyLocation: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    get length() {
      return storage.size;
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  useAuthStore.getState().setUser(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('discovers modern organizer tokens and prefers one organizer slot per meeting', () => {
  storage.set('participant_token_evt_shared', guestToken);
  storage.set('organizer_token_evt_shared', token);
  storage.set('participant_token_evt_guest', guestToken);
  storage.set('organizer_token_evt_old', `ot_${'a'.repeat(64)}`);
  storage.set('participant_token_evt_bad', `pt_${'z'.repeat(64)}`);
  expect(scanLocalStorageForTokens()).toEqual([
    { eventId: 'evt_shared', tokenType: 'organizer', token },
    { eventId: 'evt_guest', tokenType: 'participant', token: guestToken },
  ]);
});

it('retains the browser credential and participant identity after a successful claim', async () => {
  storage.set('participant_token_evt_guest', guestToken);
  storage.set('participant_id_evt_guest', 'guest-id');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => json({ success: true }))
  );
  const result = await claimAllTokens(
    scanLocalStorageForTokens(),
    useAuthStore.getState().captureAccount()
  );
  expect(result.claimed).toBe(1);
  expect(storage.get('participant_token_evt_guest')).toBe(guestToken);
  expect(storage.get('participant_id_evt_guest')).toBe('guest-id');
});

it('ignores a delayed session response after a different account signs in', async () => {
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  const checking = useAuthStore.getState().checkSession();
  useAuthStore.getState().setUser(user('B'));
  pending.resolve(json({ user: user('A') }));
  await checking;
  expect(useAuthStore.getState().user?.id).toBe('B');
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
});

it('keeps an anonymous creation scope valid when the initial session check returns 401', async () => {
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  const checking = useAuthStore.getState().checkSession();
  const creation = useAuthStore.getState().captureAccount();
  pending.resolve(
    new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }), {
      status: 401,
    })
  );
  await checking;
  expect(creation.isCurrent()).toBe(true);
  expect(creation.signal.aborted).toBe(false);
  expect(useAuthStore.getState().isAuthInitialized).toBe(true);
});

it('ignores a delayed profile result even when account A returns after B', async () => {
  useAuthStore.getState().setUser(user('A', 'Original A'));
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  const updating = useAuthStore.getState().updateProfile({ name: 'Stale A' });
  useAuthStore.getState().setUser(user('B'));
  useAuthStore.getState().setUser(user('A', 'Current A'));
  pending.resolve(json(user('A', 'Stale A')));
  await updating;
  expect(useAuthStore.getState().user?.name).toBe('Current A');
});

it('preserves the session and credentials after failed logout, then permits a successful retry', async () => {
  useAuthStore.getState().setUser(user('A'));
  storage.set('organizer_token_evt_owned', token);
  const profileScope = useAuthStore.getState().captureAccount();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Synthetic logout failure' } }), {
          status: 500,
        })
      )
      .mockResolvedValueOnce(json({ success: true }))
  );
  await expect(useAuthStore.getState().logout()).rejects.toThrow('Synthetic logout failure');
  expect(profileScope.signal.aborted).toBe(true);
  expect(useAuthStore.getState().user?.id).toBe('A');
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(useAuthStore.getState().error).toBe('Failed to sign out. Please try again.');
  expect(storage.get('organizer_token_evt_owned')).toBe(token);
  await useAuthStore.getState().logout();
  expect(useAuthStore.getState().user).toBeNull();
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(useAuthStore.getState().error).toBeNull();
  expect(storage.get('organizer_token_evt_owned')).toBe(token);
});

it('does not report an old logout failure against a newer account', async () => {
  useAuthStore.getState().setUser(user('A'));
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  const loggingOut = useAuthStore.getState().logout();
  useAuthStore.getState().setUser(user('B'));
  pending.resolve(
    new Response(JSON.stringify({ error: { message: 'Old logout failed' } }), {
      status: 500,
    })
  );
  await expect(loggingOut).rejects.toThrow();
  expect(useAuthStore.getState().user?.id).toBe('B');
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(useAuthStore.getState().error).toBeNull();
});

it('uses server memberships including detached links and refreshes after the remaining claim', async () => {
  storage.set('organizer_token_evt_linked', token);
  storage.set('organizer_participant_id_evt_linked', 'original-id');
  storage.set('participant_token_evt_pending', guestToken);
  const linked = {
    id: 'link-1',
    participantId: null,
    role: 'organizer',
    event: { id: 'evt_linked' },
  };
  const claimed = {
    id: 'link-2',
    participantId: 'guest-id',
    role: 'participant',
    event: { id: 'evt_pending' },
  };
  const claims: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url, options) => {
      if (url === '/api/users/me/events')
        return json({ events: claims.length ? [linked, claimed] : [linked] });
      claims.push(JSON.parse(options.body));
      return json({ success: true });
    })
  );
  useAuthStore.getState().setUser(user('A'));
  const result = await reconcileClaims(useAuthStore.getState().captureAccount(), true);
  expect(result.events).toEqual([linked, claimed]);
  expect(result.pending).toEqual([]);
  expect(claims).toEqual([{ eventId: 'evt_pending', participantToken: guestToken }]);
  expect(storage.get('organizer_token_evt_linked')).toBe(token);
  expect(storage.get('organizer_participant_id_evt_linked')).toBe('original-id');
});

it('keeps a rejected claim available to retry and lists it after a later successful claim', async () => {
  storage.set('organizer_token_evt_pending', token);
  let succeeds = false;
  let linked = false;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url) => {
      if (url === '/api/users/me/events')
        return json({ events: linked ? [{ event: { id: 'evt_pending' } }] : [] });
      if (!succeeds)
        return new Response(
          JSON.stringify({ error: { code: 'CONFLICT', message: 'Claim conflict' } }),
          { status: 409 }
        );
      linked = true;
      return json({ success: true });
    })
  );
  useAuthStore.getState().setUser(user('A'));
  const failed = await reconcileClaims(useAuthStore.getState().captureAccount(), true);
  expect(failed.pending).toEqual([{ eventId: 'evt_pending', tokenType: 'organizer', token }]);
  expect(failed.failures).toEqual([{ eventId: 'evt_pending', error: 'Claim conflict' }]);
  succeeds = true;
  const result = await reconcileClaims(useAuthStore.getState().captureAccount(), true);
  expect(result.events).toEqual([{ event: { id: 'evt_pending' } }]);
  expect(storage.get('organizer_token_evt_pending')).toBe(token);
});

it('does not submit old pending credentials after an A to B to A transition', async () => {
  storage.set('organizer_token_evt_pending', token);
  useAuthStore.getState().setUser(user('A'));
  const pending = deferred<Response>();
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url) => {
      requests.push(url);
      return pending.promise;
    })
  );
  const result = reconcileClaims(useAuthStore.getState().captureAccount(), true).catch(
    (error) => error.name
  );
  useAuthStore.getState().setUser(user('B'));
  useAuthStore.getState().setUser(user('A', 'New A'));
  pending.resolve(json({ events: [] }));
  expect(await result).toBe('AbortError');
  expect(requests).toEqual(['/api/users/me/events']);
  expect(useAuthStore.getState().user?.name).toBe('New A');
});

it('finishes successful login after the total claim deadline and retains retry credentials', async () => {
  vi.useFakeTimers();
  storage.set('organizer_token_evt_pending', token);
  const pending = deferred<Response>();
  let claimSignal: AbortSignal | undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url, options) => {
      if (url === '/api/auth/login') return Promise.resolve(json({ user: user('A') }));
      claimSignal = options.signal;
      return pending.promise;
    })
  );
  const login = useAuthStore.getState().login('A@example.test', 'synthetic-password');
  await vi.advanceTimersByTimeAsync(10_000);
  await login;
  expect(useAuthStore.getState()).toMatchObject({
    user: { id: 'A' },
    isAuthenticated: true,
    isLoading: false,
  });
  expect(claimSignal?.aborted).toBe(true);
  expect(storage.get('organizer_token_evt_pending')).toBe(token);
  pending.resolve(json({ events: [] }));
});

it('does not let delayed login completion replace a newer account', async () => {
  const pending = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise));
  const login = useAuthStore
    .getState()
    .login('A@example.test', 'synthetic-password')
    .catch((error) => error.name);
  useAuthStore.getState().setUser(user('B'));
  pending.resolve(json({ user: user('A') }));
  expect(await login).toBe('AbortError');
  expect(useAuthStore.getState()).toMatchObject({
    user: { id: 'B' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
});

it('refuses a stale creation claim before dispatch and accepts the current account scope', async () => {
  useAuthStore.getState().setUser(user('A'));
  const creationScope = useAuthStore.getState().captureAccount();
  useAuthStore.getState().setUser(user('B'));
  const sent: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url, options) => {
      sent.push(JSON.parse(options.body));
      return json({ success: true });
    })
  );
  const candidate = { eventId: 'evt_created', tokenType: 'organizer' as const, token };
  await expect(claimAllTokens([candidate], creationScope)).rejects.toMatchObject({
    name: 'AbortError',
  });
  const current = await claimAllTokens([candidate], useAuthStore.getState().captureAccount());
  expect(current.claimed).toBe(1);
  expect(sent).toEqual([{ eventId: 'evt_created', participantToken: token }]);
});

it('renders dashboard summaries using publishedAt without requiring a full meeting payload', () => {
  const event: UserEventResponse['event'] = {
    id: 'evt_summary',
    title: 'Summary meeting',
    meetingTime: null,
    publishedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    participantCount: 2,
    participants: [],
  };
  const draft = renderToStaticMarkup(createElement(EventCard, { event, role: 'organizer' }));
  expect(draft).toContain('Summary meeting');
  expect(draft).toContain('2 participants');
  expect(draft).not.toContain('Published');
  const published = renderToStaticMarkup(
    createElement(EventCard, {
      event: { ...event, publishedAt: '2026-01-02T00:00:00.000Z' },
      role: 'organizer',
    })
  );
  expect(published).toContain('Published');
});
