import { revalidateTag } from 'next/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/revalidate/route';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

function post(authorization: string | null, body: unknown = { tag: 'where2meet-guides' }) {
  return POST(
    new Request('http://localhost/api/revalidate', {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.stubEnv('WHERE2MEET_REVALIDATE_SECRET', 's3cret');
  vi.mocked(revalidateTag).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/revalidate', () => {
  it('expires the guides at once for the right secret and refuses anything else', async () => {
    for (const authorization of [
      null,
      's3cret',
      'Bearer s3cre',
      'Bearer s3cret2',
      'bearer s3cret',
    ]) {
      const refused = await post(authorization);
      expect([authorization, refused.status]).toEqual([authorization, 401]);
      expect(await refused.json()).toEqual({ error: 'Unauthorized' });
    }

    const accepted = await post('Bearer s3cret');
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ revalidated: true });
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([['where2meet-guides', { expire: 0 }]]);
  });

  it('refuses every request when no secret is configured', async () => {
    vi.stubEnv('WHERE2MEET_REVALIDATE_SECRET', '');
    expect((await post('Bearer ')).status).toBe(401);
    expect((await post('Bearer undefined')).status).toBe(401);
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([]);
  });

  it('answers 400 for a body without the guides tag', async () => {
    for (const body of [{ tag: 'blog' }, {}, 'where2meet-guides']) {
      const response = await post('Bearer s3cret', body);
      expect([body, response.status]).toEqual([body, 400]);
    }
    expect(vi.mocked(revalidateTag).mock.calls).toEqual([]);
  });
});
