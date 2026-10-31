import { afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../amap-service/[...path]/route';

const call = (path: string[], query = '') =>
  GET(new NextRequest(`https://www.where2meet.org/amap-service/${path.join('/')}${query}`), {
    params: Promise.resolve({ path }),
  });

describe('AMap security proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('refuses requests until the security code is configured', async () => {
    vi.stubEnv('AMAP_JS_SECURITY_CODE', '');
    const response = await call(['v3', 'ip']);
    expect(response.status).toBe(503);
  });

  it('adds the security code and forwards to the REST API', async () => {
    vi.stubEnv('AMAP_JS_SECURITY_CODE', 'secret');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{"status":"1"}', { headers: { 'content-type': 'application/json' } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await call(['v3', 'ip'], '?key=abc');

    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.origin + url.pathname).toBe('https://restapi.amap.com/v3/ip');
    expect(url.searchParams.get('key')).toBe('abc');
    expect(url.searchParams.get('jscode')).toBe('secret');
    expect(await response.json()).toEqual({ status: '1' });
  });

  it('sends map styles and vector maps to their own hosts', async () => {
    vi.stubEnv('AMAP_JS_SECURITY_CODE', 'secret');
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await call(['v4', 'map', 'styles']);
    await call(['v3', 'vectormap']);

    expect((fetchMock.mock.calls[0][0] as URL).host).toBe('webapi.amap.com');
    expect((fetchMock.mock.calls[1][0] as URL).host).toBe('fmap01.amap.com');
  });
});
