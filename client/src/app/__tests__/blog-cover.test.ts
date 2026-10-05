import { describe, expect, it } from 'vitest';
import { GET } from '@/app/(landing)/blog/[slug]/cover.png/route';
import { BLOG_POSTS } from '@/content/blog/posts';

describe('blog cover', () => {
  it.each(BLOG_POSTS.map((post) => post.slug))('renders a 1200x630 PNG for %s', async (slug) => {
    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ slug }),
    });
    expect(response.headers.get('content-type')).toBe('image/png');

    const png = Buffer.from(await response.arrayBuffer());
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });
});
