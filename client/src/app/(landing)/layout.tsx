import type { Metadata } from 'next';
import { StructuredData } from '@/components/seo/structured-data';
import { generateWebApplicationSchema, generateWebSiteSchema } from '@/lib/seo/structured-data';
import { SITE_CONFIG, createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Plan Where to Meet With Your Group',
  description: SITE_CONFIG.description,
  canonical: '/',
});

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData data={generateWebSiteSchema()} />
      <StructuredData data={generateWebApplicationSchema()} />
      {children}
    </>
  );
}
