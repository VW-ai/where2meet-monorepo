/**
 * React hook for CTA click tracking
 *
 * Provides a function to track CTA clicks with location and type context.
 * Useful for understanding which CTAs drive engagement and conversions.
 *
 * Usage:
 * ```tsx
 * 'use client'
 *
 * import { useCTATracking } from '@/lib/analytics/hooks/useCTATracking'
 *
 * export default function MyPage() {
 *   const trackCTA = useCTATracking()
 *
 *   return (
 *     <button
 *       onClick={() => trackCTA({
 *         ctaText: 'Start Planning',
 *         ctaLocation: 'hero',
 *         ctaType: 'primary',
 *         pagePath: '/scenarios/friends-group-dinner',
 *         destination: '/',
 *       })}
 *     >
 *       Start Planning
 *     </button>
 *   )
 * }
 * ```
 */

'use client';

import { useCallback, useEffect } from 'react';
import {
  trackCTAClick,
  setupExitIntentTracking,
  type CTATrackingParams,
} from '../tracking/cta-tracking';

/**
 * Hook to track CTA clicks
 *
 * Returns a callback function to track CTA clicks with context.
 *
 * @returns Function to track CTA clicks
 */
export function useCTATracking() {
  return useCallback((params: CTATrackingParams) => {
    trackCTAClick(params);
  }, []);
}

/**
 * Hook to track exit intent on a page
 *
 * Automatically sets up exit intent tracking (desktop only - mouse leaving viewport).
 * Tracks when user is about to leave the page (detected by mouse moving toward URL bar).
 *
 * Usage:
 * ```tsx
 * 'use client'
 *
 * import { useExitIntentTracking } from '@/lib/analytics/hooks/useCTATracking'
 *
 * export default function MyPage() {
 *   useExitIntentTracking('/my-page')
 *   return <div>...</div>
 * }
 * ```
 *
 * @param pagePath - Current page path
 * @param enabled - Whether tracking is enabled (default: true)
 */
export function useExitIntentTracking(pagePath: string, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    // Set up exit intent tracking
    const cleanup = setupExitIntentTracking(pagePath);

    // Clean up on unmount
    return cleanup;
  }, [pagePath, enabled]);
}
