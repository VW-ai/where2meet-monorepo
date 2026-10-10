import { describe, expect, it } from 'vitest';
import { MDX_POSTS } from '@/content/blog/posts';
import { REPO_TAXONOMY } from '@/features/blog/__fixtures__/repo-posts';
import { TAXONOMY_FILE, checkTaxonomy, readTaxonomy } from '@/features/blog/lib/parse';

const { taxonomy } = readTaxonomy(REPO_TAXONOMY);

describe(TAXONOMY_FILE, () => {
  it('follows its schema', () => {
    expect(checkTaxonomy(REPO_TAXONOMY)).toEqual([]);
  });

  it.each(MDX_POSTS.map(({ slug, occasion }) => [slug, occasion.key]))(
    '%s names the occasion "%s" from it',
    (_, key) => {
      expect(taxonomy('occasion', key)?.key).toBe(key);
    }
  );
});
