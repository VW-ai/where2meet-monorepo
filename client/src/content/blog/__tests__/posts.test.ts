import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MDX_POSTS } from '../posts';

describe('blog posts', () => {
  it.each(MDX_POSTS.map(({ slug }) => slug))('%s shows its example places once', (slug) => {
    const body = readFileSync(path.join(__dirname, `../${slug}.mdx`), 'utf8');
    expect(body.match(/<Places \/>/g)).toEqual(['<Places />']);
  });

  it.each(MDX_POSTS.map(({ slug }) => slug))('%s has a cover photo', (slug) => {
    expect(
      existsSync(path.join(__dirname, `../covers/${slug}.jpg`)),
      `${slug} needs its photo at src/content/blog/covers/${slug}.jpg`
    ).toBe(true);
  });
});
