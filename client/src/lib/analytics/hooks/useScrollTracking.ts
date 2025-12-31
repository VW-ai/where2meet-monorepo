/**
 * React hook for scroll depth tracking
 *
 * Automatically tracks when users scroll to specific depth milestones
 * (25%, 50%, 75%, 90%, 100%) using IntersectionObserver.
 *
 * Usage:
 * ```tsx
 * 'use client'
 *
 * import { useScrollTracking } from '@/lib/analytics/hooks/useScrollTracking'
 *
 * export default function MyPage() {
 *   useScrollTracking('/my-page')
 *   return <div>...</div>
 * }
 * ```
 */

'use client';

import { useEffect } from 'react';
import { setupScrollTracking } from '../tracking/scroll-tracking';

/**
 * Hook to track scroll depth on a page
 *
 * @param pagePath - Current page path (e.g., '/scenarios/friends-group-dinner')
 * @param enabled - Whether tracking is enabled (default: true)
 */
export function useScrollTracking(pagePath: string, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    // Set up scroll tracking
    const cleanup = setupScrollTracking(pagePath);

    // Clean up on unmount
    return cleanup;
  }, [pagePath, enabled]);
}
