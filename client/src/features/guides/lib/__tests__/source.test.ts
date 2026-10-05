import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../__fixtures__/published.json';
import { loadCatalog } from '../source';

const FIXTURE_PATH = path.join(__dirname, '../../__fixtures__/published.json');

function citySlugs(catalog: Awaited<ReturnType<typeof loadCatalog>>) {
  return catalog.cities.map((city) => city.slug);
}

function stubControlPlane(response: Response) {
  vi.stubEnv('CONTROL_PLANE_URL', 'https://control.example/');
  vi.stubEnv('CONTROL_PLANE_READ_TOKEN', 'read-token');
  vi.stubGlobal('fetch', async () => response);
}

beforeEach(() => {
  vi.stubEnv('CONTROL_PLANE_FIXTURE', '');
  vi.stubEnv('CONTROL_PLANE_URL', '');
  vi.stubEnv('CONTROL_PLANE_READ_TOKEN', '');
  vi.stubEnv('NEXT_PHASE', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('loadCatalog', () => {
  it('reads the fixture outside production and ignores it in production', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(citySlugs(await loadCatalog())).toEqual(['new-york', 'ann-arbor']);

    vi.stubEnv('VERCEL_ENV', 'production');
    expect(citySlugs(await loadCatalog())).toEqual([]);
  });

  it('publishes nothing until the control plane is configured, then asks it with the read token', async () => {
    const fetchMock = vi.fn(async (..._args: [string, RequestInit]) => Response.json(fixture));
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadCatalog()).toEqual({ cities: [] });

    vi.stubEnv('CONTROL_PLANE_URL', 'https://control.example/');
    vi.stubEnv('CONTROL_PLANE_READ_TOKEN', 'read-token');
    expect(citySlugs(await loadCatalog())).toEqual(['new-york', 'ann-arbor']);
    expect(fetchMock.mock.calls).toEqual([
      [
        'https://control.example/api/control/where2meet/published',
        {
          headers: { Authorization: 'Bearer read-token' },
          next: { revalidate: 3600, tags: ['where2meet-guides'] },
          signal: expect.any(AbortSignal),
        },
      ],
    ]);
  });

  it('throws on a failed request, but builds with no guides', async () => {
    stubControlPlane(new Response('down', { status: 503 }));
    await expect(loadCatalog()).rejects.toThrow('The control plane answered 503');

    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    expect(await loadCatalog()).toEqual({ cities: [] });
  });
});
