/**
 * React hook for engagement time tracking
 *
 * Tracks meaningful active time on page (pauses when tab is inactive)
 * using Page Visibility API. Sends events at milestones: 30s, 60s, 120s, 300s.
 *
 * Usage:
 * ```tsx
 * 'use client'
 *
 * import { useEngagementTracking } from '@/lib/analytics/hooks/useEngagementTracking'
 *
 * export default function MyPage() {
 *   useEngagementTracking('/my-page')
 *   return <div>...</div>
 * }
 * ```
 */

'use client';

import { useEffect } from 'react';
import { setupEngagementTracking } from '../tracking/engagement-tracking';

/**
 * Hook to track engagement time on a page
 *
 * Tracks active time (pauses when tab is hidden/inactive).
 * Sends events at time milestones and final time on page unload.
 *
 * @param pagePath - Current page path (e.g., '/scenarios/friends-group-dinner')
 * @param enabled - Whether tracking is enabled (default: true)
 */
export function useEngagementTracking(pagePath: string, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    // Set up engagement tracking
    const cleanup = setupEngagementTracking(pagePath);

    // Clean up on unmount (sends final engagement time)
    return cleanup;
  }, [pagePath, enabled]);
}
