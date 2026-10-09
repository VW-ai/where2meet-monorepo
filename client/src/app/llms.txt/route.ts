import { loadCatalog } from '@/features/blog/lib/source';
import { buildLlmsTxt } from '@/lib/seo/llms-txt';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(buildLlmsTxt(await loadCatalog()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
