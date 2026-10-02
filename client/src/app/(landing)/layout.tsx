import type { Metadata } from 'next';
import { StructuredData } from '@/components/seo/structured-data';
import { generateWebApplicationSchema, generateWebSiteSchema } from '@/lib/seo/structured-data';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Fair Meeting Spot Finder: Equal Travel Times',
  description:
    'Where2Meet finds fair meeting spots by comparing real travel times for everyone in your group. See routes on a map, vote on venues, no sign-up needed.',
  image: '/og-landing.png',
  imageAlt: 'Where2Meet – find fair meeting spots with equal travel times for everyone',
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
