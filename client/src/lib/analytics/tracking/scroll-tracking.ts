/**
 * Scroll Depth Tracking
 *
 * Tracks when users scroll to specific depth milestones (25%, 50%, 75%, 90%, 100%)
 * using IntersectionObserver for performance.
 */

import { trackEvent } from '../events';

/**
 * Scroll depth milestones to track
 */
export const SCROLL_MILESTONES = [25, 50, 75, 90, 100] as const;
export type ScrollMilestone = (typeof SCROLL_MILESTONES)[number];

/**
 * Track scroll depth event
 */
export function trackScrollDepth(depth: ScrollMilestone, pagePath: string) {
  trackEvent('scroll_depth', {
    scroll_depth: depth,
    page_path: pagePath,
    event_category: 'engagement',
  });
}

/**
 * Set up scroll depth tracking using IntersectionObserver
 *
 * Creates markers at specific scroll depths and tracks when they become visible.
 * Tracks each milestone only once per page load.
 *
 * @param pagePath - Current page path for tracking
 * @returns Cleanup function to remove observers and markers
 */
export function setupScrollTracking(pagePath: string): () => void {
  // Track which milestones have been triggered
  const triggeredMilestones = new Set<ScrollMilestone>();

  // Create invisible markers at scroll depth positions
  const markers: Array<{ element: HTMLElement; depth: ScrollMilestone }> = [];

  SCROLL_MILESTONES.forEach((depth) => {
    const marker = document.createElement('div');
    marker.style.position = 'absolute';
    marker.style.width = '1px';
    marker.style.height = '1px';
    marker.style.opacity = '0';
    marker.style.pointerEvents = 'none';
    marker.setAttribute('data-scroll-marker', depth.toString());

    // Position marker at the appropriate scroll depth
    // We'll update positions dynamically based on document height
    document.body.appendChild(marker);

    markers.push({ element: marker, depth });
  });

  // Function to update marker positions based on current document height
  const updateMarkerPositions = () => {
    const documentHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const scrollableHeight = documentHeight - viewportHeight;

    markers.forEach(({ element, depth }) => {
      const topPosition = (scrollableHeight * depth) / 100;
      element.style.top = `${topPosition}px`;
    });
  };

  // Initial position update
  updateMarkerPositions();

  // Update positions when window resizes or content changes
  const resizeObserver = new ResizeObserver(updateMarkerPositions);
  resizeObserver.observe(document.body);

  // Set up IntersectionObserver to track when markers become visible
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const depth = parseInt(
            entry.target.getAttribute('data-scroll-marker') || '0',
            10
          ) as ScrollMilestone;

          // Track only if not already tracked
          if (!triggeredMilestones.has(depth)) {
            triggeredMilestones.add(depth);
            trackScrollDepth(depth, pagePath);
          }
        }
      });
    },
    {
      threshold: 0,
      rootMargin: '0px',
    }
  );

  // Observe all markers
  markers.forEach(({ element }) => {
    intersectionObserver.observe(element);
  });

  // Cleanup function
  return () => {
    intersectionObserver.disconnect();
    resizeObserver.disconnect();
    markers.forEach(({ element }) => {
      element.remove();
    });
  };
}

/**
 * Get current scroll percentage
 */
export function getCurrentScrollPercentage(): number {
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  const scrollableHeight = documentHeight - windowHeight;
  const scrollPercentage = (scrollTop / scrollableHeight) * 100;

  return Math.min(100, Math.max(0, scrollPercentage));
}
