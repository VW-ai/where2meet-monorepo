import 'server-only';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import {
  findPage,
  listPages,
  pagePhotos,
  pageSegments,
  type BlogPage,
  type Catalog,
} from './catalog';
import {
  KEYWORDS_FILE,
  PLACES_DIR,
  POSTS_DIR,
  TAXONOMY_FILE,
  WRITING_RULES_FILE,
  type ContentFile,
} from './content-file';
import { parseCatalog, type RepoContent } from './parse';
import { requirePhotoFiles } from './photo-files';

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
  return { taxonomyText, keywordsText, places, posts };
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
  const pages = listPages(await loadCatalog()).filter(
    (page) => pageSegments(page).length === depth
  );
  await requirePhotoFiles(pages.flatMap(pagePhotos));
  return pages.map(pageSegments);
}

const warned = new Set<string>();

export function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[blog] ${message}`);
}
