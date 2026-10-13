import 'server-only';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { MDX_POSTS } from '@/content/blog/posts';
import { findPage, listPages, pageSegments, type BlogPage, type Catalog } from './catalog';
import {
  KEYWORDS_FILE,
  PLACES_DIR,
  POSTS_DIR,
  TAXONOMY_FILE,
  WRITING_RULES_FILE,
  type ContentFile,
} from './content-file';
import { parseCatalog, type RepoContent } from './parse';
import { USER_AGENT, type CommonsImage } from './photos';

const FETCH_TIMEOUT_MS = 10_000;
const PHOTO_ATTEMPTS = 3;

/** React's `cache` builds the catalog once per request, for the page and its metadata. */
export const loadCatalog = cache(async (): Promise<Catalog> => {
  const { catalog, issues } = parseCatalog(await readRepoContent());
  for (const { file, message } of issues) warnOnce(`Skipped ${file}: ${message}`);
  return catalog;
});

export async function readRepoContent(): Promise<RepoContent> {
  const [taxonomyText, keywordsText, places, posts] = await Promise.all([
    read(TAXONOMY_FILE),
    read(KEYWORDS_FILE),
    contentFiles(PLACES_DIR, true),
    contentFiles(POSTS_DIR, false),
  ]);
  return { mdx: MDX_POSTS, taxonomyText, keywordsText, places, posts };
}

export async function readWritingRules(): Promise<string> {
  return read(WRITING_RULES_FILE);
}

function read(file: string): Promise<string> {
  return readFile(path.join(process.cwd(), file), 'utf8');
}

async function contentFiles(dir: string, recursive: boolean): Promise<ContentFile[]> {
  const root = path.join(process.cwd(), dir);
  const names = (await readdir(root, { recursive })).filter((name) => name.endsWith('.md')).sort();
  return Promise.all(
    names.map(async (name) => ({ name, text: await readFile(path.join(root, name), 'utf8') }))
  );
}

export async function loadPage(segments: readonly string[]): Promise<BlogPage | null> {
  return findPage(await loadCatalog(), segments);
}

export async function segmentsAtDepth(depth: 1 | 2 | 3): Promise<string[][]> {
  return listPages(await loadCatalog())
    .map(pageSegments)
    .filter((segments) => segments.length === depth);
}

/** Next's data cache keeps each successful answer, so every photo is fetched once. */
export async function fetchPhoto(image: CommonsImage): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(image.sourceUrl, {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: false },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.ok) return response;
    if (response.status !== 429 || attempt === PHOTO_ATTEMPTS) {
      throw new Error(`Wikimedia answered ${response.status} for ${image.fileName}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
}

const warned = new Set<string>();

export function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[blog] ${message}`);
}
