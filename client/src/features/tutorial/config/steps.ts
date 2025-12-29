export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetSelector: string; // CSS selector to find the target element
  placement: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding: number; // Padding around the spotlight in pixels
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'share-link',
    title: 'Share Your Event',
    description:
      'Click here to get a shareable link. Send it to participants so they can join and add their locations.',
    targetSelector: '[data-tutorial="share-button"]',
    placement: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'drag-search',
    title: 'Adjust Search Area',
    description:
      'Drag this circle to set where you want to search for meeting venues. You can also resize it to search in a wider or narrower area.',
    targetSelector: '[data-tutorial="search-circle"]',
    placement: 'left',
    highlightPadding: 12,
  },
  {
    id: 'view-toggle',
    title: 'Switch Between Views',
    description:
      'Toggle between Venues and Participants views. Use Venues to search and vote on meeting spots, and Participants to manage who is joining.',
    targetSelector: '[data-tutorial="view-toggle"]',
    placement: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'travel-stats',
    title: 'View Travel Times',
    description:
      'Click this icon to see detailed travel statistics for all participants. This helps you find the fairest meeting spot.',
    targetSelector: '[data-tutorial="stats-button"]',
    placement: 'left',
    highlightPadding: 8,
  },
];
