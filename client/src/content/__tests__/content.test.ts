import { beforeAll, describe, expect, it } from 'vitest';
import { MDX_POSTS } from '@/content/blog/posts';
import {
  checkContent,
  formatProblem,
  type ImageHead,
  type Problem,
} from '@/features/blog/lib/checks';
import {
  POSTS_DIR,
  TAXONOMY_FILE,
  filePath,
  fileSegments,
  type ContentFile,
} from '@/features/blog/lib/content-file';
import { parseCatalog } from '@/features/blog/lib/parse';
import { USER_AGENT, type CommonsImage } from '@/features/blog/lib/photos';
import { readRepoContent } from '@/features/blog/lib/source';

const repo = await readRepoContent();
const { catalog } = parseCatalog(repo);

let heads = new Map<string, ImageHead>();
let problems: Problem[] = [];

function postPhotos(file: ContentFile): readonly CommonsImage[] {
  const [slug] = fileSegments(file.name);
  const post = catalog.posts.find(
    (candidate) => candidate.source.kind === 'markdown' && candidate.slug === slug
  );
  return post?.source.kind === 'markdown' ? post.source.images : [];
}

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
  const urls = new Set(repo.posts.flatMap(postPhotos).map(({ sourceUrl }) => sourceUrl));
  const measured = await Promise.all([...urls].map(async (url) => [url, await measure(url)]));
  heads = new Map(
    measured.flatMap(([url, head]) => (head ? [[url, head] as [string, ImageHead]] : []))
  );
  problems = checkContent(repo, { heads });
}, 30_000);

function linesFor(file: string, sizes = false): string[] {
  return problems
    .filter((problem) => problem.file === file)
    .filter((problem) => (problem.rule === 'image-size') === sizes)
    .map(formatProblem);
}

function photosMeasured(
  name: string,
  photos: readonly CommonsImage[],
  skip: (note: string) => void
) {
  const unmeasured = photos
    .filter(({ sourceUrl }) => !heads.has(sourceUrl))
    .map(({ fileName }) => fileName);
  if (unmeasured.length === 0) return;
  const note = `${name}: size not checked for ${unmeasured.join(', ')}, Wikimedia could not be reached`;
  console.warn(note);
  skip(note);
}

describe(TAXONOMY_FILE, () => {
  it('follows its schema', () => {
    expect(linesFor(TAXONOMY_FILE)).toEqual([]);
  });

  it.each(MDX_POSTS.map(({ slug, occasion }) => [slug, occasion.key]))(
    '%s names the occasion "%s" from it',
    (_, key) => {
      expect(catalog.taxonomy.occasions.map((occasion) => occasion.key)).toContain(key);
    }
  );
});

describe('repo posts', () => {
  if (repo.posts.length === 0) it.skip('no posts in src/content/posts yet');

  describe.each(repo.posts)('$name', (file) => {
    const path = filePath(POSTS_DIR, file.name);

    it('passes the post checks', () => {
      expect(linesFor(path)).toEqual([]);
    });

    it('has photos the site can cache', ({ skip }) => {
      expect(linesFor(path, true)).toEqual([]);
      photosMeasured(file.name, postPhotos(file), skip);
    });
  });
});
