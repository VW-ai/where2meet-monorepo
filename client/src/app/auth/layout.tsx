import type { Metadata } from 'next';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Authentication',
  description: 'Sign in or create an account on Where2Meet',
  robots: { index: false, follow: true }, // Prevent auth pages from being indexed
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
