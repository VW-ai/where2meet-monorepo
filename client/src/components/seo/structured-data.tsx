import type { Thing, WithContext } from 'schema-dts';

/**
 * Component to safely inject JSON-LD structured data into the page
 *
 * Usage:
 * ```tsx
 * import { StructuredData } from '@/components/seo/structured-data'
 * import { generateOrganizationSchema } from '@/lib/seo/structured-data'
 *
 * <StructuredData data={generateOrganizationSchema()} />
 * ```
 */
export function StructuredData({ data }: { data: WithContext<Thing> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
