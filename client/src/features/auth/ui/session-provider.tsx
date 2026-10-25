'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/features/auth/model/auth-store';
import { withPostHog } from '@/lib/analytics/posthog';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((state) => state.checkSession);
  const user = useAuthStore((state) => state.user);
  const identifiedId = useRef<string | null>(null);

  useEffect(() => {
    // Check session once on app load
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (user) {
      if (identifiedId.current === user.id) return;
      withPostHog((posthog) => posthog.identify(user.id, { email: user.email, name: user.name }));
      identifiedId.current = user.id;
    } else if (identifiedId.current) {
      // Sign-out: start a new anonymous person so the next visitor on this device isn't merged in.
      withPostHog((posthog) => posthog.reset());
      identifiedId.current = null;
    }
  }, [user]);

  return <>{children}</>;
}
