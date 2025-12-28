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
      <div className="min-h-screen bg-gradient-to-br from-coral-50 via-mint-50 to-lavender-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-coral-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // After initialization, if not authenticated, don't render (redirect will happen in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
