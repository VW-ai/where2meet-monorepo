import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/token-claimer', () => ({
  scanLocalStorageForTokens: vi.fn(() => [
    { eventId: 'evt_1', tokenType: 'participant', token: 'pt_abc' },
  ]),
  claimAllTokens: vi.fn(() =>
    Promise.resolve({ success: true, claimed: 1, failed: 0, errors: [] })
  ),
}));

import { useAuthStore } from '../auth-store';
import { claimAllTokens } from '@/lib/utils/token-claimer';

const user = { id: 'usr_1', email: 'ada@example.com', name: 'Ada' };

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useAuthStore.checkSession', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('signs in the user the session check returns', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false, isAuthInitialized: false });
    stubFetch(200, { user });

    await useAuthStore.getState().checkSession();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAuthInitialized).toBe(true);
  });

  it('signs out a visitor the session check answers with no user', async () => {
    useAuthStore.setState({ user, isAuthenticated: true, isAuthInitialized: false });
    stubFetch(200, { user: null });

    await useAuthStore.getState().checkSession();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isAuthInitialized).toBe(true);
  });
});

describe('useAuthStore.signInWithGoogle', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
    useAuthStore.setState({ user: null, isAuthenticated: false, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(claimAllTokens).mockClear();
  });

  it('posts the credential, signs the user in, and claims local event tokens', async () => {
    const fetchMock = stubFetch(200, { user });

    await useAuthStore.getState().signInWithGoogle('google-id-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/google');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"credential":"google-id-token"}');

    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(claimAllTokens).toHaveBeenCalledWith([
      { eventId: 'evt_1', tokenType: 'participant', token: 'pt_abc' },
    ]);
  });

  it('puts the server message in error when Google sign-in is disabled', async () => {
    stubFetch(503, {
      error: { code: 'GOOGLE_SIGNIN_DISABLED', message: 'Google sign-in is not configured' },
    });

    await expect(useAuthStore.getState().signInWithGoogle('google-id-token')).rejects.toThrow(
      'Google sign-in is not configured'
    );

    const state = useAuthStore.getState();
    expect(state.error).toBe('Google sign-in is not configured');
    expect(state.isAuthenticated).toBe(false);
    expect(claimAllTokens).not.toHaveBeenCalled();
  });
});
