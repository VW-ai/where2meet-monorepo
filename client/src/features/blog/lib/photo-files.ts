import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BLOG_PATH, IMAGES_SEGMENT, catalogImages, type Catalog } from './catalog';
import { USER_AGENT, type CommonsImage } from './photos';

const PHOTOS_DIR = path.join('public', BLOG_PATH, IMAGES_SEGMENT);
const DOWNLOADS_DIR = path.join('.next', 'cache', 'blog-photos');
const FETCH_TIMEOUT_MS = 10_000;
const PHOTO_ATTEMPTS = 3;

type Attempt = { jpeg: Buffer } | { failure: string; transient: boolean };

/**
 * Vercel's image optimizer resizes files in `public/` but passes route handler output through,
 * so the photos are static files. Vercel keeps `.next/cache` between builds, so a later build
 * fetches only new photos.
 */
export async function writePhotoFiles(
  catalog: Catalog,
  root = process.cwd()
): Promise<{ written: number; fetched: number }> {
  const images = catalogImages(catalog);
  const photosDir = path.join(root, PHOTOS_DIR);
  const downloadsDir = path.join(root, DOWNLOADS_DIR);
  await mkdir(photosDir, { recursive: true });
  await mkdir(downloadsDir, { recursive: true });
  let fetched = 0;
  for (const image of images.values()) {
    const download = path.join(downloadsDir, `${sha256(image.sourceUrl)}.jpg`);
    const cached = await readFile(download).catch(() => null);
    const jpeg = cached ?? (await fetchJpeg(image));
    if (!cached) {
      await writeFile(`${download}.part`, jpeg);
      await rename(`${download}.part`, download);
      fetched += 1;
    }
    await writeFile(path.join(photosDir, image.fileName), jpeg);
  }
  for (const name of await readdir(photosDir)) {
    if (!images.has(name)) await rm(path.join(photosDir, name), { recursive: true, force: true });
  }
  return { written: images.size, fetched };
}

export async function readPhotoFile(image: CommonsImage): Promise<Buffer> {
  const file = path.join(PHOTOS_DIR, image.fileName);
  return readFile(path.join(process.cwd(), file)).catch((error: unknown) => {
    throw new Error(`${file} is missing. Run npm run blog-photos.`, { cause: error });
  });
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function fetchJpeg(image: CommonsImage): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const result = await download(image);
    if ('jpeg' in result) return result.jpeg;
    if (!result.transient || attempt === PHOTO_ATTEMPTS) {
      throw new Error(`Wikimedia ${result.failure} for ${image.fileName}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
}

async function download(image: CommonsImage): Promise<Attempt> {
  try {
    const answer = await fetch(image.sourceUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!answer.ok) {
      const transient = answer.status === 429 || answer.status >= 500;
      return { failure: `answered ${answer.status}`, transient };
    }
    const type = answer.headers.get('content-type');
    if (!type?.startsWith('image/jpeg')) {
      return { failure: `sent ${type ?? 'no content type'}`, transient: false };
    }
    return { jpeg: Buffer.from(await answer.arrayBuffer()) };
  } catch (error) {
    return { failure: `could not be reached (${networkFailure(error)})`, transient: true };
  }
}

function networkFailure(error: unknown): string {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause && typeof cause === 'object' && 'code' in cause) return String(cause.code);
  return error instanceof Error ? error.name : String(error);
}
