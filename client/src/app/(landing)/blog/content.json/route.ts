import { buildContentJson } from '@/features/blog/lib/content-json';
import { loadCatalog, readWritingRules } from '@/features/blog/lib/source';

export const dynamic = 'force-static';

export async function GET() {
  const [catalog, writingRules] = await Promise.all([loadCatalog(), readWritingRules()]);
  return Response.json(buildContentJson(catalog, { generatedAt: new Date(), writingRules }), {
    headers: { 'X-Robots-Tag': 'noindex' },
  });
}
