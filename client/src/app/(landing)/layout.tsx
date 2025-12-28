import type { Metadata } from 'next';
import { StructuredData } from '@/components/seo/structured-data';
import { generateWebSiteSchema } from '@/lib/seo/structured-data';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Find the Perfect Meeting Spot for Your Group',
  description:
    'Where2Meet helps you find fair meeting locations by comparing travel times for all participants. Visualize routes, discover venues, and plan better group meetings with our smart meeting spot finder.',
  keywords: [
    'meeting spot finder',
    'group meeting planner',
    'find meeting location',
    'central meeting point calculator',
    'where to meet friends',
    'compare travel times',
    'fair meeting location for everyone',
    'visual meeting planning map',
    'best place to meet halfway',
    'optimal meeting venue finder',
  ],
  image: '/og-landing.png',
  canonical: '/',
});

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StructuredData data={generateWebSiteSchema()} />
      {children}
    </>
  );
}
