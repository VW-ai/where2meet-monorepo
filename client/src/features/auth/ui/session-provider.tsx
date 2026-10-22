'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';
import { useAuthStore } from '@/features/auth/model/auth-store';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((state) => state.checkSession);
  const user = useAuthStore((state) => state.user);
  const identifiedId = useRef<string | null>(null);

  useEffect(() => {
    // Check session once on app load
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (!posthog.__loaded) return;
    if (user) {
      if (identifiedId.current === user.id) return;
      posthog.identify(user.id, { email: user.email, name: user.name });
      identifiedId.current = user.id;
    } else if (identifiedId.current) {
      // Sign-out: start a new anonymous person so the next visitor on this device isn't merged in.
      posthog.reset();
      identifiedId.current = null;
    }
  }, [user]);

  return <>{children}</>;
}
