import { catalogImages } from '@/features/blog/lib/catalog';
import { fetchPhoto, loadCatalog } from '@/features/blog/lib/source';

/**
 * GET /blog/images/<file>: a photo the panel published, from its Wikimedia source. Only
 * file names in the published content are served; anything else is a 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const image = catalogImages(await loadCatalog()).get(file);
  if (!image) return new Response('Not found', { status: 404 });
  const photo = await fetchPhoto(image);
  return new Response(photo.body, {
    headers: {
      'Content-Type': photo.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
