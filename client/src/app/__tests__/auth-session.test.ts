import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../api/auth/session/route';

const user = { id: 'usr_1', email: 'ada@example.com', name: 'Ada' };

function api(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const check = (cookie?: string) =>
  GET(
    new NextRequest(
      'https://www.where2meet.org/api/auth/session',
      cookie ? { headers: { cookie } } : undefined
    )
  );

describe('GET /api/auth/session', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers a visitor without a session cookie with no user, without calling the API', async () => {
    const fetchMock = api(401, { error: { code: 'UNAUTHORIZED', message: 'Session required' } });

    const response = await check();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a session the API rejects with no user', async () => {
    api(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid session' } });

    const response = await check('session_token=stale');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user: null });
  });

  it('forwards the session cookie and returns the signed-in user', async () => {
    const fetchMock = api(200, { user });

    const response = await check('session_token=valid');

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Cookie).toBe('session_token=valid');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user });
  });
});
