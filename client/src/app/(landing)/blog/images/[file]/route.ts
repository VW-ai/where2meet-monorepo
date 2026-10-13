import { catalogImages } from '@/features/blog/lib/catalog';
import { fetchPhoto, loadCatalog } from '@/features/blog/lib/source';

export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ file: string }[]> {
  return [...catalogImages(await loadCatalog()).keys()].map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const image = catalogImages(await loadCatalog()).get(file);
  if (!image) return new Response('Not found', { status: 404 });
  const photo = await fetchPhoto(image);
  // Serve only JPEGs from our domain. An SVG passed through here could run script.
  if (!photo.headers.get('content-type')?.startsWith('image/jpeg')) {
    return new Response('Bad gateway', { status: 502 });
  }
  return new Response(photo.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
