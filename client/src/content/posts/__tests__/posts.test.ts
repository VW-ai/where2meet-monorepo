import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { MDX_POSTS } from '@/content/blog/posts';
import { REPO_TAXONOMY } from '@/features/blog/__fixtures__/repo-posts';
import { parseStandalone, readTaxonomy } from '@/features/blog/lib/parse';
import { USER_AGENT } from '@/features/blog/lib/photos';
import {
  checkPosts,
  formatProblem,
  type ImageHead,
  type Problem,
} from '@/features/blog/lib/post-checks';
import { postFilePath, readPostFile, type PostFile } from '@/features/blog/lib/post-file';

const POSTS = path.join(__dirname, '..');
const files: PostFile[] = readdirSync(POSTS)
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => ({ name, text: readFileSync(path.join(POSTS, name), 'utf8') }));
const { taxonomy } = readTaxonomy(REPO_TAXONOMY);

const photos = new Map(
  files.map((file) => {
    const { post } = parseStandalone(file, readPostFile(file.text), taxonomy, 'front matter');
    return [file.name, post?.source.kind === 'markdown' ? post.source.images : []] as const;
  })
);

let heads = new Map<string, ImageHead>();
let problems: Problem[] = [];

/** What a HEAD request says, or null when the network or Wikimedia can't answer right now. */
async function measure(url: string): Promise<ImageHead | null> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429 || response.status >= 500) return null;
    const length = response.headers.get('content-length');
    return {
      status: response.status,
      bytes: length !== null && /^\d+$/.test(length) ? Number(length) : null,
      contentType: response.headers.get('content-type'),
    };
  } catch {
    return null;
  }
}

beforeAll(async () => {
  const urls = new Set([...photos.values()].flat().map(({ sourceUrl }) => sourceUrl));
  const measured = await Promise.all([...urls].map(async (url) => [url, await measure(url)]));
  heads = new Map(
    measured.flatMap(([url, head]) => (head ? [[url, head] as [string, ImageHead]] : []))
  );
  problems = checkPosts(files, {
    mdxSlugs: MDX_POSTS.map(({ slug }) => slug),
    heads,
    taxonomyText: REPO_TAXONOMY,
  });
}, 30_000);

function linesFor(file: PostFile, sizes: boolean): string[] {
  return problems
    .filter((problem) => problem.file === postFilePath(file))
    .filter((problem) => (problem.rule === 'image-size') === sizes)
    .map(formatProblem);
}

describe('repo posts', () => {
  if (files.length === 0) it.skip('no posts in src/content/posts yet');

  describe.each(files)('$name', (file) => {
    it('passes the post checks', () => {
      expect(linesFor(file, false)).toEqual([]);
    });

    it('has photos the site can cache', ({ skip }) => {
      expect(linesFor(file, true)).toEqual([]);
      const unmeasured = (photos.get(file.name) ?? [])
        .filter(({ sourceUrl }) => !heads.has(sourceUrl))
        .map(({ fileName }) => fileName);
      if (unmeasured.length === 0) return;
      const note = `${file.name}: size not checked for ${unmeasured.join(', ')}, Wikimedia could not be reached`;
      console.warn(note);
      skip(note);
    });
  });
});
