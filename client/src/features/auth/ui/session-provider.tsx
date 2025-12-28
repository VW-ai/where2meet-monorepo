'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/model/auth-store';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    // Check session once on app load
    checkSession();
  }, [checkSession]);

  return <>{children}</>;
}
