import type { Metadata } from 'next';
import { ProtectedRoute } from '@/features/auth/ui/protected-route';
import { createMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = createMetadata({
  title: 'Dashboard',
  description: 'Manage your Where2Meet events and settings',
  noIndex: true, // Prevent private pages from being indexed
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
