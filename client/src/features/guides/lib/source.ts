import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GUIDES_TAG,
  findPage,
  listPages,
  pageSegments,
  type Catalog,
  type GuidesPage,
} from './catalog';
import { parsePublished } from './parse';

const PUBLISHED_PATH = '/api/control/where2meet/published/v2';
/** A stalled control plane fails fast instead of holding a build worker or a render. */
const FETCH_TIMEOUT_MS = 10_000;
const NONE: Catalog = { cities: new Map() };

/**
 * Everything the control plane has published. Without its env vars the site builds
 * and serves with no guides.
 *
 * When the control plane fails, a build goes ahead with no guides, while a request
 * throws so Next keeps serving the last good page instead of caching a 404 for an hour.
 */
export async function loadCatalog(): Promise<Catalog> {
  const fixture = process.env.VERCEL_ENV === 'production' ? '' : process.env.CONTROL_PLANE_FIXTURE;
  if (fixture) return toCatalog(JSON.parse(await readFile(path.resolve(fixture), 'utf8')));

  const { CONTROL_PLANE_URL: origin, CONTROL_PLANE_READ_TOKEN: token } = process.env;
  if (!origin || !token) {
    warnOnce(
      'CONTROL_PLANE_URL or CONTROL_PLANE_READ_TOKEN is not set, so no guides are published.'
    );
    return NONE;
  }
  try {
    const response = await fetch(`${origin.replace(/\/+$/, '')}${PUBLISHED_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600, tags: [GUIDES_TAG] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`The control plane answered ${response.status}`);
    return toCatalog(await response.json());
  } catch (error) {
    if (process.env.NEXT_PHASE !== 'phase-production-build') throw error;
    warnOnce(`Building without guides. ${error instanceof Error ? error.message : error}`);
    return NONE;
  }
}

export async function loadPage(segments: readonly string[]): Promise<GuidesPage | null> {
  return findPage(await loadCatalog(), segments);
}

/** The segments of each published page `depth` levels below /where-to-meet. */
export async function segmentsAtDepth(depth: 1 | 2 | 3): Promise<string[][]> {
  return listPages(await loadCatalog())
    .map(pageSegments)
    .filter((segments) => segments.length === depth);
}

function toCatalog(raw: unknown): Catalog {
  const { catalog, issues } = parsePublished(raw);
  for (const issue of issues) warnOnce(`Skipped ${issue}`);
  return catalog;
}

const warned = new Set<string>();

/** Every page and cover loads the catalog, so each message prints once per process. */
function warnOnce(message: string) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`[guides] ${message}`);
}
