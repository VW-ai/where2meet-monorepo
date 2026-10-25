'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { scopeReplayTo } from '@/lib/analytics/posthog';

export function SessionReplayScope() {
  const pathname = usePathname();
  useEffect(() => scopeReplayTo(pathname), [pathname]);
  return null;
}
