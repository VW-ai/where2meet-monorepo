import type { Locale } from '@/shared/lib/i18n';

interface TutorialStepText {
  title: string;
  description: string;
}

export interface TutorialStep {
  id: string;
  text: Record<Locale, TutorialStepText>;
  targetSelector: string; // CSS selector to find the target element
  placement: 'top' | 'bottom' | 'left' | 'right';
  highlightPadding: number; // Padding around the spotlight in pixels
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'share-link',
    text: {
      en: {
        title: 'Share Your Event',
        description:
          'Click here to get a shareable link. Send it to participants so they can join and add their locations.',
      },
      zh: {
        title: '分享你的见面',
        description: '点击这里获取分享链接，发给参与者，他们就能加入并填写自己的位置。',
      },
    },
    targetSelector: '[data-tutorial="share-button"]',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'drag-search',
    text: {
      en: {
        title: 'Adjust Search Area',
        description:
          'Drag this circle to set where you want to search for meeting venues. You can also resize it to search in a wider or narrower area.',
      },
      zh: {
        title: '调整搜索范围',
        description: '拖动这个圆圈，选择要在哪里找见面地点。也可以调整大小，扩大或缩小搜索范围。',
      },
    },
    targetSelector: '[data-tutorial="search-circle"]',
    placement: 'left',
    highlightPadding: 16,
  },
  {
    id: 'view-toggle',
    text: {
      en: {
        title: 'Switch Between Views',
        description:
          'Toggle between Venues and Participants views. Use Venues to search and vote on meeting spots, and Participants to manage who is joining.',
      },
      zh: {
        title: '切换视图',
        description:
          '在“地点”和“参与者”之间切换。在“地点”里搜索见面地点并投票，在“参与者”里管理谁会来。',
      },
    },
    targetSelector: '[data-tutorial="view-toggle"]',
    placement: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'travel-stats',
    text: {
      en: {
        title: 'View Travel Times',
        description:
          'Click this icon to see detailed travel statistics for all participants. This helps you find the most convenient spot.',
      },
      zh: {
        title: '查看路程时间',
        description: '点击这个图标，查看每位参与者的详细路程数据，帮你找到最方便的地点。',
      },
    },
    targetSelector: '[data-tutorial="stats-button"]',
    placement: 'left',
    highlightPadding: 12,
  },
];
