/**
 * CTA (Call-to-Action) Tracking
 *
 * Tracks clicks on CTAs with location and type context for understanding
 * which CTAs drive engagement and conversions.
 */

import { trackEvent } from '../events';

/**
 * CTA location on the page
 */
export type CTALocation =
  | 'hero'
  | 'mid-page'
  | 'footer'
  | 'navigation'
  | 'sidebar'
  | 'modal'
  | 'inline';

/**
 * CTA visual style/importance
 */
export type CTAType = 'primary' | 'secondary' | 'tertiary' | 'link';

/**
 * CTA tracking parameters
 */
export interface CTATrackingParams {
  /** Text displayed on the CTA */
  ctaText: string;

  /** Where the CTA appears on the page */
  ctaLocation: CTALocation;

  /** Visual style/importance of the CTA */
  ctaType: CTAType;

  /** Current page path */
  pagePath: string;

  /** Optional: destination URL */
  destination?: string;

  /** Optional: custom attributes */
  customAttributes?: Record<string, string | number | boolean>;
}

/**
 * Track CTA click event
 */
export function trackCTAClick(params: CTATrackingParams) {
  const { ctaText, ctaLocation, ctaType, pagePath, destination, customAttributes } = params;

  trackEvent('cta_click', {
    cta_text: ctaText,
    cta_location: ctaLocation,
    cta_type: ctaType,
    page_path: pagePath,
    destination,
    event_category: 'conversion',
    ...customAttributes,
  });
}

/**
 * Track exit intent (when user is about to leave the page)
 */
export function trackExitIntent(pagePath: string, timeOnPage: number) {
  trackEvent('exit_intent', {
    page_path: pagePath,
    time_on_page: timeOnPage,
    event_category: 'engagement',
  });
}

/**
 * Set up exit intent tracking (desktop only - mouse leaving viewport toward top)
 */
export function setupExitIntentTracking(pagePath: string): () => void {
  let hasTriggered = false;
  const startTime = Date.now();

  const handleMouseLeave = (event: MouseEvent) => {
    // Only trigger once per page load
    if (hasTriggered) return;

    // Only trigger if mouse is leaving toward the top (URL bar area)
    if (event.clientY <= 0) {
      hasTriggered = true;
      const timeOnPage = Math.floor((Date.now() - startTime) / 1000);

      // Only track if user spent at least 5 seconds on page
      if (timeOnPage >= 5) {
        trackExitIntent(pagePath, timeOnPage);
      }
    }
  };

  // Only enable on desktop (not mobile)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (!isMobile) {
    document.addEventListener('mouseleave', handleMouseLeave);
  }

  // Cleanup function
  return () => {
    if (!isMobile) {
      document.removeEventListener('mouseleave', handleMouseLeave);
    }
  };
}

/**
 * Helper to create CTA click handler
 */
export function createCTAHandler(params: Omit<CTATrackingParams, 'pagePath'>) {
  return (pagePath: string) => {
    trackCTAClick({ ...params, pagePath });
  };
}
