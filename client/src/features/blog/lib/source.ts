import 'server-only';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import { MDX_POSTS } from '@/content/blog/posts';
import {
  PANEL_TAG,
  findPage,
  listPages,
  pageSegments,
  type BlogPage,
  type Catalog,
} from './catalog';
import { TAXONOMY_FILE, parseCatalog, type RepoContent } from './parse';
import { USER_AGENT, type CommonsImage } from './photos';
import { POSTS_DIR, type PostFile } from './post-file';

const PUBLISHED_PATH = '/api/control/where2meet/published/v3';
const FETCH_TIMEOUT_MS = 10_000;
const PHOTO_ATTEMPTS = 3;

/** React's `cache` builds the catalog once per request, for the page and its metadata. */
export const loadCatalog = cache(async (): Promise<Catalog> => {
  const [files, taxonomyText] = await Promise.all([
    postFiles(),
    readFile(path.join(process.cwd(), TAXONOMY_FILE), 'utf8'),
  ]);
  const { catalog, issues } = await parseWithPanel({ mdx: MDX_POSTS, files, taxonomyText });
  for (const issue of issues) warnOnce(`Skipped ${issue}`);
  return catalog;
});

/**
 * When the panel fails, a build goes ahead with the repo's posts, while a request
 * throws so Next keeps serving the last good page instead of caching a 404 for an hour.
 */
async function parseWithPanel(repo: RepoContent): Promise<ReturnType<typeof parseCatalog>> {
  const fixture = process.env.VERCEL_ENV === 'production' ? '' : process.env.CONTROL_PLANE_FIXTURE;
  if (fixture) return parseCatalog(repo, JSON.parse(await readFile(path.resolve(fixture), 'utf8')));

  const { CONTROL_PLANE_URL: origin, CONTROL_PLANE_READ_TOKEN: token } = process.env;
  if (!origin || !token) {
    warnOnce('CONTROL_PLANE_URL or CONTROL_PLANE_READ_TOKEN is not set, so only repo posts show.');
    return parseCatalog(repo);
  }
  try {
    const response = await fetch(`${origin.replace(/\/+$/, '')}${PUBLISHED_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600, tags: [PANEL_TAG] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The control plane answered ${response.status}`);
    return parseCatalog(repo, await response.json());
  } catch (error) {
    if (!isBuilding()) throw error;
    warnOnce(`Building with repo posts only. ${error instanceof Error ? error.message : error}`);
    return parseCatalog(repo);
  }
}

async function postFiles(): Promise<PostFile[]> {
  const dir = path.join(process.cwd(), POSTS_DIR);
  const names = (await readdir(dir)).filter((name) => name.endsWith('.md')).sort();
  return Promise.all(
    names.map(async (name) => ({ name, text: await readFile(path.join(dir, name), 'utf8') }))
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

export function isBuilding(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

const warned = new Set<string>();

export function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[blog] ${message}`);
}
