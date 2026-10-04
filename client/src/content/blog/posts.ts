import {
  Briefcase,
  Coffee,
  Heart,
  Mountain,
  Plane,
  Sun,
  Users,
  Utensils,
  type IconNode,
} from 'lucide';
import { assertIsoDate } from '@/lib/seo/site-pages';

/** The homepage's meeting-type chips, plus occasions only the blog writes about. */
export const OCCASIONS = {
  'date-night': { label: 'Date night', icon: Heart },
  'team-meeting': { label: 'Team meeting', icon: Briefcase },
  'group-dinner': { label: 'Group dinner', icon: Utensils },
  'coffee-catch-up': { label: 'Coffee catch-up', icon: Coffee },
  'weekend-hangout': { label: 'Weekend hangout', icon: Sun },
  'family-outing': { label: 'Family outing', icon: Users },
  'team-offsite': { label: 'Team offsite', icon: Mountain },
  'long-distance-reunion': { label: 'Long-distance reunion', icon: Plane },
} satisfies Record<string, { label: string; icon: IconNode }>;

export type Occasion = keyof typeof OCCASIONS;

type IsoDate = `${number}-${number}-${number}`;

export interface BlogPost {
  /** Also the body's file name: `src/content/blog/<slug>.mdx`. */
  slug: string;
  title: string;
  description: string;
  publishedAt: IsoDate;
  updatedAt: IsoDate;
  occasion: Occasion;
  coverAlt: string;
}

export const BLOG_AUTHOR = 'The Where2Meet team';

const posts: BlogPost[] = [
  {
    slug: 'how-to-choose-a-team-meeting-location',
    title: 'How to choose a team meeting location everyone can reach',
    description:
      'Your team is spread across town. Compare travel times, pick a venue that suits the meeting, and settle on a place without a week of back-and-forth.',
    publishedAt: '2026-10-04',
    updatedAt: '2026-10-04',
    occasion: 'team-meeting',
    coverAlt:
      'Three teammates’ routes meeting at a briefcase pin on a city map, each trip about 20 minutes, next to the article title.',
  },
];

/** Newest first. Dates are checked at module load so a typo fails the build. */
export const BLOG_POSTS: readonly BlogPost[] = posts
  .map((post) => ({
    ...post,
    publishedAt: assertIsoDate(post.publishedAt, `${post.slug}.publishedAt`),
    updatedAt: assertIsoDate(post.updatedAt, `${post.slug}.updatedAt`),
  }))
  .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function postPath(slug: string) {
  return `/blog/${slug}`;
}

export function coverPath(slug: string) {
  return `${postPath(slug)}/cover.png`;
}
