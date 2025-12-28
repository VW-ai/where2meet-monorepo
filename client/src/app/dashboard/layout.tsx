import { ProtectedRoute } from '@/features/auth/ui/protected-route';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
