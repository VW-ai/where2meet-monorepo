import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MDX_POSTS } from '@/content/blog/posts';
import {
  PANEL_TAG,
  findPage,
  listPages,
  pageSegments,
  withRepoPosts,
  type BlogPage,
  type Catalog,
} from './catalog';
import { parsePublished } from './parse';
import type { CommonsImage } from './photos';

const PUBLISHED_PATH = '/api/control/where2meet/published/v3';
const FETCH_TIMEOUT_MS = 10_000;
/** Wikimedia asks every client to name itself and give a way to reach its operator. */
const USER_AGENT = 'Where2Meet/1.0 (https://www.where2meet.org/contact; contact@wayvi-ai.com)';
const PHOTO_ATTEMPTS = 3;
const NOTHING_PUBLISHED: Catalog = { posts: [], cities: new Map() };

/**
 * When the panel fails, a build goes ahead with the repo's posts, while a request
 * throws so Next keeps serving the last good page instead of caching a 404 for an hour.
 */
export async function loadCatalog(): Promise<Catalog> {
  return withRepoPosts(MDX_POSTS, await loadPanel());
}

async function loadPanel(): Promise<Catalog> {
  const fixture = process.env.VERCEL_ENV === 'production' ? '' : process.env.CONTROL_PLANE_FIXTURE;
  if (fixture) return parse(JSON.parse(await readFile(path.resolve(fixture), 'utf8')));

  const { CONTROL_PLANE_URL: origin, CONTROL_PLANE_READ_TOKEN: token } = process.env;
  if (!origin || !token) {
    warnOnce('CONTROL_PLANE_URL or CONTROL_PLANE_READ_TOKEN is not set, so only repo posts show.');
    return NOTHING_PUBLISHED;
  }
  try {
    const response = await fetch(`${origin.replace(/\/+$/, '')}${PUBLISHED_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600, tags: [PANEL_TAG] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The control plane answered ${response.status}`);
    return parse(await response.json());
  } catch (error) {
    if (!isBuilding()) throw error;
    warnOnce(`Building with repo posts only. ${error instanceof Error ? error.message : error}`);
    return NOTHING_PUBLISHED;
  }
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

function parse(raw: unknown): Catalog {
  const { catalog, issues } = parsePublished(
    raw,
    MDX_POSTS.map(({ slug }) => slug)
  );
  for (const issue of issues) warnOnce(`Skipped ${issue}`);
  return catalog;
}

const warned = new Set<string>();

export function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[blog] ${message}`);
}
