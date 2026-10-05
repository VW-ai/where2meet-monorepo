import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateMetadata } from '@/app/(landing)/where-to-meet/page';

const FIXTURE_PATH = path.join(__dirname, '../../features/guides/__fixtures__/published.json');

async function robots() {
  const { robots } = JSON.parse(JSON.stringify(await generateMetadata())) as {
    robots: { index: boolean; follow: boolean };
  };
  return { index: robots.index, follow: robots.follow };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/where-to-meet metadata', () => {
  it('stays out of search results until a city is published', async () => {
    vi.stubEnv('CONTROL_PLANE_FIXTURE', '');
    vi.stubEnv('CONTROL_PLANE_URL', '');
    vi.stubEnv('CONTROL_PLANE_READ_TOKEN', '');
    expect(await robots()).toEqual({ index: false, follow: true });

    vi.stubEnv('CONTROL_PLANE_FIXTURE', FIXTURE_PATH);
    expect(await robots()).toEqual({ index: true, follow: true });
  });
});
