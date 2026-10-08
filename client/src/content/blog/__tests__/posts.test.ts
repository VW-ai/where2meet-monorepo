import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOG_POSTS } from '../posts';

describe('blog posts', () => {
  it.each(BLOG_POSTS.map(({ slug }) => slug))('%s shows its example places once', (slug) => {
    const body = readFileSync(path.join(__dirname, `../${slug}.mdx`), 'utf8');
    expect(body.match(/<Places \/>/g)).toEqual(['<Places />']);
  });
});
