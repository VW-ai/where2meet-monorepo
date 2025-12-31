/**
 * Engagement Time Tracking
 *
 * Tracks meaningful engagement time (active time, not just tab open)
 * using Page Visibility API to pause when tab is inactive.
 */

import { trackEvent } from '../events';

/**
 * Time milestones to track (in seconds)
 */
export const TIME_MILESTONES = [30, 60, 120, 300] as const;
export type TimeMilestone = (typeof TIME_MILESTONES)[number];

/**
 * Track engagement time event
 */
export function trackEngagementTime(seconds: number, pagePath: string) {
  trackEvent('engagement_time', {
    engagement_seconds: seconds,
    page_path: pagePath,
    event_category: 'engagement',
  });
}

/**
 * Set up engagement time tracking
 *
 * Tracks active time on page (pauses when tab is inactive).
 * Sends events at specific milestones and on page unload.
 *
 * @param pagePath - Current page path for tracking
 * @returns Cleanup function to remove listeners and send final time
 */
export function setupEngagementTracking(pagePath: string): () => void {
  let totalActiveTime = 0; // in milliseconds
  let isActive = !document.hidden;
  let lastActiveTimestamp = isActive ? Date.now() : 0;

  // Track which milestones have been triggered
  const triggeredMilestones = new Set<TimeMilestone>();

  /**
   * Update active time counter
   */
  const updateActiveTime = () => {
    if (isActive && lastActiveTimestamp > 0) {
      const now = Date.now();
      const deltaTime = now - lastActiveTimestamp;
      totalActiveTime += deltaTime;
      lastActiveTimestamp = now;

      // Check if any milestone was reached
      const currentSeconds = Math.floor(totalActiveTime / 1000);
      TIME_MILESTONES.forEach((milestone) => {
        if (currentSeconds >= milestone && !triggeredMilestones.has(milestone)) {
          triggeredMilestones.add(milestone);
          trackEngagementTime(milestone, pagePath);
        }
      });
    }
  };

  /**
   * Handle visibility change (tab switch, minimize, etc.)
   */
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab became inactive - update time and pause
      updateActiveTime();
      isActive = false;
      lastActiveTimestamp = 0;
    } else {
      // Tab became active - resume tracking
      isActive = true;
      lastActiveTimestamp = Date.now();
    }
  };

  /**
   * Send final engagement time on page unload
   */
  const handleBeforeUnload = () => {
    updateActiveTime();
    const finalSeconds = Math.floor(totalActiveTime / 1000);

    // Only send if user spent meaningful time (>5 seconds)
    if (finalSeconds > 5 && typeof window.gtag !== 'undefined') {
      trackEngagementTime(finalSeconds, pagePath);
    }
  };

  // Set up event listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Update active time periodically (every 5 seconds)
  const updateInterval = setInterval(updateActiveTime, 5000);

  // Cleanup function
  return () => {
    clearInterval(updateInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);

    // Send final time on cleanup
    updateActiveTime();
  };
}

/**
 * Get current engagement time in seconds
 */
export function getCurrentEngagementTime(startTime: number): number {
  return Math.floor((Date.now() - startTime) / 1000);
}
