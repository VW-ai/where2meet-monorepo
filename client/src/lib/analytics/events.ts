/**
 * Google Analytics 4 custom event tracking helpers
 *
 * Usage:
 * ```typescript
 * import { analyticsEvents } from '@/lib/analytics/events'
 *
 * // Track event creation
 * analyticsEvents.createEvent(eventId)
 * ```
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (command: string, targetId: string | Date, config?: Record<string, unknown>) => void;
  }
}

/**
 * Track a custom event in Google Analytics
 */
export function trackEvent(eventName: string, parameters?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
}

/**
 * Predefined analytics events for Where2Meet
 */
export const analyticsEvents = {
  /**
   * Track when a user creates a new event
   */
  createEvent: (eventId: string) => {
    trackEvent('create_event', {
      event_id: eventId,
      event_category: 'engagement',
    });
  },

  /**
   * Track when a user joins an event as a participant
   */
  joinEvent: (eventId: string, participantId?: string) => {
    trackEvent('join_event', {
      event_id: eventId,
      participant_id: participantId,
      event_category: 'engagement',
    });
  },

  /**
   * Track when a user adds their location to an event
   */
  addLocation: (eventId: string, address?: string) => {
    trackEvent('add_location', {
      event_id: eventId,
      has_address: !!address,
      event_category: 'engagement',
    });
  },

  /**
   * Track when a user votes for a venue
   */
  voteVenue: (eventId: string, venueId: string, voteType: 'up' | 'down') => {
    trackEvent('vote_venue', {
      event_id: eventId,
      venue_id: venueId,
      vote_type: voteType,
      event_category: 'engagement',
    });
  },

  /**
   * Track when a user publishes/finalizes a meeting
   */
  publishMeeting: (eventId: string, venueId?: string) => {
    trackEvent('publish_meeting', {
      event_id: eventId,
      venue_id: venueId,
      event_category: 'conversion',
    });
  },

  /**
   * Track when a user shares an event
   */
  shareEvent: (eventId: string, method: 'link' | 'social') => {
    trackEvent('share', {
      event_id: eventId,
      method,
      content_type: 'event',
      event_category: 'engagement',
    });
  },
};
