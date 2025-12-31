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

  /**
   * Track when organizer tutorial starts
   */
  tutorialStarted: (eventId: string) => {
    trackEvent('tutorial_started', {
      event_id: eventId,
      tutorial_type: 'organizer_first_time',
      event_category: 'engagement',
    });
  },

  /**
   * Track when a tutorial step is completed
   */
  tutorialStepCompleted: (eventId: string, step: number) => {
    trackEvent('tutorial_step_completed', {
      event_id: eventId,
      step_number: step,
      tutorial_type: 'organizer_first_time',
      event_category: 'engagement',
    });
  },

  /**
   * Track when tutorial is skipped
   */
  tutorialSkipped: (eventId: string, atStep: number) => {
    trackEvent('tutorial_skipped', {
      event_id: eventId,
      at_step: atStep,
      tutorial_type: 'organizer_first_time',
      event_category: 'engagement',
    });
  },

  /**
   * Track when tutorial is completed
   */
  tutorialCompleted: (eventId: string) => {
    trackEvent('tutorial_completed', {
      event_id: eventId,
      tutorial_type: 'organizer_first_time',
      event_category: 'engagement',
    });
  },

  /**
   * Track scroll depth milestone
   */
  scrollDepth: (depth: number, pagePath: string) => {
    trackEvent('scroll_depth', {
      scroll_depth: depth,
      page_path: pagePath,
      event_category: 'engagement',
    });
  },

  /**
   * Track engagement time milestone
   */
  engagementTime: (seconds: number, pagePath: string) => {
    trackEvent('engagement_time', {
      engagement_seconds: seconds,
      page_path: pagePath,
      event_category: 'engagement',
    });
  },

  /**
   * Track CTA click with context
   */
  ctaClick: (params: {
    ctaText: string;
    ctaLocation: string;
    ctaType: string;
    pagePath: string;
    destination?: string;
    customAttributes?: Record<string, string | number | boolean>;
  }) => {
    trackEvent('cta_click', {
      cta_text: params.ctaText,
      cta_location: params.ctaLocation,
      cta_type: params.ctaType,
      page_path: params.pagePath,
      destination: params.destination,
      event_category: 'conversion',
      ...params.customAttributes,
    });
  },

  /**
   * Track exit intent (user about to leave page)
   */
  exitIntent: (pagePath: string, timeOnPage: number) => {
    trackEvent('exit_intent', {
      page_path: pagePath,
      time_on_page: timeOnPage,
      event_category: 'engagement',
    });
  },
};
