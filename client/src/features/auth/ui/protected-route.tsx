'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/model/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isAuthInitialized } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    // Only redirect once auth has been initialized (session check complete)
    if (isAuthInitialized && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, isAuthInitialized, router]);

  // Show loading spinner while checking session
  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef1f4]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#c83f49] border-t-transparent" />
      </div>
    );
  }

  // After initialization, if not authenticated, don't render (redirect will happen in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
