import { readFileSync, readdirSync } from 'node:fs';
import type * as FsPromises from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { MDX_POSTS } from '@/content/blog/posts';
import { PLACES_DIR, POSTS_DIR, TAXONOMY_FILE, type ContentFile } from '../lib/content-file';
import type { RepoContent } from '../lib/parse';

/** A file at `path` from the client root, as the site would find it there. */
export interface FixtureFile {
  path: string;
  text: string;
}

const FIXTURE_ROOT = path.join(__dirname, 'content');

/** New York, Midtown and four posts on them, laid out as in the client root. */
export const FIXTURE_FILES: readonly FixtureFile[] = readdirSync(FIXTURE_ROOT, {
  recursive: true,
  encoding: 'utf8',
})
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => ({ path: name, text: readFileSync(path.join(FIXTURE_ROOT, name), 'utf8') }));

export const REPO_TAXONOMY = readFileSync(path.join(process.cwd(), TAXONOMY_FILE), 'utf8');

/** What `readRepoContent` reads when the client root holds `files` and the repo's taxonomy. */
export function fixtureContent(files: readonly FixtureFile[] = FIXTURE_FILES): RepoContent {
  const under = (dir: string): ContentFile[] =>
    files.flatMap((file) =>
      file.path.startsWith(`${dir}/`)
        ? [{ name: file.path.slice(dir.length + 1), text: file.text }]
        : []
    );
  return {
    mdx: MDX_POSTS,
    taxonomyText: REPO_TAXONOMY,
    places: under(PLACES_DIR),
    posts: under(POSTS_DIR),
  };
}

export function markdownFile(
  name: string,
  frontMatter: Record<string, unknown>,
  body: string
): ContentFile {
  return { name, text: `---\n${stringify(frontMatter)}---\n${body}` };
}

/** `fs` as if `files` were in the client root too: listed by `readdir`, served by `readFile`. */
export function withContentFiles(
  fs: typeof FsPromises,
  files: () => readonly FixtureFile[]
): typeof FsPromises {
  const absolute = (file: FixtureFile) => path.join(process.cwd(), file.path);
  const readdir = (async (target: string, options?: { recursive?: boolean }) => {
    const names = (await fs.readdir(target, options)) as string[];
    const added = files().flatMap((file) => {
      const name = path.relative(target, absolute(file));
      const inside = !name.startsWith('..') && !path.isAbsolute(name);
      return inside && (options?.recursive || !name.includes(path.sep)) ? [name] : [];
    });
    return [...new Set([...names, ...added])];
  }) as typeof fs.readdir;
  const readFile = (async (target: string, ...rest: [BufferEncoding]) => {
    const file = files().find((candidate) => absolute(candidate) === target);
    return file ? file.text : fs.readFile(target, ...rest);
  }) as typeof fs.readFile;
  return { ...fs, readdir, readFile };
}
